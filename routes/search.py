from flask import Blueprint, request, jsonify, current_app
from utils.validators import validate_search_payload
from utils.logger import get_ai_logger

search_bp = Blueprint('search', __name__)

@search_bp.route('/api/search', methods=['POST'])
@search_bp.route('/search', methods=['POST'])
def search_index():
    """
    Perform local semantic search on FAISS indexed vector space.
    Embeds the user query, searches the index, and returns matching chunks.
    """
    data = request.get_json() or {}
    
    # Validation using utilities
    is_valid, err_msg = validate_search_payload(data)
    if not is_valid:
        current_app.logger.warning(f"Search failed: {err_msg}")
        return jsonify({
            'success': False,
            'error': err_msg
        }), 400
        
    query = data.get('query', '').strip()
    top_k = data.get('top_k', 5)
    
    try:
        top_k = int(top_k)
    except (TypeError, ValueError):
        top_k = 5
        
    get_ai_logger().info(f"Searching local index for query: '{query}' with top_k={top_k}")
    
    try:
        # Generate embedding for the search query (returns a matrix of shape (1, 384))
        query_vector = current_app.embedding_service.generate_embedding([query])
        
        # Perform similarity lookup in FAISS space
        results = current_app.vector_store.search(query_vector, top_k=top_k)
        
        get_ai_logger().info(f"Local semantic search completed for: '{query}'. Matches found: {len(results)}")
        return jsonify({
            'success': True,
            'query': query,
            'total_results': len(results),
            'results': results
        })
    except Exception as e:
        get_ai_logger().error(f"Semantic search failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to perform semantic search: {str(e)}"
        }), 500
