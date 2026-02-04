# Wikikig Benchmark

[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](./QUICKSTART.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg)](https://reactjs.org/)

**Wikikig Benchmark** is a sophisticated evaluation framework designed to test the reasoning, navigation, and long-context capabilities of Large Language Models (LLMs). By challenging models to play the "Wikipedia Game," it provides deep insights into how AI agents plan, backtrack, and handle hallucinations in complex information spaces.

---

## The Core Concept: The Wikipedia Game

The goal is simple but the execution is complex: **Navigate from a starting Wikipedia page to a target page using only internal links.**

### Why this matters for LLM Evaluation:

- **Reasoning & Planning**: Models must understand the semantic relationship between the current page and the target.
- **Hallucination Tracking**: We anonymize links (e.g., `[CONCEPT_01: Science]`) to ensure the model relies on the provided context rather than just pre-trained knowledge, making it easy to detect when a model "invents" a path.
- **Backtracking & Recovery**: Tests the model's ability to recognize a dead-end and return to a previous state.
- **Structured Output**: Evaluates the model's reliability in following strict navigation protocols.

---

## Key Features

- **Multi-Model Benchmarking**: Run the same challenge across multiple models (GPT-4, Claude... via NanoGPT) sequentially to compare performance.
- **Real-Time Visualization**: Watch the model's "thought process" live with an interactive D3.js graph showing the path taken.
- **Deep Metrics**:
  - **Path Efficiency**: Number of clicks vs. optimal path.
  - **Hallucination Rate**: Frequency of invalid link selections.
  - **Structured Parsing Success**: Reliability of the model's JSON/structured responses.
  - **Intuition Logging**: Captures the model's "gut feeling" for every move.
- **Archive Explorer**: Every run is automatically saved. Review past benchmarks, analyze paths, and export data for further research.
- **Docker-First**: Get up and running in minutes with a fully containerized stack.

---

## Technical Stack

- **Backend**: Python 3.12, FastAPI, LangChain (for structured output), Uvicorn.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, D3.js (for graph visualization), Lucide Icons.
- **Communication**: WebSockets for real-time event streaming from the orchestrator to the UI.
- **Infrastructure**: Docker & Docker Compose.

---

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed.
- A [NanoGPT API Key](<(https://docs.nano-gpt.com/introduction)>).

### 2. Launch

```bash
# Clone the repository
git clone https://github.com/MaloLM/WikikigBenchmark.git
cd WikikigBenchmark

# Setup environment
cp .env.example .env
# Edit .env and add your API key

# Start the stack
docker-compose up --build
```

### 3. Access

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

For detailed instructions, see the [**Quick Start Guide**](./QUICKSTART.md).

---

## 📖 How it Works

1. **Anonymization**: The system fetches a Wikipedia page and replaces all links with unique identifiers (e.g., `CONCEPT_42`).
2. **Prompting**: The LLM receives the page content and the list of concepts. It must provide its next move along with its "intuition."
3. **Orchestration**: The backend validates the move, fetches the next page, and streams the update to the frontend via WebSockets.
4. **Analysis**: Upon completion (or failure), the system calculates final metrics and archives the entire session.

---

## Contributing

Contributions are welcome! Whether it's adding new metrics, improving the graph visualization, or supporting more LLM providers.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

<p align="center">
  Built with ❤️ for the Research Community
</p>
