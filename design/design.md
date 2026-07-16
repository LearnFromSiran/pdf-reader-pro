# PDF Reader PWA — Design Spec

## Overview
A full-featured, installable PDF reader web app (PWA) modeled after Adobe Acrobat Reader DC. Single-page app with dark professional theme. Works offline after first load.

## Stack
- Pure HTML5 / CSS3 / Vanilla JavaScript (no framework — keeps it lightweight and PDF.js-friendly)
- PDF.js (Mozilla) from CDN, cached by Service Worker for offline use
- Single-file architecture with module-based JS organization

## Visual System

### Theme: Dark Professional (Adobe-style)
- **Background**: `#1a1a1a` (main viewer), `#2d2d2d` (sidebar/toolbar)
- **Surface**: `#3a3a3a` (panels, cards), `#4a4a4a` (hover states)
- **Accent**: `#1473e6` (Adobe blue — primary actions, selections)
- **Accent Hover**: `#0d66d0`
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#b0b0b0`
- **Border**: `#555555`
- **Success**: `#2d9d5c`
- **Warning**: `#e6a700`

### Typography
- UI Font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
- Viewer text: rendered by PDF.js (preserves document fonts)
- Toolbar: 14px, weight 500
- Sidebar labels: 12px, weight 400

### Layout
```
┌─────────────────────────────────────────────┐
│  TOOLBAR (top, 48px height)                 │
├────────┬────────────────────────────────────┤
│        │                                    │
│        │                                    │
│THUMBNAIL│      MAIN VIEWER (centered)       │
│SIDEBAR │      PDF pages rendered here       │
│(200px) │      with scroll, zoom, pan        │
│        │                                    │
│        │                                    │
├────────┴────────────────────────────────────┤
│  STATUS BAR (bottom, 28px height)           │
└─────────────────────────────────────────────┘
```

### Icons
- Lucide icons via CDN (lightweight, clean line icons)
- 20px toolbar icons, 16px sidebar icons

## Page Structure (Single Page)

### 1. Toolbar
**Row 1 — Primary Actions:**
- Logo/App name (left)
- File: Open (upload), Recent files dropdown
- View controls: Zoom out, zoom % (dropdown), zoom in, fit width, fit page
- Navigation: First page, prev page, page number input / total, next page, last page
- Rotate: CW, CCW
- Tools: Search toggle, annotation mode toggle
- Download, Print

**Row 2 — Contextual (shows when annotations active):**
- Highlight, Underline, Strikeout, Note
- Color picker for annotations

### 2. Thumbnail Sidebar
- Collapsible (toggle button on toolbar)
- Shows page thumbnails in a scrollable list
- Click thumbnail to navigate to page
- Current page highlighted with accent border
- Minimum width: 180px, max: 280px

### 3. Main Viewer
- Canvas-based rendering via PDF.js
- Pages stacked vertically with scroll
- Page shadow effect for depth
- Background: dark gray checkerboard or solid
- Smooth scroll behavior

### 4. Search Panel (overlay, right side)
- Search input with results counter
- Match highlighting on pages
- Prev/Next result navigation
- Case sensitive toggle
- Whole word toggle

### 5. Annotation Layer
- Transparent overlay on top of canvas
- Supports: highlight, underline, strikeout (text-based), sticky notes
- Click to add, drag to resize, click to delete
- Stored in memory (not persisted to file — browser security)

### 6. Status Bar
- Page info: "Page X of Y"
- Zoom level display
- Document size
- Word count (if available)

## Interactions & Motion

### Page Navigation
- Arrow keys: prev/next page
- Ctrl+Wheel: zoom
- Scroll: vertical page navigation
- Page up/down keys

### Zoom Behavior
- Zoom levels: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 300%, 400%
- Fit width: auto-zoom to container width
- Fit page: auto-zoom to container height
- Smooth zoom with CSS transform transition (0.15s ease)

### Loading States
- Initial: centered spinner with "Loading PDF Reader..."
- File load: progress bar overlay
- Page render: subtle placeholder, then fade-in

### Sidebar Toggle
- Smooth width transition (0.2s ease)
- Icon rotation on toggle

## PWA Features
- **Manifest**: name "PDF Reader Pro", short_name "PDF Reader", display "standalone"
- **Icons**: 192x192, 512x512 (generated programmatically via canvas)
- **Service Worker**: caches app shell + PDF.js CDN files + fallback page
- **Install prompt**: custom install button in toolbar
- **File Handling**: register as PDF file handler (where supported)

## Assets
- No external images needed — pure CSS + icon font + canvas rendering
- App icon: generated programmatically

## Offline Strategy
- Cache-first for app shell and PDF.js library
- Network-first for user-loaded PDFs (can't really cache arbitrary files)
- Offline page if user tries to load without connection

## Responsive Behavior
- Desktop (>1024px): Full layout with sidebar
- Tablet (768-1024px): Sidebar auto-collapsed, accessible via hamburger
- Mobile (<768px): Minimal toolbar, bottom sheet for thumbnails, fullscreen viewer

## Feature Modules (for parallel development)
1. **Core Engine** (`js/pdf-engine.js`): PDF.js initialization, page rendering, text layer
2. **UI Controls** (`js/ui-controls.js`): Toolbar, sidebar, zoom, navigation, status bar
3. **Search** (`js/search.js`): Text search, find, highlight matches
4. **Annotations** (`js/annotations.js`): Highlight, underline, notes overlay
5. **PWA** (`sw.js`, `manifest.json`): Service worker, manifest, install handling
6. **App Shell** (`index.html`, `css/styles.css`, `js/app.js`): Integration, theme, main app logic
