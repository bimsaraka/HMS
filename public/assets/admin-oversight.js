/**
 * Pinnacle Bay Hotel Management System
 * Global Admin Return & Persistent Oversight Navigation Banner
 */
(function() {
  function initAdminOversight() {
    const currentPath = window.location.pathname.toLowerCase();
    
    // Do not show banner on the Admin Hub itself or the login page
    if (
      currentPath.endsWith('admin-dashboard.html') || 
      currentPath.endsWith('/admin') || 
      currentPath.endsWith('index.html') || 
      currentPath === '/'
    ) {
      return;
    }

    // Check user state from localStorage and sessionStorage
    let isAdmin = false;
    let userName = 'Administrator';
    try {
      const userRaw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        const role = (u.role || '').toLowerCase();
        if (role === 'admin' || role === 'administrator' || role === 'sysadmin') {
          isAdmin = true;
          if (u.name) userName = u.name;
        }
      }
      
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token && token.toLowerCase().includes('admin')) {
        isAdmin = true;
      }

      // Check URL search parameters (e.g., ?role=admin or ?from=admin)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('admin') === 'true' || urlParams.get('role') === 'admin' || urlParams.get('from') === 'admin') {
        isAdmin = true;
      }
    } catch (e) {
      console.error('[Admin Oversight] Error checking user state:', e);
    }

    // If not logged in as Admin, remove any existing banner and return
    if (!isAdmin) {
      const existing = document.getElementById('admin-oversight-bar');
      if (existing) existing.remove();
      return;
    }

    // Determine current department name
    let deptName = 'Observing Department View';
    if (currentPath.includes('reception') || document.title.toLowerCase().includes('reception')) {
      deptName = 'Observing Front Desk & Reservations';
    } else if (currentPath.includes('ops') || document.title.toLowerCase().includes('operation') || document.title.toLowerCase().includes('housekeeping')) {
      deptName = 'Observing Housekeeping & Operations';
    } else if (currentPath.includes('finance') || document.title.toLowerCase().includes('finance') || document.title.toLowerCase().includes('billing')) {
      deptName = 'Observing Finance & Billing';
    }

    // Check if banner already exists
    let banner = document.getElementById('admin-oversight-bar');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'admin-oversight-bar';
      banner.setAttribute('style', 'background: linear-gradient(90deg, #1e293b, #0f172a); border-bottom: 2px solid #d97706; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 99999; position: sticky; top: 0; width: 100%; box-sizing: border-box;');
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #f8fafc; font-size: 14px; font-weight: 500; font-family: 'Inter', -apple-system, sans-serif;">
          <span style="background: #d97706; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px;">ADMIN VIEW</span>
          <span id="admin-oversight-dept-text">${deptName}</span>
        </div>
        <button id="btn-back-to-admin" type="button" style="background: #d97706; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
          ← Back to Admin Hub
        </button>
      `;

      if (document.body) {
        document.body.prepend(banner);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          if (document.body && !document.getElementById('admin-oversight-bar')) {
            document.body.prepend(banner);
          }
        });
      }
    } else {
      const deptEl = document.getElementById('admin-oversight-dept-text');
      if (deptEl) deptEl.textContent = deptName;
    }

    // Attach click listener to Return button
    const backBtn = document.getElementById('btn-back-to-admin');
    if (backBtn) {
      backBtn.onclick = function(e) {
        e.preventDefault();
        window.location.href = 'admin-dashboard.html';
      };
      backBtn.onmouseover = function() { this.style.background = '#b45309'; };
      backBtn.onmouseout = function() { this.style.background = '#d97706'; };
    }

    // Update role badge in header if present
    const userRoleEl = document.querySelector('.user-role');
    if (userRoleEl && isAdmin) {
      userRoleEl.textContent = 'Administrator';
    }
  }

  // Run on initial script execution and on events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminOversight);
  } else {
    initAdminOversight();
  }

  window.addEventListener('pageshow', initAdminOversight);
  window.addEventListener('load', initAdminOversight);
})();
