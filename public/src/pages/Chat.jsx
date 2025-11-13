import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled from "styled-components";
import { host, fetchChatsRoute, verifyUserRoute } from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import GroupChatModal from "../components/GroupChatModal";
import SearchModal from "../components/SearchModal";
import { FiMenu } from "react-icons/fi";
import { IoClose } from "react-icons/io5";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [notifications, setNotifications] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [showContactsOverlay, setShowContactsOverlay] = useState(false);

  const currentChatRef = useRef(undefined);
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 800);
      if (window.innerWidth > 800) setShowContactsOverlay(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    async function checkUser() {
      const storageKey = process.env.REACT_APP_LOCALHOST_KEY;
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        navigate("/login");
        return;
      }
      try {
        const userData = JSON.parse(stored);
        const { data } = await axios.post(verifyUserRoute, { userId: userData._id });
        if (data.status === false) {
          localStorage.clear();
          navigate("/login");
        } else {
          setCurrentUser(data.user);
          setIsLoaded(true);
        }
      } catch (error) {
        localStorage.clear();
        navigate("/login");
      }
    }
    checkUser();
  }, [navigate]);

  useEffect(() => {
    async function getChats() {
      if (currentUser) {
        if (!currentUser.isAvatarImageSet) {
          navigate("/setAvatar");
          return;
        }
        try {
          const { data } = await axios.get(`${fetchChatsRoute}/${currentUser._id}`);
          setChats(data);

          const initialNotifications = {};
          data.forEach((chat) => {
            if (chat.unreadCounts && chat.unreadCounts[currentUser._id]) {
              initialNotifications[chat._id] = chat.unreadCounts[currentUser._id];
            }
          });
          setNotifications(initialNotifications);
        } catch (err) {
          console.error("Failed to fetch chats:", err);
        }
      }
    }
    getChats();
  }, [currentUser, navigate]);

  const clearNotification = useCallback((chatId) => {
    setNotifications((prev) => ({ ...prev, [chatId]: 0 }));
    if (socket.current) {
      socket.current.emit("mark-read", { chatId, userId: currentUser?._id });
    }
  }, [currentUser]);

  // 🔴 FINAL FIX LOCATION: Stabilizing state update during self-sent messages
  const handleMessageReceived = useCallback((newMessage) => {
    
    const isMessageFromSelf = String(newMessage.sender?._id) === String(currentUser?._id);

    // Safety Check: We must have a message and a chat ID to proceed
    if (!newMessage || !newMessage.chat || !newMessage.chat._id) {
        console.error("Received message without chat ID. Ignoring.");
        return; 
    }

    // --- CRITICAL FIX: Block setArrivalMessage if from self ---
    if (isMessageFromSelf) {
        // Only proceed to setChats logic
    } 
    // --- CRITICAL FIX: Block notifications if from self ---
    else {
      // 1. Identify if the chat is currently open
      const isForOpenChat = currentChatRef.current && newMessage.chat && currentChatRef.current._id === newMessage.chat._id;

      if (isForOpenChat) {
        setArrivalMessage({ ...newMessage, fromSelf: false });
      } else {
        // Increment notifications (only runs if chat is NOT open AND NOT from self)
        setNotifications((prev) => ({
          ...prev,
          [newMessage.chat._id]: (prev[newMessage.chat._id] || 0) + 1,
        }));
      }
    }

    // 3. Update the sidebar chats list (MUST RUN FOR ALL MESSAGES)
    setChats((prevChats) => {
      
      // ✅ ANTI-CORRUPTION: Reconstruct the latestMessage object defensively
      // This is the source of the persistent crash—a malformed object in the list update.
      const updatedLatestMessage = {
          _id: newMessage._id,
          // Ensure structure always matches what Contacts.jsx rendering expects
          message: newMessage.message || { text: "" }, 
          sender: newMessage.sender || currentUser, // Fallback to current user if sender details are missing
          createdAt: newMessage.createdAt || new Date().toISOString(),
      };
      
      const existingIndex = prevChats.findIndex((c) => c._id === newMessage.chat._id);
      
      if (existingIndex !== -1) {
        const updatedChat = { ...prevChats[existingIndex], latestMessage: updatedLatestMessage };
        const others = prevChats.filter((_, i) => i !== existingIndex);
        return [updatedChat, ...others];
      } else {
        // Fallback for new chat creation (safe consistency)
        const newChatItem = {
          _id: newMessage.chat._id,
          users: newMessage.chat.users || [],
          isGroupChat: newMessage.chat.isGroupChat || false,
          chatName: newMessage.chat.chatName || "",
          latestMessage: updatedLatestMessage,
        };
        return [newChatItem, ...prevChats];
      }
    });
  }, [currentUser]);

  // ✅ SOCKET SETUP (WITH RECONNECTION FIX)
  useEffect(() => {
    if (!currentUser) return;

    socket.current = io(host);

    socket.current.on("connect", () => {
      socket.current.emit("setup", currentUser);
    });

    socket.current.on("get-online-users", (users) => {
      setOnlineUsers(users);
    });

    socket.current.on("user-online", (userId) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(userId)) return [...prev, userId];
        return prev;
      });
    });

    socket.current.on("user-offline", (userId) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    socket.current.on("message-received", handleMessageReceived);
    socket.current.on("added-to-group", (newChat) => setChats((prev) => [newChat, ...prev]));

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, [currentUser, handleMessageReceived]);

  const handleChatChange = (chat) => {
    setCurrentChat(chat);
    setNotifications((prev) => ({ ...prev, [chat._id]: 0 }));
    if (socket.current) {
      socket.current.emit("mark-read", { chatId: chat._id, userId: currentUser?._id });
    }
    if (isMobile) setShowContactsOverlay(false);
  };

  if (!isLoaded || !currentUser) return <div />;

  return (
    <>
      <Container>
        {isMobile && !currentChat && (
          <MobileTopBar>
            <button className="menu-btn" onClick={() => setShowContactsOverlay((s) => !s)}>
              {showContactsOverlay ? <IoClose /> : <FiMenu />}
            </button>
            <div className="mobile-title">Connect Sphere</div>
          </MobileTopBar>
        )}

        <div className="container">
          <div className={`sidebar ${isMobile && currentChat ? "hidden" : ""}`}>
            <Contacts
              chats={chats}
              changeChat={handleChatChange}
              currentUser={currentUser}
              setShowGroupModal={setShowGroupModal}
              setChats={setChats}
              setCurrentChat={setCurrentChat}
              setShowSearchModal={setShowSearchModal}
              notifications={notifications}
              clearNotification={clearNotification}
              onlineUsers={onlineUsers} 
            />
          </div>

          <div className={`main-area ${isMobile && !currentChat ? "hidden" : ""}`}>
            {currentChat ? (
              <ChatContainer
                currentChat={currentChat}
                currentUser={currentUser}
                socket={socket}
                arrivalMessage={arrivalMessage}
                setArrivalMessage={setArrivalMessage}
                onBackClick={() => setCurrentChat(undefined)} 
              />
            ) : (
              <Welcome currentUser={currentUser} />
            )}
          </div>
        </div>

        {isMobile && showContactsOverlay && !currentChat && (
          <MobileOverlay>
            <Contacts
              chats={chats}
              changeChat={handleChatChange}
              currentUser={currentUser}
              setShowGroupModal={setShowGroupModal}
              setChats={setChats}
              setCurrentChat={setCurrentChat}
              setShowSearchModal={setShowSearchModal}
              notifications={notifications}
              clearNotification={clearNotification}
              onlineUsers={onlineUsers}
            />
          </MobileOverlay>
        )}
      </Container>

      <GroupChatModal
        showModal={showGroupModal}
        setShowModal={setShowGroupModal}
        currentUser={currentUser}
        chats={chats}
        setChats={setChats}
        socket={socket}
      />
      <SearchModal
        showModal={showSearchModal}
        setShowModal={setShowSearchModal}
        currentUser={currentUser}
        chats={chats}
        setChats={setChats}
        setCurrentChat={setCurrentChat}
      />
    </>
  );
}

// --- STYLES ---
const Container = styled.div`
  font-family: 'Inter', 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: 0.3px;
  line-height: 1.5;
  height: 100vh;
  height: 100dvh; 
  width: 100vw;
  background-color: #050509;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .container {
    flex: 1;
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: 350px 1fr;
    background-color: #050509;
    position: relative;
  }

  .sidebar {
    height: 100%;
    overflow: hidden;
    border-right: 1px solid rgba(157, 78, 221, 0.15);
    background-color: #0b0b14; 
    z-index: 10;
  }

  .main-area {
    height: 100%;
    overflow: hidden;
    background-color: #050509;
    position: relative;
  }

  .hidden { display: none !important; }

  @media screen and (max-width: 800px) {
    .container { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .sidebar { width: 100%; border-right: none; }
    .main-area { width: 100%; }
  }
`;

const MobileTopBar = styled.div`
  display: none;
  @media screen and (max-width: 800px) {
    display: flex; flex-shrink: 0; height: 65px; align-items: center; padding: 0 1.2rem;
    background: rgba(11, 11, 20, 0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(157, 78, 221, 0.2); z-index: 999;

    .menu-btn {
      background: transparent; border: none; color: #e0e0ff; font-size: 1.6rem;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      margin-right: 1rem; transition: color 0.2s ease;
      &:active { color: #9d4edd; }
    }

    .mobile-title {
      color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 1rem;
      background: linear-gradient(90deg, #ffffff, #a0a0ff);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
  }
`;

const MobileOverlay = styled.div`
  position: fixed; top: 65px; left: 0; right: 0; bottom: 0; z-index: 1000;
  background-color: #0b0b14; overflow: hidden;
  animation: slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  @keyframes slideIn {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;