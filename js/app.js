/**
 * App — Main orchestrator, UI controls, event handling, and PWA integration
 */

const App = (function() {
  let installPrompt = null;
  let currentBlobUrl = null;

  // DOM refs
  const els = {
    fileInput: document.getElementById('file-input'),
    btnOpen: document.getElementById('btn-open'),
    btnDropOpen: document.getElementById('btn-drop-open'),
    btnSidebar: document.getElementById('btn-sidebar'),
    btnCloseSidebar: document.getElementById('btn-close-sidebar'),
    sidebar: document.getElementById('sidebar'),
    dropZone: document.getElementById('drop-zone'),
    viewerContainer: document.getElementById('viewer-container'),
    thumbnailContainer: document.getElementById('thumbnail-container'),
    pageInput: document.getElementById('page-input'),
    totalPages: document.getElementById('total-pages'),
    btnFirstPage: document.getElementById('btn-first-page'),
    btnPrevPage: document.getElementById('btn-prev-page'),
    btnNextPage: document.getElementById('btn-next-page'),
    btnLastPage: document.getElementById('btn-last-page'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    zoomSelect: document.getElementById('zoom-select'),
    btnFitWidth: document.getElementById('btn-fit-width'),
    btnFitPage: document.getElementById('btn-fit-page'),
    btnRotateCw: document.getElementById('btn-rotate-cw'),
    btnRotateCcw: document.getElementById('btn-rotate-ccw'),
    btnSearch: document.getElementById('btn-search'),
    btnCloseSearch: document.getElementById('btn-close-search'),
    btnSearchPrev: document.getElementById('btn-search-prev'),
    btnSearchNext: document.getElementById('btn-search-next'),
    searchInput: document.getElementById('search-input'),
    btnAnnotate: document.getElementById('btn-annotate'),
    btnHighlight: document.getElementById('btn-highlight'),
    btnUnderline: document.getElementById('btn-underline'),
    btnStrikeout: document.getElementById('btn-strikeout'),
    btnNote: document.getElementById('btn-note'),
    btnClearAnnotations: document.getElementById('btn-clear-annotations'),
    btnCloseAnnotations: document.getElementById('btn-close-annotations'),
    colorPicker: document.getElementById('annotation-color'),
    btnDownload: document.getElementById('btn-download'),
    btnPrint: document.getElementById('btn-print'),
    btnInstall: document.getElementById('btn-install'),
    installPrompt: document.getElementById('install-prompt'),
    btnInstallAccept: document.getElementById('btn-install-accept'),
    btnInstallDismiss: document.getElementById('btn-install-dismiss'),
    btnFormFill: document.getElementById('btn-form-fill'),
    btnSignature: document.getElementById('btn-signature'),
    docInfo: document.getElementById('doc-info'),
    statusSize: document.getElementById('status-size'),
    statusWords: document.getElementById('status-words')
  };

  function init() {
    lucide.createIcons();
    AnnotationModule.init();
    setupFileHandling();
    setupNavigation();
    setupZoom();
    setupRotation();
    setupSearch();
    setupAnnotations();
    setupForms();
    setupSignatures();
    setupSidebar();
    setupDownloadPrint();
    setupPWA();
    setupKeyboard();
    setupScroll();
    updateNavState(false);

    if ('launchQueue' in window) {
      launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const file = await launchParams.files[0].getFile();
          loadFile(file);
        }
      });
    }
  }

  function setupFileHandling() {
    els.btnOpen.addEventListener('click', () => els.fileInput.click());
    els.btnDropOpen.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) loadFile(e.target.files[0]);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
      document.body.addEventListener(event, (e) => { e.preventDefault(); e.stopPropagation(); });
    });

    els.dropZone.addEventListener('dragenter', () => els.dropZone.classList.add('drag-over'));
    els.dropZone.addEventListener('dragover', () => els.dropZone.classList.add('drag-over'));
    els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
    els.dropZone.addEventListener('drop', (e) => {
      els.dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        loadFile(file);
      } else {
        alert('Please drop a PDF file.');
      }
    });
  }

  async function loadFile(file) {
    PDFEngine.setFilename(file.name);
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = URL.createObjectURL(file);

    const success = await PasswordModule.tryLoadWithPassword(currentBlobUrl);

    if (success) {
      els.dropZone.hidden = true;
      els.viewerContainer.hidden = false;
      els.docInfo.textContent = file.name;
      els.statusSize.textContent = formatBytes(file.size);
      updateNavState(true);
      generateThumbnails();
      lucide.createIcons();
      // Render forms for visible pages
      const total = PDFEngine.getTotalPages();
      for (let i = 1; i <= Math.min(5, total); i++) {
        FormFillingModule.renderFormsForPage(i);
      }
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function generateThumbnails() {
    const pdf = PDFEngine.getPDF();
    const total = PDFEngine.getTotalPages();
    els.thumbnailContainer.innerHTML = '';

    for (let i = 1; i <= total; i++) {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';
      item.dataset.page = i;
      item.addEventListener('click', () => PDFEngine.goToPage(i));

      const canvas = document.createElement('canvas');
      canvas.className = 'thumbnail-canvas';
      item.appendChild(canvas);

      const label = document.createElement('span');
      label.className = 'thumbnail-label';
      label.textContent = i;
      item.appendChild(label);

      els.thumbnailContainer.appendChild(item);

      try {
        const page = await pdf.getPage(i);
        const thumbScale = 160 / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: thumbScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error('Thumbnail error:', e);
      }
    }
  }

  function setupNavigation() {
    els.btnFirstPage.addEventListener('click', () => PDFEngine.goToPage(1));
    els.btnPrevPage.addEventListener('click', () => PDFEngine.goToPage(PDFEngine.getCurrentPage() - 1));
    els.btnNextPage.addEventListener('click', () => PDFEngine.goToPage(PDFEngine.getCurrentPage() + 1));
    els.btnLastPage.addEventListener('click', () => PDFEngine.goToPage(PDFEngine.getTotalPages()));

    els.pageInput.addEventListener('change', () => {
      const page = parseInt(els.pageInput.value);
      if (page >= 1 && page <= PDFEngine.getTotalPages()) {
        PDFEngine.goToPage(page);
      }
    });
  }

  function updateNavState(enabled) {
    const buttons = [
      els.btnFirstPage, els.btnPrevPage, els.btnNextPage, els.btnLastPage,
      els.btnZoomIn, els.btnZoomOut, els.zoomSelect, els.btnFitWidth, els.btnFitPage,
      els.btnRotateCw, els.btnRotateCcw, els.btnSearch, els.btnAnnotate,
      els.btnFormFill, els.btnSignature, els.btnDownload, els.btnPrint
    ];
    buttons.forEach(btn => btn.disabled = !enabled);
    els.pageInput.disabled = !enabled;
  }

  function setupZoom() {
    els.btnZoomIn.addEventListener('click', () => {
      PDFEngine.zoom(PDFEngine.getScale() + 0.25);
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
    els.btnZoomOut.addEventListener('click', () => {
      PDFEngine.zoom(PDFEngine.getScale() - 0.25);
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
    els.zoomSelect.addEventListener('change', () => {
      PDFEngine.zoom(els.zoomSelect.value === 'fit-width' || els.zoomSelect.value === 'fit-page' ? els.zoomSelect.value : parseFloat(els.zoomSelect.value));
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
    els.btnFitWidth.addEventListener('click', () => {
      PDFEngine.zoom('fit-width');
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
    els.btnFitPage.addEventListener('click', () => {
      PDFEngine.zoom('fit-page');
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
  }

  function reRenderFormsForVisible() {
    const pages = document.querySelectorAll('.pdf-page-wrapper');
    const containerRect = els.viewerContainer.getBoundingClientRect();
    pages.forEach(wrapper => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
        FormFillingModule.renderFormsForPage(parseInt(wrapper.dataset.page));
      }
    });
  }

  function setupRotation() {
    els.btnRotateCw.addEventListener('click', () => {
      PDFEngine.rotate(90);
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
    els.btnRotateCcw.addEventListener('click', () => {
      PDFEngine.rotate(-90);
      setTimeout(() => reRenderFormsForVisible(), 300);
    });
  }

  function setupSearch() {
    els.btnSearch.addEventListener('click', () => SearchModule.toggle());
    els.btnCloseSearch.addEventListener('click', () => SearchModule.close());
    els.btnSearchNext.addEventListener('click', () => SearchModule.nextResult());
    els.btnSearchPrev.addEventListener('click', () => SearchModule.prevResult());

    let searchTimeout;
    els.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => SearchModule.search(els.searchInput.value), 300);
    });

    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') SearchModule.search(els.searchInput.value);
    });
  }

  function setupAnnotations() {
    els.btnAnnotate.addEventListener('click', () => AnnotationModule.toggle());
    els.btnHighlight.addEventListener('click', () => AnnotationModule.setTool('highlight'));
    els.btnUnderline.addEventListener('click', () => AnnotationModule.setTool('underline'));
    els.btnStrikeout.addEventListener('click', () => AnnotationModule.setTool('strikeout'));
    els.btnNote.addEventListener('click', () => AnnotationModule.setTool('note'));
    els.btnClearAnnotations.addEventListener('click', () => AnnotationModule.clearAll());
    els.btnCloseAnnotations.addEventListener('click', () => AnnotationModule.close());
    els.colorPicker.addEventListener('change', () => AnnotationModule.setColor(els.colorPicker.value));
  }

  function setupForms() {
    els.btnFormFill.addEventListener('click', () => {
      const total = PDFEngine.getTotalPages();
      for (let i = 1; i <= total; i++) {
        FormFillingModule.renderFormsForPage(i);
      }
    });
  }

  function setupSignatures() {
    els.btnSignature.addEventListener('click', () => SignatureModule.toggleSignaturePad());
  }

  function setupSidebar() {
    els.btnSidebar.addEventListener('click', () => els.sidebar.classList.toggle('collapsed'));
    els.btnCloseSidebar.addEventListener('click', () => els.sidebar.classList.add('collapsed'));
  }

  function setupDownloadPrint() {
    els.btnDownload.addEventListener('click', () => {
      if (!currentBlobUrl) {
        alert('No PDF loaded for download.');
        return;
      }
      const a = document.createElement('a');
      a.href = currentBlobUrl;
      a.download = PDFEngine.getFilename() || 'document.pdf';
      a.click();
    });

    els.btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      els.btnInstall.hidden = false;
      els.installPrompt.hidden = false;
    });

    els.btnInstall.addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          els.btnInstall.hidden = true;
        }
        installPrompt = null;
      }
    });

    els.btnInstallAccept.addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        els.installPrompt.hidden = true;
      }
    });

    els.btnInstallDismiss.addEventListener('click', () => {
      els.installPrompt.hidden = true;
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      els.btnInstall.hidden = true;
    }
  }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const page = PDFEngine.getCurrentPage();
      const total = PDFEngine.getTotalPages();

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          if (page > 1) PDFEngine.goToPage(page - 1);
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          if (page < total) PDFEngine.goToPage(page + 1);
          break;
        case 'Home':
          e.preventDefault();
          PDFEngine.goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          PDFEngine.goToPage(total);
          break;
        case '+':
        case '=':
          if (e.ctrlKey) {
            e.preventDefault();
            PDFEngine.zoom(PDFEngine.getScale() + 0.25);
          }
          break;
        case '-':
          if (e.ctrlKey) {
            e.preventDefault();
            PDFEngine.zoom(PDFEngine.getScale() - 0.25);
          }
          break;
        case 'f':
          if (e.ctrlKey) {
            e.preventDefault();
            SearchModule.toggle();
          }
          break;
        case 'Escape':
          SearchModule.close();
          AnnotationModule.close();
          break;
      }
    });
  }

  function setupScroll() {
    els.viewerContainer.addEventListener('scroll', () => {
      const pages = document.querySelectorAll('.pdf-page-wrapper');
      let currentPage = 1;
      const containerRect = els.viewerContainer.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      for (const page of pages) {
        const rect = page.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
          currentPage = parseInt(page.dataset.page);
          break;
        }
      }

      if (currentPage !== PDFEngine.getCurrentPage()) {
        PDFEngine.setState({ currentPage });
        PDFEngine.renderPageRange(currentPage, Math.min(currentPage + 4, PDFEngine.getTotalPages()));
        document.getElementById('page-input').value = currentPage;
        document.getElementById('status-page').textContent = `Page ${currentPage} of ${PDFEngine.getTotalPages()}`;
        document.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
        const activeThumb = document.querySelector(`.thumbnail-item[data-page="${currentPage}"]`);
        if (activeThumb) activeThumb.classList.add('active');
        // Render forms for newly visible pages
        for (let i = currentPage; i <= Math.min(currentPage + 4, PDFEngine.getTotalPages()); i++) {
          FormFillingModule.renderFormsForPage(i);
        }
      }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
