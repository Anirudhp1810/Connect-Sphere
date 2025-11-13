const { 
  addMessage, 
  getMessages, 
  addFileMessage, 
  uploadFile,
  deleteMessage,
  markAsRead // <-- 1. Import the new markAsRead function
} = require("../controllers/messageController");

const router = require("express").Router();

router.post("/addmsg/", addMessage);
router.post("/getmsg/", getMessages);
router.post("/addfilemsg/", uploadFile, addFileMessage);
router.post("/deletemsg/", deleteMessage);

// 2. Add the new route for marking messages as read
router.post("/markread/", markAsRead);

module.exports = router;