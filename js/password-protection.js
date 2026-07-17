/**
 * Password Protection Module — Handles password-protected PDFs
 *
 * Wraps PDFEngine.loadPDF() to detect PasswordException from PDF.js and
 * prompt the user for the document password without modifying pdf-engine.js.
 */

const PasswordModule = (function() {
  'use strict';

  // ── Private state ────────────────────────────────────────────────
  let passwordModal = null;
  let passwordInput = null;
  let passwordError = null;
  let currentProvidePassword = null;
  let isStylesInjected = false;

  // ── Helpers ──────────────────────────────────────────────────────

  function isPasswordException(err) {
    return err && err.name === 'PasswordException';
  }

  function buildSourceWithPassword(source, password) {
    if (typeof source === 'string') {
      return { url: source, password: password };
    }
    if (source && typeof source === 'object') {
      return Object.assign({}, source, { password: password });
    }
    return source;
  }

  function injectStyles() {
    if (isStylesInjected) return;
    isStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .password-modal-overlay[hidden] { display: none !important; }
      .password-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }
      .password-modal-dialog {
        background: #ffffff;
        border-radius: 8px;
        padding: 28px 24px 24px;
        width: 100%;
        max-width: 360px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        animation: password-modal-in 0.2s ease-out;
      }
      @keyframes password-modal-in {
        from { opacity: 0; transform: translateY(-12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)     scale(1); }
      }
      .password-modal-title {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
      }
      .password-modal-message {
        margin: 0 0 18px;
        font-size: 13px;
        color: #555;
        line-height: 1.45;
      }
      .password-modal-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 14px;
        border: 1px solid #c8c8c8;
        border-radius: 6px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .password-modal-input:focus {
        border-color: #1473e6;
        box-shadow: 0 0 0 3px rgba(20, 115, 230, 0.15);
      }
      .password-modal-error {
        margin-top: 10px;
        font-size: 12px;
        color: #d93025;
        line-height: 1.4;
      }
      .password-modal-error[hidden] { display: none !important; }
      .password-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 18px;
      }
      .password-modal-btn {
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .password-modal-btn-primary {
        background: #1473e6;
        color: #fff;
        border-color: #1473e6;
      }
      .password-modal-btn-primary:hover {
        background: #1165c9;
        border-color: #1165c9;
      }
      .password-modal-btn-secondary {
        background: #f5f5f5;
        color: #333;
        border-color: #d0d0d0;
      }
      .password-modal-btn-secondary:hover {
        background: #e8e8e8;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Modal DOM ────────────────────────────────────────────────────

  function ensureModal() {
    if (passwordModal) return;

    injectStyles();

    passwordModal = document.createElement('div');
    passwordModal.id = 'password-modal';
    passwordModal.className = 'password-modal-overlay';
    passwordModal.hidden = true;
    passwordModal.innerHTML = `
      <div class="password-modal-dialog">
        <h3 class="password-modal-title">Password Required</h3>
        <p class="password-modal-message">This PDF document is password protected. Enter the password to open it.</p>
        <input type="password" id="password-input" class="password-modal-input" placeholder="Enter password" autocomplete="off">
        <div id="password-error" class="password-modal-error" hidden></div>
        <div class="password-modal-actions">
          <button id="password-btn-cancel" class="password-modal-btn password-modal-btn-secondary">Cancel</button>
          <button id="password-btn-open" class="password-modal-btn password-modal-btn-primary">Open</button>
        </div>
      </div>
    `;
    document.body.appendChild(passwordModal);

    passwordInput = passwordModal.querySelector('#password-input');
    passwordError = passwordModal.querySelector('#password-error');

    const btnOpen = passwordModal.querySelector('#password-btn-open');
    const btnCancel = passwordModal.querySelector('#password-btn-cancel');

    passwordInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && currentProvidePassword) {
        currentProvidePassword(passwordInput.value);
      }
    });

    btnOpen.addEventListener('click', function() {
      if (currentProvidePassword) {
        currentProvidePassword(passwordInput.value);
      }
    });

    btnCancel.addEventListener('click', function() {
      hidePasswordPrompt();
      if (currentProvidePassword) {
        currentProvidePassword(null);
      }
    });

    passwordModal.addEventListener('click', function(e) {
      if (e.target === passwordModal) {
        btnCancel.click();
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────────

  function showPasswordPrompt(onSubmit, onCancel, errorMessage) {
    ensureModal();
    currentProvidePassword = onSubmit || null;

    passwordInput.value = '';
    passwordError.textContent = errorMessage || '';
    passwordError.hidden = !errorMessage;
    passwordModal.hidden = false;
    passwordInput.focus();

    if (onCancel) {
      passwordModal._onCancel = onCancel;
    }
  }

  function hidePasswordPrompt() {
    if (passwordModal) {
      passwordModal.hidden = true;
    }
    currentProvidePassword = null;
  }

  /**
   * Attempt to load a PDF through PDFEngine, handling password-protected documents.
   *
   * @param {string|Object} source          PDF source (URL string or PDF.js getDocument parameter object).
   * @returns {Promise<boolean>} Resolves to `true` if the PDF loaded successfully, `false` otherwise.
   */
  async function tryLoadWithPassword(source) {
    // First attempt: try loading without password
    try {
      return await PDFEngine.loadPDF(source);
    } catch (err) {
      if (!isPasswordException(err)) {
        // Non-password error — PDFEngine already alerted the user
        return false;
      }
    }

    // Password required — enter retry loop
    return new Promise(function(resolve) {
      let resolved = false;

      function providePassword(password) {
        if (resolved) return;

        if (!password) {
          resolved = true;
          hidePasswordPrompt();
          resolve(false);
          return;
        }

        const passwordSource = buildSourceWithPassword(source, password);

        PDFEngine.loadPDF(passwordSource).then(function(success) {
          if (!resolved) {
            resolved = true;
            if (success) hidePasswordPrompt();
            resolve(success);
          }
        }).catch(function(err) {
          if (isPasswordException(err)) {
            // Wrong password — surface error and allow another attempt
            if (passwordError) {
              passwordError.textContent = 'Incorrect password. Please try again.';
              passwordError.hidden = false;
            }
            if (passwordInput) {
              passwordInput.value = '';
              passwordInput.focus();
            }
          } else {
            if (!resolved) {
              resolved = true;
              hidePasswordPrompt();
              resolve(false);
            }
          }
        });
      }

      showPasswordPrompt(
        providePassword,
        function() {
          if (!resolved) {
            resolved = true;
            hidePasswordPrompt();
            resolve(false);
          }
        },
        'This PDF requires a password to open.'
      );
    });
  }

  return {
    tryLoadWithPassword: tryLoadWithPassword,
    showPasswordPrompt: showPasswordPrompt,
    hidePasswordPrompt: hidePasswordPrompt
  };
})();
