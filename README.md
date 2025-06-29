# 🔐 Secure File Sharing Application

A secure file-sharing application built with **FastAPI** (backend) and **React** (frontend), designed to allow users to share folders over the internet with authentication, space reservation, and file management capabilities.

## ✨ Features

- **🔒 Secure Authentication**: Uses HTTP Basic Authentication with bcrypt for password hashing
- **📁 File Upload/Download**: Supports file uploads and downloads with space limitation checks
- **🚀 Dynamic Routing**: React-based frontend with SPA fallback for seamless navigation
- **🌐 Public Access**: Integrates ngrok to provide temporary public URLs for sharing
- **⚠️ Error Handling**: Includes robust error messages for setup, upload, and download operations

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js** and **npm**
- **ngrok** account and authtoken (for public URL generation)

### Required Dependencies

**Python packages:**
```
fastapi
uvicorn
passlib[bcrypt]
pyngrok
psutil
pydantic
pyAesCrypt
```

**npm packages:** Check `package.json` for React dependencies

## 🚀 Installation

### 1. Clone the repository
```bash
git clone https://github.com/Ayu-zh/Local-Drive-X-
cd Local-Drive-X-
```

### 2. Set up Python environment
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure ngrok
1. Download ngrok from [ngrok.com](https://ngrok.com)
2. Set your authtoken:
   ```bash
   ngrok authtoken your_actual_authtoken_here
   ```

### 4. Install frontend dependencies
```bash
cd frontend
npm install
npm start
```

### 5. Start the FastAPI server
```bash
cd ..
python main.py
```
