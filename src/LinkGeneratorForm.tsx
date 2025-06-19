import React, { useState } from 'react';

const LinkGeneratorForm = () => {
  const [folderPath, setFolderPath] = useState('');
  const [spaceReserved, setSpaceReserved] = useState('6');
  const [password, setPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [error, setError] = useState('');
  const [responseUrl, setResponseUrl] = useState('');

  // Folder path will be typed / pasted by the user (no browser picker needed)
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFolderPath(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== retypePassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folderPath, space: Number(spaceReserved), password })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      setResponseUrl(data.url);
      // Redirect host to the public File Manager page so it can be shared immediately
      window.location.href = `${data.url}/files`;
      
      setError('');
    } catch (err) {
      setError('Failed to generate link');
    }
  };

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      maxWidth: '500px',
      margin: '20px auto'
    }}>
      <p style={{fontSize:'0.9rem', color:'#555'}}>Works best in Chrome/Edge.</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Folder to share (absolute path on this PC):</label>
          <input
            type="text"
            value={folderPath}
            onChange={handleFolderChange}
            required
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '5px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Space reserved (GB):</label>
          <input
            type="number"
            value={spaceReserved}
            onChange={(e) => setSpaceReserved(e.target.value)}
            min="1"
            required
            style={inputStyle}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Retype password:</label>
          <input
            type="password"
            value={retypePassword}
            onChange={(e) => setRetypePassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        
        {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
        
        <button type="submit" style={{
          padding: '10px 15px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Generate link
        </button>
      </form>
      
      {responseUrl && (
        <div style={{ marginTop: '20px' }}>
          <h3>Generated Link:</h3>
          <a href={responseUrl} target="_blank" rel="noopener noreferrer">
            {responseUrl}
          </a>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  marginTop: '5px',
  border: '1px solid #ddd',
  borderRadius: '4px'
};

export default LinkGeneratorForm;
