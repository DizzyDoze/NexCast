# NexCast

Real-time AI-powered gaming commentary platform using multi-speaker text-to-speech with WebSocket audio streaming.

## Overview

NexCast analyzes your gameplay in real-time and generates dynamic, multi-speaker commentary. Upload screenshots from your game, and AI-powered commentators provide instant analysis, banter, and insights - all streamed back to you as audio in real-time.

**Perfect for:** Streamers, content creators, or anyone who wants AI commentary on their gameplay.

---

## Features

- **Real-time Frame Analysis** - Gemini Vision processes gameplay screenshots instantly
- **AI-Powered Commentary** - Grok LLM generates contextual, engaging dialogue
- **Multi-Speaker TTS** - ElevenLabs creates natural conversations between commentators
- **WebSocket Streaming** - Sub-second latency audio streaming directly to your browser
- **Session History** - Review past commentary sessions and track your gameplay
- **Google OAuth** - Secure authentication via AWS Cognito
- **Cloudflare Turnstile** - Bot protection on login

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React + Vite → S3 + CloudFront (nexcast.club)              │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────────┐
│ REST API     │    │ WebSocket Server     │
│ Lambda       │    │ EC2 + Docker         │
│ (Serverless) │    │ (api.nexcast.club)   │
└──────────────┘    └──────────────────────┘
        │                    │
        │                    │
        ▼                    ▼
┌──────────────────────────────────────┐
│         External AI Services         │
│  • Gemini Vision (image analysis)    │
│  • Grok LLM (commentary generation)  │
│  • ElevenLabs (text-to-speech)       │
└──────────────────────────────────────┘
```

**Why Hybrid Architecture?**
- **Lambda (REST):** Cost-effective for session management, history, and auth
- **EC2 (WebSocket):** Required for persistent connections and real-time streaming
- **Best of Both:** Minimize costs while maintaining real-time performance

---

## Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS 4
- **Auth:** react-oidc-context (AWS Cognito)
- **Hosting:** AWS S3 + CloudFront

### Backend - REST API
- **Runtime:** AWS Lambda (Node.js)
- **Framework:** Serverless Framework
- **Database:** AWS RDS (PostgreSQL)
- **Auth:** AWS Cognito + JWT

### Backend - WebSocket Server
- **Framework:** FastAPI (Python 3.11)
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Nginx (SSL termination)
- **Hosting:** AWS EC2 (Ubuntu 24.04)
- **Registry:** AWS ECR

### AI Services
- **Vision:** Google Gemini 1.5 Flash
- **LLM:** xAI Grok
- **TTS:** ElevenLabs (multi-speaker)

### Infrastructure
- **DNS:** Cloudflare
- **SSL:** Let's Encrypt (certbot)
- **Secrets:** AWS Secrets Manager
- **CDN:** CloudFront

---

## Workflow

1. **User uploads gameplay frame** via frontend
2. **Frontend sends frame** to WebSocket server (`wss://api.nexcast.club/ws/{sessionId}`)
3. **Backend processes frame** through AI pipeline:
   - Gemini Vision analyzes the image
   - Grok generates commentary based on analysis
   - ElevenLabs converts text to multi-speaker audio
4. **Audio chunks stream back** to frontend in real-time
5. **Browser plays audio** immediately as chunks arrive
6. **Session saved** via Lambda REST API for history

**Latency:** Typically 2-5 seconds from frame upload to first audio chunk.

---

## Project Structure

```
NexCast/
├── frontend/NexCast/              # React frontend
│   ├── src/
│   │   ├── hooks/                # useWebSocketAudio (WebSocket client)
│   │   ├── pages/                # Playground, History, About
│   │   ├── components/           # UI components
│   │   └── lib/                  # Utils, auth, API client
│   └── .env                      # Environment variables
│
├── backend-core/                  # FastAPI WebSocket server
│   ├── app/
│   │   ├── routes/               # WebSocket endpoint (/ws/{sessionId})
│   │   ├── services/
│   │   │   ├── vision.py        # Gemini Vision integration
│   │   │   ├── llm.py           # Grok LLM integration
│   │   │   ├── tts.py           # ElevenLabs TTS
│   │   │   └── pipeline.py      # Orchestration
│   │   └── main.py              # FastAPI app
│   ├── deploy/
│   │   └── launch.sh            # Automated EC2 deployment
│   ├── Dockerfile               # Container image
│   ├── docker-compose.dev.yml   # Local development
│   └── nginx.conf               # SSL reverse proxy config
│
└── backend-lambda/                # Serverless REST API
    ├── functions/
    │   ├── session.py            # Session CRUD
    │   ├── history.py            # History retrieval
    │   └── auth.py               # Cognito auth
    ├── db/
    │   └── connection.py         # PostgreSQL connection
    └── serverless.yml            # Infrastructure as code
```

---

## Getting Started

### Prerequisites
- AWS Account (Lambda, EC2, RDS, S3, CloudFront, Cognito, Secrets Manager)
- Domain name (we use Namecheap + Cloudflare)
- API Keys: Google AI, xAI, ElevenLabs
- Google OAuth credentials

### Quick Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/DizzyDoze/NexCast.git
   cd NexCast
   ```

2. **Follow the deployment guide**
   See [README-DEPLOY.md](./README-DEPLOY.md) for complete setup instructions.

3. **Cost Estimation**
   - **Development/Demo:** ~$6 for 5 days (stop EC2 when not in use)
   - **Production 24/7:** ~$25-30/month
   - **Free Tier:** Use t2.micro EC2 for free first year

---

## Development

### Local Development - Frontend
```bash
cd frontend/NexCast
pnpm install
pnpm dev
```

### Local Development - WebSocket Server
```bash
cd backend-core
docker compose -f docker-compose.dev.yml up
```

### Local Development - Lambda API
```bash
cd backend-lambda
pnpm install
serverless offline
```

---

## Environment Variables

### Frontend (`.env`)
```bash
VITE_WS_URL=wss://api.nexcast.club/ws
VITE_API_GATEWAY_URL=https://[api-id].execute-api.us-east-1.amazonaws.com
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_COGNITO_DOMAIN=https://[prefix].auth.us-east-1.amazoncognito.com
VITE_ELEVENLABS_API_KEY=sk_xxxxx
VITE_TURNSTILE_SITE_KEY=0x4xxxxx
```

### Backend (from AWS Secrets Manager)
```json
{
  "GEMINI_API_KEY": "your-key",
  "XAI_API_KEY": "your-key",
  "ELEVENLABS_API_KEY": "your-key",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON": "{...}"
}
```

---

## Deployment

See [README-DEPLOY.md](./README-DEPLOY.md) for:
- DNS & SSL setup
- AWS infrastructure configuration
- Docker deployment to EC2
- Lambda deployment
- Frontend deployment to S3/CloudFront
- Cost optimization strategies

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Roadmap

- [ ] Support for video streaming (not just frames)
- [ ] Multiple commentary styles (sports, podcast, educational)
- [ ] Custom voice training
- [ ] Multi-language support
- [ ] Real-time game state detection
- [ ] Twitch/YouTube integration

---

## License

MIT

---

## Acknowledgments

- **Gemini Vision** for fast, accurate image analysis
- **xAI Grok** for engaging commentary generation
- **ElevenLabs** for natural multi-speaker TTS
- **Anthropic Claude** for code assistance

---

## Support

- **Issues:** [GitHub Issues](https://github.com/DizzyDoze/NexCast/issues)
- **Deployment Guide:** [README-DEPLOY.md](./README-DEPLOY.md)
- **Email:** overdosedizzy@gmail.com
