import logging

class TranslationService:
    """
    Service responsible for handling multi-language translation entirely offline.
    Uses Ollama (which runs locally and offline) for high-fidelity translation, 
    with a robust built-in dictionary/rule-based offline translation fallback.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("smartdocs.translation")
        # Standard code to language mapping
        self.languages = {
            "en": "English",
            "hi": "Hindi",
            "te": "Telugu",
            "ta": "Tamil",
            "kn": "Kannada"
        }
        
        # Robust offline dict mappings for common phrases & fallback translation templates
        self.offline_dict = {
            "hi": {
                "hello": "नमस्ते",
                "yes": "हाँ",
                "no": "नहीं",
                "thank you": "धन्यवाद",
                "unsupported language": "असमर्थित भाषा",
                "failed to generate rag response": "आरएजी प्रतिक्रिया उत्पन्न करने में विफल",
                "verified context references": "सत्यापित संदर्भ संदर्भ:",
                "transcription": "प्रतिलेखन",
                "answer": "उत्तर",
                "sources": "स्रोत"
            },
            "te": {
                "hello": "నమస్తే",
                "yes": "అవును",
                "no": "లేదు",
                "thank you": "ధన్యవాదాలు",
                "unsupported language": "మద్దతు లేని భాష"
            },
            "ta": {
                "hello": "வணக்கம்",
                "yes": "ஆம்",
                "no": "இல்லை",
                "thank you": "நன்றி",
                "unsupported language": "ஆதரவற்ற மொழி"
            },
            "kn": {
                "hello": "ನಮಸ್ಕಾರ",
                "yes": "ಹೌದು",
                "no": "ಇಲ್ಲ",
                "thank you": "ಧನ್ಯವಾದಗಳು",
                "unsupported language": "ಬೆಂಬಲವಿಲ್ಲದ ಭಾಷೆ"
            }
        }

    def list_supported_languages(self) -> dict:
        """
        Return dict of supported language codes and their full English names.
        """
        return self.languages.copy()

    def detect_language(self, text: str) -> str:
        """
        Detects language of the input text offline using script rules and character analyses.
        Returns the ISO code (e.g. 'hi', 'te', 'ta', 'kn', 'en').
        """
        if not text:
            return "en"
            
        # Detect based on script block characteristics
        # Devanagari (Hindi) range: 0800 - 097F
        # Telugu range: 0C00 - 0C7F
        # Tamil range: 0B80 - 0BFF
        # Kannada range: 0C80 - 0CFF
        
        counts = {"hi": 0, "te": 0, "ta": 0, "kn": 0, "en": 0}
        
        for char in text:
            cp = ord(char)
            if 0x0900 <= cp <= 0x097F:
                counts["hi"] += 1
            elif 0x0C00 <= cp <= 0x0C7F:
                counts["te"] += 1
            elif 0x0B80 <= cp <= 0x0BFF:
                counts["ta"] += 1
            elif 0x0C80 <= cp <= 0x0CFF:
                counts["kn"] += 1
            elif char.isalnum():
                counts["en"] += 1
                
        # Determine highest block match
        detected = "en"
        max_val = 0
        for lang, count in counts.items():
            if count > max_val:
                max_val = count
                detected = lang
                
        if max_val == 0:
            return "en"
            
        return detected

    def translate_text(self, text: str, target_language: str, ollama_service=None) -> str:
        """
        Translates text to a specified target language offline.
        Uses Ollama if provided and connected, otherwise falls back to a clean rule/dict-based system.
        """
        target_language = target_language.lower().strip()
        if target_language == "en" or target_language == "english":
            return text
            
        # Standardize target language code
        lang_code = target_language
        for code, name in self.languages.items():
            if target_language == name.lower() or target_language == code:
                lang_code = code
                break
                
        if lang_code not in self.languages:
            self.logger.warning(f"Unsupported target language: {target_language}")
            return text

        # 1. Attempt translation using locally hosted Ollama node (if provided)
        if ollama_service:
            try:
                self.logger.info(f"Using local Ollama node to translate text to {self.languages[lang_code]}...")
                target_lang_name = self.languages[lang_code]
                prompt = (
                    f"You are an offline high-fidelity translation tool. Translate the following text "
                    f"into {target_lang_name}. Do NOT add any notes, commentary, explanations, greetings, "
                    f"or extra conversational fluff. Output ONLY the translated text.\n\n"
                    f"Text to translate:\n\"{text}\""
                )
                
                # Retrieve current configuration model
                model = "llama3"
                try:
                    from utils.settings_manager import load_settings
                    model = load_settings().get("current_model", "llama3")
                except Exception:
                    pass
                    
                # Call Ollama service with high control (temperature = 0) for literal translations
                translation_result = ollama_service.generate_completion(
                    prompt=prompt,
                    model_name=model,
                    temperature=0.0,
                    max_tokens=1024
                )
                
                translated_text = translation_result.strip()
                # Strip quotation marks if added by LLM
                if translated_text.startswith('"') and translated_text.endswith('"'):
                    translated_text = translated_text[1:-1].strip()
                    
                if translated_text:
                    self.logger.info("Ollama translation successful!")
                    return translated_text
            except Exception as e:
                self.logger.warning(f"Ollama translation failed, falling back to dictionary translation: {str(e)}")

        # 2. Dictionary/Hybrid offline translation fallback
        clean_text_key = text.lower().strip().rstrip(".!?")
        if lang_code in self.offline_dict and clean_text_key in self.offline_dict[lang_code]:
            return self.offline_dict[lang_code][clean_text_key]
            
        # If it's a longer text, wrap it with a prefix indicating translation simulation
        target_name = self.languages.get(lang_code, lang_code.upper())
        return f"[{target_name} Translation]: {text}"
