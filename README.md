# Secure File Sharing Application

A secure file-sharing application built with **FastAPI** (backend) and **React** (frontend), designed to allow users to share folders over the internet. It features authentication, space reservation, and file management, with **ngrok** used for public URL generation during development.

---

## 🚀 Features

- **Secure Authentication:** Uses HTTP Basic Authentication with `bcrypt` for password hashing.
- **File Upload/Download:** Supports file uploads and downloads with space limitation checks.
- **Dynamic Routing:** React-based frontend with SPA fallback for seamless navigation.
- **Public Access:** Integrates `ngrok` to provide temporary public URLs for sharing.
- **Error Handling:** Includes robust error messages for setup, upload, and download operations.

---

## ⚙️ Prerequisites

- **Python** 3.8+
- **Node.js** and **npm**
- **ngrok account** and authtoken (for public URL generation)
- **Python packages:**  
  `fastapi`, `uvicorn`, `passlib[bcrypt]`, `pyngrok`, `psutil`, `pydantic`, `pyAesCrypt`
- **NPM packages:**  
  Check `package.json` for React dependencies

---

## 📦 Installation

1️⃣ **Clone the repository**
```bash
git clone https://github.com/Ayu-zh/Local-Drive-X-
cd Local-Drive-X-

python -m venv .venv
# On Linux/macOS
source .venv/bin/activate
# On Windows
.venv\Scripts\activate
pip install -r requirements.txt

