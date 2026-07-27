// boot-check.js — fail-safe boot check: if the ES modules did not load
// (e.g. index.html was opened straight from disk, where browsers block
// module imports), say so instead of showing a dead page.
// Lives in its own file (not inline) so the Content-Security-Policy can
// stay `script-src 'self'` with no inline-script exception.
setTimeout(function () {
  if (!document.body.dataset.appReady) {
    var box = document.getElementById('error-box');
    box.hidden = false;
    box.textContent = 'The app scripts could not load. If you opened index.html directly from disk, ' +
      'browsers block ES modules on file:// — serve the folder instead (e.g. "npx serve" or ' +
      '"python -m http.server") and open the local URL. See the README quickstart.';
  }
}, 1500);
