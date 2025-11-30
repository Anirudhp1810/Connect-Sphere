import React, { useState, useEffect } from "react";
import styled from "styled-components";
import axios from "axios";
import { allUsersRoute, accessChatRoute } from "../utils/APIRoutes";
import { CgClose, CgSearch } from "react-icons/cg"; 
import { BiLoaderAlt } from "react-icons/bi"; 

export default function SearchModal({
  showModal,
  setShowModal,
  currentUser,
  chats,
  setChats,
  setCurrentChat,
}) {
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 1. Debounce Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // 2. Search Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearch.trim()) {
        setSearchResult([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data } = await axios.get(
          `${allUsersRoute}/${currentUser._id}?search=${debouncedSearch}`
        );
        setSearchResult(data);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };
    performSearch();
  }, [debouncedSearch, currentUser]);

  const handleSelectChat = async (user) => {
    try {
      const existingChat = chats.find(
        (c) => !c.isGroupChat && c.users.find((u) => u._id === user._id)
      );

      if (existingChat) {
        setCurrentChat(existingChat);
        setShowModal(false);
        return;
      }

      const { data } = await axios.post(accessChatRoute, {
        userId: user._id,
        currentUserId: currentUser._id,
      });
      
      if (!chats.find((c) => c._id === data._id)) {
          setChats([data, ...chats]);
      }
      setCurrentChat(data);
      setShowModal(false);
    } catch (error) {
      console.error("Error accessing chat:", error);
    }
  };

  if (!showModal) return null;

  return (
    <ModalContainer onClick={() => setShowModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Search Users</h2>
          <button className="close-btn" onClick={() => setShowModal(false)}>
            <CgClose />
          </button>
        </div>

        <div className="input-wrapper">
          <CgSearch className="search-icon" />
          <input
            type="text"
            placeholder="Find a user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="search-results">
          {loading ? (
            <div className="state-container">
                <BiLoaderAlt className="spinner" />
                <span>Searching...</span>
            </div>
          ) : (
            searchResult?.length > 0 ? (
                searchResult.slice(0, 5).map((user) => (
                <div
                  key={user._id}
                  className="user-card"
                  onClick={() => handleSelectChat(user)}
                >
                  <div className="avatar">
                    <img
                      src={`data:image/svg+xml;base64,${user.avatarImage}`}
                      alt="avatar"
                    />
                  </div>
                  <div className="user-info">
                    <h3>{user.username}</h3>
                    <span className="email">{user.email}</span>
                  </div>
                </div>
              ))
            ) : (
                search && !loading && (
                    <div className="state-container">
                        <span>No users found.</span>
                    </div>
                )
            )
          )}
        </div>
      </div>
    </ModalContainer>
  );
}

const ModalContainer = styled.div`
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;

  .modal-content {
    background-color: #0b0b14;
    padding: 1.5rem;
    border-radius: 20px;
    width: 90%; max-width: 450px;
    display: flex; flex-direction: column;
    /* Removed gap here to control spacing manually below */
    gap: 0.5rem; 
    position: relative;
    border: 1px solid rgba(157, 78, 221, 0.2);
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.7);
    animation: fadeIn 0.2s ease-out;

    .modal-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1rem; /* Added explicit margin */
        h2 { color: #fff; font-size: 1.2rem; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
        .close-btn {
          background: transparent; border: none; color: #aebac1;
          font-size: 1.5rem; cursor: pointer; transition: 0.2s;
          display: flex; align-items: center; justify-content: center;
          &:hover { color: #ef4444; transform: scale(1.1); }
        }
    }

    .input-wrapper {
        position: relative;
        display: flex; align-items: center;
        margin-bottom: 1rem; /* ✅ Pushes results down explicitly */
        z-index: 10; /* Ensures input stays visually "above" scrolling results */

        .search-icon {
            position: absolute; left: 14px; color: #9d4edd; font-size: 1.2rem; pointer-events: none;
        }

        input {
          width: 100%;
          background-color: #15151e;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 14px 16px 14px 44px;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s ease;
          
          &::placeholder { color: #6c6c80; }
          &:focus {
            outline: none;
            border-color: #9d4edd;
            box-shadow: 0 0 0 3px rgba(157, 78, 221, 0.15);
          }
        }
    }

    .search-results {
      display: flex; flex-direction: column; gap: 0.8rem;
      max-height: 320px; overflow-y: auto;
      padding-right: 4px;
      padding-top: 5px; /* ✅ slight padding to prevent border clipping */

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
      
      .state-container {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 2rem; color: #888; gap: 0.5rem; font-size: 0.9rem;
          .spinner { font-size: 1.5rem; color: #9d4edd; animation: spin 1s linear infinite; }
      }

      .user-card {
        display: flex; align-items: center; gap: 1rem;
        background-color: #15151e;
        padding: 12px 16px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background-color: #1e1e2a;
          border-color: #9d4edd;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .avatar img {
            height: 3rem; width: 3rem;
            border-radius: 50%; object-fit: cover;
            border: 2px solid rgba(157, 78, 221, 0.2);
        }
        
        .user-info {
          display: flex; flex-direction: column;
          gap: 4px;
          h3 { color: #e1e1e6; font-size: 1rem; font-weight: 600; margin: 0; line-height: 1.2; }
          .email { color: #888; font-size: 0.8rem; line-height: 1.2; }
        }
      }
    }
  }

  @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;