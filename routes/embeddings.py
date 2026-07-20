import os
import json
from flask import Blueprint, request, jsonify, current_app
from services.embedding_service import (
    ModelLoadingException,
    EmbeddingGenerationException,
    InvalidDocumentException
)

embeddings_bp = Blueprint('embeddings', __name__)

@embeddings_bp.route('/api/embeddings/generate', methods=['POST'])
def generate_embeddings():
    """
    Manually triggers embedding generation for a specific document.
    """
    try:
        data = request.get_json() or {}
        document_id = data.get('document_id')
        
        if not document_id:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: document_id'
            }), 400
            
        # Find document metadata matching document_id
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'processed')
        
        target_meta = None
        target_meta_filename = None
        
        if os.path.exists(metadata_dir):
            for filename in os.listdir(metadata_dir):
                if filename.endswith('.json'):
                    meta_path = os.path.join(metadata_dir, filename)
                    try:
                        with open(meta_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                            if meta.get('document_id') == document_id:
                                target_meta = meta
                                target_meta_filename = filename
                                break
                    except Exception:
                        continue
                        
        if not target_meta:
            return jsonify({
                'success': False,
                'error': f"Document with ID '{document_id}' not found."
            }), 404
            
        # Get processed text path
        txt_filename = f"{os.path.splitext(target_meta['filename'])[0]}.txt"
        txt_path = os.path.join(processed_dir, txt_filename)
        
        if not os.path.exists(txt_path):
            return jsonify({
                'success': False,
                'error': f"Extracted text artifact for document '{document_id}' not found."
            }), 404
            
        with open(txt_path, 'r', encoding='utf-8') as tf:
            text_content = tf.read()
            
        # Generate embeddings
        chunks, vectors, metadata_embed = current_app.embedding_service.generate_document_embeddings(document_id, text_content)
        current_app.embedding_service.save_embeddings(document_id, chunks, vectors, metadata_embed)
        
        # Update metadata status to 'embedded'
        target_meta['status'] = 'embedded'
        meta_save_path = os.path.join(metadata_dir, target_meta_filename)
        with open(meta_save_path, 'w', encoding='utf-8') as f:
            json.dump(target_meta, f, indent=4, ensure_ascii=False)
            
        # Synchronize local FAISS Index
        current_app.logger.info(f"Synchronizing FAISS index with manually embedded document {document_id}...")
        current_app.vector_store.add_embeddings(document_id, chunks, vectors, target_meta.get('original_filename', ''))
            
        return jsonify({
            'success': True,
            'message': 'Embeddings successfully generated and FAISS index synchronized offline.',
            'document_id': document_id,
            'total_chunks': len(chunks),
            'model': current_app.embedding_service.model_name
        }), 200
        
    except ModelLoadingException as e:
        return jsonify({'success': False, 'error': f"Embedding model load failure: {str(e)}"}), 500
    except EmbeddingGenerationException as e:
        return jsonify({'success': False, 'error': f"Embedding generation failed: {str(e)}"}), 500
    except InvalidDocumentException as e:
        return jsonify({'success': False, 'error': f"Invalid document content: {str(e)}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f"Unexpected error during embedding: {str(e)}"}), 500


@embeddings_bp.route('/api/embeddings/<string:document_id>', methods=['GET'])
def get_document_embeddings(document_id):
    """
    Returns the chunk list, metadata, and status for a document.
    """
    try:
        # Load local embeddings
        chunks, vectors, metadata = current_app.embedding_service.load_embeddings(document_id)
        
        return jsonify({
            'success': True,
            'document_id': document_id,
            'embedding_model': metadata.get('embedding_model'),
            'vector_dimension': metadata.get('vector_dimension'),
            'total_chunks': metadata.get('total_chunks'),
            'created_at': metadata.get('created_at'),
            'chunks': chunks
        }), 200
        
    except FileNotFoundError as e:
        return jsonify({
            'success': False,
            'error': f"Embeddings not found for document: {document_id}"
        }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error loading embeddings: {str(e)}"
        }), 500


@embeddings_bp.route('/api/embeddings/status', methods=['GET'])
def get_embeddings_status():
    """
    Returns general statistics on local embeddings and model availability.
    """
    try:
        metadata_dir = current_app.config.get('METADATA_FOLDER', 'metadata')
        embeddings_dir = current_app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
        
        total_docs = 0
        total_chunks = 0
        embedded_docs = 0
        
        if os.path.exists(metadata_dir):
            for filename in os.listdir(metadata_dir):
                if filename.endswith('.json'):
                    meta_path = os.path.join(metadata_dir, filename)
                    try:
                        with open(meta_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                            total_docs += 1
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
            
        model_loaded = current_app.embedding_service.model is not None
        
        return jsonify({
            'success': True,
            'embedding_model': current_app.embedding_service.model_name,
            'model_loaded': model_loaded,
            'total_embedded_documents': embedded_docs,
            'total_chunks': total_chunks,
            'average_chunks_per_document': avg_chunks,
            'status': 'ONLINE' if model_loaded else 'OFFLINE'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Failed to fetch embeddings status: {str(e)}"
        }), 500
