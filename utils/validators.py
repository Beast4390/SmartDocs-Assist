import os
import re
from utils.constants import ALLOWED_EXTENSIONS, MAX_CONTENT_LENGTH
from utils.logger import get_security_logger

def validate_file_extension(filename: str) -> bool:
    """
    Check if the file extension is allowed by our local enterprise system configuration.
    """
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def validate_file_size(file_size_bytes: int) -> bool:
    """
    Ensure the uploaded file does not exceed the enterprise boundaries.
    """
    return file_size_bytes <= MAX_CONTENT_LENGTH

def validate_safe_filename(filename: str) -> bool:
    """
    Verifies that a filename does not contain path traversal sequences or malicious characters.
    """
    # Prevent empty filenames, absolute paths, or directory traversal sequences
    if not filename or filename.startswith('/') or '..' in filename or '\\' in filename:
        return False
    # Only allow safe alphanumeric characters, spaces, dashes, underscores and dots
    return bool(re.match(r'^[a-zA-Z0-9_\-\. ]+$', filename))

def validate_path_safety(base_directory: str, target_path: str) -> bool:
    """
    Ensures that target_path falls securely within base_directory to prevent directory traversal attacks.
    """
    abs_base = os.path.abspath(base_directory)
    abs_target = os.path.abspath(target_path)
    is_safe = abs_target.startswith(abs_base)
    if not is_safe:
        get_security_logger().warning(
            f"PATH TRAVERSAL DETECTED: Base directory is '{abs_base}', but target path requested was '{abs_target}'."
        )
    return is_safe

def validate_chat_payload(payload: dict) -> tuple[bool, str]:
    """
    Validates that a chat payload contains required parameters.
    """
    if not payload:
        get_security_logger().warning("Chat payload validation failed: Empty request body")
        return False, "Empty request body"
    if 'message' not in payload or not str(payload['message']).strip():
        get_security_logger().warning("Chat payload validation failed: Missing message content")
        return False, "The 'message' parameter is required and cannot be empty."
    return True, ""

def validate_search_payload(payload: dict) -> tuple[bool, str]:
    """
    Validates that a search payload contains required parameters.
    """
    if not payload:
        get_security_logger().warning("Search payload validation failed: Empty request body")
        return False, "Empty request body"
    if 'query' not in payload or not str(payload['query']).strip():
        get_security_logger().warning("Search payload validation failed: Missing query content")
        return False, "The 'query' parameter is required and cannot be empty."
    return True, ""
