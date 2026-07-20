from flask import Blueprint, request, jsonify, current_app
from utils.settings_manager import load_settings, save_settings

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings', methods=['GET', 'POST'])
@settings_bp.route('/settings', methods=['GET', 'POST'])
def save_or_get_settings():
    """Retrieve or save updated server configurations."""
    if request.method == 'GET':
        settings = load_settings()
        
        # Check connection status of Ollama
        ollama_active = False
        available_models = ["llama3", "qwen3", "mistral"]
        try:
            ollama_active = current_app.ollama_service.check_connection()
            if ollama_active:
                available_models = current_app.ollama_service.list_models()
        except Exception as e:
            current_app.logger.error(f"Error checking Ollama status: {str(e)}")

        return jsonify({
            'success': True,
            'settings': {
                'ollama_url': settings.get('ollama_url', 'http://localhost:11434'),
                'current_model': settings.get('current_model', 'llama3'),
                'temperature': settings.get('temperature', 0.7),
                'top_k': settings.get('top_k', 5),
                'max_tokens': settings.get('max_tokens', 512),
                'streaming': settings.get('streaming', True),
                'embedding_model': current_app.config.get('DEFAULT_EMBEDDING_MODEL', 'all-minilm'),
                'max_upload_mb': current_app.config.get('MAX_CONTENT_LENGTH', 32 * 1024 * 1024) / (1024 * 1024),
                'theme': 'light'
            },
            'ollama_connected': ollama_active,
            'available_models': available_models,
            'available_embeddings': ['all-minilm', 'nomic-embed-text']
        })
        
    # POST request handling
    data = request.get_json() or {}
    
    # Load current settings first to perform patch updates
    settings = load_settings()
    
    # Extract keys
    ollama_url = data.get('ollama_url')
    current_model = data.get('current_model')
    temperature = data.get('temperature')
    top_k = data.get('top_k')
    max_tokens = data.get('max_tokens')
    streaming = data.get('streaming')
    
    if ollama_url is not None:
        settings['ollama_url'] = ollama_url
    if current_model is not None:
        settings['current_model'] = current_model
    if temperature is not None:
        try:
            settings['temperature'] = float(temperature)
        except (ValueError, TypeError):
            pass
    if top_k is not None:
        try:
            settings['top_k'] = int(top_k)
        except (ValueError, TypeError):
            pass
    if max_tokens is not None:
        try:
            settings['max_tokens'] = int(max_tokens)
        except (ValueError, TypeError):
            pass
    if streaming is not None:
        settings['streaming'] = bool(streaming)
        
    save_settings(settings)
    
    # Also synchronize the memory-level configurations
    if current_model:
        current_app.config['DEFAULT_LLM_MODEL'] = current_model
    if ollama_url:
        current_app.config['OLLAMA_BASE_URL'] = ollama_url
        
    current_app.logger.info("Local configuration parameters successfully updated and saved to settings.json.")
    
    return jsonify({
        'success': True,
        'message': 'Settings successfully updated and saved on the local enterprise node.'
    })
