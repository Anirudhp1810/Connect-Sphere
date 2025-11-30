const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    min: 3,
    max: 20,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    max: 50,
  },
  password: {
    type: String,
    required: true,
    min: 8,
  },
  isAvatarImageSet: {
    type: Boolean,
    default: false,
  },
  avatarImage: {
    type: String,
    default: "",
  },
  // === PRIVACY SETTINGS ===
  showReadReceipts: {
    type: Boolean,
    default: true, 
  },
  showLastSeen: {
    type: Boolean,
    default: true, 
  },
  // === NEW: LAST SEEN TIMESTAMP ===
  lastSeenTime: {
    type: Date,
    default: Date.now, // Stores the last time they were active
  },
});

module.exports = mongoose.model("Users", userSchema);