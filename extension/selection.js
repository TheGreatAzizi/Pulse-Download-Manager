/*
 * Captures the links covered by the current selection before the context menu
 * takes focus. Chrome can collapse the selection by the time the menu item is
 * clicked, which used to drop most of the selected links.
 */
;(function () {
  let lastSelection = []

  function collect() {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      lastSelection = []
      return
    }
    const range = selection.getRangeAt(0)
    const seen = new Set()
    const urls = []
    const push = (raw) => {
      const value = String(raw || '').replace(/[),.;!?]+$/g, '')
      if (!/^https?:\/\//i.test(value) || seen.has(value)) return
      seen.add(value)
      urls.push(value)
    }
    for (const anchor of document.querySelectorAll('a[href]')) {
      try {
        if (!range.intersectsNode(anchor)) continue
      } catch {
        continue
      }
      push(anchor.href)
    }
    const text = selection.toString()
    for (const match of text.match(/https?:\/\/[^\s<>"']+/gi) || []) push(match)
    lastSelection = urls
  }

  document.addEventListener('contextmenu', collect, true)
  document.addEventListener('mouseup', collect, true)
  document.addEventListener('keyup', collect, true)

  // Read by background.js through chrome.scripting.executeScript. Both run in
  // the extension's isolated world, so the function stays private to Pulse.
  window.__pulseSelectedLinks = () => lastSelection.slice()
})()
