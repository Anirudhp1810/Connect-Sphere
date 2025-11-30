const {
  addMessage,
  getMessages,
  addFileMessage,
  uploadFile,
  deleteMessage,
  markAsRead,
} = require("../controllers/messageController");

const router = require("express").Router();

// Add text message (now supports optional "replyTo" in body)
router.post("/addmsg/", addMessage);

// Get all messages in a chat (now includes populated replyTo data)
router.post("/getmsg/", getMessages);

// Upload and add file message
router.post("/addfilemsg/", uploadFile, addFileMessage);

// Delete a message (soft delete)
router.post("/deletemsg/", deleteMessage);

// Mark messages as read in a chat
router.post("/markread/", markAsRead);

module.exports = router;