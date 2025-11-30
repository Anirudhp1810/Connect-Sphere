require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const User = require("./models/userModel"); // For Last Seen
const app = express();
const socket = require("socket.io");

app.use(cors());
app.use(express.json());

mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connection Successful");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.get("/ping", (_req, res) => {
  return res.json({ msg: "Ping Successful" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on ${process.env.PORT}`)
);

const io = socket(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
      process.env.FRONTEND_ORIGIN,
    ],
    credentials: true,
  },
});

// Map<UserId, Set<SocketId>>
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  global.chatSocket = socket;

  // 1. ADD USER & ONLINE STATUS
  socket.on("add-user", (userId) => {
    if (!userId) return;

    socket.join(userId);
    socket.userId = userId;

    if (!global.onlineUsers.has(userId)) {
      global.onlineUsers.set(userId, new Set());
    }
    global.onlineUsers.get(userId).add(socket.id);

    io.emit("user-online", userId);

    const onlineIds = Array.from(global.onlineUsers.keys());
    socket.emit("online-users", onlineIds);
    socket.emit("get-online-users", onlineIds);

    console.log(`User online: ${userId}`);
  });

  // Backward compatibility
  socket.on("setup", (userData) => {
    if (userData?._id) {
      socket.join(userData._id);
      socket.emit("connected");
    }
  });

  // 2. NEW MESSAGE HANDLING
  socket.on("new-message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;
    if (!chat?.users) return;

    const flatMessage = {
      _id: newMessageReceived._id,
      sender: newMessageReceived.sender,
      message: newMessageReceived.message?.text || newMessageReceived.message || "",
      createdAt: newMessageReceived.createdAt,
      updatedAt: newMessageReceived.updatedAt,
      readBy: Array.isArray(newMessageReceived.readBy)
        ? newMessageReceived.readBy.map((u) => u._id)
        : [],
      chat: chat,
      replyTo: newMessageReceived.replyTo,
    };

    chat.users.forEach((user) => {
      const userId = user._id ? user._id : user;
      if (userId.toString() === newMessageReceived.sender._id.toString()) return;

      io.to(userId.toString()).emit("msg-recieve", flatMessage);
      io.to(userId.toString()).emit("message-received", flatMessage);
    });
  });

  // 3. DISCONNECT & LAST SEEN — THE REAL FIX
  socket.on("disconnect", async () => {
    if (!socket.userId) return;

    const userId = socket.userId;

    if (global.onlineUsers.has(userId)) {
      const userSockets = global.onlineUsers.get(userId);
      userSockets.delete(socket.id);

      // Only when NO sockets left → user is truly offline
      if (userSockets.size === 0) {
        global.onlineUsers.delete(userId);

        try {
          // Update lastSeenTime in DB
          await User.findByIdAndUpdate(userId, { lastSeenTime: new Date() });

          // Get fresh user data
          const updatedUser = await User.findById(userId).select("lastSeenTime showLastSeen");

          // THIS IS THE KEY: Tell EVERYONE the exact new lastSeenTime
          io.emit("user-lastseen-updated", {
            userId: userId,
            lastSeenTime: updatedUser.lastSeenTime,
            showLastSeen: updatedUser.showLastSeen || false,
          });

          // Also tell everyone user is offline
          io.emit("user-offline", userId);

          // Update online list
          const onlineIds = Array.from(global.onlineUsers.keys());
          io.emit("online-users", onlineIds);

          console.log(`User offline: ${userId} | Last seen updated`);
        } catch (err) {
          console.error("Error updating last seen:", err);
        }
      }
    }
  });

  // Other events
  socket.on("join-chat", (room) => socket.join(room));
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop-typing", (room) => socket.in(room).emit("stop-typing"));

  socket.on("delete-message", (data) => {
    if (data?.chatId) io.to(data.chatId).emit("message-deleted", { messageId: data.messageId });
  });

  socket.on("new-group", (newChat) => {
    if (!newChat?.users) return;
    newChat.users.forEach((user) => {
      const userId = user._id ? user._id : user;
      if (userId.toString() === newChat.groupAdmin._id.toString()) return;
      io.to(userId.toString()).emit("added-to-group", newChat);
    });
  });

  socket.on("mark-read", (data) => {
    if (data.chatId && data.userId) {
      io.in(data.chatId).emit("messages-read", {
        chatId: data.chatId,
        readByUserId: data.userId,
      });
    }
  });
});