// TeacherSwap Google Sign-In — Redirect flow (no popup, no window.opener).
//
// The "Continue with Google" button simply redirects the browser to
// GET /api/auth/google, which sends the user to Google's consent screen.
// After authentication Google redirects back to the callback endpoint on
// the backend, which verifies the code server-side and redirects to
// login.html with the JWT in query parameters.
//
// This module renders the button and handles the callback parameters.

var googleAuth = {
  configured: false,

  // Fetch auth config from the backend and render the button.
  init: function(elementId, onReady) {
    var self = this;
    var el = document.getElementById(elementId);
    if (!el) return;

    api.getAuthConfig().then(function(cfg) {
      cfg = cfg || {};
      self.configured = !!(cfg.googleConfigured && cfg.googleClientId);

      if (!self.configured) {
        el.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;margin:0;">' +
          'Google sign-in is not configured yet. Please sign in with your email and password.</p>';
        return;
      }

      // Render a styled button that redirects to the backend OAuth flow.
      el.innerHTML = '';
      var btn = document.createElement('a');
      btn.href = '/api/auth/google';
      btn.className = 'google-signin-btn';
      btn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px 16px;border:1px solid #dadce0;border-radius:8px;background:#fff;color:#3c4043;font-size:0.9rem;font-weight:500;text-decoration:none;cursor:pointer;transition:background 0.2s,box-shadow 0.2s;font-family:Poppins,sans-serif;';
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg> Continue with Google';
      btn.onmouseenter = function() { btn.style.background = '#f8f9fa'; btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; };
      btn.onmouseleave = function() { btn.style.background = '#fff'; btn.style.boxShadow = 'none'; };
      el.appendChild(btn);

      if (onReady) onReady(self.configured);
    }).catch(function() {
      el.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;margin:0;">Google sign-in is currently unavailable.</p>';
    });
  },

  // Check if we returned from Google OAuth with a token in the URL.
  // login.html calls this on page load to handle the redirect callback.
  handleCallback: function() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('google_token');
    var userStr = params.get('google_user');
    var error = params.get('error');

    // Clean the URL (remove the parameters)
    if (token || error) {
      var clean = window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    }

    if (error) {
      var messages = {
        no_code: 'Google sign-in was cancelled or failed.',
        state_mismatch: 'Google sign-in failed: security check failed. Please try again.',
        google_auth_failed: 'Google authentication failed. Please try again.',
        invalid_token: 'Google account could not be verified. Please try again.'
      };
      return { error: messages[error] || 'Google sign-in failed. Please try again.' };
    }

    if (token && userStr) {
      try {
        var user = JSON.parse(userStr);
        return { token: token, user: user };
      } catch (e) {
        return { error: 'Failed to process Google sign-in data.' };
      }
    }

    return null;
  }
};

window.googleAuth = googleAuth;
