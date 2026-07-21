import os
import time
from flask import Blueprint, request, jsonify, current_app
from utils.settings_manager import load_settings
from utils.metrics_manager import record_voice_query, record_question

voice_bp = Blueprint('voice', __name__)

@voice_bp.route('/api/voice', methods=['POST'])
@voice_bp.route('/api/voice/process', methods=['POST'])
@voice_bp.route('/voice', methods=['POST'])
def handle_voice_query():
    """
    Handle offline voice query using local Whisper STT, existing RAGEngine, 
    and offline multilingual translation.
    """
    current_app.logger.info("Received audio query for offline processing.")
    
    # 1. Validate file payload
    if 'file' not in request.files:
        current_app.logger.error("No audio file found in multipart form-data.")
        return jsonify({
            'success': False,
            'error': 'No microphone recording file detected in the request payload.'
        }), 400
        
    audio_file = request.files['file']
    if audio_file.filename == '':
        return jsonify({
            'success': False,
            'error': 'Empty or corrupted recording file.'
        }), 400

    # Load local system settings
    settings = load_settings()
    target_language_setting = request.form.get('target_language') or settings.get('voice_language', 'Auto Detect')
    model = settings.get('current_model', 'llama3')
    top_k = int(settings.get('top_k', 5))
    temperature = float(settings.get('temperature', 0.7))
    max_tokens = int(settings.get('max_tokens', 512))

    filepath = None
    try:
        # 2. Save file temporarily
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        filepath = current_app.whisper_service.save_audio(audio_file, upload_folder)
        
        # 3. Transcribe audio with Whisper
        stt_result = current_app.whisper_service.transcribe_audio(filepath)
        if not stt_result.get('success'):
            return jsonify({
                'success': False,
                'error': f"Offline transcription failed: {stt_result.get('error')}"
            }), 500

        user_query = stt_result.get('text', '').strip()
        detected_language = stt_result.get('language', 'en')
        trans_time_ms = stt_result.get('transcription_time_ms', 0)
        
        # Record voice query metrics
        record_voice_query(trans_time_ms)
        
        if not user_query:
            return jsonify({
                'success': False,
                'error': 'Speech recognized, but returned empty transcript. Please speak clearly.'
            }), 400

        current_app.logger.info(f"Whisper transcript: '{user_query}' | Detected lang: {detected_language}")

        # Determine target language (Auto Detect means follow speech language, otherwise stick to specific setting)
        target_lang_code = detected_language
        if target_language_setting != 'Auto Detect':
            # Map full name to code
            for code, name in current_app.translation_service.list_supported_languages().items():
                if target_language_setting.lower() in [code.lower(), name.lower()]:
                    target_lang_code = code
                    break

        # 4. If query is non-English, translate it to English for accurate RAG vector lookup
        rag_query = user_query
        if detected_language != 'en':
            current_app.logger.info(f"Translating non-English query '{user_query}' to English for RAG...")
            rag_query = current_app.translation_service.translate_text(
                text=user_query, 
                target_language='en', 
                ollama_service=current_app.ollama_service
            )
            current_app.logger.info(f"Translated query: '{rag_query}'")

        # 5. Query local RAG Engine
        rag_result = current_app.rag_engine.ask_question(
            user_message=rag_query,
            model_name=model,
            top_k=top_k,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False
        )
        
        raw_answer = rag_result.get('answer', '')
        sources = rag_result.get('sources', [])
        retrieval_time_ms = rag_result.get('retrieval_time_ms', 0)
        generation_time_ms = rag_result.get('generation_time_ms', 0)
        
        # Record standard question metrics
        record_question(retrieval_time_ms, generation_time_ms)

        # 6. If target language is non-English, translate the synthesized answer back to target language
        final_answer = raw_answer
        if target_lang_code != 'en':
            current_app.logger.info(f"Translating synthesized answer to target language '{target_lang_code}'...")
            final_answer = current_app.translation_service.translate_text(
                text=raw_answer,
                target_language=target_lang_code,
                ollama_service=current_app.ollama_service
            )

        # 7. Structure response
        return jsonify({
            'success': True,
            'transcript': user_query,
            'detected_language': detected_language,
            'target_language': target_lang_code,
            'answer': final_answer,
            'raw_answer_en': raw_answer if target_lang_code != 'en' else None,
            'sources': sources,
            'retrieval_time_ms': retrieval_time_ms,
            'generation_time_ms': generation_time_ms,
            'transcription_time_ms': trans_time_ms,
            'model': model
        })

    except Exception as e:
        current_app.logger.error(f"Error in voice query pipeline: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Voice intelligence request could not be completed. Please verify audio input and try again.'
        }), 500
        
    finally:
        # 8. Clean up temporary audio file to save disk space
        if filepath:
            current_app.whisper_service.delete_audio(filepath)


@voice_bp.route('/api/translate', methods=['POST'])
def handle_translation_request():
    """
    Handle offline multi-language translation requests.
    """
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    target_language = data.get('target_language', '').strip() or 'en'
    
    if not text:
        return jsonify({
            'success': False,
            'error': 'Text is required for translation.'
        }), 400
        
    try:
        detected_lang = current_app.translation_service.detect_language(text)
        translated_text = current_app.translation_service.translate_text(
            text=text,
            target_language=target_language,
            ollama_service=current_app.ollama_service
        )
        
        return jsonify({
            'success': True,
            'text': text,
            'detected_language': detected_lang,
            'target_language': target_language,
            'translated_text': translated_text
        })
    except Exception as e:
        current_app.logger.error(f"Translation failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Offline translation failed: {str(e)}"
        }), 500


@voice_bp.route('/api/voice/status', methods=['GET'])
@voice_bp.route('/voice/status', methods=['GET'])
def get_voice_status():
    """Check Whisper voice assistant model availability."""
    ollama_connected = False
    try:
        if hasattr(current_app, 'ollama_service') and current_app.ollama_service:
            ollama_connected = current_app.ollama_service.check_connection()
    except Exception:
        pass
        
    return jsonify({
        'success': True,
        'whisper_model': 'Whisper-Tiny (Offline)',
        'whisper_status': 'ONLINE' if current_app.whisper_service.is_loaded else 'OFFLINE',
        'translation_status': 'ONLINE' if (current_app.translation_service or ollama_connected) else 'OFFLINE',
        'device': 'CPU (Local Node)'
    })
