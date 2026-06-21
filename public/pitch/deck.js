/*
 * deck.js — tiny standalone presentation runtime for the Quad pitch deck.
 *
 * What it does (and nothing more, on purpose — so it's easy to read/edit):
 *   1. Scales the fixed 1920x1080 "canvas" to fit any window, centered + letterboxed.
 *   2. Shows one slide at a time and tags the active one with `data-deck-active`
 *      (that attribute is what triggers the entrance animations in index.html's CSS).
 *   3. Navigation: arrow keys / space / PageUp-Down / Home / End / number keys / "R",
 *      plus click the left or right half of the screen to go prev/next.
 *   4. If a team photo file is missing, it swaps in a branded initials tile so the
 *      deck never shows a broken image. Drop the real photo in and it appears.
 *
 * No build step, no dependencies. Open index.html directly, or serve the folder.
 */
(() => {
  const DESIGN_W = 1920;
  const DESIGN_H = 1080;

  const canvas  = document.getElementById('canvas');
  const stage   = document.getElementById('stage');
  const counter = document.getElementById('counter');
  const slides  = Array.from(canvas.querySelectorAll('.slide'));
  let index = 0;

  // 1. Scale the canvas so the whole 1920x1080 slide fits the window.
  function fit() {
    const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    canvas.style.transform = 'scale(' + scale + ')';
  }

  // 2. Show slide `i` (clamped) and mark it active.
  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, n) => {
      if (n === index) slide.setAttribute('data-deck-active', '');
      else slide.removeAttribute('data-deck-active');
    });
    if (counter) counter.textContent = (index + 1) + ' / ' + slides.length;
    // keep the slide number in the URL so a refresh stays on the same slide
    history.replaceState(null, '', '#' + (index + 1));
  }

  const next = () => show(index + 1);
  const prev = () => show(index - 1);

  // 4. Graceful fallback for missing team photos. We listen for `error`, but a
  //    missing image can fail *during* HTML parsing — before this script runs —
  //    so we also check `complete && naturalWidth === 0` to catch that case.
  function applyPhotoFallback(img) {
    const ph = document.createElement('div');
    ph.className = 'photo photo--ph';
    ph.setAttribute('style', img.getAttribute('style') || '');
    ph.textContent = img.dataset.initials || '';
    img.replaceWith(ph);
  }
  document.querySelectorAll('img.photo').forEach((img) => {
    img.addEventListener('error', () => applyPhotoFallback(img));
    if (img.complete && img.naturalWidth === 0) applyPhotoFallback(img);
  });

  // 3. Input handling.
  window.addEventListener('resize', fit);

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':        next(); e.preventDefault(); break;
      case 'ArrowLeft':
      case 'PageUp':   prev(); e.preventDefault(); break;
      case 'Home':     show(0); break;
      case 'End':      show(slides.length - 1); break;
      case 'r':
      case 'R':        show(0); break;
      default:
        if (/^[1-9]$/.test(e.key)) show(parseInt(e.key, 10) - 1);
    }
  });

  stage.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return; // let real controls work
    if (e.clientX / window.innerWidth > 0.5) next();
    else prev();
  });

  // Start: honour an existing #N in the URL, otherwise slide 1.
  const fromHash = (location.hash || '').match(/^#(\d+)$/);
  fit();
  show(fromHash ? parseInt(fromHash[1], 10) - 1 : 0);
})();
