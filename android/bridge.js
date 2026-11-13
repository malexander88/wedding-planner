// Older Android System WebViews (e.g. Chrome 83 on an un-updated Android 11 phone) lack a few
// newer built-ins the app and its libraries use. Syntax is lowered at build time (build-apk.sh);
// these fill the gaps at runtime and do nothing on an up-to-date WebView.
(function () {
  function def(o, k, v) { if (!(k in o)) Object.defineProperty(o, k, { value: v, writable: true, configurable: true }) }
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k) })
  function at(i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return i < 0 || i >= this.length ? undefined : this[i] }
  def(Array.prototype, 'at', at); def(String.prototype, 'at', at)
  def(Array.prototype, 'toSorted', function (f) { return Array.prototype.slice.call(this).sort(f) })
  def(Array.prototype, 'toReversed', function () { return Array.prototype.slice.call(this).reverse() })
  def(Array.prototype, 'findLast', function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return this[i] })
  def(Array.prototype, 'findLastIndex', function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return i; return -1 })
  def(String.prototype, 'replaceAll', function (a, b) {
    if (a instanceof RegExp) return this.replace(a, b)
    return this.replace(new RegExp(String(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), b)
  })
  if (typeof AbortSignal !== 'undefined') def(AbortSignal, 'timeout', function (ms) { var c = new AbortController(); setTimeout(function () { c.abort() }, ms); return c.signal })
  def(window, 'structuredClone', function clone(v) {
    if (v === null || typeof v !== 'object') return v
    if (v instanceof Date) return new Date(v.getTime())
    if (v instanceof Map) { var m = new Map(); v.forEach(function (x, k) { m.set(clone(k), clone(x)) }); return m }
    if (v instanceof Set) { var s = new Set(); v.forEach(function (x) { s.add(clone(x)) }); return s }
    if (v instanceof RegExp) return new RegExp(v.source, v.flags)
    if (ArrayBuffer.isView(v)) return v.slice()
    var o = Array.isArray(v) ? [] : {}
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = clone(v[k])
    return o
  })
})();
/* Injected by the Android app before the web app runs. Fills gaps in Android's WebView. */
(function () {
  var B = window.WPAndroid
  if (!B) return
  window.__wpAndroid = true
  // WebView's BarcodeDetector needs Google Play services declared by the host app and crashes it otherwise.
  // The app reads QR codes with jsQR instead.
  try { delete window.BarcodeDetector } catch (e) { /* ignore */ }

  // Printing (seating plan, run sheet) → Android print / Save as PDF.
  window.print = function () { B.print(document.title || 'Wedding Planner') }

  // "Downloads" (CSV, .ics, backups) are blob: links; WebView ignores them, so hand the bytes to Android.
  // Delay revoking blob URLs so the file can still be read after the app revokes it.
  var revoke = URL.revokeObjectURL.bind(URL)
  URL.revokeObjectURL = function (u) { setTimeout(function () { revoke(u) }, 60000) }
  function save(href, name) {
    fetch(href).then(function (r) { return r.blob() }).then(function (b) {
      var fr = new FileReader()
      fr.onload = function () { B.saveFile(name || 'download', b.type || '', String(fr.result).split(',')[1] || '') }
      fr.readAsDataURL(b)
    }).catch(function () { alert('Sorry, that file could not be saved.') })
  }
  var isFile = function (a) { return a && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href) }
  var click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (isFile(this)) return save(this.href, this.getAttribute('download'))
    return click.call(this)
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null
    if (isFile(a)) { e.preventDefault(); save(a.href, a.getAttribute('download')) }
  }, true)

  // Copy buttons → Android clipboard (reliable in every WebView version).
  try {
    var cb = navigator.clipboard || {}
    Object.defineProperty(cb, 'writeText', { configurable: true, value: function (t) { B.copy(String(t)); return Promise.resolve() } })
    if (!navigator.clipboard) Object.defineProperty(navigator, 'clipboard', { configurable: true, value: cb })
  } catch (e) { /* keep the WebView's own */ }

  // "Send…" for the pairing link → Android share sheet.
  if (!navigator.share) {
    navigator.share = function (d) {
      d = d || {}
      B.share(d.title || '', [d.text, d.url].filter(Boolean).join('\n'))
      return Promise.resolve()
    }
  }

  // Back button: close an open sheet or dialog before leaving the page.
  // Back closes the top sheet or dialog first. Tapping the backdrop closes most of them; dialogs that must be
  // answered (e.g. a partner's link) ignore that, so fall back to their own dismiss button. Never go back in
  // history underneath an open dialog.
  window.__wpBack = function () {
    var m = document.querySelectorAll('.modal-back')
    if (!m.length) return ''
    var top = m[m.length - 1]
    top.click()
    if (document.contains(top)) {
      var bs = top.querySelectorAll('button, [aria-label]')
      for (var i = 0; i < bs.length; i++) {
        var t = (bs[i].getAttribute('aria-label') || bs[i].textContent || '').trim()
        if (/^(close|cancel|not now|ok|done|back)$/i.test(t)) { bs[i].click(); break }
      }
    }
    return 'closed'
  }

  // Status and navigation bars follow the app's light/dark theme.
  var root = document.documentElement
  var last = null
  function sync() {
    var dark = root.getAttribute('data-theme') === 'dark'
    if (dark !== last) { last = dark; B.theme(dark) }
  }
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('DOMContentLoaded', sync)
})()
