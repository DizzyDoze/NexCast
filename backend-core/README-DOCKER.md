# Docker Deployment Guide

## 🛠️ Local Development

### Setup
```bash
# 1. Ensure you have credentials
cp .env.example app/config/.env
# Edit app/config/.env with your API keys

# 2. Ensure Google credentials exist
# Place your google-credentials.json in app/config/

# 3. Build image
docker compose -f docker-compose.dev.yml build

# 4. Run locally
docker compose -f docker-compose.dev.yml up

# 5. Test
curl http://localhost:8000/health
```

### Stop
```bash
docker compose -f docker-compose.dev.yml down
```

---

## 🚀 Production (EC2)

### Build and Push to ECR
```bash
# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
REPO_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/nexcast-backend"

# Authenticate to ECR
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $REPO_URI

# Build for Linux
docker build --platform linux/amd64 -t $REPO_URI:latest .

# Push to ECR
docker push $REPO_URI:latest
```

### EC2 Launch (Manual via Console)
1. **AMI:** Ubuntu 24.04 LTS
2. **Instance Type:** t2.medium
3. **Security Group:** Allow port 8000 + 22
4. **IAM Role:** `AmazonEC2ContainerRegistryReadOnly` + `SecretsManagerReadWrite`
5. **User Data:**

```bash
#!/bin/bash
set -e

apt-get update
apt-get install -y docker.io awscli jq

systemctl start docker
systemctl enable docker

REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
ACCOUNT_ID=<YOUR_ACCOUNT_ID>

# Login to ECR
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Pull secrets
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id nexcast-secrets \
    --region $REGION \
    --query SecretString \
    --output text)

GEMINI_KEY=$(echo $SECRET_JSON | jq -r '.GEMINI_API_KEY')
XAI_KEY=$(echo $SECRET_JSON | jq -r '.XAI_API_KEY')
ELEVENLABS_KEY=$(echo $SECRET_JSON | jq -r '.ELEVENLABS_API_KEY')
GOOGLE_CREDS=$(echo $SECRET_JSON | jq -r '.GOOGLE_APPLICATION_CREDENTIALS_JSON')

# Setup credentials
mkdir -p /opt/nexcast/credentials
echo "$GOOGLE_CREDS" > /opt/nexcast/credentials/google-credentials.json

# Run container
docker run -d \
    --name nexcast-backend \
    --restart unless-stopped \
    -p 8000:8000 \
    -v /opt/nexcast/credentials:/app/credentials:ro \
    -e GEMINI_API_KEY="$GEMINI_KEY" \
    -e XAI_API_KEY="$XAI_KEY" \
    -e ELEVENLABS_API_KEY="$ELEVENLABS_KEY" \
    -e GOOGLE_APPLICATION_CREDENTIALS="/app/credentials/google-credentials.json" \
    $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/nexcast-backend:latest
```

### Alternative: SSH and Run Manually
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<PUBLIC_IP>

# Pull secrets and run (same commands as user data)
# ... see user data script above
```

---

## 📁 File Structure

```
backend-core/
├── docker-compose.dev.yml   # Local development
├── docker-compose.yml        # Production reference (not used on EC2)
├── Dockerfile                # Production image
├── .dockerignore
├── .env.example
└── app/
    └── config/
        ├── .env              # Local API keys (gitignored)
        └── google-credentials.json  # Local Google creds (gitignored)
```

---

## 🔑 AWS Secrets Manager Keys

Add these to your `nexcast-secrets` secret:

```json
{
  "GEMINI_API_KEY": "...",
  "XAI_API_KEY": "...",
  "ELEVENLABS_API_KEY": "...",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON": "{\"type\":\"service_account\",\"project_id\":\"...\",...}",
  "VITE_WS_URL": "ws://<EC2_PUBLIC_IP>:8000/ws",
  "VITE_COGNITO_USER_POOL_ID": "...",
  "VITE_COGNITO_CLIENT_ID": "...",
  "VITE_COGNITO_DOMAIN": "...",
  "VITE_API_GATEWAY_URL": "...",
  "VITE_ELEVENLABS_API_KEY": "...",
  "VITE_TURNSTILE_SITE_KEY": "..."
}
```

---

## 💡 Quick Commands

```bash
# Local dev
docker compose -f docker-compose.dev.yml up --build

# Build for production
docker build --platform linux/amd64 -t nexcast-backend:latest .

# Test production image locally
docker run -p 8000:8000 \
  -e GEMINI_API_KEY="..." \
  -e XAI_API_KEY="..." \
  -e ELEVENLABS_API_KEY="..." \
  -v $(pwd)/app/config/google-credentials.json:/app/credentials/google-credentials.json:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS="/app/credentials/google-credentials.json" \
  nexcast-backend:latest
```
