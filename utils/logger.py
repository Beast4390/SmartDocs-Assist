import os
import logging
from logging.handlers import RotatingFileHandler

def setup_application_logger(log_folder: str = 'logs'):
    """
    Configures the enterprise-grade logging system for the local SmartDocs Node.
    Creates rotating file log output for separate files:
    - application.log: General flow, requests, and performance metrics
    - error.log: General errors, warnings and stack trace logs
    - ai.log: LLM query generation, embedding processes, and RAG operations
    - security.log: Input validation, file size limits, and path traversal events
    """
    os.makedirs(log_folder, exist_ok=True)
    
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(name)s:%(filename)s:%(lineno)d]: %(message)s'
    )
    
    # Get standard level (default INFO)
    log_level_name = os.environ.get('LOG_LEVEL', 'INFO').upper()
    numeric_level = getattr(logging, log_level_name, logging.INFO)
    
    # 1. Main Root-level Application Logger
    main_logger = logging.getLogger('smartdocs')
    main_logger.setLevel(logging.DEBUG)  # Keep root at DEBUG to handle fine-grained logs
    main_logger.handlers.clear()  # Clear to avoid duplicates
    
    # application.log handler
    app_file = os.path.join(log_folder, 'application.log')
    app_handler = RotatingFileHandler(app_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
    app_handler.setFormatter(formatter)
    app_handler.setLevel(numeric_level)
    main_logger.addHandler(app_handler)
    
    # Stream/Console handler for container output
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.DEBUG if numeric_level == logging.DEBUG else logging.INFO)
    main_logger.addHandler(stream_handler)
    
    # 2. error.log handler (filters and records only errors/critical messages across all channels)
    error_file = os.path.join(log_folder, 'error.log')
    error_handler = RotatingFileHandler(error_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    main_logger.addHandler(error_handler)
    
    # 3. Dedicated AI Logger (smartdocs.ai)
    ai_logger = logging.getLogger('smartdocs.ai')
    ai_logger.setLevel(logging.DEBUG)
    ai_logger.handlers.clear()
    ai_logger.propagate = True  # Allows AI logs to flow to application.log & console as well
    
    ai_file = os.path.join(log_folder, 'ai.log')
    ai_handler = RotatingFileHandler(ai_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
    ai_handler.setFormatter(formatter)
    ai_handler.setLevel(logging.DEBUG)
    ai_logger.addHandler(ai_handler)
    
    # 4. Dedicated Security Logger (smartdocs.security)
    security_logger = logging.getLogger('smartdocs.security')
    security_logger.setLevel(logging.DEBUG)
    security_logger.handlers.clear()
    security_logger.propagate = True  # Allows security logs to flow to application.log & console
    
    security_file = os.path.join(log_folder, 'security.log')
    security_handler = RotatingFileHandler(security_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
    security_handler.setFormatter(formatter)
    security_handler.setLevel(logging.DEBUG)
    security_logger.addHandler(security_handler)
    
    return main_logger

def get_ai_logger():
    """Helper to access the dedicated AI logger."""
    return logging.getLogger('smartdocs.ai')

def get_security_logger():
    """Helper to access the dedicated Security logger."""
    return logging.getLogger('smartdocs.security')
