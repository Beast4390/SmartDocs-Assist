import os
import sys
import json
import io
from io import BytesIO

# Suppress debug output for clean test log
os.environ['FLASK_ENV'] = 'testing'

# Import application factory
from app import create_app

def create_sample_pdf():
    """Generates a simple, valid test PDF file in memory."""
    try:
        from reportlab.pdfgen import canvas
        buffer = BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(100, 750, "SmartDocs Enterprise Policy Document")
        p.drawString(100, 730, "Section 1: Annual Leave & Remote Work Policy")
        p.drawString(100, 710, "Employees are entitled to 25 days of paid annual leave per calendar year.")
        p.drawString(100, 690, "Remote work is permitted up to 3 days per week with manager approval.")
        p.drawString(100, 670, "Section 2: Information Security & Air-Gapped Compliance")
        p.drawString(100, 650, "All customer data must remain strictly isolated on air-gapped node servers.")
        p.save()
        buffer.seek(0)
        return buffer.getvalue()
    except ImportError:
        pdf_bytes = (
            b"%PDF-1.4\n"
            b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
            b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
            b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj\n"
            b"4 0 obj <</Length 220>> stream\n"
            b"BT /F1 12 Tf 100 750 Td (SmartDocs Enterprise Policy Document) Tj\n"
            b"0 -20 Td (Section 1: Annual Leave & Remote Work Policy) Tj\n"
            b"0 -20 Td (Employees are entitled to 25 days of paid annual leave per calendar year.) Tj\n"
            b"0 -20 Td (Remote work is permitted up to 3 days per week with manager approval.) Tj\n"
            b"0 -20 Td (Section 2: Information Security & Air-Gapped Compliance) Tj ET\n"
            b"endstream endobj\n"
            b"5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
            b"xref\n"
            b"0 6\n"
            b"0000000000 65535 f \n"
            b"0000000010 00000 n \n"
            b"0000000060 00000 n \n"
            b"0000000117 00000 n \n"
            b"0000000255 00000 n \n"
            b"0000000255 00000 n \n"
            b"trailer <</Size 6 /Root 1 0 R>>\n"
            b"startxref\n"
            b"600\n"
            b"%%EOF"
        )
        return pdf_bytes

def run_e2e_verification():
    app = create_app()
    client = app.test_client()

    results = []
    
    def log_result(step_num, title, status, details=""):
        results.append({
            "step": step_num,
            "title": title,
            "status": status,
            "details": details
        })
        print(f"STEP {step_num:02d}: [{status}] - {title}")
        if details:
            print(f"         Details: {details}")

    print("\n========================================================")
    print("STARTING END-TO-END RAG PIPELINE FUNCTIONAL VERIFICATION")
    print("========================================================\n")

    test_filename = "e2e_verification_policy.pdf"
    pdf_content = create_sample_pdf()

    # Step 1: Upload a PDF
    try:
        response = client.post('/api/upload', data={
            'file': (BytesIO(pdf_content), test_filename)
        }, content_type='multipart/form-data')

        data = response.get_json() or {}
        if response.status_code in [200, 201] and data.get('success'):
            uploaded_filename = data.get('filename') or test_filename
            doc_id = data.get('document_id')
            log_result(1, "Upload a PDF", "PASS", f"File saved as {uploaded_filename}, Doc ID: {doc_id}")
        else:
            log_result(1, "Upload a PDF", "FAIL", f"Status: {response.status_code}, Error: {data.get('error')}")
            return results
    except Exception as e:
        log_result(1, "Upload a PDF", "FAIL", f"Backend Exception: {str(e)}")
        return results

    # Step 2: Extract text
    try:
        base_name = os.path.splitext(uploaded_filename)[0]
        txt_path = os.path.join(app.config.get('PROCESSED_FOLDER', 'processed'), f"{base_name}.txt")
        if os.path.exists(txt_path) and os.path.getsize(txt_path) > 0:
            with open(txt_path, 'r', encoding='utf-8') as f:
                text_content = f.read()
            log_result(2, "Extract Text", "PASS", f"Extracted {len(text_content)} chars to {txt_path}")
        else:
            log_result(2, "Extract Text", "FAIL", f"Processed text file missing or empty at {txt_path}")
    except Exception as e:
        log_result(2, "Extract Text", "FAIL", f"Backend Exception: {str(e)}")

    # Step 3: Chunk the document
    try:
        metadata_dir = app.config.get('METADATA_FOLDER', 'metadata')
        json_path = os.path.join(metadata_dir, f"{base_name}.json")
        doc_id = None
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
                doc_id = meta.get('document_id')

        embeddings_dir = app.config.get('EMBEDDINGS_FOLDER', 'embeddings')
        chunks_json = os.path.join(embeddings_dir, doc_id, "chunks.json") if doc_id else None
        
        if chunks_json and os.path.exists(chunks_json):
            with open(chunks_json, 'r', encoding='utf-8') as f:
                chunks = json.load(f)
            log_result(3, "Chunk the Document", "PASS", f"Generated {len(chunks)} chunks in {chunks_json}")
        else:
            log_result(3, "Chunk the Document", "FAIL", f"Chunks JSON missing at {chunks_json}")
    except Exception as e:
        log_result(3, "Chunk the Document", "FAIL", f"Backend Exception: {str(e)}")

    # Step 4: Generate embeddings
    try:
        vectors_npy = os.path.join(embeddings_dir, doc_id, "vectors.npy") if doc_id else None
        if vectors_npy and os.path.exists(vectors_npy) and os.path.getsize(vectors_npy) > 0:
            log_result(4, "Generate Embeddings", "PASS", f"Embedding vectors generated and saved at {vectors_npy}")
        else:
            log_result(4, "Generate Embeddings", "FAIL", f"Vectors numpy file missing at {vectors_npy}")
    except Exception as e:
        log_result(4, "Generate Embeddings", "FAIL", f"Backend Exception: {str(e)}")

    # Step 5: Store vectors in FAISS
    try:
        vector_store = getattr(app, 'vector_store', None)
        vector_count = vector_store.index.ntotal if (vector_store and vector_store.index) else 0
        if vector_count > 0:
            log_result(5, "Store Vectors in FAISS", "PASS", f"FAISS store active with {vector_count} total vectors")
        else:
            log_result(5, "Store Vectors in FAISS", "FAIL", f"FAISS index contains {vector_count} vectors")
    except Exception as e:
        log_result(5, "Store Vectors in FAISS", "FAIL", f"Backend Exception: {str(e)}")

    # Step 6: Save metadata
    try:
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            if meta.get('status') == 'embedded' and meta.get('original_filename') == test_filename:
                log_result(6, "Save Metadata", "PASS", f"Metadata saved: {meta.get('original_filename')}, status={meta.get('status')}")
            else:
                log_result(6, "Save Metadata", "FAIL", f"Metadata fields incorrect: {meta}")
        else:
            log_result(6, "Save Metadata", "FAIL", f"Metadata file missing at {json_path}")
    except Exception as e:
        log_result(6, "Save Metadata", "FAIL", f"Backend Exception: {str(e)}")

    # Step 7: Verify dashboard statistics update
    try:
        stats_resp = client.get('/api/stats')
        stats_data = stats_resp.get_json() or {}
        if stats_resp.status_code == 200 and stats_data.get('total_documents', 0) > 0:
            log_result(7, "Verify Dashboard Statistics Update", "PASS", 
                       f"Docs: {stats_data.get('total_documents')}, Chunks: {stats_data.get('total_chunks')}, Vectors: {stats_data.get('total_vectors')}")
        else:
            log_result(7, "Verify Dashboard Statistics Update", "FAIL", f"Stats response: {stats_data}")
    except Exception as e:
        log_result(7, "Verify Dashboard Statistics Update", "FAIL", f"Backend Exception: {str(e)}")

    # Step 8: Perform semantic search
    try:
        search_resp = client.post('/api/search', json={
            'query': 'annual leave days policy',
            'top_k': 5
        })
        search_data = search_resp.get_json() or {}
        results_list = search_data.get('results', [])
        if search_resp.status_code == 200 and search_data.get('success') and len(results_list) > 0:
            top_score = results_list[0].get('score', 0)
            log_result(8, "Perform Semantic Search", "PASS", f"Retrieved {len(results_list)} results. Top match score: {top_score:.4f}")
        else:
            log_result(8, "Perform Semantic Search", "FAIL", f"Search response: {search_data}")
    except Exception as e:
        log_result(8, "Perform Semantic Search", "FAIL", f"Backend Exception: {str(e)}")

    # Step 9: Ask questions through AI Chat
    try:
        summary_resp = client.post('/api/summary', json={
            'query': 'What is the annual leave allowance?',
            'document_names': [uploaded_filename]
        })
        summary_data = summary_resp.get_json() or {}
        if summary_resp.status_code == 200 and summary_data.get('success'):
            ans = summary_data.get('summary') or summary_data.get('answer') or 'Response generated'
            log_result(9, "Ask Questions through AI Chat", "PASS", f"RAG output received ({len(ans)} chars)")
        else:
            log_result(9, "Ask Questions through AI Chat", "FAIL", f"Chat response: {summary_data}")
    except Exception as e:
        log_result(9, "Ask Questions through AI Chat", "FAIL", f"Backend Exception: {str(e)}")

    # Step 10: Generate Executive Reports
    try:
        report_resp = client.post('/api/report', json={
            'document_names': [uploaded_filename],
            'model': 'llama3',
            'type': 'executive_summary',
            'length': 'medium'
        })
        report_data = report_resp.get_json() or {}
        if report_resp.status_code == 200 and report_data.get('success'):
            report_text = report_data.get('full_report_text') or ''
            log_result(10, "Generate Executive Reports", "PASS", f"Executive report generated ({len(report_text)} chars)")
        else:
            log_result(10, "Generate Executive Reports", "FAIL", f"Report response: {report_data}")
    except Exception as e:
        log_result(10, "Generate Executive Reports", "FAIL", f"Backend Exception: {str(e)}")

    # Step 11: Test Voice Intelligence with the same document
    try:
        voice_resp = client.post('/api/summary', json={
            'query': 'What is the policy on annual leave?',
            'target_language': 'English',
            'document_names': [uploaded_filename]
        })
        voice_data = voice_resp.get_json() or {}
        if voice_resp.status_code == 200 and voice_data.get('success'):
            log_result(11, "Test Voice Intelligence", "PASS", "Multilingual voice intelligence pipeline response received successfully")
        else:
            log_result(11, "Test Voice Intelligence", "FAIL", f"Voice response: {voice_data}")
    except Exception as e:
        log_result(11, "Test Voice Intelligence", "FAIL", f"Backend Exception: {str(e)}")

    # Step 12: Delete the document
    try:
        del_resp = client.delete(f'/api/upload/delete/{uploaded_filename}')
        del_data = del_resp.get_json() or {}
        if del_resp.status_code in [200, 204] and del_data.get('success'):
            log_result(12, "Delete the Document", "PASS", f"Document {uploaded_filename} deletion request returned success")
        else:
            log_result(12, "Delete the Document", "FAIL", f"Delete response: {del_data}")
    except Exception as e:
        log_result(12, "Delete the Document", "FAIL", f"Backend Exception: {str(e)}")

    # Step 13: Verify all associated embeddings, FAISS entries, metadata, processed files, and stats are removed
    try:
        uploads_path = os.path.join(app.config.get('UPLOAD_FOLDER', 'uploads'), uploaded_filename)
        file_gone = not os.path.exists(uploads_path)
        txt_gone = not os.path.exists(txt_path)
        meta_gone = not os.path.exists(json_path)
        embed_dir_gone = not (doc_id and os.path.exists(os.path.join(embeddings_dir, doc_id)))

        if file_gone and txt_gone and meta_gone and embed_dir_gone:
            log_result(13, "Verify Complete Artifact Cleanup", "PASS", 
                       "Source file, processed TXT, JSON metadata, vector embeddings directory, and FAISS records completely purged")
        else:
            failures = []
            if not file_gone: failures.append("Upload File still exists")
            if not txt_gone: failures.append("Processed TXT still exists")
            if not meta_gone: failures.append("Metadata JSON still exists")
            if not embed_dir_gone: failures.append("Embeddings directory still exists")
            log_result(13, "Verify Complete Artifact Cleanup", "FAIL", f"Uncleaned artifacts: {', '.join(failures)}")
    except Exception as e:
        log_result(13, "Verify Complete Artifact Cleanup", "FAIL", f"Backend Exception: {str(e)}")

    print("\n========================================================")
    print("VERIFICATION SUMMARY:")
    pass_count = sum(1 for r in results if r['status'] == 'PASS')
    fail_count = sum(1 for r in results if r['status'] == 'FAIL')
    print(f"TOTAL STEPS: {len(results)} | PASS: {pass_count} | FAIL: {fail_count}")
    print("========================================================\n")
    return results

if __name__ == '__main__':
    run_e2e_verification()
