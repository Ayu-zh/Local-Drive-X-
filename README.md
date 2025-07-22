(in early development)
# 🔐 Secure File Sharing Application

A secure file-sharing application built with **FastAPI** (backend) and **React** (frontend), designed to allow users to share folders over the internet with authentication, space reservation, and file management capabilities.

## ✨ Features

- **🔒 Secure Authentication**: Uses HTTP Basic Authentication with bcrypt for password hashing
- **📁 File Upload/Download**: Supports file uploads and downloads with space limitation checks
- **🚀 Dynamic Routing**: React-based frontend with SPA fallback for seamless navigation
- **🌐 Public Access**: Integrates LocalTunnel to provide temporary public URLs for sharing
- **⚠️ Error Handling**: Includes robust error messages for setup, upload, and download operations

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js** and **npm**
- **LocalTunnel** (for public URL generation)

### Required Dependencies

**Python packages:**
```
fastapi
uvicorn
passlib[bcrypt]
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

### 3. Install LocalTunnel
```bash
npm install -g localtunnel
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

## 📖 Usage

1. **Open the React app** at `http://localhost:3000`

2. **Configure your share:**
   - Enter a folder path (e.g., `C:/Local-Drive-X/shared`)
   - Set reserved space (in GB)
   - Create a password

3. **Generate public link** - Click "Generate link" to get a public LocalTunnel URL
   ```
   Example: https://share-yourfolder.loca.lt/files
   ```

4. **Access and manage files** - Use the link to access the file management page where you can:
   - Upload files
   - Download files
   - View file listings
   - Authenticate with your password

## ⚠️ Known Issues

### LocalTunnel Configuration
- **Issue**: The LocalTunnel tunnel may fail if the subdomain is already taken or if LocalTunnel is not installed
- **Solution**: Ensure LocalTunnel is installed globally (`npm install -g localtunnel`). If subdomain fails, try again without specifying a subdomain.

### bcrypt Compatibility
- **Issue**: Compatibility issue with bcrypt may cause version errors
- **Solution**: Reinstall with `pip install bcrypt==4.0.1`

### Localhost Fallback
- **Issue**: If LocalTunnel fails, the app falls back to `http://localhost:8000`, which is inaccessible externally
- **Note**: This is expected behavior for local development only

## 🔮 Future Improvements

- [ ] Replace LocalTunnel with a permanent hosting solution for production (scalable cloud solution)
- [ ] Add QR code generation for easy link sharing (qrcode - python library)   
- [ ] Implement file encryption for enhanced security (pyAesCrypt)
- [ ] Add user management and multiple folder support (SQLite)
- [ ] Enhance UI with file previews and progress indicators
- [ ] Develop app based implementation for better user experience

