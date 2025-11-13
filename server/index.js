require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const app = express();
const socket = require("socket.io");

app.use(cors());
app.use(express.json());

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
      "http://localhost:3001", // ✅ ADDED THIS: Fixes your specific issue
      "http://localhost:5173", 
      "http://localhost:5174", 
      process.env.CLIENT_URL,
    ],
    credentials: true,
  },
});

// ✅ ROBUST ONLINE TRACKING: Map<UserId, Set<SocketId>>
// Allows a user to be online in multiple tabs/browsers simultaneously
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  global.chatSocket = socket;

  // 1. SETUP
  socket.on("setup", (userData) => {
    if (!userData || !userData._id) return;
    const userId = userData._id.toString(); 
    
    socket.join(userId);
    socket.userId = userId;

    // Add socket ID to the User's Set
    if (!global.onlineUsers.has(userId)) {
      global.onlineUsers.set(userId, new Set());
    }
    global.onlineUsers.get(userId).add(socket.id);

    // Broadcast "Online"
    io.emit("user-online", userId);
    
    // Send active list to user
    const onlineIds = Array.from(global.onlineUsers.keys());
    socket.emit("get-online-users", onlineIds);
    
    console.log(`🟢 ${userData.username} is online.`);
  });

  // 2. DISCONNECT
  socket.on("disconnect", () => {
    if (socket.userId) {
      const userId = socket.userId;
      
      if (global.onlineUsers.has(userId)) {
        const userSockets = global.onlineUsers.get(userId);
        userSockets.delete(socket.id);

        // Only mark offline if NO sockets remain (user closed ALL tabs)
        if (userSockets.size === 0) {
          global.onlineUsers.delete(userId);
          io.emit("user-offline", userId);
          console.log(`🔴 ${userId} went offline.`);
        }
      }
    }
  });

  // ... Other Events ...
  socket.on("join-chat", (room) => socket.join(room));
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop-typing", (room) => socket.in(room).emit("stop-typing"));
  
  socket.on("new-message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;
    if (!chat?.users) return;
    chat.users.forEach((user) => {
      const userId = user._id ? user._id : user;
      if (userId.toString() === newMessageReceived.sender._id.toString()) return;
      io.to(userId.toString()).emit("message-received", newMessageReceived);
    });
  });

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