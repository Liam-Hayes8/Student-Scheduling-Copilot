# Production Deployment Guide

This guide covers deploying the Student Scheduling Copilot to production with enterprise-grade reliability, security, and scalability.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Cloud Run     │    │   Cloud SQL     │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Next.js App   │    │ • Express API   │    │ • pgvector      │
│ • CDN/Edge      │    │ • Auto-scaling  │    │ • Backups       │
│ • SSL/TLS       │    │ • Load Balancer │    │ • Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌─────────────────┐
                       │   Memory Store  │
                       │   (Redis)       │
                       │                 │
                       │ • Sessions      │
                       │ • Rate Limiting │
                       │ • Caching       │
                       └─────────────────┘
```

## Prerequisites

- Google Cloud Platform account with billing enabled
- Vercel account (free tier available)
- Domain name (optional but recommended)
- OpenAI API key
- Google OAuth credentials

## Step 1: Google Cloud Setup

### 1.1 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### 1.2 Create Project and Set Configuration

```bash
# Create new project (or use existing)
gcloud projects create student-scheduling-copilot --name="Student Scheduling Copilot"

# Set project
gcloud config set project student-scheduling-copilot

# Set region
gcloud config set run/region us-central1
```

### 1.3 Create Service Account

```bash
# Create service account
gcloud iam service-accounts create scheduling-copilot-sa \
  --display-name="Scheduling Copilot Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding student-scheduling-copilot \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding student-scheduling-copilot \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 2: Database Setup

### 2.1 Create Cloud SQL Instance

```bash
# Create PostgreSQL instance with pgvector
gcloud sql instances create scheduling-copilot-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time="02:00" \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=03:00 \
  --availability-type=REGIONAL \
  --enable-point-in-time-recovery

# Create database
gcloud sql databases create scheduling_copilot \
  --instance=scheduling-copilot-db

# Create user
gcloud sql users create scheduling-copilot \
  --instance=scheduling-copilot-db \
  --password="YOUR_SECURE_PASSWORD"
```

### 2.2 Enable pgvector Extension

```bash
# Connect to database and enable extension
gcloud sql connect scheduling-copilot-db --user=postgres

# In the database shell:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 2.3 Store Database Credentials

```bash
# Store database URL in Secret Manager
echo -n "postgresql://scheduling-copilot:YOUR_SECURE_PASSWORD@/scheduling_copilot?host=/cloudsql/student-scheduling-copilot:us-central1:scheduling-copilot-db" | \
gcloud secrets create DATABASE_URL --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 3: Redis Setup

### 3.1 Create Memory Store Instance

```bash
# Create Redis instance
gcloud redis instances create scheduling-copilot-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x

# Get connection info
gcloud redis instances describe scheduling-copilot-cache --region=us-central1
```

### 3.2 Store Redis URL

```bash
# Store Redis URL in Secret Manager
echo -n "redis://YOUR_REDIS_IP:6379" | \
gcloud secrets create REDIS_URL --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding REDIS_URL \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 4: Backend Deployment

### 4.1 Prepare Backend for Deployment

```bash
# Navigate to API directory
cd api

# Install dependencies
npm install

# Build the application
npm run build

# Create Dockerfile for Cloud Run
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3001

CMD ["node", "dist/index.js"]
EOF
```

### 4.2 Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy scheduling-copilot-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account=scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="PORT=3001" \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300 \
  --concurrency 80

# Get the service URL
gcloud run services describe scheduling-copilot-api --region=us-central1 --format="value(status.url)"
```

### 4.3 Store API Secrets

```bash
# Store OpenAI API key
echo -n "YOUR_OPENAI_API_KEY" | \
gcloud secrets create OPENAI_API_KEY --data-file=-

# Store Google OAuth credentials
echo -n '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}' | \
gcloud secrets create GOOGLE_OAUTH_CREDENTIALS --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GOOGLE_OAUTH_CREDENTIALS \
  --member="serviceAccount:scheduling-copilot-sa@student-scheduling-copilot.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 5: Frontend Deployment

### 5.1 Configure Vercel

1. Connect your GitHub repository to Vercel
2. Set the following environment variables in Vercel dashboard:

```bash
NEXT_PUBLIC_API_URL=https://scheduling-copilot-api-xxxxx-uc.a.run.app
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-domain.vercel.app
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 5.2 Deploy Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Step 6: Domain and SSL Setup

### 6.1 Custom Domain (Optional)

```bash
# Add custom domain to Cloud Run
gcloud run domain-mappings create \
  --service=scheduling-copilot-api \
  --domain=api.yourdomain.com \
  --region=us-central1

# Add custom domain to Vercel through dashboard
```

### 6.2 SSL Certificates

- Vercel automatically handles SSL for frontend
- Cloud Run automatically handles SSL for backend
- No additional configuration needed

## Step 7: Monitoring and Logging

### 7.1 Enable Cloud Monitoring

```bash
# Enable monitoring APIs
gcloud services enable monitoring.googleapis.com logging.googleapis.com

# Create monitoring dashboard
gcloud monitoring dashboards create --config-from-file=dashboard-config.json
```

### 7.2 Set Up Alerts

```bash
# Create alerting policy for high error rates
gcloud alpha monitoring policies create --policy-from-file=alert-policy.json
```

### 7.3 Log Analysis

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scheduling-copilot-api" --limit=50
```

## Step 8: Security Hardening

### 8.1 Network Security

```bash
# Restrict Cloud Run to specific IPs (if needed)
gcloud run services update scheduling-copilot-api \
  --region=us-central1 \
  --ingress=internal-and-cloud-load-balancing
```

### 8.2 API Security

- All secrets stored in Secret Manager
- Service account with minimal permissions
- HTTPS enforced
- Rate limiting enabled
- Input validation on all endpoints

### 8.3 Database Security

```bash
# Enable SSL for database connections
gcloud sql instances patch scheduling-copilot-db \
  --require-ssl

# Create SSL certificates
gcloud sql ssl-certs create client-cert \
  --instance=scheduling-copilot-db
```

## Step 9: Performance Optimization

### 9.1 CDN Configuration

```bash
# Configure Vercel CDN settings in dashboard
# Enable edge caching for static assets
# Configure cache headers for API responses
```

### 9.2 Database Optimization

```bash
# Create indexes for common queries
CREATE INDEX idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);
CREATE INDEX idx_syllabus_events_user_id_date ON syllabus_events(user_id, date);
CREATE INDEX idx_scheduling_sessions_user_id_status ON scheduling_sessions(user_id, status);
```

### 9.3 Caching Strategy

- Redis for session storage
- API response caching for static data
- Database query result caching
- Static asset caching via CDN

## Step 10: Backup and Disaster Recovery

### 10.1 Database Backups

```bash
# Automated backups are enabled by default
# Manual backup
gcloud sql export sql scheduling-copilot-db \
  gs://your-backup-bucket/scheduling-copilot-backup.sql \
  --database=scheduling_copilot
```

### 10.2 Application Backup

```bash
# Backup application code
git archive --format=zip --output=scheduling-copilot-backup.zip HEAD

# Backup environment variables
gcloud secrets list --format="table(name)" > secrets-list.txt
```

## Cost Optimization

### Monthly Cost Estimate (US Central)

- **Cloud Run**: ~$20-50/month (depending on usage)
- **Cloud SQL**: ~$25/month (db-f1-micro)
- **Memory Store**: ~$15/month (1GB)
- **Vercel**: Free tier (or $20/month for Pro)
- **Total**: ~$60-95/month

### Cost Optimization Tips

1. Use Cloud Run's min-instances=0 for auto-scaling
2. Monitor and adjust database instance size
3. Implement proper caching to reduce API calls
4. Use Vercel's free tier for frontend hosting

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check Cloud SQL proxy
   gcloud sql connect scheduling-copilot-db --user=postgres
   ```

2. **Secret Access Issues**
   ```bash
   # Verify service account permissions
   gcloud projects get-iam-policy student-scheduling-copilot
   ```

3. **High Latency**
   ```bash
   # Check Cloud Run logs
   gcloud logging read "resource.type=cloud_run_revision"
   ```

### Support Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Vercel Documentation](https://vercel.com/docs)

## Maintenance

### Regular Tasks

1. **Weekly**: Review logs and error rates
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and optimize costs
4. **Annually**: Security audit and penetration testing

### Updates

```bash
# Update application
git pull origin main
npm install
npm run build
gcloud run deploy scheduling-copilot-api --source .
```

This deployment guide provides a production-ready setup with enterprise-grade reliability, security, and scalability. The architecture is designed to handle real-world usage while maintaining reasonable costs.
