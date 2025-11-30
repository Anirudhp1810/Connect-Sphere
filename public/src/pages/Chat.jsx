import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled from "styled-components";
import { host, fetchChatsRoute, verifyUserRoute, deleteChatRoute } from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import GroupChatModal from "../components/GroupChatModal";
import SearchModal from "../components/SearchModal";
import SettingsModal from "../components/SettingsModal";
import { BsExclamationTriangle } from "react-icons/bs";

// ErrorBoundary to catch runtime errors
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
    render() {
        if (this.state.hasError) return <div>Chat error: {this.state.error?.message}. Please reload.</div>;
        return this.props.children;
    }
}

export default function Chat() {
    const navigate = useNavigate();
    const socket = useRef();

    // Data State
    const [chats, setChats] = useState([]);
    const [currentChat, setCurrentChat] = useState(undefined);
    const [currentUser, setCurrentUser] = useState(undefined);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // UI State
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Modal States
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Delete Modal State (Lifted here for full-screen blur)
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);

    // Messaging State
    const [arrivalMessage, setArrivalMessage] = useState(null);
    const [notifications, setNotifications] = useState({});

    const currentChatRef = useRef(undefined);
    useEffect(() => { currentChatRef.current = currentChat; }, [currentChat]);

    // Check Mobile View
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 800);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Verify User
    useEffect(() => {
        async function checkUser() {
            const storageKey = process.env.REACT_APP_LOCALHOST_KEY;
            const stored = localStorage.getItem(storageKey);
            if (!stored) { navigate("/login"); return; }
            try {
                const userData = JSON.parse(stored);
                const { data } = await axios.post(verifyUserRoute, { userId: userData._id });
                if (data.status === false) { localStorage.clear(); navigate("/login"); }
                else { setCurrentUser(data.user); setIsLoaded(true); }
            } catch (error) { localStorage.clear(); navigate("/login"); }
        }
        checkUser();
    }, [navigate]);

    // Fetch Chats
    const getChats = useCallback(async () => {
        if (currentUser) {
            if (!currentUser.isAvatarImageSet) { navigate("/setAvatar"); return; }
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
            } catch (err) { console.error("Failed to fetch chats:", err); }
        }
    }, [currentUser, navigate]);

    useEffect(() => { getChats(); }, [getChats]);

    const clearNotification = useCallback((chatId) => {
        setNotifications((prev) => ({ ...prev, [chatId]: 0 }));
        if (socket.current) socket.current.emit("mark-read", { chatId, userId: currentUser?._id });
    }, [currentUser]);

    // Handle Real-time Messages
    const handleMessageReceived = useCallback((newMessage) => {
        const isMessageFromSelf = String(newMessage.sender?._id) === String(currentUser?._id);
        if (isMessageFromSelf) return;

        getChats(); // Refresh list order

        const currentChatId = currentChatRef.current?._id;
        const messageChatId = newMessage.chat?._id || newMessage.chat;

        // Robust String Comparison
        const isForOpenChat = currentChatId && messageChatId && String(currentChatId) === String(messageChatId);

        if (isForOpenChat) {
            setArrivalMessage({
                _id: newMessage._id,
                sender: newMessage.sender,
                message: newMessage.message || '',
                createdAt: newMessage.createdAt || new Date().toISOString(),
                updatedAt: newMessage.updatedAt || new Date().toISOString(),
                fromSelf: false,
                readBy: Array.isArray(newMessage.readBy) ? newMessage.readBy : [],
                chat: messageChatId,
                replyTo: newMessage.replyTo
            });
        } else {
            setNotifications((prev) => ({ ...prev, [messageChatId]: (prev[messageChatId] || 0) + 1, }));
        }
    }, [currentUser, getChats]);

    // Socket Connection
    useEffect(() => {
        if (!currentUser) return;
        socket.current = io(host);

        socket.current.on("connect", () => { socket.current.emit("add-user", currentUser._id); });

        socket.current.on("online-users", (users) => { setOnlineUsers(users); });
        socket.current.on("user-online", (userId) => {
            setOnlineUsers((prev) => { if (Array.isArray(prev) && !prev.includes(userId)) return [...prev, userId]; return prev; });
        });
        socket.current.on("user-offline", (userId) => {
            setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((id) => id !== userId) : []));
        });

        // Listen for Settings updates (to refresh last seen/privacy)
        socket.current.on("user-settings-updated", () => { getChats(); });

        socket.current.on("msg-recieve", handleMessageReceived);
        socket.current.on("new-message", handleMessageReceived);
        socket.current.on("added-to-group", () => getChats());

        // ✅ FIX: Listen for Real-Time Last Seen Updates
        socket.current.on("user-lastseen-updated", ({ userId, lastSeenTime, showLastSeen }) => {
            // 1. Update Chats List
            setChats((prevChats) =>
                prevChats.map((chat) => {
                    if (chat.isGroupChat) return chat;
                    const updatedUsers = chat.users.map((user) => {
                        if (user._id === userId) {
                            return { ...user, lastSeenTime, showLastSeen };
                        }
                        return user;
                    });
                    return { ...chat, users: updatedUsers };
                })
            );

            // 2. Update Current Chat (if open)
            if (currentChatRef.current && !currentChatRef.current.isGroupChat) {
                const isChatWithUser = currentChatRef.current.users.some(u => u._id === userId);
                if (isChatWithUser) {
                    setCurrentChat((prevChat) => {
                        if (!prevChat) return prevChat;
                        const updatedUsers = prevChat.users.map((user) => {
                            if (user._id === userId) {
                                return { ...user, lastSeenTime, showLastSeen };
                            }
                            return user;
                        });
                        return { ...prevChat, users: updatedUsers };
                    });
                }
            }
        });

        return () => { if (socket.current) socket.current.disconnect(); };
    }, [currentUser, handleMessageReceived, getChats]);

    const handleChatChange = (chat) => {
        setCurrentChat(chat);
        setNotifications((prev) => ({ ...prev, [chat._id]: 0 }));
        if (socket.current) socket.current.emit("mark-read", { chatId: chat._id, userId: currentUser?._id });
    };

    // --- DELETE LOGIC ---
    const triggerDeleteModal = (chat) => {
        setChatToDelete(chat);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!chatToDelete) return;
        try {
            await axios.post(deleteChatRoute, { chatId: chatToDelete._id });
            setChats((prev) => prev.filter((c) => c._id !== chatToDelete._id));
            if (currentChat?._id === chatToDelete._id) {
                setCurrentChat(undefined);
            }
            setChatToDelete(null);
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting chat", error);
        }
    };

    if (!isLoaded || !currentUser) return <div />;

    return (
        <>
            <Container>
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
                            setShowSettingsModal={setShowSettingsModal}
                            triggerDeleteModal={triggerDeleteModal} // ✅ Pass Trigger
                            notifications={notifications}
                            clearNotification={clearNotification}
                            onlineUsers={onlineUsers}
                        />
                    </div>

                    <div className={`main-area ${isMobile && !currentChat ? "hidden" : ""}`}>
                        {currentChat ? (
                            <ErrorBoundary>
                                <ChatContainer
                                    currentChat={currentChat}
                                    currentUser={currentUser}
                                    socket={socket}
                                    arrivalMessage={arrivalMessage}
                                    setArrivalMessage={setArrivalMessage}
                                    onBackClick={() => setCurrentChat(undefined)}
                                    onlineUsers={onlineUsers} // ✅ Pass Online Users
                                />
                            </ErrorBoundary>
                        ) : (
                            <Welcome currentUser={currentUser} />
                        )}
                    </div>
                </div>
            </Container>

            {/* --- GLOBAL MODALS --- */}
            <SettingsModal showModal={showSettingsModal} setShowModal={setShowSettingsModal} currentUser={currentUser} setCurrentUser={setCurrentUser} socket={socket} />
            <GroupChatModal showModal={showGroupModal} setShowModal={setShowGroupModal} currentUser={currentUser} chats={chats} setChats={setChats} socket={socket} />
            <SearchModal showModal={showSearchModal} setShowModal={setShowSearchModal} currentUser={currentUser} chats={chats} setChats={setChats} setCurrentChat={setCurrentChat} />

            {/* --- FULL SCREEN DELETE CONFIRMATION --- */}
            {showDeleteModal && chatToDelete && (
                <ConfirmationOverlay>
                    <div className="modal-card">
                        <div className="warning-icon"><BsExclamationTriangle /></div>
                        <h4>Delete Conversation?</h4>
                        <p>
                            Are you sure you want to delete the chat with <br />
                            <span className="highlight">
                                {chatToDelete.isGroupChat
                                    ? chatToDelete.chatName
                                    : (chatToDelete.users.find(u => u._id !== currentUser._id)?.username || "User")
                                }
                            </span>?
                            <br />This action cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => { setShowDeleteModal(false); setChatToDelete(null); }}>Cancel</button>
                            <button className="confirm-btn" onClick={handleConfirmDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </ConfirmationOverlay>
            )}
        </>
    );
}

// --- STYLES ---

// ✅ Global Overlay Style
const ConfirmationOverlay = styled.div`
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); 
  backdrop-filter: blur(8px); /* Full Blur */
  display: flex; justify-content: center; align-items: center; z-index: 9999;
  
  .modal-card {
    background-color: #12121a; padding: 2rem; border-radius: 20px; width: 90%; max-width: 400px;
    border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 0 50px rgba(0,0,0,0.6);
    display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center;
    
    .warning-icon { font-size: 3rem; color: #ef4444; margin-bottom: 0.5rem; }
    h4 { color: #fff; font-size: 1.4rem; margin: 0; font-weight: 700; }
    p { color: #aebac1; font-size: 0.95rem; line-height: 1.6; margin: 0; .highlight { color: #9d4edd; font-weight: 600; } }
    
    .modal-actions {
      display: flex; gap: 1rem; width: 100%; margin-top: 1rem;
      button {
        flex: 1; padding: 12px; border-radius: 10px; border: none; cursor: pointer; font-weight: 600; font-size: 1rem; transition: 0.2s;
        &.cancel-btn { background: #2a2a35; color: #fff; &:hover { background: #3a3a45; } }
        &.confirm-btn { background: #ef4444; color: white; &:hover { background: #dc2626; box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); } }
      }
    }
  }
`;

const Container = styled.div`
  font-family: 'Inter', sans-serif; height: 100dvh; width: 100vw; background-color: #050509;
  display: flex; flex-direction: column; overflow: hidden;
  .container { flex: 1; height: 100%; width: 100%; display: grid; grid-template-columns: 350px 1fr; background-color: #050509; position: relative; }
  .sidebar { height: 100%; overflow: hidden; border-right: 1px solid rgba(157, 78, 221, 0.15); background-color: #0b0b14; z-index: 10; }
  .main-area { height: 100%; overflow: hidden; background-color: #050509; position: relative; }
  .hidden { display: none !important; }
  @media screen and (max-width: 800px) {
    .container { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .sidebar { width: 100%; border-right: none; }
    .main-area { width: 100%; }
  }
`;