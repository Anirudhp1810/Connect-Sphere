import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import Logo from "../assets/logo.png";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerRoute } from "../utils/APIRoutes";

export default function Register() {
  const navigate = useNavigate();
  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)) {
      navigate("/");
    }
  }, [navigate]);

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
  };

  const handleValidation = () => {
    const { password, confirmPassword, username, email } = values;
    if (password !== confirmPassword) {
      toast.error(
        "Password and confirm password should be same.",
        toastOptions
      );
      return false;
    } else if (username.length < 3) {
      toast.error(
        "Username should be greater than 3 characters.",
        toastOptions
      );
      return false;
    } else if (password.length < 8) {
      toast.error(
        "Password should be equal or greater than 8 characters.",
        toastOptions
      );
      return false;
    } else if (email === "") {
      toast.error("Email is required.", toastOptions);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (handleValidation()) {
      const { email, username, password } = values;
      const { data } = await axios.post(registerRoute, {
        username,
        email,
        password,
      });

      if (data.status === false) {
        toast.error(data.msg, toastOptions);
      }
      if (data.status === true) {
        localStorage.setItem(
          process.env.REACT_APP_LOCALHOST_KEY,
          JSON.stringify(data.user)
        );
        navigate("/");
      }
    }
  };

  return (
    <>
      <FormContainer>
        <form action="" onSubmit={(event) => handleSubmit(event)}>
          <div className="brand">
            <img src={Logo} alt="logo" />
            <h1>Connect Sphere</h1>
          </div>
          <input
            type="text"
            placeholder="Username"
            name="username"
            onChange={(e) => handleChange(e)}
          />
          <input
            type="email"
            placeholder="Email"
            name="email"
            onChange={(e) => handleChange(e)}
          />
          <input
            type="password"
            placeholder="Password"
            name="password"
            onChange={(e) => handleChange(e)}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            name="confirmPassword"
            onChange={(e) => handleChange(e)}
          />
          <button type="submit">Create User</button>
          <span>
            Already have an account ? <Link to="/login">Login.</Link>
          </span>
        </form>
      </FormContainer>
      <ToastContainer />
    </>
  );
}

// --- STYLES: DEEP INDIGO & VIOLET ---
const FormContainer = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  background-color: #050509; /* Deepest Black/Indigo */
  font-family: 'Inter', sans-serif;
  
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 4rem;
    }
    h1 {
      color: white;
      text-transform: uppercase;
      font-size: 1.5rem;
      letter-spacing: 1px;
      font-weight: 700;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background-color: #0b0b14; /* Deep Navy Surface */
    border: 1px solid rgba(157, 78, 221, 0.2); /* Subtle Violet Border */
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.5); /* Deep Shadow */
    border-radius: 20px;
    padding: 3rem 4rem;
    width: 100%;
    max-width: 450px;
  }

  input {
    background-color: #1a1a20; /* Dark Slate */
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: white;
    width: 100%;
    font-size: 1rem;
    transition: all 0.3s ease;
    
    &::placeholder {
        color: #6c6c80;
    }
    
    &:focus {
      border-color: #9d4edd; /* Electric Violet */
      outline: none;
      box-shadow: 0 0 0 2px rgba(157, 78, 221, 0.2);
      background-color: #15151e;
    }
  }

  button {
    background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%); /* Violet Gradient */
    color: white;
    padding: 1rem 2rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 8px;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: 0.3s ease-in-out;
    margin-top: 0.5rem;
    box-shadow: 0 4px 15px rgba(123, 44, 191, 0.3);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(123, 44, 191, 0.5);
    }
  }

  span {
    color: #aebac1;
    font-size: 0.9rem;
    text-align: center;
    
    a {
      color: #9d4edd; /* Electric Violet Link */
      text-decoration: none;
      font-weight: bold;
      margin-left: 0.3rem;
      transition: 0.2s;
      
      &:hover {
          color: #c77dff;
          text-decoration: underline;
      }
    }
  }
  
  @media (max-width: 480px) {
      form {
          padding: 2rem;
          width: 90%;
      }
      .brand h1 { font-size: 1.2rem; }
  }
`;