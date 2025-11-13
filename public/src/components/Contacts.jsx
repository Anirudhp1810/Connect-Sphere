import React, { useState, useEffect, useMemo, useCallback } from "react";
import styled from "styled-components";
import Logo from "../assets/logo.png";
import { BsPlusLg, BsTrash3, BsSearch } from "react-icons/bs";
import { deleteChatRoute } from "../utils/APIRoutes";
import axios from "axios";
import Logout from "./Logout";

export default function Contacts({
  chats,
  changeChat,
  currentUser,
  setShowGroupModal,
  setShowSearchModal,
  setChats,
  setCurrentChat,
  notifications = {}, 
  clearNotification, 
  onlineUsers = [], // This comes from Chat.jsx via Socket
}) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentUserImage, setCurrentUserImage] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [localNotifications, setLocalNotifications] = useState({});

  useEffect(() => {
    if (currentUser) {
      setCurrentUserName(currentUser.username);
      setCurrentUserImage(currentUser.avatarImage);
    }
  }, [currentUser]);

  useEffect(() => {
    setLocalNotifications((prev) => {
      const merged = { ...notifications };
      Object.keys(prev).forEach((k) => {
        if (!merged[k]) merged[k] = prev[k];
      });
      return merged;
    });
  }, [notifications]);

  const getChatName = useCallback(
    (chat) => {
      if (!currentUser) return chat.isGroupChat ? chat.chatName || "Group" : "Loading...";
      if (chat.isGroupChat) return chat.chatName || "Group";
      const otherUser = chat.users?.find((user) => user._id !== currentUser._id);
      return otherUser ? otherUser.username : "Unknown User";
    },
    [currentUser]
  );

  const getChatAvatar = (chat) => {
    if (!chat) return "";
    if (chat.isGroupChat) {
      const fallback = chat.users?.find(Boolean);
      return fallback?.avatarImage || "";
    }
    const otherUser = chat.users?.find((user) => user._id !== currentUser?._id);
    return otherUser ? otherUser.avatarImage : "";
  };

  const openDeleteModal = (chat) => {
    setChatToDelete(chat);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return;
    try {
      await axios.post(deleteChatRoute, {
        chatId: chatToDelete._id,
      });
      setChats((prev) => prev.filter((c) => c._id !== chatToDelete._id));
      setChatToDelete(null);
      setShowDeleteModal(false);
      setCurrentChat(undefined);
    } catch (error) {
      console.error("Error deleting chat", error);
      setChatToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const sortedChats = useMemo(() => {
    const chatsWithDetails = chats.map((chat) => {
      const unread = localNotifications[chat._id] || 0;
      return {
        ...chat,
        unreadCount: unread,
        sortPriority: unread > 0 ? -1 : 0,
      };
    });

    chatsWithDetails.sort((a, b) => {
      if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
      return getChatName(a).localeCompare(getChatName(b));
    });

    return chatsWithDetails;
  }, [chats, localNotifications, getChatName]);

  const changeCurrentChat = (index, chat) => {
    setCurrentSelected(index);
    changeChat(chat);
    setLocalNotifications((prev) => {
      if (!prev || !prev[chat._id]) return prev;
      return { ...prev, [chat._id]: 0 };
    });
    if (typeof clearNotification === "function") {
      try {
        clearNotification(chat._id);
      } catch (err) {
        console.error("clearNotification callback error:", err);
      }
    }
  };

  // Navigate to Welcome Page logic
  const handleLogoClick = () => {
    setCurrentSelected(undefined);
    setCurrentChat(undefined);
  };

  useEffect(() => {
    if (currentSelected === undefined) return;
    const currentChatId = sortedChats[currentSelected]?._id ?? null;
    if (!currentChatId) {
      setCurrentSelected(undefined);
      return;
    }
    const newIndex = sortedChats.findIndex((chat) => chat._id === currentChatId);
    if (newIndex !== -1 && newIndex !== currentSelected) {
      setCurrentSelected(newIndex);
    }
  }, [sortedChats, currentSelected]);

  // Inside Contacts.jsx ...
// ✅ ROBUST ONLINE STATUS CHECKER
  const isUserOnline = (chat) => {
    if (chat.isGroupChat) return false;
    
    const otherUser = chat.users?.find((u) => u._id !== currentUser?._id);
    if (!otherUser) return false;

    // Force String comparison to handle ObjectId vs String issues
    return onlineUsers.some(id => String(id) === String(otherUser._id));
  };
// ... rest of the file

  return (
    <>
      {currentUserImage && currentUserName && (
        <Container>
          {/* HEADER */}
          <div className="header-section">
            <div className="brand" onClick={handleLogoClick}>
              <img src={Logo} alt="logo" />
              <h3>Connect Sphere</h3>
            </div>
            
            <div className="action-toolbar">
              <button className="icon-btn" onClick={() => setShowSearchModal(true)} title="Search">
                <BsSearch />
              </button>
              <button className="icon-btn" onClick={() => setShowGroupModal(true)} title="New Group">
                <BsPlusLg />
              </button>
            </div>
          </div>

          {/* CONTACTS LIST */}
          <div className="contacts-list" role="list">
            {sortedChats.map((chat, index) => {
              const canDelete = !chat.isGroupChat || (chat.groupAdmin && chat.groupAdmin._id === currentUser._id);
              const unreadCount = chat.unreadCount || 0;
              
              // Check status
              const online = isUserOnline(chat);

              return (
                <div
                  key={chat._id}
                  className={`contact-card ${index === currentSelected ? "selected" : ""}`}
                  onClick={() => changeCurrentChat(index, chat)}
                >
                  <div className="accent-strip"></div>

                  <div className="avatar-wrapper">
                    <img src={`data:image/svg+xml;base64,${getChatAvatar(chat)}`} alt="avatar" />
                    
                    {/* Only render this dot if user is truly online */}
                    {online && <div className="online-status-dot"></div>}
                  </div>
                  
                  <div className="info-wrapper">
                    <div className="top-row">
                       <h3 className="username">{getChatName(chat)}</h3>
                       {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                    </div>
                    
                    <div className="bottom-row">
                       <span className="status-text">
                         {chat.isGroupChat ? "Group Chat" : (online ? "Online" : "Offline")}
                       </span>
                       {canDelete && (
                         <button className="delete-icon" onClick={(e) => { e.stopPropagation(); openDeleteModal(chat); }}>
                           <BsTrash3 />
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER */}
          <div className="user-footer">
            <div className="current-user-info">
              <div className="avatar">
                <img src={`data:image/svg+xml;base64,${currentUserImage}`} alt="avatar" />
              </div>
              <div className="text-details">
                <h2>{currentUserName}</h2>
                <span>Active Now</span>
              </div>
            </div>
            <div className="logout-container">
              <Logout />
            </div>
          </div>
        </Container>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && chatToDelete && (
        <ConfirmationOverlay>
          <div className="modal-card">
            <h4>Delete Chat?</h4>
            <p>
              This will remove the chat with <strong>{chatToDelete.isGroupChat ? chatToDelete.chatName : getChatName(chatToDelete)}</strong>.
            </p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => { setShowDeleteModal(false); setChatToDelete(null); }}>Cancel</button>
              <button className="confirm-btn" onClick={handleConfirmDelete}>Delete</button>
            </div>
          </div>
        </ConfirmationOverlay>
      )}
    </>
  );
}

/* ---------------- Styled Components ---------------- */

const ConfirmationOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;

  .modal-card {
    background-color: #12121a;
    padding: 2rem;
    border-radius: 16px;
    width: 90%;
    max-width: 380px;
    border: 1px solid rgba(157, 78, 221, 0.2);
    box-shadow: 0 0 40px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; gap: 1.5rem;

    h4 { color: #fff; font-size: 1.3rem; margin: 0; font-weight: 700; }
    p { color: #aebac1; font-size: 0.95rem; line-height: 1.6; margin: 0; strong { color: #9d4edd; } }

    .modal-actions {
      display: flex; gap: 1rem; justify-content: flex-end;
      button {
        padding: 0.8rem 1.6rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: 0.2s;
        &.cancel-btn { background: transparent; border: 1px solid #333; color: #fff; &:hover { background: #222; } }
        &.confirm-btn { background: #ef4444; color: white; &:hover { background: #dc2626; box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); } }
      }
    }
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #0b0b14; /* Deep Navy/Black */
  overflow: hidden;
  font-family: 'Inter', sans-serif;

  .header-section {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    height: 80px;
    border-bottom: 1px solid rgba(157, 78, 221, 0.1);
    background: #0b0b14;
    
    /* ✅ GAP ADDED HERE as requested */
    gap: 1rem; 

    .brand {
      display: flex; align-items: center; gap: 0.8rem;
      cursor: pointer;
      transition: transform 0.2s ease;

      img { 
        height: 2.2rem; /* Slightly adjusted */
        /* ✅ CSS FIX FOR BLACK BACKGROUND: */
        border-radius: 50%; 
        mix-blend-mode: screen; 
      }

      h3 { color: #fff; font-size: 1.2rem; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
    }

    .action-toolbar {
      display: flex; gap: 0.8rem;
      
      .icon-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        width: 40px; height: 40px;
        border-radius: 10px;
        color: #aebac1;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        transition: all 0.2s ease-in-out;
        
        &:hover {
          background: rgba(157, 78, 221, 0.15);
          border-color: #9d4edd;
          color: #9d4edd; /* Electric Violet */
          transform: translateY(-1px);
        }
      }
    }
  }

  .contacts-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    &::-webkit-scrollbar { width: 5px; }
    &::-webkit-scrollbar-thumb { background-color: #222; border-radius: 10px; }

    .contact-card {
      position: relative;
      background-color: transparent;
      min-height: 76px;
      width: 100%;
      border-radius: 12px;
      padding: 0.8rem 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: background 0.2s ease;
      overflow: hidden;

      &:hover {
        background-color: rgba(255, 255, 255, 0.02);
      }

      &.selected {
        background: linear-gradient(90deg, rgba(157, 78, 221, 0.15) 0%, transparent 100%);
        .accent-strip {
            position: absolute; left: 0; top: 15%; bottom: 15%; width: 4px;
            background-color: #9d4edd;
            border-radius: 0 4px 4px 0;
            box-shadow: 0 0 8px #9d4edd;
        }
      }

      .avatar-wrapper {
        position: relative;
        flex-shrink: 0;
        img { 
            height: 3.2rem; width: 3.2rem; 
            border-radius: 50%; 
            object-fit: cover; 
            background: #1a1a20;
        }
        /* ✅ ONLINE DOT STYLING */
        .online-status-dot {
          position: absolute; 
          bottom: 2px; 
          right: 0; 
          width: 12px; 
          height: 12px;
          background-color: #10b981; /* Bright Green */
          border-radius: 50%; 
          border: 2px solid #0b0b14;
          box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
        }
      }

      .info-wrapper {
        flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 5px; overflow: hidden;
        
        .top-row {
          display: flex; justify-content: space-between; align-items: center;
          .username { 
              color: #e1e1e6; 
              font-size: 1rem; 
              font-weight: 600; 
              margin: 0; 
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
          }
          .unread-badge {
            background-color: #9d4edd; color: #fff; 
            font-size: 0.7rem; font-weight: 700;
            min-width: 22px; height: 22px; 
            border-radius: 50%; 
            display: flex; align-items: center; justify-content: center;
          }
        }

        .bottom-row {
          display: flex; justify-content: space-between; align-items: center;
          .status-text { 
              color: #8b9bb4; 
              font-size: 0.85rem; 
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
              font-weight: 400;
          }
          .delete-icon {
            background: transparent; border: none; color: #555; cursor: pointer; 
            opacity: 0; transition: 0.2s; font-size: 1rem; padding: 4px;
            &:hover { color: #ef4444; }
          }
        }
      }

      &:hover .delete-icon { opacity: 1; }
    }
  }

  .user-footer {
    flex-shrink: 0;
    background-color: #08080c;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    height: 80px;

    .current-user-info {
      display: flex; align-items: center; gap: 1rem;
      .avatar img { 
          height: 3rem; width: 3rem; 
          border-radius: 50%; 
          object-fit: cover; 
          border: 2px solid rgba(157, 78, 221, 0.3); 
      }
      .text-details {
        display: flex; flex-direction: column;
        h2 { color: #fff; font-size: 1rem; margin: 0; font-weight: 600; }
        span { color: #9d4edd; font-size: 0.75rem; letter-spacing: 0.5px; font-weight: 700; }
      }
    }
  }
`;