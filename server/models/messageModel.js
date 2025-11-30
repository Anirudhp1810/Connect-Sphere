const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
  {
    message: {
      text: { type: String, required: true },
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    // === FIELD FOR REPLYING TO A MESSAGE ===
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Messages",
      default: null,
    },
    // === EXISTING READ RECEIPTS ===
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Optional: Index for better query performance when fetching replies
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ replyTo: 1 });

module.exports = mongoose.model("Messages", MessageSchema);