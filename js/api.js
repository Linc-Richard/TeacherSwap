// TeacherSwap API Client
const API_BASE = window.location.origin + '/api';

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
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
