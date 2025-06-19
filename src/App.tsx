import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LinkGeneratorForm from './LinkGeneratorForm';
import FileManagementPage from './FileManagementPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><h1>Link Generator</h1><LinkGeneratorForm /></>} />
        <Route path="/files" element={<FileManagementPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
