import React from 'react';
import { useQuery } from 'react-query';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { 
  ArrowUpTrayIcon,
  DocumentIcon,
  FolderIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

// Format bytes to human readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  
  // Fetch user storage info
  const { data: userInfo, isLoading } = useQuery('userInfo', () => 
    api.get('/me').then(res => res.data.user)
  );
  
  // Fetch recent files
  const { data: recentFiles, isLoading: filesLoading } = useQuery('recentFiles', () =>
    api.get('/files', { params: { page: 1, pageSize: 5 } }).then(res => res.data.files)
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back, {user?.email}
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Storage usage card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-md p-3">
                <DocumentIcon className="h-6 w-6 text-blue-600 dark:text-blue-200" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Storage Used
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {isLoading ? '...' : formatBytes(userInfo?.usedStorage || 0)}
                    </div>
                    <div className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      of {isLoading ? '...' : formatBytes(userInfo?.storageQuota || 0)}
                    </div>
                  </dd>
                  {!isLoading && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, ((userInfo?.usedStorage || 0) / (userInfo?.storageQuota || 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Files count card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
                <FolderIcon className="h-6 w-6 text-green-600 dark:text-green-200" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Files
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {isLoading ? '...' : userInfo?.fileCount || 0}
                    </div>
                    <div className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      of {isLoading ? '...' : userInfo?.filesQuota || 0}
                    </div>
                  </dd>
                  {!isLoading && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, ((userInfo?.fileCount || 0) / (userInfo?.filesQuota || 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Quick Actions
            </h3>
            <div className="mt-5">
              <Link 
                to="/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                Upload Files
              </Link>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900 rounded-md p-3">
                <ShieldCheckIcon className="h-6 w-6 text-purple-600 dark:text-purple-200" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Security
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    All files are scanned
                  </dd>
                  <dd className="text-sm text-gray-500 dark:text-gray-400">
                    with ClamAV antivirus
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent files */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 flex justify-between">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Recent Files
          </h3>
          <Link
            to="/files"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            View all files
          </Link>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filesLoading ? (
            <li className="p-4 text-center text-gray-500 dark:text-gray-400">Loading...</li>
          ) : recentFiles?.length ? (
            recentFiles.map((file: any) => (
              <li key={file.id}>
                <Link to={`/files/${file.id}`} className="block hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {file.detected_mime?.startsWith('image/') ? (
                            <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {file.original_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatBytes(file.size_bytes)} • 
                            <span className={`ml-2 ${
                              file.status === 'clean' 
                                ? 'text-green-600 dark:text-green-400' 
                                : file.status === 'quarantined' 
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          ) : (
            <li className="p-4 text-center text-gray-500 dark:text-gray-400">
              No files uploaded yet. <Link to="/upload" className="text-blue-600 dark:text-blue-400">Upload your first file</Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default HomePage;
