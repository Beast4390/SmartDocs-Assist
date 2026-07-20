from utils.constants import DEFAULT_OLLAMA_URL, DEFAULT_MODEL, DEFAULT_EMBEDDING_MODEL

class Settings:
    """
    Model representation for local node configurations, including local server URLs and specific model paths.
    """
    def __init__(self, ollama_url: str = DEFAULT_OLLAMA_URL, current_model: str = DEFAULT_MODEL, embedding_model: str = DEFAULT_EMBEDDING_MODEL):
        self.ollama_url = ollama_url
        self.current_model = current_model
        self.embedding_model = embedding_model

    def update(self, ollama_url: Optional[str] = None, current_model: Optional[str] = None, embedding_model: Optional[str] = None):
        if ollama_url is not None:
            self.ollama_url = ollama_url
        if current_model is not None:
            self.current_model = current_model
        if embedding_model is not None:
            self.embedding_model = embedding_model

    def to_dict(self) -> dict:
        return {
            "ollama_url": self.ollama_url,
            "current_model": self.current_model,
            "embedding_model": self.embedding_model
        }
