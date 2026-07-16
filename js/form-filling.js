/**
 * Form Filling Module — Interactive PDF form fields (text, checkbox, radio, dropdown)
 *
 * Renders native HTML form controls over the PDF canvas by reading Widget
 * annotations from PDF.js. Values are persisted in a Map so they survive
 * re-renders caused by zoom or rotation (as long as the caller re-invokes
 * renderFormsForPage after the canvas is rebuilt).
 */

const FormFillingModule = (function() {
  const formData = new Map();    // fieldKey -> current value
  const renderedPages = new Set(); // page numbers that have active DOM elements

  /**
   * Derive a stable storage key for an annotation.
   * Radio buttons intentionally fall back to fieldName so the whole group
   * shares one Map entry.
   */
  function getFieldKey(annotation, pageNum) {
    if (annotation.fieldName) return annotation.fieldName;
    if (annotation.id) return String(annotation.id);
    return `page-${pageNum}-rect-${annotation.rect.join('-')}`;
  }

  /**
   * Remove the form-layer DOM for a single page and stop tracking it.
   */
  function clearFormsForPage(pageNum) {
    const wrapper = document.getElementById(`page-${pageNum}`);
    if (!wrapper) return;

    const layer = wrapper.querySelector('.form-layer');
    if (layer) {
      layer.remove();
    }
    renderedPages.delete(pageNum);
  }

  /**
   * Scan a single page for Widget annotations and create matching HTML inputs.
   */
  async function renderFormsForPage(pageNum) {
    const pdf = PDFEngine.getPDF();
    if (!pdf) return;

    // Guard against duplicate renders unless the layer was destroyed (e.g. zoom).
    if (renderedPages.has(pageNum)) {
      const wrapper = document.getElementById(`page-${pageNum}`);
      if (wrapper && wrapper.querySelector('.form-layer')) {
        return;
      }
      renderedPages.delete(pageNum);
    }

    let page;
    try {
      page = await pdf.getPage(pageNum);
    } catch (err) {
      console.error('FormFilling: failed to get page', pageNum, err);
      return;
    }

    let annotations;
    try {
      annotations = await page.getAnnotations();
    } catch (err) {
      console.error('FormFilling: failed to get annotations', pageNum, err);
      return;
    }

    const viewport = page.getViewport({
      scale: PDFEngine.getScale(),
      rotation: PDFEngine.getRotation()
    });

    // Keep only the interactive Widget types we support.
    const widgets = annotations.filter(ann => {
      const isWidget = ann.subtype === 'Widget' || ann.annotationType === 20;
      if (!isWidget) return false;

      const ft = ann.fieldType;
      if (ft === 'Tx') return true;          // Text
      if (ft === 'Ch') return true;          // Choice / dropdown
      if (ft === 'Btn') {
        // Ignore push buttons (they trigger actions, don't hold state).
        const isPush = ann.pushButton === true || (ann.fieldFlags & 0x10000) !== 0;
        return !isPush;
      }
      return false;
    });

    if (widgets.length === 0) return;

    const wrapper = document.getElementById(`page-${pageNum}`);
    if (!wrapper) return;

    // Build a dedicated overlay layer so we don't collide with annotation highlights.
    let formLayer = wrapper.querySelector('.form-layer');
    if (!formLayer) {
      formLayer = document.createElement('div');
      formLayer.className = 'form-layer';
      formLayer.style.position = 'absolute';
      formLayer.style.top = '0';
      formLayer.style.left = '0';
      formLayer.style.width = '100%';
      formLayer.style.height = '100%';
      formLayer.style.zIndex = '5';
      formLayer.style.pointerEvents = 'none'; // clicks pass through empty space
      wrapper.appendChild(formLayer);
    }

    for (const ann of widgets) {
      const el = buildFormElement(ann, viewport, pageNum);
      if (el) {
        formLayer.appendChild(el);
      }
    }

    renderedPages.add(pageNum);
  }

  /**
   * Create a single HTML input mapped to one PDF annotation.
   */
  function buildFormElement(annotation, viewport, pageNum) {
    const vpRect = viewport.convertToViewportRectangle(annotation.rect);
    const [rx1, ry1, rx2, ry2] = vpRect;

    const left   = Math.min(rx1, rx2);
    const right  = Math.max(rx1, rx2);
    const top    = Math.min(ry1, ry2);
    const bottom = Math.max(ry1, ry2);
    const width  = right - left;
    const height = bottom - top;

    const ft = annotation.fieldType;
    let el = null;
    let storageKey = getFieldKey(annotation, pageNum);

    // Shared visual baseline for all field types.
    const baseStyle = {
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px',
      boxSizing: 'border-box',
      margin: '0',
      padding: '2px 4px',
      fontSize: Math.max(10, height * 0.55) + 'px',
      fontFamily: 'sans-serif',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(0, 0, 0, 0.3)',
      borderRadius: '2px',
      color: '#000',
      pointerEvents: 'auto',
      zIndex: '6'
    };

    if (ft === 'Tx') {
      const isMultiLine = (annotation.fieldFlags & 0x2000) !== 0;
      if (isMultiLine) {
        el = document.createElement('textarea');
      } else {
        el = document.createElement('input');
        el.type = 'text';
      }

      const saved = formData.get(storageKey);
      if (saved !== undefined) {
        el.value = saved;
      } else if (annotation.fieldValue) {
        el.value = annotation.fieldValue;
      }

      el.addEventListener('input', () => {
        formData.set(storageKey, el.value);
      });

    } else if (ft === 'Btn') {
      const isRadio    = annotation.radioButton === true || (annotation.fieldFlags & 0x8000) !== 0;
      const isPushBtn  = annotation.pushButton  === true || (annotation.fieldFlags & 0x10000) !== 0;
      if (isPushBtn) return null;

      if (isRadio) {
        el = document.createElement('input');
        el.type = 'radio';
        const groupName = annotation.fieldName || storageKey;
        el.name = groupName;
        const buttonValue = annotation.buttonValue || annotation.fieldValue || 'on';
        el.value = buttonValue;

        // Radio groups share storage under the field name.
        const saved = formData.get(groupName);
        if (saved !== undefined) {
          el.checked = (saved === buttonValue);
        } else if (annotation.fieldValue && annotation.fieldValue !== 'Off') {
          el.checked = (annotation.fieldValue === buttonValue);
        }

        el.addEventListener('change', () => {
          if (el.checked) {
            formData.set(groupName, buttonValue);
          }
        });
      } else {
        // Checkbox
        el = document.createElement('input');
        el.type = 'checkbox';

        const saved = formData.get(storageKey);
        if (saved !== undefined) {
          el.checked = saved;
        } else if (annotation.fieldValue && annotation.fieldValue !== 'Off') {
          el.checked = true;
        }

        el.addEventListener('change', () => {
          formData.set(storageKey, el.checked);
        });
      }

    } else if (ft === 'Ch') {
      el = document.createElement('select');

      if (annotation.options && Array.isArray(annotation.options)) {
        for (const opt of annotation.options) {
          const option = document.createElement('option');
          option.value = opt.value !== undefined
            ? opt.value
            : (opt.exportValue !== undefined ? opt.exportValue : '');
          option.textContent = opt.label !== undefined
            ? opt.label
            : (opt.displayValue !== undefined ? opt.displayValue : option.value);
          el.appendChild(option);
        }
      }

      const saved = formData.get(storageKey);
      if (saved !== undefined) {
        el.value = saved;
      } else if (annotation.fieldValue) {
        el.value = annotation.fieldValue;
      }

      el.addEventListener('change', () => {
        formData.set(storageKey, el.value);
      });
    }

    if (!el) return null;

    Object.assign(el.style, baseStyle);
    el.dataset.fieldKey = storageKey;

    return el;
  }

  /**
   * Destroy every form element across all pages and wipe stored data.
   */
  function clearForms() {
    formData.clear();
    const pages = Array.from(renderedPages);
    renderedPages.clear();
    for (const pageNum of pages) {
      const wrapper = document.getElementById(`page-${pageNum}`);
      if (wrapper) {
        const layer = wrapper.querySelector('.form-layer');
        if (layer) layer.remove();
      }
    }
  }

  /**
   * Export a plain-object snapshot of all filled values.
   */
  function getFormData() {
    const result = {};
    for (const [key, value] of formData.entries()) {
      result[key] = value;
    }
    return result;
  }

  return {
    renderFormsForPage,
    clearForms,
    getFormData
  };
})();
