import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import FilesPage from './pages/FilesPage';
import FileDetailsPage from './pages/FileDetailsPage';
import SharedFilePage from './pages/SharedFilePage';
import AdminFilesPage from './pages/AdminFilesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';

// Protected route component
const ProtectedRoute: React.FC<{ element: React.ReactElement; requireAdmin?: boolean }> = ({
  element,
  requireAdmin = false,
}) => {
  const { user, isLoading } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Redirect to home if admin access required but user is not admin
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/files" />;
  }

  return element;
};

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/s/:token" element={<SharedFilePage />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute element={<Layout />} />}>
        <Route index element={<HomePage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="files/:id" element={<FileDetailsPage />} />
        
        {/* Admin routes */}
        <Route path="admin/files" element={<ProtectedRoute element={<AdminFilesPage />} requireAdmin />} />
        <Route path="admin/users" element={<ProtectedRoute element={<AdminUsersPage />} requireAdmin />} />
        <Route path="admin/audit-logs" element={<ProtectedRoute element={<AdminAuditLogsPage />} requireAdmin />} />
      </Route>

      {/* Not found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
