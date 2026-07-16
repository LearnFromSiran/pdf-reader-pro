/**
 * Signature Module — Digital signature drawing and placement
 */

const SignatureModule = (function() {
  let signatures = [];
  let isOpen = false;
  let isDrawing = false;
  let lastPos = null;
  let signaturePad = null;
  let signatureCanvas = null;
  let signatureCtx = null;

  function createSignaturePanel() {
    if (document.getElementById('signature-panel')) {
      signaturePad = document.getElementById('signature-panel');
      signatureCanvas = document.getElementById('signature-canvas');
      signatureCtx = signatureCanvas.getContext('2d');
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'signature-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;';
    panel.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', closeSignaturePad);

    const content = document.createElement('div');
    content.style.cssText = 'position:relative;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);width:90%;max-width:640px;overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e0e0e0;';
    header.innerHTML = '<span style="font-size:16px;font-weight:600;">Draw Signature</span>';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:#666;padding:0 4px;';
    closeBtn.title = 'Cancel';
    closeBtn.addEventListener('click', closeSignaturePad);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'padding:20px;';

    signatureCanvas = document.createElement('canvas');
    signatureCanvas.id = 'signature-canvas';
    signatureCanvas.width = 600;
    signatureCanvas.height = 200;
    signatureCanvas.style.cssText = 'width:100%;height:auto;border:2px dashed #ccc;border-radius:4px;background:#fafafa;cursor:crosshair;display:block;';

    body.appendChild(signatureCanvas);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;padding:12px 20px;border-top:1px solid #e0e0e0;background:#f5f5f5;';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:8px 18px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;';
    clearBtn.addEventListener('click', clearCanvas);

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = 'padding:8px 18px;border:1px solid #1473e6;border-radius:4px;background:#1473e6;color:#fff;cursor:pointer;font-size:14px;';
    applyBtn.addEventListener('click', applySignature);

    footer.appendChild(clearBtn);
    footer.appendChild(applyBtn);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    panel.appendChild(backdrop);
    panel.appendChild(content);
    document.body.appendChild(panel);

    signaturePad = panel;
    signatureCtx = signatureCanvas.getContext('2d');
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.lineWidth = 2;
    signatureCtx.strokeStyle = '#000000';

    signatureCanvas.addEventListener('mousedown', handleMouseDown);
    signatureCanvas.addEventListener('mousemove', handleMouseMove);
    signatureCanvas.addEventListener('mouseup', handleMouseUp);
    signatureCanvas.addEventListener('mouseleave', handleMouseUp);
    signatureCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    signatureCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    signatureCanvas.addEventListener('touchend', handleTouchEnd);
  }

  function getCanvasPos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches.length > 0 ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches.length > 0 ? e.touches[0].clientY : 0);
    return {
      x: (clientX - rect.left) * (signatureCanvas.width / rect.width),
      y: (clientY - rect.top) * (signatureCanvas.height / rect.height)
    };
  }

  function handleMouseDown(e) {
    e.preventDefault();
    isDrawing = true;
    lastPos = getCanvasPos(e);
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    drawLine(lastPos, pos);
    lastPos = pos;
  }

  function handleMouseUp(e) {
    isDrawing = false;
    lastPos = null;
  }

  function handleTouchStart(e) {
    e.preventDefault();
    isDrawing = true;
    lastPos = getCanvasPos(e);
  }

  function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    drawLine(lastPos, pos);
    lastPos = pos;
  }

  function handleTouchEnd(e) {
    isDrawing = false;
    lastPos = null;
  }

  function drawLine(from, to) {
    signatureCtx.beginPath();
    signatureCtx.moveTo(from.x, from.y);
    signatureCtx.lineTo(to.x, to.y);
    signatureCtx.stroke();
  }

  function clearCanvas() {
    if (!signatureCtx) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  }

  function applySignature() {
    if (!signatureCanvas) return;
    const dataUrl = signatureCanvas.toDataURL('image/png');
    const pageNum = PDFEngine.getCurrentPage();
    if (!pageNum || !dataUrl) return;

    const width = 200;
    const height = 60;
    const x = 50;
    const y = 50;

    placeSignature(dataUrl, pageNum, x, y, width, height);
    clearCanvas();
    closeSignaturePad();
  }

  function openSignaturePad() {
    createSignaturePanel();
    isOpen = true;
    signaturePad.hidden = false;
    clearCanvas();
  }

  function closeSignaturePad() {
    isOpen = false;
    if (signaturePad) signaturePad.hidden = true;
  }

  function toggleSignaturePad() {
    if (isOpen) {
      closeSignaturePad();
    } else {
      openSignaturePad();
    }
  }

  function placeSignature(dataUrl, pageNum, x, y, width, height) {
    const pageWrapper = document.getElementById('page-' + pageNum);
    if (!pageWrapper) return;

    const annotationLayer = pageWrapper.querySelector('.annotation-layer');
    if (!annotationLayer) return;

    const id = 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const img = document.createElement('img');
    img.className = 'signature-overlay';
    img.dataset.id = id;
    img.src = dataUrl;
    img.style.position = 'absolute';
    img.style.left = x + 'px';
    img.style.top = y + 'px';
    img.style.width = width + 'px';
    img.style.height = height + 'px';
    img.style.cursor = 'move';
    img.style.zIndex = '100';
    img.style.userSelect = 'none';
    img.draggable = false;

    setupDrag(img, annotationLayer);
    annotationLayer.appendChild(img);

    signatures.push({ id, pageNum, dataUrl, x, y, width, height });
  }

  function setupDrag(img, container) {
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isDragging = false;

    function onPointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      const clientX = e.clientX || (e.touches && e.touches.length > 0 ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches.length > 0 ? e.touches[0].clientY : 0);
      const rect = img.getBoundingClientRect();
      dragOffsetX = clientX - rect.left;
      dragOffsetY = clientY - rect.top;

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches.length > 0 ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches.length > 0 ? e.touches[0].clientY : 0);
      const containerRect = container.getBoundingClientRect();
      const newLeft = clientX - containerRect.left - dragOffsetX;
      const newTop = clientY - containerRect.top - dragOffsetY;
      img.style.left = newLeft + 'px';
      img.style.top = newTop + 'px';
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);

      const sig = signatures.find(s => s.id === img.dataset.id);
      if (sig) {
        const containerRect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        sig.x = imgRect.left - containerRect.left;
        sig.y = imgRect.top - containerRect.top;
      }
    }

    img.addEventListener('mousedown', onPointerDown);
    img.addEventListener('touchstart', onPointerDown, { passive: false });
  }

  function getSignatures() {
    return signatures;
  }

  function clearSignatures() {
    signatures = [];
    document.querySelectorAll('.signature-overlay').forEach(el => el.remove());
  }

  function removeSignature(id) {
    const idx = signatures.findIndex(s => s.id === id);
    if (idx !== -1) signatures.splice(idx, 1);
    const el = document.querySelector('.signature-overlay[data-id="' + id + '"]');
    if (el) el.remove();
  }

  return {
    openSignaturePad,
    closeSignaturePad,
    toggleSignaturePad,
    placeSignature,
    getSignatures,
    clearSignatures,
    removeSignature
  };
})();
