/**
 * PDF Engine — Core PDF.js rendering, text layer, and page management
 */

const PDFEngine = (function() {
  // PDF.js setup
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let state = {
    pdf: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    rotation: 0,
    renderedPages: new Set(),
    pageViewports: new Map(),
    textContents: new Map(),
    isRendering: false,
    filename: 'document.pdf'
  };

  const pagesWrapper = document.getElementById('pages-wrapper');
  const viewerContainer = document.getElementById('viewer-container');

  function setState(updates) {
    Object.assign(state, updates);
  }

  function getState() {
    return state;
  }

  async function loadPDF(source) {
    try {
      showLoading(true);
      state.renderedPages.clear();
      state.pageViewports.clear();
      state.textContents.clear();

      const pdf = await pdfjsLib.getDocument(source).promise;
      state.pdf = pdf;
      state.totalPages = pdf.numPages;
      state.currentPage = 1;
      state.rotation = 0;
      state.scale = 1.0;

      // Pre-create page wrappers
      pagesWrapper.innerHTML = '';
      for (let i = 1; i <= state.totalPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.id = `page-${i}`;
        wrapper.dataset.page = i;
        wrapper.style.minHeight = '200px';
        wrapper.innerHTML = `
          <canvas class="pdf-canvas"></canvas>
          <div class="text-layer"></div>
          <div class="annotation-layer" data-page="${i}"></div>
          <div class="form-layer"></div>
        `;
        pagesWrapper.appendChild(wrapper);
      }

      // Render first batch of pages
      await renderPageRange(1, Math.min(5, state.totalPages));
      updateUI();
      return true;
    } catch (err) {
      console.error('PDF load error:', err);
      alert('Failed to load PDF: ' + err.message);
      return false;
    } finally {
      showLoading(false);
    }
  }

  async function renderPage(pageNum) {
    if (!state.pdf || state.renderedPages.has(pageNum)) return;
    const wrapper = document.getElementById(`page-${pageNum}`);
    if (!wrapper) return;

    try {
      const page = await state.pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: state.scale, rotation: state.rotation });
      state.pageViewports.set(pageNum, viewport);

      const canvas = wrapper.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      wrapper.style.width = viewport.width + 'px';

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Text layer
      const textLayer = wrapper.querySelector('.text-layer');
      textLayer.style.width = viewport.width + 'px';
      textLayer.style.height = viewport.height + 'px';
      textLayer.innerHTML = '';

      try {
        const textContent = await page.getTextContent();
        state.textContents.set(pageNum, textContent);
        buildTextLayer(textLayer, textContent, viewport);
      } catch (e) {
        // Some PDFs have no text layer
      }

      state.renderedPages.add(pageNum);
    } catch (err) {
      console.error(`Render page ${pageNum} error:`, err);
    }
  }

  function buildTextLayer(container, textContent, viewport) {
    const textItems = textContent.items;
    const fragment = document.createDocumentFragment();

    for (const item of textItems) {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(tx[0], tx[1]);
      const fontWidth = Math.hypot(tx[2], tx[3]);

      const span = document.createElement('span');
      span.textContent = item.str;
      span.style.left = tx[4] + 'px';
      span.style.top = tx[5] - fontHeight + 'px';
      span.style.fontSize = fontHeight + 'px';
      span.style.fontFamily = item.fontName || 'sans-serif';
      span.style.transform = `scaleX(${fontWidth / fontHeight || 1})`;
      span.style.transformOrigin = '0 0';
      fragment.appendChild(span);
    }
    container.appendChild(fragment);
  }

  async function renderPageRange(start, end) {
    const promises = [];
    for (let i = start; i <= end && i <= state.totalPages; i++) {
      if (!state.renderedPages.has(i)) {
        promises.push(renderPage(i));
      }
    }
    await Promise.all(promises);
  }

  async function reRenderAll() {
    state.renderedPages.clear();
    state.pageViewports.clear();
    state.textContents.clear();
    for (let i = 1; i <= state.totalPages; i++) {
      const wrapper = document.getElementById(`page-${i}`);
      if (wrapper) wrapper.innerHTML = `
        <canvas class="pdf-canvas"></canvas>
        <div class="text-layer"></div>
        <div class="annotation-layer" data-page="${i}"></div>
        <div class="form-layer"></div>
      `;
    }
    await renderPageRange(1, Math.min(state.totalPages, 5));
  }

  function updateUI() {
    document.getElementById('total-pages').textContent = state.totalPages;
    document.getElementById('page-input').max = state.totalPages;
    document.getElementById('page-input').value = state.currentPage;
    document.getElementById('status-page').textContent = `Page ${state.currentPage} of ${state.totalPages}`;
    document.getElementById('status-zoom').textContent = Math.round(state.scale * 100) + '%';

    // Update thumbnail highlight
    document.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
    const activeThumb = document.querySelector(`.thumbnail-item[data-page="${state.currentPage}"]`);
    if (activeThumb) activeThumb.classList.add('active');
  }

  function showLoading(show) {
    document.getElementById('loading-overlay').hidden = !show;
  }

  function goToPage(pageNum) {
    pageNum = Math.max(1, Math.min(state.totalPages, pageNum));
    state.currentPage = pageNum;
    const wrapper = document.getElementById(`page-${pageNum}`);
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    renderPageRange(pageNum, Math.min(pageNum + 4, state.totalPages));
    updateUI();
  }

  function zoom(newScale) {
    if (newScale === 'fit-width') {
      const containerWidth = viewerContainer.clientWidth - 40;
      const page1 = state.pageViewports.get(1);
      if (page1) newScale = containerWidth / page1.width * state.scale;
      else return;
    } else if (newScale === 'fit-page') {
      const containerHeight = viewerContainer.clientHeight - 40;
      const page1 = state.pageViewports.get(1);
      if (page1) newScale = containerHeight / page1.height * state.scale;
      else return;
    } else {
      newScale = Math.max(0.1, Math.min(5.0, newScale));
    }
    state.scale = newScale;
    reRenderAll();
    updateUI();
  }

  function rotate(deg) {
    state.rotation = (state.rotation + deg) % 360;
    reRenderAll();
  }

  function getTextContent(pageNum) {
    return state.textContents.get(pageNum);
  }

  function getPageViewport(pageNum) {
    return state.pageViewports.get(pageNum);
  }

  function getPDF() { return state.pdf; }
  function getTotalPages() { return state.totalPages; }
  function getCurrentPage() { return state.currentPage; }
  function getScale() { return state.scale; }
  function getRotation() { return state.rotation; }
  function getFilename() { return state.filename; }
  function setFilename(name) { state.filename = name; }

  return {
    loadPDF,
    renderPage,
    renderPageRange,
    goToPage,
    zoom,
    rotate,
    getTextContent,
    getPageViewport,
    getPDF,
    getTotalPages,
    getCurrentPage,
    getScale,
    getRotation,
    getFilename,
    setFilename,
    setState,
    getState
  };
})();
