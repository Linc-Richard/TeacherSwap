// TeacherSwap notifications loader (shared by dashboard.html, find-match.html)
document.addEventListener('DOMContentLoaded', function() {
  if (typeof api === 'undefined' || !api.isLoggedIn()) return;

  var badge = document.querySelector('.notif-badge');
  var list = document.querySelector('.notif-dropdown-list');
  var markAll = document.querySelector('.notif-dropdown-header a[href="#"]');
  if (!badge && !list) return;

  function iconFor(type) {
    var map = {
      swap_request: ['blue', 'fa-handshake'],
      swap_accepted: ['green', 'fa-check-circle'],
      message: ['green', 'fa-comments'],
      meeting: ['purple', 'fa-calendar-check'],
      review: ['yellow', 'fa-star'],
      new_match: ['blue', 'fa-robot']
    };
    var m = map[type] || ['blue', 'fa-bell'];
    return '<div class="notification-icon ' + m[0] + '"><i class="fas ' + m[1] + '"></i></div>';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var then = new Date(iso.replace(' ', 'T')).getTime();
    if (isNaN(then)) return '';
    var sec = Math.floor((Date.now() - then) / 1000);
    if (sec < 60) return __('just now');
    if (sec < 3600) return Math.floor(sec / 60) + 'm';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h';
    return Math.floor(sec / 86400) + 'd';
  }

  async function load() {
    try {
      var data = await api.getNotifications();
      var notifications = data || [];
      var unread = notifications.filter(function(n) { return !n.isRead; }).length;
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'inline-flex' : 'none';
      }
      if (list) {
        if (!notifications.length) {
          list.innerHTML = '<div class="notif-dropdown-item"><div><p style="font-size:0.85rem;line-height:1.4;">' + __('No notifications yet') + '</p></div></div>';
        } else {
          list.innerHTML = notifications.slice(0, 10).map(function(n) {
            var cls = n.isRead ? '' : ' style="background:rgba(37,99,235,0.06);"';
            return '<div class="notif-dropdown-item"' + cls + ' data-id="' + n.id + '">' + iconFor(n.type) +
              '<div><p style="font-size:0.85rem;line-height:1.4;">' + (n.body || n.title || '') + '</p><span style="font-size:0.75rem;color:var(--text-muted);">' + timeAgo(n.createdAt) + '</span></div></div>';
          }).join('');
          list.querySelectorAll('.notif-dropdown-item[data-id]').forEach(function(item) {
            item.addEventListener('click', function() {
              var id = this.getAttribute('data-id');
              api.markNotificationRead(id).catch(function() {});
              var notif = notifications.filter(function(n) { return n.id === id; })[0];
              if (notif && notif.link) window.location.href = notif.link;
            });
          });
        }
      }
    } catch(e) {}
  }

  if (markAll) {
    markAll.addEventListener('click', function(e) {
      e.preventDefault();
      api.markAllNotificationsRead().then(function() { load(); }).catch(function() {});
    });
  }

  load();
});
