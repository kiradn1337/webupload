import React, { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { api } from '../api';
import { 
  ArrowUpTrayIcon, 
  DocumentIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useDropzone } from 'react-dropzone';

// Format bytes to human readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

const UploadPage: React.FC = () => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique ID for each upload
  const generateId = () => `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Request pre-signed URL and upload directly to S3
  const uploadToS3 = async (file: File, uploadId: string) => {
    try {
      // Step 1: Request pre-signed URL from our API
      const presignResponse = await api.post('/files/presign', {
        filename: file.name,
        contentType: file.type,
        size: file.size
      });

      const { presignedUrl, fileId } = presignResponse.data;

      // Step 2: Upload directly to S3 with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadingFiles(files => 
            files.map(f => 
              f.id === uploadId 
                ? { ...f, progress: percentComplete } 
                : f
            )
          );
        }
      });

      return new Promise<string>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadingFiles(files => 
              files.map(f => 
                f.id === uploadId 
                  ? { ...f, status: 'processing' } 
                  : f
              )
            );
            resolve(fileId);
          } else {
            setUploadingFiles(files => 
              files.map(f => 
                f.id === uploadId 
                  ? { ...f, status: 'error', error: 'Upload failed' } 
                  : f
              )
            );
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          setUploadingFiles(files => 
            files.map(f => 
              f.id === uploadId 
                ? { ...f, status: 'error', error: 'Network error' } 
                : f
            )
          );
          reject(new Error('Network error'));
        });

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      setUploadingFiles(files => 
        files.map(f => 
          f.id === uploadId 
            ? { ...f, status: 'error', error: (error as Error).message || 'Upload failed' } 
            : f
        )
      );
      throw error;
    }
  };

  // Poll for file processing status
  const pollFileStatus = async (fileId: string, uploadId: string) => {
    try {
      let status = 'processing';
      let attempts = 0;
      const maxAttempts = 30;
      
      while (status === 'processing' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const response = await api.get(`/files/${fileId}`);
        status = response.data.file.status;
        attempts++;
      }

      setUploadingFiles(files => 
        files.map(f => 
          f.id === uploadId 
            ? { ...f, status: 'complete' } 
            : f
        )
      );

      // Refresh files list in cache
      queryClient.invalidateQueries('recentFiles');
      queryClient.invalidateQueries('userInfo');
      
      return status;
    } catch (error) {
      setUploadingFiles(files => 
        files.map(f => 
          f.id === uploadId 
            ? { ...f, status: 'error', error: 'Failed to get processing status' } 
            : f
        )
      );
      throw error;
    }
  };

  // Handle file upload
  const uploadMutation = useMutation(
    async ({ file, id }: { file: File; id: string }) => {
      const fileId = await uploadToS3(file, id);
      return await pollFileStatus(fileId, id);
    }
  );

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => {
      const id = generateId();
      return {
        id,
        file,
        progress: 0,
        status: 'uploading' as const
      };
    });
    
    setUploadingFiles(prev => [...prev, ...newFiles]);
    
    // Start uploading each file
    newFiles.forEach(fileObj => {
      uploadMutation.mutate({ file: fileObj.file, id: fileObj.id });
    });
  }, [uploadMutation]);
  
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => setDragActive(false)
  });

  // Remove file from list
  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(file => file.id !== id));
  };

  // Handle click on the dropzone to open file dialog
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Files</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload your files securely. All files will be scanned for viruses.
        </p>
      </header>

      {/* Dropzone */}
      <div 
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-700'}`}
      >
        <input 
          {...getInputProps()}
          ref={fileInputRef}
          className="hidden" 
        />
        <div className="mx-auto flex justify-center">
          <ArrowUpTrayIcon 
            className={`h-12 w-12 ${
              dragActive ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
            }`} 
          />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
          Drag & drop files here, or click to select files
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          All files are scanned for viruses before being made available
        </p>
        <button
          type="button"
          onClick={openFileDialog}
          className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Select Files
        </button>
      </div>

      {/* Upload list */}
      {uploadingFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Upload Progress
            </h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {uploadingFiles.map((file) => (
              <li key={file.id} className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <DocumentIcon className="h-6 w-6 text-gray-500" />
                      </div>
                    </div>
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.file.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        {formatBytes(file.file.size)}
                        {file.status === 'uploading' && (
                          <span className="ml-2">{file.progress}%</span>
                        )}
                        {file.status === 'processing' && (
                          <span className="ml-2">Processing...</span>
                        )}
                        {file.status === 'complete' && (
                          <span className="ml-2 flex items-center text-green-600 dark:text-green-400">
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Complete
                          </span>
                        )}
                        {file.status === 'error' && (
                          <span className="ml-2 flex items-center text-red-600 dark:text-red-400">
                            <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                            {file.error || 'Error'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="ml-4 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                {file.status === 'uploading' && (
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
