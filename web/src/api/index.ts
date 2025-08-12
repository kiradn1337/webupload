import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with base URL from environment variable
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      toast.error('Network error. Please check your connection.');
      return Promise.reject(error);
    }

    // Handle API errors based on status code
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        toast.error(data.error || 'Bad request');
        break;
      case 401:
        toast.error('Your session has expired. Please log in again.');
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
        }
        break;
      case 403:
        toast.error('You do not have permission to perform this action');
        break;
      case 404:
        toast.error(data.error || 'Resource not found');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }

    return Promise.reject(error);
  }
);

// File API functions
export const fileApi = {
  initiateUpload: async (fileName: string, fileSize: number, contentType: string) => {
    return api.post('/uploads/initiate', {
      fileName,
      fileSize,
      contentType,
    });
  },
  
  completeUpload: async (fileId: string) => {
    return api.post(`/uploads/complete/${fileId}`);
  },
  
  getFiles: async (status?: string, page: number = 1, pageSize: number = 20) => {
    return api.get('/files', {
      params: { status, page, pageSize },
    });
  },
  
  getFile: async (fileId: string) => {
    return api.get(`/files/${fileId}`);
  },
  
  generateDownloadUrl: async (fileId: string) => {
    return api.get(`/files/${fileId}/download`);
  },
  
  createShare: async (fileId: string, expiresInMinutes: number = 15, oneTimeUse: boolean = false) => {
    return api.post(`/files/${fileId}/share`, {
      expiresInMinutes,
      oneTimeUse,
    });
  },
  
  deleteFile: async (fileId: string) => {
    return api.delete(`/files/${fileId}`);
  },
  
  getSharedFile: async (token: string) => {
    return api.get(`/s/${token}`);
  },
};

// Admin API functions
export const adminApi = {
  listFiles: async (status?: string, page: number = 1, pageSize: number = 20) => {
    return api.get('/admin/files', {
      params: { status, page, pageSize },
    });
  },
  
  fileAction: async (fileId: string, action: 'allow' | 'delete') => {
    return api.post(`/admin/files/${fileId}/action`, { action });
  },
  
  listUsers: async (page: number = 1, pageSize: number = 20) => {
    return api.get('/admin/users', {
      params: { page, pageSize },
    });
  },
  
  getAuditLogs: async (
    filters: {
      userId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    pageSize: number = 20
  ) => {
    return api.get('/admin/audit-logs', {
      params: {
        ...filters,
        page,
        pageSize,
      },
    });
  },
};
