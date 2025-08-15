# Deployment Guide

Instructions for deploying the Student Scheduling Copilot to production.

## Frontend Deployment (Vercel) - Recommended

Vercel is optimized for Next.js applications and provides the best developer experience.

### Prerequisites
- GitHub repository with your code
- Vercel account (free tier available)

### Steps

1. **Connect Repository to Vercel**
   ```bash
   cd frontend
   npx vercel
   ```
   - Follow the prompts to connect your GitHub account
   - Select your repository
   - Choose the `frontend` directory as the root

2. **Environment Variables**
   Set these in Vercel dashboard (Settings → Environment Variables):
   ```
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-production-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   API_URL=https://your-api-domain.com
   ```

3. **Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

## Backend Deployment Options

### Option 1: Railway (Recommended for MVP)

Railway offers excellent PostgreSQL hosting and easy deployment.

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy Database**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway new student-scheduling-api
   railway add postgresql
   ```

3. **Deploy API**
   ```bash
   cd api
   railway deploy
   ```

4. **Environment Variables**
   Set in Railway dashboard:
   ```
   DATABASE_URL=postgresql://... (automatically set by Railway)
   OPENAI_API_KEY=your-openai-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NODE_ENV=production
   ```

### Option 2: Google Cloud Run

For a more enterprise setup with Google Cloud integration.

1. **Build and Push Container**
   ```bash
   cd api
   
   # Build for production
   docker build -t gcr.io/YOUR_PROJECT_ID/scheduling-api .
   
   # Push to Google Container Registry
   docker push gcr.io/YOUR_PROJECT_ID/scheduling-api
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy scheduling-api \
     --image gcr.io/YOUR_PROJECT_ID/scheduling-api \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Set Environment Variables**
   ```bash
   gcloud run services update scheduling-api \
     --set-env-vars="DATABASE_URL=postgresql://...,OPENAI_API_KEY=..." \
     --region us-central1
   ```

### Option 3: Docker Compose (Self-Hosted)

For running on your own server or VPS.

1. **Production Docker Compose**
   ```yaml
   # docker-compose.prod.yml
   version: '3.8'
   services:
     postgres:
       image: pgvector/pgvector:pg15
       environment:
         POSTGRES_DB: scheduling_copilot
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
     
     redis:
       image: redis:7-alpine
       volumes:
         - redis_data:/data
     
     api:
       build: ./api
       environment:
         - NODE_ENV=production
         - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/scheduling_copilot
       depends_on:
         - postgres
         - redis
       ports:
         - "3001:3001"
   ```

2. **Deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Database Migration

For production deployments, run migrations:

```bash
cd api
npx prisma migrate deploy
npx prisma generate
```

## Environment Variables Reference

### Frontend (.env.local)
```
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=complex-random-string-32-chars-min
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
API_URL=https://your-api-domain.com
```

### Backend (.env)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
OPENAI_API_KEY=sk-your-openai-api-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
FRONTEND_URL=https://your-frontend-domain.com
JWT_SECRET=another-complex-random-string
ENCRYPTION_KEY=32-character-encryption-key-here
```

## Google OAuth Setup for Production

1. **Google Cloud Console**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google Calendar API

2. **OAuth Consent Screen**
   - Configure OAuth consent screen
   - Add your domain to authorized domains
   - Add test users if using external user type

3. **Credentials**
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     - `https://your-domain.com/api/auth/callback/google`
   - Copy Client ID and Secret to environment variables

## SSL/HTTPS Setup

Both Vercel and Railway provide SSL certificates automatically. For self-hosted:

1. **Let's Encrypt with Nginx**
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;
       
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       
       location / {
           proxy_pass http://localhost:3000;
       }
       
       location /api {
           proxy_pass http://localhost:3001;
       }
   }
   ```

## Monitoring and Logging

### Production Logging
```javascript
// In production, use structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Health Checks
The API includes a health check endpoint at `/api/health` for monitoring.

### Performance Monitoring
Consider integrating:
- Sentry for error tracking
- DataDog or New Relic for APM
- Google Analytics for frontend usage

## Security Checklist

- ✅ HTTPS enabled
- ✅ Environment variables secured
- ✅ Database credentials rotated
- ✅ OAuth secrets not exposed
- ✅ CORS properly configured
- ✅ Rate limiting enabled
- ✅ Input validation implemented
- ✅ Audit logging active

## Backup Strategy

1. **Database Backups**
   - Railway: Automatic backups included
   - Self-hosted: Setup automated pg_dump

2. **Application Backups**
   - Code: GitHub repository
   - Environment configs: Secure storage
   - User data: Regular exports

This deployment setup provides a production-ready, scalable, and maintainable infrastructure for the Student Scheduling Copilot.