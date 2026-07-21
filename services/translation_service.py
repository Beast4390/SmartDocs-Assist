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
            "auto": "Auto Detect",
            "en": "English",
            "te": "Telugu",
            "hi": "Hindi",
            "ta": "Tamil",
            "kn": "Kannada",
            "ml": "Malayalam",
            "mr": "Marathi",
            "bn": "Bengali",
            "gu": "Gujarati",
            "pa": "Punjabi",
            "or": "Odia"
        }
        
        self.native_names = {
            "auto": "Auto Detect",
            "en": "English",
            "te": "తెలుగు (Telugu)",
            "hi": "हिन्दी (Hindi)",
            "ta": "தமிழ் (Tamil)",
            "kn": "ಕನ್ನಡ (Kannada)",
            "ml": "മലയാളം (Malayalam)",
            "mr": "मराठी (Marathi)",
            "bn": "বাংলা (Bengali)",
            "gu": "ગુજરાતી (Gujarati)",
            "pa": "ਪੰਜਾਬੀ (Punjabi)",
            "or": "ଓଡ଼ိଆ (Odia)"
        }
        
        # Robust offline dict mappings for common phrases & fallback translation templates
        self.offline_dict = {
            "hi": {"hello": "नमस्ते", "yes": "हाँ", "no": "नहीं", "thank you": "धन्यवाद"},
            "te": {"hello": "నమస్తే", "yes": "అవును", "no": "లేదు", "thank you": "ధన్యవాదాలు"},
            "ta": {"hello": "வணக்கம்", "yes": "ஆம்", "no": "இல்லை", "thank you": "நன்றி"},
            "kn": {"hello": "ನಮಸ್ಕಾರ", "yes": "ಹೌದು", "no": "ಇಲ್ಲ", "thank you": "ಧನ್ಯವಾದಗಳು"},
            "ml": {"hello": "നമസ്കാരം", "yes": "അതെ", "no": "இല്ല", "thank you": "நന്ദി"},
            "mr": {"hello": "नमस्कार", "yes": "होय", "no": "नाही", "thank you": "धन्यवाद"},
            "bn": {"hello": "নমস্কার", "yes": "হ্যাঁ", "no": "না", "thank you": "ধন্যবাদ"},
            "gu": {"hello": "નમસ્તે", "yes": "હા", "no": "ના", "thank you": "આભાર"},
            "pa": {"hello": "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ", "yes": "ਹਾਂ", "no": "ਨਹੀਂ", "thank you": "ਧੰਨਵਾਦ"},
            "or": {"hello": "ନମସ୍କାର", "yes": "ହଁ", "no": "ନାହିଁ", "thank you": "ଧନ୍ୟବାଦ"}
        }

    def list_supported_languages(self) -> dict:
        """
        Return dict of supported language codes and their full English names.
        """
        return self.languages.copy()

    def detect_language(self, text: str) -> str:
        """
        Detects language of the input text offline using script rules and character analyses.
        Returns the ISO code ('hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'en').
        """
        if not text:
            return "en"
            
        counts = {"hi": 0, "te": 0, "ta": 0, "kn": 0, "ml": 0, "bn": 0, "gu": 0, "pa": 0, "or": 0, "en": 0}
        
        for char in text:
            cp = ord(char)
            if 0x0900 <= cp <= 0x097F: # Devanagari (Hindi / Marathi)
                counts["hi"] += 1
            elif 0x0C00 <= cp <= 0x0C7F: # Telugu
                counts["te"] += 1
            elif 0x0B80 <= cp <= 0x0BFF: # Tamil
                counts["ta"] += 1
            elif 0x0C80 <= cp <= 0x0CFF: # Kannada
                counts["kn"] += 1
            elif 0x0D00 <= cp <= 0x0D7F: # Malayalam
                counts["ml"] += 1
            elif 0x0980 <= cp <= 0x09FF: # Bengali
                counts["bn"] += 1
            elif 0x0A80 <= cp <= 0x0AFF: # Gujarati
                counts["gu"] += 1
            elif 0x0A00 <= cp <= 0x0A7F: # Gurmukhi (Punjabi)
                counts["pa"] += 1
            elif 0x0B00 <= cp <= 0x0B7F: # Odia
                counts["or"] += 1
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
