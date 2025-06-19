import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import pyAesCrypt
import psutil
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext
from pyngrok import ngrok, conf
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND

# -------------------------------------------------------------
# FastAPI initialisation
# -------------------------------------------------------------
app = FastAPI(title="Secure Folder Sharing API")

# Allow CORS so that the React app (typically on http://localhost:3000) can reach the API
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],  # adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount React build static files (npm run build produces 'build' directory)
build_dir = Path(__file__).resolve().parent / "build"
if build_dir.exists():
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="static")

# -------------------------------------------------------------
# Security helpers
# -------------------------------------------------------------
security = HTTPBasic()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -------------------------------------------------------------
# Runtime configuration (kept in-memory for simplicity)
# -------------------------------------------------------------
config: dict[str, Optional[object]] = {
    "folder_path": None,          # Path to reserved folder (Path)
    "reserved_bytes": None,       # Space reserved in bytes (int)
    "password_hash": None,        # Bcrypt hash (str)
    "tunnel": None,               # Ngrok tunnel object
    "public_url": None            # Public URL for this server
}

# BUFFER_SIZE retained for backward compatibility (no encryption now)
BUFFER_SIZE = 64 * 1024

# -------------------------------------------------------------
# Utility functions
# -------------------------------------------------------------

def _require_setup():
    """Ensure /setup has been called before other endpoints."""
    if not config["folder_path"]:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Server not configured. Call /setup first.")


def _verify_password(creds: HTTPBasicCredentials):
    """Check provided HTTP Basic credentials against stored hash."""
    if not password_context.verify(creds.password, config["password_hash"]):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")


def _folder_size(path: Path) -> int:
    """Return total size of files under *path* in bytes."""
    total = 0
    for p in path.rglob('*'):
        try:
            if p.is_file():
                total += p.stat().st_size
        except FileNotFoundError:
            # File might have been deleted between listing and stat
            pass
    return total

# -------------------------------------------------------------
# API MODELS
# -------------------------------------------------------------
from pydantic import BaseModel, Field

class SetupRequest(BaseModel):
    folder: str = Field(..., description="Folder path to create / use")
    space: float = Field(..., gt=0, description="Reserved space in GB")
    password: str = Field(..., min_length=4, description="Password for encryption & auth")

class SetupResponse(BaseModel):
    url: str

# -------------------------------------------------------------
# ENDPOINTS
# -------------------------------------------------------------

@app.post("/api/setup", response_model=SetupResponse)
def setup(req: SetupRequest):
    """Initialise the server with folder, reserved space and password."""
    folder_path = Path(req.folder).expanduser().resolve()
    reserved_bytes = int(req.space * (1024 ** 3))  # convert GB → bytes

    # Check disk free space
    disk = psutil.disk_usage(str(folder_path.drive) if folder_path.drive else str(folder_path))
    if reserved_bytes > disk.free:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                            detail="Insufficient disk space for requested reservation")

    # Validate that the folder exists on disk (we are now sharing an existing folder)
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                            detail="Selected folder does not exist on server")

    # Store hashed password
    password_hash = password_context.hash(req.password)

    # Start or reuse ngrok tunnel
    # Ensure we always use the user's explicit ngrok config file
    ng_cfg = conf.PyngrokConfig(config_path=str(Path.home() / "AppData/Local/ngrok/ngrok.yml"))

        # Try to reuse existing named tunnel; if it fails we'll start a fresh one
    try:
        existing = ngrok.connect(name="share", pyngrok_config=ng_cfg)
        tunnel = existing
    except Exception:
        tunnel = ngrok.connect(name="share", pyngrok_config=ng_cfg)

    if config["tunnel"] is None:
        tunnel = ngrok.connect(name="share", pyngrok_config=ng_cfg)
        public_url = tunnel.public_url
        config.update({"tunnel": tunnel, "public_url": public_url})
    else:
        public_url = config["public_url"]

    # Save config
    config.update({
        "folder_path": folder_path,
        "reserved_bytes": reserved_bytes,
        "password_hash": password_hash,
    })

    return {"url": public_url}


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    creds: HTTPBasicCredentials = Depends(security)
):
    """Upload a file into the shared folder, enforcing reserved space (no encryption)."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    reserved: int = config["reserved_bytes"]

    # Determine size of uploaded file
    file_bytes = await file.read()
    new_file_size = len(file_bytes)

    current_size = _folder_size(folder_path)
    if current_size + new_file_size > reserved:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                            detail="Uploading this file would exceed reserved space")

    # Save to a temporary file first
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = Path(tmp.name)

    # Move the uploaded file into the destination folder
    dest_path = folder_path / file.filename
    shutil.move(str(tmp_path), dest_path)
    return {"message": "File uploaded", "filename": dest_path.name}


@app.get("/api/files")
async def list_files(creds: HTTPBasicCredentials = Depends(security)):
    """Return list of available files in the reserved folder."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    files = [f.name for f in Path(config["folder_path"]).iterdir() if f.is_file()]
    return {"files": files}


@app.get("/api/download/{filename}")
async def download_file(
    filename: str,
    creds: HTTPBasicCredentials = Depends(security)
):
    """Return the requested file if auth is valid (no decryption)."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    file_path = folder_path / filename
    if not file_path.exists():
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(file_path, filename=filename)


# -------------------------------------------------------------
# SPA fallback (serve React index.html for any other route)
@app.get("/{rest_of_path:path}", include_in_schema=False)
async def serve_spa(rest_of_path: str):
    index_file = build_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Not Found")

# -------------------------------------------------------------
# Uvicorn entrypoint when executing: python main.py
# -------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
