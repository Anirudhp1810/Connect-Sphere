import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components"; 
import axios from "axios";
import { useNavigate } from "react-router-dom"; // ✅ Import Hook
import { updatePrivacyRoute, logoutRoute } from "../utils/APIRoutes"; // ✅ Import Logout Route
import { CgClose } from "react-icons/cg";
import { BsPerson, BsShieldLock } from "react-icons/bs";
import { BiPowerOff } from "react-icons/bi"; // ✅ Import Logout Icon
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function SettingsModal({
  showModal,
  setShowModal,
  currentUser,
  setCurrentUser,
}) {
  const navigate = useNavigate(); // ✅ Init Hook
  const [activeTab, setActiveTab] = useState("profile");
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setReadReceipts(currentUser.showReadReceipts !== false);
      setLastSeen(currentUser.showLastSeen !== false);
    }
  }, [currentUser, showModal]);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 3000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(updatePrivacyRoute, {
        userId: currentUser._id,
        showReadReceipts: readReceipts,
        showLastSeen: lastSeen,
      });

      if (data.status) {
        const updatedUser = { ...currentUser, ...data.user };
        localStorage.setItem(
          process.env.REACT_APP_LOCALHOST_KEY,
          JSON.stringify(updatedUser)
        );
        setCurrentUser(updatedUser);
        toast.success("Settings updated successfully!", toastOptions);
        setTimeout(() => setShowModal(false), 1000);
      } else {
        toast.error("Failed to update settings.", toastOptions);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to server.", toastOptions);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Logout Logic
  const handleLogout = async () => {
    try {
      const id = currentUser._id;
      const data = await axios.get(`${logoutRoute}/${id}`);
      if (data.status === 200) {
        localStorage.clear();
        navigate("/login");
      }
    } catch (error) {
      console.error(error);
      // Force logout even if server fails
      localStorage.clear();
      navigate("/login");
    }
  };

  if (!showModal) return null;

  return (
    <>
      <ModalOverlay onClick={() => setShowModal(false)}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Settings</h2>
            <button className="close-btn" onClick={() => setShowModal(false)}>
              <CgClose />
            </button>
          </div>

          {/* --- TABS --- */}
          <TabContainer>
            <div 
              className={`tab ${activeTab === "profile" ? "active" : ""}`} 
              onClick={() => setActiveTab("profile")}
            >
              <BsPerson /> Profile
            </div>
            <div 
              className={`tab ${activeTab === "privacy" ? "active" : ""}`} 
              onClick={() => setActiveTab("privacy")}
            >
              <BsShieldLock /> Privacy
            </div>
          </TabContainer>

          <div className="modal-body">
            {/* === PROFILE TAB === */}
            {activeTab === "profile" && (
              <ProfileSection>
                <div className="avatar-large">
                  <img
                    src={`data:image/svg+xml;base64,${currentUser.avatarImage}`}
                    alt="avatar"
                  />
                </div>
                <div className="info-group">
                  <label>Username</label>
                  <div className="info-value">{currentUser.username}</div>
                </div>
                <div className="info-group">
                  <label>Email</label>
                  <div className="info-value">{currentUser.email}</div>
                </div>

                {/* ✅ NEW: Logout Button in Profile */}
                <LogoutButton onClick={handleLogout}>
                    <BiPowerOff /> Log Out
                </LogoutButton>
              </ProfileSection>
            )}

            {/* === PRIVACY TAB === */}
            {activeTab === "privacy" && (
              <PrivacySection>
                <div className="setting-item">
                  <div className="text-info">
                    <h3>Read Receipts</h3>
                    <p>
                      If turned off, you won't send Read Receipts. You also won't be
                      able to see others' Read Receipts.
                    </p>
                  </div>
                  <ToggleSwitch>
                    <input
                      type="checkbox"
                      checked={readReceipts}
                      onChange={() => setReadReceipts(!readReceipts)}
                    />
                    <span className="slider round"></span>
                  </ToggleSwitch>
                </div>

                <div className="setting-item">
                  <div className="text-info">
                    <h3>Last Seen</h3>
                    <p>
                      If turned off, you won't share your Last Seen time. You also
                      won't see the Last Seen of others.
                    </p>
                  </div>
                  <ToggleSwitch>
                    <input
                      type="checkbox"
                      checked={lastSeen}
                      onChange={() => setLastSeen(!lastSeen)}
                    />
                    <span className="slider round"></span>
                  </ToggleSwitch>
                </div>
              </PrivacySection>
            )}
          </div>

          {activeTab === "privacy" && (
            <div className="modal-footer">
              <button className="save-btn" onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </ModalContent>
      </ModalOverlay>
      <ToastContainer />
    </>
  );
}

/* --- STYLES --- */

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const ModalOverlay = styled.div`
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px);
  display: flex; justify-content: center; align-items: center; z-index: 9999;
`;

const ModalContent = styled.div`
  background-color: #0b0b14; width: 90%; max-width: 500px;
  height: 600px; /* Fixed Height */
  border-radius: 20px; border: 1px solid rgba(157, 78, 221, 0.3);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
  position: relative;

  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.5rem; padding-bottom: 1rem;
    h2 { color: #fff; font-size: 1.4rem; font-weight: 700; margin: 0; }
    .close-btn {
      background: transparent; border: none; color: #aebac1; font-size: 1.5rem;
      cursor: pointer; transition: 0.2s; &:hover { color: #ef4444; }
    }
  }

  .modal-body { 
    padding: 1.5rem; 
    flex: 1; 
    overflow-y: auto; 
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
  }

  .modal-footer {
    display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1);
    padding: 1rem 1.5rem; background: rgba(0,0,0,0.2);
    margin-top: auto; 
    
    .save-btn {
      background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%);
      color: white; border: none; padding: 10px 24px;
      border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer;
      transition: 0.2s; box-shadow: 0 4px 15px rgba(123, 44, 191, 0.3);
      &:hover { transform: scale(1.05); }
      &:disabled { background: #333; cursor: not-allowed; transform: none; box-shadow: none; }
    }
  }
`;

const TabContainer = styled.div`
  display: flex; border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.02);
  .tab {
    flex: 1; padding: 1rem; text-align: center; cursor: pointer;
    color: #aebac1; font-weight: 500; transition: 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    border-bottom: 2px solid transparent;
    
    &:hover { background: rgba(255,255,255,0.05); color: #fff; }
    &.active { color: #9d4edd; border-bottom: 2px solid #9d4edd; background: rgba(157, 78, 221, 0.1); }
  }
`;

const ProfileSection = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
  
  .avatar-large {
    width: 120px; height: 120px; border-radius: 50%;
    border: 4px solid rgba(157, 78, 221, 0.5); padding: 4px;
    img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  }

  .info-group {
    width: 100%; text-align: center;
    label { color: #888; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; display: block; }
    .info-value { 
        color: #fff; font-size: 1.1rem; font-weight: 600; background: rgba(255,255,255,0.05);
        padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
    }
  }
`;

const LogoutButton = styled.button`
    margin-top: 1rem;
    background: transparent;
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    width: 100%;
    justify-content: center;

    &:hover {
        background: #ff6b6b;
        color: white;
        box-shadow: 0 0 15px rgba(255, 107, 107, 0.3);
    }
`;

const PrivacySection = styled.div`
  display: flex; flex-direction: column; gap: 1.5rem;
  .setting-item {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    .text-info {
      h3 { color: #e1e1e6; font-size: 1rem; margin-bottom: 0.3rem; }
      p { color: #888; font-size: 0.8rem; line-height: 1.3; margin: 0; }
    }
  }
`;

const ToggleSwitch = styled.label`
  position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0;
  input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background-color: #2c2c35; transition: .4s;
  }
  .slider:before {
    position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px;
    background-color: white; transition: .4s;
  }
  input:checked + .slider { background-color: #9d4edd; }
  input:checked + .slider:before { transform: translateX(24px); }
  .slider.round { border-radius: 34px; }
  .slider.round:before { border-radius: 50%; }
`;