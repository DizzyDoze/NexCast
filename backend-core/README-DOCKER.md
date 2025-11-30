# Docker Deployment Guide

## 🏗️ Architecture

**Production Setup:**
```
Internet (HTTPS/WSS)
    ↓
Nginx Container (port 443) - SSL termination
    ↓
FastAPI Backend Container (port 8000) - WebSocket server
```

**Two-container architecture:**
- **nginx:** Handles SSL with Let's Encrypt, proxies to backend
- **backend:** FastAPI WebSocket server with AI services

---

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

## 🚀 Production (EC2 with docker-compose)

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

### Prerequisites (One-time EC2 Setup)

1. **Launch EC2 Instance:**
   - **AMI:** Ubuntu 24.04 LTS
   - **Instance Type:** t2.medium (or t2.micro for free tier)
   - **Security Group:** Allow port 443 (HTTPS) + 22 (SSH)
   - **IAM Role:** `AmazonEC2ContainerRegistryReadOnly` + `SecretsManagerReadWrite`

2. **Install Dependencies:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-v2 awscli jq certbot
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker ubuntu
   newgrp docker
   ```

3. **Get Let's Encrypt SSL Certificate:**
   ```bash
   sudo certbot certonly --standalone -d api.nexcast.club \
       --non-interactive --agree-tos --email your-email@example.com
   ```

   **Certificate location:**
   - `/etc/letsencrypt/live/api.nexcast.club/fullchain.pem`
   - `/etc/letsencrypt/live/api.nexcast.club/privkey.pem`

### Quick Launch (Automated)

**Use the launch script for one-command deployment:**

```bash
# Download and run
curl -O https://raw.githubusercontent.com/DizzyDoze/NexCast/main/backend-core/deploy/launch.sh
chmod +x launch.sh
./launch.sh
```

**What it does:**
1. Cleans old containers and images
2. Logs into AWS ECR
3. Pulls secrets from Secrets Manager
4. Creates `.env`, `nginx.conf`, `docker-compose.prod.yml`
5. Pulls latest images
6. Starts nginx + backend containers
7. Tests health endpoint

### Manual Deployment (Step-by-Step)

```bash
# 1. Create project directory
mkdir -p ~/nexcast && cd ~/nexcast

# 2. Login to ECR
REGION=us-east-1
ACCOUNT_ID=970547374353
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# 3. Get secrets and create .env
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id nexcast-secrets \
    --region $REGION \
    --query SecretString \
    --output text)

cat > .env <<EOF
GEMINI_API_KEY=$(echo $SECRET_JSON | jq -r '.GEMINI_API_KEY')
XAI_API_KEY=$(echo $SECRET_JSON | jq -r '.XAI_API_KEY')
ELEVENLABS_API_KEY=$(echo $SECRET_JSON | jq -r '.ELEVENLABS_API_KEY')
EOF

# 4. Setup Google credentials
GOOGLE_CREDS=$(echo $SECRET_JSON | jq -r '.GOOGLE_APPLICATION_CREDENTIALS_JSON')
sudo mkdir -p /opt/nexcast/credentials
echo "$GOOGLE_CREDS" | sudo tee /opt/nexcast/credentials/google-credentials.json > /dev/null

# 5. Create nginx.conf
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

# 6. Create docker-compose.prod.yml
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

# 7. Pull and start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 8. Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

---

## 🔧 Production Management Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific container logs
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

# Execute command in backend container
docker exec -it nexcast-backend bash
```

---

## 🧪 Testing

```bash
# Test health endpoint (should return 200 OK)
curl https://api.nexcast.club/health

# Expected response:
# {"status":"healthy","service":"nexcast-api"}

# Test WebSocket connection (from browser console)
const ws = new WebSocket('wss://api.nexcast.club/ws/123');
ws.onopen = () => console.log('Connected!');
```

---

## 📁 File Structure

```
backend-core/
├── deploy/
│   └── launch.sh            # Automated EC2 deployment script
├── docker-compose.dev.yml   # Local development
├── docker-compose.prod.yml  # Production (created by launch.sh)
├── Dockerfile               # Backend container image
├── nginx.conf               # Nginx SSL proxy config (created by launch.sh)
├── .dockerignore
├── .env.example
└── app/
    ├── routes/
    │   └── ws_stream.py     # WebSocket endpoint
    ├── services/
    │   ├── vision.py        # Gemini Vision
    │   ├── llm.py           # Grok LLM
    │   └── tts.py           # ElevenLabs TTS
    └── config/
        ├── .env             # Local API keys (gitignored)
        └── google-credentials.json  # Local (gitignored)
```

---

## 🐛 Troubleshooting

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Restart nginx after renewal
docker compose -f docker-compose.prod.yml restart nginx
```

### Container Not Starting
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check if ports are in use
sudo lsof -i :443

# Clean everything and restart
docker compose -f docker-compose.prod.yml down
docker system prune -af
./launch.sh
```

### WebSocket Connection Failed
```bash
# Test nginx is running
docker ps | grep nginx

# Test backend is accessible from nginx
docker exec nexcast-nginx wget -O- http://backend:8000/health

# Check nginx config syntax
docker exec nexcast-nginx nginx -t
```

---

## 💰 Cost Optimization

**When not using (stop EC2 to save money):**
```bash
# From your local machine
aws ec2 stop-instances --instance-ids i-xxxxx

# Next time: Start instance, SSH in, run ./launch.sh
```

**Estimated costs:**
- **Running 24/7:** ~$24/month (t2.medium) or ~$8/month (t2.micro)
- **5-day demo:** ~$5.50 (t2.medium)
- **Stopped instance:** ~$1/month (EBS storage only)

---

## 🔐 Security Notes

- nginx container runs as root (required for port 443)
- Backend container runs as default user
- Let's Encrypt certificates auto-renew via certbot cron
- Secrets pulled from AWS Secrets Manager at launch
- Google credentials mounted read-only
- All inter-container communication via private bridge network
