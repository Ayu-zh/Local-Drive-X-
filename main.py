import os
import shutil
import tempfile
import subprocess
import threading
import time
import re
from pathlib import Path
from typing import Optional

import pyAesCrypt
import psutil
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext
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
    "tunnel_process": None,       # LocalTunnel process
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


def _start_localtunnel(port: int = 8000, subdomain: str = None) -> tuple[subprocess.Popen, str]:
    """Start LocalTunnel and return process and public URL."""
    try:
        # Find npm path to locate npx
        npm_path = subprocess.check_output(['where', 'npm'], text=True).strip().split('\n')[0]
        npm_dir = os.path.dirname(npm_path)
        
        # Look for lt in the same directory as npm
        lt_path = os.path.join(npm_dir, 'lt.cmd')
        
        if os.path.exists(lt_path):
            # Use lt directly if available
            if subdomain:
                cmd = [lt_path, '--port', str(port), '--subdomain', subdomain]
            else:
                cmd = [lt_path, '--port', str(port)]
        else:
            # Use npx as fallback
            npx_path = os.path.join(npm_dir, 'npx.cmd')
            if os.path.exists(npx_path):
                if subdomain:
                    cmd = [npx_path, 'localtunnel', '--port', str(port), '--subdomain', subdomain]
                else:
                    cmd = [npx_path, 'localtunnel', '--port', str(port)]
            else:
                # Last resort - try generic commands
                if subdomain:
                    cmd = ['npx', 'localtunnel', '--port', str(port), '--subdomain', subdomain]
                else:
                    cmd = ['npx', 'localtunnel', '--port', str(port)]
        
        # Start the process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Wait for URL to appear in output
        url = None
        start_time = time.time()
        while time.time() - start_time < 30:  # 30 second timeout
            if process.poll() is not None:
                # Process ended, check for errors
                stderr = process.stderr.read()
                if "subdomain already requested" in stderr and subdomain:
                    # Try without subdomain
                    process.terminate()
                    return _start_localtunnel(port, None)
                raise Exception(f"LocalTunnel failed: {stderr}")
            
            # Check if we have output
            try:
                line = process.stdout.readline()
                if line:
                    # Look for URL pattern
                    url_match = re.search(r'https://[a-zA-Z0-9-]+\.loca\.lt', line)
                    if url_match:
                        url = url_match.group(0)
                        break
            except:
                continue
            
            time.sleep(0.5)
        
        if not url:
            process.terminate()
            raise Exception("Failed to get LocalTunnel URL")
        
        return process, url
        
    except FileNotFoundError:
        raise Exception("LocalTunnel not found. Install with: npm install -g localtunnel")
    except Exception as e:
        raise Exception(f"Failed to start LocalTunnel: {str(e)}")


def _stop_localtunnel():
    """Stop the current LocalTunnel process."""
    if config["tunnel_process"]:
        try:
            config["tunnel_process"].terminate()
            config["tunnel_process"].wait(timeout=5)
        except:
            try:
                config["tunnel_process"].kill()
            except:
                pass
        config["tunnel_process"] = None
        config["public_url"] = None

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
    try:
        print(f"Setup request received: folder={req.folder}, space={req.space}GB")
        
        # Handle path normalization for Windows paths
        folder_str = req.folder
        if '\\\\' in folder_str:
            # Convert double backslashes to single for Path
            folder_str = folder_str.replace('\\\\', '\\')
        
        print(f"Normalized folder path: {folder_str}")
        
        try:
            folder_path = Path(folder_str).expanduser().resolve()
            print(f"Resolved folder path: {folder_path}")
        except Exception as e:
            print(f"Error resolving path: {e}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Invalid folder path: {str(e)}")
        
        # Check if path exists before trying to access it
        try:
            exists = folder_path.exists()
            is_dir = folder_path.is_dir() if exists else False
            print(f"Path exists: {exists}, is directory: {is_dir}")
        except PermissionError:
            print(f"Permission error accessing path: {folder_path}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail="Permission denied: Cannot access the specified folder")
        except Exception as e:
            print(f"Error checking path: {e}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Error accessing folder: {str(e)}")
        
        if not exists:
            print(f"Error: Folder does not exist: {folder_path}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Folder does not exist: {folder_path}")
        
        if not is_dir:
            print(f"Error: Path is not a directory: {folder_path}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Path is not a directory: {folder_path}")
        
        # Check if we have read permissions (we don't need write permissions for sharing)
        try:
            # Just list the directory to check if we can read it
            try:
                # Try to list directory contents
                contents = list(folder_path.iterdir())
                print(f"Successfully read directory contents: {folder_path}, found {len(contents)} items")
            except PermissionError:
                print(f"Permission error: Cannot read folder: {folder_path}")
                raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                    detail="Permission denied: Cannot read the specified folder")
            except Exception as e:
                print(f"Error reading directory: {e}")
                raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                    detail=f"Cannot read folder: {str(e)}")
                                    
            # Check if we have write permissions (optional, just for logging)
            try:
                # Use access() to check write permissions without actually writing
                import os
                if os.access(str(folder_path), os.W_OK):
                    print(f"Folder is writable: {folder_path}")
                else:
                    print(f"Folder is read-only: {folder_path}")
                    # We'll still allow read-only folders to be shared
            except Exception as e:
                print(f"Error checking write permissions: {e}")
                # Continue anyway, we don't need write permissions
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            print(f"Unexpected error checking folder permissions: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Error accessing folder: {str(e)}")
        
        reserved_bytes = int(req.space * (1024 ** 3))  # convert GB → bytes
        print(f"Reserved bytes: {reserved_bytes}")

        # Check disk free space
        try:
            disk = psutil.disk_usage(str(folder_path.drive) if folder_path.drive else str(folder_path))
            print(f"Disk space: free={disk.free}, total={disk.total}")
            
            if reserved_bytes > disk.free:
                print(f"Error: Insufficient disk space. Requested: {reserved_bytes}, Available: {disk.free}")
                raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                    detail=f"Insufficient disk space. Requested: {reserved_bytes/1024**3:.1f}GB, Available: {disk.free/1024**3:.1f}GB")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            print(f"Error checking disk space: {e}")
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                                detail=f"Error checking disk space: {str(e)}")
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any other exceptions
        print(f"Unexpected error in setup: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                            detail=f"Error setting up folder share: {str(e)}")

    # Store hashed password
    password_hash = password_context.hash(req.password)

    # Start LocalTunnel if not already running
    if config["tunnel_process"] is None or config["tunnel_process"].poll() is not None:
        try:
            # Stop any existing tunnel
            _stop_localtunnel()
            
            # Generate a subdomain based on folder name for consistency
            folder_name = folder_path.name.lower().replace(' ', '-').replace('_', '-')
            subdomain = f"share-{folder_name}"[:20]  # Keep it short
            
            process, public_url = _start_localtunnel(8000, subdomain)
            config.update({
                "tunnel_process": process,
                "public_url": public_url
            })
        except Exception as e:
            # Fallback to localhost if tunnel fails
            config.update({
                "tunnel_process": None,
                "public_url": "http://localhost:8000"
            })
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST,
                              detail=f"Failed to create public tunnel: {str(e)}. Install LocalTunnel with: npm install -g localtunnel")
    
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
async def list_files(creds: HTTPBasicCredentials = Depends(security), path: str = ""):
    """Return list of available files and folders in the reserved folder."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    
    # Handle subdirectory navigation
    if path:
        # Ensure path doesn't escape the reserved folder
        target_path = (folder_path / path).resolve()
        if not str(target_path).startswith(str(folder_path)):
            raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Invalid path")
        if not target_path.exists() or not target_path.is_dir():
            raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Directory not found")
        current_dir = target_path
    else:
        current_dir = folder_path
    
    # Get files and folders with metadata
    items = []
    for item in current_dir.iterdir():
        try:
            stat = item.stat()
            is_dir = item.is_dir()
            
            # Determine file type for preview capability
            file_type = "folder" if is_dir else "unknown"
            if not is_dir:
                ext = item.suffix.lower()
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                    file_type = "image"
                elif ext in ['.mp4', '.webm', '.ogg', '.mov']:
                    file_type = "video"
                elif ext in ['.mp3', '.wav', '.ogg', '.flac']:
                    file_type = "audio"
                elif ext in ['.pdf']:
                    file_type = "pdf"
                elif ext in ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js']:
                    file_type = "text"
            
            items.append({
                "name": item.name,
                "path": str(item.relative_to(folder_path)),
                "is_dir": is_dir,
                "size": stat.st_size if not is_dir else 0,
                "modified": stat.st_mtime,
                "type": file_type
            })
        except Exception as e:
            # Skip files with access issues
            continue
    
    # Calculate current path for breadcrumb navigation
    breadcrumbs = []
    if path:
        parts = Path(path).parts
        current = ""
        for i, part in enumerate(parts):
            current = str(Path(current) / part)
            breadcrumbs.append({"name": part, "path": current})
    
    # Calculate storage usage
    total_size = _folder_size(folder_path)
    reserved_bytes = config["reserved_bytes"]
    usage_percent = (total_size / reserved_bytes) * 100 if reserved_bytes > 0 else 0
    
    return {
        "items": sorted(items, key=lambda x: (not x["is_dir"], x["name"])),  # Folders first
        "current_path": path,
        "breadcrumbs": breadcrumbs,
        "storage": {
            "used": total_size,
            "total": reserved_bytes,
            "percent": min(100, usage_percent)
        }
    }


@app.get("/api/download/{file_path:path}")
async def download_file(
    file_path: str,
    creds: HTTPBasicCredentials = Depends(security)
):
    """Return the requested file if auth is valid (no decryption)."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    target_path = (folder_path / file_path).resolve()
    
    # Security check: ensure the path is within the shared folder
    if not str(target_path).startswith(str(folder_path)):
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Invalid file path")
    
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(target_path, filename=target_path.name)


@app.get("/api/preview/{file_path:path}")
async def preview_file(
    file_path: str,
    creds: HTTPBasicCredentials = Depends(security)
):
    """Return the file for preview with appropriate content headers."""
    _require_setup()
    _verify_password(creds)

    folder_path: Path = config["folder_path"]
    target_path = (folder_path / file_path).resolve()
    
    # Security check: ensure the path is within the shared folder
    if not str(target_path).startswith(str(folder_path)):
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Invalid file path")
    
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="File not found")
    
    # For preview, we don't set the content-disposition header to attachment
    # This allows the browser to display the content inline
    return FileResponse(
        target_path,
        filename=target_path.name,
        content_disposition_type="inline"
    )


# -------------------------------------------------------------
# SPA fallback (serve React index.html for any other route)
@app.get("/{rest_of_path:path}", include_in_schema=False)
async def serve_spa(rest_of_path: str):
    index_file = build_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Not Found")

# -------------------------------------------------------------
# Cleanup handler
# -------------------------------------------------------------
import atexit

def cleanup():
    """Clean up resources on app shutdown."""
    _stop_localtunnel()

atexit.register(cleanup)

# -------------------------------------------------------------
# Exception handler for better error responses
# -------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all exceptions and return JSON instead of HTML error pages."""
    from fastapi.responses import JSONResponse
    
    status_code = 500
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
    
    # Log the error
    print(f"Error handling request {request.url}: {str(exc)}")
    import traceback
    traceback.print_exc()
    
    # Return JSON response
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)}
    )

# -------------------------------------------------------------
# Uvicorn entrypoint when executing: python main.py
# -------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    import socket
    
    def is_port_in_use(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0
    
    try:
        # Try port 8000 first, then try other ports if 8000 is in use
        port = 8000
        max_port = 8010  # Try up to port 8010
        
        while port <= max_port:
            if is_port_in_use(port):
                print(f"Port {port} is already in use, trying next port...")
                port += 1
            else:
                try:
                    print(f"Starting server on port {port}...")
                    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
                    break
                except Exception as e:
                    print(f"Failed to start server on port {port}: {e}")
                    port += 1
        
        if port > max_port:
            print("No available ports found. Please free up a port and try again.")
            import sys
            sys.exit(1)
    finally:
        cleanup()
