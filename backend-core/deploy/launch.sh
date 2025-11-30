#!/bin/bash
# NexCast Quick Launch Script
# Run this on EC2 to start everything from scratch

set -e

echo "NexCast Quick Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configuration
REGION="us-east-1"
ACCOUNT_ID="970547374353"
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/nexcast-backend"
PROJECT_DIR="$HOME/nexcast"

# 1. Clean up old containers and images
echo "Cleaning up old containers and images..."
docker stop nexcast-backend nexcast-nginx 2>/dev/null || true
docker rm nexcast-backend nexcast-nginx 2>/dev/null || true
docker system prune -af --volumes

# 2. Create project directory
echo "Setting up project directory..."
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 3. Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# 4. Pull secrets from AWS Secrets Manager
echo "Fetching secrets from AWS Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id NexCastSecrets \
    --region "$REGION" \
    --query SecretString \
    --output text)

# 5. Extract secrets
GEMINI_KEY=$(echo "$SECRET_JSON" | jq -r '.GEMINI_API_KEY')
XAI_KEY=$(echo "$SECRET_JSON" | jq -r '.XAI_API_KEY')
ELEVENLABS_KEY=$(echo "$SECRET_JSON" | jq -r '.ELEVENLABS_API_KEY')
GOOGLE_CREDS=$(echo "$SECRET_JSON" | jq -r '.GOOGLE_APPLICATION_CREDENTIALS')

# 6. Create .env file
echo "Creating environment file..."
cat > .env <<EOF
GEMINI_API_KEY=$GEMINI_KEY
XAI_API_KEY=$XAI_KEY
ELEVENLABS_API_KEY=$ELEVENLABS_KEY
EOF

# 7. Setup Google credentials
echo "Setting up Google credentials..."
sudo mkdir -p /opt/nexcast/credentials
echo "$GOOGLE_CREDS" | sudo tee /opt/nexcast/credentials/google-credentials.json > /dev/null

# 8. Create nginx configuration
echo "Creating nginx config..."
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

# 9. Create docker-compose.prod.yml
echo "Creating docker-compose configuration..."
cat > docker-compose.prod.yml <<EOF
services:
  backend:
    image: $ECR_REPO:latest
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

# 10. Pull latest images
echo "Pulling latest Docker images..."
docker compose -f docker-compose.prod.yml pull

# 11. Start services
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# 12. Wait a few seconds for services to start
echo "Waiting for services to start..."
sleep 5

# 13. Check status
echo ""
echo "Launch complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Container Status:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Testing health endpoint..."
curl -s https://api.nexcast.club/health || echo "Health check failed (may need a moment to start)"
echo ""
echo "Useful commands:"
echo "  View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:      docker compose -f docker-compose.prod.yml restart"
echo "  Stop:         docker compose -f docker-compose.prod.yml down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
