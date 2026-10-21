// The picture viewer inside transcript pages (Admin → Tickets and members' own transcripts): click a picture to
// open it full screen, scroll or pinch to zoom towards the pointer, drag to pan, double-click to zoom in or back
// out, arrow keys for the previous/next picture, and Escape (or a click on the dark area) to close.
// Self-contained (its own styles) so it works on old and new transcript layouts alike.

export const LIGHTBOX_SCRIPT = String.raw`<script>
(function () {
  var SKIP = ".avatar, .participant-avatar, .participant-avatar-fallback, .chat-emoji, .emoji, .tx-lb img";
  function pictures() {
    return Array.prototype.slice.call(document.querySelectorAll(".msg img")).filter(function (img) { return !img.matches(SKIP); });
  }
  var css = document.createElement("style");
  css.textContent =
    ".msg img:not(.avatar):not(.chat-emoji):not(.emoji), .tx-media-grid img { cursor: zoom-in; }" +
    ".tx-lb { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; background: rgba(6,4,10,.94); color: #fff; font: 14px system-ui, sans-serif; user-select: none; touch-action: none; animation: txlbIn .15s ease; }" +
    "@keyframes txlbIn { from { opacity: 0 } }" +
    ".tx-lb-stage { position: relative; flex: 1; overflow: hidden; cursor: grab; }" +
    ".tx-lb-stage.is-drag { cursor: grabbing; }" +
    ".tx-lb-stage > img { position: absolute; left: 50%; top: 50%; max-width: none !important; max-height: none !important; width: auto !important; height: auto !important; margin: 0; border-radius: 0; transform-origin: 0 0; will-change: transform; -webkit-user-drag: none; }" +
    ".tx-lb-bar { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(0,0,0,.45); }" +
    ".tx-lb-count { margin-right: auto; color: rgba(255,255,255,.75); font-variant-numeric: tabular-nums; }" +
    ".tx-lb-bar button, .tx-lb-bar a { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 10px; border: 1px solid rgba(255,255,255,.18); border-radius: 9px; background: rgba(255,255,255,.08); color: #fff; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }" +
    ".tx-lb-bar button:hover, .tx-lb-bar a:hover { background: rgba(255,255,255,.18); }" +
    ".tx-lb-zoom { min-width: 62px !important; font-variant-numeric: tabular-nums; }" +
    ".tx-lb-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 64px; border: 0; border-radius: 12px; background: rgba(0,0,0,.45); color: #fff; font-size: 30px; line-height: 1; cursor: pointer; z-index: 2; }" +
    ".tx-lb-nav:hover { background: rgba(0,0,0,.7); } .tx-lb-prev { left: 12px; } .tx-lb-next { right: 12px; }" +
    ".tx-lb-hint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.6); color: rgba(255,255,255,.85); font-size: 12px; white-space: nowrap; pointer-events: none; transition: opacity .4s; }";
  document.head.appendChild(css);

  var box = null, img, stage, count, zoomLabel, list = [], index = 0;
  var scale = 1, fit = 1, x = 0, y = 0, pointers = {}, last = null, pinch = null, moved = false, downOnBackdrop = false;

  function paint() {
    img.style.transform = "translate(" + x + "px," + y + "px) scale(" + scale + ")";
    zoomLabel.textContent = Math.round(scale * 100) + "%";
  }
  // Fit the picture on screen (never blown up past its real size)
  function reset() {
    var w = stage.clientWidth, h = stage.clientHeight, iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    fit = Math.min(1, (w - 32) / iw, (h - 32) / ih);
    scale = fit;
    x = (-iw * scale) / 2;
    y = (-ih * scale) / 2;
    paint();
  }
  // Zoom keeping the point under (cx, cy) still (stage coordinates, 0,0 = the middle)
  function zoomAt(factor, cx, cy) {
    var next = Math.max(fit * 0.5, Math.min(Math.max(fit, 1) * 10, scale * factor));
    var k = next / scale;
    x = cx - (cx - x) * k;
    y = cy - (cy - y) * k;
    scale = next;
    paint();
  }
  function point(e) {
    var r = stage.getBoundingClientRect();
    return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
  }
  function show(i) {
    index = (i + list.length) % list.length;
    var src = list[index].currentSrc || list[index].src;
    img.onload = reset;
    img.src = src;
    if (img.complete && img.naturalWidth) reset();
    count.textContent = list.length > 1 ? index + 1 + " / " + list.length : "";
    box.querySelector(".tx-lb-open").href = src;
    var nav = box.querySelectorAll(".tx-lb-nav");
    for (var n = 0; n < nav.length; n++) nav[n].style.display = list.length > 1 ? "" : "none";
  }
  function close() {
    if (!box) return;
    box.remove();
    box = null;
    document.removeEventListener("keydown", keys, true);
    window.removeEventListener("resize", reset);
    document.documentElement.style.overflow = "";
  }
  function keys(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(index + 1);
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "+" || e.key === "=") zoomAt(1.25, 0, 0);
    else if (e.key === "-" || e.key === "_") zoomAt(0.8, 0, 0);
    else if (e.key === "0") reset();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
  function open(target) {
    list = pictures();
    var start = -1;
    for (var i = 0; i < list.length; i++) if (list[i] === target || list[i].src === target.src) { start = i; break; }
    // A picture from the Files & media list that isn't in the chat (or a layout we don't know): just that one
    if (start < 0) { list = [target]; start = 0; }
    box = document.createElement("div");
    box.className = "tx-lb";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Picture viewer");
    box.innerHTML =
      '<div class="tx-lb-bar"><span class="tx-lb-count"></span>' +
      '<button type="button" data-a="out" title="Zoom out (-)" aria-label="Zoom out">−</button>' +
      '<button type="button" data-a="reset" class="tx-lb-zoom" title="Fit to screen (0)">100%</button>' +
      '<button type="button" data-a="in" title="Zoom in (+)" aria-label="Zoom in">+</button>' +
      '<a class="tx-lb-open" target="_blank" rel="noopener" title="Open the full picture in a new tab">Original</a>' +
      '<button type="button" data-a="close" title="Close (Esc)" aria-label="Close">✕</button></div>' +
      '<div class="tx-lb-stage"><img alt="">' +
      '<button type="button" class="tx-lb-nav tx-lb-prev" data-a="prev" aria-label="Previous picture">‹</button>' +
      '<button type="button" class="tx-lb-nav tx-lb-next" data-a="next" aria-label="Next picture">›</button>' +
      '<div class="tx-lb-hint">Scroll to zoom · drag to move · double-click to zoom · Esc to close</div></div>';
    document.body.appendChild(box);
    document.documentElement.style.overflow = "hidden";
    img = box.querySelector(".tx-lb-stage > img");
    stage = box.querySelector(".tx-lb-stage");
    count = box.querySelector(".tx-lb-count");
    zoomLabel = box.querySelector(".tx-lb-zoom");
    var hint = box.querySelector(".tx-lb-hint");
    setTimeout(function () { hint.style.opacity = "0"; }, 2800);

    box.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]");
      if (a) {
        var act = a.getAttribute("data-a");
        if (act === "close") close();
        else if (act === "in") zoomAt(1.4, 0, 0);
        else if (act === "out") zoomAt(1 / 1.4, 0, 0);
        else if (act === "reset") reset();
        else if (act === "prev") show(index - 1);
        else if (act === "next") show(index + 1);
        return;
      }
      // A plain click that started on the dark area (not on the picture, not the end of a drag) closes.
      // (Dragging captures the pointer on the stage, so the click's target is the stage either way.)
      if (!moved && downOnBackdrop && e.target === stage) close();
    });
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var p = point(e);
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), p[0], p[1]);
    }, { passive: false });
    function onPicture(e) {
      var r = img.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    stage.addEventListener("dblclick", function (e) {
      if (!onPicture(e)) return;
      var p = point(e);
      if (scale > fit * 1.05) reset();
      else zoomAt(Math.max(2.5, 1 / fit), p[0], p[1]);
    });
    stage.addEventListener("pointerdown", function (e) {
      if (e.target.closest("[data-a]")) return;
      e.preventDefault();
      if (!Object.keys(pointers).length) downOnBackdrop = e.target === stage && !onPicture(e);
      stage.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = [e.clientX, e.clientY];
      moved = false;
      last = [e.clientX, e.clientY];
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
      stage.classList.add("is-drag");
    });
    stage.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        // Two fingers: pinch to zoom around the middle of them
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        var p = point({ clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 });
        zoomAt(d / pinch, p[0], p[1]);
        pinch = d;
        moved = true;
        return;
      }
      if (Math.abs(e.clientX - last[0]) + Math.abs(e.clientY - last[1]) > 3) moved = true;
      x += e.clientX - last[0];
      y += e.clientY - last[1];
      last = [e.clientX, e.clientY];
      paint();
    });
    function up(e) {
      delete pointers[e.pointerId];
      var rest = Object.keys(pointers);
      if (rest.length < 2) pinch = null;
      if (rest.length) last = pointers[rest[0]];
      else stage.classList.remove("is-drag");
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    window.addEventListener("resize", reset);
    document.addEventListener("keydown", keys, true);
    show(start);
  }
  // Pictures in messages (and the Files & media list) open the viewer instead of following their link
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (box || !(t instanceof HTMLImageElement) || t.matches(SKIP)) return;
    if (!(t.closest(".msg") || t.closest(".tx-media-grid"))) return;
    e.preventDefault();
    e.stopPropagation();
    open(t);
  }, true);
})();
</script>`;
