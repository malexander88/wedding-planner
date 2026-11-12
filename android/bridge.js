/* Injected by the Android app before the web app runs. Fills gaps in Android's WebView. */
(function () {
  var B = window.WPAndroid
  if (!B) return
  window.__wpAndroid = true

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
  window.__wpBack = function () {
    var m = document.querySelectorAll('.modal-back')
    if (m.length) { m[m.length - 1].click(); return 'closed' }
    return ''
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
