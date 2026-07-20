import uuid
from typing import Optional
from utils.helpers import get_current_timestamp

class UserSession:
    """
    Model representation for a local user session.
    """
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.created_at = get_current_timestamp()
        self.last_active = get_current_timestamp()

    def touch(self):
        """
        Updates the last active time to present.
        """
        self.last_active = get_current_timestamp()

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "last_active": self.last_active
        }
