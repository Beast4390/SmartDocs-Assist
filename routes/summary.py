import time
from flask import Blueprint, request, jsonify, current_app
from utils.context_retriever import get_context_for_documents
from utils.metrics_manager import record_summary_count
from utils.settings_manager import load_settings

summary_bp = Blueprint('summary', __name__)

@summary_bp.route('/api/summary', methods=['POST'])
@summary_bp.route('/summary', methods=['POST'])
def generate_summary():
    """
    Generate summaries of local documents offline using retrieved FAISS context.
    Supports single or multiple target documents and multiple form factors.
    """
    data = request.get_json() or {}
    
    # Support both single document_name or document_names array
    document_names = data.get('document_names', [])
    if not document_names and data.get('document_name'):
        document_names = [data.get('document_name')]
        
    summary_type = data.get('type', 'executive').strip().lower() # short, detailed, executive, bullet, technical
    
    # Support existing UI keys mapped to our 5 standards
    type_mapping = {
        'bullets': 'bullet',
        'bullet-points': 'bullet',
        'brief': 'short',
        'executive': 'executive',
        'detailed': 'detailed',
        'technical': 'technical',
        'short': 'short'
    }
    summary_type = type_mapping.get(summary_type, summary_type)
    
    if summary_type not in ['short', 'detailed', 'executive', 'bullet', 'technical']:
        summary_type = 'executive'
        
    if not document_names:
        current_app.logger.warning("Summary generation failed: No document specified")
        return jsonify({
            'success': False,
            'error': 'At least one document is required for summary generation.'
        }), 400
        
    current_app.logger.info(f"Generating {summary_type} summary for documents: {document_names}")
    
    try:
        # Retrieve context from the local FAISS index mapping
        retrieved_chunks, sources = get_context_for_documents(document_names, query=f"summary main points {summary_type}", top_k=15)
        
        if not retrieved_chunks:
            return jsonify({
                'success': False,
                'error': f"No text content or FAISS context found for documents: {', '.join(document_names)}. Ensure they are processed and embedded."
            }), 404
            
        context_text = "\n\n".join([f"[Source: {c['filename']} | Chunk {c['chunk_number']}]:\n{c['text']}" for c in retrieved_chunks])
        
        # Build prompt
        prompt = f"""You are an expert Enterprise AI Knowledge Summarizer.
Analyze the provided retrieved document context below and generate a professional, objective {summary_type.upper()} summary.

Form Factor Guidelines:
- SHORT: A concise 1-paragraph summary under 120 words capturing only the critical mission statement and core facts.
- DETAILED: A deep, multi-paragraph summary structured with clear section headings.
- EXECUTIVE: A high-level strategic overview focused on executive-level takeaways, objectives, and high-impact findings.
- BULLET: A structured bulleted list of key statistics, dates, financial values, or milestone events.
- TECHNICAL: A dense briefing emphasizing system specifications, security controls, standards, architectures, and implementation details.

Strict Instructions:
1. Rely ONLY on the provided context text. Do not make up any facts, names, or values.
2. If the context does not contain enough information to generate a meaningful summary, state this clearly.
3. Keep the output clean, highly legible, and formatted nicely in Markdown.

Retrieved Context:
{context_text}

{summary_type.upper()} Summary:"""

        # Query local Ollama service
        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            current_app.logger.warning("Ollama offline during summary request")
            # Generate a structured local template summary on connection failure so the app doesn't crash
            fallback_text = f"### {summary_type.upper()} Summary (Offline Fallback)\n\n"
            fallback_text += f"The local Ollama model '{model}' is currently unreachable. Below are raw key excerpts retrieved from FAISS:\n\n"
            for chunk in retrieved_chunks[:4]:
                fallback_text += f"- **Excerpt from {chunk['filename']} (Chunk {chunk['chunk_number']}):** {chunk['text'][:250]}...\n"
            fallback_text += "\n*Please start your local Ollama daemon and pull the model to enable full generative summarizing.*"
            
            record_summary_count(len(document_names))
            return jsonify({
                'success': True,
                'document_names': document_names,
                'summary_type': summary_type,
                'summary': fallback_text,
                'highlights': [c['text'][:150] + "..." for c in retrieved_chunks[:3]],
                'sources': sources,
                'model': f"{model} (offline fallback)"
            })

        start_time = time.time()
        result = current_app.ollama_service.generate(model=model, prompt=prompt)
        gen_time = int((time.time() - start_time) * 1000)
        
        summary_text = result.get('response', '').strip()
        
        # Extract brief highlights
        highlights_prompt = f"""Using the summary below, extract exactly 3-4 key bullet point highlights. Return only the bullet points, nothing else.
Summary:
{summary_text}
Highlights:"""
        highlights_result = current_app.ollama_service.generate(model=model, prompt=highlights_prompt)
        highlights_text = highlights_result.get('response', '').strip()
        highlights_list = [h.strip().lstrip('-*• ').strip() for h in highlights_text.split('\n') if h.strip()][:5]
        if not highlights_list:
            highlights_list = [c['text'][:150] + "..." for c in retrieved_chunks[:3]]

        # Record metrics
        record_summary_count(len(document_names))
        
        return jsonify({
            'success': True,
            'document_names': document_names,
            'summary_type': summary_type,
            'summary': summary_text,
            'highlights': highlights_list,
            'sources': sources,
            'model': model,
            'generation_time_ms': gen_time
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in summary API: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Failed to generate summary: {str(e)}"
        }), 500
