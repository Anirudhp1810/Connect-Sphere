# Connect Sphere

A modern, real-time chat application built on the **MERN Stack** (MongoDB, Express, React, Node.js) with **Socket.io** for live communication.

---

## ✨ Features

- **Real-Time Messaging** – Instant message delivery using Socket.io rooms  
- **Group Chats** – Create groups, add/remove users, search members  
- **1-on-1 Chats** – Private conversations between two users  
- **Media Sharing** – Send images, videos, and files (Cloudinary powered)  
- **Online / Offline Status** – Accurate multi-device status tracking  
- **Notifications** – Real-time unread message badges and alerts  
- **Read Receipts** – Double-tick indicators  
- **Typing Indicators** – “User is typing…” animation  
- **Message Management**
  - Delete For Me  
  - Delete For Everyone  
- **Chat Management**
  - Clear chat  
  - Delete conversation  

---

## 🛠️ Tech Stack

### **Frontend**
- React (Vite)
- Styled Components
- Socket.io-client
- Emoji Picker React

### **Backend**
- Node.js  
- Express  
- Socket.io  
- Mongoose  
- Multer  

### **Database**
- MongoDB Atlas

### **Media Storage**
- Cloudinary

---

## 🚀 Local Development Setup

### **1. Prerequisites**
- Node.js (LTS recommended)  
- MongoDB Atlas account  
- Cloudinary account  

---

### **2. Clone the Repository**

```sh
git clone https://github.com/Anirudhp1810/Connect-Sphere.git
cd Connect-Sphere

```

-------------------------------------

### **3.Backend Setup (Server)**
```sh
cd server
npm install
```

Create a .env file
```sh

PORT=5000
MONGO_URL=your_mongodb_connection_string

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

CLIENT_URL=http://localhost:5173
```

Run Backend
```sh
npm start
```

Backend runs at:

http://localhost:5000

-------------------------------------

### **4. Frontend Setup (public)**
```sh
cd public
npm install
```

Configure API URL

Open:
src/utils/APIRoutes.js

Replace:
export const host = "http://localhost:5000";

Run Frontend
```sh
npm start
```

Frontend runs at:
http://localhost:5173

-------------------------------------

☁️ Deployment
-------------------------------------
Backend → Render

Create new Web Service
Set Root Directory: server
Add all environment variables

Deploy

-------------------------------------
Frontend → Vercel

Import repository
Set Root Directory: public
Update backend URL inside APIRoutes.js

Deploy

-------------------------------------
# **👤 Author**

### Anirudh

### GitHub: @Anirudhp1810
