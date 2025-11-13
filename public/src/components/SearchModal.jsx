import React, { useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { allUsersRoute, accessChatRoute } from "../utils/APIRoutes";
import { CgClose } from "react-icons/cg";

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

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${allUsersRoute}/${currentUser._id}?search=${search}`
      );
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      console.error("Error searching users:", error);
      setLoading(false);
    }
  };

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
      setChats([data, ...chats]);
      setCurrentChat(data);
      setShowModal(false);
    } catch (error) {
      console.error("Error accessing chat:", error);
    }
  };

  if (!showModal) return null;

  return (
    <ModalContainer>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Search Users</h2>
          <button className="close-btn" onClick={() => setShowModal(false)}>
            <CgClose />
          </button>
        </div>

        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Find a user..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="search-results">
          {loading ? (
            <div className="loading-text">Searching...</div>
          ) : (
            searchResult
              ?.slice(0, 4)
              .map((user) => (
                <div
                  key={user._id}
                  className="user-item"
                  onClick={() => handleSelectChat(user)}
                >
                  <div className="avatar">
                    <img
                      src={`data:image/svg+xml;base64,${user.avatarImage}`}
                      alt="avatar"
                    />
                  </div>
                  <div className="username">
                    <h3>{user.username}</h3>
                  </div>
                </div>
              ))
          )}
          {!loading && searchResult.length === 0 && search && (
             <div className="loading-text">No users found.</div>
          )}
        </div>
      </div>
    </ModalContainer>
  );
}

// --- STYLES: DEEP INDIGO & VIOLET ---

const ModalContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px); /* Glass Effect */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;

  .modal-content {
    background-color: #0b0b14; /* Deep Navy */
    padding: 1.5rem;
    border-radius: 16px;
    width: 90%;
    max-width: 450px;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    position: relative;
    border: 1px solid rgba(157, 78, 221, 0.3); /* Violet Border */
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);

    .modal-header {
        display: flex; justify-content: space-between; align-items: center;
        
        h2 {
          color: #fff;
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
        }
    
        .close-btn {
          background: transparent;
          border: none;
          color: #aebac1;
          font-size: 1.5rem;
          cursor: pointer;
          transition: 0.2s;
          display: flex; align-items: center;
          &:hover { color: #ef4444; transform: scale(1.1); }
        }
    }

    .input-wrapper {
        input {
          width: 100%;
          background-color: #1a1a20; /* Dark Slate */
          color: #fff;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          
          &::placeholder {
            color: #6c6c80;
          }
          
          &:focus {
            outline: none;
            border-color: #9d4edd; /* Electric Violet Focus */
            box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.2);
          }
        }
    }

    .search-results {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-height: 300px;
      overflow-y: auto;
      
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
      
      .loading-text {
          color: #888; text-align: center; font-size: 0.9rem; padding: 1rem;
      }

      .user-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background-color: transparent;
        padding: 0.8rem;
        border-radius: 10px;
        cursor: pointer;
        transition: 0.2s ease-in-out;
        border: 1px solid transparent;

        &:hover {
          background-color: rgba(157, 78, 221, 0.15);
          border-color: rgba(157, 78, 221, 0.3);
        }
        
        .avatar {
          img {
            height: 2.8rem;
            width: 2.8rem;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(157, 78, 221, 0.2);
          }
        }
        
        .username {
          h3 {
            color: #e1e1e6;
            font-size: 1rem;
            font-weight: 500;
            margin: 0;
          }
        }
      }
    }
  }
`;