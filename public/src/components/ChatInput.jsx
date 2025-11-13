import React, { useState, useRef, useEffect } from "react";
import { BsEmojiSmile } from "react-icons/bs";
import { IoMdSend, IoMdAttach } from "react-icons/io";
import { CgClose } from "react-icons/cg";
import { AiFillFileText } from "react-icons/ai";
import styled from "styled-components";
import Picker from "emoji-picker-react";
import axios from "axios";
import { uploadMessageRoute } from "../utils/APIRoutes";

export default function ChatInput({ handleSendMsg, socket, currentChat, inputFocusRef }) {
  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);

  // File Upload State
  const [fileToUpload, setFileToUpload] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [filePreviewType, setFilePreviewType] = useState(null); 
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const currentSocket = socket?.current;
    return () => {
      if (filePreview) {
        try { URL.revokeObjectURL(filePreview); } catch (err) {}
      }
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
      try {
        if (currentSocket && isTyping && currentChat) {
          currentSocket.emit("stop-typing", currentChat._id);
        }
      } catch (err) {}
    };
  }, [filePreview, isTyping, currentChat, socket]);

  const handleTyping = (e) => {
    setMsg(e.target.value);

    if (!socket?.current || !currentChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.current.emit("typing", currentChat._id);
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (socket.current) socket.current.emit("stop-typing", currentChat._id);
      setIsTyping(false);
      typingTimeout.current = null;
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat(e);
    }
  };

  const sendChat = async (event) => {
    event.preventDefault();
    if (!currentChat) return;

    if (fileToUpload) {
      if (isUploading) return;
      setIsUploading(true);
      try {
        const localUser = JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
        if (!localUser) throw new Error("User not found");

        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("from", localUser._id);
        formData.append("chatId", currentChat._id);

        const response = await axios.post(uploadMessageRoute, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response?.data?.status && response.data.fileUrl) {
          handleSendMsg(response.data.fileUrl);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploading(false);
        cancelFilePreview();
        setShowEmojiPicker(false);
      }
      return;
    }

    if (msg.trim().length > 0) {
      handleSendMsg(msg);
      setMsg("");
      setShowEmojiPicker(false);
      if (typingTimeout.current) { clearTimeout(typingTimeout.current); typingTimeout.current = null; }
      if (isTyping && socket?.current) {
        socket.current.emit("stop-typing", currentChat._id);
        setIsTyping(false);
      }
    }
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreview) {
      try { URL.revokeObjectURL(filePreview); } catch (err) {}
    }

    setFileToUpload(file);
    setMsg("");
    setShowEmojiPicker(false);

    if (file.type.startsWith("image/")) {
      setFilePreviewType("image");
      setFilePreview(URL.createObjectURL(file));
    } else if (file.type.startsWith("video/")) {
      setFilePreviewType("video");
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreviewType("file");
      setFilePreview(null);
    }
  };

  const cancelFilePreview = () => {
    if (filePreview) {
      try { URL.revokeObjectURL(filePreview); } catch (err) {}
    }
    setFileToUpload(null);
    setFilePreview(null);
    setFilePreviewType(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const onEmojiClick = (event, emojiObject) => {
    setMsg((prev) => prev + emojiObject.emoji);
  };

  return (
    <InputContainer ref={wrapperRef}>
      {showEmojiPicker && (
        <div className="emoji-picker-wrapper">
          <Picker 
            onEmojiClick={onEmojiClick} 
            theme="dark" 
            width="100%" 
            height="320px" 
          />
        </div>
      )}

      <div className="actions-left">
        <button 
          className="icon-btn" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Emoji"
        >
          <BsEmojiSmile />
        </button>
        <button 
          className="icon-btn" 
          onClick={handleAttachClick}
          title="Attach File"
        >
          <IoMdAttach />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      <form className="input-form" onSubmit={sendChat}>
        {fileToUpload ? (
          <div className="file-preview-card">
            <button type="button" className="close-preview" onClick={cancelFilePreview}>
              <CgClose />
            </button>
            <div className="preview-content">
               {filePreviewType === "image" && <img src={filePreview} alt="preview" />}
               {filePreviewType === "video" && <video src={filePreview} muted />}
               {filePreviewType === "file" && <div className="file-icon"><AiFillFileText /></div>}
               <div className="file-info">
                 <span className="name">{fileToUpload.name}</span>
                 <span className="size">{Math.round(fileToUpload.size / 1024)} KB</span>
               </div>
            </div>
          </div>
        ) : (
          <input
            ref={inputFocusRef}
            type="text"
            placeholder="Type a message..."
            value={msg}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
          />
        )}

        <button 
          className="send-btn" 
          type="submit"
          disabled={isUploading || (!msg.trim() && !fileToUpload)}
        >
          {isUploading ? <div className="spinner" /> : <IoMdSend />}
        </button>
      </form>
    </InputContainer>
  );
}

/* ---------------- STYLES: ALIGNED HEIGHT & THEME ---------------- */

const InputContainer = styled.div`
  /* ✅ FIXED HEIGHT: Matches Contacts.jsx Footer (80px) exactly */
  height: 80px;
  flex-shrink: 0;
  
  background-color: #0b0b14; /* Deep Navy */
  /* Border Color matches Contacts Footer Border */
  border-top: 1px solid rgba(255, 255, 255, 0.05); 
  
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  gap: 12px;
  z-index: 20;

  .emoji-picker-wrapper {
    position: absolute;
    bottom: 90px;
    left: 20px;
    z-index: 100;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(157, 78, 221, 0.2);
    
    @media (max-width: 720px) {
       left: 0; right: 0; bottom: 85px; width: 100%;
    }
  }

  .actions-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .icon-btn {
      background: transparent;
      border: none;
      color: #aebac1;
      font-size: 1.4rem;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center;

      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
        color: #9d4edd;
        transform: scale(1.1);
      }
    }
  }

  .input-form {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;

    input[type="text"] {
      width: 100%;
      background-color: #1a1a20; 
      color: #e1e1e6;
      border: 1px solid rgba(255,255,255,0.05);
      padding: 11px 20px;
      border-radius: 24px;
      font-size: 1rem;
      outline: none;
      transition: all 0.2s ease;

      &::placeholder { color: #6c6c80; }

      &:focus {
        border-color: #9d4edd;
        box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.15);
      }
    }

    .send-btn {
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(123, 44, 191, 0.3);
      flex-shrink: 0;

      &:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(123, 44, 191, 0.5);
      }

      &:disabled {
        background: #2a2a35;
        color: #666;
        cursor: not-allowed;
        box-shadow: none;
      }
      
      .spinner {
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid #fff;
        border-radius: 50%;
        width: 18px; height: 18px;
        animation: spin 1s linear infinite;
      }
    }
  }

  .file-preview-card {
    flex: 1;
    background: #1a1a20;
    border: 1px solid rgba(157, 78, 221, 0.2);
    border-radius: 16px;
    padding: 6px 16px;
    position: relative;
    display: flex; align-items: center;
    
    .close-preview {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: rgba(0,0,0,0.5); border: none; color: #fff;
      border-radius: 50%; width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 10;
      &:hover { background: #ef4444; }
    }

    .preview-content {
      display: flex; align-items: center; gap: 12px; width: 100%;
      img, video { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; }
      .file-icon { font-size: 1.8rem; color: #9d4edd; display: flex; }
      .file-info {
        display: flex; flex-direction: column; overflow: hidden;
        .name { color: #e1e1e6; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .size { color: #888; font-size: 0.75rem; }
      }
    }
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  @media (max-width: 720px) {
    padding: 0 1rem;
    .input-form input[type="text"] { padding: 10px 16px; font-size: 0.95rem; }
    .send-btn { width: 40px; height: 40px; font-size: 1.1rem; }
  }
`;