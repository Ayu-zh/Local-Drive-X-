import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, InputAdornment,
  CircularProgress, Alert, Stepper, Step, StepLabel, Grid,
  IconButton
} from '@mui/material';
import {
  Folder as FolderIcon, Lock as LockIcon, Storage as StorageIcon,
  Link as LinkIcon, ContentCopy as CopyIcon
} from '@mui/icons-material';

const LinkGeneratorForm: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [folderPath, setFolderPath] = useState('C:\\temp');
  const [spaceReserved, setSpaceReserved] = useState('6');
  const [password, setPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseUrl, setResponseUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Handle folder path change
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFolderPath(e.target.value);
  };

  // Handle next step
  const handleNext = () => {
    // Validate current step
    if (activeStep === 0 && !folderPath) {
      setError('Please enter a folder path');
      return;
    }
    
    if (activeStep === 1) {
      if (!spaceReserved || parseFloat(spaceReserved) <= 0) {
        setError('Please enter a valid space value');
        return;
      }
    }
    
    if (activeStep === 2) {
      if (!password) {
        setError('Please enter a password');
        return;
      }
      
      if (password !== retypePassword) {
        setError('Passwords do not match');
        return;
      }
      
      // Submit the form
      handleSubmit();
      return;
    }
    
    setError('');
    setActiveStep((prevStep) => prevStep + 1);
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError('');
  };

  // Handle form submission
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Validate folder path format
      if (!folderPath.match(/^[a-zA-Z]:\\/) && !folderPath.startsWith('/')) {
        throw new Error('Please enter a valid absolute path (e.g., C:\\Folder or /home/user/folder)');
      }
      
      // Normalize path - replace single backslashes with double backslashes for JSON
      let normalizedPath = folderPath;
      if (normalizedPath.includes('\\')) {
        // Ensure path has double backslashes for JSON
        normalizedPath = normalizedPath.replace(/\\/g, '\\\\');
      }
      
      console.log('Submitting form with data:', { 
        folder: normalizedPath, 
        space: Number(spaceReserved)
      });
      
      // Use relative URL to work with the proxy setting
      const apiUrl = '/api/setup';
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          folder: normalizedPath, 
          space: Number(spaceReserved), 
          password 
        })
      });

      console.log('Response status:', response.status);
      
      // Get response as text first
      const responseText = await response.text();
      console.log('Response text preview:', responseText.substring(0, 100));
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        
        // Check for common HTML error patterns
        if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html>')) {
          if (responseText.includes('ENOENT')) {
            throw new Error('Folder not found. Please check if the path exists and is accessible.');
          } else if (responseText.includes('permission denied')) {
            throw new Error('Permission denied. Please check folder permissions.');
          } else {
            throw new Error('Server error. Please check if the folder path exists and is accessible.');
          }
        } else {
          throw new Error(`Invalid response format: ${responseText.substring(0, 50)}...`);
        }
      }
      
      if (!response.ok) {
        throw new Error(data.detail || `API error: ${response.status}`);
      }
      
      if (!data.url) {
        throw new Error('Invalid response: missing URL');
      }
      
      console.log('Success! URL:', data.url);
      setResponseUrl(`${data.url}/files`);
      setActiveStep(3); // Move to success step
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(responseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open the generated link
  const openLink = () => {
    window.location.href = responseUrl;
  };

  // Steps content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Select Location
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the folder path you want to share
            </Typography>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Folder Path"
                variant="outlined"
                value={folderPath}
                onChange={handleFolderChange}
                placeholder="C:\\Users\\YourName\\Documents"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FolderIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Enter a valid folder path that exists on this computer. For example:
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => setFolderPath('C:\\temp')}
                  sx={{ mr: 1, mb: 1 }}
                >
                  Temp Folder
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => setFolderPath('C:\\Users\\Public')}
                  sx={{ mr: 1, mb: 1 }}
                >
                  Public Folder
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => setFolderPath('C:\\new')}
                  sx={{ mb: 1 }}
                >
                  C:\\new
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Make sure the folder exists and you have permission to access it.
                Try creating a new folder like "C:\\temp" or "C:\\new" if you're having issues.
              </Typography>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Set Storage Space
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Specify how much storage space to reserve for this share
            </Typography>
            <TextField
              fullWidth
              label="Space Reserved"
              variant="outlined"
              type="number"
              value={spaceReserved}
              onChange={(e) => setSpaceReserved(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StorageIcon />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">GB</InputAdornment>,
              }}
              inputProps={{ min: "1", step: "1" }}
              required
              sx={{ mt: 2 }}
            />
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Set Password
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Create a password to secure your shared folder
            </Typography>
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mt: 2 }}
            />
            <TextField
              fullWidth
              label="Retype Password"
              type="password"
              variant="outlined"
              value={retypePassword}
              onChange={(e) => setRetypePassword(e.target.value)}
              required
              sx={{ mt: 2 }}
            />
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom color="primary">
              Your Drive is Ready!
            </Typography>
            <Typography variant="body1" gutterBottom>
              Share this link with others:
            </Typography>
            <Paper
              sx={{
                p: 2,
                mt: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'action.hover',
              }}
            >
              <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography
                variant="body2"
                sx={{ flexGrow: 1, wordBreak: 'break-all' }}
              >
                {responseUrl}
              </Typography>
              <IconButton onClick={copyToClipboard} size="small">
                <CopyIcon fontSize="small" />
              </IconButton>
            </Paper>
            {copied && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Link copied to clipboard!
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Remember to share the password separately for security.
            </Typography>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        maxWidth: 600,
        mx: 'auto',
        p: 3,
        borderRadius: 2,
      }}
    >
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        <Step>
          <StepLabel>Location</StepLabel>
        </Step>
        <Step>
          <StepLabel>Storage</StepLabel>
        </Step>
        <Step>
          <StepLabel>Security</StepLabel>
        </Step>
        <Step>
          <StepLabel>Share</StepLabel>
        </Step>
      </Stepper>

      {getStepContent(activeStep)}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          disabled={activeStep === 0 || activeStep === 3 || loading}
          onClick={handleBack}
        >
          Back
        </Button>
        <Box>
          {activeStep === 3 ? (
            <Button
              variant="contained"
              color="primary"
              onClick={openLink}
            >
              Open Drive
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {activeStep === 2 ? 'Generate Link' : 'Next'}
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default LinkGeneratorForm;