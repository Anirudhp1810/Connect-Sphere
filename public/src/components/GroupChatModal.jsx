import React, { useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { allUsersRoute, createGroupRoute } from "../utils/APIRoutes";
import { CgClose } from "react-icons/cg";

export default function GroupChatModal({
  showModal,
  setShowModal,
  currentUser,
  chats,
  setChats,
  socket, // socket prop (optional)
}) {
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle searching for users; use `query` directly to avoid stale-state issues
  const handleSearch = async (query) => {
    setSearch(query);
    if (!query || !currentUser) {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${allUsersRoute}/${currentUser._id}?search=${encodeURIComponent(query)}`
      );
      setSearchResult(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResult([]);
    } finally {
      setLoading(false);
    }
  };

  // Add a user to the selected list (by id check)
  const handleGroup = (userToAdd) => {
    if (!userToAdd || !userToAdd._id) return;

    // Prevent adding current user into the selected list
    if (currentUser && userToAdd._id === currentUser._id) {
      alert("You are already part of the group (you are the creator).");
      return;
    }

    // Check by id to prevent duplicates
    if (selectedUsers.some((u) => u._id === userToAdd._id)) {
      alert("User already added");
      return;
    }
    setSelectedUsers((prev) => [...prev, userToAdd]);
  };

  // Remove user from selected list (by id)
  const handleDelete = (delUser) => {
    if (!delUser || !delUser._id) return;
    setSelectedUsers((prev) => prev.filter((sel) => sel._id !== delUser._id));
  };

  // Submit: create the group on the server and emit socket event
  const handleSubmit = async () => {
    if (!groupChatName.trim() || selectedUsers.length === 0) {
      alert("Please enter a group name and add at least one user.");
      return;
    }

    try {
      const payload = {
        name: groupChatName.trim(),
        users: JSON.stringify(selectedUsers.map((u) => u._id)),
        currentUserId: currentUser?._id,
      };

      const { data } = await axios.post(createGroupRoute, payload);

      if (!data) {
        throw new Error("Invalid response from server when creating group.");
      }

      // Add the new group chat to the top of the list (functional update to avoid stale arrays)
      setChats((prev) => [data, ...prev]);

      // Emit to server so other users get notified (if socket is present)
      try {
        if (socket?.current) {
          socket.current.emit("new-group", data);
        }
      } catch (emitErr) {
        console.error("Socket emit failed for new-group:", emitErr);
      }

      // Reset modal state & close
      setGroupChatName("");
      setSelectedUsers([]);
      setSearch("");
      setSearchResult([]);
      setShowModal(false);
    } catch (error) {
      console.error("Error creating group chat:", error);
      alert("Failed to create group chat. Try again.");
    }
  };

  if (!showModal) return null;

  return (
    <ModalContainer>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Create Group Chat">
        <div className="modal-header">
          <h2>New Group</h2>
          <button className="close-btn" onClick={() => setShowModal(false)} aria-label="Close">
            <CgClose />
          </button>
        </div>

        <div className="inputs-section">
          <input
            type="text"
            placeholder="Group Name"
            value={groupChatName}
            onChange={(e) => setGroupChatName(e.target.value)}
            className="main-input"
          />

          <input
            type="text"
            placeholder="Add members..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Selected Users Pills */}
        <div className="selected-users" aria-live="polite">
          {selectedUsers.map((u) => (
            <div key={u._id} className="user-pill" onClick={() => handleDelete(u)} title="Remove">
              {u.username} <CgClose />
            </div>
          ))}
        </div>

        {/* Search Results */}
        <div className="search-results" role="list">
          {loading ? (
            <div className="loading-text">Loading...</div>
          ) : (
            searchResult?.slice(0, 6).map((user) => (
              <div
                key={user._id}
                className="user-item"
                role="listitem"
                onClick={() => handleGroup(user)}
              >
                <div className="avatar">
                  <img src={`data:image/svg+xml;base64,${user.avatarImage}`} alt={`${user.username} avatar`} />
                </div>
                <div className="username">
                  <h3>{user.username}</h3>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="create-btn" onClick={handleSubmit}>
          Create Group
        </button>
      </div>
    </ModalContainer>
  );
}

/* --- STYLES: DEEP INDIGO & VIOLET --- */

const ModalContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;

  .modal-content {
    background-color: #0b0b14; /* Deep Navy */
    padding: 1.5rem;
    border-radius: 16px;
    width: 90%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    border: 1px solid rgba(157, 78, 221, 0.3);
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);

    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.5rem;
      
      h2 {
        color: #fff;
        font-size: 1.3rem;
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
        display: flex;
        &:hover { color: #ef4444; transform: scale(1.1); }
      }
    }

    .inputs-section {
      display: flex; flex-direction: column; gap: 10px;
      
      input {
        width: 100%;
        background-color: #1a1a20; /* Dark Slate */
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 0.95rem;
        transition: all 0.2s ease;
        
        &::placeholder { color: #6c6c80; }
        
        &:focus {
          outline: none;
          border-color: #9d4edd; /* Electric Violet */
          box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.15);
        }
      }
    }

    .selected-users {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      min-height: 30px;
      
      .user-pill {
        background: rgba(157, 78, 221, 0.15); /* Transparent Violet */
        border: 1px solid rgba(157, 78, 221, 0.4);
        color: #9d4edd;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        transition: 0.2s;
        
        &:hover {
          background: rgba(239, 68, 68, 0.15); /* Red Tint on Hover */
          border-color: #ef4444;
          color: #ef4444;
        }
      }
    }

    .search-results {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 180px;
      overflow-y: auto;
      
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
      
      .loading-text { color: #888; text-align: center; font-size: 0.9rem; }

      .user-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background-color: transparent;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.2s ease-in-out;
        
        &:hover {
          background-color: rgba(157, 78, 221, 0.15);
        }
        
        .avatar {
          img { height: 2.2rem; width: 2.2rem; border-radius: 50%; object-fit: cover; }
        }
        .username {
          h3 { color: #e1e1e6; font-size: 0.95rem; font-weight: 500; margin: 0; }
        }
      }
    }

    .create-btn {
      background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%);
      color: white;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: 0.3s ease;
      box-shadow: 0 4px 15px rgba(123, 44, 191, 0.3);
      margin-top: 0.5rem;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(123, 44, 191, 0.5);
      }
    }
  }
`;