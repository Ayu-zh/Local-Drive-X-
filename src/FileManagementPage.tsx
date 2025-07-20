import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, IconButton, Menu, MenuItem,
  List, ListItem, ListItemIcon, ListItemText, ListItemButton, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  Breadcrumbs, Link, Tooltip, CircularProgress, Card, CardContent
} from '@mui/material';
import {
  Folder as FolderIcon, InsertDriveFile as FileIcon, Image as ImageIcon,
  PictureAsPdf as PdfIcon, AudioFile as AudioIcon, VideoFile as VideoIcon,
  Description as TextIcon, Download as DownloadIcon, Info as InfoIcon,
  Visibility as PreviewIcon, ArrowUpward as UploadIcon, Home as HomeIcon,
  MoreVert as MoreVertIcon, GridView as GridViewIcon, ViewList as ListViewIcon,
  Storage as StorageIcon, Share as ShareIcon, ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';

// Define interfaces for our data types
interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  type: string;
}

interface StorageInfo {
  used: number;
  total: number;
  percent: number;
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface FilesResponse {
  items: FileItem[];
  current_path: string;
  breadcrumbs: BreadcrumbItem[];
  storage: StorageInfo;
}

const FileManagementPage: React.FC = () => {
  // State variables
  const [password, setPassword] = useState<string>('');
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [items, setItems] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [storage, setStorage] = useState<StorageInfo>({ used: 0, total: 0, percent: 0 });
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Fetch files from the API
  const fetchFiles = async (pwd: string, path: string = '') => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        headers: {
          Authorization: 'Basic ' + btoa(`${pwd}:${pwd}`),
        },
      });
      if (!resp.ok) throw new Error('Auth failed');
      const data: FilesResponse = await resp.json();
      setItems(data.items);
      setCurrentPath(data.current_path);
      setBreadcrumbs(data.breadcrumbs);
      setStorage(data.storage);
      setAuthenticated(true);
      setMessage('');
    } catch (err) {
      setMessage('Failed to load files. Please check your connection.');
      if (!authenticated) {
        setMessage('Authentication failed. Please check your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle login form submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) fetchFiles(password);
  };

  // Handle file upload via dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (!authenticated || acceptedFiles.length === 0) return;
      
      setLoading(true);
      let successCount = 0;
      let failCount = 0;
      
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const resp = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + btoa(`${password}:${password}`),
            },
            body: formData,
          });
          
          if (resp.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        setMessage(`${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`);
        fetchFiles(password, currentPath);
      } else {
        setMessage('Upload failed');
      }
      
      setLoading(false);
    }
  });

  // Handle manual file upload button click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle manual file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${password}:${password}`),
          },
          body: formData,
        });
        
        if (resp.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }
    
    if (successCount > 0) {
      setMessage(`${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`);
      fetchFiles(password, currentPath);
    } else {
      setMessage('Upload failed');
    }
    
    setLoading(false);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle folder navigation
  const navigateToFolder = (path: string) => {
    fetchFiles(password, path);
  };

  // Handle file download
  const handleDownload = async (item: FileItem) => {
    try {
      const resp = await fetch(`/api/download/${item.path}`, {
        headers: { Authorization: 'Basic ' + btoa(`${password}:${password}`) },
      });
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('Download failed');
    }
  };

  // Handle file preview
  const handlePreview = (item: FileItem) => {
    setSelectedItem(item);
    setPreviewOpen(true);
  };

  // Handle file info dialog
  const handleInfo = (item: FileItem) => {
    setSelectedItem(item);
    setInfoOpen(true);
  };

  // Handle share dialog
  const handleShare = () => {
    // Get the current URL and replace the path
    const url = window.location.href;
    setShareUrl(url);
    setShareOpen(true);
  };

  // Handle context menu open
  const handleContextMenu = (event: React.MouseEvent, item: FileItem) => {
    event.preventDefault();
    setSelectedItem(item);
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Handle context menu actions
  const handleContextMenuAction = (action: string) => {
    if (!selectedItem) return;
    
    switch (action) {
      case 'download':
        handleDownload(selectedItem);
        break;
      case 'preview':
        handlePreview(selectedItem);
        break;
      case 'info':
        handleInfo(selectedItem);
        break;
      default:
        break;
    }
    
    handleContextMenuClose();
  };

  // Copy share URL to clipboard
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setMessage('URL copied to clipboard');
  };

  // Get icon for file type
  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) return <FolderIcon sx={{ color: '#FFC107' }} />;
    
    switch (item.type) {
      case 'image':
        return <ImageIcon sx={{ color: '#4CAF50' }} />;
      case 'pdf':
        return <PdfIcon sx={{ color: '#F44336' }} />;
      case 'audio':
        return <AudioIcon sx={{ color: '#9C27B0' }} />;
      case 'video':
        return <VideoIcon sx={{ color: '#2196F3' }} />;
      case 'text':
        return <TextIcon sx={{ color: '#607D8B' }} />;
      default:
        return <FileIcon sx={{ color: '#757575' }} />;
    }
  };

  // Render file preview content
  const renderPreviewContent = () => {
    if (!selectedItem) return null;
    
    switch (selectedItem.type) {
      case 'image':
        return (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <img 
              src={`/api/preview/${selectedItem.path}`} 
              alt={selectedItem.name}
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
          </Box>
        );
      case 'pdf':
        return (
          <Box sx={{ height: '70vh', width: '100%' }}>
            <iframe
              src={`/api/preview/${selectedItem.path}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={selectedItem.name}
            />
          </Box>
        );
      case 'video':
        return (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <video controls style={{ maxWidth: '100%', maxHeight: '70vh' }}>
              <source src={`/api/preview/${selectedItem.path}`} />
              Your browser does not support the video tag.
            </video>
          </Box>
        );
      case 'audio':
        return (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <audio controls style={{ width: '100%' }}>
              <source src={`/api/preview/${selectedItem.path}`} />
              Your browser does not support the audio tag.
            </audio>
          </Box>
        );
      default:
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography>Preview not available for this file type</Typography>
            <Button 
              variant="contained" 
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload(selectedItem)}
              sx={{ mt: 2 }}
            >
              Download Instead
            </Button>
          </Box>
        );
    }
  };

  // Render list view
  const renderListView = () => (
    <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
      {items.map((item) => (
        <ListItem
          key={item.path}
          disablePadding
          secondaryAction={
            <IconButton edge="end" onClick={(e) => handleContextMenu(e, item)}>
              <MoreVertIcon />
            </IconButton>
          }
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <ListItemButton
            onClick={() => item.is_dir ? navigateToFolder(item.path) : handlePreview(item)}
          >
            <ListItemIcon>
              {getFileIcon(item)}
            </ListItemIcon>
            <ListItemText 
              primary={item.name} 
              secondary={
                !item.is_dir ? 
                `${formatBytes(item.size)} • ${format(new Date(item.modified * 1000), 'MMM d, yyyy')}` : 
                'Folder'
              } 
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );

  // Render grid view
  const renderGridView = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2, p: 2 }}>
      {items.map((item) => (
        <Card 
          key={item.path}
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            p: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }
          }}
          onClick={() => item.is_dir ? navigateToFolder(item.path) : handlePreview(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            {getFileIcon(item)}
          </Box>
          <Typography 
            variant="body2" 
            align="center" 
            sx={{ 
              wordBreak: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.2em',
              height: '2.4em'
            }}
          >
            {item.name}
          </Typography>
          {!item.is_dir && (
            <Typography variant="caption" color="text.secondary">
              {formatBytes(item.size)}
            </Typography>
          )}
        </Card>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">Local Drive (X:)</Typography>
        {authenticated && (
          <Box>
            <Tooltip title="Upload">
              <IconButton color="inherit" onClick={handleUploadClick}>
                <UploadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton color="inherit" onClick={handleShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={viewMode === 'list' ? 'Grid View' : 'List View'}>
              <IconButton 
                color="inherit" 
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              >
                {viewMode === 'list' ? <GridViewIcon /> : <ListViewIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Login Form */}
      {!authenticated && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
            <Typography variant="h6" gutterBottom>Use Drive</Typography>
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                type="password"
                label="Enter password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <Button 
                type="submit" 
                variant="contained" 
                fullWidth 
                sx={{ mt: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Let\'s Go'}
              </Button>
              {message && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {message}
                </Typography>
              )}
            </form>
          </Paper>
        </Box>
      )}

      {/* File Manager */}
      {authenticated && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          {/* Storage Usage */}
          <Paper sx={{ m: 2, p: 2 }}>
            <Typography variant="body2" gutterBottom>
              {formatBytes(storage.used)} of {formatBytes(storage.total)} used ({storage.percent.toFixed(1)}%)
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={storage.percent} 
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Paper>
          
          {/* Breadcrumbs */}
          <Paper sx={{ mx: 2, p: 1.5 }}>
            <Breadcrumbs separator="›">
              <Link 
                component="button"
                underline="hover"
                sx={{ display: 'flex', alignItems: 'center' }}
                onClick={() => navigateToFolder('')}
              >
                <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Home
              </Link>
              {breadcrumbs.map((crumb, index) => (
                <Link
                  key={crumb.path}
                  component="button"
                  underline="hover"
                  onClick={() => navigateToFolder(crumb.path)}
                >
                  {crumb.name}
                </Link>
              ))}
            </Breadcrumbs>
          </Paper>
          
          {/* File List */}
          <Paper 
            sx={{ 
              m: 2, 
              flexGrow: 1, 
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              multiple
            />
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                <CircularProgress />
              </Box>
            ) : items.length > 0 ? (
              viewMode === 'list' ? renderListView() : renderGridView()
            ) : (
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  flexGrow: 1,
                  p: 4,
                  textAlign: 'center',
                  bgcolor: isDragActive ? 'action.hover' : 'transparent'
                }}
              >
                <StorageIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">
                  {isDragActive ? 'Drop files here' : 'No files in this folder'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {isDragActive 
                    ? 'Files will be uploaded to the current folder' 
                    : 'Drag and drop files here or use the upload button'
                  }
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={handleUploadClick}
                  sx={{ mt: 2 }}
                >
                  Upload Files
                </Button>
              </Box>
            )}
          </Paper>
          
          {/* Status Message */}
          {message && (
            <Paper sx={{ m: 2, p: 2 }}>
              <Typography>{message}</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {selectedItem && !selectedItem.is_dir && (
          <MenuItem onClick={() => handleContextMenuAction('download')}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {selectedItem && !selectedItem.is_dir && ['image', 'pdf', 'audio', 'video'].includes(selectedItem.type) && (
          <MenuItem onClick={() => handleContextMenuAction('preview')}>
            <ListItemIcon>
              <PreviewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Preview</ListItemText>
          </MenuItem>
        )}
        {selectedItem && (
          <MenuItem onClick={() => handleContextMenuAction('info')}>
            <ListItemIcon>
              <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Info</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedItem?.name}
        </DialogTitle>
        <DialogContent dividers>
          {renderPreviewContent()}
        </DialogContent>
        <DialogActions>
          {selectedItem && !selectedItem.is_dir && (
            <Button 
              startIcon={<DownloadIcon />}
              onClick={() => selectedItem && handleDownload(selectedItem)}
            >
              Download
            </Button>
          )}
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Info Dialog */}
      <Dialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>File Information</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <List dense>
              <ListItem>
                <ListItemText primary="Name" secondary={selectedItem.name} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Type" secondary={selectedItem.is_dir ? 'Folder' : selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)} />
              </ListItem>
              {!selectedItem.is_dir && (
                <ListItem>
                  <ListItemText primary="Size" secondary={formatBytes(selectedItem.size)} />
                </ListItem>
              )}
              <ListItem>
                <ListItemText 
                  primary="Modified" 
                  secondary={format(new Date(selectedItem.modified * 1000), 'PPpp')} 
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="Path" secondary={selectedItem.path} />
              </ListItem>
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Share this folder</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Share this link with others to give them access to this folder:
          </Typography>
          <TextField
            fullWidth
            value={shareUrl}
            variant="outlined"
            InputProps={{
              readOnly: true,
            }}
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Note: They will need the password to access the files.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={copyShareUrl}>Copy Link</Button>
          <Button onClick={() => setShareOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileManagementPage;