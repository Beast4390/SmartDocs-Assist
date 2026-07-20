import os
import json
from flask import Blueprint, request, jsonify, current_app, render_template
from werkzeug.utils import secure_filename
from services.document_processor import (
    DocumentProcessor, 
    PasswordProtectedPDFException, 
    ExtractionFailureException
)
from utils.validators import validate_safe_filename, validate_path_safety
from utils.logger import get_security_logger, get_ai_logger

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/api/upload', methods=['POST'])
@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Handle document uploads. Secures filenames, validates type & size,
    extracts raw text nodes, cleans them, registers metadata record 
    and saves files onto the node completely offline.
    """
    current_app.logger.info("Received document upload request")
    
    if 'file' not in request.files:
        current_app.logger.warning("Upload failed: No file part in request")
        return jsonify({
            'success': False,
            'error': 'No file part in the request payload'
        }), 400
        
    file = request.files['file']
    if file.filename == '':
        current_app.logger.warning("Upload failed: Empty file name")
        return jsonify({
            'success': False,
            'error': 'Empty file selected'
        }), 400

    # Read the stream length to evaluate content size safely before full save
    try:
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)  # reset pointer
    except Exception as e:
        current_app.logger.error(f"Failed to calculate upload file size: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Could not read file upload stream size'
        }), 400

    # Get configuration directory paths
    uploads_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    processed_dir = current_app.config.get('PROCESSED_FOLDER', 'processed')
    metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')

    # Initialize the document pipeline service
    processor = DocumentProcessor(
        upload_folder=uploads_dir,
        processed_folder=processed_dir,
        metadata_folder=metadata_dir
    )

    # Validate safe filename
    if not validate_safe_filename(file.filename):
        get_security_logger().warning(f"Unsafe filename block: '{file.filename}' contains invalid characters or traversal attempts.")
        return jsonify({
            'success': False,
            'error': 'Unsafe file name detected. Only standard alphanumeric characters, dashes, underscores, spaces, and periods are allowed.'
        }), 400

    # Validate file size and extension
    is_valid, err_msg = processor.validate_file(file.filename, file_size)
    if not is_valid:
        get_security_logger().warning(f"Upload validation failed: '{file.filename}' - {err_msg}")
        return jsonify({
            'success': False,
            'error': err_msg
        }), 400

    try:
        # Save original file securely with unique hash to prevent collision
        unique_name = processor.save_file(file, file.filename)
        saved_path = os.path.join(uploads_dir, unique_name)
        
        # Verify path safety to avoid directory traversal
        if not validate_path_safety(uploads_dir, saved_path):
            get_security_logger().warning(f"Path safety violation blocked: Attempted to save file outside uploads directory at '{saved_path}'.")
            return jsonify({
                'success': False,
                'error': 'Forbidden destination path.'
            }), 403

        # Trigger Extraction, Text Cleaning and Metadata Generation synchronously
        metadata = processor.process_document(saved_path, file.filename)
        
        current_app.logger.info(f"Successfully processed document text: {unique_name} (Words: {metadata['words']})")
        
        # Phase 4 Auto-Embedding Flow
        try:
            document_id = metadata["document_id"]
            txt_filename = f"{os.path.splitext(metadata['filename'])[0]}.txt"
            txt_path = os.path.join(processed_dir, txt_filename)
            
            with open(txt_path, 'r', encoding='utf-8') as tf:
                text_content = tf.read()
                
            get_ai_logger().info(f"Starting automatic chunking & offline embedding generation for document {document_id}...")
            
            # Generate and save local embeddings and chunks
            chunks, vectors, metadata_embed = current_app.embedding_service.generate_document_embeddings(document_id, text_content)
            current_app.embedding_service.save_embeddings(document_id, chunks, vectors, metadata_embed)
            
            # Update metadata status & rewrite
            metadata["status"] = "embedded"
            json_filename = f"{os.path.splitext(metadata['filename'])[0]}.json"
            json_path = os.path.join(metadata_dir, json_filename)
            
            with open(json_path, 'w', encoding='utf-8') as jf:
                json.dump(metadata, jf, indent=4, ensure_ascii=False)
                
            # Synchronize local FAISS Index
            get_ai_logger().info(f"Synchronizing FAISS index with new document {document_id}...")
            current_app.vector_store.add_embeddings(document_id, chunks, vectors, metadata.get('original_filename', ''))
            
            get_ai_logger().info(f"Successfully generated offline embeddings and synchronized FAISS. Document status updated to 'embedded'. Chunks: {len(chunks)}")
        except Exception as embed_err:
            get_ai_logger().error(f"Automatic embedding generation failed: {str(embed_err)}")
            # We retain the 'processed' status if embedding fails, but we raise it so the pipeline reports the failure
            return jsonify({
                "success": False,
                "error": f"Document text was extracted, but offline embedding generation failed: {str(embed_err)}"
                " (Logged in ai.log)"
            }), 500

        return jsonify({
            "success": True,
            "document_id": metadata["document_id"],
            "filename": metadata["filename"],
            "pages": metadata["pages"],
            "words": metadata["words"],
            "characters": metadata["characters"],
            "status": "embedded",
            "message": f"Document '{file.filename}' processed and embedded successfully completely offline."
        }), 201

    except PasswordProtectedPDFException as e:
        # Safe cleanup if file was saved before raising
        current_app.logger.warning(f"Decryption block: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except ExtractionFailureException as e:
        current_app.logger.error(f"Text Extraction failure: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except ValueError as e:
        current_app.logger.warning(f"Document extraction value error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f"Unexpected pipeline failure: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Internal server error processing document: {str(e)}"
        }), 500


@upload_bp.route('/documents', methods=['GET'])
@upload_bp.route('/api/upload/list', methods=['GET'])
def list_uploaded_documents():
    """List all documents currently resting in secure offline uploads directory with loaded metadata."""
    try:
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        if not os.path.exists(metadata_dir):
            return jsonify({'success': True, 'documents': []})
            
        documents = []
        # Sort metadata files by mtime descending to list newest first
        json_files = [f for f in os.listdir(metadata_dir) if f.endswith('.json')]
        json_paths = [os.path.join(metadata_dir, f) for f in json_files]
        json_paths.sort(key=os.path.getmtime, reverse=True)
        
        for index, json_path in enumerate(json_paths):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    documents.append({
                        'id': index + 1,
                        'name': meta.get('original_filename'),
                        'filename': meta.get('filename'),
                        'size_bytes': meta.get('file_size'),
                        'status': meta.get('status', 'processed'),
                        'pages': meta.get('pages', 0),
                        'words': meta.get('words', 0),
                        'characters': meta.get('characters', 0),
                        'upload_date': meta.get('upload_date')
                    })
            except Exception as read_err:
                current_app.logger.error(f"Skipped reading metadata {json_path}: {str(read_err)}")
                continue
                
        return jsonify({
            'success': True,
            'documents': documents
        })
    except Exception as e:
        current_app.logger.error(f"Error listing uploaded documents: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error listing files'
        }), 500


@upload_bp.route('/documents/<string:filename>', methods=['DELETE'])
@upload_bp.route('/api/upload/delete/<string:filename>', methods=['DELETE', 'POST'])
def delete_document(filename):
    """
    Securely removes a document and all related artifacts (.txt, .json, and local embeddings)
    from the local node storage to keep node size clean.
    """
    if not validate_safe_filename(filename):
        get_security_logger().warning(f"Unsafe filename delete attempt blocked: '{filename}'")
        return jsonify({
            'success': False,
            'error': 'Unsafe file name detected.'
        }), 400

    try:
        uploads_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'processed')
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        embeddings_dir = current_app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
        
        safe_filename = secure_filename(filename)
        
        # Build strict artifact paths
        upload_path = os.path.join(uploads_dir, safe_filename)
        base_name = os.path.splitext(safe_filename)[0]
        txt_path = os.path.join(processed_dir, f"{base_name}.txt")
        json_path = os.path.join(metadata_dir, f"{base_name}.json")
        
        # Verify path safety to avoid directory traversal
        for path in [upload_path, txt_path, json_path]:
            # If path exists, verify it falls within respective parent folder
            if os.path.exists(path):
                if path == upload_path and not validate_path_safety(uploads_dir, path):
                    return jsonify({'success': False, 'error': 'Forbidden path.'}), 403
                elif path == txt_path and not validate_path_safety(processed_dir, path):
                    return jsonify({'success': False, 'error': 'Forbidden path.'}), 403
                elif path == json_path and not validate_path_safety(metadata_dir, path):
                    return jsonify({'success': False, 'error': 'Forbidden path.'}), 403

        # Try to read metadata first to obtain document_id for embedding cleanup
        doc_id = None
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    doc_id = meta.get('document_id')
            except Exception as e:
                current_app.logger.error(f"Error reading metadata before deletion: {str(e)}")
                
        deleted_any = False
        for path in [upload_path, txt_path, json_path]:
            if os.path.exists(path):
                os.remove(path)
                deleted_any = True
                
        # If document_id was resolved, clean up its embeddings folder
        if doc_id:
            embed_dir = os.path.join(embeddings_dir, doc_id)
            if os.path.exists(embed_dir):
                import shutil
                try:
                    shutil.rmtree(embed_dir)
                    current_app.logger.info(f"Cleaned up local embeddings folder for document {doc_id}")
                    # Rebuild FAISS index to purge deleted vectors
                    current_app.vector_store.delete_document(doc_id)
                    current_app.logger.info(f"Successfully purged document {doc_id} vectors from FAISS index")
                except Exception as shutil_err:
                    current_app.logger.error(f"Failed to delete embeddings folder {embed_dir}: {str(shutil_err)}")
                
        if deleted_any:
            current_app.logger.info(f"Physically deleted file & indexed files for: {safe_filename}")
            return jsonify({
                'success': True,
                'message': f"Document '{safe_filename}' and all related local embedding artifacts successfully deleted offline."
            })
        else:
            return jsonify({
                'success': False,
                'error': 'File not found on this local node.'
            }), 404
            
    except Exception as e:
        current_app.logger.error(f"Error deleting document: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error deleting file'
        }), 500


@upload_bp.route('/document/<string:filename>', methods=['GET'])
def view_document(filename):
    """
    Renders the offline Document Viewer page with fully extracted text content, metadata, and chunk listings.
    """
    if not validate_safe_filename(filename):
        get_security_logger().warning(f"Unsafe filename view attempt blocked: '{filename}'")
        return render_template('base.html', error_code=400, error_message="Unsafe or invalid filename detected."), 400

    try:
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'processed')
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        embeddings_dir = current_app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
        
        safe_filename = secure_filename(filename)
        base_name = os.path.splitext(safe_filename)[0]
        
        json_path = os.path.join(metadata_dir, f"{base_name}.json")
        txt_path = os.path.join(processed_dir, f"{base_name}.txt")
        
        # Verify path safety to avoid directory traversal
        if not validate_path_safety(metadata_dir, json_path) or not validate_path_safety(processed_dir, txt_path):
            get_security_logger().warning(f"Path traversal view attempt blocked for '{filename}'")
            return render_template('base.html', error_code=403, error_message="Forbidden path traversal detected."), 403

        if not os.path.exists(json_path) or not os.path.exists(txt_path):
            current_app.logger.warning(f"Document viewer failed: Artifacts not found for {safe_filename}")
            return render_template('base.html', error_code=404, error_message="Document artifacts not found on this node."), 404
            
        # Load Metadata
        with open(json_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            
        # Load Extracted Text
        with open(txt_path, 'r', encoding='utf-8') as f:
            extracted_text = f.read()
            
        # Attempt to load chunks if the document is embedded
        chunks = []
        doc_id = metadata.get('document_id')
        if doc_id:
            chunks_json_path = os.path.join(embeddings_dir, doc_id, 'chunks.json')
            if os.path.exists(chunks_json_path):
                try:
                    with open(chunks_json_path, 'r', encoding='utf-8') as f:
                        chunks = json.load(f)
                except Exception as chunk_err:
                    current_app.logger.error(f"Failed to load chunks for document {doc_id}: {str(chunk_err)}")
            
        json_dump = json.dumps(metadata, indent=4, ensure_ascii=False)
        
        return render_template(
            'document_viewer.html',
            metadata=metadata,
            extracted_text=extracted_text,
            json_dump=json_dump,
            chunks=chunks,
            active_page='upload'
        )
        
    except Exception as e:
        current_app.logger.error(f"Error in document viewer: {str(e)}")
        return render_template('base.html', error_code=500, error_message=f"Internal error viewing document: {str(e)}"), 500


@upload_bp.route('/api/stats', methods=['GET'])
def get_node_stats():
    """
    Computes real-time statistics for the dashboard.
    """
    try:
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        uploads_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        
        total_docs = 0
        total_pages = 0
        total_size_bytes = 0
        last_upload_name = "None"
        last_upload_date = "None"
        latest_time = 0
        
        if os.path.exists(metadata_dir):
            for filename in os.listdir(metadata_dir):
                if filename.endswith('.json'):
                    json_path = os.path.join(metadata_dir, filename)
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                            total_docs += 1
                            total_pages += meta.get('pages', 0)
                            total_size_bytes += meta.get('file_size', 0)
                            
                            mtime = os.path.getmtime(json_path)
                            if mtime > latest_time:
                                latest_time = mtime
                                last_upload_name = meta.get('original_filename', 'None')
                                # Human-readable upload time (strip fraction)
                                last_upload_date = meta.get('upload_date', 'None')
                    except Exception:
                        continue
                        
        if total_size_bytes == 0 and os.path.exists(uploads_dir):
            for filename in os.listdir(uploads_dir):
                file_path = os.path.join(uploads_dir, filename)
                if os.path.isfile(file_path):
                    total_size_bytes += os.path.getsize(file_path)
                    
        storage_mb = total_size_bytes / (1024 * 1024)
        
        # Calculate local embedding statistics
        embeddings_dir = current_app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
        embedded_docs = 0
        total_chunks = 0
        
        if os.path.exists(metadata_dir):
            for filename in os.listdir(metadata_dir):
                if filename.endswith('.json'):
                    json_path = os.path.join(metadata_dir, filename)
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                            if meta.get('status') == 'embedded':
                                embedded_docs += 1
                                doc_id = meta.get('document_id')
                                if doc_id:
                                    embed_meta_path = os.path.join(embeddings_dir, doc_id, 'metadata.json')
                                    if os.path.exists(embed_meta_path):
                                        with open(embed_meta_path, 'r', encoding='utf-8') as emf:
                                            emeta = json.load(emf)
                                            total_chunks += emeta.get('total_chunks', 0)
                    except Exception:
                        continue
                        
        avg_chunks = 0.0
        if embedded_docs > 0:
            avg_chunks = round(total_chunks / embedded_docs, 2)
            
        model_loaded = False
        embedding_model = 'all-MiniLM-L6-v2'
        if hasattr(current_app, 'embedding_service') and current_app.embedding_service:
            model_loaded = current_app.embedding_service.model is not None
            embedding_model = current_app.embedding_service.model_name
            
        embedding_status = 'ONLINE' if model_loaded else 'OFFLINE'
        
        # Get processing status
        status = "IDLE"
        if total_docs > 0:
            status = "ACTIVE"
            
        # Get FAISS-specific stats
        faiss_stats = {}
        if hasattr(current_app, 'vector_store') and current_app.vector_store:
            try:
                faiss_stats = current_app.vector_store.get_index_stats()
            except Exception as fe:
                current_app.logger.error(f"Error getting FAISS stats: {str(fe)}")
            
        # Get RAG and Ollama-specific metrics
        from utils.metrics_manager import load_metrics
        from utils.settings_manager import load_settings
        metrics = load_metrics()
        settings = load_settings()
        
        ollama_connected = False
        active_model = settings.get('current_model', 'llama3')
        try:
            if hasattr(current_app, 'ollama_service') and current_app.ollama_service:
                ollama_connected = current_app.ollama_service.check_connection()
                active_model = current_app.ollama_service.get_current_model()
        except Exception as oe:
            current_app.logger.error(f"Error checking Ollama service in stats: {str(oe)}")

        return jsonify({
            'success': True,
            'total_documents': total_docs,
            'total_pages': total_pages,
            'storage_used_mb': round(storage_mb, 2),
            'last_upload': {
                'name': last_upload_name,
                'date': last_upload_date
            },
            'status': status,
            'total_embedded_documents': embedded_docs,
            'total_chunks': total_chunks,
            'average_chunks_per_document': avg_chunks,
            'embedding_model': embedding_model,
            'embedding_status': embedding_status,
            
            # FAISS-specific metrics
            'indexed_documents': faiss_stats.get('total_documents', embedded_docs),
            'total_vectors': faiss_stats.get('total_vectors', total_chunks),
            'faiss_index_size': faiss_stats.get('index_size_formatted', '0.0 Bytes'),
            'last_index_update': faiss_stats.get('last_updated', 'None'),
            'search_requests': faiss_stats.get('search_requests', 0),
            
            # RAG & Ollama-specific metrics
            'total_ai_questions': metrics.get('total_questions', 0),
            'avg_retrieval_time_ms': metrics.get('average_retrieval_time_ms', 0),
            'avg_generation_time_ms': metrics.get('average_generation_time_ms', 0),
            'active_ollama_model': active_model,
            'ollama_connection_status': 'CONNECTED' if ollama_connected else 'DISCONNECTED',
            
            # Phase 7 Voice & Multilingual Metrics
            'voice_queries': metrics.get('voice_queries', 0),
            'avg_transcription_time_ms': metrics.get('average_transcription_time_ms', 0),
            'active_whisper_model': 'Whisper-Tiny (Offline)',
            'active_language': settings.get('voice_language', 'Auto Detect'),
            'translation_status': 'Offline Ready' if (ollama_connected or getattr(current_app, 'translation_service', None)) else 'Disabled',

            # Phase 8 Enterprise AI Metrics
            'documents_summarized': metrics.get('documents_summarized', 0),
            'reports_generated': metrics.get('reports_generated', 0),
            'comparisons_completed': metrics.get('comparisons_completed', 0),
            'knowledge_graph_nodes': metrics.get('knowledge_graph_nodes', 0),
            'faqs_generated': metrics.get('faqs_generated', 0),
            'action_items_detected': metrics.get('action_items_detected', 0)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
