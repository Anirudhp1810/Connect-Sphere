const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Chat = require("../models/chatModel");
const mongoose = require("mongoose");
const Messages = require("../models/messageModel");

module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ msg: "Incorrect Username or Password", status: false });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.json({ msg: "Incorrect Username or Password", status: false });
    
    // --- THIS IS THE FIX ---
    const userObj = user.toObject();
    delete userObj.password;
    return res.json({ status: true, user: userObj });
    // --- END FIX ---

  } catch (ex) {
    next(ex);
  }
};

module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck)
      return res.json({ msg: "Username already used", status: false });
    const emailCheck = await User.findOne({ email });
    if (emailCheck)
      return res.json({ msg: "Email already used", status: false });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      username,
      password: hashedPassword,
    });
    
    // --- THIS IS THE FIX ---
    const userObj = user.toObject();
    delete userObj.password;
    return res.json({ status: true, user: userObj });
    // --- END FIX ---

  } catch (ex) {
    next(ex);
  }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const keyword = req.query.search
      ? {
          $or: [
            { username: { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(keyword)
      .find({ _id: { $ne: req.params.id } })
      .select(["email", "username", "avatarImage", "_id"]);
      
    return res.json(users);
  } catch (ex) {
    next(ex);
  }
};

module.exports.setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;
    const userData = await User.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { new: true }
    );
    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (ex) {
    next(ex);
  }
};

module.exports.logOut = (req, res, next) => {
  try {
    if (!req.params.id) return res.json({ msg: "User id is required " });
    return res.status(200).send();
  } catch (ex) {
    next(ex);
  }
};

module.exports.accessChat = async (req, res, next) => {
  const { userId, currentUserId } = req.body; 

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  let isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: currentUserId } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password") 
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "username avatarImage email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]); 
  } else {
    var chatData = {
      chatName: "sender", 
      isGroupChat: false,
      users: [currentUserId, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (ex) {
      next(ex);
    }
  }
};

module.exports.fetchChats = async (req, res, next) => {
  try {
    let chats = await Chat.find({ users: { $elemMatch: { $eq: req.params.id } } })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 }); 

    chats = await User.populate(chats, {
      path: "latestMessage.sender",
      select: "username avatarImage email",
    });
      
    res.status(200).send(chats);
  } catch (ex) {
    next(ex);
  }
};

module.exports.createGroupChat = async (req, res, next) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please fill all the fields" });
  }

  let users = JSON.parse(req.body.users);
  users.push(req.body.currentUserId); 

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.body.currentUserId,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (ex) {
    next(ex);
  }
};

module.exports.renameGroup = async (req, res, next) => {
  const { chatId, chatName } = req.body;

  try {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName: chatName },
      { new: true } 
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!updatedChat) {
      return res.status(404).send("Chat Not Found");
    } else {
      res.json(updatedChat);
    }
  } catch (ex) {
    next(ex);
  }
};

module.exports.addToGroup = async (req, res, next) => {
  const { chatId, userId } = req.body;

  try {
    const added = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userId } }, 
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!added) {
      return res.status(404).send("Chat Not Found");
    } else {
      res.json(added); // <-- THIS IS THE FIX
    }
  } catch (ex) {
    next(ex);
  }
};

module.exports.removeFromGroup = async (req, res, next) => {
  const { chatId, userId } = req.body;

  try {
    const removed = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } }, 
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!removed) {
      return res.status(404).send("Chat Not Found");
    } else {
      res.json(removed);
    }
  } catch (ex) {
    next(ex);
  }
};

module.exports.deleteChat = async (req, res, next) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).send({ message: "Chat ID is required" });
  }

  // --- THIS IS THE FIX (Removed duplicated try block) ---
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).send("Chat Not Found");
    }

    await Messages.deleteMany({ chat: chatId });
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({ msg: "Chat deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};
// --- END FIX ---

module.exports.verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.json({ status: false, msg: "No user ID provided." });
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
       return res.json({ status: false, msg: "Invalid user ID format." });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.json({ status: false, msg: "User not found." });
    }

    return res.json({ status: true, user: user });

  } catch (ex) {
    next(ex);
  }
};