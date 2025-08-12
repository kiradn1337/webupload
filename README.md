# SecureFileUpload - Secure File Upload and Management System

A production-ready web application for secure file upload and management with high security standards, scalability, documentation, and easy deployment.

## Architecture

SecureFileUpload is a full-stack application built with security as the primary focus:

### Backend
- Node.js 20 + TypeScript
- Fastify
- PostgreSQL for data storage
- Redis for queuing (BullMQ)
- MinIO for S3-compatible object storage
- ClamAV for antivirus scanning
- JWT Authentication with refresh tokens
- Argon2 password hashing

### Frontend
- React + Vite
- TypeScript
- Tailwind CSS
- Real-time updates with WebSocket/SSE

### Infrastructure
- Docker Compose for local development and testing
- Deployment configuration for Render.com

## Secure Upload Flow

```
┌─────────┐         ┌────────┐         ┌──────┐         ┌────────┐
│ Browser │ ──────► │ API    │ ──────► │ S3   │ ◄────── │ Worker │
└─────────┘         └────────┘         └──────┘         └────────┘
     │                  │                  │                 │
     │  1. Request      │                  │                 │
     │  Upload URL      │                  │                 │
     ├─────────────────►│                  │                 │
     │                  │                  │                 │
     │  2. Pre-signed   │                  │                 │
     │  S3 URL          │                  │                 │
     │◄─────────────────┤                  │                 │
     │                  │                  │                 │
     │  3. Direct       │                  │                 │
     │  Upload          │                  │                 │
     ├─────────────────────────────────────►                 │
     │                  │                  │                 │
     │  4. Complete     │                  │                 │
     │  Upload          │                  │                 │
     ├─────────────────►│                  │                 │
     │                  │  5. Queue        │                 │
     │                  │  Scan Job        │                 │
     │                  ├────────────────────────────────────►
     │                  │                  │                 │
     │                  │                  │  6. Fetch File  │
     │                  │                  │◄────────────────┤
     │                  │                  │                 │
     │                  │                  │  7. Scan &      │
     │                  │                  │  Process File   │
     │                  │                  │                 │
     │                  │  8. Update       │                 │
     │                  │◄────────────────────────────────────┤
     │                  │  Status          │                 │
     │                  │                  │                 │
     │  9. Status       │                  │                 │
     │  Update (WS/SSE) │                  │                 │
     │◄─────────────────┤                  │                 │
     │                  │                  │                 │
```

## Security Features

- Secure file uploads with pre-signed URLs
- File scanning with ClamAV
- Content type validation and verification
- Secure file serving with pre-signed download URLs
- RBAC with user and admin roles
- JWT authentication with refresh tokens
- Rate limiting and anti-abuse protection
- Comprehensive content security policies
- Audit logging for all actions

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git
- Node.js 20+ (for local development outside Docker)

### Local Development

1. Clone the repository:
```bash
git clone [your-repo-url]
cd webupload
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Start the application using Docker Compose:
```bash
docker-compose up -d
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs (requires admin authentication in production)
   - MinIO Console: http://localhost:9001 (admin/minio123)

## Deployment on Render.com

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Render.com.

## Environment Variables

See [.env.example](./.env.example) for all available configuration options.

## Features Implemented

- ✅ User authentication system with JWT tokens and refresh tokens
- ✅ Secure file upload using pre-signed S3 URLs
- ✅ Real-time upload progress tracking
- ✅ Virus scanning with ClamAV
- ✅ File type detection and validation
- ✅ File management dashboard with filtering and search
- ✅ File details view with metadata
- ✅ File preview for supported file types
- ✅ File download with pre-signed URLs
- ✅ File sharing with configurable expiration
- ✅ User roles and permissions (Admin/User)
- ✅ Admin dashboard for system monitoring
- ✅ Storage quota management
- ✅ Responsive UI with dark mode support
- ✅ Complete Docker setup for local development
- ✅ Deployment configuration for Render.com

## License

[MIT](LICENSE)
