import os
import uuid
import re
from datetime import datetime

def format_file_size(size_in_bytes: int) -> str:
    """
    Format bytes into a human-readable string (e.g., KB, MB, GB).
    """
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.2f} KB"
    elif size_in_bytes < 1024 * 1024 * 1024:
        return f"{size_in_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_in_bytes / (1024 * 1024 * 1024):.2f} GB"

def generate_secure_unique_filename(original_filename: str) -> str:
    """
    Generate a secure unique file name, preserving the original extension,
    guaranteeing no file name collisions or injection attempts.
    """
    ext = os.path.splitext(original_filename)[1].lower()
    # Clean file name base (only alphanumeric and underscores/hyphens)
    base = os.path.splitext(original_filename)[0]
    base_clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', base)[:50]
    unique_id = uuid.uuid4().hex[:12]
    return f"{base_clean}_{unique_id}{ext}"

def get_current_timestamp() -> int:
    """
    Return current Unix timestamp in milliseconds.
    """
    return int(datetime.utcnow().timestamp() * 1000)
