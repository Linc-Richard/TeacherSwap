/* ============================
   TeacherSwap - Avatar & User Helper
   Reusable avatar rendering across all pages.
   - Renders a real profile picture when present, otherwise initials in a colored circle.
   - Resolves root-relative /uploads paths on any host.
   ============================ */
(function () {
  'use strict';

  var AVATAR = {};

  var PALETTE = ['#7c3aed', '#6d28d9', '#2563eb', '#0d9488', '#e8710a', '#c026d3', '#d93025', '#0284c7', '#15803d'];

  // Build a deterministic color from a name
  function colorFrom(name) {
    var h = 0;
    var s = String(name || '?');
    for (var i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return PALETTE[Math.abs(h) % PALETTE.length];
  }

  // Extract 1-2 initials from a full name / email
  function initials(name) {
    var s = String(name || '?').trim();
    if (!s || s === '?') return '?';
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.substring(0, 2).toUpperCase();
  }

  // Build an absolute URL for root-relative uploads and API paths
  function resolveUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    if (!s) return '';
    // already absolute
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (s.charAt(0) === '/') {
      // Root-relative path (e.g. /uploads/...). Resolve against the API origin.
      try {
        return new URL(s, window.location.origin).href;
      } catch (e) {
        return s;
      }
    }
    return s;
  }

  // Escape text for HTML attribute/text safety
  function esc(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }

  /**
   * Render an avatar element.
   * @param {object} opts
   *   user:  { avatar, fullName }  (avatar may be path or empty)
   *   size:  px (default 44)
   *   class: extra class name(s)
   *   round: bool (default true, circular)
   * Returns an HTML string.
   */
  AVATAR.render = function (opts) {
    opts = opts || {};
    var user = opts.user || {};
    var size = opts.size || 44;
    var url = resolveUrl(user.avatar);
    var extra = opts['class'] ? ' ' + opts['class'] : '';
    var alt = esc(user.fullName || 'User');
    if (url) {
      return '<img class="ts-avatar' + extra + '" src="' + esc(url) + '" alt="' + alt + '"' +
        ' style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;' +
        (opts.border ? 'border:3px solid ' + opts.border + ';' : '') + '"' +
        ' onerror="this.outerHTML=\'' + esc(initialsEncoded(user, size, extra)) + '\'">';
    }
    return '<span class="ts-avatar-fallback' + extra + '" style="width:' + size + 'px;height:' + size + 'px;' +
      (opts.border ? 'border:3px solid ' + opts.border + ';' : '') +
      'background:' + colorFrom(user.fullName) + ';" aria-hidden="true">' + esc(initials(user.fullName)) + '</span>';
  };

  // Build a fallback span (inline, for the onerror attribute) safely
  function initialsEncoded(user, size, extra) {
    return '<span class="ts-avatar-fallback' + esc(extra) + '" style="width:' + size + 'px;height:' + size + 'px;background:' + colorFrom(user.fullName) + ';" aria-hidden="true">' + esc(initials(user.fullName)) + '</span>';
  }

  /**
   * All avatar variants rendered by one helper (charts/list items etc.)
   */
  AVATAR.initials = initials;
  AVATAR.colorFrom = colorFrom;
  AVATAR.resolveUrl = resolveUrl;
  AVATAR.esc = esc;

  // Expose globally so app.js / pages can use it
  window.avatarHelper = AVATAR;
  window.avatarInitials = initials;
  window.avatarColor = colorFrom;
})();
