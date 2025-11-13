export const host = process.env.REACT_APP_API_URL;
export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;

// This route's purpose has changed. It is now used for SEARCHING users.
export const allUsersRoute = `${host}/api/auth/allusers`; 

export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const recieveMessageRoute = `${host}/api/messages/getmsg`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;
export const uploadMessageRoute = `${host}/api/messages/addfilemsg`;

// === NEW ROUTES FOR CHATS & GROUPS ===
export const fetchChatsRoute = `${host}/api/auth/chat`;
export const accessChatRoute = `${host}/api/auth/chat`;
export const createGroupRoute = `${host}/api/auth/group`;

// === NEW ROUTE FOR DELETING MESSAGES ===
export const deleteMessageRoute = `${host}/api/messages/deletemsg`;

// === NEW ROUTE FOR DELETING CHATS ===
export const deleteChatRoute = `${host}/api/auth/chat/delete`;

// === NEW ROUTE FOR READ RECEIPTS ===
export const markAsReadRoute = `${host}/api/messages/markread`;

// === NEW ROUTE FOR VERIFYING USER ===
export const verifyUserRoute = `${host}/api/auth/verify`;