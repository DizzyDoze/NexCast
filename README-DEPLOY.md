# NexCast Deployment Guide

Complete technical guide for deploying NexCast to AWS.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Domain & DNS Setup](#1-domain--dns-setup)
3. [SSL Certificates](#2-ssl-certificates)
4. [AWS Secrets Manager](#3-aws-secrets-manager)
5. [AWS Cognito (OAuth)](#4-aws-cognito-oauth)
6. [Cloudflare Turnstile](#5-cloudflare-turnstile)
7. [Docker Deployment (EC2)](#6-docker-deployment-ec2)
8. [Lambda Deployment](#7-lambda-deployment)
9. [Frontend Deployment](#8-frontend-deployment)
10. [Cost Optimization](#9-cost-optimization)
11. [Troubleshooting](#10-troubleshooting)

---

## Prerequisites

### Required Accounts & Services
- AWS Account with billing enabled
- Domain name (Namecheap, Cloudflare, etc.)
- Cloudflare account (free tier is sufficient)
- Google Cloud Console access (for OAuth)

### Required API Keys
- Google AI (Gemini Vision API)
- xAI (Grok API)
- ElevenLabs (TTS API)

### Local Development Tools
- AWS CLI configured (`aws configure`)
- Docker Desktop (for building images)
- Node.js & pnpm (for Lambda deployment)
- Git

---

## 1. Domain & DNS Setup

### Step 1.1: Purchase Domain

Purchase a domain from Namecheap (or any registrar). Example: `nexcast.club`

### Step 1.2: Switch to Cloudflare Nameservers

1. **Create Cloudflare account** at https://dash.cloudflare.com
2. **Add your domain** to Cloudflare
3. **Copy Cloudflare nameservers** (e.g., `david.ns.cloudflare.com`, `susan.ns.cloudflare.com`)
4. **Update nameservers in Namecheap:**
   - Go to: Domain List → Manage → Domain
   - Nameservers: **Custom DNS**
   - Paste Cloudflare nameservers
   - Wait 24-48 hours for propagation (usually faster)

### Step 1.3: Configure DNS Records in Cloudflare

**Main domain (Frontend - CloudFront):**
```
Type: CNAME
Name: nexcast.club (or @)
Target: [CloudFront distribution URL]
Proxy: ON (orange cloud)
TTL: Auto
```

**API subdomain (Backend - EC2):**
```
Type: A
Name: api
Value: [EC2 Public IP]
Proxy: OFF (gray cloud) ⚠️ CRITICAL!
TTL: Auto
```

**Why Proxy OFF?**
- Cloudflare proxy breaks WebSocket connections with Let's Encrypt SSL
- certbot needs direct access to validate domain ownership
- Must use DNS-only mode for api subdomain

---

## 2. SSL Certificates

### 2.1 Frontend SSL (CloudFront - Automatic)

CloudFront provides free SSL certificates via AWS Certificate Manager. No manual setup required.

### 2.2 Backend SSL (Let's Encrypt)

#### Install Certbot on EC2

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

#### Get Certificate

**Requirements:**
- Ports 80 and 443 must be free (stop Docker containers if running)
- DNS A record for `api.nexcast.club` must point to this EC2

```bash
sudo certbot certonly --standalone \
    -d api.nexcast.club \
    --non-interactive \
    --agree-tos \
    --email your-email@example.com
```

#### Certificate Locations

After successful issuance:
```
/etc/letsencrypt/live/api.nexcast.club/fullchain.pem
/etc/letsencrypt/live/api.nexcast.club/privkey.pem
```

#### Auto-Renewal

Certbot automatically sets up a cron job for renewal. Check status:

```bash
# Dry run to test renewal
sudo certbot renew --dry-run

# Check certificate expiry
sudo certbot certificates
```

Certificates renew automatically 30 days before expiry.

---

## 3. AWS Secrets Manager

### 3.1 Create Secret

1. **Go to AWS Secrets Manager Console**
2. **Store a new secret:**
   - Secret type: **Other type of secret**
   - Key/value pairs: (see below)
   - Secret name: **`NexCastSecrets`**
   - Region: **us-east-1** (or your preferred region)

### 3.2 Secret Key-Value Pairs

```json
{
  "GEMINI_API_KEY": "your-gemini-api-key",
  "XAI_API_KEY": "your-grok-api-key",
  "ELEVENLABS_API_KEY": "your-elevenlabs-key",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON": "{\"type\":\"service_account\",\"project_id\":\"...\"}",
  "VITE_COGNITO_USER_POOL_ID": "us-east-1_xxxxx",
  "VITE_COGNITO_CLIENT_ID": "xxxxxxxxxxxx",
  "VITE_COGNITO_DOMAIN": "https://xxxxx.auth.us-east-1.amazoncognito.com",
  "VITE_API_GATEWAY_URL": "https://xxxxx.execute-api.us-east-1.amazonaws.com",
  "VITE_ELEVENLABS_API_KEY": "sk_xxxxx",
  "VITE_TURNSTILE_SITE_KEY": "0x4xxxxx"
}
```

**Note:** `GOOGLE_APPLICATION_CREDENTIALS_JSON` should be the entire service account JSON as a string (escape quotes).

### 3.3 IAM Permissions

Ensure EC2 instance role has:
```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:NexCastSecrets-*"
}
```

---

## 4. AWS Cognito (OAuth)

### 4.1 Setup Google OAuth

1. **Go to Google Cloud Console:** https://console.cloud.google.com
2. **APIs & Services → Credentials**
3. **Create OAuth 2.0 Client ID:**
   - Application type: **Web application**
   - Name: `NexCast`
   - Authorized redirect URIs:
     ```
     https://[cognito-domain].auth.us-east-1.amazoncognito.com/oauth2/idpresponse
     ```
   - Copy **Client ID** and **Client Secret**

### 4.2 Create Cognito User Pool

1. **Go to AWS Cognito Console**
2. **Create User Pool:**
   - Authentication providers: **Federated identity providers**
   - Add **Google** as provider
   - Paste Google Client ID and Secret
   - Configure app client:
     - App type: **Public client**
     - No client secret
     - OAuth flows: **Authorization code grant**
     - OAuth scopes: `openid`, `email`, `profile`

3. **Configure Hosted UI Domain:**
   - Add Cognito domain: `https://[your-prefix].auth.us-east-1.amazoncognito.com`

4. **Copy these values:**
   - User Pool ID: `us-east-1_xxxxx`
   - App Client ID: `xxxxxxxxxxxx`
   - Cognito Domain: `https://[prefix].auth.us-east-1.amazoncognito.com`

### 4.3 Update Secrets Manager

Add Cognito values to `NexCastSecrets`:
```json
{
  "VITE_COGNITO_USER_POOL_ID": "us-east-1_xxxxx",
  "VITE_COGNITO_CLIENT_ID": "xxxxxxxxxxxx",
  "VITE_COGNITO_DOMAIN": "https://xxxxx.auth.us-east-1.amazoncognito.com"
}
```

---

## 5. Cloudflare Turnstile

### 5.1 Create Turnstile Site

1. **Go to Cloudflare Dashboard**
2. **Turnstile → Add Site**
   - Site name: `NexCast`
   - Domains: `nexcast.club`
   - Widget mode: **Managed**
3. **Copy Site Key:** `0x4xxxxxxxxxxxxx`

### 5.2 Update Secrets Manager

Add to `NexCastSecrets`:
```json
{
  "VITE_TURNSTILE_SITE_KEY": "0x4xxxxxxxxxxxxx"
}
```

---

## 6. Docker Deployment (EC2)

### 6.1 Architecture Overview

```
Internet (HTTPS/WSS)
    ↓
Nginx Container (port 443) - SSL termination
    ↓
FastAPI Backend Container (port 8000) - WebSocket server
```

**Two-container setup:**
- **nginx:** Handles SSL with Let's Encrypt, proxies WebSocket requests
- **backend:** FastAPI server with AI pipeline

---

### 6.2 Build and Push to ECR

#### Create ECR Repository

```bash
aws ecr create-repository \
    --repository-name nexcast-backend \
    --region us-east-1
```

#### Build and Push Image

```bash
cd backend-core

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
REPO_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/nexcast-backend"

# Authenticate to ECR
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $REPO_URI

# Build for Linux (from Mac/Windows)
docker build --platform linux/amd64 -t $REPO_URI:latest .

# Push to ECR
docker push $REPO_URI:latest
```

---

### 6.3 Launch EC2 Instance

#### Instance Configuration

1. **AMI:** Ubuntu 24.04 LTS
2. **Instance Type:**
   - `t2.medium` (recommended for demo)
   - `t2.micro` (free tier, may be slow)
3. **Storage:** 20 GB gp3
4. **Security Group:**
   ```
   Port 22  (SSH)   - Your IP
   Port 443 (HTTPS) - 0.0.0.0/0
   ```

#### IAM Instance Role

Create role with these policies:
- `AmazonEC2ContainerRegistryReadOnly` (pull Docker images)
- Custom policy for Secrets Manager:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "secretsmanager:GetSecretValue",
        "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:NexCastSecrets-*"
      }
    ]
  }
  ```

---

### 6.4 Initial EC2 Setup (One-time)

SSH into the instance:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

Install dependencies:

```bash
# Update system
sudo apt-get update

# Install Docker, AWS CLI, utilities
sudo apt-get install -y docker.io awscli jq certbot

# Install Docker Compose V2
sudo apt-get install -y docker-compose-v2

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Verify installations
docker --version
docker compose version
aws --version
```

Get SSL certificate (see [Section 2.2](#22-backend-ssl-lets-encrypt)):

```bash
sudo certbot certonly --standalone -d api.nexcast.club \
    --non-interactive --agree-tos --email your-email@example.com
```

---

### 6.5 Automated Deployment with launch.sh

#### Download and Run Script

```bash
cd ~
curl -O https://raw.githubusercontent.com/DizzyDoze/NexCast/main/backend-core/deploy/launch.sh
chmod +x launch.sh
./launch.sh
```

#### What launch.sh Does

1. Cleans old containers and images
2. Logs into AWS ECR
3. Pulls secrets from AWS Secrets Manager
4. Extracts API keys and creates `.env`
5. Extracts Google credentials to `/opt/nexcast/credentials/`
6. Creates `nginx.conf` for SSL proxy
7. Creates `docker-compose.prod.yml`
8. Pulls latest Docker images from ECR
9. Starts nginx + backend containers
10. Tests health endpoint

#### Script Output

```
🧹 Cleaning old containers and images...
🔐 Logging into AWS ECR...
🔐 Fetching secrets from AWS Secrets Manager...
📝 Creating .env file...
📁 Setting up Google credentials...
🌐 Creating nginx.conf...
📋 Creating docker-compose.prod.yml...
📥 Pulling latest images...
🚀 Starting containers...
✅ Deployment complete!

Health check: {"status":"healthy","service":"nexcast-api"}
```

---

### 6.6 Manual Deployment (Step-by-Step)

If you prefer manual deployment:

```bash
# 1. Create project directory
mkdir -p ~/nexcast && cd ~/nexcast

# 2. Login to ECR
REGION=us-east-1
ACCOUNT_ID=970547374353
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# 3. Get secrets from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id NexCastSecrets \
    --region $REGION \
    --query SecretString \
    --output text)

# 4. Create .env file
cat > .env <<EOF
GEMINI_API_KEY=$(echo $SECRET_JSON | jq -r '.GEMINI_API_KEY')
XAI_API_KEY=$(echo $SECRET_JSON | jq -r '.XAI_API_KEY')
ELEVENLABS_API_KEY=$(echo $SECRET_JSON | jq -r '.ELEVENLABS_API_KEY')
EOF

# 5. Setup Google credentials
GOOGLE_CREDS=$(echo $SECRET_JSON | jq -r '.GOOGLE_APPLICATION_CREDENTIALS_JSON')
sudo mkdir -p /opt/nexcast/credentials
echo "$GOOGLE_CREDS" | sudo tee /opt/nexcast/credentials/google-credentials.json > /dev/null

# 6. Create nginx.conf
cat > nginx.conf <<'EOF'
server {
    listen 443 ssl;
    server_name api.nexcast.club;

    ssl_certificate /etc/letsencrypt/live/api.nexcast.club/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nexcast.club/privkey.pem;

    location /ws/ {
        proxy_pass http://backend:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    location /health {
        proxy_pass http://backend:8000/health;
    }
}
EOF

# 7. Create docker-compose.prod.yml
cat > docker-compose.prod.yml <<EOF
services:
  backend:
    image: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/nexcast-backend:latest
    container_name: nexcast-backend
    volumes:
      - /opt/nexcast/credentials:/app/credentials:ro
    environment:
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - XAI_API_KEY=\${XAI_API_KEY}
      - ELEVENLABS_API_KEY=\${ELEVENLABS_API_KEY}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/google-credentials.json
    restart: unless-stopped
    networks:
      - nexcast-net

  nginx:
    image: nginx:alpine
    container_name: nexcast-nginx
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - nexcast-net

networks:
  nexcast-net:
    driver: bridge
EOF

# 8. Pull and start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 9. Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

### 6.7 Container Management Commands

```bash
# View logs (all containers)
docker compose -f docker-compose.prod.yml logs -f

# View logs (specific container)
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop services
docker compose -f docker-compose.prod.yml down

# Update to latest image
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Check container status
docker compose -f docker-compose.prod.yml ps

# Execute command in container
docker exec -it nexcast-backend bash
```

---

### 6.8 Testing Backend Deployment

```bash
# Test health endpoint
curl https://api.nexcast.club/health

# Expected response:
# {"status":"healthy","service":"nexcast-api"}

# Test WebSocket (from browser console)
const ws = new WebSocket('wss://api.nexcast.club/ws/test-session-123');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📨', e.data);
ws.onerror = (e) => console.error('❌', e);
```

---

## 7. Lambda Deployment

### 7.1 Setup Serverless Framework

```bash
cd backend-lambda

# Install dependencies
pnpm install

# Install Serverless globally (if not installed)
npm install -g serverless
```

### 7.2 Configure Environment Variables

Create `.env` file in `backend-lambda/`:

```bash
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=nexcast
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxx
AWS_REGION=us-east-1

# S3 Bucket (for frames)
S3_BUCKET_NAME=nexcast-frames
```

### 7.3 Deploy to AWS

```bash
# Deploy to AWS
serverless deploy

# Or deploy specific function
serverless deploy function -f health
```

### 7.4 Expected Output

```
Deploying nexcast-lambda to stage dev (us-east-1)

✔ Service deployed to stack nexcast-lambda-dev (90s)

endpoints:
  GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/health
  ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/session/{proxy+}
  ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/history/{proxy+}

functions:
  health: nexcast-lambda-dev-health
  session: nexcast-lambda-dev-session
  history: nexcast-lambda-dev-history
```

**Copy the API Gateway URL** and add to Secrets Manager:
```json
{
  "VITE_API_GATEWAY_URL": "https://xxxxx.execute-api.us-east-1.amazonaws.com"
}
```

---

## 8. Frontend Deployment

### 8.1 Setup S3 + CloudFront

#### Create S3 Bucket

```bash
aws s3 mb s3://nexcast.club --region us-east-1

# Enable static website hosting
aws s3 website s3://nexcast.club \
    --index-document index.html \
    --error-document index.html
```

#### Create CloudFront Distribution

1. **Go to CloudFront Console**
2. **Create Distribution:**
   - Origin domain: `nexcast.club.s3.us-east-1.amazonaws.com`
   - Viewer protocol: **Redirect HTTP to HTTPS**
   - Alternate domain names (CNAMEs): `nexcast.club`
   - SSL certificate: Request or import certificate for `nexcast.club`
3. **Copy CloudFront distribution URL**
4. **Update Cloudflare DNS** to point `nexcast.club` to CloudFront URL

---

### 8.2 Pull Secrets and Build

```bash
cd frontend/NexCast

# Pull secrets from AWS Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id NexCastSecrets \
    --region us-east-1 \
    --query SecretString \
    --output text)

# Create .env file
cat > .env <<EOF
VITE_WS_URL=wss://api.nexcast.club/ws
VITE_API_GATEWAY_URL=$(echo $SECRET_JSON | jq -r '.VITE_API_GATEWAY_URL')
VITE_COGNITO_USER_POOL_ID=$(echo $SECRET_JSON | jq -r '.VITE_COGNITO_USER_POOL_ID')
VITE_COGNITO_CLIENT_ID=$(echo $SECRET_JSON | jq -r '.VITE_COGNITO_CLIENT_ID')
VITE_COGNITO_DOMAIN=$(echo $SECRET_JSON | jq -r '.VITE_COGNITO_DOMAIN')
VITE_COGNITO_REGION=us-east-1
VITE_ELEVENLABS_API_KEY=$(echo $SECRET_JSON | jq -r '.VITE_ELEVENLABS_API_KEY')
VITE_TURNSTILE_SITE_KEY=$(echo $SECRET_JSON | jq -r '.VITE_TURNSTILE_SITE_KEY')
EOF

# Build
pnpm install
pnpm build
```

---

### 8.3 Deploy to S3

```bash
# Sync build to S3
aws s3 sync dist/ s3://nexcast.club --delete

# Invalidate CloudFront cache (if needed)
aws cloudfront create-invalidation \
    --distribution-id EXXXXXXXXXXXX \
    --paths "/*"
```

---

### 8.4 Verify Deployment

Visit `https://nexcast.club` in your browser. You should see the NexCast landing page.

---

## 9. Cost Optimization

### 9.1 Stop EC2 When Not in Use

```bash
# Stop instance (keeps EBS volume, ~$1/month storage)
aws ec2 stop-instances --instance-ids i-xxxxxxxxxxxxx

# Restart later
aws ec2 start-instances --instance-ids i-xxxxxxxxxxxxx

# SSH in and run launch script again
ssh -i your-key.pem ubuntu@<NEW_PUBLIC_IP>
./launch.sh
```

### 9.2 Terminate EC2 Completely

```bash
# Terminate (no cost, need to setup certbot again)
aws ec2 terminate-instances --instance-ids i-xxxxxxxxxxxxx
```

**Note:** You'll lose SSL certificates. Need to run certbot again on next launch.

---

### 9.3 Cost Estimates

**Running 24/7:**
- EC2 t2.medium: ~$24/month
- EC2 t2.micro (free tier year 1): $0, then ~$8/month
- Lambda: ~$0.20/month (low traffic)
- S3 + CloudFront: ~$1-3/month
- Secrets Manager: $0.40/month
- **Total:** ~$25-30/month (t2.medium)

**Demo Usage (5 days):**
- EC2 t2.medium: ~$5.50
- Lambda + S3: ~$0.50
- **Total:** ~$6

**Free Tier (first year):**
- EC2 t2.micro: Free (750 hours/month)
- Lambda: Free (1M requests/month)
- S3: Free (5GB storage, 20K GET requests)
- **Total:** ~$1-2/month (Secrets Manager + data transfer)

---

## 10. Troubleshooting

### 10.1 WebSocket Connection Failed

**Symptoms:** Browser console shows `WebSocket connection failed`

**Solutions:**

1. **Check DNS:**
   ```bash
   nslookup api.nexcast.club
   # Should return EC2 public IP
   ```

2. **Check SSL:**
   ```bash
   curl https://api.nexcast.club/health
   # Should return {"status":"healthy"}
   ```

3. **Check Cloudflare:**
   - Ensure `api` subdomain has **Proxy OFF** (gray cloud)
   - SSL mode: **Full** (not Flexible)

4. **Check EC2 Security Group:**
   - Port 443 must allow inbound from 0.0.0.0/0

5. **Check containers:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   # Both nginx and backend should be "Up"
   ```

---

### 10.2 SSL Certificate Issues

**Error:** `NET::ERR_CERT_AUTHORITY_INVALID`

**Solutions:**

1. **Check certificate status:**
   ```bash
   sudo certbot certificates
   ```

2. **Renew certificate:**
   ```bash
   sudo certbot renew --force-renewal
   ```

3. **Restart nginx:**
   ```bash
   docker compose -f docker-compose.prod.yml restart nginx
   ```

4. **Verify ports are free:**
   ```bash
   sudo lsof -i :80 -i :443
   # Stop containers if blocking certbot
   docker compose -f docker-compose.prod.yml down
   # Then re-run certbot
   ```

---

### 10.3 Docker Compose Not Found

**Error:** `bash: docker-compose: command not found`

**Solution:**

```bash
# Install Docker Compose V2
sudo apt-get install -y docker-compose-v2

# Use: docker compose (not docker-compose)
docker compose version
```

---

### 10.4 Container Not Starting

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs
```

**Common issues:**

1. **Environment variables missing:**
   - Check `.env` file exists
   - Verify all required keys are present

2. **Google credentials invalid:**
   ```bash
   cat /opt/nexcast/credentials/google-credentials.json
   # Should be valid JSON
   ```

3. **Port already in use:**
   ```bash
   sudo lsof -i :443
   # Kill process or change port
   ```

4. **Clean everything and restart:**
   ```bash
   docker compose -f docker-compose.prod.yml down
   docker system prune -af
   ./launch.sh
   ```

---

### 10.5 Frontend Not Connecting

**Symptoms:** Frontend loads but WebSocket fails

**Solutions:**

1. **Verify environment variables:**
   ```bash
   cat frontend/NexCast/.env
   # VITE_WS_URL should be wss://api.nexcast.club/ws
   ```

2. **Rebuild frontend:**
   ```bash
   cd frontend/NexCast
   rm -rf dist/
   pnpm build
   aws s3 sync dist/ s3://nexcast.club --delete
   ```

3. **Clear CloudFront cache:**
   ```bash
   aws cloudfront create-invalidation \
       --distribution-id EXXXXXXXXXXXX \
       --paths "/*"
   ```

---

### 10.6 Lambda Function Errors

**Check logs:**
```bash
serverless logs -f session -t
```

**Common issues:**

1. **Database connection failed:**
   - Check RDS security group allows Lambda
   - Verify DB credentials in `.env`

2. **Cognito auth failed:**
   - Verify User Pool ID and Client ID
   - Check JWT token is valid

---

## Quick Reference

### One-Command Deployment (After Initial Setup)

```bash
# On EC2
cd ~ && ./launch.sh

# Local (rebuild and push Docker image)
cd backend-core
docker build --platform linux/amd64 -t $REPO_URI:latest . && docker push $REPO_URI:latest

# Frontend
cd frontend/NexCast
pnpm build && aws s3 sync dist/ s3://nexcast.club --delete
```

---

### Useful Commands

```bash
# Check EC2 instance status
aws ec2 describe-instances --instance-ids i-xxxxx

# View Secrets Manager secret
aws secretsmanager get-secret-value --secret-id NexCastSecrets

# Test WebSocket from command line
websocat wss://api.nexcast.club/ws/test

# Monitor container logs in real-time
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Support

- **Main README:** [README.md](./README.md)
- **Issues:** [GitHub Issues](https://github.com/DizzyDoze/NexCast/issues)
- **Email:** overdosedizzy@gmail.com
