const Messages = require("../models/messageModel");
const Chat = require("../models/chatModel");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// --- Cloudinary Config ---
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

// GET ALL MESSAGES
module.exports.getMessages = async (req, res, next) => {
  try {
    const { chatId, from } = req.body;

    const messages = await Messages.find({ chat: chatId })
      // ✅ UPDATE: Include showReadReceipts in sender details
      .populate("sender", "username avatarImage showReadReceipts")
      .populate("readBy", "_id")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "username avatarImage",
        },
      })
      .sort({ updatedAt: 1 });

    const projectedMessages = messages.map((msg) => ({
      _id: msg._id,
      fromSelf: msg.sender._id.toString() === from,
      message: msg.message.text,
      sender: msg.sender, // This now includes showReadReceipts
      readBy: msg.readBy.map((user) => user._id),
      createdAt: msg.createdAt,
      replyTo: msg.replyTo
        ? {
            _id: msg.replyTo._id,
            message: msg.replyTo.message.text,
            sender: msg.replyTo.sender,
          }
        : null,
    }));

    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

// ADD TEXT MESSAGE
module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, chatId, message, replyTo } = req.body;

    const newMessage = await Messages.create({
      message: { text: message },
      sender: from,
      chat: chatId,
      replyTo: replyTo || null,
    });

    if (newMessage) {
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.users.forEach((userId) => {
          if (userId.toString() !== from) {
            const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
            chat.unreadCounts.set(userId.toString(), currentCount + 1);
          }
        });
        chat.latestMessage = newMessage._id;
        chat.markModified("unreadCounts");
        await chat.save();
      }

            const populatedMessage = await Messages.findById(newMessage._id)
        .populate("sender", "username avatarImage showReadReceipts showLastSeen")
        .populate({
          path: "chat",
          populate: {
            path: "users",
            select: "username avatarImage _id showLastSeen showReadReceipts"
          }
        })
        .populate("readBy", "_id")
        .populate({
          path: "replyTo",
          populate: { path: "sender", select: "username avatarImage" }
        });

      return res.json(populatedMessage);
    } else {
      return res.json({ msg: "Failed to add message to the database" });
    }
  } catch (ex) {
    next(ex);
  }
};

// ADD FILE MESSAGE
module.exports.addFileMessage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.json({ msg: "File upload failed.", status: false });
    }

    const { from, chatId } = req.body;
    const fileUrl = req.file.path;

    const newMessage = await Messages.create({
      message: { text: fileUrl },
      sender: from,
      chat: chatId,
    });

    if (newMessage) {
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.users.forEach((userId) => {
          if (userId.toString() !== from) {
            const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
            chat.unreadCounts.set(userId.toString(), currentCount + 1);
          }
        });
        chat.latestMessage = newMessage._id;
        chat.markModified("unreadCounts");
        await chat.save();
      }

            const populatedMessage = await Messages.findById(newMessage._id)
        .populate("sender", "username avatarImage showReadReceipts showLastSeen")
        .populate({
          path: "chat",
          populate: {
            path: "users",
            select: "username avatarImage _id showLastSeen showReadReceipts"
          }
        })
        .populate("readBy", "_id");

      return res.json(populatedMessage);
    }
  } catch (ex) {
    next(ex);
  }
};

// DELETE MESSAGE (unchanged)
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

// MARK AS READ (unchanged)
module.exports.markAsRead = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    await Messages.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $nin: [userId] },
      },
      { $addToSet: { readBy: userId } }
    );

    const chat = await Chat.findById(chatId);
    if (chat) {
      chat.unreadCounts.set(userId, 0);
      chat.markModified("unreadCounts");
      await chat.save();
    }

    return res.json({ msg: "Messages marked as read.", status: true });
  } catch (ex) {
    next(ex);
  }
};