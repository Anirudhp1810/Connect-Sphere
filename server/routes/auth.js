const {
  login,
  register,
  getAllUsers,
  setAvatar,
  logOut,
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  deleteChat,
  verifyUser,
  updatePrivacySettings, // ✅ 1. IMPORT the new function
} = require("../controllers/userController");

const router = require("express").Router();

// --- User Auth Routes ---
router.post("/login", login);
router.post("/register", register);
router.get("/allusers/:id", getAllUsers);
router.post("/setavatar/:id", setAvatar);
router.get("/logout/:id", logOut);
router.post("/verify", verifyUser);

// --- ✅ NEW: Privacy Settings Route ---
router.post("/update-privacy", updatePrivacySettings); 

// --- Chat & Group Routes ---
router.post("/chat", accessChat);
router.get("/chat/:id", fetchChats);
router.post("/chat/delete", deleteChat);

// --- Group Management ---
router.post("/group", createGroupChat);
router.put("/group/rename", renameGroup);
router.put("/group/add", addToGroup);
router.put("/group/remove", removeFromGroup);

module.exports = router;