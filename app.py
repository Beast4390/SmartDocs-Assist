import os
import time
from flask import Flask, jsonify, render_template, request
from config import get_config
from utils.logger import setup_application_logger

def create_app(config_name=None):
    """
    Application factory for SmartDocs Assistant.
    Provides modular blueprint registration and enterprise configuration.
    """
    app = Flask(__name__, instance_relative_config=True)
    
    # Load configuration
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(get_config(config_name))
    
    # Configure custom enterprise logger
    logger = setup_application_logger(app.config['LOG_FOLDER'])
    app.logger = logger
    
    # Create required directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config.get('PROCESSED_FOLDER', 'processed'), exist_ok=True)
    os.makedirs(app.config.get('METADATA_FOLDER', 'metadata'), exist_ok=True)
    os.makedirs(app.config.get('EMBEDDINGS_FOLDER', 'embeddings'), exist_ok=True)
    os.makedirs(app.config['FAISS_INDEX_FOLDER'], exist_ok=True)
    os.makedirs(app.config['LOG_FOLDER'], exist_ok=True)
    
    # Initialize and pre-load the offline Embedding Service
    from services.embedding_service import EmbeddingService
    embeddings_dir = app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
    embedding_service = EmbeddingService(
        embeddings_folder=embeddings_dir,
        model_name=app.config.get('DEFAULT_EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
        chunk_size=app.config.get('CHUNK_SIZE', 1000),
        chunk_overlap=app.config.get('CHUNK_OVERLAP', 200)
    )
    try:
        app.logger.info("Pre-loading local SentenceTransformer model (all-MiniLM-L6-v2) for Phase 4...")
        embedding_service.load_model()
        app.logger.info("SentenceTransformer model successfully loaded completely offline!")
    except Exception as e:
        app.logger.error(f"Critical error pre-loading SentenceTransformer: {str(e)}")
    
    app.embedding_service = embedding_service
    # Initialize local FAISS Vector Store
    from services.vector_store import VectorStore
    faiss_index_dir = app.config.get('FAISS_INDEX_FOLDER', 'faiss_index')
    vector_store = VectorStore(index_folder=faiss_index_dir, embeddings_folder=embeddings_dir)
    try:
        app.logger.info("Initializing and scanning local vector store embeddings directory...")
        vector_store.rebuild_index()
        app.logger.info("FAISS vector store successfully synchronized and loaded completely offline!")
    except Exception as e:
        app.logger.error(f"Critical error pre-loading FAISS VectorStore: {str(e)}")
    
    app.vector_store = vector_store
    
    # Initialize and bind Ollama and RAGEngine
    from services.ollama_service import OllamaService
    from services.rag_engine import RAGEngine
    from services.whisper_service import WhisperService
    from services.translation_service import TranslationService
    
    ollama_service = OllamaService()
    rag_engine = RAGEngine(vector_store, embedding_service, ollama_service)
    whisper_service = WhisperService(model_size="tiny")
    translation_service = TranslationService()
    
    # Pre-load Whisper model once at application startup
    try:
        app.logger.info("Pre-loading local Whisper model (tiny) for Phase 7...")
        whisper_service.load_model()
    except Exception as e:
        app.logger.error(f"Failed to load Whisper model at startup: {str(e)}")
        
    app.ollama_service = ollama_service
    app.rag_engine = rag_engine
    app.whisper_service = whisper_service
    app.translation_service = translation_service
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register blueprints
    register_blueprints(app)
    
    @app.before_request
    def start_timer():
        request.start_time = time.time()

    @app.after_request
    def log_and_secure(response):
        # Request and Performance Logging
        if not request.path.startswith('/static/'):
            duration = int((time.time() - getattr(request, 'start_time', time.time())) * 1000)
            app.logger.info(f"Request: {request.method} {request.path} - Status: {response.status_code} - Duration: {duration}ms")
        
        # Security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:11434 http://127.0.0.1:11434;"
        return response
    
    @app.route('/health')
    def health_check():
        """Basic health check endpoint."""
        return jsonify({
            'status': 'healthy',
            'app': 'SmartDocs Assistant',
            'version': '1.0.0',
            'environment': app.config['ENV']
        })

    @app.route('/')
    def index():
        """Route to render the landing dashboard."""
        return render_template('dashboard.html', active_page='dashboard')

    @app.route('/dashboard')
    def dashboard():
        """Explicit route for dashboard."""
        return render_template('dashboard.html', active_page='dashboard')

    @app.route('/upload')
    def upload_view():
        """Route to render document upload page."""
        return render_template('upload.html', active_page='upload')

    @app.route('/chat')
    def chat_view():
        """Route to render local AI chat page."""
        return render_template('chat.html', active_page='chat')

    @app.route('/search')
    def search_view():
        """Route to render semantic search page."""
        return render_template('search.html', active_page='search')

    @app.route('/reports')
    def reports_view():
        """Route to render reports and summaries page."""
        return render_template('reports.html', active_page='reports')

    @app.route('/voice')
    def voice_view():
        """Route to render local voice assistant page."""
        return render_template('voice.html', active_page='voice')

    @app.route('/settings')
    def settings_view():
        """Route to render configuration settings page."""
        return render_template('settings.html', active_page='settings')

    @app.route('/about')
    def about_view():
        """Route to render about & system page."""
        return render_template('about.html', active_page='about')

    return app

def register_blueprints(app):
    """Register all modular application blueprints."""
    from routes.upload import upload_bp
    from routes.chat import chat_bp
    from routes.summary import summary_bp
    from routes.compare import compare_bp
    from routes.search import search_bp
    from routes.voice import voice_bp
    from routes.settings import settings_bp
    from routes.embeddings import embeddings_bp
    from routes.intelligence import intelligence_bp
    
    # Register under root '/' so both standard REST and '/api/' mappings declared inside function properly
    app.register_blueprint(upload_bp, url_prefix='/')
    app.register_blueprint(chat_bp, url_prefix='/')
    app.register_blueprint(summary_bp, url_prefix='/')
    app.register_blueprint(compare_bp, url_prefix='/')
    app.register_blueprint(search_bp, url_prefix='/')
    app.register_blueprint(voice_bp, url_prefix='/')
    app.register_blueprint(settings_bp, url_prefix='/')
    app.register_blueprint(embeddings_bp, url_prefix='/')
    app.register_blueprint(intelligence_bp, url_prefix='/')

def register_error_handlers(app):
    """Define standard HTTP/JSON error response behaviors returning JSON for API routes."""
    def make_error_response(code, message):
        if request.path.startswith('/api/') or request.headers.get('Accept') == 'application/json':
            return jsonify({'success': False, 'error': message}), code
        return render_template('base.html', error_code=code, error_message=message), code

    @app.errorhandler(400)
    def bad_request_error(error):
        return make_error_response(400, "Bad Request")

    @app.errorhandler(401)
    def unauthorized_error(error):
        return make_error_response(401, "Unauthorized Access")

    @app.errorhandler(403)
    def forbidden_error(error):
        return make_error_response(403, "Forbidden Action")

    @app.errorhandler(404)
    def not_found_error(error):
        return make_error_response(404, "Page or Resource Not Found")

    @app.errorhandler(500)
    def internal_error(error):
        return make_error_response(500, "Internal Server Error")

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=3000)
