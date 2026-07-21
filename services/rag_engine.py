import time
import logging
from services.vector_store import VectorStore
from services.embedding_service import EmbeddingService
from services.ollama_service import OllamaService

class RAGEngine:
    """
    Service responsible for coordinating retrieval-augmented generation:
    looks up semantic matches, compiles prompts, and returns final responses.
    """
    
    def __init__(self, vector_store: VectorStore, embedding_service: EmbeddingService, ollama_service: OllamaService):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.ollama_service = ollama_service
        self.logger = logging.getLogger("smartdocs.rag_engine")

    def retrieve_context(self, user_message: str, top_k: int = 5) -> list[dict]:
        """
        Retrieves the most relevant document chunks from the local FAISS index.
        """
        if not self.vector_store or not self.embedding_service:
            return []
            
        try:
            # Generate the embedding vector for the query
            query_vector = self.embedding_service.generate_embedding([user_message])
            # Search the local vector store
            results = self.vector_store.search(query_vector, top_k=top_k)
            return results
        except Exception as e:
            # Fallback/Log
            print(f"Error retrieving context: {str(e)}")
            return []

    def build_prompt(self, context_chunks: list[dict], user_message: str) -> str:
        """
        Compiles the strict prompt forcing local LLM compliance to the retrieved context.
        """
        if not context_chunks:
            # Return prompt indicating no context available
            return f"""You are SmartDocs Assistant.

No uploaded document context was found to answer this question.

If the answer is not present in the context, reply:
"I could not find that information in the uploaded documents."

Do not invent facts.

Question: {user_message}
Answer:"""

        context_str = ""
        for i, chunk in enumerate(context_chunks):
            filename = chunk.get("filename") or "Unknown Document"
            chunk_num = chunk.get("chunk_number") or 1
            content = chunk.get("text") or ""
            context_str += f"\n[DOCUMENT: {filename} | CHUNK: {chunk_num}]\n{content}\n"

        prompt = f"""You are SmartDocs Assistant.

Answer ONLY using the provided document context below. 

Guidelines:
1. If the answer is not present in the context, reply exactly: "I could not find that information in the uploaded documents."
2. Do not invent facts, fabricate details, or extrapolate beyond what is explicitly written in the context.
3. Always cite the document name and chunk number used in your answer when referencing facts from the context.

Retrieved Document Context:
{context_str}

User Question: {user_message}

Answer:"""
        return prompt

    def format_sources(self, results: list[dict]) -> list[dict]:
        """
        Standardizes cited document references.
        """
        sources = []
        for r in results:
            sources.append({
                "filename": r.get("filename", "Unknown Document"),
                "chunk": r.get("chunk_number", 1),
                "similarity_score": float(r.get("score", 0.0))
            })
        return sources

    def ask_question(self, user_message: str, model_name: str = "llama3", top_k: int = 5, temperature: float = 0.7, max_tokens: int = 512, stream: bool = False) -> dict:
        """
        Coordinates full RAG: gets question, fetches similarity matches, compiles prompt, and calls Ollama.
        """
        retrieval_start = time.time()
        results = self.retrieve_context(user_message, top_k=top_k)
        retrieval_time_ms = int((time.time() - retrieval_start) * 1000)

        prompt = self.build_prompt(results, user_message)
        sources = self.format_sources(results)

        options = {
            "temperature": temperature,
            "num_predict": max_tokens
        }

        if stream:
            # Return a generator for stream mode
            return {
                "success": True,
                "stream": True,
                "sources": sources,
                "retrieval_time_ms": retrieval_time_ms,
                "model": model_name,
                "generator": self.ollama_service.stream_response(model_name, prompt, options)
            }
        else:
            generation_start = time.time()
            try:
                res = self.ollama_service.generate(model_name, prompt, options)
                answer = res.get("response", "").strip()
            except Exception as e:
                self.logger.error(f"Error communicating with local Ollama service: {str(e)}", exc_info=True)
                answer = "Ollama is currently offline. Please start the Ollama server and try again. Run: ollama serve"
            generation_time_ms = int((time.time() - generation_start) * 1000)

            return {
                "success": True,
                "stream": False,
                "answer": answer,
                "sources": sources,
                "retrieval_time_ms": retrieval_time_ms,
                "generation_time_ms": generation_time_ms,
                "model": model_name
            }
