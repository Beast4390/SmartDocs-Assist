# SmartDocs Assistant – User Guide

Welcome to **SmartDocs Assistant**, your secure, 100% offline enterprise knowledge intelligence platform. This guide explains how to leverage the system's advanced features to process, search, compare, and chat with your corporate documents without any data leaving your local node.

---

## Table of Contents
1. [Core Features Overview](#1-core-features-overview)
2. [Document Ingestion and Management](#2-document-ingestion-and-management)
3. [Document Viewer](#3-document-viewer)
4. [Semantic and Keyword Search](#4-semantic-and-keyword-search)
5. [Offline AI Chat & RAG](#5-offline-ai-chat--rag)
6. [Advanced Enterprise Intelligence Modules](#6-advanced-enterprise-intelligence-modules)
7. [Voice Assistant & Dictation](#7-voice-assistant--dictation)
8. [Offline Settings](#8-offline-settings)

---

## 1. Core Features Overview
SmartDocs Assistant runs entirely locally on your enterprise hardware. It does not send any files, queries, or voice data to third-party cloud services. The system relies on local AI models (such as Ollama and Whisper) to process your data safely behind the corporate firewall.

---

## 2. Document Ingestion and Management
To begin extracting knowledge from your files:
1. Navigate to the **Document Ingestion** page (`/upload`).
2. Drag and drop your corporate files, or click to browse. The platform supports **PDF**, **DOCX**, and **PPTX** formats (up to 50MB per file).
3. Once dropped/selected, the ingestion pipeline will automatically:
   - Extract raw text, tables, slides, and notes.
   - Standardize and clean whitespace and encoding.
   - Split text into logical, overlapping semantic chunks.
   - Generate local vector embeddings offline and compile them into the FAISS index.
4. Your document will appear in the **Uploaded Files** table with an `embedded` status.

---

## 3. Document Viewer
To examine the extracted contents of any ingested document:
1. Locate the document in the files table on either the **Dashboard** or **Ingestion** page.
2. Click the **View** button (eye icon) next to the document name.
3. The **Document Viewer** (`/document/<filename>`) displays:
   - Full extracted, sanitized text content.
   - Comprehensive file metadata (file size, page counts, word/character counts, upload timestamps).
   - A list of all generated semantic text chunks with their structural boundaries.

---

## 4. Semantic and Keyword Search
To look up policies, specifications, or clauses:
1. Navigate to the **Semantic Search** page (`/search`).
2. Enter your query or phrase in the search box.
3. Choose your search preference:
   - **Semantic Search**: Uses dense vector similarity to match the conceptual meaning of your query, even if the exact keywords do not match.
   - **Keyword Search**: Uses classic string-matching algorithms to find exact terms.
4. The system lists matching paragraphs/excerpts from all ingested documents, ranked by relevance score, with clickable citations.

---

## 5. Offline AI Chat & RAG
The **Offline AI Chat** page (`/chat`) lets you have natural language conversations with your uploaded knowledge base:
1. Select your target AI model from the model selector (e.g., `llama3`, `qwen3`, or `mistral`).
2. Type your question.
3. The system will automatically:
   - Search the local FAISS index for relevant excerpts.
   - Construct a secure, factual prompt containing only the matched text context.
   - Query the local Ollama LLM.
4. The response will stream in token-by-token. 
5. Underneath the answer, you can expand the **Sources & Citations** panel to inspect the exact documents and paragraph chunks used to formulate the response.

---

## 6. Advanced Enterprise Intelligence Modules
On the **Enterprise Reports** page (`/reports`), you can run sophisticated cognitive tasks on single or multiple documents:
- **Executive Summary**: Generates structured summaries (short, detailed, executive strategic briefings, bullet-points, or dense technical briefs) based on FAISS context.
- **Consulting Report**: Formulates comprehensive management reports comprising findings, operational insights, risks, and strategic recommendations.
- **Deadlines Timeline**: Extracted chronological lists of dates, milestones, events, and deadlines.
- **Enterprise FAQ**: Compiles a professional Frequently Asked Questions list with explicit citations.
- **Keyword Taxonomy**: Extracts and groups technical jargon, acronyms, and vocabulary terms by category and relevance.
- **Entity Extractor**: Identifies and organizes named entities (People, Organizations, Locations, Dates, Technologies, Laws, Policies) mentioned in your documents.
- **Knowledge Graph**: Generates a network graph mapping related topics, documents, and entities.
- **Thematic Topics**: Semantic clustering of document paragraphs into distinct thematic groups.
- **Action Items Table**: Project management breakdown detailing tasks, divisions responsible, due dates, and priority scores.

---

## 7. Voice Assistant & Dictation
The **Voice Assistant** page (`/voice`) enables speech-to-text features completely offline:
1. Click **Start Dictation** to begin recording your microphone input.
2. Click **Stop Recording** when finished.
3. The local Whisper model will transcribe your spoken audio into text instantly.
4. You can ask the Voice Assistant a question directly, which will query the RAG pipeline using your transcribed speech, or translate the transcript into multiple languages completely offline.

---

## 8. Offline Settings
The **System Settings** page (`/settings`) allows you to tune the platform's execution:
- Adjust LLM parameters (Temperature, Max Response Tokens, and Top-K context retrieval limits).
- View local connection metrics and available offline model weights on your daemon.
- Modify active default models for processing and RAG reasoning.
- Track cognitive performance statistics.
