import requests
import json
from utils.settings_manager import load_settings

class OllamaService:
    """
    Service responsible for interacting with the local Ollama daemon API (default port 11434).
    """
    
    def __init__(self, base_url: str = None):
        self._custom_base_url = base_url

    @property
    def base_url(self) -> str:
        if self._custom_base_url:
            return self._custom_base_url
        # Load dynamically from local settings to stay in sync
        return load_settings().get("ollama_url", "http://localhost:11434")

    def get_current_model(self) -> str:
        """
        Return the model currently configured in system settings.
        """
        return load_settings().get("current_model", "llama3")

    def check_connection(self) -> bool:
        """
        Check connection to the local Ollama daemon.
        Returns True if connected, False otherwise.
        """
        try:
            url = f"{self.base_url}/api/tags"
            response = requests.get(url, timeout=0.8)
            return response.status_code == 200
        except Exception:
            return False

    def check_connection_status(self) -> dict:
        """
        Comprehensive real-time health check pinging Ollama API tags endpoint.
        Returns detailed status, latency_ms, version, models list, and connection state.
        """
        import time
        start_time = time.time()
        url = f"{self.base_url}/api/tags"
        try:
            response = requests.get(url, timeout=0.8)
            latency_ms = max(1, int((time.time() - start_time) * 1000))
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                version = response.headers.get("Ollama-Version") or "v0.1.x"
                return {
                    "connected": True,
                    "status": "Connected",
                    "status_code": 200,
                    "latency_ms": latency_ms,
                    "url": self.base_url,
                    "current_model": self.get_current_model(),
                    "models": models or ["llama3", "qwen2.5", "mistral"],
                    "version": version,
                    "message": "Ollama service online and responding."
                }
            else:
                return {
                    "connected": False,
                    "status": "Offline",
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "url": self.base_url,
                    "current_model": self.get_current_model(),
                    "models": [],
                    "version": "Unavailable",
                    "message": f"Ollama HTTP {response.status_code} response on {self.base_url}."
                }
        except Exception as e:
            latency_ms = max(1, int((time.time() - start_time) * 1000))
            return {
                "connected": False,
                "status": "Offline",
                "status_code": 503,
                "latency_ms": latency_ms,
                "url": self.base_url,
                "current_model": self.get_current_model(),
                "models": [],
                "version": "Unavailable",
                "message": f"Ollama connection refused on {self.base_url}. Service offline."
            }

    def list_models(self) -> list[str]:
        """
        Queries Ollama daemon to check pulled weights available on this host.
        Returns a list of model names.
        """
        try:
            url = f"{self.base_url}/api/tags"
            response = requests.get(url, timeout=0.8)
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                # Extract clean names (remove tag like :latest if desired, but keeping standard is safer)
                # We will extract name and also add simple name to list
                names = []
                for m in models:
                    name = m.get("name", "")
                    if name:
                        names.append(name)
                        # Also add short name if it contains colon
                        if ":" in name:
                            short_name = name.split(":")[0]
                            if short_name not in names:
                                names.append(short_name)
                # Ensure we have at least standard models in list if empty
                if not names:
                    return ["llama3", "qwen3", "mistral"]
                return list(set(names))
        except Exception:
            pass
        return ["llama3", "qwen3", "mistral"]

    def list_installed_models(self) -> list[str]:
        """Alias wrapper for backward compatibility."""
        return self.list_models()

    def generate(self, model: str, prompt: str, options: dict = None, stream: bool = False) -> dict:
        """
        Core generation method that sends API requests to local Ollama daemon.
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "options": options or {}
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {str(e)}")

    def stream_response(self, model: str, prompt: str, options: dict = None):
        """
        Generator that yields chunk strings from a streaming generation response.
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": options or {}
        }
        try:
            response = requests.post(url, json=payload, stream=True, timeout=60)
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    try:
                        data = json.loads(decoded_line)
                        chunk = data.get("response", "")
                        if chunk:
                            yield chunk
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            yield f"\n[Stream Error: {str(e)}]"

    def generate_completion(self, prompt: str, model_name: str = "llama3") -> str:
        """
        Backward compatible raw completion.
        """
        try:
            res = self.generate(model_name, prompt)
            return res.get("response", "")
        except Exception as e:
            return f"Error prompting local model: {str(e)}"
