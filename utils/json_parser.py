import re
import json

def extract_json_from_markdown(text: str) -> dict:
    """
    Tries to find and parse a JSON object or array from the model's text response.
    Supports markdown fences, raw JSON strings, and performs basic cleaning on failure.
    """
    if not text:
        return {}
        
    text_clean = text.strip()
    
    # Try finding markdown code block
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text_clean)
    candidate = json_match.group(1) if json_match else text_clean
    
    # Clean whitespace and try direct load
    try:
        return json.loads(candidate.strip())
    except Exception:
        pass
        
    # If direct load fails, try to find outer curly braces or brackets
    try:
        brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", candidate)
        if brace_match:
            candidate_nested = brace_match.group(1)
            # Remove common trailing comma issues
            cleaned = re.sub(r",\s*(\}|\])", r"\1", candidate_nested)
            return json.loads(cleaned)
    except Exception:
        pass
        
    # Fallback parsing for common keys if model returns slightly distorted JSON
    return {}
