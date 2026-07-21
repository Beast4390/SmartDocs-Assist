import time
import json
from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
from utils.validators import validate_chat_payload
from utils.settings_manager import load_settings
from utils.metrics_manager import record_question
from utils.logger import get_ai_logger

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/api/chat', methods=['POST'])
@chat_bp.route('/chat', methods=['POST'])
def send_chat_message():
    """
    Handle offline AI Chat query using local Ollama LLMs with RAGEngine.
    Supports both standard JSON and streamed token responses.
    """
    data = request.get_json() or {}
    
    # Payload validation using utilities
    is_valid, err_msg = validate_chat_payload(data)
    if not is_valid:
        current_app.logger.warning(f"Chat request invalid: {err_msg}")
        return jsonify({
            'success': False,
            'error': err_msg
        }), 400
        
    # Retrieve question parameter (accepts 'message' or 'question')
    message = data.get('message', '').strip() or data.get('question', '').strip()
    if not message:
        return jsonify({
            'success': False,
            'error': "Question is required"
        }), 400

    # Load system settings
    settings = load_settings()
    model = data.get('model') or settings.get('current_model', 'llama3')
    top_k = int(data.get('top_k') or settings.get('top_k', 5))
    temperature = float(settings.get('temperature', 0.7))
    max_tokens = int(settings.get('max_tokens', 512))
    
    # Determine streaming preference (request parameter or fallback to setting)
    request_stream = data.get('stream')
    stream = request_stream if request_stream is not None else settings.get('streaming', True)

    get_ai_logger().info(f"Chat RAG query request - Model: {model}, Top-K: {top_k}, Streaming: {stream}")

    # Pre-flight check: Verify Ollama availability before starting query execution
    ollama_connected = current_app.ollama_service.check_connection()
    if not ollama_connected:
        get_ai_logger().warning(f"Chat request refused: Ollama service node offline at {current_app.ollama_service.base_url}")
        return jsonify({
            'success': False,
            'ollama_connected': False,
            'error': 'Ollama is currently offline. Please start the Ollama server and try again.',
            'action_required': 'Run: ollama serve'
        }), 503

    try:
        if stream:
            # Get RAG response configuration with generator stream
            result = current_app.rag_engine.ask_question(
                user_message=message,
                model_name=model,
                top_k=top_k,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )

            def generate_stream():
                # Yield initial retrieval metadata first
                yield json.dumps({
                    "success": True,
                    "retrieval_time_ms": result["retrieval_time_ms"],
                    "sources": result["sources"],
                    "model": result["model"]
                }) + "\n"

                start_gen_time = time.time()
                full_answer = ""
                
                # Iterate and yield tokens from Ollama
                for token in result["generator"]:
                    full_answer += token
                    yield json.dumps({"token": token}) + "\n"

                gen_time_ms = int((time.time() - start_gen_time) * 1000)
                
                # Record metrics locally
                record_question(result["retrieval_time_ms"], gen_time_ms)
                get_ai_logger().info(f"RAG streaming complete. Retrieval: {result['retrieval_time_ms']}ms, Generation: {gen_time_ms}ms")

                # Yield final completion metadata
                yield json.dumps({
                    "done": True,
                    "generation_time_ms": gen_time_ms,
                    "answer": full_answer
                }) + "\n"

            return Response(stream_with_context(generate_stream()), mimetype='application/x-ndjson')
        
        else:
            # Standard single JSON response
            result = current_app.rag_engine.ask_question(
                user_message=message,
                model_name=model,
                top_k=top_k,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False
            )

            # Record metrics locally
            record_question(result["retrieval_time_ms"], result["generation_time_ms"])
            get_ai_logger().info(f"RAG standard query completed. Retrieval: {result['retrieval_time_ms']}ms, Generation: {result['generation_time_ms']}ms")

            return jsonify({
                'success': True,
                'answer': result['answer'],
                'sources': result['sources'],
                'retrieval_time_ms': result['retrieval_time_ms'],
                'generation_time_ms': result['generation_time_ms'],
                'model': result['model']
            })

    except Exception as e:
        get_ai_logger().error(f"Error processing RAG query: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to prompt local RAG engine: {str(e)}"
        }), 500

@chat_bp.route('/api/chat/history', methods=['GET'])
@chat_bp.route('/chat/history', methods=['GET'])
def get_chat_history():
    """Return historical conversation nodes (saved locally)."""
    # Simple mock chat sessions history
    return jsonify({
        'success': True,
        'history': [
            {
                'session_id': 'sess_01',
                'title': 'Querying corporate leave guidelines',
                'created_at': 1718000000,
                'model': 'llama3'
            },
            {
                'session_id': 'sess_02',
                'title': 'Offline data processing security boundary',
                'created_at': 1718100000,
                'model': 'qwen3'
            }
        ]
    })
