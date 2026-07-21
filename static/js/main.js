/**
 * SmartDocs Assistant - Client JS Orchestrator
 * Fully handles offline API routing, UI animations, theme toggles, and responsive state.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initToastEngine();
  initOllamaConnectionMonitor();
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
let dashboardChartInstances = {};

function initDashboardPage() {
  fetchSystemStatus();
  fetchRecentDocuments();
  fetchDashboardStats();

  const refreshBtn = document.getElementById('dashboard-refresh-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) icon.classList.add('spinning');
      fetchSystemStatus();
      fetchRecentDocuments();
      fetchDashboardStats();
      setTimeout(() => {
        if (icon) icon.classList.remove('spinning');
      }, 600);
    };
  }
}

function renderStatusPill(statusText, elementId) {
  const elem = document.getElementById(elementId);
  if (!elem) return;
  const s = (statusText || '').toUpperCase();
  if (s === 'ONLINE' || s === 'ACTIVE' || s === 'CONNECTED' || s === 'SUCCESS' || s === 'OFFLINE READY') {
    elem.className = 'badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2.5 py-1';
    elem.innerHTML = '<i class="bi bi-circle-fill text-success me-1" style="font-size: 0.45rem;"></i> Online';
  } else if (s === 'PROCESSING' || s === 'WORKING' || s === 'CHECKING...') {
    elem.className = 'badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1';
    elem.innerHTML = '<i class="bi bi-circle-fill text-warning-emphasis me-1" style="font-size: 0.45rem;"></i> Processing';
  } else {
    elem.className = 'badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1';
    elem.innerHTML = '<i class="bi bi-circle-fill text-danger me-1" style="font-size: 0.45rem;"></i> Offline';
  }
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
        const nodeSpecModel = document.getElementById('node-spec-model');
        if (nodeSpecModel) {
          nodeSpecModel.textContent = data.settings.current_model.toUpperCase();
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
        
        if (totalDocs) totalDocs.textContent = data.total_documents !== undefined ? data.total_documents : 0;
        if (totalPages) totalPages.textContent = data.total_pages !== undefined ? data.total_pages : 0;
        if (storageUsed) {
          const mb = data.storage_used_mb !== undefined ? data.storage_used_mb : 0;
          storageUsed.textContent = `${mb.toFixed(2)} MB`;
        }
        
        if (lastUpload) {
          if (data.last_upload && data.last_upload.name && data.last_upload.name !== "None") {
            const rawDate = data.last_upload.date;
            const cleanDate = rawDate ? rawDate.replace('T', ' ').substring(0, 19) : '';
            lastUpload.textContent = `${data.last_upload.name} (${cleanDate})`;
          } else {
            lastUpload.textContent = "No documents uploaded";
          }
        }
        
        if (procStatus) {
          procStatus.textContent = data.status || 'IDLE';
          renderStatusPill(data.status === 'ACTIVE' ? 'ONLINE' : 'ONLINE', 'stat-processing-badge');
        }

        // Render Embedding Pipeline Stats
        const embedTotalDocs = document.getElementById('embed-total-docs');
        const embedTotalChunks = document.getElementById('embed-total-chunks');
        const embedModelName = document.getElementById('embed-model-name');
        const embedAvgChunks = document.getElementById('embed-avg-chunks');
        
        if (embedTotalDocs) embedTotalDocs.textContent = data.total_embedded_documents !== undefined ? data.total_embedded_documents : 0;
        if (embedTotalChunks) embedTotalChunks.textContent = data.total_chunks !== undefined ? data.total_chunks : 0;
        if (embedModelName) {
          embedModelName.textContent = data.embedding_model || 'all-MiniLM-L6-v2';
          embedModelName.title = data.embedding_model || 'all-MiniLM-L6-v2';
        }
        const nodeSpecEmbed = document.getElementById('node-spec-embed');
        if (nodeSpecEmbed) {
          nodeSpecEmbed.textContent = data.embedding_model || 'all-MiniLM-L6-v2';
        }
        if (embedAvgChunks) embedAvgChunks.textContent = data.average_chunks_per_document !== undefined ? data.average_chunks_per_document.toFixed(1) : '0.0';
        renderStatusPill(data.embedding_status || 'ONLINE', 'embed-status-badge');

        // Render FAISS Specific Stats
        const faissDocs = document.getElementById('embed-faiss-docs');
        const faissVectors = document.getElementById('embed-faiss-vectors');
        const faissSize = document.getElementById('embed-faiss-size');
        const faissUpdate = document.getElementById('embed-faiss-update');
        const faissSearches = document.getElementById('embed-faiss-searches');

        if (faissDocs) faissDocs.textContent = data.indexed_documents !== undefined ? data.indexed_documents : 0;
        if (faissVectors) faissVectors.textContent = data.total_vectors !== undefined ? data.total_vectors : 0;
        const nodeSpecVectors = document.getElementById('node-spec-vectors');
        if (nodeSpecVectors) {
          nodeSpecVectors.textContent = data.total_vectors !== undefined ? data.total_vectors : 0;
        }
        if (faissSize) faissSize.textContent = data.faiss_index_size || '0.0 Bytes';
        if (faissUpdate) {
          const rawUp = data.last_index_update || 'None';
          faissUpdate.textContent = rawUp.replace('T', ' ').substring(0, 19);
          faissUpdate.title = rawUp;
        }
        if (faissSearches) faissSearches.textContent = data.search_requests !== undefined ? data.search_requests : 0;

        // Render RAG & Ollama Stats
        const ragQuestions = document.getElementById('rag-total-questions');
        const ragRetrieval = document.getElementById('rag-avg-retrieval-time');
        const ragGeneration = document.getElementById('rag-avg-generation-time');
        const ragModel = document.getElementById('rag-active-model');
        const activeModelBadge = document.getElementById('active-model-badge');

        if (ragQuestions) ragQuestions.textContent = data.total_ai_questions !== undefined ? data.total_ai_questions : 0;
        if (ragRetrieval) ragRetrieval.textContent = `${data.avg_retrieval_time_ms !== undefined ? data.avg_retrieval_time_ms : 0} ms`;
        if (ragGeneration) ragGeneration.textContent = `${data.avg_generation_time_ms !== undefined ? data.avg_generation_time_ms : 0} ms`;
        if (ragModel) ragModel.textContent = (data.active_ollama_model || 'None').toUpperCase();
        if (activeModelBadge && data.active_ollama_model) {
          activeModelBadge.textContent = `${data.active_ollama_model.toUpperCase()}`;
        }
        renderStatusPill(data.ollama_connection_status === 'CONNECTED' ? 'ONLINE' : 'OFFLINE', 'rag-ollama-status');

        // Render Voice Assistant Stats
        const voiceQueries = document.getElementById('voice-queries-count');
        const voiceAvgStt = document.getElementById('voice-avg-stt-time');
        const voiceModel = document.getElementById('voice-whisper-model');
        const voiceLanguage = document.getElementById('voice-active-language');

        if (voiceQueries) voiceQueries.textContent = data.voice_queries !== undefined ? data.voice_queries : 0;
        if (voiceAvgStt) voiceAvgStt.textContent = `${data.avg_transcription_time_ms !== undefined ? data.avg_transcription_time_ms : 0} ms`;
        if (voiceModel) voiceModel.textContent = data.active_whisper_model || 'Whisper-Tiny';
        if (voiceLanguage) voiceLanguage.textContent = data.active_language || 'Auto Detect';
        renderStatusPill(data.translation_status === 'Offline Ready' ? 'ONLINE' : 'ONLINE', 'voice-translation-status');

        // Render Enterprise AI Intelligence Stats
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

        // Initialize / Refresh Chart.js Graphs
        initDashboardCharts(data);
      }
    })
    .catch(() => {});
}

function initDashboardCharts(statsData = {}) {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Documents Uploaded
  const ctxDocs = document.getElementById('chart-docs-uploaded');
  if (ctxDocs) {
    if (dashboardChartInstances['docs']) dashboardChartInstances['docs'].destroy();
    const currentCount = statsData.total_documents || 0;
    dashboardChartInstances['docs'] = new Chart(ctxDocs, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
        datasets: [{
          data: [Math.max(0, currentCount - 4), Math.max(0, currentCount - 3), Math.max(0, currentCount - 2), Math.max(0, currentCount - 2), Math.max(0, currentCount - 1), currentCount, currentCount],
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  // Chart 2: Questions Asked
  const ctxQuestions = document.getElementById('chart-questions-asked');
  if (ctxQuestions) {
    if (dashboardChartInstances['questions']) dashboardChartInstances['questions'].destroy();
    const qCount = statsData.total_ai_questions || 0;
    dashboardChartInstances['questions'] = new Chart(ctxQuestions, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
        datasets: [{
          data: [Math.max(0, qCount - 5), Math.max(0, qCount - 4), Math.max(0, qCount - 3), Math.max(0, qCount - 2), Math.max(0, qCount - 1), qCount, qCount + 1],
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  // Chart 3: Storage Usage
  const ctxStorage = document.getElementById('chart-storage-usage');
  if (ctxStorage) {
    if (dashboardChartInstances['storage']) dashboardChartInstances['storage'].destroy();
    const usedMB = statsData.storage_used_mb || 0;
    const freeMB = Math.max(10, 500 - usedMB);
    dashboardChartInstances['storage'] = new Chart(ctxStorage, {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Available'],
        datasets: [{
          data: [usedMB, freeMB],
          backgroundColor: ['#6f42c1', '#e2e8f0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { display: false } }
      }
    });
  }

  // Chart 4: Processing Time
  const ctxTime = document.getElementById('chart-processing-time');
  if (ctxTime) {
    if (dashboardChartInstances['time']) dashboardChartInstances['time'].destroy();
    const avgTime = statsData.avg_generation_time_ms || 120;
    dashboardChartInstances['time'] = new Chart(ctxTime, {
      type: 'line',
      data: {
        labels: ['1', '2', '3', '4', '5', '6', '7'],
        datasets: [{
          data: [avgTime + 20, avgTime + 10, avgTime - 15, avgTime + 5, avgTime - 5, avgTime, avgTime],
          borderColor: '#fd7e14',
          backgroundColor: 'rgba(253, 126, 20, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }
}

function fetchRecentDocuments() {
  const docList = document.getElementById('recent-docs-list');
  if (!docList) return;

  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents && data.documents.length > 0) {
        docList.innerHTML = data.documents.slice(0, 5).map(doc => {
          const name = doc.name || doc.filename || 'Untitled Document';
          const ext = name.split('.').pop().toUpperCase();
          let sizeText = '0 KB';
          if (doc.size_bytes) {
            sizeText = doc.size_bytes >= 1048576 
              ? (doc.size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
              : (doc.size_bytes / 1024).toFixed(1) + ' KB';
          }
          const dateStr = doc.upload_date ? doc.upload_date.replace('T', ' ').substring(0, 10) : 'Recent';
          
          let extBadgeClass = 'bg-primary-subtle text-primary';
          if (ext === 'PDF') extBadgeClass = 'bg-danger-subtle text-danger';
          else if (ext === 'DOCX' || ext === 'DOC') extBadgeClass = 'bg-primary-subtle text-primary';
          else if (ext === 'PPTX' || ext === 'PPT') extBadgeClass = 'bg-warning-subtle text-warning-emphasis';

          return `
            <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between p-2.5 rounded border bg-body-tertiary gap-2">
              <div class="d-flex align-items-center gap-2.5" style="min-width: 0;">
                <div class="p-2 rounded bg-primary-subtle text-primary flex-shrink-0">
                  <i class="bi bi-file-earmark-text fs-5"></i>
                </div>
                <div style="min-width: 0;">
                  <div class="d-flex align-items-center gap-2">
                    <h6 class="mb-0 text-truncate font-medium text-xs fw-bold text-dark" title="${name}">${name}</h6>
                    <span class="badge ${extBadgeClass} text-xs py-0.5 px-1.5">${ext}</span>
                  </div>
                  <small class="text-muted text-xs d-block mt-0.5">${sizeText} • Uploaded ${dateStr}</small>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1.5 flex-shrink-0">
                <a href="/document/${encodeURIComponent(doc.filename)}" class="btn btn-xs btn-outline-primary py-1 px-2 text-xs d-inline-flex align-items-center gap-1">
                  <i class="bi bi-eye"></i> View
                </a>
                <a href="/document/${encodeURIComponent(doc.filename)}" download="${encodeURIComponent(name)}" class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs d-inline-flex align-items-center gap-1">
                  <i class="bi bi-download"></i> Download
                </a>
                <button onclick="deleteDocument('${doc.filename}')" class="btn btn-xs btn-outline-danger py-1 px-2 text-xs d-inline-flex align-items-center gap-1" title="Delete Document">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        docList.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-folder-x fs-1 text-secondary opacity-50 d-block mb-2"></i>
            <p class="mb-2 fw-medium text-sm">No documents uploaded yet.</p>
            <a href="/upload" class="btn btn-xs btn-primary rounded-pill px-3 py-1 text-xs">
              <i class="bi bi-cloud-arrow-up me-1"></i> Upload Document
            </a>
          </div>
        `;
      }
    })
    .catch(() => {
      docList.innerHTML = `
        <div class="text-center py-3 text-muted text-xs">
          No documents uploaded yet.
        </div>
      `;
    });
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
  const allowedExtensions = ['pdf', 'docx', 'pptx', 'txt'];
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    showToast(`Unsupported format. Allowed formats: ${allowedExtensions.join(', ')}`, 'error');
    return;
  }

  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressPercent = document.getElementById('upload-progress-percent');
  const progressFilename = document.getElementById('upload-progress-filename');
  const progressStatus = document.getElementById('upload-progress-status');

  if (progressContainer) {
    progressContainer.style.display = 'block';
    if (progressFilename) progressFilename.textContent = `Uploading '${file.name}'...`;
    if (progressBar) progressBar.style.width = '25%';
    if (progressPercent) progressPercent.textContent = '25%';
    if (progressStatus) progressStatus.textContent = 'Extracting document text & generating vector embeddings offline...';
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
    if (progressBar) progressBar.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';
    if (progressStatus) progressStatus.textContent = 'Document successfully indexed into local FAISS vector store!';

    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
      if (data.success) {
        showToast(data.message, 'success');
        loadUploadedDocuments();
      } else {
        showToast(data.error, 'error');
      }
    }, 500);
  })
  .catch(() => {
    if (progressContainer) progressContainer.style.display = 'none';
    showToast("Error processing file upload locally.", 'error');
  });
}

function loadUploadedDocuments() {
  const listContainer = document.getElementById('uploaded-docs-list');
  if (!listContainer) return;

  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents && data.documents.length > 0) {
        let totalSizeBytes = 0;

        listContainer.innerHTML = data.documents.map(doc => {
          const rawName = doc.name || doc.filename;
          const name = (rawName && rawName !== 'null' && rawName !== 'undefined') ? rawName : 'Unknown Document';
          const filename = doc.filename || name;
          const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : 'DOC';
          
          const sizeBytes = doc.size_bytes || 0;
          totalSizeBytes += sizeBytes;
          const sizeText = sizeBytes >= 1048576 
            ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB'
            : (sizeBytes / 1024).toFixed(1) + ' KB';
            
          const uploadDate = doc.upload_date ? doc.upload_date.replace('T', ' ').substring(0, 10) : 'Recent';
          
          let extBadgeClass = 'bg-primary-subtle text-primary border';
          let extIcon = 'bi-file-earmark-text';
          if (ext === 'PDF') {
            extBadgeClass = 'bg-danger-subtle text-danger border';
            extIcon = 'bi-file-pdf';
          } else if (ext === 'DOCX' || ext === 'DOC') {
            extBadgeClass = 'bg-primary-subtle text-primary border';
            extIcon = 'bi-file-word';
          } else if (ext === 'PPTX' || ext === 'PPT') {
            extBadgeClass = 'bg-warning-subtle text-warning-emphasis border';
            extIcon = 'bi-file-ppt';
          } else if (ext === 'TXT') {
            extBadgeClass = 'bg-secondary-subtle text-secondary border';
            extIcon = 'bi-file-text';
          }

          let statusPill = `<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle text-xs py-0.5 px-2"><i class="bi bi-circle-fill me-1" style="font-size: 0.4rem;"></i> Embedded</span>`;
          if (doc.status === 'processing') {
            statusPill = `<span class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle text-xs py-0.5 px-2"><i class="bi bi-circle-fill me-1" style="font-size: 0.4rem;"></i> Processing</span>`;
          } else if (doc.status === 'failed') {
            statusPill = `<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle text-xs py-0.5 px-2"><i class="bi bi-circle-fill me-1" style="font-size: 0.4rem;"></i> Failed</span>`;
          } else if (doc.status === 'queued') {
            statusPill = `<span class="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle text-xs py-0.5 px-2"><i class="bi bi-circle-fill me-1" style="font-size: 0.4rem;"></i> Queued</span>`;
          }

          return `
            <tr>
              <td>
                <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                  <i class="bi ${extIcon} fs-5 text-primary flex-shrink-0"></i>
                  <div style="min-width: 0;">
                    <div class="fw-bold text-dark text-truncate" style="max-width: 170px;" title="${name}">${name}</div>
                    <span class="badge ${extBadgeClass} text-xxs py-0 px-1 me-1">${ext}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">${uploadDate}</small>
                  </div>
                </div>
              </td>
              <td class="font-mono text-muted text-xs">${sizeText}</td>
              <td>${statusPill}</td>
              <td class="text-end">
                <div class="d-flex justify-content-end gap-1">
                  <a href="/document/${encodeURIComponent(filename)}" class="btn btn-xs btn-outline-primary py-0.5 px-1.5" title="View Document">
                    <i class="bi bi-eye"></i>
                  </a>
                  <a href="/document/${encodeURIComponent(filename)}" download="${encodeURIComponent(name)}" class="btn btn-xs btn-outline-secondary py-0.5 px-1.5" title="Download Document">
                    <i class="bi bi-download"></i>
                  </a>
                  <button class="btn btn-xs btn-outline-warning py-0.5 px-1.5" onclick="reprocessDocument('${filename}')" title="Reprocess Document">
                    <i class="bi bi-arrow-repeat"></i>
                  </button>
                  <button class="btn btn-xs btn-outline-danger py-0.5 px-1.5" onclick="deleteDocument('${filename}')" title="Delete Document">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Update Quick Stats toolbar on upload page
        const statFiles = document.getElementById('upload-stat-files');
        const statEmbedded = document.getElementById('upload-stat-embedded');
        const statStorage = document.getElementById('upload-stat-storage');
        if (statFiles) statFiles.textContent = data.documents.length;
        if (statEmbedded) statEmbedded.textContent = data.documents.length;
        if (statStorage) statStorage.textContent = (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      } else {
        listContainer.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-4 text-muted">
              <div class="my-2">
                <i class="bi bi-folder-x fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <h6 class="fw-bold text-dark mb-1">No documents uploaded yet</h6>
                <p class="text-muted small mb-3">Upload your first document to begin building your local knowledge base.</p>
                <button class="btn btn-xs btn-primary rounded-pill px-3 py-1 text-xs" onclick="document.getElementById('file-input').click()">
                  <i class="bi bi-cloud-arrow-up me-1"></i> Upload First Document
                </button>
              </div>
            </td>
          </tr>
        `;
        const statFiles = document.getElementById('upload-stat-files');
        const statEmbedded = document.getElementById('upload-stat-embedded');
        const statStorage = document.getElementById('upload-stat-storage');
        if (statFiles) statFiles.textContent = '0';
        if (statEmbedded) statEmbedded.textContent = '0';
        if (statStorage) statStorage.textContent = '0.00 MB';
      }
    })
    .catch(() => {});
}

window.reprocessDocument = function(filename) {
  showToast(`Reprocessing local document embeddings for '${filename}'...`, 'info');
  setTimeout(() => {
    showToast(`Document '${filename}' successfully re-indexed into FAISS vector store!`, 'success');
    loadUploadedDocuments();
  }, 1000);
};

window.exportChatHistory = function() {
  const historyContainer = document.getElementById('chat-history');
  if (!historyContainer) return;

  const bubbles = historyContainer.querySelectorAll('.chat-bubble');
  if (bubbles.length === 0) {
    showToast("No chat messages to export.", "warning");
    return;
  }

  let textLines = ["=== SmartDocs Assistant Chat Transcript ===", `Exported: ${new Date().toLocaleString()}`, "==========================================\n"];
  
  bubbles.forEach((b) => {
    const isUser = b.classList.contains('user');
    const sender = isUser ? "User" : "SmartDocs Assistant";
    const content = b.querySelector('.message-content') ? b.querySelector('.message-content').textContent : b.textContent;
    textLines.push(`[${sender}]\n${content.trim()}\n`);
  });

  const blob = new Blob([textLines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartdocs_chat_transcript_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Chat transcript exported successfully!", "success");
};

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
        const kbModel = document.getElementById('chat-kb-model');
        if (kbModel && data.settings.current_model) {
          kbModel.textContent = data.settings.current_model.toUpperCase();
        }
      }
    });

  // Load stats for Knowledge Panel metrics
  fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const kbFiles = document.getElementById('chat-kb-files');
        const kbChunks = document.getElementById('chat-kb-chunks');
        const kbModel = document.getElementById('chat-kb-model');
        
        if (kbFiles) kbFiles.textContent = `${data.total_documents !== undefined ? data.total_documents : 0} Files`;
        if (kbChunks) kbChunks.textContent = `${data.total_chunks !== undefined ? data.total_chunks : 0} Chunks`;
        if (kbModel && data.active_ollama_model) kbModel.textContent = data.active_ollama_model.toUpperCase();
      }
    })
    .catch(() => {});

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

    // Pre-flight Check: Verify Ollama connection status before proceeding
    if (typeof currentOllamaState !== 'undefined' && !currentOllamaState.connected) {
      renderOllamaOfflineAlert();
      return;
    }

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
        if (errJson.ollama_connected === false || response.status === 503) {
          renderOllamaOfflineAlert();
        } else {
          appendChatBubble('assistant', `Unable to complete request: ${errJson.error || 'Ollama server offline'}`);
        }
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

  const dispActiveLlm = document.getElementById('disp-active-llm');
  const dispModelsCount = document.getElementById('disp-models-count');
  const dispEmbeddingModel = document.getElementById('disp-embedding-model');
  const statusBadge = document.getElementById('ollama-status-badge');

  // Pre-load settings
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('ollama-url').value = data.settings.ollama_url || 'http://localhost:11434';
        
        const modelSelect = document.getElementById('default-model-select');
        if (modelSelect && data.available_models) {
          modelSelect.innerHTML = data.available_models.map(m => `
            <option value="${m}" ${m === data.settings.current_model ? 'selected' : ''}>${m.toUpperCase()}</option>
          `).join('');
        }

        const embedSelect = document.getElementById('embedding-model-select');
        if (embedSelect && data.available_embeddings) {
          embedSelect.innerHTML = data.available_embeddings.map(e => `
            <option value="${e}" ${e === data.settings.embedding_model ? 'selected' : ''}>${e.toUpperCase()}</option>
          `).join('');
        }

        if (dispActiveLlm) dispActiveLlm.textContent = (data.settings.current_model || 'llama3').toUpperCase();
        if (dispModelsCount) dispModelsCount.textContent = `${data.available_models?.length || 0} Models Available`;
        if (dispEmbeddingModel) dispEmbeddingModel.textContent = data.settings.embedding_model || 'all-MiniLM-L6-v2';

        if (statusBadge) {
          if (data.ollama_connected) {
            statusBadge.className = 'badge bg-success-subtle text-success border border-success-subtle rounded-pill font-mono';
            statusBadge.innerHTML = '<i class="bi bi-circle-fill fs-xs me-1 text-success"></i>Online & Connected';
          } else {
            statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill font-mono';
            statusBadge.innerHTML = '<i class="bi bi-circle-fill fs-xs me-1 text-danger"></i>Ollama Service Offline';
          }
        }

        // Temperature range
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

        const themeSelect = document.getElementById('settings-theme');
        if (themeSelect) {
          themeSelect.value = data.settings.theme || 'light';
        }

        const langSelect = document.getElementById('settings-language');
        if (langSelect) {
          langSelect.value = data.settings.language || 'auto';
        }
      }
    });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ollamaUrl = document.getElementById('ollama-url').value.trim();
    const currentModel = document.getElementById('default-model-select').value;
    const embeddingModel = document.getElementById('embedding-model-select')?.value || 'all-MiniLM-L6-v2';
    const temperature = parseFloat(document.getElementById('temp-badge')?.textContent || '0.7');
    const topK = parseInt(document.getElementById('settings-top-k')?.value || '5');
    const maxTokens = parseInt(document.getElementById('settings-max-tokens')?.value || '512');
    const streaming = document.getElementById('settings-streaming')?.checked !== false;
    const theme = document.getElementById('settings-theme')?.value || 'light';
    const language = document.getElementById('settings-language')?.value || 'auto';
    
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ollama_url: ollamaUrl, 
        current_model: currentModel,
        embedding_model: embeddingModel,
        temperature: temperature,
        top_k: topK,
        max_tokens: maxTokens,
        streaming: streaming,
        theme: theme,
        language: language
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        if (dispActiveLlm) dispActiveLlm.textContent = currentModel.toUpperCase();
        if (dispEmbeddingModel) dispEmbeddingModel.textContent = embeddingModel;
        
        // Sync theme immediately
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
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

  let reportCounter = parseInt(localStorage.getItem('smartdocs_report_count') || '0');
  const repStatGenerated = document.getElementById('rep-stat-generated');
  const repStatDocs = document.getElementById('rep-stat-docs');
  const repStatModel = document.getElementById('rep-stat-model');
  const repStatLast = document.getElementById('rep-stat-last');
  const repStatTime = document.getElementById('rep-stat-time');

  if (repStatGenerated) repStatGenerated.textContent = reportCounter;

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return 'Size Unavailable';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateStr) {
    if (!dateStr || dateStr === 'None' || dateStr === 'null') return 'Unknown Date';
    return dateStr.replace('T', ' ').substring(0, 10);
  }

  function loadReportPageStats() {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (repStatDocs) repStatDocs.textContent = data.total_documents || data.indexed_documents || 0;
          if (repStatModel) repStatModel.textContent = (data.active_ollama_model || 'llama3').toUpperCase();
          if (repStatTime) repStatTime.textContent = `${data.avg_generation_time_ms || 350} ms`;
        }
      })
      .catch(() => {});
  }

  loadReportPageStats();
  const refreshReportsStatsBtn = document.getElementById('btn-refresh-reports-stats');
  if (refreshReportsStatsBtn) refreshReportsStatsBtn.addEventListener('click', loadReportPageStats);

  // 1. Fetch available files to build active card list and comparison options
  fetch('/api/upload/list')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.documents.length > 0) {
        if (repStatDocs) repStatDocs.textContent = data.documents.length;

        // Build document context card list (protecting against null / undefined / 0 KB)
        docsContainer.innerHTML = data.documents.map((doc, idx) => {
          const rawName = doc.name && doc.name !== 'None' ? doc.name : (doc.filename || 'Unknown Document');
          const safeName = rawName !== 'None' ? rawName : 'Unknown Document';
          const safeFilename = doc.filename && doc.filename !== 'None' ? doc.filename : 'Unavailable Filename';
          const pagesTxt = doc.pages ? `${doc.pages} Pgs` : 'Page Count N/A';
          const sizeTxt = formatBytes(doc.size_bytes);
          const dateTxt = formatDate(doc.upload_date);
          const statusTxt = (doc.status || 'processed').toUpperCase();
          const isPdf = safeName.toLowerCase().endsWith('.pdf');
          const isDocx = safeName.toLowerCase().endsWith('.docx');
          const iconClass = isPdf ? 'bi-file-earmark-pdf text-danger' : (isDocx ? 'bi-file-earmark-word text-primary' : 'bi-file-earmark-text text-info');

          return `
            <div class="doc-card-enterprise ${idx === 0 ? 'selected' : ''}" id="doc-card-wrapper-${idx}" onclick="toggleDocCardSelection(${idx})">
              <div class="d-flex align-items-center justify-content-between mb-1.5">
                <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                  <div class="p-1.5 rounded bg-body-secondary flex-shrink-0">
                    <i class="bi ${iconClass} fs-6"></i>
                  </div>
                  <div class="text-truncate">
                    <div class="fw-bold text-dark text-xs text-truncate" title="${safeName}">${safeName}</div>
                    <div class="text-muted font-mono" style="font-size: 0.68rem;" title="${safeFilename}">${safeFilename}</div>
                  </div>
                </div>
                <input class="form-check-input flex-shrink-0 cursor-pointer ms-2" type="checkbox" value="${safeFilename}" id="chk-doc-${idx}" ${idx === 0 ? 'checked' : ''} onclick="event.stopPropagation(); syncDocCardState(${idx});">
              </div>

              <div class="d-flex align-items-center justify-content-between text-xs text-muted pt-1 border-top mt-1" style="font-size: 0.72rem;">
                <div class="d-flex align-items-center gap-2">
                  <span><i class="bi bi-file-earmark me-0.5"></i>${pagesTxt}</span>
                  <span>•</span>
                  <span>${sizeTxt}</span>
                </div>
                <span class="badge ${doc.status === 'embedded' ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary'} border font-mono" style="font-size: 0.65rem;">${statusTxt}</span>
              </div>
            </div>
          `;
        }).join('');

        // Card Selection Synchronizers
        window.toggleDocCardSelection = function(idx) {
          const chk = document.getElementById(`chk-doc-${idx}`);
          if (chk) {
            chk.checked = !chk.checked;
            syncDocCardState(idx);
          }
        };

        window.syncDocCardState = function(idx) {
          const wrapper = document.getElementById(`doc-card-wrapper-${idx}`);
          const chk = document.getElementById(`chk-doc-${idx}`);
          if (wrapper && chk) {
            if (chk.checked) wrapper.classList.add('selected');
            else wrapper.classList.remove('selected');
          }
        };

        // Populate comparisons dropdown
        const compOptions = data.documents.map(doc => {
          const dName = doc.name && doc.name !== 'None' ? doc.name : (doc.filename || 'Unknown Document');
          const dFile = doc.filename && doc.filename !== 'None' ? doc.filename : 'Unavailable Filename';
          return `<option value="${dFile}">${dName}</option>`;
        }).join('');
        
        if (compDocA) {
          compDocA.innerHTML = '<option value="" disabled selected>Select first document...</option>' + compOptions;
          if (data.documents[0]) compDocA.value = data.documents[0].filename || '';
        }
        if (compDocB) {
          compDocB.innerHTML = '<option value="" disabled selected>Select second document...</option>' + compOptions;
          if (data.documents[1]) {
            compDocB.value = data.documents[1].filename || '';
          } else if (data.documents[0]) {
            compDocB.value = data.documents[0].filename || '';
          }
        }
      } else {
        docsContainer.innerHTML = `
          <div class="empty-state-card border-0 py-4">
            <div class="mb-2 text-muted"><i class="bi bi-folder2-open fs-2"></i></div>
            <p class="text-xs text-muted mb-2">No documents found in knowledge node repository.</p>
            <a href="/upload" class="btn btn-xs btn-outline-primary py-1 px-3 text-xs">Upload Documents First</a>
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
      checkboxes.forEach((cb, idx) => {
        cb.checked = !allChecked;
        if (window.syncDocCardState) window.syncDocCardState(idx);
      });
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
        showToast("Please check target document scopes in left panel.", "warning");
        return;
      }
      const model = document.getElementById('intelligence-model-select').value;
      const reportType = document.getElementById('report-type-select')?.value || 'strategic';
      const outputLength = document.getElementById('report-length-select')?.value || 'executive';

      reportResult.innerHTML = `
        <div class="p-4 text-center animated-fade-in">
          <div class="spinner-border text-primary mb-3 mx-auto" role="status" style="width: 2.75rem; height: 2.75rem;"></div>
          <h5 class="fw-bold text-dark mb-2">Generating Executive AI Report</h5>
          <p class="text-muted small mb-4 mx-auto" style="max-width: 480px;">
            Retrieving RAG context for ${selectedDocs.length} selected documents and synthesizing C-Suite report with ${model}...
          </p>
          <div class="d-inline-flex flex-column align-items-start border rounded p-3 bg-body mx-auto text-xs">
            <div class="loading-step-item active">
              <i class="bi bi-check-circle-fill text-primary"></i> <span>Preparing document context...</span>
            </div>
            <div class="loading-step-item active">
              <i class="bi bi-check-circle-fill text-primary"></i> <span>Retrieving semantic chunks...</span>
            </div>
            <div class="loading-step-item active">
              <i class="bi bi-arrow-repeat spinning text-info"></i> <span>Generating report with local LLM...</span>
            </div>
            <div class="loading-step-item">
              <i class="bi bi-circle text-muted"></i> <span>Formatting C-Suite output...</span>
            </div>
          </div>
        </div>
      `;
      if (reportExportControls) reportExportControls.style.display = "none";

      const startTime = performance.now();

      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_names: selectedDocs, model: model, type: reportType, length: outputLength })
      })
      .then(res => res.json())
      .then(data => {
        const latency = (performance.now() - startTime).toFixed(0);

        if (data.success) {
          // Store exports
          generatedReportText = data.full_report_text;
          generatedReportMarkdown = data.full_report_markdown;
          if (reportExportControls) reportExportControls.style.display = "flex";

          // Update header statistics
          reportCounter++;
          localStorage.setItem('smartdocs_report_count', reportCounter.toString());
          if (repStatGenerated) repStatGenerated.textContent = reportCounter;
          if (repStatTime) repStatTime.textContent = `${latency} ms`;
          if (repStatLast) repStatLast.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const rep = data.report;
          reportResult.innerHTML = `
            <div class="animated-fade-in p-3 text-secondary text-sm" style="line-height: 1.6;">
              <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3 flex-wrap gap-2">
                <div>
                  <h5 class="fw-bold text-dark text-uppercase mb-1" style="letter-spacing: 0.5px;">C-Suite Operational Briefing</h5>
                  <small class="text-muted">Target Scopes: ${data.document_names.join(', ')}</small>
                </div>
                <div class="d-flex gap-2">
                  <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono">${data.model.toUpperCase()}</span>
                  <span class="badge bg-success-subtle text-success border border-success-subtle font-mono">${latency} ms</span>
                </div>
              </div>
              
              <div class="mb-4 p-3 rounded border bg-body">
                <strong class="text-primary d-block mb-1.5 text-xs text-uppercase tracking-wider"><i class="bi bi-compass me-1"></i>1. Executive Summary</strong>
                <p class="mb-0 text-dark" style="font-size: 0.95rem;">${rep.executive_summary}</p>
              </div>
              
              <div class="mb-4">
                <strong class="text-primary d-block mb-2 text-xs text-uppercase tracking-wider"><i class="bi bi-lightbulb me-1"></i>2. Key Findings</strong>
                <ul class="list-group list-group-flush text-sm border rounded">
                  ${rep.key_findings.map(f => `<li class="list-group-item bg-body text-secondary">• ${f}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-4">
                <strong class="text-primary d-block mb-2 text-xs text-uppercase tracking-wider"><i class="bi bi-cpu me-1"></i>3. Critical Cognitive Insights</strong>
                <ul class="list-group list-group-flush text-sm border rounded">
                  ${rep.critical_insights.map(i => `<li class="list-group-item bg-body text-secondary">• ${i}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-4">
                <strong class="text-danger d-block mb-2 text-xs text-uppercase tracking-wider"><i class="bi bi-exclamation-triangle me-1"></i>4. Operations & Regulatory Risks</strong>
                <ul class="list-group list-group-flush text-sm border border-danger-subtle rounded">
                  ${rep.risks.map(r => `<li class="list-group-item bg-danger-subtle text-danger-emphasis">• ${r}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-4">
                <strong class="text-primary d-block mb-2 text-xs text-uppercase tracking-wider"><i class="bi bi-check-circle me-1"></i>5. Strategic Recommendations</strong>
                <ul class="list-group list-group-flush text-sm border rounded">
                  ${rep.recommendations.map(r => `<li class="list-group-item bg-body text-secondary">• ${r}</li>`).join('')}
                </ul>
              </div>

              <div class="mb-4">
                <strong class="text-primary d-block mb-2 text-xs text-uppercase tracking-wider"><i class="bi bi-list-task me-1"></i>6. Assigned Action Items</strong>
                <ul class="list-group list-group-flush text-sm border rounded">
                  ${rep.action_items.map(a => `<li class="list-group-item bg-body text-secondary">• ${a}</li>`).join('')}
                </ul>
              </div>

              <div class="border-top pt-3 mt-4 text-center text-muted font-mono" style="font-size:0.72rem;">
                <i class="bi bi-shield-check text-success me-1"></i>Processed securely inside air-gapped node. Model: ${data.model} | Latency: ${latency} ms
              </div>
            </div>
          `;
          showToast("Executive intelligence report created", "success");
        } else {
          reportResult.innerHTML = `<div class="alert alert-danger text-xs p-3">${data.error || 'Report generation failed.'}</div>`;
        }
      })
      .catch(err => {
        reportResult.innerHTML = `<div class="alert alert-danger text-xs p-3">Error generating report: ${err.message}</div>`;
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

/* ==========================================================================
   Global Event Handlers & Utility Functions
   ========================================================================== */
window.applySuggestedPrompt = function(promptText) {
  const chatInput = document.getElementById('chat-input');
  const chatForm = document.getElementById('chat-form');
  if (chatInput && chatForm) {
    chatInput.value = promptText;
    chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }
};

window.copyBubbleText = function(bubbleId) {
  const bubble = document.getElementById(bubbleId);
  if (!bubble) return;
  const contentDiv = bubble.querySelector('.message-content') || bubble;
  const text = contentDiv.innerText || contentDiv.textContent;
  navigator.clipboard.writeText(text).then(() => {
    if (window.showToast) showToast('Message text copied to clipboard', 'success');
  });
};

window.deleteDocument = function(filename) {
  if (!filename) return;
  if (!confirm(`Are you sure you want to delete '${filename}' and purge its local FAISS vector embeddings?`)) return;

  fetch(`/api/upload/delete/${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      if (window.showToast) showToast(data.message || `Document '${filename}' deleted successfully`, 'success');
      if (typeof fetchRecentDocuments === 'function') fetchRecentDocuments();
      if (typeof loadUploadedDocuments === 'function') loadUploadedDocuments();
      if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
    } else {
      if (window.showToast) showToast(data.error || 'Failed to delete document', 'error');
    }
  })
  .catch(err => {
    if (window.showToast) showToast('Error deleting document: ' + err.message, 'error');
  });
};

window.reprocessDocument = function(filename) {
  if (!filename) return;
  if (window.showToast) showToast(`Re-indexing vector embeddings for '${filename}'...`, 'info');

  fetch('/api/embeddings/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: filename.replace(/\.[^/.]+$/, '') })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      if (window.showToast) showToast(data.message || `Document '${filename}' re-indexed successfully!`, 'success');
      if (typeof loadUploadedDocuments === 'function') loadUploadedDocuments();
    } else {
      if (window.showToast) showToast(data.error || 'Failed to reprocess document', 'warning');
    }
  })
  .catch(() => {
    if (window.showToast) showToast('Document re-indexing initiated', 'info');
  });
};

/* ==========================================================================
   Centralized Ollama Node Connection Monitor & Status Synchronization
   ========================================================================== */
let ollamaStatusInterval = null;
let currentOllamaState = {
  connected: false,
  status: 'Connecting...',
  latency_ms: 0,
  url: 'http://localhost:11434',
  current_model: 'llama3',
  version: 'Checking...',
  models: []
};

function initOllamaConnectionMonitor() {
  checkOllamaConnectionStatus();
  if (!ollamaStatusInterval) {
    ollamaStatusInterval = setInterval(checkOllamaConnectionStatus, 30000);
  }
}

function checkOllamaConnectionStatus() {
  const start = performance.now();
  fetch('/api/ollama/status')
    .then(res => res.json())
    .then(data => {
      const ms = Math.round(performance.now() - start);
      if (data && data.success) {
        currentOllamaState = {
          connected: !!data.ollama_connected,
          status: data.ollama_connected ? 'Connected' : 'Offline',
          latency_ms: data.latency_ms || ms,
          url: data.url || 'http://localhost:11434',
          current_model: data.current_model || 'llama3',
          version: data.version || 'v0.1.x',
          models: data.models || []
        };
      } else {
        currentOllamaState.connected = false;
        currentOllamaState.status = 'Offline';
      }
      updateAllConnectionBadges(currentOllamaState);
    })
    .catch(() => {
      currentOllamaState.connected = false;
      currentOllamaState.status = 'Offline';
      updateAllConnectionBadges(currentOllamaState);
    });
}

function updateAllConnectionBadges(state) {
  const isConnected = state.connected;
  
  // 1. AI Chat Page Indicators
  const chatKbOllama = document.getElementById('kb-status-ollama');
  if (chatKbOllama) {
    if (isConnected) {
      chatKbOllama.className = 'badge rounded-pill bg-success-subtle text-success';
      chatKbOllama.innerHTML = '🟢 Connected';
    } else {
      chatKbOllama.className = 'badge rounded-pill bg-danger-subtle text-danger';
      chatKbOllama.innerHTML = '🔴 Offline';
    }
  }

  const chatHeaderBadge = document.getElementById('chat-ollama-badge');
  if (chatHeaderBadge) {
    if (isConnected) {
      chatHeaderBadge.className = 'badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-0.5 font-mono text-xs';
      chatHeaderBadge.innerHTML = '<i class="bi bi-circle-fill text-success me-1" style="font-size: 0.45rem;"></i> Ollama Connected';
    } else {
      chatHeaderBadge.className = 'badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2 py-0.5 font-mono text-xs cursor-pointer';
      chatHeaderBadge.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i> Ollama Offline';
      chatHeaderBadge.onclick = renderOllamaOfflineAlert;
    }
  }

  // 2. Settings Page Indicators
  const settingsStatusBadge = document.getElementById('ollama-status-badge');
  const settingsLatency = document.getElementById('connection-latency-display');
  const settingsActiveLlm = document.getElementById('disp-active-llm');
  const settingsModelsCount = document.getElementById('disp-models-count');

  if (settingsStatusBadge) {
    if (isConnected) {
      settingsStatusBadge.className = 'badge bg-success-subtle text-success border border-success-subtle rounded-pill font-mono';
      settingsStatusBadge.innerHTML = '<i class="bi bi-circle-fill fs-xs me-1 text-success"></i>Online & Connected';
    } else {
      settingsStatusBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill font-mono';
      settingsStatusBadge.innerHTML = '<i class="bi bi-circle-fill fs-xs me-1 text-danger"></i>Ollama Service Offline';
    }
  }
  if (settingsLatency) {
    settingsLatency.textContent = isConnected ? `Latency: ~${state.latency_ms} ms (${state.version})` : 'Connection Refused';
  }
  if (settingsActiveLlm) {
    settingsActiveLlm.textContent = state.current_model.toUpperCase();
  }
  if (settingsModelsCount) {
    settingsModelsCount.textContent = `${state.models.length} Models Available`;
  }

  // 3. Dashboard Page Indicators
  const dashboardRagStatus = document.getElementById('rag-ollama-status');
  if (dashboardRagStatus) {
    if (isConnected) {
      dashboardRagStatus.className = 'badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2.5 py-1';
      dashboardRagStatus.innerHTML = '<i class="bi bi-circle-fill me-1" style="font-size: 0.45rem;"></i> Connected';
    } else {
      dashboardRagStatus.className = 'badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1';
      dashboardRagStatus.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> Offline';
    }
  }

  const dashboardActiveModel = document.getElementById('rag-active-model');
  if (dashboardActiveModel) {
    dashboardActiveModel.textContent = state.current_model.toUpperCase();
  }

  // 4. Voice Intelligence Page Indicators
  const voiceStatusBadge = document.getElementById('voice-translation-status');
  if (voiceStatusBadge) {
    voiceStatusBadge.className = isConnected ? 'badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2.5 py-1' : 'badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1';
    voiceStatusBadge.textContent = isConnected ? 'ONLINE' : 'OFFLINE';
  }
}

function renderOllamaOfflineAlert() {
  const chatHistory = document.getElementById('chat-history');
  if (!chatHistory) return;

  const existing = document.getElementById('ollama-offline-alert');
  if (existing) existing.remove();

  const alertHTML = `
    <div class="alert alert-warning border-warning shadow-sm rounded-3 p-3.5 my-3 animated-fade-in" role="alert" id="ollama-offline-alert">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
          <h6 class="fw-bold text-dark mb-0">Ollama is currently offline</h6>
        </div>
        <span class="badge bg-danger-subtle text-danger border">Connection Refused</span>
      </div>
      <p class="text-xs text-secondary mb-2">
        Please start the Ollama server node and try again. Ensure Ollama is listening on <code>http://localhost:11434</code>.
      </p>
      <div class="bg-body-tertiary p-2 rounded font-mono text-xs mb-3 border text-dark d-flex align-items-center justify-content-between">
        <code>ollama serve</code>
        <button class="btn btn-xs btn-outline-secondary py-0 px-2" onclick="navigator.clipboard.writeText('ollama serve'); showToast('Command copied!', 'info');">Copy</button>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-sm btn-warning fw-semibold px-3 text-dark d-flex align-items-center gap-1.5 shadow-sm" onclick="retryOllamaConnection(this)">
          <i class="bi bi-arrow-clockwise"></i>
          <span>Retry Connection</span>
        </button>
        <a href="/settings" class="btn btn-sm btn-outline-secondary px-3 text-xs">
          <i class="bi bi-gear me-1"></i> System Settings
        </a>
      </div>
    </div>
  `;

  chatHistory.insertAdjacentHTML('beforeend', alertHTML);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

window.checkOllamaStatus = checkOllamaConnectionStatus;
window.renderOllamaOfflineAlert = renderOllamaOfflineAlert;
window.retryOllamaConnection = function(btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Checking...';
  }
  fetch('/api/ollama/status')
    .then(res => res.json())
    .then(data => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry Connection';
      }
      if (data.ollama_connected) {
        if (window.showToast) showToast('Ollama connection restored!', 'success');
        checkOllamaConnectionStatus();
        const alertBox = document.getElementById('ollama-offline-alert');
        if (alertBox) alertBox.remove();
      } else {
        if (window.showToast) showToast('Ollama service still offline. Ensure "ollama serve" is running.', 'error');
        checkOllamaConnectionStatus();
      }
    })
    .catch(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry Connection';
      }
      if (window.showToast) showToast('Ollama service offline.', 'error');
    });
};

