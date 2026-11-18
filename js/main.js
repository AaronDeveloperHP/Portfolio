/* global jQuery, bootstrap */
(function ($) {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $root = $('html');

  /* ---------------- Language ----------------
     Spanish is the markup; capture it once so we can switch back. */
  var dict = { es: {}, en: window.I18N_EN || {} };
  var ui = window.I18N_UI;

  $('[data-i18n]').each(function () {
    dict.es[$(this).data('i18n')] = $(this).html().replace(/\s+/g, ' ').trim();
  });
  $('[data-i18n-attr]').each(function () {
    var $el = $(this);
    $.each(String($el.data('i18n-attr')).split(';'), function (_, pair) {
      var p = pair.split(':');
      dict.es[p[1]] = $el.attr(p[0]);
    });
  });

  function lang() { return $root.attr('lang') === 'en' ? 'en' : 'es'; }
  function t(key) { return ui[lang()][key]; }

  function applyLang(l) {
    var d = dict[l];
    $root.attr('lang', l);
    $('[data-i18n]').each(function () {
      var v = d[$(this).data('i18n')];
      if (v !== undefined) { $(this).html(v); }
    });
    $('[data-i18n-attr]').each(function () {
      var $el = $(this);
      $.each(String($el.data('i18n-attr')).split(';'), function (_, pair) {
        var p = pair.split(':');
        if (d[p[1]] !== undefined) { $el.attr(p[0], d[p[1]]); }
      });
    });
    $('#langToggle').text(t('langBtn')).attr({ 'aria-label': t('langAria'), lang: l === 'es' ? 'en' : 'es' });
    $('.burger').attr('aria-label', $('#mobile').hasClass('show') ? t('menuClose') : t('menuOpen'));
    paintToggle($root.attr('data-theme'));
    if (typeof apply === 'function' && $code) { apply(true); }
  }

  $('#langToggle').on('click', function () {
    var next = lang() === 'es' ? 'en' : 'es';
    try { localStorage.setItem('ah-lang', next); } catch (e) { /* storage blocked */ }
    applyLang(next);
  });

  /* ---------------- Nav: blur on scroll, mobile menu ---------------- */
  var $nav = $('#nav');
  function onScroll() { $nav.toggleClass('scrolled', $(window).scrollTop() > 24); }
  $(window).on('scroll', onScroll);
  onScroll();

  /* ---------------- Scroll spy ----------------
     The active section is the last one whose top has passed a line
     40% down the viewport (below the fixed nav). At the very bottom of
     the page the last section wins, since short sections may never
     reach that line. */
  var $spyLinks = $('#mainNav .nav-link[href^="#"]');
  var $sections = $spyLinks.map(function () { return $($(this).attr('href'))[0]; });
  function updateSpy() {
    var scrollTop = $(window).scrollTop();
    var winH = window.innerHeight;
    var line = scrollTop + $nav.outerHeight() + (winH - $nav.outerHeight()) * 0.4;
    var current = $sections[0];

    if (scrollTop + winH >= $(document).height() - 2) {
      current = $sections[$sections.length - 1];
    } else {
      $sections.each(function () {
        if ($(this).offset().top <= line) { current = this; }
      });
    }

    var id = '#' + current.id;
    $spyLinks.each(function () {
      var on = $(this).attr('href') === id;
      $(this).toggleClass('active', on);
      if (on) { $(this).attr('aria-current', 'true'); } else { $(this).removeAttr('aria-current'); }
    });
  }
  // Only four offsets are read per call, so no throttling is needed.
  $(window).on('scroll resize load', updateSpy);
  // Collapsing/expanding job rows changes section positions.
  $(document).on('shown.bs.collapse hidden.bs.collapse', updateSpy);
  updateSpy();

  var $menu = $('#mobile');
  $menu.on('show.bs.collapse', function () { $nav.addClass('menu-open'); $('.burger').attr('aria-label', t('menuClose')); });
  $menu.on('hide.bs.collapse', function () { $nav.removeClass('menu-open'); $('.burger').attr('aria-label', t('menuOpen')); });
  $menu.on('click', 'a', function () {
    if ($menu.hasClass('show')) { bootstrap.Collapse.getOrCreateInstance($menu[0]).hide(); }
  });

  /* ---------------- Theme ---------------- */
  var $toggle = $('#themeToggle');
  function paintToggle(theme) {
    var light = theme === 'light';
    $toggle.find('.ico').text(light ? '☾' : '☀');
    $toggle.find('.lbl').text(light ? t('themeToDark') : t('themeToLight'));
    $toggle.attr({ 'aria-label': light ? t('themeAriaDark') : t('themeAriaLight'), 'aria-pressed': light });
  }
  $toggle.on('click', function () {
    var next = $root.attr('data-theme') === 'light' ? 'dark' : 'light';
    $root.attr({ 'data-theme': next, 'data-bs-theme': next });
    paintToggle(next);
    try { localStorage.setItem('ah-theme', next); } catch (e) { /* storage blocked */ }
    readAccent();
  });

  /* ---------------- Clock (Canarias) ---------------- */
  function tick() {
    try {
      $('#clock').text(new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Canary' }).format(new Date()));
    } catch (e) { /* old browser */ }
  }
  tick();
  setInterval(tick, 30000);

  /* ---------------- Copy buttons ---------------- */
  $('.copy').on('click', function () {
    var $b = $(this);
    function done(msg) {
      $b.text(msg);
      setTimeout(function () { $b.text(dict[lang()]['ct.copy']); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String($b.data('copy'))).then(function () { done(t('copied')); }, function () { done(t('copyFail')); });
    } else {
      done(t('copyFail'));
    }
  });

  /* ---------------- Trayectoria: SQL filter ---------------- */
  var $chips = $('.fchip');
  var $recs = $('#recs .rec');
  var $code = $('#query');
  var typing = null;

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }

  function buildQuery(tags) {
    var s = t('sql');
    var q = [
      '<span class="kw">SELECT</span> ' + s.cols,
      '<span class="kw">FROM</span> ' + s.table
    ];
    if (tags.length) {
      q.push('<span class="kw">WHERE</span> stack @&gt; <span class="str">\'{' + esc(tags.join(',')) + '}\'</span>');
    }
    q.push('<span class="kw">ORDER BY</span> ' + s.order + ' <span class="kw">DESC</span>;');
    return q.join('\n');
  }

  function typeQuery(html, instant) {
    clearInterval(typing);
    if (reduce || instant) { $code.html(html + '<span class="caret"></span>'); return; }
    var tokens = html.match(/<[^>]+>|&[a-z]+;|[\s\S]/g);
    var i = 0, out = '';
    typing = setInterval(function () {
      for (var step = 0; step < 3 && i < tokens.length; step++) {
        out += tokens[i++];
        while (i < tokens.length && tokens[i].charAt(0) === '<') { out += tokens[i++]; }
      }
      $code.html(out + '<span class="caret"></span>');
      if (i >= tokens.length) { clearInterval(typing); }
    }, 16);
  }

  // instant: redraw without typing or touching open/closed rows (first load, language change)
  function apply(instant) {
    var tags = $chips.filter('.active').map(function () { return $(this).data('tag'); }).get();
    var count = 0;

    $recs.each(function () {
      var $r = $(this);
      var have = String($r.data('tags')).split(' ');
      var ok = tags.every(function (tg) { return have.indexOf(tg) > -1; });
      if (ok) { count++; }
      $r.toggleClass('is-match', tags.length > 0 && ok).toggleClass('is-out', !ok);

      if (tags.length && !instant) {
        var c = bootstrap.Collapse.getOrCreateInstance($r.find('.collapse')[0], { toggle: false });
        if (ok) { c.show(); } else { c.hide(); }
      }
    });

    $('#count').text(count);
    $('#count-word').text(count === 1 ? t('row') : t('rows'));
    $('#empty').prop('hidden', count > 0);
    $('#reset').prop('hidden', tags.length === 0);
    typeQuery(buildQuery(tags), instant);
  }

  $chips.on('click', function () {
    var on = !$(this).hasClass('active');
    $(this).toggleClass('active', on).attr('aria-pressed', on);
    apply(false);
  });
  $('#reset').on('click', function () {
    $chips.removeClass('active').attr('aria-pressed', 'false');
    apply(false);
    $chips.first().trigger('focus');
  });

  /* ---------------- Hero: drifting schema graph ----------------
     Small squares (tables) joined by elbow lines (relations) when close. */
  var canvas = document.getElementById('net');
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;
  var w = 0, h = 0, nodes = [], mx = -1e4, my = -1e4, raf = 0, visible = true;
  var LINK = 150, POINT = 190, rgb = '242,207,59';

  function readAccent() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
    if (v) { rgb = v.replace(/\s/g, ''); }
    draw();
  }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(64, Math.max(20, w * h / 22000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.26, vy: (Math.random() - 0.5) * 0.26,
        s: Math.random() * 2 + 2, key: i % 8 === 0
      });
    }
    draw();
  }

  function draw() {
    if (!w) { return; }
    ctx.clearRect(0, 0, w, h);
    var i, j, a, b, dx, dy, d;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.2 * (1 - d / LINK)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      dx = a.x - mx; dy = a.y - my; d = Math.sqrt(dx * dx + dy * dy);
      if (d < POINT) {
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.5 * (1 - d / POINT)).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
      }
    }
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      ctx.fillStyle = 'rgba(' + rgb + ',' + (a.key ? 0.95 : 0.5) + ')';
      var s = a.key ? a.s + 2 : a.s;
      ctx.fillRect(a.x - s / 2, a.y - s / 2, s, s);
      if (a.key) {
        ctx.strokeStyle = 'rgba(' + rgb + ',.35)';
        ctx.strokeRect(a.x - s / 2 - 5, a.y - s / 2 - 5, s + 10, s + 10);
      }
    }
  }

  function step() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]; n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) { n.vx *= -1; }
      if (n.y < 0 || n.y > h) { n.vy *= -1; }
    }
    draw();
    raf = visible ? requestAnimationFrame(step) : 0;
  }

  /* ---------------- Start ---------------- */
  applyLang(lang());   // also paints the theme toggle and the query

  size();
  readAccent();
  $(window).on('resize', size);
  if (!reduce) {
    $(hero).on('pointermove', function (e) {
      var r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
    }).on('pointerleave', function () { mx = my = -1e4; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !raf) { raf = requestAnimationFrame(step); }
      }).observe(hero);
    }
    raf = requestAnimationFrame(step);
  }
})(jQuery);
