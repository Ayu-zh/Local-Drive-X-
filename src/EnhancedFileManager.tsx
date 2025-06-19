import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { useDropzone } from 'react-dropzone';
import classNames from 'classnames';

interface FileMeta {
  name: string;
  size: number; // bytes
  modified: string; // ISO date string
  isFolder: boolean;
}

interface MetadataResponse {
  used: number; // bytes
  reserved: number; // bytes
  files: FileMeta[];
}

const EnhancedFileManager: React.FC = () => {
  const [password, setPassword] = useState<string>('');
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(''); // "" denotes root
  const [usedStorage, setUsedStorage] = useState<number>(0);
  const [reservedStorage, setReservedStorage] = useState<number>(0);
  const [message, setMessage] = useState<string>('');

  /**
   * utils
   */
  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const authHeader = useMemo(() => ({
    Authorization: 'Basic ' + btoa(`${password}:${password}`),
  }), [password]);

  /**
   * API calls
   */
  const fetchMetadata = useCallback(async (path: string) => {
    try {
      const params = new URLSearchParams();
      if (path) params.set('path', path);
      const resp = await fetch(`/api/files/metadata?${params.toString()}`, { headers: authHeader });
      if (!resp.ok) throw new Error('Auth failed');
      const data: MetadataResponse = await resp.json();
      setFiles(data.files);
      setUsedStorage(data.used);
      setReservedStorage(data.reserved);
      setAuthenticated(true);
    } catch (err) {
      setMessage('Failed to fetch files. Check credentials.');
      setAuthenticated(false);
    }
  }, [authHeader]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) fetchMetadata('');
  };

  const handleFolderClick = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const navigateBreadcrumb = (index: number) => {
    // index 0 is Home
    const segments = currentPath.split('/').filter(Boolean);
    const targetPath = segments.slice(0, index).join('/');
    setCurrentPath(targetPath);
  };

  useEffect(() => {
    if (authenticated) {
      fetchMetadata(currentPath);
    }
    
  }, [currentPath]);

  /**
   * Downloads
   */
  const handleDownload = async (fileName: string) => {
    try {
      const pathParam = currentPath ? `${currentPath}/${fileName}` : fileName;
      const resp = await fetch(`/api/download/${encodeURIComponent(pathParam)}`, { headers: authHeader });
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('Download failed');
    }
  };

  /**
   * Upload via drag & drop
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const pathParam = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      try {
        const resp = await fetch(`/api/upload${pathParam}`, {
          method: 'POST',
          headers: authHeader,
          body: formData,
        });
        if (!resp.ok) throw new Error('Upload failed');
        fetchMetadata(currentPath);
      } catch {
        setMessage('Upload failed');
      }
    });
  }, [authHeader, currentPath, fetchMetadata]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  /**
   * Breadcrumbs
   */
  const breadcrumbs = useMemo(() => ['Home', ...currentPath.split('/').filter(Boolean)], [currentPath]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">File Manager</h2>

      {!authenticated && (
        <form onSubmit={handleLogin} className="space-y-4 max-w-sm">
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Login
          </button>
        </form>
      )}

      {authenticated && (
        <>
          {/* Storage indicator */}
          <div className="mb-4 text-sm text-gray-700">
            Storage: {formatMB(usedStorage)} MB / {formatMB(reservedStorage)} MB
          </div>

          {/* Breadcrumbs */}
          <nav className="mb-4 text-sm text-gray-600">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx}>
                {idx > 0 && <span className="mx-1">&gt;</span>}
                <button
                  className={classNames('hover:underline', { 'font-medium text-gray-900': idx === breadcrumbs.length - 1 })}
                  onClick={() => navigateBreadcrumb(idx)}
                  disabled={idx === breadcrumbs.length - 1}
                >
                  {crumb}
                </button>
              </span>
            ))}
          </nav>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={classNames(
              'border-2 border-dashed rounded p-6 mb-4 flex items-center justify-center cursor-pointer transition-colors',
              {
                'border-blue-400 bg-blue-50': isDragActive,
                'border-gray-300': !isDragActive,
              }
            )}
          >
            <input {...getInputProps()} />
            {isDragActive ? <p>Drop files here...</p> : <p>Drag & drop files here, or click to select files</p>}
          </div>

          {/* File table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size (MB)</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr
                    key={file.name}
                    className="hover:bg-gray-100 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap flex items-center space-x-2">
                      {file.isFolder ? (
                        <svg
                          className="w-5 h-5 text-yellow-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      ) : (
                        <div className="w-5 h-5">
                          <FileIcon
                            extension={file.name.split('.').pop() || ''}
                            {...(defaultStyles as any)[file.name.split('.').pop() || 'txt']}
                          />
                        </div>
                      )}
                      {file.isFolder ? (
                        <button className="text-blue-600 hover:underline" onClick={() => handleFolderClick(file.name)}>
                          {file.name}
                        </button>
                      ) : (
                        <span>{file.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.modified)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatMB(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!file.isFolder && (
                        <button
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => handleDownload(file.name)}
                        >
                          Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {message && <p className="mt-4 text-red-500">{message}</p>}
    </div>
  );
};

export default EnhancedFileManager;
