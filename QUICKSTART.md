# 🚀 Quick Start with Docker

Get ThinkOnWikiBenchmark running in 3 simple steps!

## Prerequisites
- Docker Desktop for macOS installed and running
- At least 4GB RAM allocated to Docker

## Step 1: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

## Step 2: Build and Start

```bash
# Build and start all services
docker-compose up --build
```

This will:
- Build the backend (Python FastAPI) container
- Build the frontend (React + Vite) container
- Start both services with health checks
- Mount the archives volume for persistent data

## Step 3: Access the Application

Once you see "Application startup complete" in the logs:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Common Commands

```bash
# Run in background (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up --build
```

## What's Included?

✅ **Multi-stage Docker builds** for optimal image size  
✅ **Security**: Non-root users, minimal base images  
✅ **Performance**: Layer caching, Gzip compression  
✅ **Persistence**: Archives volume for benchmark data  
✅ **Health checks**: Automatic container recovery  
✅ **Network isolation**: Internal bridge network  

## Need More Details?

See [DOCKER.md](./DOCKER.md) for comprehensive documentation including:
- Volume management and backups
- Development mode setup
- Troubleshooting guide
- Production deployment tips
- Architecture details

## Troubleshooting

**Port already in use?**
Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "8001:8000"  # Backend
  - "3001:80"    # Frontend
```

**Permission issues?**
```bash
sudo chown -R $(whoami) ./backend/archives
```

**Need help?**
Check the logs: `docker-compose logs -f`
