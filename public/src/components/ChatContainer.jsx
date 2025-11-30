import React, { useState, useEffect, useRef } from "react";
import Logo from "../assets/logo.png";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import {
  sendMessageRoute,
  recieveMessageRoute,
  deleteMessageRoute,
  markAsReadRoute,
} from "../utils/APIRoutes";
import { AiFillFileText } from "react-icons/ai";
import { IoMdTrash } from "react-icons/io";
import { CgClose } from "react-icons/cg";
import { BsCheck2All, BsReplyFill } from "react-icons/bs";
import { IoArrowBack } from "react-icons/io5";

export default function ChatContainer({
  currentChat,
  socket,
  currentUser,
  arrivalMessage,
  setArrivalMessage,
  onBackClick,
  onlineUsers = [],
}) {
  const [messages, setMessages] = useState([]);

  const chatContainerRef = useRef();
  const scrollBehavior = useRef("auto");

  const [isTyping, setIsTyping] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatAvatar, setChatAvatar] = useState("");
  const [replyMessage, setReplyMessage] = useState(null);
  const [activeDeleteMenu, setActiveDeleteMenu] = useState(null);
  const [deletedForMe, setDeletedForMe] = useState(() => {
    const saved = localStorage.getItem("deletedForMe");
    return new Set(saved ? JSON.parse(saved) : []);
  });
  const otherUser = currentChat && !currentChat.isGroupChat
    ? currentChat.users.find(user => user._id !== currentUser._id)
    : null;

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!currentChat || !currentUser) {
      setChatName("");
      setChatAvatar("");
      return;
    }

    if (currentChat.isGroupChat) {
      setChatName(currentChat.chatName || "Group Chat");
      setChatAvatar(currentChat.users[0]?.avatarImage || "");
    } else {
      const otherUser = currentChat.users.find(user => user._id !== currentUser._id);
      if (otherUser) {
        setChatName(otherUser.username);
        setChatAvatar(otherUser.avatarImage);
      } else {
        setChatName("Unknown User");
        setChatAvatar("");
      }
    }
  }, [currentChat, currentUser]);

  // --- FETCH MESSAGES ---
  useEffect(() => {
    async function fetchMessages() {
      if (currentChat && currentUser) {
        try {
          const response = await axios.post(recieveMessageRoute, {
            from: currentUser._id,
            chatId: currentChat._id,
          });
          setMessages(response.data || []);

          if (socket.current) {
            socket.current.emit("join-chat", currentChat._id);
            socket.current.emit("mark-read", { chatId: currentChat._id, chat: currentChat, userId: currentUser._id });
          }
          await axios.post(markAsReadRoute, { chatId: currentChat._id, userId: currentUser._id }).catch(() => { });
        } catch (err) { console.error("Load Error:", err); }
      } else { setMessages([]); }
    }
    fetchMessages();
  }, [currentChat, currentUser, socket]);

  // --- SEND HANDLER ---
  const handleSendMsg = async (msg, replyToObj = null) => {
    if (!currentChat || !currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      fromSelf: true,
      message: msg,
      sender: {
        _id: currentUser._id,
        username: currentUser.username,
        avatarImage: currentUser.avatarImage,
        showReadReceipts: currentUser.showReadReceipts
      },
      readBy: [],
      createdAt: new Date().toISOString(),
      replyTo: replyToObj ? {
        _id: replyToObj._id,
        message: replyToObj.message || "",
        sender: replyToObj.sender || { username: "User" }
      } : null
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyMessage(null);

    try {
      const { data } = await axios.post(sendMessageRoute, {
        from: currentUser._id,
        chatId: currentChat._id,
        message: msg,
        replyTo: replyToObj ? replyToObj._id : null,
      });

      if (socket.current) socket.current.emit("new-message", data);

      setMessages((prev) => prev.map(m => m._id === tempId ? {
        ...m,
        _id: data._id,
        message: data.message?.text || m.message,
        sender: data.sender
      } : m));

    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // --- SOCKET EVENTS ---
  useEffect(() => {
    const currentSocket = socket.current;
    if (currentSocket) {
      currentSocket.on("typing", () => setIsTyping(true));
      currentSocket.on("stop-typing", () => setIsTyping(false));

      currentSocket.on("message-deleted", (data) => {
        setMessages((prev) => prev.map((msg) => msg._id === data.messageId ? { ...msg, message: "[This message was deleted]" } : msg));
      });

      currentSocket.on("messages-read", (data) => {
        if (data.chatId === currentChat?._id) {
          setMessages((prev) => prev.map((msg) => {
            if (msg.readBy && !msg.readBy.includes(data.readByUserId)) {
              return { ...msg, readBy: [...msg.readBy, data.readByUserId] };
            }
            return msg;
          })
          );
        }
      });
    }
    return () => {
      if (currentSocket) {
        currentSocket.off("typing");
        currentSocket.off("stop-typing");
        currentSocket.off("message-deleted");
        currentSocket.off("messages-read");
      }
    };
  }, [socket, currentChat]);

  // --- ARRIVAL MESSAGE HANDLER ---
  useEffect(() => {
    if (!arrivalMessage || !currentChat || !currentUser) { setArrivalMessage(null); return; }

    if (String(arrivalMessage.sender?._id) === String(currentUser._id)) {
      setArrivalMessage(null);
      return;
    }

    const belongsToOpenChat = arrivalMessage.chat === currentChat._id || arrivalMessage.chat?._id === currentChat._id;
    if (belongsToOpenChat) {
      const formattedMsg = {
        _id: arrivalMessage._id || `temp-${Date.now()}`,
        sender: arrivalMessage.sender,
        message: arrivalMessage.message || '',
        fromSelf: false,
        createdAt: arrivalMessage.createdAt || new Date().toISOString(),
        readBy: arrivalMessage.readBy || [],
        replyTo: arrivalMessage.replyTo,
      };

      setMessages((prev) => {
        if (prev.some(msg => msg._id === formattedMsg._id)) return prev;
        return [...prev, formattedMsg];
      });

      axios.post(markAsReadRoute, { chatId: currentChat._id, userId: currentUser._id }).catch(() => { });
      if (socket.current) socket.current.emit('mark-read', { chatId: currentChat._id, chat: currentChat, userId: currentUser._id });
    }
    setArrivalMessage(null);
  }, [arrivalMessage, currentChat, currentUser, setArrivalMessage, socket]);

  // --- SCROLL LOGIC ---
  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollHeight } = chatContainerRef.current;

      if (scrollBehavior.current === "auto") {
        chatContainerRef.current.scrollTop = scrollHeight;
        scrollBehavior.current = "smooth";
      } else {
        chatContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [messages, isTyping, replyMessage]);

  // --- HELPERS ---

  const getHeaderStatus = () => {
    if (!currentChat || currentChat.isGroupChat) return "";
    const otherUser = currentChat.users.find((u) => u._id !== currentUser._id);
    if (!otherUser) return "";

    if (currentUser.showLastSeen === false || otherUser.showLastSeen === false) {
      return "";
    }

    const isOnline = onlineUsers.some(id => String(id) === String(otherUser._id));
    if (isOnline) return <span className="status-online">Online</span>;

    if (otherUser.lastSeenTime) {
      const date = new Date(otherUser.lastSeenTime);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString();
      const isToday = new Date().toDateString() === date.toDateString();

      return `Last seen ${isToday ? 'at ' + timeStr : 'on ' + dateStr}`;
    }

    return "Offline";
  };

  const getSeenStatus = (message) => {
    if (!message.fromSelf || !currentChat || !currentUser) return null;
    if (String(message._id).startsWith("temp-")) return <BsCheck2All className="read-icon" style={{ opacity: 0.5 }} />;

    if (currentUser.showReadReceipts === false) return <BsCheck2All className="read-icon" />;

    if (!currentChat.isGroupChat) {
      const otherUser = currentChat.users.find(u => u._id !== currentUser._id);
      if (otherUser && otherUser.showReadReceipts === false) {
        return <BsCheck2All className="read-icon" />;
      }
    }

    const otherUserIds = currentChat.users.map((u) => u._id).filter((id) => id !== currentUser._id);
    if (otherUserIds.length === 0) return null;

    const allHaveRead = otherUserIds.every((id) => (message.readBy || []).includes(id));
    return allHaveRead ? <BsCheck2All className="read-icon seen" /> : <BsCheck2All className="read-icon" />;
  };

  const handleDeleteForEveryone = async (messageId) => {
    setActiveDeleteMenu(null);
    setMessages((prev) => prev.map((msg) => msg._id === messageId ? { ...msg, message: "[This message was deleted]" } : msg));
    if (socket.current) socket.current.emit("delete-message", { messageId, chatId: currentChat._id });
    try { await axios.post(deleteMessageRoute, { messageId }); } catch (err) { }
  };

  const handleDeleteForMe = (messageId) => {
    setActiveDeleteMenu(null);
    const newDeleted = new Set(deletedForMe);
    newDeleted.add(messageId);
    setDeletedForMe(newDeleted);
    localStorage.setItem("deletedForMe", JSON.stringify([...newDeleted]));
  };

  const renderMessageContent = (message) => {
    if (!message) return null;
    if (message === "[This message was deleted]") return <p className="deleted-message">{message}</p>;
    const msgStr = String(message);
    const isCloudinaryUrl = msgStr.startsWith("http://res.cloudinary.com") || msgStr.startsWith("https://res.cloudinary.com");
    if (!isCloudinaryUrl) return <p>{msgStr}</p>;
    const mediaRegex = /\.(jpg|jpeg|png|gif|mp4|mkv|webm)$/i;
    if (mediaRegex.test(msgStr)) {
      return /\.(jpg|jpeg|png|gif)$/i.test(msgStr) ? <img src={msgStr} alt="Sent file" /> : <video src={msgStr} controls />;
    } else {
      const fileName = msgStr.split("/").pop().substring(0, 20) + "...";
      return <a href={msgStr} target="_blank" rel="noopener noreferrer" className="file-link"><AiFillFileText /> {fileName}</a>;
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <>
      <Container>
        <div className="chat-header">
          <div className="mobile-back-btn" onClick={onBackClick}>
            <IoArrowBack />
          </div>

          <div className="user-details">
            <div className="avatar">
              <img
                src={chatAvatar ? `data:image/svg+xml;base64,${chatAvatar}` : Logo}
                alt="avatar"
              />
              {otherUser && onlineUsers.includes(otherUser._id) && (
                <div className="online-status-dot"></div>
              )}
            </div>

            <div className="header-info">
              <h3>{chatName || "Loading..."}</h3>
              <p className="status-text">
                {getHeaderStatus()}
              </p>
            </div>
          </div>
        </div>

        <div className="chat-messages" ref={chatContainerRef}>
          {messages.filter((msg) => !deletedForMe.has(msg._id)).map((message) => {
            return (
              <div key={message._id} className="message-wrapper">
                <div className={`message ${message.fromSelf ? "sended" : "recieved"}`}>
                  {currentChat.isGroupChat && !message.fromSelf && message.sender && (
                    <div className="avatar-mini">
                      <img
                        src={message.sender.avatarImage ? `data:image/svg+xml;base64,${message.sender.avatarImage}` : Logo}
                        alt="sender"
                      />
                    </div>
                  )}

                  <div className="message-bubble">
                    {currentChat.isGroupChat && !message.fromSelf && message.sender && (
                      <span className="sender-name">{message.sender?.username}</span>
                    )}

                    {message.replyTo && message.message !== "[This message was deleted]" && (
                      <div className="reply-quote">
                        <div className="reply-bar"></div>
                        <div className="reply-content">
                          <span className="reply-sender">
                            {message.replyTo.sender?.username || message.replyTo.senderUsername || "User"}
                          </span>
                          <p className="reply-text">
                            {message.replyTo.message ? String(message.replyTo.message).substring(0, 50) : ""}...
                          </p>
                        </div>
                      </div>
                    )}

                    {!String(message._id).startsWith("temp-") && (
                      <div className="action-triggers">
                        {message.message !== "[This message was deleted]" && (
                          <div className="trigger-btn reply" onClick={() => setReplyMessage(message)} title="Reply">
                            <BsReplyFill />
                          </div>
                        )}
                        <div className="trigger-btn delete" onClick={() => setActiveDeleteMenu(message._id)} title="Delete">
                          <IoMdTrash />
                        </div>
                      </div>
                    )}

                    <div className="content">{renderMessageContent(message.message)}</div>

                    <div className="meta-row">
                      <span className="timestamp">{message.createdAt && formatTimestamp(message.createdAt)}</span>
                      {message.fromSelf && message.message !== "[This message was deleted]" && (
                        <div className="read-receipt">{getSeenStatus(message)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="typing-indicator">
              <div className="dots"><span></span><span></span><span></span></div>
            </div>
          )}
        </div>

        <ChatInput
          handleSendMsg={handleSendMsg}
          socket={socket}
          currentChat={currentChat}
          currentUser={currentUser}
          replyMessage={replyMessage}
          setReplyMessage={setReplyMessage}
        />
      </Container>

      {activeDeleteMenu && (
        <DeleteMenuOverlay onClick={() => setActiveDeleteMenu(null)}>
          <div className="delete-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <span>Options</span>
              <CgClose onClick={() => setActiveDeleteMenu(null)} />
            </div>
            <button onClick={() => handleDeleteForMe(activeDeleteMenu)}><IoMdTrash /> Delete for me</button>
            {(() => {
              const msg = messages.find(m => m._id === activeDeleteMenu);
              if (msg?.fromSelf && msg?.message !== "[This message was deleted]") {
                return (
                  <button className="danger" onClick={() => handleDeleteForEveryone(activeDeleteMenu)}>
                    <IoMdTrash /> Delete for everyone
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </DeleteMenuOverlay>
      )}
    </>
  );
}

/* --- STYLES --- */
const DeleteMenuOverlay = styled.div`
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
    display: flex; justify-content: center; align-items: center; z-index: 3000; 
    .delete-menu {
        background-color: #15151e; border: 1px solid rgba(157, 78, 221, 0.2);
        border-radius: 16px; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; width: 280px; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        .menu-header {
            display: flex; justify-content: space-between; align-items: center; 
            color: #fff; font-size: 1rem; font-weight: 600; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 0.5rem;
            svg { cursor: pointer; color: #9d4edd; font-size: 1.2rem; transition: 0.2s; &:hover{ color: #fff; } }
        }
        button {
            background-color: transparent; border: none; color: #e1e1e6; text-align: left; padding: 0.8rem;
            cursor: pointer; border-radius: 10px; font-weight: 500; font-size: 0.95rem; transition: 0.2s;
            display: flex; align-items: center; gap: 10px;
            &:hover { background-color: rgba(157, 78, 221, 0.15); color: #fff; transform: translateX(5px); }
            &.danger { color: #ff6b6b; &:hover { background-color: rgba(255, 107, 107, 0.1); } }
        }
    }
`;

const Container = styled.div`
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background-color: #050509; 
  background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px); 
  background-size: 30px 30px;
  
  .chat-header {
    height: 80px; flex-shrink: 0; 
    background: rgba(11, 11, 20, 0.85); backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(157, 78, 221, 0.15); 
    display: flex; align-items: center; padding: 0 2rem; z-index: 10;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);

    .user-details {
      display: flex; align-items: center; gap: 1rem; width: 100%;
      .avatar img { height: 3rem; width: 3rem; border-radius: 50%; object-fit: cover; border: 2px solid #9d4edd; box-shadow: 0 0 10px rgba(157, 78, 221, 0.3); }
      
      .header-info {
         display: flex; flex-direction: column;
         h3 { color: #fff; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.5px; margin: 0; }
         
         /* ✅ STATUS TEXT (LAST SEEN) */
         .status-text {
             color: #888; font-size: 0.8rem; font-weight: 500; margin-top: 2px;
             .status-online { color: #10b981; font-weight: 600; }
         }
      }
    }

    .mobile-back-btn { 
        display: none; color: #9d4edd; font-size: 1.6rem; cursor: pointer; transition: 0.2s; margin-right: 1rem;
        &:hover{ color:#fff; } 
        @media screen and (max-width: 800px) { display: flex; } 
    }
  }

  .chat-messages {
    flex: 1; padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 0.8rem; overflow-y: auto;
    &::-webkit-scrollbar { width: 5px; } 
    &::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; &:hover{ background-color: #9d4edd; } }
    
    .message-wrapper { display: flex; flex-direction: column; }
    
    .message {
      display: flex; align-items: flex-end; margin-bottom: 4px; max-width: 100%;
      .avatar-mini { margin-right: 8px; img { height: 28px; width: 28px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); } }
      
      .message-bubble {
        position: relative; padding: 12px 18px; min-width: 80px; max-width: 650px;
        display: flex; flex-direction: column; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: 0.2s;
        @media screen and (max-width: 720px) { max-width: 85%; padding: 10px 14px; }

        .sender-name { font-size: 0.75rem; font-weight: 700; color: #d0a9f5; margin-bottom: 4px; text-shadow: 0 0 5px rgba(0,0,0,0.5); }

        /* Compact Glassy Reply Quote */
        .reply-quote {
            background: rgba(0,0,0,0.2); border-radius: 6px; padding: 4px 8px; margin-bottom: 6px;
            display: flex; gap: 8px; cursor: pointer; overflow: hidden; border-left: 3px solid #9d4edd;
            .reply-content { 
                display: flex; flex-direction: column; justify-content: center; overflow: hidden;
                .reply-sender { font-size: 0.7rem; color: #9d4edd; font-weight: 700; }
                .reply-text { font-size: 0.75rem; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
            }
            &:hover { background: rgba(0,0,0,0.3); }
        }

        /* Refined Floating Actions */
        .action-triggers {
            position: absolute; top: -35px; right: 0; display: flex; gap: 8px;
            opacity: 0; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            pointer-events: none; transform: translateY(10px);
            
            .trigger-btn {
                background: rgba(21, 21, 30, 0.8); backdrop-filter: blur(5px);
                padding: 6px; border-radius: 50%; cursor: pointer; color: #fff;
                font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
                display: flex; align-items: center; justify-content: center;
                transition: 0.2s;
                
                &.delete:hover { background: #ff6b6b; color: white; transform: scale(1.1); }
                &.reply:hover { background: #9d4edd; color: white; transform: scale(1.1); }
            }
        }
        &:hover .action-triggers { opacity: 1; top: -25px; transform: translateY(0); pointer-events: auto; }
        
        .content {
          font-size: 0.95rem; line-height: 1.5; word-wrap: break-word; margin-bottom: 2px;
          p { margin: 0; }
          p.deleted-message { font-style: italic; color: #aaa; font-size: 0.9rem; display: flex; align-items: center; gap: 5px; }
          img, video { max-width: 100%; border-radius: 12px; margin-top: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
          .file-link {
            display: flex; align-items: center; gap: 0.8rem; color: #e1e1e6; text-decoration: none;
            background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 10px; margin-top: 6px;
            border: 1px solid rgba(255,255,255,0.08); transition: 0.2s;
            &:hover { background: rgba(0,0,0,0.4); border-color: #9d4edd; }
          }
        }
        .meta-row {
           align-self: flex-end; display: flex; align-items: center; gap: 4px; margin-top: 2px;
           .timestamp { font-size: 0.65rem; color: rgba(255,255,255,0.5); }
           .read-receipt { display: flex; .read-icon { font-size: 1rem; color: rgba(255,255,255,0.4); &.seen { color: #00ffea; filter: drop-shadow(0 0 2px #00ffea); } } }
        }
      }

      &.sended {
        justify-content: flex-end;
        .message-bubble {
          background: linear-gradient(135deg, #7b2cbf 0%, #560bad 100%); 
          color: white; 
          border-radius: 18px 18px 4px 18px;
          border: 1px solid rgba(255,255,255,0.1);
        }
      }
      &.recieved {
        justify-content: flex-start;
        .message-bubble {
          background-color: #1f1f2e; 
          color: #e1e1e6; 
          border-radius: 18px 18px 18px 4px; 
          border: 1px solid rgba(255,255,255,0.05);
        }
      }
    }
    .typing-indicator {
      background: #1f1f2e; padding: 12px 20px; border-radius: 20px; align-self: flex-start; display: flex; 
      border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      .dots { display: flex; gap: 5px; span { width: 6px; height: 6px; background: #9d4edd; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; } }
    }
    @keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity:0.5; } 40% { transform: scale(1); opacity:1; } }
  }
`;