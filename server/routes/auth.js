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
  verifyUser, // <-- 1. IMPORT the new function
} = require("../controllers/userController");

const router = require("express").Router();

// --- Existing User Routes ---
router.post("/login", login);
router.post("/register", register);
router.get("/allusers/:id", getAllUsers);
router.post("/setavatar/:id", setAvatar);
router.get("/logout/:id", logOut);

// --- NEW VERIFY ROUTE ---
router.post("/verify", verifyUser); // <-- 2. ADD the new route

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