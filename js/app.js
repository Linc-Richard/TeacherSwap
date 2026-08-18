(function() {
  'use strict';

  // ============================
  // DOM READY
  // ============================
  document.addEventListener('DOMContentLoaded', () => {

    // ============================
    // LOADING SCREEN
    // ============================
    const loader = document.getElementById('loader');
    if (loader) {
      window.addEventListener('load', () => {
        setTimeout(() => { loader.classList.add('hidden'); }, 600);
      });
      setTimeout(() => {
        if (!loader.classList.contains('hidden')) loader.classList.add('hidden');
      }, 3000);
    }

    // ============================
    // DARK / LIGHT MODE
    // ============================
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    function getTheme() {
      return localStorage.getItem('ts-theme') || 'light';
    }

    function setTheme(theme) {
      const body = document.body;
      if (theme === 'dark') {
        body.classList.add('dark-mode');
        if (themeIcon) { themeIcon.className = 'fas fa-sun'; }
      } else {
        body.classList.remove('dark-mode');
        if (themeIcon) { themeIcon.className = 'fas fa-moon'; }
      }
      localStorage.setItem('ts-theme', theme);
      document.querySelectorAll('#dark-mode-toggle').forEach(el => { el.checked = theme === 'dark'; });
    }

    setTheme(getTheme());

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTheme(getTheme());
    });

    // ============================
    // SCROLL PROGRESS BAR
    // ============================
    (function() {
      const bar = document.createElement('div');
      bar.id = 'scroll-progress';
      document.body.prepend(bar);
      window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
      });
    })();

    // ============================
    // MOBILE HAMBURGER
    // ============================
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('show');
      });
    }

    if (navLinks) {
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth < 1024) {
            hamburger?.classList.remove('active');
            navLinks.classList.remove('show');
          }
        });
      });
    }

    // ============================
    // SIDEBAR TOGGLE (mobile)
    // ============================
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('show');
      });
    }

    if (sidebarOverlay && sidebar) {
      sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.remove('show');
      });
    }

    if (sidebar) {
      sidebar.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth < 1024) {
            sidebar.classList.remove('show');
            if (sidebarOverlay) sidebarOverlay.classList.remove('show');
          }
        });
      });
    }

    // ============================
    // BACK TO TOP
    // ============================
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      window.addEventListener('scroll', () => {
        backToTop.classList.toggle('show', window.scrollY > 400);
      });
      backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // ============================
    // SMOOTH SCROLL
    // ============================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // ============================
    // SCROLL REVEAL (Intersection Observer)
    // ============================
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      revealElements.forEach(el => revealObserver.observe(el));
    }

    // ============================
    // NAVBAR SCROLL EFFECT
    // ============================
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
      });
    }

    // ============================
    // PARALLAX HERO (mouse move)
    // ============================
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const circles = hero.querySelectorAll('.gradient-1, .gradient-2');
        circles.forEach((el, i) => {
          const factor = (i + 1) * 20;
          el.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
        });
      });
    }

    // ============================
    // RIPPLE EFFECT ON BUTTONS
    // ============================
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    });

    // ============================
    // TOAST NOTIFICATIONS
    // ============================
    window.showToast = function(message, type = 'info', duration = 4000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
      };
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
      }, duration);
    };

    // ============================
    // CONFETTI
    // ============================
    function fireConfetti(count) {
      count = count || 60;
      const colors = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
      for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const size = Math.random() * 8 + 4;
        const color = colors[Math.floor(Math.random() * colors.length)];
        piece.style.cssText =
          'left:' + (Math.random() * 100) + 'vw;' +
          'width:' + size + 'px;height:' + (size * 0.6) + 'px;' +
          'background:' + color + ';' +
          'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
          'animation-duration:' + (Math.random() * 2 + 2) + 's;' +
          'animation-delay:' + (Math.random() * 0.8) + 's;';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 4000);
      }
    }

    // ============================
    // ANIMATED COUNTERS
    // ============================
    function animateCounters() {
      document.querySelectorAll('.stat-number, .hero-stat-number').forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target')) || parseInt(counter.textContent.replace(/[^0-9]/g, ''));
        if (!target) return;
        const suffix = counter.textContent.replace(/[0-9]/g, '');
        let current = 0;
        const increment = Math.max(Math.ceil(target / 60), 1);
        const stepTime = Math.max(Math.floor(1500 / target), 16);

        function updateCounter() {
          current += increment;
          if (current > target) current = target;
          counter.textContent = current.toLocaleString() + suffix;
          if (current < target) setTimeout(updateCounter, stepTime);
        }
        updateCounter();
      });
    }

    const statsSection = document.querySelector('.stats-section') || document.querySelector('.hero');
    if (statsSection) {
      const statsObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              animateCounters();
              statsObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 }
      );
      statsObserver.observe(statsSection);
    }

    // ============================
    // FAQ ACCORDION
    // ============================
    document.querySelectorAll('.faq-question').forEach(question => {
      question.addEventListener('click', () => {
        const item = question.parentElement;
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(faq => faq.classList.remove('active'));
        if (!isActive) item.classList.add('active');
      });
    });

    // ============================
    // NOTIFICATION DROPDOWN
    // ============================
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
      });
      document.addEventListener('click', (e) => {
        if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
          notifDropdown.classList.remove('show');
        }
      });
    }

    // Pulse notification badge
    const notifBadge = document.querySelector('.notif-badge');
    if (notifBadge) {
      setInterval(() => {
        notifBadge.classList.toggle('pulse');
      }, 3000);
    }

    // ============================
    // PASSWORD TOGGLE
    // ============================
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const isPassword = input.getAttribute('type') === 'password';
        input.setAttribute('type', isPassword ? 'text' : 'password');
        const icon = btn.querySelector('i');
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      });
    });

    // ============================
    // FORM VALIDATION
    // ============================
    function validateField(input) {
      const errorEl = input.closest('.form-group')?.querySelector('.form-error');
      if (!errorEl) return true;
      let valid = true;
      let message = '';

      if (input.hasAttribute('required') && !input.value.trim()) {
        valid = false;
        message = __('This field is required');
      } else if (input.type === 'email' && input.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value.trim())) {
          valid = false;
          message = __('Please enter a valid email');
        }
      } else if (input.type === 'password' && input.value.trim()) {
        if (input.value.length < 6) {
          valid = false;
          message = __('Password must be at least 6 characters');
        }
      } else if (input.id === 'confirm-password') {
        const password = document.getElementById('reg-password');
        if (password && input.value !== password.value) {
          valid = false;
          message = __('Passwords do not match');
        }
      }

      if (!valid) {
        input.classList.add('error');
        input.classList.add('shake');
        errorEl.textContent = message;
        setTimeout(() => input.classList.remove('shake'), 500);
      } else {
        input.classList.remove('error');
        errorEl.textContent = '';
      }
      return valid;
    }

    document.querySelectorAll('.form-control').forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) validateField(input);
      });
    });

    // ============================
    // AUTO-GROW TEXTAREA
    // ============================
    document.querySelectorAll('textarea').forEach(ta => {
      ta.classList.add('auto-grow');
      ta.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
    });

    // ============================
    // MULTI-STEP REGISTRATION
    // ============================
    let currentStep = 1;
    const totalSteps = 4;

    function updateStep(step) {
      document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
      const currentEl = document.getElementById('step-' + step);
      if (currentEl) currentEl.classList.add('active');

      document.querySelectorAll('.progress-step').forEach((el, index) => {
        const stepNum = index + 1;
        el.classList.remove('active', 'completed');
        if (stepNum === step) el.classList.add('active');
        else if (stepNum < step) el.classList.add('completed');
      });

      const prevBtn = document.getElementById('prev-step');
      const nextBtn = document.getElementById('next-step');
      const submitBtn = document.getElementById('submit-reg');

      if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
      if (nextBtn) nextBtn.style.display = step === totalSteps ? 'none' : 'inline-flex';
      if (submitBtn) submitBtn.style.display = step === totalSteps ? 'inline-flex' : 'none';
    }

    function validateStep(step) {
      const currentEl = document.getElementById('step-' + step);
      if (!currentEl) return true;
      let valid = true;
      currentEl.querySelectorAll('.form-control').forEach(input => {
        if (!validateField(input)) valid = false;
      });
      return valid;
    }

    // Expose registration helpers to register.html's inline submit handler
    window.validateStep = validateStep;
    window.fireConfetti = fireConfetti;
    Object.defineProperty(window, 'currentStep', { get: () => currentStep });

    const nextBtn = document.getElementById('next-step');
    const prevBtn = document.getElementById('prev-step');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
          if (currentStep < totalSteps) {
            currentStep++;
            updateStep(currentStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          showToast(__('Please fill all required fields'), 'error');
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          updateStep(currentStep);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    // NOTE: registration submission is handled by register.html's inline script,
    // which calls api.register() with the collected form data.

    // ============================
    // LOGOUT
    // ============================
    document.querySelectorAll('.sidebar-link.logout').forEach(link => {
      link.addEventListener('click', (e) => {
        if (typeof api !== 'undefined') {
          e.preventDefault();
          api.logout();
        }
      });
    });

    // ============================
    // COMMUNITY - POST LIKE
    // ============================
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        this.classList.toggle('liked');
        const icon = this.querySelector('i');
        if (this.classList.contains('liked')) {
          icon.className = 'fas fa-heart';
        } else {
          icon.className = 'far fa-heart';
        }
        const countEl = this.querySelector('.like-count');
        if (countEl) {
          let count = parseInt(countEl.textContent);
          countEl.textContent = this.classList.contains('liked') ? count + 1 : count - 1;
        }
      });
    });

    // ============================
    // PAYMENT - SELECT METHOD
    // ============================
    document.querySelectorAll('.payment-method').forEach(method => {
      method.addEventListener('click', function() {
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
        this.classList.add('selected');
        showToast(__('Selected:') + ' ' + this.querySelector('span').textContent, 'info');
      });
    });

    // ============================
    // SETTINGS TABS
    // ============================
    document.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', function() {
        const target = this.getAttribute('data-target');
        if (!target) return;
        document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(target);
        if (targetSection) {
          targetSection.classList.add('active');
          targetSection.style.animation = 'none';
          setTimeout(() => { targetSection.style.animation = 'fadeIn 0.4s ease'; }, 10);
        }
      });
    });

    // ============================
    // SETTINGS - DARK MODE TOGGLE
    // ============================
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
      darkModeToggle.checked = getTheme() === 'dark';
      darkModeToggle.addEventListener('change', () => {
        setTheme(darkModeToggle.checked ? 'dark' : 'light');
      });
    }

    // ============================
    // SETTINGS - DELETE ACCOUNT
    // ============================
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', () => {
        if (confirm(__('Are you sure you want to delete your account? This action cannot be undone.'))) {
          showToast(__('Account deletion requested'), 'warning');
        }
      });
    }

    // ============================
    // NEWSLETTER FORM
    // ============================
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = newsletterForm.querySelector('input');
        if (input && input.value.trim()) {
          showToast(__('Subscribed successfully! Welcome to TeacherSwap.'), 'success');
          input.value = '';
        }
      });
    }

    // ============================
    // ACTIVATE FIRST SETTINGS TAB
    // ============================
    const firstSettingsNav = document.querySelector('.settings-nav-item');
    if (firstSettingsNav && !document.querySelector('.settings-nav-item.active')) {
      firstSettingsNav.click();
    }

    // ============================
    // ACTIVE NAV LINK
    // ============================
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPage) link.classList.add('active');
    });

    // ============================
    // IMAGE UPLOAD PREVIEW (profile)
    // ============================
    document.querySelectorAll('.upload-preview input[type="file"]').forEach(input => {
      input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = this.closest('.upload-preview');
          if (preview) {
            preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
            preview.style.border = '3px solid var(--primary)';
          }
        };
        reader.readAsDataURL(file);
      });
    });

    // ============================
    // TOOLTIP INIT
    // ============================
    document.querySelectorAll('[data-tooltip]').forEach(el => {
      el.classList.add('tooltip');
    });

    // ============================
    // FLOATING PARTICLES SYSTEM
    // ============================
    const particlesContainer = document.getElementById('particles-container');
    if (particlesContainer) {
      var particleCount = 30;
      for (var i = 0; i < particleCount; i++) {
        var particle = document.createElement('div');
        particle.className = 'particle';
        var size = Math.random() * 4 + 2;
        var x = Math.random() * 100;
        var delay = Math.random() * 15;
        var duration = Math.random() * 10 + 15;
        var colors = ['var(--primary)', 'var(--accent)', 'var(--info)', 'var(--success)'];
        particle.style.cssText = 'left: ' + x + '%; width: ' + size + 'px; height: ' + size + 'px; background: ' + colors[Math.floor(Math.random() * colors.length)] + '; animation-delay: ' + delay + 's; animation-duration: ' + duration + 's;';
        particlesContainer.appendChild(particle);
      }
      for (var i = 0; i < 3; i++) {
        var circle = document.createElement('div');
        circle.className = 'particle-circle';
        var size = Math.random() * 100 + 80;
        var x = Math.random() * 100;
        var y = Math.random() * 100;
        var delay = Math.random() * 8;
        var duration = Math.random() * 6 + 8;
        circle.style.cssText = 'width: ' + size + 'px; height: ' + size + 'px; left: ' + x + '%; top: ' + y + '%; border-color: var(--primary); animation-delay: ' + delay + 's; animation-duration: ' + duration + 's;';
        particlesContainer.appendChild(circle);
      }
    }

    // ============================
    // MAGNETIC BUTTON EFFECT
    // ============================
    document.querySelectorAll('.magnetic-btn').forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        var rect = this.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        this.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
      });
      btn.addEventListener('mouseleave', function() {
        this.style.transform = 'translate(0, 0)';
      });
    });



    /* ----- Language handled by js/i18n.js ----- */

    /* ----- Payment Method Switching ----- */
    var payMethods = document.querySelectorAll('#payment-methods .payment-method');
    payMethods.forEach(function(m) {
      m.addEventListener('click', function() {
        payMethods.forEach(function(p) { p.classList.remove('selected'); });
        this.classList.add('selected');
        var method = this.getAttribute('data-method');
        document.querySelectorAll('.payment-dynamic-form').forEach(function(f) { f.style.display = 'none'; });
        var target = document.getElementById('form-' + method);
        if (target) target.style.display = 'block';
      });
    });

    /* ----- Payment Submit (handled by payment.html) ----- */

    /* ----- Mobile Bottom Nav Active State ----- */
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.mobile-nav-item').forEach(function(link) {
      var href = link.getAttribute('href');
      if (href === currentPath) link.classList.add('active');
    });

    console.log('TeacherSwap initialized successfully!');
  });
})();
