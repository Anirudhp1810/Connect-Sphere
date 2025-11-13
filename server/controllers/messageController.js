const Messages = require("../models/messageModel");
const Chat = require("../models/chatModel");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// --- Cloudinary/Multer config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "snappy_files",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "mp3", "mp4", "mkv"],
    resource_type: "auto",
  },
});

module.exports.uploadFile = multer({ storage }).single("file");

module.exports.getMessages = async (req, res, next) => {
  try {
    const { chatId, from } = req.body;

    const messages = await Messages.find({
      chat: chatId,
    })
    .populate("sender", "username avatarImage")
    .populate("readBy", "_id")
    .sort({ updatedAt: 1 });

    const projectedMessages = messages.map((msg) => {
      return {
        _id: msg._id,
        fromSelf: msg.sender._id.toString() === from,
        message: msg.message.text,
        sender: msg.sender,
        readBy: msg.readBy.map(user => user._id),
        createdAt: msg.createdAt,
      };
    });
    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

// === UPDATED addMessage function ===
module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, chatId, message } = req.body;
    
    let data = await Messages.create({
      message: { text: message },
      sender: from,
      chat: chatId,
    });

    if (data) {
      // ✅ UPDATE: Safely increment unreadCounts
      const chat = await Chat.findById(chatId);
      
      if (chat) {
        chat.users.forEach(userId => {
          if (userId.toString() !== from) {
            const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
            chat.unreadCounts.set(userId.toString(), currentCount + 1);
          }
        });
        
        chat.latestMessage = data._id;
        
        // ✅ CRITICAL FIX: Tell Mongoose the Map changed so it saves properly
        chat.markModified('unreadCounts'); 
        await chat.save();
      }

      data = await data.populate("sender", "username avatarImage");
      data = await data.populate("chat");
      data = await data.populate("readBy", "_id");

      return res.json(data);
    } else {
      return res.json({ msg: "Failed to add message to the database" });
    }
  } catch (ex) {
    next(ex);
  }
};

// === UPDATED addFileMessage function ===
module.exports.addFileMessage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.json({ msg: "File upload failed.", status: false });
    }

    const { from, chatId } = req.body;
    const fileUrl = req.file.path;

    let data = await Messages.create({
      message: { text: fileUrl },
      sender: from,
      chat: chatId,
    });

    if (data) {
      // ✅ UPDATE: Safely increment unreadCounts
      const chat = await Chat.findById(chatId);
      
      if (chat) {
        chat.users.forEach(userId => {
          if (userId.toString() !== from) {
            const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
            chat.unreadCounts.set(userId.toString(), currentCount + 1);
          }
        });

        chat.latestMessage = data._id;
        
        // ✅ CRITICAL FIX: Mark as modified
        chat.markModified('unreadCounts');
        await chat.save(); 
      }

      data = await data.populate("sender", "username avatarImage");
      data = await data.populate("chat");
      data = await data.populate("readBy", "_id");
      
      return res.json(data);
    } else {
      return res.json({ msg: "Failed to save file message to the database" });
    }
  } catch (ex) {
    next(ex);
  }
};

module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.body;

    const updatedMessage = await Messages.findByIdAndUpdate(
      messageId,
      { "message.text": "[This message was deleted]" },
      { new: true }
    );

    if (updatedMessage) {
      return res.json({ msg: "Message deleted successfully.", status: true });
    } else {
      return res.json({ msg: "Failed to delete message.", status: false });
    }
  } catch (ex) {
    next(ex);
  }
};

// === UPDATED markAsRead function ===
module.exports.markAsRead = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    // 1. Mark actual messages as read
    await Messages.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $nin: [userId] },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    // 2. ✅ Reset unreadCount to 0
    const chat = await Chat.findById(chatId);
    if (chat) {
      chat.unreadCounts.set(userId, 0);
      // ✅ CRITICAL FIX: Mark as modified
      chat.markModified('unreadCounts');
      await chat.save();
    }

    return res.json({ msg: "Messages marked as read.", status: true });
  } catch (ex) {
    next(ex);
  }
};