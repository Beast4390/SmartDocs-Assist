import os
import json
import logging
import numpy as np
from datetime import datetime
import faiss

class VectorStore:
    """
    Service responsible for managing the local FAISS index,
    indexing document embeddings, serializing to disk, and performing similarity lookups.
    """
    
    def __init__(self, index_folder: str = "faiss_index", embeddings_folder: str = "embeddings"):
        self.logger = logging.getLogger("smartdocs.vector_store")
        self.index_folder = index_folder
        self.embeddings_folder = embeddings_folder
        self.index = None
        self.mapping = []
        self.index_metadata = {
            "total_documents": 0,
            "total_vectors": 0,
            "last_updated": "None",
            "search_requests": 0,
            "embedding_model": "all-MiniLM-L6-v2"
        }
        
        os.makedirs(self.index_folder, exist_ok=True)
        self.load_index()

    def create_index(self, dimension: int = 384):
        """Creates an empty Flat Inner Product (cosine similarity on normalized vectors) index."""
        self.index = faiss.IndexFlatIP(dimension)

    def format_size(self, size_bytes: int) -> str:
        """Helper to format file size cleanly."""
        for unit in ['Bytes', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"

    def normalize_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """Applies L2 normalization to keep dot products equivalent to cosine similarity."""
        if len(vectors.shape) == 1:
            vectors = np.expand_dims(vectors, axis=0)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        return (vectors / norms).astype('float32')

    def save_index(self):
        """Serializes the active index state, mappings, and metadata cleanly to disk."""
        try:
            index_path = os.path.join(self.index_folder, "index.faiss")
            mapping_path = os.path.join(self.index_folder, "mapping.json")
            meta_path = os.path.join(self.index_folder, "index_metadata.json")

            if self.index is not None:
                faiss.write_index(self.index, index_path)

            with open(mapping_path, "w", encoding="utf-8") as f:
                json.dump(self.mapping, f, indent=4, ensure_ascii=False)

            self.index_metadata["total_vectors"] = self.index.ntotal if self.index is not None else 0
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(self.index_metadata, f, indent=4, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"Error saving FAISS index: {str(e)}")

    def save_metadata(self):
        """Saves only the index metadata file to update stats (e.g. search requests)."""
        try:
            meta_path = os.path.join(self.index_folder, "index_metadata.json")
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(self.index_metadata, f, indent=4, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"Error saving index metadata: {str(e)}")

    def load_index(self) -> bool:
        """Loads serialized index files and mappings from local storage."""
        try:
            index_path = os.path.join(self.index_folder, "index.faiss")
            mapping_path = os.path.join(self.index_folder, "mapping.json")
            meta_path = os.path.join(self.index_folder, "index_metadata.json")

            if os.path.exists(index_path):
                self.index = faiss.read_index(index_path)
            else:
                self.create_index(384)

            if os.path.exists(mapping_path):
                with open(mapping_path, "r", encoding="utf-8") as f:
                    self.mapping = json.load(f)
            else:
                self.mapping = []

            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    loaded_meta = json.load(f)
                    # Merge keys carefully
                    for k, v in loaded_meta.items():
                        self.index_metadata[k] = v
            return True
        except Exception as e:
            self.logger.error(f"Error loading FAISS index: {str(e)}")
            self.create_index(384)
            self.mapping = []
            return False

    def add_embeddings(self, document_id: str, chunks: list[dict], vectors: np.ndarray, filename: str):
        """
        Adds computed vectors to the local FAISS index and registers chunk mapping.
        Rebuilds the index automatically to ensure total synchronization on disk.
        """
        self.rebuild_index()

    def delete_document(self, document_id: str):
        """
        Deletes all chunks/embeddings related to a document by running a full rebuild of the FAISS space.
        """
        self.rebuild_index()

    def search(self, query_vector: np.ndarray, top_k: int = 5) -> list[dict]:
        """
        Performs cosine similarity search using the local FAISS index.
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        # Increment search request counter and save
        self.index_metadata["search_requests"] = self.index_metadata.get("search_requests", 0) + 1
        self.save_metadata()

        # Normalize query vector
        q_norm = self.normalize_vectors(query_vector)

        # Cap k dynamically
        k = min(top_k, self.index.ntotal)
        if k <= 0:
            return []

        D, I = self.index.search(q_norm, k)

        results = []
        for score, idx in zip(D[0], I[0]):
            if idx == -1 or idx >= len(self.mapping):
                continue
            chunk_data = self.mapping[idx]
            results.append({
                "document_id": chunk_data["document_id"],
                "chunk_id": chunk_data["chunk_id"],
                "chunk_number": chunk_data.get("chunk_number", 1),
                "score": round(float(score), 4),
                "text": chunk_data["text"],
                "filename": chunk_data.get("filename", "Unknown Document"),
                "word_count": chunk_data.get("word_count", len(chunk_data["text"].split()))
            })
        return results

    def rebuild_index(self):
        """
        Reconstructs the FAISS index by compiling all local NumPy matrices stored in embeddings/ folder.
        This maintains perfect alignment, deduplicates, and purges any deleted structures cleanly.
        """
        try:
            if not os.path.exists(self.embeddings_folder):
                self.create_index(384)
                self.mapping = []
                self.save_index()
                return

            all_chunks = []
            all_vectors = []
            indexed_doc_ids = set()

            for doc_id in os.listdir(self.embeddings_folder):
                doc_path = os.path.join(self.embeddings_folder, doc_id)
                if not os.path.isdir(doc_path):
                    continue

                chunks_path = os.path.join(doc_path, 'chunks.json')
                vectors_path = os.path.join(doc_path, 'vectors.npy')
                meta_path = os.path.join(doc_path, 'metadata.json')

                if os.path.exists(chunks_path) and os.path.exists(vectors_path) and os.path.exists(meta_path):
                    try:
                        with open(chunks_path, 'r', encoding='utf-8') as f:
                            chunks = json.load(f)
                        with open(meta_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                        vectors = np.load(vectors_path)

                        # Try to find original human-readable filename from metadata directory
                        original_filename = meta.get('filename', doc_id)
                        metadata_dir = os.path.join(os.path.dirname(self.embeddings_folder), 'metadata')
                        if os.path.exists(metadata_dir):
                            for fname in os.listdir(metadata_dir):
                                if fname.endswith('.json'):
                                    try:
                                        with open(os.path.join(metadata_dir, fname), 'r', encoding='utf-8') as mf:
                                            m = json.load(mf)
                                            if m.get('document_id') == doc_id:
                                                original_filename = m.get('original_filename', original_filename)
                                                break
                                    except Exception:
                                        pass

                        for chunk in chunks:
                            chunk['filename'] = original_filename
                            all_chunks.append(chunk)

                        all_vectors.append(vectors)
                        indexed_doc_ids.add(doc_id)
                    except Exception as rebuild_err:
                        self.logger.warning(f"Skipping rebuild folder {doc_id} due to read error: {str(rebuild_err)}")

            if all_vectors:
                stacked_vectors = np.vstack(all_vectors).astype('float32')
                dimension = stacked_vectors.shape[1]

                self.create_index(dimension)
                norm_vectors = self.normalize_vectors(stacked_vectors)
                self.index.add(norm_vectors)

                self.mapping = all_chunks
                self.index_metadata["total_documents"] = len(indexed_doc_ids)
                self.index_metadata["total_vectors"] = self.index.ntotal
                self.index_metadata["last_updated"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                self.create_index(384)
                self.mapping = []
                self.index_metadata["total_documents"] = 0
                self.index_metadata["total_vectors"] = 0
                self.index_metadata["last_updated"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

            self.save_index()
        except Exception as e:
            self.logger.error(f"Critical error rebuilding FAISS index: {str(e)}")

    def get_index_stats(self) -> dict:
        """Retrieves real-time index stats including file size on disk."""
        index_path = os.path.join(self.index_folder, "index.faiss")
        size_bytes = os.path.getsize(index_path) if os.path.exists(index_path) else 0

        return {
            "total_documents": self.index_metadata.get("total_documents", 0),
            "total_vectors": self.index_metadata.get("total_vectors", 0),
            "index_size_bytes": size_bytes,
            "index_size_formatted": self.format_size(size_bytes),
            "last_updated": self.index_metadata.get("last_updated", "None"),
            "search_requests": self.index_metadata.get("search_requests", 0),
            "embedding_model": self.index_metadata.get("embedding_model", "all-MiniLM-L6-v2")
        }
