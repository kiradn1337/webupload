import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  ArrowDownTrayIcon,
  TrashIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

// Format bytes to human readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Component for displaying file icon based on MIME type
const FileIcon: React.FC<{ mimeType: string }> = ({ mimeType }) => {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  } else if (mimeType.startsWith('video/')) {
    return (
      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    );
  } else if (mimeType.startsWith('audio/')) {
    return (
      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  } else if (mimeType.startsWith('application/pdf')) {
    return (
      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  } else {
    return (
      <DocumentDuplicateIcon className="h-12 w-12 text-gray-400" />
    );
  }
};

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let bgColor, icon, text;

  switch (status) {
    case 'clean':
      bgColor = 'bg-green-100 text-green-800';
      icon = <ShieldCheckIcon className="h-5 w-5 mr-1.5 text-green-500" />;
      text = 'Clean';
      break;
    case 'quarantined':
      bgColor = 'bg-red-100 text-red-800';
      icon = <ShieldExclamationIcon className="h-5 w-5 mr-1.5 text-red-500" />;
      text = 'Quarantined';
      break;
    case 'processing':
      bgColor = 'bg-yellow-100 text-yellow-800';
      icon = <ClockIcon className="h-5 w-5 mr-1.5 text-yellow-500" />;
      text = 'Processing';
      break;
    default:
      bgColor = 'bg-gray-100 text-gray-800';
      icon = <ClockIcon className="h-5 w-5 mr-1.5 text-gray-500" />;
      text = status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${bgColor}`}>
      {icon}
      {text}
    </span>
  );
};

const FileDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Fetch file details
  const { data: fileDetails, isLoading, error } = useQuery(
    ['fileDetails', id],
    () => api.get(`/files/${id}`).then(res => res.data.file),
    {
      onSuccess: (data) => {
        setNewFileName(data.original_name);
      }
    }
  );

  // Get download URL
  const getDownloadUrl = useMutation(
    () => api.get(`/files/${id}/download`).then(res => res.data.downloadUrl),
    {
      onSuccess: (url) => {
        window.open(url, '_blank');
      }
    }
  );

  // Delete file
  const deleteFile = useMutation(
    () => api.delete(`/files/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('recentFiles');
        queryClient.invalidateQueries('userInfo');
        navigate('/files');
      }
    }
  );

  // Rename file
  const renameFile = useMutation(
    (newName: string) => api.patch(`/files/${id}`, { name: newName }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fileDetails', id]);
        queryClient.invalidateQueries('recentFiles');
        setIsRenameModalOpen(false);
      }
    }
  );

  // Handle download
  const handleDownload = () => {
    getDownloadUrl.mutate();
  };

  // Handle rename
  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      renameFile.mutate(newFileName);
    }
  };

  // Handle delete
  const handleDelete = () => {
    deleteFile.mutate();
  };

  // Determine if file is viewable
  const isViewable = (mimeType: string): boolean => {
    return mimeType?.startsWith('image/') || 
           mimeType?.startsWith('application/pdf') ||
           mimeType?.startsWith('text/') ||
           mimeType === 'application/json';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !fileDetails) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mt-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading file details</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              The file may have been deleted or you don't have permission to view it.
            </p>
            <div className="mt-4">
              <div className="-mx-2 -my-1.5 flex">
                <button
                  type="button"
                  onClick={() => navigate('/files')}
                  className="bg-red-50 dark:bg-red-900/40 px-3 py-2 rounded-md text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100"
                >
                  Go back to files
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-2xl">
          {fileDetails.original_name}
        </h1>
        
        <div className="flex space-x-3">
          {fileDetails.status === 'clean' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={getDownloadUrl.isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {getDownloadUrl.isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                  Download
                </>
              )}
            </button>
          )}
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRenameModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PencilIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
              Rename
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <TrashIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
            Delete
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* File preview section */}
            <div className="md:col-span-2 flex flex-col items-center justify-center border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-[300px]">
              {fileDetails.status === 'clean' && fileDetails.detected_mime?.startsWith('image/') ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img 
                    src={`/api/files/${fileDetails.id}/preview`} 
                    alt={fileDetails.original_name} 
                    className="max-w-full max-h-[500px] object-contain rounded-md" 
                  />
                </div>
              ) : fileDetails.status === 'clean' && isViewable(fileDetails.detected_mime) ? (
                <div className="w-full flex flex-col items-center">
                  <FileIcon mimeType={fileDetails.detected_mime} />
                  <button
                    type="button"
                    onClick={() => window.open(`/api/files/${fileDetails.id}/preview`, '_blank')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="-ml-1 mr-2 h-5 w-5" />
                    View File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <FileIcon mimeType={fileDetails.detected_mime || 'application/octet-stream'} />
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    {fileDetails.status === 'clean' 
                      ? 'Preview not available for this file type' 
                      : fileDetails.status === 'quarantined'
                      ? 'This file has been quarantined due to security concerns'
                      : 'File is being processed'}
                  </p>
                </div>
              )}
            </div>
            
            {/* File details section */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">File Details</h3>
                <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-1">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                      <dd className="mt-1">
                        <StatusBadge status={fileDetails.status} />
                      </dd>
                    </div>

                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {formatBytes(fileDetails.size_bytes)}
                      </dd>
                    </div>

                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {fileDetails.detected_mime || 'Unknown'}
                      </dd>
                    </div>

                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Uploaded</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(fileDetails.created_at).toLocaleString()}
                      </dd>
                    </div>

                    {fileDetails.hash && (
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Hash (SHA-256)</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                          {fileDetails.hash}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rename modal */}
      <Transition.Root show={isRenameModalOpen} as={React.Fragment}>
        <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={setIsRenameModalOpen}>
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <form onSubmit={handleRename}>
                  <div>
                    <div className="mt-3 text-center sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                        Rename File
                      </Dialog.Title>
                      <div className="mt-4">
                        <label htmlFor="filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Filename
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="filename"
                            id="filename"
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={renameFile.isLoading}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      {renameFile.isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={() => setIsRenameModalOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Delete confirmation modal */}
      <Transition.Root show={isDeleteModalOpen} as={React.Fragment}>
        <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={setIsDeleteModalOpen}>
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-300" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Delete file
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete this file? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                    onClick={handleDelete}
                    disabled={deleteFile.isLoading}
                  >
                    {deleteFile.isLoading ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default FileDetailsPage;
