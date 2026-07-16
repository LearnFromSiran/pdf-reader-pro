/**
 * Annotations Module — Highlight, underline, strikeout, and notes
 */

const AnnotationModule = (function() {
  let annotations = [];
  let activeTool = null; // 'highlight', 'underline', 'strikeout', 'note'
  let activeColor = '#ffd700';
  let isActive = false;

  const annotationToolbar = document.getElementById('annotation-toolbar');
  const colorPicker = document.getElementById('annotation-color');

  function init() {
    // Setup text selection listener for text-based annotations
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('click', handleNoteClick);
  }

  function toggle() {
    isActive = !isActive;
    annotationToolbar.hidden = !isActive;
    if (!isActive) {
      activeTool = null;
      updateToolButtons();
    }
  }

  function close() {
    isActive = false;
    activeTool = null;
    annotationToolbar.hidden = true;
    updateToolButtons();
  }

  function setTool(tool) {
    activeTool = activeTool === tool ? null : tool;
    updateToolButtons();
  }

  function updateToolButtons() {
    document.querySelectorAll('.annotation-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (activeTool) {
      const map = { highlight: 'btn-highlight', underline: 'btn-underline', strikeout: 'btn-strikeout', note: 'btn-note' };
      const btn = document.getElementById(map[activeTool]);
      if (btn) btn.classList.add('active');
    }
  }

  function handleTextSelection(e) {
    if (!isActive || !activeTool || activeTool === 'note') return;

    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const pageWrapper = range.commonAncestorContainer.closest?.('.pdf-page-wrapper') ||
                        range.commonAncestorContainer.parentElement?.closest('.pdf-page-wrapper');
    if (!pageWrapper) return;

    const pageNum = parseInt(pageWrapper.dataset.page);
    const rects = range.getClientRects();
    const wrapperRect = pageWrapper.getBoundingClientRect();
    const scale = PDFEngine.getScale();
    const annotationLayer = pageWrapper.querySelector('.annotation-layer');

    const id = 'anno-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const annotation = {
      id,
      type: activeTool,
      page: pageNum,
      color: activeColor,
      rects: [],
      text: selection.toString().substring(0, 200)
    };

    for (const rect of rects) {
      const annoDiv = document.createElement('div');
      annoDiv.className = `annotation ${activeTool}`;
      annoDiv.dataset.id = id;
      annoDiv.style.left = (rect.left - wrapperRect.left) + 'px';
      annoDiv.style.top = (rect.top - wrapperRect.top) + 'px';
      annoDiv.style.width = rect.width + 'px';
      annoDiv.style.height = rect.height + 'px';

      if (activeTool === 'highlight') annoDiv.style.backgroundColor = hexToRgba(activeColor, 0.4);
      if (activeTool === 'underline') annoDiv.style.borderBottomColor = activeColor;
      if (activeTool === 'strikeout') annoDiv.style.background = `linear-gradient(transparent 45%, ${activeColor} 45%, ${activeColor} 55%, transparent 55%)`;

      annotationLayer.appendChild(annoDiv);
      annotation.rects.push({ left: rect.left - wrapperRect.left, top: rect.top - wrapperRect.top, width: rect.width, height: rect.height });
    }

    annotations.push(annotation);
    selection.removeAllRanges();
  }

  function handleNoteClick(e) {
    if (!isActive || activeTool !== 'note') return;

    const pageWrapper = e.target.closest('.pdf-page-wrapper');
    if (!pageWrapper) return;

    const pageNum = parseInt(pageWrapper.dataset.page);
    const wrapperRect = pageWrapper.getBoundingClientRect();
    const x = e.clientX - wrapperRect.left;
    const y = e.clientY - wrapperRect.top;

    const id = 'note-' + Date.now();
    const noteText = prompt('Enter note text:');
    if (!noteText) return;

    const annotationLayer = pageWrapper.querySelector('.annotation-layer');
    const noteEl = document.createElement('div');
    noteEl.className = 'annotation-note';
    noteEl.dataset.id = id;
    noteEl.style.left = (x - 12) + 'px';
    noteEl.style.top = (y - 12) + 'px';
    noteEl.textContent = 'N';
    noteEl.title = noteText;
    annotationLayer.appendChild(noteEl);

    annotations.push({
      id,
      type: 'note',
      page: pageNum,
      color: activeColor,
      x: x - 12,
      y: y - 12,
      text: noteText
    });
  }

  function clearAll() {
    if (!confirm('Clear all annotations?')) return;
    annotations = [];
    document.querySelectorAll('.annotation-layer').forEach(layer => {
      layer.innerHTML = '';
    });
  }

  function setColor(color) {
    activeColor = color;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getAnnotations() {
    return annotations;
  }

  return {
    init,
    toggle,
    close,
    setTool,
    setColor,
    clearAll,
    getAnnotations
  };
})();
