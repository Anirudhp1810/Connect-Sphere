import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BiPowerOff } from "react-icons/bi";
import styled from "styled-components";
import axios from "axios";
import { logoutRoute } from "../utils/APIRoutes";

export default function Logout() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleLogout = async () => {
    try {
      const id = await JSON.parse(
        localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
      )._id;
      
      const data = await axios.get(`${logoutRoute}/${id}`);
      
      if (data.status === 200) {
        localStorage.clear();
        navigate("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      // Fallback: clear storage even if server fails
      localStorage.clear();
      navigate("/login");
    }
  };

  return (
    <>
      <Button onClick={() => setShowModal(true)} title="Logout">
        <BiPowerOff />
      </Button>

      {/* CONFIRMATION MODAL */}
      {showModal && (
        <ModalOverlay>
          <div className="modal-box">
            <div className="modal-header">
              <h3>Confirm Logout</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to log out of <strong>Connect Sphere</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

// --- STYLES ---

const Button = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.6rem;
  border-radius: 12px; 
  background-color: #1a1a20; 
  border: 1px solid rgba(157, 78, 221, 0.3); 
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  
  svg {
    font-size: 1.3rem;
    color: #9d4edd; 
    transition: color 0.3s ease-in-out;
  }
  
  &:hover {
    background-color: #9d4edd; 
    border-color: #9d4edd;
    box-shadow: 0 0 15px rgba(157, 78, 221, 0.4); 
    
    svg {
      color: #fff; 
    }
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;

  .modal-box {
    background-color: #0b0b14;
    border: 1px solid rgba(157, 78, 221, 0.3);
    padding: 2rem;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);

    .modal-header h3 {
      color: #fff;
      margin: 0;
      font-size: 1.4rem;
      font-weight: 700;
    }

    .modal-body p {
      color: #aebac1;
      font-size: 1rem;
      line-height: 1.5;
      margin: 0;
      strong {
        color: #9d4edd;
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;

      button {
        padding: 0.8rem 1.5rem;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: 0.2s ease;
      }

      .cancel-btn {
        background-color: transparent;
        border: 1px solid #333;
        color: #fff;
        &:hover {
          background-color: #1a1a20;
        }
      }

      .confirm-btn {
        background: linear-gradient(135deg, #ff0055 0%, #ff003c 100%); /* Red/Pink Warning */
        color: white;
        box-shadow: 0 4px 15px rgba(255, 0, 60, 0.3);
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 0, 60, 0.5);
        }
      }
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;