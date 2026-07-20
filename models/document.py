from typing import Optional
from utils.helpers import get_current_timestamp

class Document:
    """
    Model representation for uploaded enterprise documents pending indexing or successfully stored.
    """
    def __init__(self, doc_id: int, name: str, size_bytes: int, file_path: str, status: str = "Uploaded", created_at: Optional[int] = None):
        self.id = doc_id
        self.name = name
        self.size_bytes = size_bytes
        self.file_path = file_path
        self.status = status # "Uploaded", "Processing", "Indexed", "Error"
        self.created_at = created_at or get_current_timestamp()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "size_bytes": self.size_bytes,
            "status": self.status,
            "created_at": self.created_at
        }
