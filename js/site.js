/* 东鲸算法 · 交互：搜索面板、深浅色、移动端导航 */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORE = 'wb-mode';

  /* ---------------------------------------------------------- 深浅色切换 */
  function applyMode(mode) {
    root.setAttribute('data-mode', mode || 'auto');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode-toggle]');
    if (!btn) return;
    var order = ['auto', 'light', 'dark'];
    var cur = root.getAttribute('data-mode') || 'auto';
    var next = order[(order.indexOf(cur) + 1) % order.length];
    applyMode(next);
    try { next === 'auto' ? localStorage.removeItem(STORE) : localStorage.setItem(STORE, next); } catch (err) {}
  });

  /* --------------------------------------------------------- 移动端导航 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-nav-toggle]')) {
      document.body.classList.toggle('nav-open');
      return;
    }
    if (!e.target.closest('.topnav') && !e.target.closest('[data-nav-toggle]')) {
      document.body.classList.remove('nav-open');
    }
  });

  /* ------------------------------------------------------------- 搜索面板 */
  var panel = document.querySelector('[data-search-panel]');
  if (!panel) return;

  var input = panel.querySelector('[data-search-input]');
  var results = panel.querySelector('[data-search-results]');
  var countEl = panel.querySelector('[data-search-count]');
  var INDEX = null;
  var loading = false;
  var hits = [];
  var cursor = -1;

  var meta = document.querySelector('meta[name="wb-search"]');
  var indexUrl = meta ? meta.getAttribute('content') : '/search.json';

  function open() {
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    load();
    input.value = '';
    render([]);
    setTimeout(function () { input.focus(); }, 10);
  }

  function close() {
    panel.hidden = true;
    document.body.style.overflow = '';
    cursor = -1;
  }

  function load() {
    if (INDEX || loading) return;
    loading = true;
    fetch(indexUrl, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) { INDEX = data.items || []; loading = false; if (input.value.trim()) search(input.value); })
      .catch(function () {
        loading = false;
        results.innerHTML = '<p class="searchbox-empty">索引没有加载成功，刷新页面再试一次。</p>';
      });
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(safe, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    });
    return out;
  }

  function snippet(text, terms) {
    if (!text) return '';
    var lower = text.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = lower.indexOf(terms[i].toLowerCase());
      if (p >= 0 && (at < 0 || p < at)) at = p;
    }
    if (at < 0) at = 0;
    var start = Math.max(0, at - 40);
    var piece = text.slice(start, start + 150);
    return (start > 0 ? '…' : '') + mark(piece, terms) + (start + 150 < text.length ? '…' : '');
  }

  function search(query) {
    var terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !INDEX) { render([]); return; }

    var scored = [];
    for (var i = 0; i < INDEX.length; i++) {
      var it = INDEX[i];
      var title = (it.t || '').toLowerCase();
      var trail = (it.c || '').toLowerCase();
      var body = (it.x || '').toLowerCase();
      var score = 0;
      var ok = true;
      for (var k = 0; k < terms.length; k++) {
        var t = terms[k];
        var inTitle = title.indexOf(t) >= 0;
        var inTrail = trail.indexOf(t) >= 0;
        var inBody = body.indexOf(t) >= 0;
        if (!inTitle && !inTrail && !inBody) { ok = false; break; }
        if (inTitle) score += 40;
        if (inTrail) score += 12;
        if (inBody) score += 4;
        score += Math.min(body.split(t).length - 1, 12);
      }
      if (!ok) continue;
      scored.push({ item: it, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    render(scored.slice(0, 40).map(function (s) { return s.item; }), terms);
  }

  function render(list, terms) {
    hits = list;
    cursor = -1;
    if (!list.length) {
      results.innerHTML = '<p class="searchbox-empty">' +
        (input.value.trim() ? '没有找到相关条目，换个词试试。' : '输入关键词开始检索，支持多词，用空格分开。') + '</p>';
      if (countEl) countEl.textContent = '';
      return;
    }
    var html = '';
    list.forEach(function (it, i) {
      html += '<a class="sb-hit" href="' + it.u + '" data-i="' + i + '">' +
        '<span class="sb-hit-top"><span class="sb-hit-title">' + mark(it.t, terms || []) + '</span>' +
        '<span class="sb-hit-trail">' + esc(it.c) + '</span></span>' +
        '<p class="sb-hit-snippet">' + snippet(it.x, terms || []) + '</p></a>';
    });
    results.innerHTML = html;
    if (countEl) countEl.textContent = list.length + ' 条结果';
  }

  function move(delta) {
    if (!hits.length) return;
    cursor = (cursor + delta + hits.length) % hits.length;
    var nodes = results.querySelectorAll('.sb-hit');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('on', i === cursor);
    if (nodes[cursor]) nodes[cursor].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-open]')) { e.preventDefault(); open(); return; }
    if (e.target.closest('[data-search-close]') || e.target === panel) close();
  });

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { search(input.value); }, 90);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      var target = cursor >= 0 ? hits[cursor] : hits[0];
      if (target) { e.preventDefault(); window.location.href = target.u; }
    } else if (e.key === 'Escape') { close(); }
  });

  panel.addEventListener('click', function (e) {
    var hit = e.target.closest('.sb-hit');
    if (hit) close();
  });

  document.addEventListener('keydown', function (e) {
    var typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === '/' && !typing && panel.hidden) { e.preventDefault(); open(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); panel.hidden ? open() : close(); }
    else if (e.key === 'Escape' && !panel.hidden) close();
  });
})();
