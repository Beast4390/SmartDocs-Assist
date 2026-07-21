import os
from flask import current_app

def _doc_matches(target_names, chunk_filename, chunk_doc_id):
    if not target_names:
        return True
    for target in target_names:
        if not target: continue
        target_str = str(target).lower()
        fn_str = str(chunk_filename or '').lower()
        did_str = str(chunk_doc_id or '').lower()
        
        # Exact match on filename or doc_id
        if target_str == fn_str or target_str == did_str:
            return True
        # Strip extension comparisons
        target_no_ext = os.path.splitext(target_str)[0]
        fn_no_ext = os.path.splitext(fn_str)[0]
        if target_no_ext and fn_no_ext and (target_no_ext in fn_no_ext or fn_no_ext in target_no_ext):
            return True
        # Strip unique UUID suffix (e.g. e2e_verification_policy_1d28ea86 -> e2e_verification_policy)
        target_stem = target_no_ext.rsplit('_', 1)[0] if '_' in target_no_ext else target_no_ext
        fn_stem = fn_no_ext.rsplit('_', 1)[0] if '_' in fn_no_ext else fn_no_ext
        if target_stem and fn_stem and (target_stem in fn_stem or fn_stem in target_stem):
            return True
    return False

def get_context_for_documents(document_names, query=None, top_k=15):
    """
    Retrieves the most semantically relevant text chunks from FAISS for the specified document names.
    If FAISS is empty or no matches are found, falls back to direct chunk matching from the vector store index.
    """
    if not document_names:
        return [], []

    vector_store = getattr(current_app, 'vector_store', None)
    embedding_service = getattr(current_app, 'embedding_service', None)
    
    if not vector_store:
        return [], []
        
    # Standardize input to list of strings
    if isinstance(document_names, str):
        document_names = [document_names]
        
    # We will search the FAISS index to get semantic chunks
    retrieved_chunks = []
    
    # Generate query vector if query is provided, otherwise use a broad summary query
    search_query = query if query else "general summary executive key points entities facts"
    
    try:
        if embedding_service and vector_store.index is not None and vector_store.index.ntotal > 0:
            query_vector = embedding_service.generate_embedding([search_query])
            # Search deeper to find chunks from target documents
            search_k = max(top_k * 4, 40)
            search_k = min(search_k, vector_store.index.ntotal)
            
            if search_k > 0:
                raw_results = vector_store.search(query_vector, top_k=search_k)
                
                # Filter results for requested documents
                for r in raw_results:
                    filename = r.get('filename')
                    doc_id = r.get('document_id')
                    
                    if _doc_matches(document_names, filename, doc_id):
                        retrieved_chunks.append(r)
                        if len(retrieved_chunks) >= top_k:
                            break
    except Exception as e:
        current_app.logger.error(f"Error querying FAISS index: {str(e)}")

    # Fallback: if we found nothing or very few chunks, pull direct chunk mapping from the vector store
    if len(retrieved_chunks) < 5:
        fallback_chunks = []
        for chunk in vector_store.mapping:
            filename = chunk.get('filename')
            doc_id = chunk.get('document_id')
            if _doc_matches(document_names, filename, doc_id):
                # Format to look like search results
                fallback_chunks.append({
                    "document_id": chunk.get("document_id"),
                    "chunk_id": chunk.get("chunk_id"),
                    "chunk_number": chunk.get("chunk_number", 1),
                    "score": 1.0,
                    "text": chunk.get("text", ""),
                    "filename": filename
                })
        
        # Sort by chunk number
        fallback_chunks.sort(key=lambda x: x.get('chunk_number', 1))
        
        # Merge with retrieved chunks, avoiding duplicates
        seen_chunk_ids = {c['chunk_id'] for c in retrieved_chunks if 'chunk_id' in c}
        for fc in fallback_chunks:
            if fc['chunk_id'] not in seen_chunk_ids:
                retrieved_chunks.append(fc)
                if len(retrieved_chunks) >= top_k:
                    break
                    
    # Format sources list
    sources = []
    for chunk in retrieved_chunks:
        sources.append({
            "filename": chunk.get("filename", "Unknown Document"),
            "chunk": chunk.get("chunk_number", 1),
            "similarity_score": float(chunk.get("score", 1.0))
        })
        
    return retrieved_chunks, sources
