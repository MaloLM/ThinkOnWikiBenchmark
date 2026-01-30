# Docker Setup Guide

This guide explains how to run ThinkOnWikiBenchmark using Docker.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop for macOS (or Docker Engine + Docker Compose)
- At least 4GB of RAM allocated to Docker

### 1. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Build and Run

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📋 Common Commands

```bash
# Start services (after initial build)
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild after code changes
docker-compose up --build

# Restart a specific service
docker-compose restart backend

# Execute command in running container
docker-compose exec backend python -c "print('Hello')"

# Access backend shell
docker-compose exec backend /bin/bash

# Access frontend shell
docker-compose exec frontend /bin/sh
```

## 🗂️ Volume Management

### Archives Volume

The `archives` volume persists benchmark results. By default, it's bound to `./src/backend/archives`.

To use a different location, set `ARCHIVES_PATH` in `.env`:
```
ARCHIVES_PATH=/Users/malo/my-archives
```

### Backup Archives

```bash
# Create backup
docker run --rm -v thinkonwikibenchmark_archives:/data -v $(pwd):/backup alpine tar czf /backup/archives-backup.tar.gz -C /data .

# Restore backup
docker run --rm -v thinkonwikibenchmark_archives:/data -v $(pwd):/backup alpine tar xzf /backup/archives-backup.tar.gz -C /data
```

### Clean Up Volumes

⚠️ **Warning**: This will delete all archived benchmark data!

```bash
# Stop and remove containers with volumes
docker-compose down -v
```

## 🔧 Development Mode

For development with hot-reload:

### Backend Development
```bash
# Run backend locally with volume mount
docker-compose -f docker-compose.dev.yml up backend
```

### Frontend Development
```bash
# Run frontend with hot-reload
cd src/frontend
npm run dev
```

## 🏗️ Architecture

### Multi-Stage Builds

Both Dockerfiles use multi-stage builds for optimization:

**Backend**:
- Stage 1: Install dependencies with `uv` (faster than pip)
- Stage 2: Slim runtime image (~150MB)

**Frontend**:
- Stage 1: Build React app with Node.js
- Stage 2: Serve with Nginx Alpine (~25MB)

### Security Features

- ✅ Non-root users in containers
- ✅ Minimal base images (Alpine/Slim)
- ✅ Security headers in Nginx
- ✅ Health checks for automatic recovery
- ✅ Network isolation

### Performance Features

- ✅ Layer caching optimization
- ✅ Gzip compression
- ✅ Static asset caching
- ✅ Optimized Nginx configuration

## 🐛 Troubleshooting

### Port Already in Use

If ports 3000 or 8000 are already in use, modify `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:8000"  # Change host port
  frontend:
    ports:
      - "3001:80"    # Change host port
```

### Permission Issues with Archives

```bash
# Fix permissions on macOS
sudo chown -R $(whoami) ./src/backend/archives
```

### Container Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Health Check Failing

```bash
# Check backend health
curl http://localhost:8000/archives

# Check frontend health
curl http://localhost:3000/health
```

## 🌐 Production Deployment

For production deployment:

1. Update `.env` with production URLs:
```
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

2. Use a reverse proxy (Nginx/Traefik) for SSL termination

3. Consider using Docker Swarm or Kubernetes for orchestration

4. Set up proper backup strategy for archives volume

5. Configure monitoring and logging

## 📊 Resource Usage

Typical resource usage:
- **Backend**: ~200MB RAM, <5% CPU (idle)
- **Frontend**: ~10MB RAM, <1% CPU
- **Total**: ~210MB RAM

During benchmark runs, backend may use more CPU and RAM depending on the models being tested.

## 🔄 Updates

To update the application:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

## 📝 Notes

- The backend uses `uvicorn` with a single worker. For production, consider using multiple workers or Gunicorn.
- WebSocket connections are supported through the backend service.
- Archives are persisted in a Docker volume, ensuring data survives container restarts.
- The frontend is built at container build time, so changes require rebuilding the image.
