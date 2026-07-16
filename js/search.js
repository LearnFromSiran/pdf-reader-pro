/**
 * Search Module — Text search within PDF documents
 */

const SearchModule = (function() {
  let searchState = {
    query: '',
    results: [],
    currentIndex: -1,
    caseSensitive: false,
    wholeWord: false
  };

  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const searchPanel = document.getElementById('search-panel');

  function normalizeText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim();
  }

  function createQueryPattern(query, caseSensitive, wholeWord) {
    let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = '\\b' + pattern + '\\b';
    const flags = caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  }

  async function search(query) {
    if (!query || query.length < 2) {
      searchResults.innerHTML = '<span class="search-empty">Enter at least 2 characters</span>';
      return;
    }

    const pdf = PDFEngine.getPDF();
    if (!pdf) {
      searchResults.innerHTML = '<span class="search-empty">No document loaded</span>';
      return;
    }

    searchState.query = query;
    searchState.caseSensitive = document.getElementById('search-case').checked;
    searchState.wholeWord = document.getElementById('search-whole').checked;
    searchState.results = [];
    searchState.currentIndex = -1;

    const pattern = createQueryPattern(query, searchState.caseSensitive, searchState.wholeWord);
    const totalPages = PDFEngine.getTotalPages();
    let resultHTML = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      let textContent = PDFEngine.getTextContent(pageNum);

      if (!textContent) {
        try {
          const page = await pdf.getPage(pageNum);
          textContent = await page.getTextContent();
        } catch (e) { continue; }
      }

      if (!textContent || !textContent.items) continue;

      const pageText = textContent.items.map(item => item.str).join(' ');
      const normalizedText = normalizeText(pageText);
      let match;
      const matches = [];
      const localPattern = new RegExp(pattern.source, pattern.flags);

      while ((match = localPattern.exec(normalizedText)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        });
      }

      if (matches.length > 0) {
        for (const m of matches) {
          const start = Math.max(0, m.index - 30);
          const end = Math.min(normalizedText.length, m.index + m.length + 30);
          const snippet = normalizedText.substring(start, end);
          const highlighted = snippet.replace(
            new RegExp(`(${pattern.source})`, pattern.flags),
            '<b>$1</b>'
          );

          searchState.results.push({ pageNum, matchIndex: m.index, text: m.text });

          resultHTML += `
            <div class="search-result-item" data-page="${pageNum}" data-match="${searchState.results.length - 1}">
              <div style="font-size:11px;color:#808080;margin-bottom:2px;">Page ${pageNum}</div>
              <div>...${highlighted}...</div>
            </div>
          `;
        }
      }
    }

    if (searchState.results.length === 0) {
      searchResults.innerHTML = '<span class="search-empty">No matches found</span>';
    } else {
      searchResults.innerHTML = `<div style="font-size:12px;color:#808080;padding:8px 0;">${searchState.results.length} result(s) found</div>` + resultHTML;
      searchState.currentIndex = 0;
      highlightCurrentResult();
    }

    // Click handlers
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = parseInt(item.dataset.page);
        const idx = parseInt(item.dataset.match);
        searchState.currentIndex = idx;
        PDFEngine.goToPage(page);
        highlightCurrentResult();
      });
    });
  }

  function highlightCurrentResult() {
    if (searchState.currentIndex < 0 || searchState.currentIndex >= searchState.results.length) return;

    const result = searchState.results[searchState.currentIndex];
    PDFEngine.goToPage(result.pageNum);

    // Highlight in search results panel
    searchResults.querySelectorAll('.search-result-item').forEach((item, i) => {
      if (parseInt(item.dataset.match) === searchState.currentIndex) {
        item.style.background = 'rgba(20, 115, 230, 0.2)';
        item.style.borderLeft = '3px solid #1473e6';
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.style.background = '';
        item.style.borderLeft = '';
      }
    });
  }

  function nextResult() {
    if (searchState.results.length === 0) return;
    searchState.currentIndex = (searchState.currentIndex + 1) % searchState.results.length;
    highlightCurrentResult();
  }

  function prevResult() {
    if (searchState.results.length === 0) return;
    searchState.currentIndex = (searchState.currentIndex - 1 + searchState.results.length) % searchState.results.length;
    highlightCurrentResult();
  }

  function toggle() {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) {
      searchInput.focus();
    }
  }

  function close() {
    searchPanel.hidden = true;
  }

  function clear() {
    searchInput.value = '';
    searchResults.innerHTML = '<span class="search-empty">Enter text to search</span>';
    searchState.results = [];
    searchState.currentIndex = -1;
  }

  return {
    search,
    nextResult,
    prevResult,
    toggle,
    close,
    clear
  };
})();
