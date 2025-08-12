# Deployment Guide for Render.com

This guide provides step-by-step instructions for deploying the SecureFileUpload application on Render.com.

> **Tip**: The fastest way to deploy is using the included `render.yaml` Blueprint file, which automates the setup of all services at once.

## Prerequisites

1. A Render.com account
2. A GitHub account with the project repository pushed to it
3. A PostgreSQL database (can be provisioned on Render.com)
4. A Redis instance (can be provisioned on Render.com)
5. An S3-compatible storage service (e.g., AWS S3, DigitalOcean Spaces, or Render Disks)

## Step 1: Prepare Your Repository

Make sure your project is in a GitHub repository that Render.com can access.

```bash
# Initialize Git repository (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create a repository on GitHub and push to it
git remote add origin https://github.com/yourusername/webupload.git

# Check which branch you're on (usually master or main)
git branch

# Push to the appropriate branch (replace 'master' with your branch name if different)
git push -u origin master
```

## Step 2: Create a PostgreSQL Database on Render

1. Log in to your Render.com dashboard
2. Navigate to "PostgreSQL" in the side menu
3. Click "New PostgreSQL" button
4. Configure your database:
   - Name: webupload-db
   - Database: webupload
   - User: webupload
   - Region: Choose the closest to your users
   - PostgreSQL Version: 15
5. Click "Create Database"
6. Make note of the connection details provided

## Step 3: Create a Redis Instance on Render

1. Navigate to "Redis" in the Render.com side menu
2. Click "New Redis" button
3. Configure your Redis instance:
   - Name: webupload-redis
   - Region: Same as your PostgreSQL database
4. Click "Create Redis"
5. Make note of the connection details provided

## Step 4: Deploy with Render Blueprint (Recommended)

The easiest way to deploy the entire stack is using the Render Blueprint system:

1. Make sure you have the `render.yaml` file in your repository root
2. Log in to your Render.com dashboard
3. Click "New" and select "Blueprint"
4. Connect to your GitHub repository
5. Render will automatically detect the `render.yaml` file and configure all services
6. Add the necessary secret environment variables:
   - `JWT_SECRET`: Generate a secure random string
   - `REFRESH_TOKEN_SECRET`: Generate another secure random string
   - `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Configure for your production S3 service
   - `CLAMAV_HOST`, `CLAMAV_PORT`: If using an external ClamAV service
7. Click "Apply" to create and deploy all services at once

## Alternative Step 4: Set Up the Backend API Service Manually

If you prefer to set up services individually:

1. Navigate to "Web Services" in the Render.com side menu
2. Click "New Web Service"
3. Connect to your GitHub repository
4. Configure the service:
   - Name: webupload-api
   - Region: Same as your database
   - Branch: main
   - Root Directory: api
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: Choose based on your requirements (at least Standard)
5. Add Environment Variables (from your .env file):
   - Copy all backend-related environment variables from your .env file
   - Make sure to update the following:
     - `DATABASE_URL`: Use the PostgreSQL connection string from Step 2
     - `REDIS_URL`: Use the Redis connection string from Step 3
     - `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Configure for your production S3 service
     - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`: Use secure random strings
     - `CORS_ORIGIN`: Set to your frontend URL
6. Click "Create Web Service"

## Alternative Step 5: Set Up the Frontend Web Service Manually

If you're setting up services individually rather than using the Blueprint:

1. Navigate back to "Web Services" in the Render.com side menu
2. Click "New Web Service"
3. Connect to your GitHub repository (same as above)
4. Configure the service:
   - Name: webupload-web
   - Region: Same as your API
   - Branch: main
   - Root Directory: web
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: Choose based on your requirements
5. Add Environment Variables:
   - `VITE_API_URL`: Set to your backend API URL (e.g., https://webupload-api.onrender.com)
   - Add any other frontend-specific environment variables
6. Click "Create Web Service"

## Alternative Step 6: Set Up Worker Service Manually

If you're setting up services individually:

1. Navigate to "Background Workers" in the Render.com side menu
2. Click "New Background Worker"
3. Connect to your GitHub repository
4. Configure the worker:
   - Name: webupload-worker
   - Region: Same as your API
   - Branch: main
   - Root Directory: api
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run worker`
   - Plan: Choose based on your requirements
5. Add the same environment variables as the API service
6. Click "Create Background Worker"

## Step 7: Set Up External Services

### ClamAV Setup

For production, you have several options:
1. Use a managed antivirus service with an API
2. Deploy a separate ClamAV server
3. Use a third-party service like VirusTotal API

Update your environment variables to point to your chosen antivirus solution.

### S3-Compatible Storage

If not using Render Disks, set up an S3-compatible storage service:
1. AWS S3: Create a bucket and IAM user with appropriate permissions
2. DigitalOcean Spaces: Create a Space and API key
3. Other S3-compatible services: Follow their respective setup guides

Update the S3 environment variables in your API service to point to your production storage.

## Step 8: Final Configuration

1. Set up custom domains for your services (optional)
2. Configure SSL certificates (Render.com handles this automatically for *.onrender.com domains)
3. Set up monitoring and alerts

## Troubleshooting

If you encounter issues during deployment:

1. Check the service logs in the Render.com dashboard
2. Verify environment variables are correctly set
3. Ensure the build and start commands are correct
4. Check that your database and Redis services are running
5. Verify S3 credentials and bucket permissions

## Maintenance

- Regular database backups are recommended
- Monitor storage usage and scale as needed
- Keep dependencies updated
- Monitor the security of uploaded files

## Security Considerations

- Use strong, unique passwords for all services
- Keep your JWT secrets secure
- Regularly rotate access keys for S3
- Enable MFA for your Render.com and S3 provider accounts
- Consider setting up a CDN for improved performance and additional security
