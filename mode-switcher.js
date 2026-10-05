/* ===================================================
   FLOATING MODE SWITCHER - LOGIC & INITIALIZER
   =================================================== */

(function () {
    // Mode Options matching user reference image Frame 1707480695.png
    const MODES = [
        { title: 'ระบบจัดการคิว คัดกรอง', file: 'index.html' },
        { title: 'ระบบจัดการคิว แพทย์', file: 'doctor.html' },
        { title: 'ระบบจองคิว ผู้ป่วย', file: 'mobile.html' },
        { title: 'ระบบ kios', file: 'kios.html' }
    ];

    function initModeSwitcher() {
        if (document.getElementById('floating-mode-container')) return;

        // Current page detection
        const path = window.location.pathname;
        const currentFile = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

        // Create Container
        const container = document.createElement('div');
        container.className = 'floating-mode-container';
        container.id = 'floating-mode-container';

        // Create Popup Menu
        const menu = document.createElement('div');
        menu.className = 'mode-popup-menu';
        menu.id = 'mode-popup-menu';

        MODES.forEach(mode => {
            const item = document.createElement('a');
            item.href = mode.file;
            item.className = 'mode-menu-item';
            item.textContent = mode.title;

            // Highlight current page
            if (currentFile === mode.file || (currentFile === '' && mode.file === 'index.html')) {
                item.classList.add('current-page');
            }

            menu.appendChild(item);
        });

        // Create Mode Button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-floating-mode';
        btn.id = 'btn-floating-mode';
        btn.setAttribute('aria-label', 'สลับโหมดการทำงาน');
        btn.textContent = 'Mode';

        // Toggle logic
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = menu.classList.toggle('show');
            btn.classList.toggle('active', isOpen);
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (!container.contains(e.target)) {
                menu.classList.remove('show');
                btn.classList.remove('active');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                menu.classList.remove('show');
                btn.classList.remove('active');
            }
        });

        container.appendChild(menu);
        container.appendChild(btn);
        document.body.appendChild(container);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModeSwitcher);
    } else {
        initModeSwitcher();
    }
})();
