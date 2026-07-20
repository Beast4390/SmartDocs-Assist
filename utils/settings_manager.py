import os
import json

DEFAULT_SETTINGS = {
    "ollama_url": "http://localhost:11434",
    "current_model": "llama3",
    "temperature": 0.7,
    "top_k": 5,
    "max_tokens": 512,
    "streaming": True
}

def get_settings_file_path():
    # Resolve relative to project base or specifically metadata folder
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    metadata_dir = os.path.join(base_dir, "metadata")
    os.makedirs(metadata_dir, exist_ok=True)
    return os.path.join(metadata_dir, "settings.json")

def load_settings() -> dict:
    path = get_settings_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Ensure all default keys are present
                for k, v in DEFAULT_SETTINGS.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            return DEFAULT_SETTINGS.copy()
    else:
        save_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()

def save_settings(settings: dict):
    path = get_settings_file_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving settings: {e}")
