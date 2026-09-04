/* TeacherSwap 2.0 — Centralized Navigation
 * Populates the #sidebar and #mobile-bottom-nav containers on every app
 * page so the navigation stays consistent across the platform.
 * Load after js/api.js and js/i18n.js, before js/app.js.
 */
(function () {
  'use strict';

  var page = (window.location.pathname.split('/').pop() || 'dashboard.html').split('?')[0];

  var SIDEBAR_MAIN = [
    { href: 'dashboard.html',        icon: 'fa-th-large',       label: 'Dashboard' },
    { href: 'find-match.html',       icon: 'fa-search',         label: 'Find Teachers' },
    { href: 'matches.html',          icon: 'fa-heart',          label: 'My Matches' },
    { href: 'swap-requests.html',    icon: 'fa-exchange-alt',   label: 'Swap Requests' },
    { href: 'messages.html',         icon: 'fa-comments',       label: 'Messages' },
    { href: 'meetings.html',         icon: 'fa-calendar-check', label: 'Meetings' },
    { href: 'reviews.html',          icon: 'fa-star',           label: 'Reviews' },
    { href: 'community.html',        icon: 'fa-users',          label: 'Community' },
    { href: 'notifications.html',    icon: 'fa-bell',           label: 'Notifications' }
  ];

  var SIDEBAR_ACCOUNT = [
    { href: 'profile.html',          icon: 'fa-user',           label: 'My Profile' },
    { href: 'payment.html',          icon: 'fa-credit-card',    label: 'Payment' },
    { href: 'settings.html',         icon: 'fa-cog',            label: 'Settings' }
  ];

  var MOBILE_NAV = [
    { href: 'index.html',        icon: 'fa-home',           label: 'Home' },
    { href: 'find-match.html',   icon: 'fa-search',         label: 'Find' },
    { href: 'matches.html',      icon: 'fa-heart',          label: 'Matches' },
    { href: 'messages.html',     icon: 'fa-comments',       label: 'Messages' },
    { href: 'profile.html',      icon: 'fa-user',           label: 'Profile' }
  ];

  function isActive(href) {
    // exact match, or the current page is the target
    return page === href;
  }

  function linkHTML(item, extraClass) {
    var active = isActive(item.href) ? ' active' : '';
    return '<a href="' + item.href + '" class="' + (extraClass || '') + active + '">' +
      '<i class="fas ' + item.icon + '"></i> ' + item.label + '</a>';
  }

  function buildSidebar() {
    var user = null;
    try { user = window.api && api.getUser && api.getUser(); } catch (e) { user = null; }
    var isAdmin = !!user && user.role === 'admin';

    var html = '<div class="sidebar-menu">';
    html += '<div class="sidebar-label">Main Menu</div>';
    html += SIDEBAR_MAIN.map(function (it) { return linkHTML(it, 'sidebar-link'); }).join('');

    if (isAdmin) {
      html += '<div class="sidebar-label">Administration</div>';
      html += linkHTML({ href: 'admin.html', icon: 'fa-chart-line', label: 'Admin Dashboard' }, 'sidebar-link');
    }

    html += '<div class="sidebar-label">Account</div>';
    html += SIDEBAR_ACCOUNT.map(function (it) { return linkHTML(it, 'sidebar-link'); }).join('');
    html += '<a href="login.html" class="sidebar-link logout"><i class="fas fa-sign-out-alt"></i> Logout</a>';
    html += '</div>';
    return html;
  }

  function buildMobileNav() {
    return MOBILE_NAV.map(function (it) { return linkHTML(it, 'mobile-nav-item'); }).join('');
  }

  // Build a profile avatar menu in the top header (.nav-actions).
  function buildProfileMenu() {
    var user = null;
    try { user = window.api && api.getUser && api.getUser(); } catch (e) { user = null; }
    if (!user) return null;

    var initial = (user.fullName || user.email || 'U').trim().charAt(0).toUpperCase();
    var avatarSrc = (typeof window.resolveAssetUrl === 'function') ? window.resolveAssetUrl(user.avatar) : user.avatar;
    var avatar = user.avatar
      ? '<img src="' + escapeAttr(avatarSrc) + '" alt="' + escapeAttr(user.fullName || '') + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'ts-av-fallback-on\')">' +
        '<span class="ts-av-fallback">' + initial + '</span>'
      : '<span class="ts-av-fallback">' + initial + '</span>';

    var menu = document.createElement('div');
    menu.className = 'profile-menu';
    menu.innerHTML =
      '<button type="button" class="profile-menu-toggle" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">' +
        '<span class="profile-menu-avatar">' + avatar + '</span>' +
        '<i class="fas fa-chevron-down profile-menu-caret"></i>' +
      '</button>' +
      '<div class="profile-menu-dropdown" hidden>' +
        '<div class="profile-menu-head">' +
          '<span class="profile-menu-name">' + (user.fullName ? escapeAttr(user.fullName) : '') + '</span>' +
          '<span class="profile-menu-email">' + escapeAttr(user.email || '') + '</span>' +
        '</div>' +
        '<a href="profile.html" class="profile-menu-item"><i class="fas fa-user"></i> My Profile</a>' +
        '<a href="settings.html" class="profile-menu-item"><i class="fas fa-cog"></i> Settings</a>' +
        '<a href="login.html" class="profile-menu-item profile-menu-logout"><i class="fas fa-sign-out-alt"></i> Logout</a>' +
      '</div>';

    var toggle = menu.querySelector('.profile-menu-toggle');
    var dd = menu.querySelector('.profile-menu-dropdown');
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dd.hasAttribute('hidden');
      dd.hidden = open;
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    menu.querySelector('.profile-menu-logout').addEventListener('click', function (e) {
      if (window.api) { e.preventDefault(); api.logout(); }
    });
    document.addEventListener('click', function () { dd.hidden = true; });
    return menu;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.innerHTML = buildSidebar();

    var mobileNav = document.getElementById('mobile-bottom-nav');
    if (mobileNav) mobileNav.innerHTML = buildMobileNav();

    // Profile avatar menu in the header
    var actions = document.querySelector('.nav-actions');
    if (actions && !actions.querySelector('.profile-menu')) {
      var profileLink = actions.querySelector('a[href="profile.html"]');
      var menu = buildProfileMenu();
      if (menu) {
        if (profileLink && profileLink.parentNode === actions) {
          actions.replaceChild(menu, profileLink);
        } else {
          actions.appendChild(menu);
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
