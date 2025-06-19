import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LinkGeneratorForm from './LinkGeneratorForm';
import EnhancedFileManager from './EnhancedFileManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><h1>Local Drive :X</h1><LinkGeneratorForm /></>} />
        <Route path="/files" element={<EnhancedFileManager />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
