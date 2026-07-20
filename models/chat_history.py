from typing import Optional, List
from utils.helpers import get_current_timestamp

class ChatMessage:
    """
    Model representation for an individual message in a chat history.
    """
    def __init__(self, sender: str, text: str, timestamp: Optional[int] = None, sources: Optional[List[dict]] = None):
        self.sender = sender # "user" or "assistant"
        self.text = text
        self.timestamp = timestamp or get_current_timestamp()
        self.sources = sources or []

    def to_dict(self) -> dict:
        return {
            "sender": self.sender,
            "text": self.text,
            "timestamp": self.timestamp,
            "sources": self.sources
        }

class ChatHistory:
    """
    Model representation for storing conversational logs between user and local nodes.
    """
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: List[ChatMessage] = []

    def add_message(self, sender: str, text: str, sources: Optional[List[dict]] = None):
        msg = ChatMessage(sender, text, sources=sources)
        self.messages.append(msg)
        return msg

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "messages": [m.to_dict() for m in self.messages],
            "total_count": len(self.messages)
        }
