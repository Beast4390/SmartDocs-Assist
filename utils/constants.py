# SmartDocs Assistant - Constants Definition

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'pptx', 'txt', 'wav', 'mp3', 'ogg'}

# Max size is 32MB for corporate document processing safely offline
MAX_CONTENT_LENGTH = 32 * 1024 * 1024 

DEFAULT_OLLAMA_URL = 'http://localhost:11434'
DEFAULT_MODEL = 'llama3'
DEFAULT_EMBEDDING_MODEL = 'all-minilm'

MODELS_SUPPORTED = ['llama3', 'qwen3', 'mistral']
EMBEDDINGS_SUPPORTED = ['all-minilm', 'nomic-embed-text']

UPLOAD_FOLDER = 'uploads'
FAISS_INDEX_FOLDER = 'faiss_index'
LOG_FOLDER = 'logs'
SYSTEM_DB_NAME = 'smartdocs_local.db'
