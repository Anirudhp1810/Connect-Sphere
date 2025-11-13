import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Robot from "../assets/robot.gif";

// 1. Accept the 'currentUser' prop from Chat.jsx
export default function Welcome({ currentUser }) {
  const [userName, setUserName] = useState("");

  // 2. THIS IS THE FIXED useEffect
  // It now runs when 'currentUser' prop changes
  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.username);
    }
  }, [currentUser]);

  return (
    <Container>
      <img src={Robot} alt="Welcome Robot" />
      <h1>
        Welcome, <span>{userName}!</span>
      </h1>
      <h3>Please select a chat to start messaging.</h3>
    </Container>
  );
}

// --- STYLES: DEEP INDIGO THEME ---
const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: white;
  background-color: #050509; /* Matches ChatContainer background */
  height: 100%;
  width: 100%;
  gap: 1rem;
  
  img {
    height: 20rem;
    transition: transform 0.3s ease;
    /* Optional: subtle hover effect on the robot */
    &:hover {
        transform: scale(1.05);
    }
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    font-weight: 700;
    color: #fff;
    
    span {
      color: #9d4edd; /* Electric Violet */
      text-shadow: 0 0 20px rgba(157, 78, 221, 0.5); /* Neon Glow */
    }
  }

  h3 {
    font-size: 1.1rem;
    color: #aebac1; /* Cool Gray/Slate */
    font-weight: 400;
  }

  @media (max-width: 720px) {
      img { height: 15rem; }
      h1 { font-size: 1.5rem; }
      h3 { font-size: 0.9rem; text-align: center; padding: 0 1rem; }
  }
`;