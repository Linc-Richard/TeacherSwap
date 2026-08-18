// TeacherSwap API Client
function _resolveApiBase() {
  var origin = window.location.origin;
  var protocol = window.location.protocol;
  // file:// or null origin: server not serving this page — fallback to localhost
  if (!origin || origin === 'null' || protocol === 'file:') {
    return 'http://localhost:3000/api';
  }
  return origin + '/api';
}

var API_BASE = _resolveApiBase();

const api = {
  token: function() { return localStorage.getItem('ts-token'); },

  request: async function(method, path, body) {
    const opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.token();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(API_BASE + path, opts);
      var text;
      try { text = await res.text(); } catch(e) { text = ''; }
      var data;
      try { data = JSON.parse(text); } catch(e) { data = null; }
      if (!res.ok) {
        var msg = (data && data.error) ? data.error : 'Request failed';
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && /fetch|network/i.test(err.message)) {
        throw new Error('Unable to connect to TeacherSwap. Please check your connection and try again.');
      }
      throw err;
    }
  },

  get: function(path) { return this.request('GET', path); },
  post: function(path, body) { return this.request('POST', path, body); },
  put: function(path, body) { return this.request('PUT', path, body); },
  del: function(path) { return this.request('DELETE', path); },

  // Auth
  login: function(email, password) { return this.post('/auth/login', { email, password }); },
  register: function(data) { return this.post('/auth/register', data); },
  getProfile: async function() { var d = await this.get('/auth/me'); return d.user || d; },
  updateProfile: function(data) { return this.put('/auth/profile', data); },

  // Teachers
  getTeachers: async function() { var d = await this.get('/auth/teachers'); return d.teachers || []; },
  getTeacher: async function(id) { var d = await this.get('/auth/teachers/' + id); return d.teacher || d; },
  searchTeachers: async function(q) { var d = await this.get('/teachers/search?q=' + encodeURIComponent(q)); return d.teachers || []; },
  getTeacherByUsername: async function(username) { var d = await this.get('/teachers/by-username/' + encodeURIComponent(username)); return d.teacher || null; },
  checkUsername: async function(username) { var d = await this.post('/auth/check-username', { username: username }); return d; },
  updateUsername: function(username) { return this.put('/auth/username', { username: username }); },

  // Block / Report
  blockUser: function(userId) { return this.post('/users/' + encodeURIComponent(userId) + '/block'); },
  unblockUser: function(userId) { return this.del('/users/' + encodeURIComponent(userId) + '/block'); },
  getBlockedUsers: async function() { var d = await this.get('/users/blocked'); return d.blocked || []; },
  reportUser: function(data) { return this.post('/reports', data); },

  // Conversations (enhanced)
  startConversation: function(userId) { return this.post('/messages/conversation', { userId: userId }); },
  markConversationRead: function(conversationId) { return this.put('/messages/' + encodeURIComponent(conversationId) + '/read'); },

  // Schools
  getSchools: async function() { var d = await this.get('/schools'); return d.schools || []; },
  getMapSchools: async function() { var d = await this.get('/schools/map'); return d.schools || []; },
  getNearbySchools: async function(lat, lng, radius) { var d = await this.get('/schools/nearby?lat=' + lat + '&lng=' + lng + '&radius=' + (radius || 50)); return d.schools || []; },
  addSchool: function(data) { return this.post('/schools', data); },
  updateSchool: function(id, data) { return this.put('/schools/' + id, data); },
  deleteSchool: function(id) { return this.del('/schools/' + id); },

  // Swaps
  sendSwapRequest: function(toUserId, message) { return this.post('/swaps', { toUserId, message }); },
  getSwapRequests: async function() { var d = await this.get('/swaps'); return d.swaps || d.requests || []; },
  updateSwapRequest: function(id, status) { return this.put('/swaps/' + id, { status }); },

  // Reviews
  submitReview: function(data) { return this.post('/reviews', data); },
  getUserReviews: async function(userId) { var d = await this.get('/reviews/user/' + userId); return d; },
  flagReview: function(id) { return this.post('/reviews/' + id + '/flag'); },
  deleteReview: function(id) { return this.del('/reviews/' + id); },

  // Meetings
  createMeeting: function(data) { return this.post('/meetings', data); },
  getMeetings: async function() { var d = await this.get('/meetings'); return d.meetings || []; },
  updateMeeting: function(id, data) { return this.put('/meetings/' + id, data); },

  // Recommendations
  getRecommendations: async function() { var d = await this.get('/recommendations/recommendations'); return (d.recommendations || []).map(function(r) { var t = r.teacher || {}; t.score = r.score; t.badge = r.badge; t.explanation = r.explanation; t.mutualCompatibility = r.mutualCompatibility; return t; }); },
  getRecommendationHistory: async function() { var d = await this.get('/recommendations/history'); return d.history || []; },

  // Analytics
  getAnalyticsOverview: function() { return this.get('/analytics/overview'); },
  getAnalyticsCharts: function() { return this.get('/analytics/charts'); },
  getAnalyticsRecent: function() { return this.get('/analytics/recent'); },

  // 2FA
  setup2FA: function() { return this.post('/2fa/setup'); },
  verify2FA: function(token) { return this.post('/2fa/verify', { token }); },
  disable2FA: function() { return this.post('/2fa/disable'); },
  get2FAStatus: function() { return this.get('/2fa/status'); },

  // Regions / Districts
  getRegions: async function() { var d = await this.get('/schools/regions'); return d.regions || []; },
  getDistricts: async function() { var d = await this.get('/schools/districts'); return d.districts || []; },

  // Messages
  sendMessage: function(receiverId, content) { return this.post('/messages', { receiverId, content }); },
  getConversations: async function() { var d = await this.get('/messages'); return d.conversations || []; },
  getMessages: async function(conversationId) { var d = await this.get('/messages/' + encodeURIComponent(conversationId)); return d.messages || []; },
  markMessageRead: function(id) { return this.put('/messages/' + id + '/read'); },

  // Notifications
  getNotifications: async function() { var d = await this.get('/notifications'); return d.notifications || []; },
  getUnreadCount: async function() { var d = await this.get('/notifications'); return d.unreadCount || 0; },
  markNotificationRead: function(id) { return this.put('/notifications/' + id + '/read'); },
  markAllNotificationsRead: function() { return this.put('/notifications/read-all'); },

  // Password
  forgotPassword: function(email) { return this.post('/auth/password/forgot', { email }); },
  resetPassword: function(token, newPassword) { return this.post('/auth/password/reset', { token, newPassword }); },
  changePassword: function(currentPassword, newPassword) { return this.post('/auth/password/change-password', { currentPassword, newPassword }); },

  // Favorites
  addFavorite: function(targetUserId) { return this.post('/favorites', { targetUserId }); },
  getFavorites: async function() { var d = await this.get('/favorites'); return d.favorites || []; },
  checkFavorite: async function(targetUserId) { var d = await this.get('/favorites/check/' + targetUserId); return d.favorited || false; },
  removeFavorite: function(targetUserId) { return this.del('/favorites/' + targetUserId); },

  // Payments / Subscriptions
  getPlans: async function() { var d = await this.get('/plans'); return d.plans || []; },
  getPaymentMethods: async function() { var d = await this.get('/payment-methods'); return d.methods || []; },
  submitPayment: function(data) { return this.post('/payments/submit', data); },
  getPaymentHistory: async function() { var d = await this.get('/payments/history'); return d.payments || []; },
  getSubscriptionStatus: async function() { return this.get('/subscription/status'); },

  // Admin: Plans
  adminGetPlans: async function() { var d = await this.get('/admin/plans'); return d.plans || []; },
  adminCreatePlan: function(data) { return this.post('/admin/plans', data); },
  adminUpdatePlan: function(id, data) { return this.put('/admin/plans/' + id, data); },
  adminDeletePlan: function(id) { return this.del('/admin/plans/' + id); },

  // Admin: Payment Methods
  adminGetPaymentMethods: async function() { var d = await this.get('/admin/payment-methods'); return d.methods || []; },
  adminCreatePaymentMethod: function(data) { return this.post('/admin/payment-methods', data); },
  adminUpdatePaymentMethod: function(id, data) { return this.put('/admin/payment-methods/' + id, data); },
  adminDeletePaymentMethod: function(id) { return this.del('/admin/payment-methods/' + id); },

  // Admin: Payments
  adminGetPayments: async function(status) { var d = await this.get('/admin/payments' + (status ? '?status=' + status : '')); return d.payments || []; },
  adminVerifyPayment: function(id) { return this.put('/admin/payments/' + id + '/verify'); },
  adminRejectPayment: function(id, reason) { return this.put('/admin/payments/' + id + '/reject', { reason: reason || '' }); },
  adminFailPayment: function(id) { return this.put('/admin/payments/' + id + '/fail'); },
  adminGetPaymentOverview: function() { return this.get('/admin/payments/overview'); },

  // Logout
  logout: function() {
    localStorage.removeItem('ts-token');
    localStorage.removeItem('ts-user');
    window.location.href = 'login.html';
  },

  // Utility
  isLoggedIn: function() { return !!this.token(); },

  getUser: function() {
    try { return JSON.parse(localStorage.getItem('ts-user') || '{}'); }
    catch(e) { return {}; }
  },

  saveUser: function(user) {
    localStorage.setItem('ts-user', JSON.stringify(user));
  }
};
