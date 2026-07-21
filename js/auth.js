/**
 * auth.js - Official System Authentication & Navigation Manager
 * Handles Admin session state, officer authorization, protected routes,
 * and header navigation rendering across all pages.
 */

const auth = {
  SESSION_KEY: 'adminAuthed',

  isAdmin: function() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  },

  login: function(password) {
    const settings = (window.db && window.db.getSettings) ? window.db.getSettings() : { adminPassword: 'admin' };
    const targetPass = settings.adminPassword || 'admin';
    if (password === targetPass) {
      sessionStorage.setItem(this.SESSION_KEY, 'true');
      this.showToast('เข้าสู่ระบบสิทธิ์เจ้าหน้าที่สำเร็จ', 'success');
      this.updateNavUI();
      return true;
    }
    return false;
  },

  logout: function(redirectAfter = false) {
    sessionStorage.removeItem(this.SESSION_KEY);
    this.showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['profiles.html', 'management.html'];

    this.updateNavUI();

    if (protectedPages.includes(currentPage)) {
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) {
        loginOverlay.classList.remove('hidden');
        loginOverlay.style.display = 'flex';
      } else {
        window.location.href = 'index.html';
      }
    } else if (redirectAfter) {
      window.location.href = 'index.html';
    }
  },

  checkPageAccess: function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['profiles.html', 'management.html'];
    const loginOverlay = document.getElementById('loginOverlay');

    if (protectedPages.includes(currentPage)) {
      if (!this.isAdmin()) {
        if (loginOverlay) {
          loginOverlay.classList.remove('hidden');
          loginOverlay.style.display = 'flex';
        }
        return false;
      } else {
        if (loginOverlay) {
          loginOverlay.classList.add('hidden');
          loginOverlay.style.display = 'none';
        }
        return true;
      }
    }
    return true;
  },

  updateNavUI: function() {
    const nav = document.querySelector('header nav');
    if (!nav) return;

    // Highlight current active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const links = nav.querySelectorAll('a');
    
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'index.html')) {
        a.className = 'px-3.5 py-1.5 rounded-lg bg-blue-700 text-white font-medium transition text-xs flex items-center gap-1.5';
      } else if (!a.classList.contains('nav-icon-only')) {
        a.className = 'px-3.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition font-medium text-xs flex items-center gap-1.5';
      }
    });

    // Remove existing auth container in nav
    let authContainer = document.getElementById('navAuthContainer');
    if (!authContainer) {
      authContainer = document.createElement('div');
      authContainer.id = 'navAuthContainer';
      authContainer.className = 'flex items-center gap-2 ml-auto pl-3 border-l border-slate-700';
      nav.appendChild(authContainer);
    }

    const authed = this.isAdmin();
    if (authed) {
      authContainer.innerHTML = `
        <span class="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          เจ้าหน้าที่ (Admin)
        </span>
        <button onclick="auth.logout()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 border border-slate-700 font-medium text-xs transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      `;
    } else {
      authContainer.innerHTML = `
        <button onclick="auth.openLoginModal()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <span>เข้าสู่ระบบเจ้าหน้าที่</span>
        </button>
      `;
    }
  },

  openLoginModal: function() {
    let overlay = document.getElementById('loginOverlay');
    if (!overlay) {
      this.createGlobalLoginModal();
      overlay = document.getElementById('loginOverlay');
    }
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      const input = document.getElementById('adminPass');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  },

  closeLoginModal: function() {
    const overlay = document.getElementById('loginOverlay');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['profiles.html', 'management.html'];

    if (protectedPages.includes(currentPage) && !this.isAdmin()) {
      window.location.href = 'index.html';
      return;
    }

    if (overlay) {
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
    }
  },

  createGlobalLoginModal: function() {
    if (document.getElementById('loginOverlay')) return;

    const modalHtml = `
      <div id="loginOverlay" class="fixed inset-0 z-[999] bg-slate-950/75 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-white p-6 md:p-8 rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl space-y-5 relative">
          <button onclick="auth.closeLoginModal()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
          
          <div class="text-center space-y-2">
            <div class="bg-slate-100 p-3 rounded-full text-slate-700 inline-block border border-slate-200">
              <svg class="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h2 class="text-base font-bold text-slate-900">เข้าสู่ระบบการยืนยันสิทธิ์เจ้าหน้าที่</h2>
            <p class="text-xs text-slate-500 leading-relaxed">กรุณาระบุรหัสผ่านเพื่อสืบค้นระเบียนข้อมูลและบริหารจัดการระบบ</p>
          </div>

          <form id="globalLoginForm" onsubmit="auth.handleLoginSubmit(event)" class="space-y-4">
            <div>
              <label for="adminPass" class="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">รหัสผ่านสำหรับเจ้าหน้าที่ *</label>
              <input type="password" id="adminPass" required placeholder="ป้อนรหัสผ่าน..." class="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-blue-600 font-bold text-center tracking-wider bg-white">
            </div>
            <div id="loginError" class="text-xs text-rose-600 font-semibold text-center hidden">รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูล</div>
            <button type="submit" class="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-sm">
              ยืนยันการเข้าสู่ระบบ
            </button>
          </form>
          <div class="text-[11px] text-center text-slate-400">รหัสผ่านเริ่มต้นระบบคือ <strong class="text-slate-600">admin</strong></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  handleLoginSubmit: function(e) {
    e.preventDefault();
    const passInput = document.getElementById('adminPass');
    const errorEl = document.getElementById('loginError');
    if (!passInput) return;

    if (this.login(passInput.value.trim())) {
      if (errorEl) errorEl.classList.add('hidden');
      const overlay = document.getElementById('loginOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
      }
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      if (currentPage === 'profiles.html' && typeof window.initProfiles === 'function') {
        window.initProfiles();
      } else if (currentPage === 'management.html' && typeof window.loadSettingsForm === 'function') {
        window.loadSettingsForm();
      }
    } else {
      if (errorEl) errorEl.classList.remove('hidden');
      passInput.focus();
    }
  },

  showToast: function(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-slate-900 border-emerald-500 text-white' :
                    type === 'error' ? 'bg-slate-900 border-rose-500 text-white' :
                    'bg-slate-900 border-blue-500 text-white';

    toast.className = `${bgClass} border-l-4 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0`;
    toast.innerHTML = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  init: function() {
    this.createGlobalLoginModal();
    this.checkPageAccess();
    this.updateNavUI();
  }
};

window.auth = auth;
window.logoutAdmin = function() { auth.logout(); };

document.addEventListener('DOMContentLoaded', () => {
  auth.init();
});
