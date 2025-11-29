# NexCast - Live Gaming Commentary Platform

Real-time AI-powered gaming commentary using multi-speaker TTS with WebSocket audio streaming.

## Architecture

**Frontend:** React + Vite → S3 + CloudFront (HTTPS)
**Backend API:** AWS Lambda + API Gateway (serverless REST endpoints)
**Backend WebSocket:** FastAPI + Docker + Nginx → EC2 (real-time frame streaming)
**AI Services:** Gemini Vision, Grok LLM, ElevenLabs TTS

---

## 🔧 Complete Setup Guide

### 1. Domain & DNS (Namecheap + Cloudflare)

#### Initial Domain Setup
1. **Purchase domain** on Namecheap (e.g., `nexcast.club`)
2. **Switch to Cloudflare nameservers:**
   - Go to Namecheap → Domain List → Manage → Domain
   - **Nameservers:** Custom DNS
   - Add Cloudflare nameservers (e.g., `david.ns.cloudflare.com`, `susan.ns.cloudflare.com`)
   - **Note:** You must use Cloudflare nameservers to manage DNS in Cloudflare

#### Cloudflare DNS Records
3. **Login to Cloudflare Dashboard:** https://dash.cloudflare.com
4. **Add DNS records:**

   **Main domain (Frontend - S3/CloudFront):**
   ```
   Type: CNAME
   Name: nexcast.club (or @)
   Target: [CloudFront distribution URL]
   Proxy: ON (orange cloud)
   ```

   **API subdomain (Backend WebSocket - EC2):**
   ```
   Type: A
   Name: api
   Value: [EC2 Public IP]
   Proxy: OFF (gray cloud) ⚠️ CRITICAL - Must be DNS only!
   ```

5. **Why proxy OFF for api subdomain?**
   - Cloudflare proxy breaks WebSocket SSL with Let's Encrypt
   - Direct DNS pointing required for certbot validation

---

### 2. SSL Certificates

#### Frontend (CloudFront - Automatic)
- CloudFront provides free SSL for `nexcast.club`
- No manual setup needed

#### Backend (Let's Encrypt via Certbot)
1. **SSH into EC2**
2. **Install certbot:**
   ```bash
   sudo apt-get install -y certbot
   ```

3. **Get certificate** (requires port 80/443 free):
   ```bash
   sudo certbot certonly --standalone -d api.nexcast.club \
       --non-interactive \
       --agree-tos \
       --email your-email@example.com
   ```

4. **Certificate location:**
   ```
   /etc/letsencrypt/live/api.nexcast.club/fullchain.pem
   /etc/letsencrypt/live/api.nexcast.club/privkey.pem
   ```

5. **Auto-renewal** (certbot sets up cron automatically)
   - Renews at 30 days before expiry
   - Check status: `sudo certbot renew --dry-run`

---

### 3. AWS Cognito (Google OAuth Login)

1. **Create User Pool:**
   - Go to AWS Cognito → Create User Pool
   - Authentication: Federated identity providers
   - Add Google as provider (OAuth 2.0)
   - Configure app client (no client secret)

2. **Google OAuth Setup:**
   - Go to Google Cloud Console → APIs & Credentials
   - Create OAuth 2.0 Client ID
   - Authorized redirect URIs: `https://[cognito-domain].auth.[region].amazoncognito.com/oauth2/idpresponse`
   - Copy Client ID/Secret to Cognito

3. **Configure Cognito Domain:**
   - Add Cognito domain: `https://[your-prefix].auth.us-east-1.amazoncognito.com`

4. **Frontend Environment Variables:**
   ```bash
   VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
   VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxx
   VITE_COGNITO_DOMAIN=https://[prefix].auth.us-east-1.amazoncognito.com
   VITE_COGNITO_REGION=us-east-1
   ```

---

### 4. Cloudflare Turnstile (Captcha)

1. **Get Turnstile keys:**
   - Go to Cloudflare → Turnstile
   - Add site: `nexcast.club`
   - Widget mode: Managed
   - Copy Site Key

2. **Add to frontend .env:**
   ```bash
   VITE_TURNSTILE_SITE_KEY=0x4xxxxxxxxxxxxxx
   ```

3. **Frontend implementation:**
   - Uses `@marsidev/react-turnstile` package
   - Shows captcha before Google login
   - Located in: `frontend/NexCast/src/App.tsx`

---

### 5. AWS Secrets Manager

**Store all sensitive credentials in one secret:**

1. **Create secret:** `nexcast-secrets`
2. **Add key-value pairs:**
   ```json
   {
     "GEMINI_API_KEY": "your-gemini-key",
     "XAI_API_KEY": "your-grok-key",
     "ELEVENLABS_API_KEY": "your-elevenlabs-key",
     "GOOGLE_APPLICATION_CREDENTIALS_JSON": "{\"type\":\"service_account\",...}",
     "VITE_COGNITO_USER_POOL_ID": "us-east-1_xxxxx",
     "VITE_COGNITO_CLIENT_ID": "xxxxxxxxxxxx",
     "VITE_COGNITO_DOMAIN": "https://xxxxx.auth.us-east-1.amazoncognito.com",
     "VITE_API_GATEWAY_URL": "https://xxxxx.execute-api.us-east-1.amazonaws.com",
     "VITE_ELEVENLABS_API_KEY": "sk_xxxxx",
     "VITE_TURNSTILE_SITE_KEY": "0x4xxxxx"
   }
   ```

**Note:** Frontend pulls from Secrets Manager at build time for security.

---

### 6. EC2 Instance Setup

#### Launch Instance
1. **Instance type:** t2.medium (demo) or t2.micro (free tier)
2. **AMI:** Ubuntu 24.04 LTS
3. **Security Group:**
   ```
   Port 22  (SSH)   - Your IP
   Port 443 (HTTPS) - 0.0.0.0/0
   ```

4. **IAM Instance Role:** Attach policies:
   - `AmazonEC2ContainerRegistryReadOnly` (pull Docker images)
   - `SecretsManagerReadWrite` (read secrets)

#### Initial Setup (One-time)
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<PUBLIC_IP>

# Install dependencies
sudo apt-get update
sudo apt-get install -y docker.io awscli jq certbot

# Install Docker Compose V2
sudo apt-get install -y docker-compose-v2

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Get Let's Encrypt certificate
sudo certbot certonly --standalone -d api.nexcast.club \
    --non-interactive --agree-tos --email your-email@example.com
```

#### Quick Launch (Anytime)
```bash
# Download launch script
curl -O https://raw.githubusercontent.com/DizzyDoze/NexCast/main/backend-core/deploy/launch.sh
chmod +x launch.sh

# Run it
./launch.sh
```

**What launch.sh does:**
1. Cleans old containers/images
2. Logs into AWS ECR
3. Pulls secrets from Secrets Manager
4. Creates `.env` file
5. Sets up nginx config
6. Creates docker-compose.prod.yml
7. Pulls latest Docker images
8. Starts backend + nginx containers

---

### 7. Docker Deployment

#### Architecture
```
nginx (port 443) → FastAPI (port 8000)
     ↓
  SSL termination
  WebSocket proxy
```

#### docker-compose.prod.yml
```yaml
services:
  backend:
    image: [ECR_URI]/nexcast-backend:latest
    volumes:
      - /opt/nexcast/credentials:/app/credentials:ro
    environment:
      - GEMINI_API_KEY
      - XAI_API_KEY
      - ELEVENLABS_API_KEY

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

#### Manual Management
```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop everything
docker compose -f docker-compose.prod.yml down

# Update to latest image
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

### 8. AWS Lambda Deployment

```bash
cd backend-lambda
serverless deploy
```

**Endpoints:**
- `/health` - Health check
- `/session/*` - Session management (POST, GET)
- `/history/*` - Session history (GET)

**Configured in:** `backend-lambda/serverless.yml`

---

### 9. Frontend Deployment

```bash
cd frontend/NexCast

# Build
pnpm build

# Deploy to S3
aws s3 sync dist/ s3://nexcast.club --delete

# CloudFront invalidation (if needed)
aws cloudfront create-invalidation \
    --distribution-id [DISTRIBUTION_ID] \
    --paths "/*"
```

**Environment Variables:**
```bash
VITE_WS_URL=wss://api.nexcast.club/ws
VITE_API_GATEWAY_URL=https://[api-id].execute-api.us-east-1.amazonaws.com
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_ELEVENLABS_API_KEY=sk_xxxxx
VITE_TURNSTILE_SITE_KEY=0x4xxxxx
```

---

## 🚀 Quick Start Checklist

### First Time Setup
- [ ] Purchase domain on Namecheap
- [ ] Add Cloudflare nameservers to Namecheap
- [ ] Configure Cloudflare DNS (`api` subdomain as A record, proxy OFF)
- [ ] Setup Google OAuth in Google Cloud Console
- [ ] Create AWS Cognito User Pool with Google provider
- [ ] Get Cloudflare Turnstile site key
- [ ] Store all secrets in AWS Secrets Manager
- [ ] Launch EC2 instance with proper security group
- [ ] Install certbot and get SSL cert for `api.nexcast.club`
- [ ] Build Docker image and push to ECR

### Every Launch (After Stopping EC2)
1. Start EC2 instance
2. SSH into instance
3. Run `./launch.sh` (downloads from repo if needed)
4. Update frontend `.env` if EC2 IP changed
5. Rebuild and deploy frontend
6. Test: `curl https://api.nexcast.club/health`

### Development Workflow
1. Make changes locally
2. Build Docker image: `docker build --platform linux/amd64 -t [ECR_URI]:latest .`
3. Push to ECR: `docker push [ECR_URI]:latest`
4. On EC2: `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`
5. Deploy frontend: `pnpm build && aws s3 sync dist/ s3://nexcast.club --delete`

---

## 💰 Cost Optimization

**When not using:**
```bash
# Stop EC2 instance (keeps EBS volume, ~$1/month storage)
aws ec2 stop-instances --instance-ids i-xxxxx

# Terminate completely (no cost, need to setup certbot again next time)
aws ec2 terminate-instances --instance-ids i-xxxxx
```

**Estimated Costs (running 24/7):**
- EC2 t2.medium: ~$24/month
- EC2 t2.micro (free tier): $0 first year, ~$8/month after
- Lambda: Pay per request (negligible for low traffic)
- S3 + CloudFront: ~$1-3/month
- Secrets Manager: $0.40/month

**Demo Usage (5 days):**
- EC2 t2.medium: ~$5.50
- Total: ~$6

---

## 📁 Project Structure

```
NexCast/
├── backend-core/              # FastAPI WebSocket server
│   ├── app/
│   │   ├── routes/           # WebSocket endpoints
│   │   └── services/         # Vision, LLM, TTS services
│   ├── deploy/
│   │   └── launch.sh         # Automated EC2 deployment
│   ├── Dockerfile            # Backend container image
│   ├── docker-compose.prod.yml
│   └── nginx.conf            # SSL proxy configuration
│
├── backend-lambda/           # Serverless REST API
│   ├── functions/            # Lambda handlers
│   └── serverless.yml        # Infrastructure config
│
└── frontend/NexCast/         # React frontend
    ├── src/
    │   ├── hooks/            # useWebSocketAudio hook
    │   └── pages/            # Playground, History, About
    └── .env                  # Environment configuration
```

---

## 🐛 Troubleshooting

### WebSocket Connection Failed
- Check DNS: `nslookup api.nexcast.club` (should return EC2 IP)
- Check SSL: `curl https://api.nexcast.club/health`
- Check Cloudflare: Ensure `api` subdomain has proxy OFF (gray cloud)
- Check EC2 security group: Port 443 must be open

### Let's Encrypt Certificate Issues
- Ensure ports 80/443 are free: `sudo lsof -i :80 -i :443`
- Stop containers: `docker compose down`
- Re-run certbot
- Restart containers

### Docker Compose Not Found
- Ubuntu 24.04 requires: `sudo apt-get install -y docker-compose-v2`
- Use: `docker compose` (not `docker-compose`)

### Frontend Not Connecting to Backend
- Verify `VITE_WS_URL=wss://api.nexcast.club/ws` in `.env`
- Rebuild frontend: `pnpm build`
- Redeploy to S3

---

## 📚 Key Documentation

- [Docker Compose V2](https://docs.docker.com/compose/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
- [AWS Cognito](https://docs.aws.amazon.com/cognito/)
- [Cloudflare DNS](https://developers.cloudflare.com/dns/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)

---

## 🔐 Security Notes

- **Never commit `.env` files** - stored in AWS Secrets Manager
- **API keys in frontend** are exposed (use CORS + rate limiting)
- **EC2 SSH key** stored locally, never in repo
- **Let's Encrypt certs** auto-renew, mounted read-only to containers
- **Google credentials** stored as JSON string in Secrets Manager

---

## License

MIT
