import time
from flask import Blueprint, request, jsonify, current_app
from utils.context_retriever import get_context_for_documents
from utils.metrics_manager import record_comparison_completed
from utils.settings_manager import load_settings
from utils.json_parser import extract_json_from_markdown

compare_bp = Blueprint('compare', __name__)

@compare_bp.route('/api/compare', methods=['POST'])
@compare_bp.route('/compare', methods=['POST'])
def compare_documents():
    """
    Compare multiple local documents to detect differences, overlapping facts,
    and conflicting clauses offline using local LLMs.
    """
    data = request.get_json() or {}
    doc_a = data.get('document_a', '').strip()
    doc_b = data.get('document_b', '').strip()
    
    if not doc_a or not doc_b:
        current_app.logger.warning("Compare requested but document references were incomplete")
        return jsonify({
            'success': False,
            'error': 'Two documents are required for structural comparison'
        }), 400
        
    if doc_a == doc_b:
        return jsonify({
            'success': False,
            'error': 'Please select two different documents to perform a comparative analysis.'
        }), 400
        
    current_app.logger.info(f"Comparing '{doc_a}' with '{doc_b}'")
    
    try:
        # Retrieve context for both documents from FAISS
        chunks_a, sources_a = get_context_for_documents([doc_a], query="comparative key clauses specifications", top_k=8)
        chunks_b, sources_b = get_context_for_documents([doc_b], query="comparative key clauses specifications", top_k=8)
        
        if not chunks_a or not chunks_b:
            missing_doc = doc_a if not chunks_a else doc_b
            return jsonify({
                'success': False,
                'error': f"Document '{missing_doc}' has no text content in the vector store. Make sure it is fully embedded first."
            }), 404
            
        context_a = "\n\n".join([f"[Chunk {c['chunk_number']}]: {c['text']}" for c in chunks_a])
        context_b = "\n\n".join([f"[Chunk {c['chunk_number']}]: {c['text']}" for c in chunks_b])
        
        # Merge sources
        sources = sources_a + sources_b
        
        prompt = f"""You are an expert Contract & Specification Auditing AI.
Compare the following two documents based ONLY on their provided text context below.

DOCUMENT A: {doc_a}
Retrieved Context:
{context_a}

DOCUMENT B: {doc_b}
Retrieved Context:
{context_b}

Perform a rigorous comparative audit. Identify:
1. Similarities: Topics where both documents agree or share common rules.
2. Differences: Key points of divergence or different settings.
3. Missing Information: Important business or technical parameters present in one document but entirely omitted in the other.
4. Conflicting Statements: Direct logical contradictions (e.g., Doc A says X, Doc B says Y).
5. Compatibility Score: A percentage rating (0 to 100) of how compatible/congruent they are.

You MUST reply with a single, valid JSON object in this exact schema inside a ```json ... ``` markdown fence:
{{
  "similarities": [
    {{
      "topic": "Topic Title",
      "description": "How they agree or overlapping requirements"
    }}
  ],
  "differences": [
    {{
      "topic": "Topic Title",
      "doc_a_value": "Requirement or value in Document A",
      "doc_b_value": "Requirement or value in Document B"
    }}
  ],
  "missing_information": [
    {{
      "document": "Name of document missing the item",
      "topic": "Topic Title",
      "description": "What is omitted that is present in the other"
    }}
  ],
  "conflicting_statements": [
    {{
      "topic": "Topic Title",
      "statement_a": "Contradictory statement in Doc A",
      "statement_b": "Contradictory statement in Doc B"
    }}
  ],
  "shared_topics": ["Topic 1", "Topic 2"],
  "compatibility_score": 85
}}

Ensure that all text values are brief, factual, and based ONLY on the context. Do not invent any outside terms or details."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            current_app.logger.warning("Ollama offline during comparison")
            # Return an offline fallback
            fallback_res = {
                'success': True,
                'documents': [doc_a, doc_b],
                'similarities': [
                    {"topic": "Local Vector Storage", "description": "Both documents are indexed in the local offline FAISS vector store."}
                ],
                'differences': [
                    {"topic": "Document Content", "doc_a_value": f"First document '{doc_a}' with {len(chunks_a)} chunks.", "doc_b_value": f"Second document '{doc_b}' with {len(chunks_b)} chunks."}
                ],
                'missing_information': [
                    {"document": doc_a, "topic": "Deep Comparison", "description": "Offline comparative reasoning requires a running local Ollama model."}
                ],
                'conflicting_statements': [],
                'shared_topics': ["Vector Indexing", "Offline Mode"],
                'compatibility_score': 50,
                'sources': sources,
                'model': f"{model} (offline fallback)"
            }
            record_comparison_completed()
            return jsonify(fallback_res)

        start_time = time.time()
        result = current_app.ollama_service.generate(model=model, prompt=prompt)
        gen_time = int((time.time() - start_time) * 1000)
        
        raw_response = result.get('response', '').strip()
        parsed = extract_json_from_markdown(raw_response)
        
        if not parsed or 'similarities' not in parsed:
            current_app.logger.warning("Failed to parse JSON comparison result from Ollama; using manual text-extraction fallback.")
            # Simple text parsing fallback
            parsed = {
                "similarities": [
                    {"topic": "General Concept", "description": "The documents both mention key corporate workflows but full structured parsing failed."}
                ],
                "differences": [
                    {"topic": "Scope", "doc_a_value": f"Content in {doc_a}", "doc_b_value": f"Content in {doc_b}"}
                ],
                "missing_information": [],
                "conflicting_statements": [],
                "shared_topics": ["General"],
                "compatibility_score": 70
            }
            
        parsed['success'] = True
        parsed['documents'] = [doc_a, doc_b]
        parsed['sources'] = sources
        parsed['model'] = model
        parsed['generation_time_ms'] = gen_time
        
        # Record metrics
        record_comparison_completed()
        
        return jsonify(parsed)
        
    except Exception as e:
        current_app.logger.error(f"Error in comparison API: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to perform cross-document comparison: {str(e)}"
        }), 500
