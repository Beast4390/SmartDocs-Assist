# SmartDocs Assistant – Private Offline Enterprise AI Platform (v1.0.0)

Welcome to **SmartDocs Assistant**, a production-ready **Offline AI Knowledge Intelligence Platform** engineered for secure, air-gapped, zero-leakage enterprise environments. 

SmartDocs parses, normalizes, chunks, and indexes corporate documents (PDF, DOCX, PPTX, TXT) completely offline, computes high-fidelity vectors using local **Sentence Transformers**, manages indices in a secure **FAISS Vector Database**, and empowers teams to chat, search, and analyze private data with local LLMs (via **Ollama**) and speech translation (via **Whisper**).

---

## 🛠️ Strict Technology Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla ES6 JavaScript, and Bootstrap 5.3. Optimized for zero client bundling, instant visual rendering, and zero tracker scripts.
- **Backend**: Python Flask 3.x with a clean Application Factory pattern and modular blueprints.
- **Vector Database**: FAISS (Flat Inner Product) for nearest-neighbor semantic search.
- **Embedding Core**: Sentence Transformers (`all-MiniLM-L6-v2` - 384 dimensions).
- **Generative AI**: Ollama local connection supporting `llama3`, `qwen3`, and `mistral`.
- **Speech Assistant**: OpenAI Whisper (Tiny) local transcription.
- **Document Extractors**: PyMuPDF (`fitz`), python-docx, python-pptx.

---

## 🛰️ Enterprise Folder Directory

```
SmartDocs-Assistant/
├── app.py                      # Python Flask Application Factory & Middleware Registry
├── config.py                   # Centralized Configuration (Dev, Prod, and Testing classes)
├── requirements.txt            # Pin-packaged Python dependencies
├── README.md                   # Enterprise System Manual
├── USER_GUIDE.md               # End-User Operations Manual
├── ADMIN_GUIDE.md              # Administrator Operations & Deployment Manual
├── CHANGELOG.md                # Release Notes & Change History
├── .env.example                # Sample environment variables template
├── .gitignore                  # Git untracked directory ignores
│
├── routes/                     # Modular Python Blueprints
│   ├── upload.py               # Document storage, delete, view, and stats endpoints
│   ├── chat.py                 # RAG conversational query dispatcher
│   ├── summary.py              # Document summaries & form factor briefs
│   ├── compare.py              # Multi-document clause auditing
│   ├── search.py               # Semantic conceptual nearest-neighbor matching
│   ├── voice.py                # Whisper audio transcribing & cross-translating
│   └── settings.py             # System configuration triggers
│
├── services/                   # Clean Enterprise Business Logic
│   ├── document_processor.py   # Text parsers for PDF, DOCX, PPTX, TXT
│   ├── embedding_service.py    # Local vector computations & chunk splitting
│   ├── vector_store.py         # FAISS index alignment & storage IO
│   ├── rag_engine.py           # Context fetching & RAG prompt builder
│   ├── ollama_service.py       # Ollama daemon dispatcher
│   ├── whisper_service.py      # Whisper speech-to-text transcribing
│   └── translation_service.py  # Offline multilingual translation service
│
├── utils/                      # Utilities & Validation Core
│   ├── logger.py               # Rotating Multi-File loggers (App, Error, AI, Security)
│   ├── validators.py           # Path traversal protection & filename safety
│   ├── constants.py            # Static constants definitions
│   └── metrics_manager.py      # Real-time dashboard performance metrics
│
├── templates/                  # Jinja2 HTML Templates
│   ├── base.html               # Shared master frame (Sidebar, Toast alerts)
│   ├── dashboard.html          # Node status analytics dashboard
│   ├── upload.html             # Secure upload drag-and-drop dropzone
│   ├── chat.html               # RAG Assistant interface
│   ├── search.html             # Conceptual semantic search list
│   ├── reports.html            # Document briefs & comparative auditing
│   ├── voice.html              # Whisper microphone transcription
│   └── about.html              # Node topological details
│
├── tests/                      # Automated Test Suite
│   ├── __init__.py             # Test package marker
│   └── test_smartdocs.py       # Python unittest test cases
│
├── uploads/                    # Rest folder for raw original uploaded files
├── processed/                  # REST folder for parsed text files
├── metadata/                   # JSON profile records of indexed files
├── embeddings/                 # NumPy matrix binary files and chunk arrays
├── faiss_index/                # Serialized FAISS indices folder
└── logs/                       # Rotating audit logfiles
```

---

## 🔒 Hardened Production Security

- **Path Traversal Protection**: All user-facing file references (`filename` parameters) are processed through regex-based validators (`validate_safe_filename`) and parent directory checks (`validate_path_safety`) to prevent directory traversal exploits.
- **Isolated Log Rotation**: Distinct loggers isolate general traffic (`application.log`), exceptions (`error.log`), generative tokens (`ai.log`), and security/validation breaches (`security.log`). Log files rotating automatically at 10MB intervals to prevent disk-space exhaustion.
- **Mitigated XSS & Clickjacking**: Injected security headers including rigid `Content-Security-Policy` (CSP), `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff` into every response.

---

## 🚀 Setting Up Your Private Node

### 1. Prerequisites
Ensure you have **Python 3.10+** and **Ollama** installed on your workstations.
* Download Ollama: [ollama.com](https://ollama.com)
* Pull model weights locally:
  ```bash
  ollama pull llama3
  ollama pull qwen3
  ollama pull mistral
  ```

### 2. Install Dependencies
Clone this repository to your workstation, create a virtual environment, and install dependencies:
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt --break-system-packages
```

### 3. Run the Production Node
```bash
export FLASK_ENV=production
export LOG_LEVEL=INFO
python3 app.py
```
Open `http://localhost:3000` in your browser. All documents uploaded, queries processed, and speech transcribed will run 100% locally.

---

## 🧪 Running Automated Tests
SmartDocs includes a comprehensive test suite covering RAG, vector store indexing, document extraction, translation, voice, and API routing. Run the test suite with:
```bash
python3 -m unittest tests/test_smartdocs.py
```
---

## 🛠️ Troubleshooting & Support

### "Ollama Offline Fallback"
**Cause**: The Ollama daemon is not running on your workstation, or the connection port is blocked.
**Resolution**: Run `ollama serve` in a terminal window, or verify settings matching `OLLAMA_BASE_URL` in `.env`.

### "Whisper / Speech Recognition failure"
**Cause**: Missing system libraries (e.g., `ffmpeg`) or audio device drivers.
**Resolution**: Install `ffmpeg` on your host machine (`brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu).

---

## 📝 License
Proprietary corporate license. All intellectual assets remain strictly localized on-premises.
