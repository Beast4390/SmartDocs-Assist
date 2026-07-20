# Changelog

All notable changes to the **SmartDocs Assistant** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-07-20

### Added
- **Phase 9 Production Readiness**: Optimized startup times, implemented lazy-loading resource allocation, and memory-safe cache management to support edge hardware execution.
- **Advanced rotating logs**: Setup rotating handlers in `/utils/logger.py` to write system execution to `application.log`, general exceptions to `error.log`, local LLM/Whisper/embedding steps to `ai.log`, and security/filename check events to `security.log`.
- **System-wide configurations**: Centralized all operational variables inside `/config.py` and `.env.example`, including chunk sizing, overlap margins, Top-K, model selection, temperature parameters, and log verbosity.
- **Enterprise test suite**: Formulated a comprehensive testing harness under `/tests/` using Python's native `unittest` framework, validating file parsing, chunking, embedding generation, FAISS index compilation, and API controller paths.
- **Production guides**: Published comprehensive user-facing and administrator guides (`USER_GUIDE.md` and `ADMIN_GUIDE.md`) covering installation, maintenance, and air-gapped system operations.
- **Enterprise intelligence stats**: Mounted a persistent statistics display on the dashboard displaying metrics on summarization, consulting reports, clause audits, FAQ nodes, and detected action items.

### Changed
- Refactored `package.json` configurations to declare version `1.0.0` and standardize Express-Vite entry points.
- Refactored file and metadata sanitization to enforce strict safe filenames, MIME verification, and path-traversal boundaries across all REST routes.

### Fixed
- Fixed potential double-newlines and whitespace noise in text parsing engines.
- Corrected edge cases in overlapping chunk dividers where trailing paragraphs could be orphaned.

---
*SmartDocs Assistant - Secure, Offline Enterprise Knowledge Intelligence.*
