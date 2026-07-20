/**
 * SmartDocs Assistant - Client JS Orchestrator
 * Fully handles offline API routing, UI animations, theme toggles, and responsive state.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initToastEngine();
  initPageRouter();
});

/* ==========================================================================
   1. Theme Management (Light / Dark Toggle)
   ========================================================================== */
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    showToast(`Switched to ${newTheme} theme mode`, 'info');
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle i');
  if (!icon) return;
  if (theme === 'dark') {
    icon.className = 'lucide lucide-sun';
    icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
  } else {
    icon.className = 'lucide lucide-moon';
    icon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }
}

/* ==========================================================================
   2. Responsive Sidebar Collapse
   ========================================================================== */
function initSidebar() {
  const burgerBtn = document.getElementById('sidebar-collapse');
  const sidebar = document.getElementById('sidebar');
  if (!burgerBtn || !sidebar) return;

  burgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('active');
  });

  // Close sidebar on tapping outside (on mobile)
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== burgerBtn) {
      sidebar.classList.remove('active');
    }
  });
}

/* ==========================================================================
   3. Toast Notification Engine
   ========================================================================== */
let toastContainer = null;

function initToastEngine() {
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
}

function showToast(message, type = 'success') {
  if (!toastContainer) initToastEngine();

  const toastId = 'toast-' + Date.now();
  const bgClasses = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-info text-white'
  };

  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center ${bgClasses[type] || bgClasses.success} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHTML);

  // Auto remove toast after 4 seconds
  setTimeout(() => {
    const toastElement = document.getElementById(toastId);
    if (toastElement) {
      toastElement.classList.remove('show');
      setTimeout(() => toastElement.remove(), 300);
    }
  }, 4000);
}

/* ==========================================================================
   4. SPA Routing Engine / Page Controllers
   ========================================================================== */
function initPageRouter() {
  const path = window.location.pathname;
  
  if (path.includes('/upload')) {
    initUploadPage();
  } else if (path.includes('/chat')) {
    initChatPage();
  } else if (path.includes('/search')) {
    initSearchPage();
  } else if (path.includes('/voice')) {
    initVoicePage();
  } else if (path.includes('/settings')) {
    initSettingsPage();
  } else if (path.includes('/reports')) {
    initReportsPage();
  } else {
    initDashboardPage();
  }
}

/* ==========================================================================
   5. Page Controller: Dashboard
   ========================================================================== */
function initDashboardPage() {
  fetchSystemStatus();
  fetchRecentDocuments();
  fetchDashboardStats();
}

function fetchSystemStatus() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const modelBadge = document.getElementById('active-model-badge');
        if (modelBadge) {
          modelBadge.textContent = data.settings.current_model.toUpperCase();
        }
      }
    })
    .catch(() => {});
}

function fetchDashboardStats() {
  fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const totalDocs = document.getElementById('stat-total-docs');
        const totalPages = document.getElementById('stat-total-pages');
        const storageUsed = document.getElementById('stat-storage-used');
        const lastUpload = document.getElementById('stat-last-upload');
        const procStatus = document.getElementById('stat-processing-status');
        
        if (totalDocs) totalDocs.textContent = data.total_documents;
        if (totalPages) totalPages.textContent = data.total_pages;
        if (storageUsed) storageUsed.textContent = `${data.storage_used_mb.toFixed(2)} MB`;
        
        if (lastUpload) {
          if (data.last_upload && data.last_upload.name !== "None") {
            const rawDate = data.last_upload.date;
            const cleanDate = rawDate ? rawDate.replace('T', ' ').replace('Z', '') : '';
            lastUpload.textContent = `${data.last_upload.name} (${cleanDate})`;
          } else {
            lastUpload.textContent = "No documents uploaded";
          }
        }
        
        if (procStatus) {
          procStatus.textContent = data.status;
          const procBadge = document.getElementById('stat-processing-badge');
          if (procBadge) {
            if (data.status === "ACTIVE") {
              procBadge.className = "badge bg-success-subtle text-success";
              procBadge.textContent = "Online";
            } else {
              procBadge.className = "badge bg-secondary-subtle text-secondary";
              procBadge.textContent = "Idle";
            }
          }
        }

        // Render Embedding Pipeline Stats (Phase 4)
        const embedTotalDocs = document.getElementById('embed-total-docs');
        const embedTotalChunks = document.getElementById('embed-total-chunks');
        const embedModelName = document.getElementById('embed-model-name');
        const embedAvgChunks = document.getElementById('embed-avg-chunks');
        const embedStatusBadge = document.getElementById('embed-status-badge');
        
        if (embedTotalDocs) embedTotalDocs.textContent = data.total_embedded_documents !== undefined ? data.total_embedded_documents : 0;
        if (embedTotalChunks) embedTotalChunks.textContent = data.total_chunks !== undefined ? data.total_chunks : 0;
        if (embedModelName) {
          embedModelName.textContent = data.embedding_model || 'all-MiniLM-L6-v2';
          embedModelName.title = data.embedding_model || 'all-MiniLM-L6-v2';
        }
        if (embedAvgChunks) embedAvgChunks.textContent = data.average_chunks_per_document !== undefined ? data.average_chunks_per_document.toFixed(1) : '0.0';
        if (embedStatusBadge) {
          const statusVal = data.embedding_status || 'ONLINE';
          embedStatusBadge.textContent = statusVal;
          if (statusVal === 'ONLINE') {
            embedStatusBadge.className = 'badge bg-success-subtle text-success';
          } else {
            embedStatusBadge.className = 'badge bg-danger-subtle text-danger';
          }
        }

        // Render FAISS Specific Stats (Phase 5)
        const faissDocs = document.getElementById('embed-faiss-docs');
        const faissVectors = document.getElementById('embed-faiss-vectors');
        const faissSize = document.getElementById('embed-faiss-size');
        const faissUpdate = document.getElementById('embed-faiss-update');
        const faissSearches = document.getElementById('embed-faiss-searches');

        if (faissDocs) faissDocs.textContent = data.indexed_documents !== undefined ? data.indexed_documents : 0;
        if (faissVectors) faissVectors.textContent = data.total_vectors !== undefined ? data.total_vectors : 0;
        if (faissSize) faissSize.textContent = data.faiss_index_size || '0.0 Bytes';
        if (faissUpdate) {
          const rawUp = data.last_index_update || 'None';
          faissUpdate.textContent = rawUp.replace('T', ' ').substring(0, 19);
          faissUpdate.title = rawUp;
        }
        if (faissSearches) faissSearches.textContent = data.search_requests !== undefined ? data.search_requests : 0;

        // Render RAG & Ollama Specific Stats (Phase 6)
        const ragQuestions = document.getElementById('rag-total-questions');
        const ragRetrieval = document.getElementById('rag-avg-retrieval-time');
        const ragGeneration = document.getElementById('rag-avg-generation-time');
        const ragModel = document.getElementById('rag-active-model');
        const ragStatus = document.getElementById('rag-ollama-status');
        const activeModelBadge = document.getElementById('active-model-badge');

        if (ragQuestions) ragQuestions.textContent = data.total_ai_questions !== undefined ? data.total_ai_questions : 0;
        if (ragRetrieval) ragRetrieval.textContent = `${data.avg_retrieval_time_ms !== undefined ? data.avg_retrieval_time_ms : 0} ms`;
        if (ragGeneration) ragGeneration.textContent = `${data.avg_generation_time_ms !== undefined ? data.avg_generation_time_ms : 0} ms`;
        if (ragModel) ragModel.textContent = (data.active_ollama_model || 'None').toUpperCase();
        if (activeModelBadge && data.active_ollama_model) {
          activeModelBadge.textContent = `${data.active_ollama_model.toUpperCase()} (Hosted)`;
        }
        if (ragStatus) {
          const isConnected = data.ollama_connection_status === 'CONNECTED';
          ragStatus.textContent = isConnected ? 'CONNECTED' : 'DISCONNECTED';
          ragStatus.className = isConnected ? 'badge bg-success-subtle text-success' : 'badge bg-danger-subtle text-danger';
        }

        // Render Phase 7 Voice Assistant Stats
        const voiceQueries = document.getElementById('voice-queries-count');
        const voiceAvgStt = document.getElementById('voice-avg-stt-time');
        const voiceModel = document.getElementById('voice-whisper-model');
        const voiceLanguage = document.getElementById('voice-active-language');
        const voiceTransStatus = document.getElementById('voice-translation-status');

        if (voiceQueries) voiceQueries.textContent = data.voice_queries !== undefined ? data.voice_queries : 0;
        if (voiceAvgStt) voiceAvgStt.textContent = `${data.avg_transcription_time_ms !== undefined ? data.avg_transcription_time_ms : 0} ms`;
        if (voiceModel) voiceModel.textContent = data.active_whisper_model || 'Whisper-Tiny (Offline)';
        if (voiceLanguage) voiceLanguage.textContent = data.active_language || 'Auto Detect';
        if (voiceTransStatus) {
          voiceTransStatus.textContent = data.translation_status || 'Disabled';
          const isReady = data.translation_status === 'Offline Ready';
          voiceTransStatus.className = isReady ? 'badge bg-success-subtle text-success' : 'badge bg-secondary-subtle text-secondary';
        }

        // Render Phase 8 Enterprise AI Intelligence Stats
        const summarizedDocs = document.getElementById('intel-summarized-docs');
        const reportsCreated = document.getElementById('intel-reports-created');
        const clauseAudits = document.getElementById('intel-clause-audits');
        const kgNodes = document.getElementById('intel-kg-nodes');
        const faqsCreated = document.getElementById('intel-faqs-created');
        const actionItems = document.getElementById('intel-action-items');

        if (summarizedDocs) summarizedDocs.textContent = data.total_summarized_documents !== undefined ? data.total_summarized_documents : 0;
        if (reportsCreated) reportsCreated.textContent = data.total_reports_generated !== undefined ? data.total_reports_generated : 0;
        if (clauseAudits) clauseAudits.textContent = data.total_comparisons_completed !== undefined ? data.total_comparisons_completed : 0;
        if (kgNodes) kgNodes.textContent = data.total_knowledge_graph_nodes_extracted !== undefined ? data.total_knowledge_graph_nodes_extracted : 0;
        if (faqsCreated) faqsCreated.textContent = data.total_faqs_generated !== undefined ? data.total_faqs_generated : 0;
        if (actionItems) actionItems.textContent = data.total_action_items_detected !== undefined ? data.total_action_items_detected : 0;
      }
    })
    .catch(() => {});
}

function fetchRecentDocuments() {
  const docList = document.getElementById('recent-docs-list');
  if (!docList) return;

  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents.length > 0) {
        docList.innerHTML = data.documents.slice(0, 4).map(doc => `
          <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded border bg-light-subtle">
            <div class="d-flex align-items-center gap-3" style="min-width: 0;">
              <div class="p-2 rounded bg-primary-subtle text-primary flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              </div>
              <div style="min-width: 0;">
                <h6 class="mb-0 text-truncate font-medium text-sm" title="${doc.name}">${doc.name}</h6>
                <small class="text-muted" style="font-size: 0.75rem;">${(doc.size_bytes / 1024).toFixed(1)} KB • Extracted</small>
              </div>
            </div>
            <div class="d-flex gap-2">
              <a href="/document/${encodeURIComponent(doc.filename)}" class="btn btn-xs btn-outline-primary py-1 px-2 text-xs">View Text</a>
            </div>
          </div>
        `).join('');
      } else {
        docList.innerHTML = `
          <div class="text-center py-4">
            <p class="text-muted">No documents uploaded yet.</p>
            <a href="/upload" class="btn btn-sm btn-outline-primary">Upload Document</a>
          </div>
        `;
      }
    })
    .catch(() => {});
}

/* ==========================================================================
   6. Page Controller: Document Upload Page
   ========================================================================== */
function initUploadPage() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  
  if (!dropzone || !fileInput) return;

  // Handle click to open dialog
  dropzone.addEventListener('click', () => fileInput.click());

  // Prevent defaults for drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropzone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      handleFilesUpload(files);
    }
  });

  // Handle selected files
  fileInput.addEventListener('change', function() {
    if (this.files.length) {
      handleFilesUpload(this.files);
    }
  });

  // Load existing files
  loadUploadedDocuments();
}

function handleFilesUpload(files) {
  const file = files[0];
  const allowedExtensions = ['pdf', 'docx', 'pptx'];
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    showToast(`Unsupported format. Allowed formats: ${allowedExtensions.join(', ')}`, 'error');
    return;
  }

  showToast(`Uploading & processing '${file.name}' completely offline...`, 'info');

  const formData = new FormData();
  formData.append('file', file);

  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(data.message, 'success');
      loadUploadedDocuments();
    } else {
      showToast(data.error, 'error');
    }
  })
  .catch(() => {
    showToast("Error processing file upload locally.", 'error');
  });
}

function loadUploadedDocuments() {
  const listContainer = document.getElementById('uploaded-docs-list');
  if (!listContainer) return;

  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents.length > 0) {
        listContainer.innerHTML = data.documents.map(doc => `
          <tr>
            <td>
              <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary flex-shrink-0"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                <span class="fw-medium text-truncate" style="max-width: 260px;" title="${doc.name}">${doc.name}</span>
              </div>
            </td>
            <td>${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB</td>
            <td><span class="badge bg-success-subtle text-success">${doc.status}</span></td>
            <td>
              <div class="d-flex gap-2">
                <a href="/document/${encodeURIComponent(doc.filename)}" class="btn btn-xs btn-outline-primary">
                  View
                </a>
                <button class="btn btn-xs btn-outline-danger" onclick="deleteDocument('${doc.filename}')">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      } else {
        listContainer.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-4 text-muted">
              No files in local storage. Drop files above to begin.
            </td>
          </tr>
        `;
      }
    });
}

window.deleteDocument = function(filename) {
  if (confirm(`Are you sure you want to delete '${filename}' offline? This will clean up all generated local indexes and text files.`)) {
    fetch(`/api/upload/delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadUploadedDocuments();
      } else {
        showToast(data.error, 'error');
      }
    })
    .catch(() => {
      showToast("Error deleting document.", 'error');
    });
  }
};

/* ==========================================================================
   7. Page Controller: AI Chat Page
   ========================================================================== */
window.copyBubbleText = function(bubbleId) {
  const bubble = document.getElementById(bubbleId);
  if (bubble) {
    const textDiv = bubble.querySelector('.message-content');
    if (textDiv) {
      navigator.clipboard.writeText(textDiv.textContent)
        .then(() => {
          showToast("Answer copied to clipboard!", "success");
        })
        .catch(() => {
          showToast("Failed to copy text.", "error");
        });
    }
  }
};

window.regenerateBubbleText = function(bubbleId) {
  const bubble = document.getElementById(bubbleId);
  if (!bubble) return;
  
  // Backtrack to find the preceding user query bubble
  let prev = bubble.previousElementSibling;
  while (prev && !prev.classList.contains('user')) {
    prev = prev.previousElementSibling;
  }
  
  if (prev) {
    const textDiv = prev.querySelector('.message-content') || prev.querySelector('div');
    if (textDiv) {
      const userQuery = textDiv.textContent.trim();
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = userQuery;
        // Submit form
        document.getElementById('chat-form').dispatchEvent(new Event('submit'));
      }
    }
  }
};

window.viewIndexedChunkSnippet = function(docName, page, encodedSnippet) {
  const snippet = decodeURIComponent(encodedSnippet);
  
  // Remove existing citation preview
  const existing = document.getElementById('citation-preview-popup');
  if (existing) existing.remove();
  
  const popupHTML = `
    <div id="citation-preview-popup" class="position-fixed top-50 start-50 translate-middle card glass-card shadow-lg p-4" style="z-index: 1060; max-width: 550px; width: 92%; border: 1px solid rgba(0,0,0,0.1); background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <h6 class="fw-bold text-primary mb-0">Retrieved Local Reference Passage</h6>
        <button type="button" class="btn-close" onclick="document.getElementById('citation-preview-popup').remove()" aria-label="Close"></button>
      </div>
      <div class="mb-3 d-flex gap-2">
        <span class="badge bg-primary-subtle text-primary border">${docName}</span>
        <span class="badge bg-secondary-subtle text-secondary border">Page ${page}</span>
      </div>
      <div class="bg-light p-3 rounded text-secondary font-monospace text-xs" style="max-height: 280px; overflow-y: auto; white-space: pre-wrap; line-height: 1.5; font-size: 0.85rem;">
        "${snippet}"
      </div>
      <div class="text-end mt-3 border-top pt-2">
        <button class="btn btn-sm btn-secondary px-3" onclick="document.getElementById('citation-preview-popup').remove()">Close Reference</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', popupHTML);
};

function initChatPage() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatHistory = document.getElementById('chat-history');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatTopKSelect = document.getElementById('chat-top-k-select');
  const chatModelSelect = document.getElementById('chat-model-select');
  
  if (!chatForm || !chatInput || !chatHistory) return;

  // Pre-load current model settings and available models
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (chatModelSelect) {
          chatModelSelect.innerHTML = data.available_models.map(m => `
            <option value="${m}" ${m === data.settings.current_model ? 'selected' : ''}>${m.toUpperCase()}</option>
          `).join('');
        }
        if (chatTopKSelect) {
          chatTopKSelect.value = data.settings.top_k || 5;
        }
      }
    });

  // Bind clear chat functionality
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      chatHistory.innerHTML = `
        <div class="chat-bubble assistant">
          <div style="font-size: 0.95rem;">
            Hello! I am your 100% offline <strong>SmartDocs Assistant</strong>. 
            Ask me anything about your uploaded corporate documents. I will retrieve context 
            from your FAISS local vector indices before formulating a synthesized response.
          </div>
        </div>
      `;
      showToast("Chat history cleared.", "success");
    });
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query) return;

    // Append User Message
    appendChatBubble('user', query);
    chatInput.value = '';
    
    // Add Assistant Typing Loader
    const loaderId = appendChatLoader();
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const selectedModel = chatModelSelect?.value || 'llama3';
    const selectedTopK = chatTopKSelect?.value || 5;

    try {
      // Prompt backend with streaming request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: query, 
          model: selectedModel, 
          top_k: selectedTopK,
          stream: true 
        })
      });

      // Remove the typing loader
      document.getElementById(loaderId)?.remove();

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Unknown server error' }));
        appendChatBubble('assistant', `Failed to generate RAG response: ${errJson.error}`);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return;
      }

      // Create empty assistant bubble for token streaming
      const bubbleId = 'bubble-' + Date.now();
      const bubbleHTML = `
        <div class="chat-bubble assistant animated-fade-in" id="${bubbleId}">
          <div class="message-content text-break" style="font-size: 0.95rem; white-space: pre-wrap; line-height: 1.5;"></div>
          
          <div class="citation-area mt-3 border-top pt-2" style="display: none;">
            <small class="text-muted d-block mb-2 fw-semibold" style="font-size: 0.75rem;">Verified Context References:</small>
            <div class="citations-list d-flex flex-wrap gap-1"></div>
          </div>
          
          <div class="retrieval-time-area mt-2 text-muted" style="font-size: 0.7rem; display: none;"></div>
          
          <div class="mt-2 border-top pt-2 d-flex gap-3 text-secondary" style="font-size: 0.75rem;">
            <span class="action-btn d-flex align-items-center gap-1" onclick="copyBubbleText('${bubbleId}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Copy
            </span>
            <span class="action-btn d-flex align-items-center gap-1" onclick="regenerateBubbleText('${bubbleId}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 3h5v5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/></svg>
              Regenerate
            </span>
          </div>
        </div>
      `;
      chatHistory.insertAdjacentHTML('beforeend', bubbleHTML);
      const bubbleElement = document.getElementById(bubbleId);
      const contentDiv = bubbleElement.querySelector('.message-content');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Hold incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);

            // Handle metadata chunk
            if (chunk.sources) {
              const citationArea = bubbleElement.querySelector('.citation-area');
              const citationsList = bubbleElement.querySelector('.citations-list');
              const timeArea = bubbleElement.querySelector('.retrieval-time-area');

              if (chunk.sources.length > 0) {
                citationsList.innerHTML = chunk.sources.map(s => {
                  const encodedSnippet = encodeURIComponent(s.snippet || '');
                  return `
                    <span class="badge bg-secondary-subtle text-secondary me-1 py-1 border citation-link" style="font-size: 0.72rem; cursor: pointer;" onclick="viewIndexedChunkSnippet('${s.document_name.replace(/'/g, "\\'")}', ${s.page}, '${encodedSnippet}')" title="Click to view full reference text">
                      ${s.document_name} (Page ${s.page}) • Sim: ${(s.similarity_score || 0.88).toFixed(2)}
                    </span>
                  `;
                }).join('');
                citationArea.style.display = 'block';
              } else {
                citationsList.innerHTML = `
                  <span class="badge bg-danger-subtle text-danger py-1" style="font-size: 0.72rem;">No matching FAISS context found</span>
                `;
                citationArea.style.display = 'block';
              }

              if (chunk.retrieval_time_ms !== undefined) {
                timeArea.textContent = `FAISS Retrieval: ${chunk.retrieval_time_ms} ms | Model: ${(chunk.model || 'unknown').toUpperCase()}`;
                timeArea.style.display = 'block';
              }
            }

            // Handle stream token
            if (chunk.token) {
              fullText += chunk.token;
              contentDiv.textContent = fullText;
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }

            // Handle completion metadata
            if (chunk.done) {
              const timeArea = bubbleElement.querySelector('.retrieval-time-area');
              if (timeArea && chunk.generation_time_ms !== undefined) {
                timeArea.textContent += ` | Generation: ${chunk.generation_time_ms} ms`;
              }
            }
          } catch (pe) {
            console.error("Stream parse error on line:", line, pe);
          }
        }
      }

      chatHistory.scrollTop = chatHistory.scrollHeight;

    } catch (err) {
      document.getElementById(loaderId)?.remove();
      appendChatBubble('assistant', 'Error connecting to local enterprise service node. Make sure Ollama and backend server are listening.');
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
  });
}

function appendChatBubble(sender, text, sources = []) {
  const chatHistory = document.getElementById('chat-history');
  if (!chatHistory) return;

  const bubbleId = 'bubble-' + Date.now();
  const sourceHTML = sources.length > 0 ? `
    <div class="citation-area mt-3 border-top pt-2">
      <small class="text-muted d-block mb-2 fw-semibold" style="font-size: 0.75rem;">Verified Context References:</small>
      <div class="citations-list d-flex flex-wrap gap-1">
        ${sources.map(s => {
          const encodedSnippet = encodeURIComponent(s.snippet || '');
          return `
            <span class="badge bg-secondary-subtle text-secondary me-1 py-1 border citation-link" style="font-size: 0.72rem; cursor: pointer;" onclick="viewIndexedChunkSnippet('${s.document_name.replace(/'/g, "\\'")}', ${s.page}, '${encodedSnippet}')" title="Click to view reference passage">
              ${s.document_name} (Page ${s.page}) • Sim: ${(s.similarity_score || 0.88).toFixed(2)}
            </span>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const bubbleHTML = `
    <div class="chat-bubble ${sender} animated-fade-in" id="${bubbleId}">
      <div class="message-content text-break" style="font-size: 0.95rem; white-space: pre-wrap; line-height: 1.5;">${text}</div>
      ${sourceHTML}
      <div class="mt-2 border-top pt-2 d-flex gap-3 text-secondary" style="font-size: 0.75rem;">
        <span class="action-btn d-flex align-items-center gap-1" onclick="copyBubbleText('${bubbleId}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy
        </span>
        ${sender === 'assistant' ? `
        <span class="action-btn d-flex align-items-center gap-1" onclick="regenerateBubbleText('${bubbleId}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 3h5v5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/></svg>
          Regenerate
        </span>
        ` : ''}
      </div>
    </div>
  `;
  chatHistory.insertAdjacentHTML('beforeend', bubbleHTML);
}

function appendChatLoader() {
  const chatHistory = document.getElementById('chat-history');
  const loaderId = 'loader-' + Date.now();
  const loaderHTML = `
    <div id="${loaderId}" class="chat-bubble assistant animated-fade-in d-flex align-items-center gap-3">
      <div class="d-flex align-items-center gap-1 text-primary">
        <span class="pulse-dot"></span>
        <span class="pulse-dot"></span>
        <span class="pulse-dot"></span>
      </div>
      <span class="text-muted" style="font-size: 0.9rem;">Synthesizing factual RAG answer offline...</span>
    </div>
  `;
  chatHistory.insertAdjacentHTML('beforeend', loaderHTML);
  return loaderId;
}

/* ==========================================================================
   8. Page Controller: Semantic Search Page
   ========================================================================== */
function initSearchPage() {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');
  
  if (!searchForm || !searchInput || !resultsContainer) return;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    resultsContainer.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status"></div>
        <p class="text-muted">Computing semantic weights and querying FAISS local tree index...</p>
      </div>
    `;

    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.results.length > 0) {
        resultsContainer.innerHTML = `
          <h5 class="mb-4">${data.total_results} matching snippets found</h5>
          ${data.results.map(r => `
            <div class="card glass-panel mb-3 p-4">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  <span class="fw-bold">${r.document_name}</span>
                  <span class="badge bg-light text-dark">Page ${r.page}</span>
                </div>
                <span class="badge bg-success-subtle text-success">Similarity: ${(r.score * 100).toFixed(0)}%</span>
              </div>
              <p class="mb-0 text-secondary italic">"${r.snippet}"</p>
            </div>
          `).join('')}
        `;
      } else {
        resultsContainer.innerHTML = `
          <div class="text-center py-5">
            <p class="text-muted">No high-probability vector matches found for your query.</p>
          </div>
        `;
      }
    })
    .catch(() => {
      resultsContainer.innerHTML = `
        <div class="alert alert-danger">
          Error computing local search query. Ensure python FAISS indexing service is online.
        </div>
      `;
    });
  });
}

/* ==========================================================================
   9. Page Controller: Voice Assistant Page
   ========================================================================== */
function initVoicePage() {
  const recordBtn = document.getElementById('record-btn');
  const recordStatus = document.getElementById('record-status');
  const visualizerContainer = document.getElementById('visualizer-container');
  const transcriptionResult = document.getElementById('transcription-result');
  
  if (!recordBtn || !recordStatus || !visualizerContainer) return;

  let isRecording = false;

  recordBtn.addEventListener('click', () => {
    isRecording = !isRecording;
    if (isRecording) {
      // Start recording animation simulation
      recordBtn.classList.remove('btn-primary');
      recordBtn.classList.add('btn-danger');
      recordBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 animate-pulse"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7l7 5Z"/></svg> Stop Recording
      `;
      recordStatus.textContent = "Listening locally... Speak clearly into your microphone.";
      visualizerContainer.classList.add('active');
      simulateVoiceWaves(true);
    } else {
      // Stop recording and simulate transcription
      recordBtn.classList.remove('btn-danger');
      recordBtn.classList.add('btn-primary');
      recordBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Start Recording
      `;
      recordStatus.textContent = "Transcribing voice vectors using local Whisper-Base model...";
      simulateVoiceWaves(false);

      // Call API
      setTimeout(() => {
        fetch('/api/voice/transcribe', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              recordStatus.textContent = "Transcription complete.";
              if (transcriptionResult) {
                transcriptionResult.value = data.transcription;
              }
              showToast("Whisper transcript generated successfully", "success");
            }
          });
      }, 1500);
    }
  });
}

function simulateVoiceWaves(active) {
  const bars = document.querySelectorAll('.visualizer-bar');
  if (!bars.length) return;

  if (active) {
    bars.forEach(bar => {
      bar.style.animation = `loading-pulse ${Math.random() * 0.8 + 0.4}s infinite alternate`;
    });
  } else {
    bars.forEach(bar => {
      bar.style.animation = 'none';
      bar.style.height = '10px';
    });
  }
}

/* ==========================================================================
   10. Page Controller: Settings Page
   ========================================================================== */
function initSettingsPage() {
  const settingsForm = document.getElementById('settings-form');
  if (!settingsForm) return;

  // Pre-load settings
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('ollama-url').value = data.settings.ollama_url;
        
        const modelSelect = document.getElementById('default-model-select');
        modelSelect.innerHTML = data.available_models.map(m => `
          <option value="${m}" ${m === data.settings.current_model ? 'selected' : ''}>${m.toUpperCase()}</option>
        `).join('');

        const embedSelect = document.getElementById('embedding-model-select');
        embedSelect.innerHTML = data.available_embeddings.map(e => `
          <option value="${e}" ${e === data.settings.embedding_model ? 'selected' : ''}>${e.toUpperCase()}</option>
        `).join('');

        // Populate new settings fields
        const tempRange = document.getElementById('settings-temperature');
        const tempBadge = document.getElementById('temp-badge');
        if (tempRange && tempBadge) {
          const tempVal = data.settings.temperature !== undefined ? data.settings.temperature : 0.7;
          tempRange.value = Math.round(tempVal * 100);
          tempBadge.textContent = tempVal.toFixed(2);
          
          tempRange.addEventListener('input', (ev) => {
            tempBadge.textContent = (ev.target.value / 100).toFixed(2);
          });
        }

        const topKSelect = document.getElementById('settings-top-k');
        if (topKSelect) {
          topKSelect.value = data.settings.top_k || 5;
        }

        const maxTokensInput = document.getElementById('settings-max-tokens');
        if (maxTokensInput) {
          maxTokensInput.value = data.settings.max_tokens || 512;
        }

        const streamingCheckbox = document.getElementById('settings-streaming');
        if (streamingCheckbox) {
          streamingCheckbox.checked = data.settings.streaming !== undefined ? data.settings.streaming : true;
        }
      }
    });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ollamaUrl = document.getElementById('ollama-url').value.trim();
    const currentModel = document.getElementById('default-model-select').value;
    const temperature = parseFloat(document.getElementById('temp-badge')?.textContent || '0.7');
    const topK = parseInt(document.getElementById('settings-top-k')?.value || '5');
    const maxTokens = parseInt(document.getElementById('settings-max-tokens')?.value || '512');
    const streaming = document.getElementById('settings-streaming')?.checked !== false;
    
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ollama_url: ollamaUrl, 
        current_model: currentModel,
        temperature: temperature,
        top_k: topK,
        max_tokens: maxTokens,
        streaming: streaming
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
      }
    });
  });
}

/* ==========================================================================
   11. Page Controller: Reports Page
   ========================================================================== */
function initReportsPage() {
  const docsContainer = document.getElementById('workspace-docs-container');
  const compDocA = document.getElementById('compare-doc-a-select');
  const compDocB = document.getElementById('compare-doc-b-select');
  
  if (!docsContainer) return;

  // 1. Fetch available files to build active checkbox list and comparison options
  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents.length > 0) {
        // Build document context checklist
        docsContainer.innerHTML = data.documents.map((doc, idx) => `
          <div class="form-check p-2 mb-1 rounded border bg-light-subtle d-flex align-items-center gap-2">
            <input class="form-check-input ms-1 me-2" type="checkbox" value="${doc.filename}" id="chk-doc-${idx}" ${idx === 0 ? 'checked' : ''}>
            <label class="form-check-label text-xs font-medium text-truncate mb-0 cursor-pointer" for="chk-doc-${idx}" title="${doc.name}">
              ${doc.name}
            </label>
          </div>
        `).join('');

        // Populate comparisons dropdown
        const compOptions = data.documents.map(doc => `
          <option value="${doc.filename}">${doc.name}</option>
        `).join('');
        
        if (compDocA) {
          compDocA.innerHTML = '<option value="" disabled selected>Select first document...</option>' + compOptions;
          if (data.documents[0]) compDocA.value = data.documents[0].filename;
        }
        if (compDocB) {
          compDocB.innerHTML = '<option value="" disabled selected>Select second document...</option>' + compOptions;
          if (data.documents[1]) {
            compDocB.value = data.documents[1].filename;
          } else if (data.documents[0]) {
            compDocB.value = data.documents[0].filename;
          }
        }
      } else {
        docsContainer.innerHTML = `
          <div class="text-center py-4 text-muted">
            <p class="text-xs mb-2">No documents found in knowledge node.</p>
            <a href="/upload" class="btn btn-xs btn-outline-primary py-1 px-2 text-xs">Upload Documents First</a>
          </div>
        `;
      }
    })
    .catch(() => {
      docsContainer.innerHTML = '<div class="text-xs text-danger text-center py-3">Failed to load local files list.</div>';
    });

  // Helper: Retrieve checked filenames
  function getSelectedDocuments() {
    const checkboxes = docsContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);
    return selected;
  }

  // Bind Select All button
  const selectAllBtn = document.getElementById('select-all-docs-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const checkboxes = docsContainer.querySelectorAll('input[type="checkbox"]');
      if (!checkboxes.length) return;
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => cb.checked = !allChecked);
      selectAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
    });
  }

  // 2. Tab 1: Summarizer
  const runSummaryBtn = document.getElementById('run-summary-btn');
  const summaryResult = document.getElementById('summary-result-container');
  if (runSummaryBtn && summaryResult) {
    runSummaryBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Please check at least one document in the left pane.", "warning");
        return;
      }
      const summaryType = document.getElementById('summary-type-select').value;
      const model = document.getElementById('intelligence-model-select').value;

      summaryResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Retrieving semantic context from FAISS and compiling local summary...</p>
        </div>
      `;

      fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, type: summaryType, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Parse summary markdown list nicely
          const summaryMarkdown = data.summary.replace(/\n/g, '<br>');
          summaryResult.innerHTML = `
            <div class="animated-fade-in p-3 rounded bg-light-subtle border">
              <div class="d-flex justify-content-between mb-3 align-items-center border-bottom pb-2">
                <span class="badge bg-primary text-uppercase">${data.summary_type} BRIEF</span>
                <span class="text-muted font-mono" style="font-size:0.7rem;">Model: ${data.model}</span>
              </div>
              <div class="text-secondary small mb-4" style="line-height: 1.6;">${summaryMarkdown}</div>
              
              <h6 class="text-primary fw-bold text-xs text-uppercase tracking-wider mb-2">Key Highlight Bulletins</h6>
              <ul class="list-group list-group-flush mb-4 text-xs bg-transparent">
                ${data.highlights.map(h => `<li class="list-group-item bg-transparent px-0 border-0 text-secondary">• ${h}</li>`).join('')}
              </ul>

              <h6 class="text-secondary fw-bold text-xs text-uppercase tracking-wider mb-2">Retrieved Sources</h6>
              <div class="d-flex flex-wrap gap-1">
                ${data.sources.map(s => `<span class="badge bg-light text-dark border text-xs" style="font-size:0.7rem;">${s}</span>`).join('')}
              </div>
            </div>
          `;
          showToast("Summary created successfully", "success");
        } else {
          summaryResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error || 'Summary failed.'}</div>`;
        }
      })
      .catch(err => {
        summaryResult.innerHTML = `<div class="alert alert-danger text-xs">Error communicating with local server.</div>`;
      });
    });
  }

  // 3. Tab 2: Clause Comparison
  const runCompareBtn = document.getElementById('run-compare-btn');
  const compareResult = document.getElementById('compare-result-container');
  if (runCompareBtn && compareResult) {
    runCompareBtn.addEventListener('click', () => {
      const docA = compDocA.value;
      const docB = compDocB.value;
      const model = document.getElementById('intelligence-model-select').value;

      if (!docA || !docB) {
        showToast("Please select two distinct files to compare.", "warning");
        return;
      }
      if (docA === docB) {
        showToast("Please choose two different files.", "warning");
        return;
      }

      compareResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Performing cross-document comparative reasoning with local LLM...</p>
        </div>
      `;

      fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_a: docA, document_b: docB, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Compatibility score class
          let progressBg = "bg-success";
          if (data.compatibility_score < 40) progressBg = "bg-danger";
          else if (data.compatibility_score < 75) progressBg = "bg-warning";

          compareResult.innerHTML = `
            <div class="animated-fade-in">
              <div class="p-3 rounded border bg-light-subtle mb-4 shadow-xs">
                <div class="d-flex justify-content-between mb-2 align-items-center">
                  <h6 class="mb-0 fw-bold text-xs text-secondary text-uppercase tracking-wider">Compliance Compatibility</h6>
                  <span class="badge ${data.compatibility_score >= 75 ? 'bg-success' : (data.compatibility_score >= 40 ? 'bg-warning' : 'bg-danger')}">${data.compatibility_score}% Congruence</span>
                </div>
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar ${progressBg}" role="progressbar" style="width: ${data.compatibility_score}%"></div>
                </div>
              </div>

              <!-- Accordion elements -->
              <div class="accordion border-0 text-xs" id="comparisonAccordion">
                <!-- Similarities -->
                <div class="accordion-item border bg-transparent mb-2 rounded overflow-hidden">
                  <h2 class="accordion-header">
                    <button class="accordion-button bg-light-subtle text-xs py-2 fw-bold text-success" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSimilarities">
                      ✓ Overlapping Agreements & Similarities (${data.similarities.length})
                    </button>
                  </h2>
                  <div id="collapseSimilarities" class="accordion-collapse collapse show" data-bs-parent="#comparisonAccordion">
                    <div class="accordion-body bg-white text-secondary p-3">
                      ${data.similarities.map(s => `
                        <div class="mb-2 pb-2 border-bottom last-no-border">
                          <strong class="d-block text-dark mb-1">• ${s.topic}</strong>
                          <span>${s.description}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Differences -->
                <div class="accordion-item border bg-transparent mb-2 rounded overflow-hidden">
                  <h2 class="accordion-header">
                    <button class="accordion-button collapsed bg-light-subtle text-xs py-2 fw-bold text-warning" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDifferences">
                      ⚠ Divergences & Differences (${data.differences.length})
                    </button>
                  </h2>
                  <div id="collapseDifferences" class="accordion-collapse collapse" data-bs-parent="#comparisonAccordion">
                    <div class="accordion-body bg-white p-3">
                      <div class="row g-2 mb-2 text-uppercase text-muted fw-bold border-bottom pb-1" style="font-size:0.65rem;">
                        <div class="col-4">Topic</div>
                        <div class="col-4">Doc A: ${docA.substring(0, 15)}...</div>
                        <div class="col-4">Doc B: ${docB.substring(0, 15)}...</div>
                      </div>
                      ${data.differences.map(d => `
                        <div class="row g-2 mb-2 border-bottom pb-2 text-secondary">
                          <div class="col-4"><strong class="text-dark">${d.topic}</strong></div>
                          <div class="col-4 text-break">${d.doc_a_value}</div>
                          <div class="col-4 text-break">${d.doc_b_value}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Conflicting Clauses -->
                <div class="accordion-item border bg-transparent mb-2 rounded overflow-hidden">
                  <h2 class="accordion-header">
                    <button class="accordion-button collapsed bg-light-subtle text-xs py-2 fw-bold text-danger" type="button" data-bs-toggle="collapse" data-bs-target="#collapseConflicts">
                      ✗ Directly Conflicting Clauses (${data.conflicting_statements.length})
                    </button>
                  </h2>
                  <div id="collapseConflicts" class="accordion-collapse collapse" data-bs-parent="#comparisonAccordion">
                    <div class="accordion-body bg-white p-3">
                      ${data.conflicting_statements.length === 0 ? '<p class="text-muted mb-0">No logical conflicts identified between sources.</p>' : data.conflicting_statements.map(c => `
                        <div class="mb-3 pb-2 border-bottom text-secondary">
                          <strong class="d-block text-danger mb-1">[Conflict] ${c.topic}</strong>
                          <div class="ps-2 border-start mt-1">
                            <div class="mb-1"><strong>A:</strong> ${c.statement_a}</div>
                            <div><strong>B:</strong> ${c.statement_b}</div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Missing Information -->
                <div class="accordion-item border bg-transparent mb-2 rounded overflow-hidden">
                  <h2 class="accordion-header">
                    <button class="accordion-button collapsed bg-light-subtle text-xs py-2 fw-bold text-info" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOmissions">
                      ⊘ Missing Scopes & Omissions (${data.missing_information.length})
                    </button>
                  </h2>
                  <div id="collapseOmissions" class="accordion-collapse collapse" data-bs-parent="#comparisonAccordion">
                    <div class="accordion-body bg-white text-secondary p-3">
                      ${data.missing_information.length === 0 ? '<p class="text-muted mb-0">No omissions found.</p>' : data.missing_information.map(o => `
                        <div class="mb-2 pb-2 border-bottom">
                          <strong class="d-block text-dark">${o.topic} <span class="badge bg-light text-secondary border">Omitted from ${o.document.substring(0, 15)}...</span></strong>
                          <span>${o.description}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
          showToast("Comparison complete", "success");
        } else {
          compareResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error || 'Comparison failed.'}</div>`;
        }
      })
      .catch(err => {
        compareResult.innerHTML = `<div class="alert alert-danger text-xs">Error connecting to comparison API.</div>`;
      });
    });
  }

  // 4. Tab 3: Executive Reports
  const runReportBtn = document.getElementById('run-report-btn');
  const reportResult = document.getElementById('report-result-container');
  const reportExportControls = document.getElementById('report-export-controls');
  if (runReportBtn && reportResult) {
    runReportBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Please check target document scopes.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      reportResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Generating C-Suite executive briefing report, findings and recommendations...</p>
        </div>
      `;
      if (reportExportControls) reportExportControls.style.display = "none";

      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Store exports
          generatedReportText = data.full_report_text;
          generatedReportMarkdown = data.full_report_markdown;
          if (reportExportControls) reportExportControls.style.display = "block";

          const rep = data.report;
          reportResult.innerHTML = `
            <div class="animated-fade-in p-2 text-secondary text-xs" style="line-height: 1.6;">
              <div class="text-center mb-4 border-bottom pb-3">
                <h6 class="fw-bold text-dark text-uppercase mb-1" style="letter-spacing:1px;">C-Suite Operational Briefing</h6>
                <small class="text-muted">Analyzing: ${data.document_names.join(', ')}</small>
              </div>
              
              <div class="mb-3">
                <strong class="text-primary d-block mb-1">1. EXECUTIVE SUMMARY</strong>
                <p>${rep.executive_summary}</p>
              </div>
              
              <div class="mb-3">
                <strong class="text-primary d-block mb-1">2. KEY FINDINGS</strong>
                <ul>
                  ${rep.key_findings.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-3">
                <strong class="text-primary d-block mb-1">3. CRITICAL COGNITIVE INSIGHTS</strong>
                <ul>
                  ${rep.critical_insights.map(i => `<li>${i}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-3">
                <strong class="text-danger d-block mb-1">4. OPERATIONS & REGULATORY RISKS</strong>
                <ul>
                  ${rep.risks.map(r => `<li class="text-danger-emphasis">${r}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-3">
                <strong class="text-primary d-block mb-1">5. STRATEGIC RECOMMENDATIONS</strong>
                <ul>
                  ${rep.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-3">
                <strong class="text-primary d-block mb-1">6. ASSIGNED ACTION ITEMS</strong>
                <ul>
                  ${rep.action_items.map(a => `<li>${a}</li>`).join('')}
                </ul>
              </div>

              <div class="border-top pt-2 mt-4 text-center text-muted" style="font-size:0.65rem;">
                Processed securely inside air-gapped node. Model: ${data.model}
              </div>
            </div>
          `;
          showToast("Executive intelligence report created", "success");
        } else {
          reportResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error || 'Report generation failed.'}</div>`;
        }
      })
      .catch(err => {
        reportResult.innerHTML = `<div class="alert alert-danger text-xs">Error generating report.</div>`;
      });
    });
  }

  // 5. Tab 4: Chronology Timeline
  const runTimelineBtn = document.getElementById('run-timeline-btn');
  const timelineResult = document.getElementById('timeline-result-container');
  if (runTimelineBtn && timelineResult) {
    runTimelineBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Select target scope checklist first.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      timelineResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Parsing date logs and chronological events...</p>
        </div>
      `;

      fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.timeline.length === 0) {
            timelineResult.innerHTML = '<div class="text-center py-4 text-muted">No chronological milestones detected.</div>';
            return;
          }

          timelineResult.innerHTML = `
            <div class="animated-fade-in py-2">
              <h6 class="fw-bold text-xs text-uppercase tracking-wider text-primary border-bottom pb-2 mb-3">Extracted Milestones Timeline</h6>
              <div class="ps-2">
                ${data.timeline.map(item => {
                  let badgeColor = "bg-primary";
                  if (item.importance === "High") badgeColor = "bg-danger";
                  else if (item.importance === "Medium") badgeColor = "bg-warning text-dark";

                  return `
                    <div class="timeline-item">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-light text-dark border fw-bold font-mono" style="font-size:0.75rem;">${item.date}</span>
                        <div class="d-flex gap-1">
                          <span class="badge ${badgeColor}" style="font-size:0.65rem;">${item.importance} Priority</span>
                          <span class="badge bg-secondary-subtle text-secondary" style="font-size:0.65rem;">${item.type}</span>
                        </div>
                      </div>
                      <p class="mb-0 text-secondary text-xs" style="line-height:1.4;">${item.event}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
          showToast("Milestones extracted", "success");
        } else {
          timelineResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error}</div>`;
        }
      })
      .catch(() => {
        timelineResult.innerHTML = '<div class="alert alert-danger text-xs">Error parsing timelines.</div>';
      });
    });
  }

  // 6. Tab 5: FAQ Explorer
  const runFaqBtn = document.getElementById('run-faq-btn');
  const faqResult = document.getElementById('faq-result-container');
  if (runFaqBtn && faqResult) {
    runFaqBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Choose files for scope first.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      faqResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Generating context-verified FAQ directory...</p>
        </div>
      `;

      fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.faqs.length === 0) {
            faqResult.innerHTML = '<div class="text-center text-muted">No FAQs could be compiled from current context.</div>';
            return;
          }

          faqResult.innerHTML = `
            <div class="animated-fade-in">
              <h6 class="fw-bold text-xs text-uppercase tracking-wider text-primary border-bottom pb-2 mb-3">Frequently Asked Questions</h6>
              <div class="accordion" id="faqAccordion">
                ${data.faqs.map((faq, idx) => `
                  <div class="accordion-item border rounded mb-2 overflow-hidden">
                    <h2 class="accordion-header">
                      <button class="accordion-button collapsed text-xs py-2 fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFaq${idx}">
                        Q: ${faq.question}
                      </button>
                    </h2>
                    <div id="collapseFaq${idx}" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                      <div class="accordion-body bg-light-subtle text-secondary text-xs p-3" style="line-height:1.5;">
                        <p class="mb-2">${faq.answer}</p>
                        <span class="badge bg-light text-muted border font-mono" style="font-size:0.65rem;">Citation: ${faq.source_citation}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          showToast("FAQ dictionary prepared", "success");
        } else {
          faqResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error}</div>`;
        }
      })
      .catch(() => {
        faqResult.innerHTML = '<div class="alert alert-danger text-xs">Error pulling FAQ lists.</div>';
      });
    });
  }

  // 7. Tab 6: NER & Keywords Cloud
  const runEntitiesBtn = document.getElementById('run-entities-btn');
  const entitiesResult = document.getElementById('entities-result-container');
  const entitiesSkeleton = document.getElementById('entities-skeleton');
  const keywordCloud = document.getElementById('keyword-cloud');
  const nerTabs = document.getElementById('ner-entity-tabs');
  
  if (runEntitiesBtn && entitiesResult) {
    runEntitiesBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("No active document scopes checked.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      entitiesSkeleton.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Mining named entities and terminology glossary maps...</p>
        </div>
      `;
      entitiesSkeleton.style.display = "block";
      entitiesResult.style.display = "none";

      // Trigger parallel fetch
      Promise.all([
        fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_names: selectedDocs, model: model })
        }).then(res => res.json()),
        fetch('/api/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_names: selectedDocs, model: model })
        }).then(res => res.json())
      ])
      .then(([keyData, entData]) => {
        entitiesSkeleton.style.display = "none";
        entitiesResult.style.display = "flex";

        if (keyData.success && entData.success) {
          // Render Keywords
          if (keyData.keywords.length === 0) {
            keywordCloud.innerHTML = '<span class="text-muted text-xs">No technical terms detected.</span>';
          } else {
            keywordCloud.innerHTML = keyData.keywords.map(kw => {
              // Scale size
              const sz = kw.relevance * 0.9 + 0.7;
              let cls = "badge bg-primary-subtle text-primary border-primary-subtle";
              if (kw.category === "Technology") cls = "badge bg-info-subtle text-info border-info-subtle";
              else if (kw.category === "Regulatory") cls = "badge bg-danger-subtle text-danger border-danger-subtle";
              else if (kw.category === "Financial") cls = "badge bg-success-subtle text-success border-success-subtle";

              return `
                <span class="badge ${cls} border p-2 m-1 cursor-pointer hover-scale" style="font-size:${sz}rem;" title="Category: ${kw.category} | Relevance: ${kw.relevance}">
                  ${kw.keyword}
                </span>
              `;
            }).join('');
          }

          // Render Entities
          const ents = entData.entities;
          let entsHtml = "";
          const groups = Object.keys(ents);
          
          if (groups.every(g => ents[g].length === 0)) {
            entsHtml = '<div class="text-muted text-xs text-center py-4">No named entities (people, organizations) found.</div>';
          } else {
            groups.forEach(group => {
              if (ents[group].length > 0) {
                entsHtml += `
                  <div class="mb-3">
                    <span class="fw-bold text-xs text-uppercase tracking-wider text-dark border-bottom pb-1 mb-2 d-block">${group} (${ents[group].length})</span>
                    <div class="d-flex flex-wrap gap-1">
                      ${ents[group].map(e => `<span class="badge bg-light text-secondary border text-xs" style="font-size:0.7rem;">${e}</span>`).join('')}
                    </div>
                  </div>
                `;
              }
            });
          }
          nerTabs.innerHTML = entsHtml;
          showToast("Keywords and entities mapped", "success");
        } else {
          entitiesSkeleton.innerHTML = `<div class="alert alert-danger text-xs">Extraction failed. Check model availability.</div>`;
          entitiesSkeleton.style.display = "block";
        }
      })
      .catch(() => {
        entitiesSkeleton.innerHTML = '<div class="alert alert-danger text-xs">Communication exception occurred.</div>';
        entitiesSkeleton.style.display = "block";
      });
    });
  }

  // 8. Tab 7: Relation Graph (D3.js Implementation)
  const runGraphBtn = document.getElementById('run-graph-btn');
  const graphWrapper = document.getElementById('graph-container-wrapper');
  const graphSkeleton = document.getElementById('graph-skeleton');
  if (runGraphBtn && graphWrapper) {
    runGraphBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Check at least one file.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      graphSkeleton.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Generating semantic relationship index and node-link graph...</p>
        </div>
      `;
      graphSkeleton.style.display = "block";
      graphWrapper.style.display = "none";

      fetch('/api/knowledge-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          graphSkeleton.style.display = "none";
          graphWrapper.style.display = "block";
          
          // Render interactive D3 Graph
          renderD3Graph(data.nodes, data.links);
          showToast("Knowledge Graph rendered", "success");
        } else {
          graphSkeleton.innerHTML = `<div class="alert alert-danger text-xs">${data.error}</div>`;
        }
      })
      .catch(() => {
        graphSkeleton.innerHTML = '<div class="alert alert-danger text-xs">Graph mapping failed.</div>';
      });
    });
  }

  // 9. Tab 8: Topic Clusters
  const runTopicsBtn = document.getElementById('run-topics-btn');
  const topicsResult = document.getElementById('topics-result-container');
  if (runTopicsBtn && topicsResult) {
    runTopicsBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Check document files first.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      topicsResult.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Clustering document semantic chunks into themed groups...</p>
        </div>
      `;

      fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.topics.length === 0) {
            topicsResult.innerHTML = '<div class="col-12 text-center text-muted">No topics could be automatically clustered.</div>';
            return;
          }

          topicsResult.innerHTML = `
            <div class="col-12 mb-2">
              <h6 class="fw-bold text-xs text-uppercase tracking-wider text-primary border-bottom pb-2 mb-3">Semantic Topic Map</h6>
            </div>
            ${data.topics.map(topic => `
              <div class="col-12 col-md-6">
                <div class="card bg-light-subtle rounded p-3 h-100 border hover-scale shadow-xs">
                  <div class="d-flex justify-content-between align-items-start mb-2 border-bottom pb-2">
                    <h6 class="fw-bold mb-0 text-dark text-truncate" style="max-width: 75%;">${topic.name}</h6>
                    <span class="badge bg-primary text-xs">${topic.chunks_count} chunks</span>
                  </div>
                  <p class="text-secondary text-xs mb-3" style="line-height:1.4;">${topic.description}</p>
                  
                  <div class="d-flex flex-wrap gap-1">
                    ${topic.keywords.map(kw => `<span class="badge bg-white text-secondary border text-xs" style="font-size:0.65rem;">#${kw}</span>`).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          `;
          showToast("Thematic clustering complete", "success");
        } else {
          topicsResult.innerHTML = `<div class="col-12"><div class="alert alert-danger text-xs">${data.error}</div></div>`;
        }
      })
      .catch(() => {
        topicsResult.innerHTML = '<div class="col-12"><div class="alert alert-danger text-xs">Grouping failed.</div></div>';
      });
    });
  }

  // 10. Tab 9: Action Items
  const runActionBtn = document.getElementById('run-action-btn');
  const actionResult = document.getElementById('action-result-container');
  if (runActionBtn && actionResult) {
    runActionBtn.addEventListener('click', () => {
      const selectedDocs = getSelectedDocuments();
      if (!selectedDocs.length) {
        showToast("Choose files context.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;

      actionResult.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="text-muted small">Harvesting corporate obligations and action tables...</p>
        </div>
      `;

      fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.action_items.length === 0) {
            actionResult.innerHTML = '<div class="text-center py-4 text-muted">No action items or assigned deliverables found.</div>';
            return;
          }

          actionResult.innerHTML = `
            <div class="animated-fade-in py-2">
              <h6 class="fw-bold text-xs text-uppercase tracking-wider text-primary border-bottom pb-2 mb-3">Interactive Action Checklist</h6>
              <div class="table-responsive">
                <table class="table table-hover table-bordered text-xs align-middle">
                  <thead class="table-light text-uppercase text-secondary" style="font-size: 0.65rem;">
                    <tr>
                      <th width="5%" class="text-center">Done</th>
                      <th width="45%">Action Task</th>
                      <th width="15%">Division / Owner</th>
                      <th width="15%">Deadlines</th>
                      <th width="10%">Assigned</th>
                      <th width="10%" class="text-center">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.action_items.map((item, idx) => {
                      let badge = "bg-primary";
                      if (item.priority === "High") badge = "bg-danger";
                      else if (item.priority === "Medium") badge = "bg-warning text-dark";

                      return `
                        <tr>
                          <td class="text-center">
                            <input class="form-check-input" type="checkbox" id="act-chk-${idx}" onchange="this.parentElement.parentElement.style.opacity = this.checked ? 0.4 : 1">
                          </td>
                          <td class="text-secondary fw-semibold text-break"><label for="act-chk-${idx}" class="cursor-pointer mb-0">${item.task}</label></td>
                          <td class="text-muted text-break">${item.responsibility}</td>
                          <td class="font-mono text-muted text-break">${item.due_date}</td>
                          <td class="text-secondary text-break">${item.assigned_person}</td>
                          <td class="text-center"><span class="badge ${badge}" style="font-size:0.65rem;">${item.priority}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
          showToast("Action items table created", "success");
        } else {
          actionResult.innerHTML = `<div class="alert alert-danger text-xs">${data.error}</div>`;
        }
      })
      .catch(() => {
        actionResult.innerHTML = '<div class="alert alert-danger text-xs">Error collecting tasks.</div>';
      });
    });
  }
}

// 11. Interactive D3.js Force Directed Graph Generator
function renderD3Graph(nodes, links) {
  const svgElement = document.getElementById('kg-svg');
  if (!svgElement) return;

  // Clear previous SVG contents
  d3.select('#kg-svg').selectAll('*').remove();

  const width = svgElement.clientWidth || 600;
  const height = svgElement.clientHeight || 400;

  const svg = d3.select('#kg-svg')
    .attr('viewBox', [0, 0, width, height]);

  // Create SVG group wrapper to support zoom and pan
  const container = svg.append('g');

  // Zoom setup
  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
    });

  svgSelection = svg; // global reference
  svg.call(zoomBehavior);

  // Group definitions
  const groupColors = {
    "Document": "#4338ca", // deep Indigo
    "Topic": "#06b6d4",    // Cyan
    "Entity": "#10b981",   // Emerald
    "Keyword": "#f59e0b",  // Amber
    "Technology": "#3b82f6" // blue
  };

  // Setup simulation
  graphSimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(25));

  // Render relationship lines (links)
  const link = container.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'graph-link')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 1.2);

  // Render relationship label texts (middle of lines)
  const linkText = container.append('g')
    .selectAll('text')
    .data(links)
    .join('text')
    .attr('font-size', '6px')
    .attr('fill', '#94a3b8')
    .attr('text-anchor', 'middle')
    .text(d => d.type || 'relates_to');

  // Render nodes as group (circle + text)
  const node = container.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );

  // Add circle elements
  node.append('circle')
    .attr('r', d => d.group === 'Document' ? 12 : 8)
    .attr('fill', d => groupColors[d.group] || '#475569')
    .attr('class', 'graph-node');

  // Add labels
  node.append('text')
    .attr('dy', 16)
    .attr('class', 'graph-label')
    .attr('font-size', '7px')
    .text(d => d.label);

  // Double click to release pin
  node.on('dblclick', (event, d) => {
    d.fx = null;
    d.fy = null;
    showToast(`Released node: ${d.label}`, 'info');
  });

  // Tooltip integration on node hover
  const tooltip = document.getElementById('graph-node-tooltip');
  
  node.on('mouseover', (event, d) => {
    if (!tooltip) return;
    tooltip.innerHTML = `
      <strong>${d.label}</strong><br>
      <span class="text-muted">Type: ${d.group}</span>
    `;
    tooltip.style.display = "block";
  });

  node.on('mousemove', (event) => {
    if (!tooltip) return;
    const bounds = svgElement.getBoundingClientRect();
    // Position relative to graph container
    const x = event.clientX - bounds.left + 15;
    const y = event.clientY - bounds.top + 15;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  });

  node.on('mouseout', () => {
    if (tooltip) tooltip.style.display = "none";
  });

  // Run simulation frame ticks
  graphSimulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    linkText
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 - 3);

    node
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
  });

  // Drag handlers
  function dragstarted(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0);
    // Pin nodes by default after drag so they don't jump back
    d.fx = event.x;
    d.fy = event.y;
  }
}
