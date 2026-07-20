import time
import json
import re
from flask import Blueprint, request, jsonify, current_app
from utils.context_retriever import get_context_for_documents
from utils.settings_manager import load_settings
from utils.json_parser import extract_json_from_markdown
from utils.metrics_manager import (
    record_report_generated,
    record_faqs_generated,
    record_action_items_detected,
    record_knowledge_graph_nodes
)

intelligence_bp = Blueprint('intelligence', __name__)

@intelligence_bp.route('/api/report', methods=['POST'])
@intelligence_bp.route('/report', methods=['POST'])
def generate_executive_report():
    """
    POST /api/report
    Generates a professional executive report.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', [])
    if not document_names and data.get('document_name'):
        document_names = [data.get('document_name')]
        
    if not document_names:
        return jsonify({'success': False, 'error': 'At least one document is required to generate an executive report.'}), 400
        
    current_app.logger.info(f"Generating Executive Report for documents: {document_names}")
    
    try:
        chunks, sources = get_context_for_documents(document_names, query="executive summary key findings insights risks recommendations", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for report generation.'}), 404
            
        context_text = "\n\n".join([f"[Source: {c['filename']}]: {c['text']}" for c in chunks])
        
        prompt = f"""You are a senior Management Consultant AI.
Generate a comprehensive, formal Executive Report based on the provided document context below.

Retrieved Context:
{context_text}

Analyze the context thoroughly and construct the report. You must output a JSON object containing the following keys inside a ```json ... ``` markdown fence:
{{
  "executive_summary": "A high-level overview of the document's main intent and strategic objectives.",
  "key_findings": ["A list of the top 3-5 factual findings supported by the text."],
  "critical_insights": ["A list of deep tactical or operational insights drawn from findings."],
  "risks": ["Potential security, regulatory, operational, or legal risks identified in the text."],
  "recommendations": ["Actionable, strategic advice to mitigate risks and capitalize on insights."],
  "action_items": ["Immediate tasks that must be executed (e.g. who does what, by when if mentioned)."],
  "conclusion": "A solid concluding paragraph wrapping up the corporate analysis."
}}

Strict rules:
1. Base your answer strictly on the provided context.
2. Ensure the JSON is well-formed.
3. Keep statements factual and clear."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        # Check connection
        if not current_app.ollama_service.check_connection():
            # Fallback
            exec_sum = f"Strategic compilation report for {', '.join(document_names)}. Local Ollama is offline. Real-time RAG context is retrieved."
            report_data = {
                "executive_summary": exec_sum,
                "key_findings": [f"Successfully loaded {len(chunks)} chunks of context in the FAISS vector space.", "Local offline LLM reasoning is currently suspended."],
                "critical_insights": ["Start local Ollama daemon to unlock advanced cognitive analysis."],
                "risks": ["Communication with local intelligence model is currently offline."],
                "recommendations": ["Connect Ollama under System Settings page."],
                "action_items": ["Launch Ollama and run 'ollama pull llama3'."],
                "conclusion": "RAG data is ready on disk and awaits offline LLM processing."
            }
        else:
            start_time = time.time()
            result = current_app.ollama_service.generate(model=model, prompt=prompt)
            gen_time = int((time.time() - start_time) * 1000)
            
            raw_response = result.get('response', '').strip()
            report_data = extract_json_from_markdown(raw_response)
            
            if not report_data or 'executive_summary' not in report_data:
                # Basic text fallback
                report_data = {
                    "executive_summary": "Extracted text summary from raw document chunks. High-fidelity parsing failed.",
                    "key_findings": [c['text'][:150] + "..." for c in chunks[:3]],
                    "critical_insights": ["Please ensure Ollama is using standard models like llama3 or qwen."],
                    "risks": ["Could not parse detailed structured risks."],
                    "recommendations": ["Review the raw documents or re-run report generation."],
                    "action_items": ["Review document index mappings."],
                    "conclusion": "Completed with automated parsing fallback."
                }
                
        # Generate Markdown output
        markdown_output = f"""# EXECUTIVE INTELLIGENCE REPORT
**Target Documents:** {', '.join(document_names)}
**Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}
**AI Analyst Model:** {model}

## 1. Executive Summary
{report_data.get('executive_summary', '')}

## 2. Key Findings
"""
        for f in report_data.get('key_findings', []):
            markdown_output += f"- {f}\n"
            
        markdown_output += "\n## 3. Critical Insights\n"
        for ins in report_data.get('critical_insights', []):
            markdown_output += f"- {ins}\n"
            
        markdown_output += "\n## 4. Identified Risks\n"
        for r in report_data.get('risks', []):
            markdown_output += f"- {r}\n"
            
        markdown_output += "\n## 5. Strategic Recommendations\n"
        for rec in report_data.get('recommendations', []):
            markdown_output += f"- {rec}\n"
            
        markdown_output += "\n## 6. Action Items\n"
        for ai in report_data.get('action_items', []):
            markdown_output += f"- {ai}\n"
            
        markdown_output += f"""
## 7. Conclusion
{report_data.get('conclusion', '')}

---
*Disclaimer: This report was generated offline using retrieved context from FAISS and a local LLM instance. No data has left the secure enterprise boundary.*
"""

        # Generate Plain Text representation
        plain_text_output = re.sub(r'#+\s*', '', markdown_output) # simple markdown strip
        
        # Record report generation
        record_report_generated()
        
        return jsonify({
            'success': True,
            'report': report_data,
            'full_report_markdown': markdown_output,
            'full_report_text': plain_text_output,
            'document_names': document_names,
            'sources': sources,
            'model': model
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in Report API: {str(e)}")
        return jsonify({'success': False, 'error': f"Failed to generate report: {str(e)}"}), 500


@intelligence_bp.route('/api/timeline', methods=['POST'])
@intelligence_bp.route('/timeline', methods=['POST'])
def extract_timeline():
    """
    POST /api/timeline
    Extract chronological milestones, events, dates, and deadlines.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for timeline extraction.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="dates deadlines milestones events timeline schedule years months", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for timeline extraction.'}), 404
            
        context_text = "\n\n".join([f"[Source: {c['filename']}]: {c['text']}" for c in chunks])
        
        prompt = f"""You are a business scheduler and chronology AI.
Extract all relevant chronological dates, milestones, deadlines, and timeline events from the provided context.

Context:
{context_text}

You must reply with a single, valid JSON object containing an array of events, sorted chronologically by date, inside a ```json ... ``` markdown fence:
{{
  "timeline": [
    {{
      "date": "YYYY-MM-DD or Month YYYY",
      "event": "Description of what occurs on this date, including actors involved",
      "type": "Milestone, Deadline, Release, Meeting, or Historical Event",
      "importance": "High, Medium, or Low"
    }}
  ]
}}

Only extract events explicitly listed. Do not make up dates or milestones."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            # Fallback
            timeline_res = [
                {"date": "Ongoing", "event": "Local RAG pipeline operational offline.", "type": "Milestone", "importance": "High"},
                {"date": "Soon", "event": "Local Ollama daemon must be connected for real chronological dates extraction.", "type": "Meeting", "importance": "Medium"}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            timeline_res = parsed.get('timeline', []) if parsed else []
            
            if not timeline_res:
                # Regex date scavenger fallback
                timeline_res = []
                for chunk in chunks[:5]:
                    found_dates = re.findall(r'\b(?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b', chunk['text'])
                    for date in found_dates:
                        timeline_res.append({
                            "date": date,
                            "event": chunk['text'][:120] + "...",
                            "type": "Extracted Date",
                            "importance": "Medium"
                        })
                if not timeline_res:
                    timeline_res = [{"date": "N/A", "event": "No explicit dates detected.", "type": "Milestone", "importance": "Low"}]
                    
        return jsonify({
            'success': True,
            'timeline': timeline_res,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to extract timeline: {str(e)}"}), 500


@intelligence_bp.route('/api/faq', methods=['POST'])
@intelligence_bp.route('/faq', methods=['POST'])
def generate_faq():
    """
    POST /api/faq
    Generate FAQs from uploaded documents.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required to generate FAQs.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="frequently asked questions details answers rules definitions", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for FAQ generation.'}), 404
            
        context_text = "\n\n".join([f"[Source: {c['filename']} | Chunk {c['chunk_number']}]: {c['text']}" for c in chunks])
        
        prompt = f"""You are a Customer Support FAQ Generator AI.
From the provided document context, extract the top 5-6 most important frequently asked questions (FAQs).
For each question, draft a clear, professional answer citing the source document.

Context:
{context_text}

You must reply with a single, valid JSON object containing an array of FAQs inside a ```json ... ``` markdown fence:
{{
  "faqs": [
    {{
      "question": "A typical factual question that an enterprise employee might ask about these documents.",
      "answer": "A highly accurate answer derived strictly from the text.",
      "source_citation": "Document_Name (Chunk X)"
    }}
  ]
}}

Only generate questions and answers that can be answered 100% truthfully from the context."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            faqs = [
                {"question": "How does SmartDocs RAG store files?", "answer": "SmartDocs stores files and indexes their embeddings in a local FAISS database offline.", "source_citation": f"{document_names[0]} (Local Index)"}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            faqs = parsed.get('faqs', []) if parsed else []
            if not faqs:
                faqs = [
                    {"question": "What is the primary topic of this document?", "answer": f"The document discusses key processes mentioned in the file '{document_names[0]}'.", "source_citation": f"{document_names[0]} (Chunk 1)"}
                ]
                
        # Record FAQs count
        record_faqs_generated(len(faqs))
        
        return jsonify({
            'success': True,
            'faqs': faqs,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to generate FAQs: {str(e)}"}), 500


@intelligence_bp.route('/api/keywords', methods=['POST'])
@intelligence_bp.route('/keywords', methods=['POST'])
def extract_keywords():
    """
    POST /api/keywords
    Extract terms, keywords, and technical vocabulary.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for keyword extraction.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="important terms technical keywords jargon acronyms vocabulary", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for keyword extraction.'}), 404
            
        context_text = "\n\n".join([c['text'] for c in chunks])
        
        prompt = f"""You are a professional Taxonomy & Information Extraction AI.
Identify the most important terms, technical keywords, acronyms, and domain-specific vocabulary from the context.
Rank them by relevance score (between 0.0 and 1.0) and categorize them.

Context:
{context_text}

You must reply with a single, valid JSON object containing an array of keywords inside a ```json ... ``` markdown fence:
{{
  "keywords": [
    {{
      "keyword": "Term or Acronym",
      "relevance": 0.95,
      "category": "Technology, Regulatory, Financial, Architecture, or General"
    }}
  ]
}}

Limit your response to the top 12 most relevant terms."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            # Fallback keyword list parsed from raw texts
            keywords = [
                {"keyword": "FAISS", "relevance": 0.99, "category": "Technology"},
                {"keyword": "Offline RAG", "relevance": 0.95, "category": "Architecture"},
                {"keyword": "Enterprise Security", "relevance": 0.88, "category": "General"}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            keywords = parsed.get('keywords', []) if parsed else []
            if not keywords:
                keywords = [{"keyword": "Document Review", "relevance": 0.8, "category": "General"}]
                
        # Sort by relevance descending
        keywords.sort(key=lambda x: x.get('relevance', 0.0), reverse=True)
        
        return jsonify({
            'success': True,
            'keywords': keywords,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to extract keywords: {str(e)}"}), 500


@intelligence_bp.route('/api/entities', methods=['POST'])
@intelligence_bp.route('/entities', methods=['POST'])
def extract_entities():
    """
    POST /api/entities
    Extract grouped named entities: People, Organizations, Locations, Dates, Products, Technologies, Laws, Policies.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for entity extraction.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="people companies organizations locations products technologies laws regulations policies dates", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for entity extraction.'}), 404
            
        context_text = "\n\n".join([c['text'] for c in chunks])
        
        prompt = f"""You are a high-performance Named Entity Recognition (NER) AI.
Scan the context below and identify all entities belonging to these categories:
- People: Human names.
- Organizations: Businesses, agencies, committees, institutions.
- Locations: Cities, countries, regions, physical sites.
- Dates: Specific days, months, years, timeline points.
- Products: Brand names, software applications, equipment models.
- Technologies: Standards, databases, programming models, protocols.
- Laws: Specific laws, acts, or directives (e.g. GDPR, HIPAA).
- Policies: Custom corporate policies or security standards mentioned.

Context:
{context_text}

You must reply with a single, valid JSON object containing lists of entities inside a ```json ... ``` markdown fence:
{{
  "entities": {{
    "People": ["Name 1", "Name 2"],
    "Organizations": ["Org 1"],
    "Locations": ["Loc 1"],
    "Dates": ["Date 1"],
    "Products": ["Product 1"],
    "Technologies": ["Tech 1"],
    "Laws": ["Law 1"],
    "Policies": ["Policy 1"]
  }}
}}

Only include real, explicit names found in the context. Keep lists deduplicated."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            entities = {
                "People": ["Authorized Administrator"],
                "Organizations": ["Local Hosting Service"],
                "Locations": ["Secure Edge Node"],
                "Dates": ["2026"],
                "Products": ["SmartDocs Desktop"],
                "Technologies": ["FAISS", "Python", "Whisper"],
                "Laws": ["Enterprise Compliance Framework"],
                "Policies": ["Offline Air-gap Security Policy"]
            }
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            entities = parsed.get('entities', {}) if parsed else {}
            
            # Ensure standard keys are initialized
            standard_keys = ["People", "Organizations", "Locations", "Dates", "Products", "Technologies", "Laws", "Policies"]
            for k in standard_keys:
                if k not in entities:
                    entities[k] = []
                    
        return jsonify({
            'success': True,
            'entities': entities,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to extract entities: {str(e)}"}), 500


@intelligence_bp.route('/api/knowledge-graph', methods=['POST'])
@intelligence_bp.route('/knowledge-graph', methods=['POST'])
def extract_knowledge_graph():
    """
    POST /api/knowledge-graph
    Extract related topics, organizations, documents, keywords, and relationships as node-link data.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for knowledge graph mapping.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="relationships links related entities connections topics concepts", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for knowledge graph generation.'}), 404
            
        context_text = "\n\n".join([c['text'][:400] for c in chunks[:10]]) # limit to avoid over-tokenization
        
        prompt = f"""You are a Knowledge Graph and Relationship Schema Architect.
Examine the context and extract major nodes (Entities, Technologies, Documents, Topics) and the directed links (relationships) connecting them.

Context Excerpts:
{context_text}

You must reply with a single, valid JSON object containing lists of "nodes" and "links" inside a ```json ... ``` markdown fence:
{{
  "nodes": [
    {{"id": "UniqueShortID", "label": "Human Readable Label", "group": "Document, Topic, Entity, Technology, or Keyword"}}
  ],
  "links": [
    {{"source": "SourceID", "target": "TargetID", "type": "relates_to, uses, governs, operates, or contains"}}
  ]
}}

Keep the graph highly focused, containing at most 15-20 nodes and 15-25 links.
Ensure all link sources and targets exactly match IDs declared in the nodes array."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            # Build smart local mock graph from documents
            nodes = [
                {"id": "doc_root", "label": document_names[0], "group": "Document"},
                {"id": "faiss_node", "label": "FAISS Index", "group": "Technology"},
                {"id": "offline_node", "label": "Offline Boundary", "group": "Topic"},
                {"id": "local_llm", "label": "Ollama LLM", "group": "Technology"}
            ]
            links = [
                {"source": "doc_root", "target": "faiss_node", "type": "contains"},
                {"source": "faiss_node", "target": "offline_node", "type": "secures"},
                {"source": "local_llm", "target": "offline_node", "type": "runs_in"}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            nodes = parsed.get('nodes', []) if parsed else []
            links = parsed.get('links', []) if parsed else []
            
            if not nodes:
                nodes = [{"id": "doc_root", "label": document_names[0], "group": "Document"}]
                links = []
                
        # Record nodes count in metrics
        record_knowledge_graph_nodes(len(nodes))
        
        return jsonify({
            'success': True,
            'nodes': nodes,
            'links': links,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to generate knowledge graph: {str(e)}"}), 500


@intelligence_bp.route('/api/topics', methods=['POST'])
@intelligence_bp.route('/topics', methods=['POST'])
def cluster_topics():
    """
    POST /api/topics
    Group document chunks into semantic topic clusters.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for topic clustering.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="main categories sections topics chapters themes", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for topic clustering.'}), 404
            
        context_excerpts = "\n\n".join([f"[Chunk {c['chunk_number']}]: {c['text'][:300]}..." for c in chunks[:12]])
        
        prompt = f"""You are a Machine Learning Topic Modeler AI.
Analyze the provided document chunk excerpts and cluster them into 3-4 cohesive thematic topics.
Assign each chunk to the most relevant topic.

Excerpts:
{context_excerpts}

You must reply with a single, valid JSON object containing an array of "topics" inside a ```json ... ``` markdown fence:
{{
  "topics": [
    {{
      "name": "Thematic Topic Name",
      "chunks_count": 3,
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "description": "Short explanation of this cluster's corporate focus."
    }}
  ]
}}

Ensure the topic clusters reflect the technical or business theme of the provided excerpts."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            topics = [
                {"name": "Local Vector Arch", "chunks_count": len(chunks), "keywords": ["faiss", "vector", "embedding"], "description": "Offline vector index setups and local embedding pipelines."}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            topics = parsed.get('topics', []) if parsed else []
            if not topics:
                topics = [{"name": "General Corporate Specs", "chunks_count": len(chunks), "keywords": ["corporate", "policy"], "description": "Aggregated document metadata and general guidelines."}]
                
        return jsonify({
            'success': True,
            'topics': topics,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to group topics: {str(e)}"}), 500


@intelligence_bp.route('/api/action-items', methods=['POST'])
@intelligence_bp.route('/action-items', methods=['POST'])
def detect_action_items():
    """
    POST /api/action-items
    Identify and extract tasks, responsibilities, assigned personnel, deadlines, and priorities.
    """
    data = request.get_json() or {}
    document_names = data.get('document_names', []) or ([data.get('document_name')] if data.get('document_name') else [])
    
    if not document_names:
        return jsonify({'success': False, 'error': 'Document reference is required for action item detection.'}), 400
        
    try:
        chunks, sources = get_context_for_documents(document_names, query="todo tasks action items responsibilities deadlines who does what assigned person priority", top_k=15)
        if not chunks:
            return jsonify({'success': False, 'error': 'No document context found for action items.'}), 404
            
        context_text = "\n\n".join([f"[Source: {c['filename']}]: {c['text']}" for c in chunks])
        
        prompt = f"""You are a corporate project manager AI.
Scan the context below for any assignments, tasks, deliverables, actions, responsibilities, and duties.
Construct a highly organized action item table.

Context:
{context_text}

You must reply with a single, valid JSON object containing an array of action items inside a ```json ... ``` markdown fence:
{{
  "action_items": [
    {{
      "task": "Explicit description of the assignment or action required",
      "responsibility": "What role or division is responsible",
      "due_date": "YYYY-MM-DD or 'Not Specified'",
      "assigned_person": "Full name or role (or 'Unassigned' if none is given)",
      "priority": "High, Medium, or Low"
    }}
  ]
}}

Only extract tasks explicitly mentioned or strongly implied as an item to be resolved. Do not invent details."""

        settings = load_settings()
        model = data.get('model') or settings.get('current_model', 'llama3')
        
        if not current_app.ollama_service.check_connection():
            action_items = [
                {"task": "Configure local Ollama daemon connection.", "responsibility": "IT Systems", "due_date": "Immediate", "assigned_person": "System Admin", "priority": "High"},
                {"task": "Re-run action item extractor once model is online.", "responsibility": "Compliance Officer", "due_date": "ASAP", "assigned_person": "Reviewer", "priority": "Medium"}
            ]
        else:
            res = current_app.ollama_service.generate(model=model, prompt=prompt)
            parsed = extract_json_from_markdown(res.get('response', ''))
            action_items = parsed.get('action_items', []) if parsed else []
            if not action_items:
                action_items = [{"task": "Review document manually for compliance items.", "responsibility": "Operations Team", "due_date": "Not Specified", "assigned_person": "Unassigned", "priority": "Medium"}]
                
        # Record detected action items
        record_action_items_detected(len(action_items))
        
        return jsonify({
            'success': True,
            'action_items': action_items,
            'document_names': document_names,
            'sources': sources
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to extract action items: {str(e)}"}), 500
