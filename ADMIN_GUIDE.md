# SmartDocs Assistant – Administrator & Deployment Guide

This guide provides system administrators, IT security teams, and DevOps engineers with detailed instructions on configuring, deploying, maintaining, and securing the **SmartDocs Assistant** application inside an air-gapped or high-security enterprise environment.

---

## 1. System Architecture

SmartDocs Assistant is a 100% offline pure Flask enterprise knowledge platform:

- **Frontend Interface**: HTML5, CSS3, Vanilla JavaScript, and Bootstrap 5 Jinja2 templates served directly by Flask.
- **Python Flask Backend**: The core application, template rendering engine, and API services run in a unified Python Flask environment. It manages template rendering, document extraction, text normalization, vector chunk compilation, FAISS index management, Whisper audio transcribing, and offline Ollama API communications.

### Data Flow Ingestion Diagram
```
[User File Upload] 
       │
       ▼
[MIME / Size / Extension check]
       │
       ▼
[DocumentProcessor Ingestion] ────► Saves raw file in /uploads
       │
       ▼
[PyMuPDF / docx / pptx extract] ──► Normalizes & Saves clean text in /processed
       │
       ▼
[EmbeddingService Chunking] ─────► Computes overlap chunks & Saves in /embeddings
       │
       ▼
[SentenceTransformer vector] ─────► Computes dense float32 matrices
       │
       ▼
[FAISS Index compilation] ────────► Updates index.faiss on disk in /faiss_index
```

---

## 2. Server Directory Structure

All application state is stored locally within the project root. Ensure the application process has read and write permissions for these directories:

| Directory | Purpose | Content |
|---|---|---|
| `/uploads` | Raw document storage | Secures original PDF, DOCX, and PPTX files with collision-resistant UUID names. |
| `/processed` | Normalized text extraction | Stores raw text files extracted from uploaded documents. |
| `/metadata` | Document index registry | Stores structured JSON files documenting word counts, page counts, and IDs. |
| `/embeddings` | Local chunk & vector binaries | Stores chunk paragraphs (`chunks.json`) and dense matrices (`vectors.npy`). |
| `/faiss_index` | Dense vector database space | Stores FAISS Index files (`index.faiss`), mappings (`mapping.json`), and stats. |
| `/logs` | System activity and traces | Tracks execution, security flags, AI logs, and server errors. |

---

## 3. Configuration & Environment Variables

All operational configurations are managed through `/config.py` and loaded dynamically from system environment variables or a local `.env` file.

### Environment Variable Glossary (configured in `.env`)

| Variable | Default Value | Description |
|---|---|---|
| `FLASK_APP` | `app.py` | Flask server entry point file. |
| `FLASK_ENV` | `development` | Operating environment (`development`, `production`, `testing`). |
| `SECRET_KEY` | `smartdocs-enterprise-super-secret-key-9988` | Cryptographic signature key. Override in production. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Address of the local Ollama daemon. |
| `DEFAULT_LLM_MODEL` | `llama3` | Active LLM model used for chat and intelligence. |
| `DEFAULT_EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | SentenceTransformer embedding model name. |
| `CHUNK_SIZE` | `1000` | Target chunk size (in words) for text partitioning. |
| `CHUNK_OVERLAP` | `200` | Target overlapping words between consecutive chunks. |
| `TOP_K` | `5` | Maximum matched chunks retrieved from FAISS for RAG. |
| `TEMPERATURE` | `0.7` | Controls LLM generation creativity. |
| `LOG_LEVEL` | `INFO` | Root level of logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `MAX_CONTENT_LENGTH` | `52428800` | Enforced file upload limit in bytes (Default: 50MB). |

---

## 4. Secure Rotating Log System

The application uses an enterprise-grade, rotating file logging system configured in `/utils/logger.py`. Log files are capped at **10MB** each and retain up to **5 backups** automatically.

### Dedicated Log Files

1. **`application.log`**: Tracks general server workflow, Flask startup flags, HTTP status returns, and high-level routing.
2. **`error.log`**: Standardizes error stack traces, unhandled exceptions, and component failures. Only records levels `ERROR` and `CRITICAL`.
3. **`ai.log`**: Detailed log files capturing context payloads sent to local LLMs, Whisper transcription times, and FAISS rebuild indices.
4. **`security.log`**: Security auditing log tracing unvalidated filenames, MIME mismatches, path traversal attempts, and file-size threshold violations.

---

## 5. Local Model Administration

SmartDocs Assistant operates completely offline and requires the following local daemon engines to be running:

### Ollama Setup
Install Ollama locally and download the required weights using the CLI:
```bash
# Start Ollama daemon (runs on http://localhost:11434)
# Pull the target models specified in config:
ollama pull llama3
ollama pull qwen
ollama pull mistral
```

### Sentence Transformers & Whisper
The Flask application factory will automatically fetch and cache the `all-MiniLM-L6-v2` embedding model and the Whisper `tiny` speech-to-text model on the local disk upon first application startup.

---

## 6. Gunicorn Production Deployment

To host SmartDocs Assistant in a production environment, use **Gunicorn** as a high-performance WSGI server.

### 1. Simple Systemd Service Unit Setup (`/etc/systemd/system/smartdocs.service`)
```ini
[Unit]
Description=SmartDocs Assistant Flask Backend
After=network.target

[Service]
User=smartdocs
WorkingDirectory=/opt/smartdocs-assistant
Environment="PATH=/opt/smartdocs-assistant/venv/bin"
Environment="FLASK_ENV=production"
Environment="LOG_LEVEL=INFO"
Environment="SECRET_KEY=SECURE_Enterprise_Prod_Key_9988_!!"
ExecStart=/opt/smartdocs-assistant/venv/bin/gunicorn --workers 4 --threads 2 --bind 127.0.0.1:5000 "app:create_app()"

[Install]
WantedBy=multi-user.target
```

### 2. Reverse Proxy Nginx Configuration (`/etc/nginx/sites-available/smartdocs`)
Configure Nginx on port `80` / `443` to proxy dynamic traffic to the Flask backend while serving static files directly:
```nginx
server {
    listen 80;
    server_name smartdocs.enterprise.local;

    # Enforce secure upload body limits (50MB matching application)
    client_max_body_size 50M;

    # Serve static assets directly
    location /static/ {
        alias /opt/smartdocs-assistant/static/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Proxy to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Support NDJSON streaming responses for Ollama token generation
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## 7. Security Hardening

- **Filename Sanitization**: Standardize and validate all uploads using `secure_filename()` to prevent malicious filenames and directory injection attacks.
- **MIME type validation**: The backend inspects binary signatures on ingestion to block executable or scripting assets masquerading as documents.
- **Content Security Policy (CSP)**: Ensure your Nginx headers restrict script executions to local assets and local Ollama daemon ports exclusively.
