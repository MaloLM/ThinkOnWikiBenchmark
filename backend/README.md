# ⚙️ Wikikig Benchmark Backend

This is the FastAPI-powered backend for the Wikikig Benchmark.

## 🚀 Features
- **Wikipedia Orchestrator**: Manages the game logic, link anonymization, and state.
- **LLM Clients**: Support for OpenAI-compatible APIs and LangChain-powered structured output.
- **Real-time Streaming**: WebSocket integration for live benchmark monitoring.
- **Archive Management**: Automated storage and retrieval of benchmark runs and metrics.

## 🛠 Tech Stack
- **FastAPI**: High-performance web framework.
- **LangChain**: For structured LLM interactions.
- **Httpx**: Asynchronous HTTP client for Wikipedia API.
- **Pydantic**: Data validation and settings management.

## 📂 Structure
- `app/api/`: API endpoints and WebSocket handlers.
- `app/services/`: Core logic (Orchestrator, Wiki Client, LLM Client).
- `app/models/`: Pydantic schemas.
- `archives/`: JSON storage for benchmark results.

For main documentation and setup instructions, please refer to the [root README](../README.md).
