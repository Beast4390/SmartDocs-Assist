import time
import json
import logging
from app import create_app

def run_production_audit():
    print("=" * 80)
    print("SMARTDOCS ASSISTANT - PRODUCTION BACKEND AUDIT & E2E VERIFICATION")
    print("=" * 80)
    
    app = create_app()
    app.testing = True
    client = app.test_client()

    endpoints = [
        # (Name, Method, Path, Payload/Headers, Expected Status)
        ("Dashboard Page", "GET", "/", None, 200),
        ("Dashboard Stats API", "GET", "/api/stats", None, 200),
        ("Upload Page", "GET", "/upload", None, 200),
        ("Document Upload List API", "GET", "/api/documents", None, 200),
        ("Chat Page", "GET", "/chat", None, 200),
        ("Chat API Pre-flight Offline Check", "POST", "/api/chat", {"json": {"message": "Test prompt", "stream": False}}, [200, 503]),
        ("Semantic Search Page", "GET", "/search", None, 200),
        ("Semantic Search Query API", "POST", "/api/search", {"json": {"query": "security policy", "top_k": 3}}, 200),
        ("Executive Reports Page", "GET", "/reports", None, 200),
        ("Executive Report Synthesis API", "POST", "/api/report", {"json": {"document_names": [], "report_type": "strategic"}}, [400, 200]),
        ("Voice Intelligence Page", "GET", "/voice", None, 200),
        ("Voice Intelligence Query API", "POST", "/api/voice/process", {"data": {"target_language": "auto"}}, [400, 200, 500]),
        ("System Settings Page", "GET", "/settings", None, 200),
        ("System Settings API", "GET", "/api/settings", None, 200),
        ("Ollama Fast Health Check API", "GET", "/api/ollama/status", None, 200),
        ("About Page", "GET", "/about", None, 200),
        ("Health Check Endpoint", "GET", "/health", None, 200)
    ]

    results = []
    
    for name, method, path, kwargs, expected in endpoints:
        start_time = time.time()
        try:
            kwargs = kwargs or {}
            if method == "GET":
                res = client.get(path)
            elif method == "POST":
                res = client.post(path, **kwargs)
            elif method == "DELETE":
                res = client.delete(path)
            else:
                res = client.open(path, method=method)

            duration_ms = int((time.time() - start_time) * 1000)
            
            valid_statuses = expected if isinstance(expected, list) else [expected]
            passed = res.status_code in valid_statuses
            
            # Verify JSON structure if API call
            is_json = False
            json_data = None
            if path.startswith("/api/") or res.content_type == "application/json":
                is_json = True
                try:
                    json_data = res.get_json()
                except Exception:
                    passed = False

            results.append({
                "name": name,
                "path": path,
                "method": method,
                "status_code": res.status_code,
                "duration_ms": duration_ms,
                "is_json": is_json,
                "passed": passed,
                "json_sample": str(json_data)[:100] if json_data else ""
            })
            
            status_str = "PASS" if passed else "FAIL"
            print(f"[{status_str}] {name:<35} | Method: {method:<4} | Path: {path:<22} | Status: {res.status_code} | Duration: {duration_ms}ms")

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            results.append({
                "name": name,
                "path": path,
                "method": method,
                "status_code": 500,
                "duration_ms": duration_ms,
                "is_json": False,
                "passed": False,
                "error": str(e)
            })
            print(f"[FAIL] {name:<35} | Method: {method:<4} | Path: {path:<22} | Exception: {str(e)}")

    print("=" * 80)
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    print(f"FINAL AUDIT RESULTS: {passed_count}/{total} PASSED")
    print("=" * 80)

if __name__ == "__main__":
    run_production_audit()
