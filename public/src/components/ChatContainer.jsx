import React, { useState, useEffect, useRef } from "react";
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
import { BsCheck2All } from "react-icons/bs";
import { IoArrowBack } from "react-icons/io5";

export default function ChatContainer({
  currentChat,
  socket,
  currentUser,
  arrivalMessage,
  setArrivalMessage,
  onBackClick,
}) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [isTyping, setIsTyping] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatAvatar, setChatAvatar] = useState("");

  const [activeDeleteMenu, setActiveDeleteMenu] = useState(null);
  const [deletedForMe, setDeletedForMe] = useState(() => {
    const saved = localStorage.getItem("deletedForMe");
    return new Set(saved ? JSON.parse(saved) : []);
  });

  // Set chat header
  useEffect(() => {
    if (currentChat && currentUser) {
      if (currentChat.isGroupChat) {
        setChatName(currentChat.chatName);
        setChatAvatar(currentChat.users[0]?.avatarImage);
      } else {
        const otherUser = currentChat.users.find(
          (user) => user._id !== currentUser._id
        );
        if (otherUser) {
          setChatName(otherUser.username);
          setChatAvatar(otherUser.avatarImage);
        }
      }
    }
  }, [currentChat, currentUser]);

  // Fetch messages and mark as read
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
          }

          await axios.post(markAsReadRoute, {
            chatId: currentChat._id,
            userId: currentUser._id,
          });

          if (socket.current) {
            socket.current.emit("mark-read", {
              chatId: currentChat._id,
              chat: currentChat,
              userId: currentUser._id,
            });
          }
        } catch (err) {
          console.error("Failed to fetch or mark messages read:", err);
        }
      } else {
        setMessages([]);
      }
    }
    fetchMessages();
  }, [currentChat, currentUser, socket]);

  // Handle sending a new message
  const handleSendMsg = async (msg) => {
    if (!currentChat || !currentUser) return;
    try {
      const { data } = await axios.post(sendMessageRoute, {
        from: currentUser._id,
        chatId: currentChat._id,
        message: msg,
      });

      if (socket.current) {
        socket.current.emit("new-message", data);
      }

      const newMsg = {
        _id: data._id,
        fromSelf: true,
        message: data.message?.text ?? "",
        sender: data.sender,
        readBy: Array.isArray(data.readBy) ? data.readBy.map((u) => u._id) : [],
        createdAt: data.createdAt,
      };

      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Socket listeners
  useEffect(() => {
    const currentSocket = socket.current;

    if (currentSocket) {
      currentSocket.on("typing", () => setIsTyping(true));
      currentSocket.on("stop-typing", () => setIsTyping(false));

      currentSocket.on("message-deleted", (data) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId
              ? { ...msg, message: "[This message was deleted]" }
              : msg
          )
        );
      });

      currentSocket.on("messages-read", (data) => {
        if (data.chatId === currentChat?._id) {
          setMessages((prev) =>
            prev.map((msg) => {
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

  // ✅ FINAL FIX FOR SELF-SENT CRASH (Bulletproof Guard + Explicit State Definition)
useEffect(() => {
    if (!arrivalMessage || !currentChat || !currentUser) {
        setArrivalMessage(null);
        return;
    }
    const arrivingSenderId = String(arrivalMessage.sender?._id || '');
    const currentUserId = String(currentUser._id || '');
    if (arrivingSenderId === currentUserId) {
        setArrivalMessage(null);
        return;
    }
    const belongsToOpenChat = arrivalMessage.chat === currentChat._id || arrivalMessage.chat?._id === currentChat._id;
    if (belongsToOpenChat) {
        const formattedMsg = {
            _id: arrivalMessage._id || `temp-${Date.now()}`,
            sender: {
                _id: arrivalMessage.sender?._id || '',
                username: arrivalMessage.sender?.username || 'Unknown',
                avatarImage: arrivalMessage.sender?.avatarImage || '',
            },
            message: arrivalMessage.message || '',
            fromSelf: false,
            createdAt: arrivalMessage.createdAt || new Date().toISOString(),
            readBy: Array.isArray(arrivalMessage.readBy) ? arrivalMessage.readBy : [],
        };
        setMessages((prev) => {
            if (prev.some(msg => msg._id === formattedMsg._id)) {
                return prev;
            }
            return [...prev, formattedMsg];
        });
        axios.post(markAsReadRoute, {
            chatId: currentChat._id,
            userId: currentUser._id,
        }).catch((err) => console.error('Failed to mark as read:', err));
        if (socket.current) {
            socket.current.emit('mark-read', {
                chatId: currentChat._id,
                chat: currentChat,
                userId: currentUser._id,
            });
        }
    }
    setArrivalMessage(null);
}, [arrivalMessage, currentChat, currentUser, socket, setArrivalMessage]);


  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // --- Delete functions ---
  const handleDeleteForEveryone = async (messageId) => {
    setActiveDeleteMenu(null);
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId
          ? { ...msg, message: "[This message was deleted]" }
          : msg
      )
    );

    if (socket.current) {
      socket.current.emit("delete-message", {
        messageId: messageId,
        chatId: currentChat._id,
      });
    }

    try {
      await axios.post(deleteMessageRoute, { messageId });
    } catch (err) {
      console.error("Failed to delete message on server:", err);
    }
  };

  const handleDeleteForMe = (messageId) => {
    setActiveDeleteMenu(null);
    const newDeleted = new Set(deletedForMe);
    newDeleted.add(messageId);
    setDeletedForMe(newDeleted);
    localStorage.setItem("deletedForMe", JSON.stringify([...newDeleted]));
  };

  // --- Helper Render Functions ---
  const getSeenStatus = (message) => {
    if (!message.fromSelf || !currentChat || !currentUser) return null;
    const otherUserIds = currentChat.users
      .map((u) => u._id)
      .filter((id) => id !== currentUser._id);
    if (otherUserIds.length === 0) return null;
    const allHaveRead = otherUserIds.every((id) =>
      (message.readBy || []).includes(id)
    );
    if (allHaveRead) {
      return <BsCheck2All className="read-icon seen" />;
    }
    return <BsCheck2All className="read-icon" />;
  };

  const renderMessageContent = (message) => {
    if (message === "[This message was deleted]") {
      return <p className="deleted-message">{message}</p>;
    }
    const isCloudinaryUrl = message.startsWith("http://res.cloudinary.com") || message.startsWith("https://res.cloudinary.com");
    if (!isCloudinaryUrl) return <p>{message}</p>;
    const mediaRegex = /\.(jpg|jpeg|png|gif|mp4|mkv|webm)$/i;
    const imageRegex = /\.(jpg|jpeg|png|gif)$/i;
    if (mediaRegex.test(message)) {
      if (imageRegex.test(message)) {
        return <img src={message} alt="Sent file" />;
      } else {
        return <video src={message} controls />;
      }
    } else {
      const fileName = message.split("/").pop().substring(0, 20) + "...";
      return (
        <a href={message} target="_blank" rel="noopener noreferrer" className="file-link">
          <AiFillFileText /> {fileName}
        </a>
      );
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <>
      <Container>
        {/* 1. HEADER */}
        <div className="chat-header">
          <div className="user-details">
            <div className="mobile-back-btn" onClick={onBackClick}>
               <IoArrowBack />
            </div>
            <div className="avatar">
              <img src={`data:image/svg+xml;base64,${chatAvatar}`} alt="" />
            </div>
            <div className="header-info">
              <h3>{chatName}</h3>
            </div>
          </div>
        </div>

        {/* 2. MESSAGES LIST */}
        <div className="chat-messages">
          {messages
            .filter((msg) => !deletedForMe.has(msg._id))
            .map((message) => {
              return (
                <div ref={scrollRef} key={message._id} className="message-wrapper">
                  <div
                    className={`message ${
                      message.fromSelf ? "sended" : "recieved"
                    }`}
                  >
                    {/* ✅ DEFENSIVE GUARD 1: Check if sender object exists before rendering avatar */}
                    {currentChat.isGroupChat && !message.fromSelf && message.sender && (
                       <div className="avatar-mini">
                        <img
                          src={`data:image/svg+xml;base64,${message.sender.avatarImage}`}
                          alt="sender"
                        />
                      </div>
                    )}

                    <div className="message-bubble">
                      {/* ✅ DEFENSIVE GUARD 2: Check if sender object exists before rendering name */}
                      {currentChat.isGroupChat && !message.fromSelf && message.sender && (
                        <span className="sender-name">
                          {message.sender?.username}
                        </span>
                      )}

                      {/* Delete Icon */}
                      {message.message !== "[This message was deleted]" && (
                        <div className="delete-trigger" onClick={() => setActiveDeleteMenu(message._id)}>
                           <IoMdTrash />
                        </div>
                      )}

                      <div className="content">
                        {renderMessageContent(message.message)}
                      </div>
                      
                      <div className="meta-row">
                          <span className="timestamp">
                            {message.createdAt && formatTimestamp(message.createdAt)}
                          </span>
                          {message.fromSelf &&
                            message.message !== "[This message was deleted]" && (
                              <div className="read-receipt">
                                {getSeenStatus(message)}
                              </div>
                            )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
          {/* Typing Indicator */}
          {isTyping && (
            <div className="typing-indicator" ref={scrollRef}>
               <div className="dots">
                 <span></span><span></span><span></span>
               </div>
            </div>
          )}
        </div>

        {/* 3. INPUT */}
        <ChatInput
          handleSendMsg={handleSendMsg}
          socket={socket}
          currentChat={currentChat}
          currentUser={currentUser}
        />
      </Container>

      {/* DELETE MODAL */}
      {activeDeleteMenu && (
        <DeleteMenuOverlay onClick={() => setActiveDeleteMenu(null)}>
           <div className="delete-menu" onClick={(e) => e.stopPropagation()}>
             <div className="menu-header">
               <span>Message Options</span>
               <CgClose onClick={() => setActiveDeleteMenu(null)} />
             </div>
             <button onClick={() => handleDeleteForMe(activeDeleteMenu)}>
               Delete for me
             </button>
             {messages.find(m => m._id === activeDeleteMenu)?.fromSelf && (
               <button onClick={() => handleDeleteForEveryone(activeDeleteMenu)}>
                 Delete for everyone
               </button>
             )}
           </div>
        </DeleteMenuOverlay>
      )}
    </>
  );
}

/* --- STYLES: DEEP INDIGO & VIOLET --- */

const DeleteMenuOverlay = styled.div`
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    display: flex; justify-content: center; align-items: center;
    z-index: 3000; 

    .delete-menu {
        background-color: #15151e; 
        border: 1px solid rgba(157, 78, 221, 0.2);
        border-radius: 16px; 
        padding: 1.2rem;
        display: flex; flex-direction: column; gap: 0.6rem; 
        width: 280px; 
        box-shadow: 0 0 30px rgba(0,0,0,0.5);

        .menu-header {
            display: flex; justify-content: space-between; align-items: center; 
            color: #fff; font-size: 0.95rem; font-weight: 600; 
            padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.5rem;
            svg { cursor: pointer; color: #9d4edd; font-size: 1.2rem; }
        }
        button {
            background-color: transparent; border: none; color: #e1e1e6; text-align: left; padding: 0.8rem;
            cursor: pointer; border-radius: 8px; font-weight: 500; font-size: 0.95rem; transition: 0.2s;
            &:hover { background-color: rgba(157, 78, 221, 0.15); color: #fff; }
            &:last-child { color: #ff6b6b; &:hover { background-color: rgba(255, 107, 107, 0.1); } }
        }
    }
`;

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #050509; /* Deepest Black */
  
  /* Optional: Subtle grain/pattern to reduce banding */
  background-image: radial-gradient(#111 1px, transparent 1px);
  background-size: 40px 40px;
  
  .chat-header {
    height: 80px;
    flex-shrink: 0;
    /* ✅ Glassmorphism Header */
    background: rgba(11, 11, 20, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(157, 78, 221, 0.1);
    display: flex;
    align-items: center;
    padding: 0 2rem;
    z-index: 10;
    
    .user-details {
      display: flex; align-items: center; gap: 1rem; width: 100%;
      .mobile-back-btn {
        display: none; color: #9d4edd; font-size: 1.6rem; cursor: pointer;
        @media screen and (max-width: 800px) { display: flex; }
      }
      .avatar { 
        img { 
            height: 3rem; width: 3rem; 
            border-radius: 50%; 
            object-fit: cover; 
            border: 2px solid rgba(157, 78, 221, 0.3); 
        } 
      }
      .header-info { 
        display: flex; flex-direction: column;
        h3 { color: #fff; font-size: 1.1rem; font-weight: 600; letter-spacing: 0.3px; }
      }
    }
  }

  .chat-messages {
    flex: 1;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    
    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-thumb { background-color: #222; border-radius: 10px; }
    
    .message-wrapper {
      display: flex; flex-direction: column;
    }

    .message {
      display: flex; align-items: flex-end; margin-bottom: 2px; max-width: 100%;
      
      .avatar-mini {
        margin-right: 8px;
        img { height: 28px; width: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #333; }
      }
      
      .message-bubble {
        position: relative; 
        padding: 10px 16px; 
        min-width: 80px; 
        max-width: 650px;
        border-radius: 18px;
        display: flex; flex-direction: column;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        
        @media screen and (max-width: 720px) { max-width: 85%; }

        .sender-name {
          font-size: 0.75rem; font-weight: 700; color: #9d4edd; margin-bottom: 4px;
        }

        /* Hover Trash Icon */
        .delete-trigger {
            position: absolute; top: -25px; right: 0; 
            background: #15151e; padding: 5px; border-radius: 6px;
            color: #9d4edd; font-size: 1rem; cursor: pointer;
            opacity: 0; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        &:hover .delete-trigger { opacity: 1; top: -15px; }
        
        .content {
          font-size: 0.95rem; line-height: 1.5; color: #e1e1e6; word-wrap: break-word; margin-bottom: 4px;
          p { margin: 0; }
          p.deleted-message { font-style: italic; color: #999; font-size: 0.9rem; }
          img, video { max-width: 100%; border-radius: 12px; margin-top: 6px; }
          .file-link {
            display: flex; align-items: center; gap: 0.5rem; color: #fff; text-decoration: none;
            background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; margin-top: 6px;
            border: 1px solid rgba(255,255,255,0.1);
          }
        }

        .meta-row {
           align-self: flex-end; display: flex; align-items: center; gap: 5px;
           .timestamp { font-size: 0.65rem; color: rgba(255,255,255,0.6); }
           .read-receipt {
             display: flex; 
             .read-icon { 
                 font-size: 1rem; color: rgba(255,255,255,0.5); 
                 &.seen { color: #00ffea; /* Cyan for Read */ } 
             }
           }
        }
      }

      /* --- SENT MESSAGES: Electric Violet Gradient --- */
      &.sended {
        justify-content: flex-end;
        .message-bubble {
          background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%);
          color: white;
          border-bottom-right-radius: 4px; /* Subtle tail */
          
          .content { color: #fff; }
        }
      }

      /* --- RECEIVED MESSAGES: Dark Slate --- */
      &.recieved {
        justify-content: flex-start;
        .message-bubble {
          background-color: #1f1f2e; /* Dark Gray/Navy */
          color: #e1e1e6;
          border-bottom-left-radius: 4px; /* Subtle tail */
          border: 1px solid rgba(255,255,255,0.05);
        }
      }
    }
    
    /* Typing Animation */
    .typing-indicator {
      background: #1f1f2e; padding: 12px 20px; border-radius: 20px; align-self: flex-start;
      display: flex; border: 1px solid rgba(255,255,255,0.05);
      .dots {
          display: flex; gap: 4px;
          span {
            width: 6px; height: 6px; background: #9d4edd; border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
          }
          span:nth-child(1) { animation-delay: -0.32s; }
          span:nth-child(2) { animation-delay: -0.16s; }
      }
    }
    @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
  }
`;