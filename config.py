import os

class Config:
    """Base Configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'smartdocs-enterprise-super-secret-key-9988')
    DEBUG = False
    TESTING = False
    
    # App directory roots
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    PROCESSED_FOLDER = os.path.join(BASE_DIR, 'processed')
    METADATA_FOLDER = os.path.join(BASE_DIR, 'metadata')
    EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, 'embeddings')
    FAISS_INDEX_FOLDER = os.path.join(BASE_DIR, 'faiss_index')
    LOG_FOLDER = os.path.join(BASE_DIR, 'logs')
    
    # Secure document upload settings
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))  # 50 MB
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'pptx'}
    
    # Text chunking configurations
    CHUNK_SIZE = int(os.environ.get('CHUNK_SIZE', 1000))
    CHUNK_OVERLAP = int(os.environ.get('CHUNK_OVERLAP', 200))
    
    # Semantic Search & LLM configurations
    TOP_K = int(os.environ.get('TOP_K', 5))
    TEMPERATURE = float(os.environ.get('TEMPERATURE', 0.7))
    
    # Local LLM Service configs (Ollama integration settings)
    OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    DEFAULT_LLM_MODEL = os.environ.get('DEFAULT_LLM_MODEL', 'llama3')
    DEFAULT_EMBEDDING_MODEL = os.environ.get('DEFAULT_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

class DevelopmentConfig(Config):
    """Development Environment configurations."""
    ENV = 'development'
    DEBUG = True
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'DEBUG')

class ProductionConfig(Config):
    """Production Enterprise Environment configurations."""
    ENV = 'production'
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY')  # Must be loaded from system environment
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

class TestingConfig(Config):
    """Testing Configurations."""
    ENV = 'testing'
    TESTING = True
    DEBUG = True
    LOG_LEVEL = 'DEBUG'
    UPLOAD_FOLDER = os.path.join(Config.BASE_DIR, 'tests', 'uploads')
    FAISS_INDEX_FOLDER = os.path.join(Config.BASE_DIR, 'tests', 'faiss_index')

def get_config(env_name):
    """Helper to return active config class based on environment name."""
    configs = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig
    }
    return configs.get(env_name, DevelopmentConfig)
