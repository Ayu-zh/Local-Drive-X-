import React, { useState, useEffect } from 'react';

interface FileItem {
  name: string;
}

const FileManagementPage: React.FC = () => {
  const [password, setPassword] = useState<string>('');
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');

  const fetchFiles = async (pwd: string) => {
    try {
      const resp = await fetch('/api/files', {
        headers: {
          Authorization: 'Basic ' + btoa(`${pwd}:${pwd}`),
        },
      });
      if (!resp.ok) throw new Error('Auth failed');
      const data = await resp.json();
      setFiles(data.files.map((f: string) => ({ name: f })));
      setAuthenticated(true);
    } catch (err) {
      setMessage('Authentication failed.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) fetchFiles(password);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${password}:${password}`),
        },
        body: formData,
      });
      if (!resp.ok) throw new Error('Upload failed');
      setMessage('File uploaded');
      fetchFiles(password);
    } catch (err) {
      setMessage('Upload failed');
    }
  };

  // Download a file using fetch so we can attach auth header
  const handleDownload = async (fname: string) => {
    try {
      const resp = await fetch(`/api/download/${fname}`, {
        headers: { Authorization: 'Basic ' + btoa(`${password}:${password}`) },
      });
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('Download failed');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>File Manager</h2>
      {!authenticated && (
        <form onSubmit={handleLogin} style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '8px', width: '100%', marginBottom: '10px' }}
          />
          <button type="submit" style={{ padding: '10px 15px' }}>Login</button>
        </form>
      )}
      {authenticated && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <button onClick={handleUpload} style={{ marginLeft: '10px' }}>Upload</button>
          </div>
          <h3>Files</h3>
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                <button style={{border:'none', background:'none', color:'blue', cursor:'pointer', textDecoration:'underline'}} onClick={() => handleDownload(f.name)}>
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
};

export default FileManagementPage;
