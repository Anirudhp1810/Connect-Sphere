const mongoose = require("mongoose");

const chatModelSchema = new mongoose.Schema(
  {
    chatName: { 
      type: String, 
      trim: true 
    },
    isGroupChat: { 
      type: Boolean, 
      default: false 
    },
    users: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Users" 
    }],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Messages" 
    },
    groupAdmin: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Users" 
    },
    // ✅ ADD THIS FIELD: Tracks unread messages for each user ID
    unreadCounts: {
      type: Map,
      of: Number,
      default: {} 
    }
  },
  {
    timestamps: true, 
  }
);

module.exports = mongoose.model("Chat", chatModelSchema);