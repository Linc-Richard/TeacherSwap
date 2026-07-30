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
        message = 'This field is required';
      } else if (input.type === 'email' && input.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value.trim())) {
          valid = false;
          message = 'Please enter a valid email';
        }
      } else if (input.type === 'password' && input.value.trim()) {
        if (input.value.length < 6) {
          valid = false;
          message = 'Password must be at least 6 characters';
        }
      } else if (input.id === 'confirm-password') {
        const password = document.getElementById('reg-password');
        if (password && input.value !== password.value) {
          valid = false;
          message = 'Passwords do not match';
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
    // LOGIN FORM
    // ============================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let allValid = true;
        loginForm.querySelectorAll('.form-control').forEach(input => {
          if (!validateField(input)) allValid = false;
        });
        if (allValid) {
          showToast('Login successful! Redirecting...', 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
        } else {
          showToast('Please fix the errors above', 'error');
        }
      });
    }

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
          showToast('Please fill all required fields', 'error');
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

    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateStep(currentStep)) {
          document.getElementById('registration-form-content').style.display = 'none';
          document.getElementById('registration-success').style.display = 'block';
          showToast('Registration successful! Welcome to TeacherSwap!', 'success');
          fireConfetti(80);
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 2500);
        } else {
          showToast('Please fill all required fields', 'error');
        }
      });
    }

    // ============================
    // FIND MATCH - SEARCH & FILTER
    // ============================
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const region = document.getElementById('filter-region')?.value;
        const subject = document.getElementById('filter-subject')?.value;
        const level = document.getElementById('filter-level')?.value;
        const district = document.getElementById('filter-district')?.value?.toLowerCase().trim();

        showToast('Searching teachers' + (region && region !== 'all' ? ' in ' + region : '') + '...', 'info');

        const teacherCards = document.querySelectorAll('.teacher-card');
        let visibleCount = 0;
        teacherCards.forEach(card => {
          let visible = true;
          if (region && region !== 'all') {
            const cr = card.getAttribute('data-region');
            if (cr && cr !== region) visible = false;
          }
          if (subject && subject !== 'all') {
            const cs = card.getAttribute('data-subjects');
            if (cs && !cs.includes(subject)) visible = false;
          }
          if (district) {
            const school = card.querySelector('.school-name')?.textContent?.toLowerCase() || '';
            const info = card.querySelector('.teacher-card-body')?.textContent?.toLowerCase() || '';
            if (!school.includes(district) && !info.includes(district)) visible = false;
          }
          card.style.display = visible ? '' : 'none';
          if (visible) visibleCount++;
        });

        const countEl = document.querySelector('.results-count strong');
        if (countEl) countEl.textContent = visibleCount;
      });
    }

    // ============================
    // FIND MATCH - DISTRICT AUTOCOMPLETE
    // ============================
    const districtInput = document.getElementById('filter-district');
    if (districtInput) {
      const districts = [
        'Arusha', 'Babati', 'Bagamoyo', 'Bukoba', 'Dar es Salaam', 'Dodoma', 'Geita',
        'Iringa', 'Kibaha', 'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara',
        'Mbeya', 'Morogoro', 'Moshi', 'Mtwara', 'Mwanza', 'Njombe', 'Pwani',
        'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga'
      ];

      const datalist = document.createElement('datalist');
      datalist.id = 'district-list';
      districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        datalist.appendChild(opt);
      });
      document.body.appendChild(datalist);
      districtInput.setAttribute('list', 'district-list');
    }

    // ============================
    // SORT TEACHER CARDS
    // ============================
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const container = document.querySelector('.teacher-grid');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.teacher-card'));
        const sortBy = sortSelect.value;
        cards.sort((a, b) => {
          if (sortBy === 'match') {
            return (parseInt(b.getAttribute('data-match') || '0')) - (parseInt(a.getAttribute('data-match') || '0'));
          }
          if (sortBy === 'newest') {
            return 0;
          }
          return 0;
        });
        cards.forEach(card => container.appendChild(card));
      });
    }

    // ============================
    // REQUEST SWAP MODAL
    // ============================
    const requestModal = document.getElementById('request-modal');
    const modalClose = document.getElementById('modal-close');
    const confirmSwap = document.getElementById('confirm-swap');

    document.querySelectorAll('.request-swap-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const card = this.closest('.teacher-card');
        if (card && requestModal) {
          const name = card.querySelector('h3')?.textContent || 'this teacher';
          const msg = requestModal.querySelector('textarea');
          if (msg) msg.placeholder = 'Hi ' + name + ', I noticed you want to swap...';
          requestModal.classList.add('show');
        }
      });
    });

    if (modalClose && requestModal) {
      modalClose.addEventListener('click', () => requestModal.classList.remove('show'));
      requestModal.addEventListener('click', (e) => {
        if (e.target === requestModal) requestModal.classList.remove('show');
      });
    }

    if (confirmSwap) {
      confirmSwap.addEventListener('click', () => {
        showToast('Swap request sent successfully!', 'success');
        if (requestModal) requestModal.classList.remove('show');
      });
    }

    // ============================
    // MESSAGES - SEND CHAT
    // ============================
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');

    function addMessage(text, type) {
      if (!chatMessages) return;
      const now = new Date();
      const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble ' + type;
      bubble.innerHTML = text + '<span class="msg-time">' + time + '</span>';
      chatMessages.appendChild(bubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (chatSend && chatInput) {
      chatSend.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessage(text, 'sent');
        chatInput.value = '';
        if (typingIndicator) typingIndicator.classList.add('show');
        setTimeout(() => {
          if (typingIndicator) typingIndicator.classList.remove('show');
          const replies = [
            "That sounds great! Let me check my schedule.",
            "I'd be happy to discuss the swap further.",
            "Can we talk more about the subjects you teach?",
            "I'm definitely interested in this exchange!",
            "Let me know when you're available to meet.",
            "Perfect! I've been looking for someone like you.",
            "Would you like to arrange a video call?"
          ];
          addMessage(replies[Math.floor(Math.random() * replies.length)], 'received');
        }, 2000);
      });

      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') chatSend.click();
      });
    }

    // Conversation switching
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.conversation-item').forEach(c => c.classList.remove('active'));
        item.classList.add('active');
        const name = item.getAttribute('data-name') || 'Teacher';
        const nameEl = document.getElementById('chat-name');
        if (nameEl) nameEl.textContent = name;
        if (chatMessages) {
          chatMessages.innerHTML = '';
          addMessage('Start your conversation with ' + name, 'received');
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
        showToast('Selected: ' + this.querySelector('span').textContent, 'info');
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
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
          showToast('Account deletion requested', 'warning');
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
          showToast('Subscribed successfully! Welcome to TeacherSwap.', 'success');
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

    // ============================
    // CHATBOT WIDGET
    // ============================
    var chatbotToggle = document.getElementById('chatbot-toggle');
    var chatbotWidget = document.getElementById('chatbot-widget');
    var chatbotClose = document.getElementById('chatbot-close');
    var chatbotMessages = document.getElementById('chatbot-messages');
    var chatbotInput = document.getElementById('chatbot-input');
    var chatbotSend = document.getElementById('chatbot-send');
    var chatbotTyping = document.getElementById('chatbot-typing');
    var chatbotUnread = document.getElementById('chatbot-unread');

    var faqAnswers = {
      'how': [
        'TeacherSwap connects teachers who want to exchange teaching stations across Tanzania. Here\'s how it works:<br><br>1. Create your free profile with your teaching details<br>2. Set your swap preferences (region, district, swap type)<br>3. Our AI matches you with compatible teachers<br>4. Chat with matches and arrange your swap!',
        'The process is simple! First, register and complete your teacher profile with your TSC number. Then tell us your preferred destination. Our matching algorithm will find teachers who want to swap to your current location!'
      ],
      'cost': [
        'TeacherSwap is free to join! We offer three plans:<br><br>• <b>Free</b>: Browse profiles, basic matching, 5 messages/month<br>• <b>Premium</b> (TSh 15,000/mo): Unlimited messages, priority matching, verified badge<br>• <b>Enterprise</b> (TSh 50,000/mo): For schools with bulk management',
        'Basic registration and matching are completely free. Premium features start at just TSh 15,000/month. You can upgrade anytime!'
      ],
      'verify': [
        'Every teacher on TeacherSwap is verified using their TSC (Teachers Service Commission) number. We cross-reference with the official TSC database to ensure all members are certified teaching professionals!',
        'We verify all teachers through the TSC database. Your TSC number is checked during registration, and your profile gets a verified badge once approved.'
      ],
      'match': [
        'Our Smart Matching algorithm considers<br>• Your current region and preferred destination<br>• Subjects you teach<br>• Teaching level and experience<br>• Swap type (permanent or temporary)<br><br>The more details you provide, the better your matches!',
        'Most teachers find a match within 1-2 weeks. Premium members get priority matching and typically find matches faster!'
      ],
      'safe': [
        'Absolutely! We take security very seriously:<br>• All teachers are TSC-verified<br>• Your personal data is encrypted<br>• You control what information is visible<br>• In-app messaging keeps conversations private',
        'Your safety is our priority. We use industry-standard encryption, verify all teachers, and provide secure in-app messaging.'
      ],
      'contact': [
        'You can reach us at:<br>• Email: hello@teacherswap.co.tz<br>• Phone: +255 712 345 678<br>• Office: Dar es Salaam, Tanzania<br><br>Available Monday-Friday, 8AM-5PM EAT.',
        'Feel free to contact our support team! We\'re based in Dar es Salaam and happy to help.'
      ],
      'hello': [
        'Hi there! Welcome to TeacherSwap! 👋<br><br>I can help you learn all about our platform. Ask me about:<br><br>• How does it work?<br>• Is it free?<br>• How are teachers verified?<br>• Safety & security<br>• Contact support',
        'Hello! Great to have you here! 🎉<br><br>Ask me anything about TeacherSwap - how it works, pricing, verification, or anything else!'
      ],
      'default': [
        'I\'m not sure I understand. Try asking about:<br><br>• How does TeacherSwap work?<br>• Is it free?<br>• How are teachers verified?<br>• How does matching work?<br>• Contact information',
        'I don\'t have an answer for that yet! Here are some things I can help with:<br><br>• How does TeacherSwap work?<br>• Pricing and plans<br>• Teacher verification<br>• Safety and security'
      ]
    };

    function getBotResponse(input) {
      var lower = input.toLowerCase().trim();
      if (lower.includes('how') && (lower.includes('work') || lower.includes('swap') || lower.includes('process'))) {
        return faqAnswers.how[Math.floor(Math.random() * faqAnswers.how.length)];
      }
      if (lower.includes('cost') || lower.includes('price') || lower.includes('free') || lower.includes('pay') || lower.includes('premium') || lower.includes('money') || lower.includes('fee')) {
        return faqAnswers.cost[Math.floor(Math.random() * faqAnswers.cost.length)];
      }
      if (lower.includes('verify') || lower.includes('tsc') || lower.includes('trust') || lower.includes('real') || lower.includes('legit')) {
        return faqAnswers.verify[Math.floor(Math.random() * faqAnswers.verify.length)];
      }
      if (lower.includes('match') || lower.includes('find') || lower.includes('search') || lower.includes('compatible') || lower.includes('algorithm')) {
        return faqAnswers.match[Math.floor(Math.random() * faqAnswers.match.length)];
      }
      if (lower.includes('safe') || lower.includes('secure') || lower.includes('privacy') || lower.includes('data') || lower.includes('protect')) {
        return faqAnswers.safe[Math.floor(Math.random() * faqAnswers.safe.length)];
      }
      if (lower.includes('contact') || lower.includes('support') || lower.includes('help') || lower.includes('email') || lower.includes('phone') || lower.includes('call') || lower.includes('reach')) {
        return faqAnswers.contact[Math.floor(Math.random() * faqAnswers.contact.length)];
      }
      if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('good') || lower.includes('morning') || lower.includes('evening')) {
        return faqAnswers.hello[Math.floor(Math.random() * faqAnswers.hello.length)];
      }
      return faqAnswers.default[Math.floor(Math.random() * faqAnswers.default.length)];
    }

    function addChatMessage(text, sender) {
      if (!chatbotMessages) return;
      var now = new Date();
      var time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      var msgDiv = document.createElement('div');
      msgDiv.className = 'chatbot-msg ' + sender;
      msgDiv.innerHTML = '<div class="msg-avatar"><i class="fas ' + (sender === 'bot' ? 'fa-robot' : 'fa-user') + '"></i></div><div><div class="msg-content">' + text + '</div><div class="msg-time">' + time + '</div></div>';
      chatbotMessages.appendChild(msgDiv);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    function sendChatMessage() {
      if (!chatbotInput || !chatbotSend) return;
      var text = chatbotInput.value.trim();
      if (!text) return;
      addChatMessage(text, 'user');
      chatbotInput.value = '';
      chatbotSend.disabled = true;
      if (chatbotTyping) chatbotTyping.classList.add('show');
      var quickActions = document.getElementById('chatbot-quick-actions');
      if (quickActions) quickActions.style.display = 'none';
      setTimeout(function() {
        if (chatbotTyping) chatbotTyping.classList.remove('show');
        var response = getBotResponse(text);
        addChatMessage(response, 'bot');
        chatbotSend.disabled = false;
      }, 1000 + Math.random() * 1500);
    }

    if (chatbotToggle && chatbotWidget) {
      chatbotToggle.addEventListener('click', function() {
        chatbotWidget.classList.toggle('open');
        if (chatbotUnread) chatbotUnread.style.display = 'none';
        if (!chatbotWidget.dataset.initialized) {
          chatbotWidget.dataset.initialized = 'true';
          setTimeout(function() { addChatMessage(faqAnswers.hello[0], 'bot'); }, 500);
        }
      });
    }

    if (chatbotClose && chatbotWidget) {
      chatbotClose.addEventListener('click', function() { chatbotWidget.classList.remove('open'); });
    }

    if (chatbotSend) {
      chatbotSend.addEventListener('click', sendChatMessage);
    }

    if (chatbotInput) {
      chatbotInput.addEventListener('input', function() {
        if (chatbotSend) chatbotSend.disabled = !this.value.trim();
      });
      chatbotInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendChatMessage();
      });
    }

    document.querySelectorAll('.chatbot-quick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var question = this.getAttribute('data-question') || this.textContent.trim();
        if (chatbotInput) {
          chatbotInput.value = question;
          sendChatMessage();
        }
      });
    });

    /* ----- Language Toggle (EN / SW) ----- */
    var translations = {
      en: {
        'Welcome Back': 'Welcome Back',
        'Sign in to continue your journey': 'Sign in to continue your journey',
        'Login': 'Login',
        'Email address': 'Email address',
        'Password': 'Password',
        'Remember me': 'Remember me',
        'Forgot password?': 'Forgot password?',
        'or continue with': 'or continue with',
        'Sign in with Google': 'Sign in with Google',
        "Don't have an account?": "Don't have an account?",
        'Sign up': 'Sign up',
        'Create Account': 'Create Account',
        'Join the teacher community in Tanzania': 'Join the teacher community in Tanzania',
        'Full Name': 'Full Name',
        'Phone number': 'Phone number',
        'Next': 'Next',
        'Previous': 'Previous',
        'Complete Registration': 'Complete Registration',
        'or sign up with': 'or sign up with',
        'Sign up with Google': 'Sign up with Google',
        'Already have an account?': 'Already have an account?',
        'Sign in': 'Sign in',
        'Find Teacher': 'Find Teacher',
        'Register Now': 'Register Now',
        'Register': 'Register',
        'Premium': 'Premium',
        'Payment Order': 'Payment Order',
        'Plan:': 'Plan:',
        'Amount:': 'Amount:',
        'Billing:': 'Billing:',
        'Monthly': 'Monthly',
        'Total Due:': 'Total Due:',
        'Select Payment Method': 'Select Payment Method',
        'Pay Now': 'Pay Now',
        'Payment successful!': 'Payment successful!',
        'Your payment has been processed successfully.': 'Your payment has been processed successfully.',
        'Search teachers, schools...': 'Search teachers, schools...'
      },
      sw: {
        'Welcome Back': 'Karibu Tena',
        'Sign in to continue your journey': 'Ingia ili kuendelea na safari yako',
        'Login': 'Ingia',
        'Email address': 'Barua pepe',
        'Password': 'Nywila',
        'Remember me': 'Nikumbuke',
        'Forgot password?': 'Umesahau nywila?',
        'or continue with': 'au endelea na',
        'Sign in with Google': 'Ingia kwa Google',
        "Don't have an account?": 'Huna akaunti?',
        'Sign up': 'Jisajili',
        'Create Account': 'Fungua Akaunti',
        'Join the teacher community in Tanzania': 'Jiunge na jumuiya ya walimu Tanzania',
        'Full Name': 'Jina Kamili',
        'Phone number': 'Namba ya simu',
        'Next': 'Ijayo',
        'Previous': 'Nyuma',
        'Complete Registration': 'Maliza Usajili',
        'or sign up with': 'au jisajili kwa',
        'Sign up with Google': 'Jisajili kwa Google',
        'Already have an account?': 'Tayari una akaunti?',
        'Sign in': 'Ingia',
        'Find Teacher': 'Tafuta Mwalimu',
        'Register Now': 'Jisajili Sasa',
        'Register': 'Jisajili',
        'Premium': 'Premium',
        'Payment Order': 'Agizo la Malipo',
        'Plan:': 'Mpango:',
        'Amount:': 'Kiasi:',
        'Billing:': 'Malipo:',
        'Monthly': 'Kila Mwezi',
        'Total Due:': 'Jumla:',
        'Select Payment Method': 'Chagua Njia ya Malipo',
        'Pay Now': 'Lipa Sasa',
        'Payment successful!': 'Malipo yamekamilika!',
        'Your payment has been processed successfully.': 'Malipo yako yamekubaliwa.',
        'Search teachers, schools...': 'Tafuta walimu, shule...'
      }
    };

    var currentLang = 'en';

    function applyLanguage(lang) {
      currentLang = lang;
      var t = translations[lang];
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
      });
      document.querySelectorAll('input[placeholder]').forEach(function(el) {
        var key = el.getAttribute('placeholder');
        if (key && t[key]) el.placeholder = t[key];
      });
      document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-title');
        if (t[key]) el.title = t[key];
      });
      try { localStorage.setItem('ts-lang', lang); } catch(e) {}
    }

    var langBtns = document.querySelectorAll('.lang-toggle-btn');
    langBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        langBtns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        applyLanguage(this.getAttribute('data-lang'));
      });
    });

    try {
      var savedLang = localStorage.getItem('ts-lang');
      if (savedLang === 'sw') {
        document.querySelector('.lang-toggle-btn[data-lang="sw"]').click();
      }
    } catch(e) {}

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

    /* ----- Payment Submit ----- */
    var payBtn = document.getElementById('pay-now-btn');
    if (payBtn) {
      payBtn.addEventListener('click', function() {
        showToast('success', translations[currentLang]['Payment successful!'], translations[currentLang]['Your payment has been processed successfully.']);
      });
    }

    /* ----- Mobile Bottom Nav Active State ----- */
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.mobile-nav-item').forEach(function(link) {
      var href = link.getAttribute('href');
      if (href === currentPath) link.classList.add('active');
    });

    console.log('TeacherSwap initialized successfully!');
  });
})();
