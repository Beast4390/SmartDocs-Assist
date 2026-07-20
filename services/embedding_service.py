import os
import json
import uuid
from datetime import datetime
import numpy as np

class ModelLoadingException(Exception):
    """Exception raised when SentenceTransformer model fails to load."""
    pass

class EmbeddingGenerationException(Exception):
    """Exception raised when vector embedding generation fails."""
    pass

class InvalidDocumentException(Exception):
    """Exception raised when a document is empty or invalid for embedding."""
    pass

class EmbeddingService:
    """
    Enterprise Embedding Service.
    Handles intelligent chunking, sentence-transformer embedding generation, 
    and secure offline local storage using NumPy binaries.
    """
    def __init__(self, embeddings_folder: str = "embeddings", model_name: str = "all-MiniLM-L6-v2", chunk_size: int = 1000, chunk_overlap: int = 200):
        self.embeddings_folder = embeddings_folder
        self.model_name = model_name
        self.model = None
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        os.makedirs(self.embeddings_folder, exist_ok=True)

    def load_model(self):
        """
        Loads the SentenceTransformer model into memory.
        Loads only once and caches the reference.
        """
        if self.model is not None:
            return self.model
            
        try:
            from sentence_transformers import SentenceTransformer
            # Set offline download/loading safe parameters if needed
            self.model = SentenceTransformer(self.model_name)
            return self.model
        except Exception as e:
            raise ModelLoadingException(f"Failed to load embedding model '{self.model_name}': {str(e)}")

    def is_heading(self, paragraph: str) -> bool:
        """Helper to determine if a paragraph is likely a heading/section divider."""
        p = paragraph.strip()
        if not p:
            return False
        words = p.split()
        if len(words) < 15:
            # If paragraph doesn't end with typical sentence punctuation
            if not p[-1] in {'.', '?', '!', '"', ')'}:
                return True
        if p.startswith('#'):
            return True
        return False

    def split_into_chunks(self, text: str, document_id: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[dict]:
        """
        Intelligently split text into overlapping chunks of a specified size (words).
        Preserves paragraph boundaries and keeps headings with their subsequent block.
        Never splits words and ignores empty chunks.
        """
        if not text or not text.strip():
            return []

        # 1. Normalize text and split into paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        # 2. Merge headings with their next paragraphs
        merged_paragraphs = []
        i = 0
        while i < len(paragraphs):
            p = paragraphs[i]
            if self.is_heading(p) and i + 1 < len(paragraphs):
                # Group heading and next paragraph as a single cohesive unit
                merged_paragraphs.append(p + "\n\n" + paragraphs[i + 1])
                i += 2
            else:
                merged_paragraphs.append(p)
                i += 1

        chunks = []
        current_words = []
        chunk_number = 1

        for p in merged_paragraphs:
            p_words = p.split()
            if not p_words:
                continue

            # If adding this paragraph fits inside the chunk_size
            if len(current_words) + len(p_words) <= chunk_size:
                current_words.extend(p_words)
            else:
                # If there are words in the current chunk, emit it
                if current_words:
                    chunk_text = " ".join(current_words)
                    chunks.append({
                        "chunk_id": str(uuid.uuid4()),
                        "document_id": document_id,
                        "chunk_number": chunk_number,
                        "text": chunk_text,
                        "word_count": len(current_words),
                        "character_count": len(chunk_text)
                    })
                    chunk_number += 1
                    
                    # Prepare next chunk starting with overlap
                    overlap_words = current_words[-chunk_overlap:] if len(current_words) >= chunk_overlap else current_words
                    current_words = list(overlap_words)

                # Now check if the single paragraph itself is larger than the entire chunk_size
                if len(p_words) > chunk_size:
                    idx = 0
                    while idx < len(p_words):
                        chunk_slice = p_words[idx : idx + chunk_size]
                        if chunk_slice:
                            chunk_text = " ".join(chunk_slice)
                            chunks.append({
                                "chunk_id": str(uuid.uuid4()),
                                "document_id": document_id,
                                "chunk_number": chunk_number,
                                "text": chunk_text,
                                "word_count": len(chunk_slice),
                                "character_count": len(chunk_text)
                            })
                            chunk_number += 1
                        idx += (chunk_size - chunk_overlap)
                    # Remaining words set as overlap for the subsequent loop
                    overlap_words = p_words[-chunk_overlap:] if len(p_words) >= chunk_overlap else p_words
                    current_words = list(overlap_words)
                else:
                    # Paragraph fits in a new chunk
                    current_words.extend(p_words)

        # Emit any leftover words
        # Only emit if it contains more than the duplicate overlap or if it's the first/only chunk
        if current_words and (len(current_words) > chunk_overlap or len(chunks) == 0):
            chunk_text = " ".join(current_words)
            chunks.append({
                "chunk_id": str(uuid.uuid4()),
                "document_id": document_id,
                "chunk_number": chunk_number,
                "text": chunk_text,
                "word_count": len(current_words),
                "character_count": len(chunk_text)
            })

        return chunks

    def generate_embedding(self, text_or_texts) -> np.ndarray:
        """
        Generate dense vector embeddings for a given piece of text or collection of texts.
        """
        model = self.load_model()
        try:
            embeddings = model.encode(text_or_texts, show_progress_bar=False)
            return np.array(embeddings, dtype=np.float32)
        except Exception as e:
            raise EmbeddingGenerationException(f"Failed to generate vector embeddings: {str(e)}")

    def generate_document_embeddings(self, document_id: str, text: str, chunk_size: int = None, chunk_overlap: int = None) -> tuple[list[dict], np.ndarray, dict]:
        """
        Fully ingest, chunk, embed, and compile local schema files for a single document.
        """
        if not text or not text.strip():
            raise InvalidDocumentException("Cannot generate embeddings for an empty or missing text payload.")

        # 1. Chunk document
        c_size = chunk_size or self.chunk_size
        c_overlap = chunk_overlap or self.chunk_overlap
        chunks = self.split_into_chunks(text, document_id, chunk_size=c_size, chunk_overlap=c_overlap)
        if not chunks:
            raise InvalidDocumentException("Document partitioning yielded zero valid text chunks.")

        # 2. Extract raw texts for high-speed batch encoding
        texts_to_embed = [c["text"] for c in chunks]
        
        # 3. Generate embeddings
        vectors = self.generate_embedding(texts_to_embed)
        
        # Determine dimensions safely
        vector_dimension = int(vectors.shape[1]) if len(vectors.shape) > 1 else int(vectors.shape[0])
        
        # 4. Build embedding metadata file
        metadata = {
            "document_id": document_id,
            "embedding_model": self.model_name,
            "vector_dimension": vector_dimension,
            "total_chunks": len(chunks),
            "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        return chunks, vectors, metadata

    def save_embeddings(self, document_id: str, chunks: list[dict], embeddings: np.ndarray, metadata: dict):
        """
        Saves document chunks, vectors, and metadata locally in a dedicated directory.
        """
        doc_dir = os.path.join(self.embeddings_folder, document_id)
        os.makedirs(doc_dir, exist_ok=True)

        # 1. Save chunks.json
        chunks_path = os.path.join(doc_dir, "chunks.json")
        with open(chunks_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, indent=4, ensure_ascii=False)

        # 2. Save vectors.npy (high-fidelity dense matrix binary representation)
        vectors_path = os.path.join(doc_dir, "vectors.npy")
        np.save(vectors_path, embeddings)

        # 3. Save metadata.json
        metadata_path = os.path.join(doc_dir, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=4, ensure_ascii=False)

    def load_embeddings(self, document_id: str) -> tuple[list[dict], np.ndarray, dict]:
        """
        Loads and returns document chunks, vectors, and metadata from local storage.
        """
        doc_dir = os.path.join(self.embeddings_folder, document_id)
        if not os.path.exists(doc_dir):
            raise FileNotFoundError(f"Embeddings directory for document '{document_id}' not found.")

        chunks_path = os.path.join(doc_dir, "chunks.json")
        vectors_path = os.path.join(doc_dir, "vectors.npy")
        metadata_path = os.path.join(doc_dir, "metadata.json")

        if not (os.path.exists(chunks_path) and os.path.exists(vectors_path) and os.path.exists(metadata_path)):
            raise FileNotFoundError(f"One or more storage components missing in embeddings folder for document: {document_id}")

        # Load chunks
        with open(chunks_path, "r", encoding="utf-8") as f:
            chunks = json.load(f)

        # Load vectors
        embeddings = np.load(vectors_path)

        # Load metadata
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        return chunks, embeddings, metadata
