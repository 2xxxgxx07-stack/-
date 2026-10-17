/* ===================================================
   SMART HOSPITAL KIOSK - APPLICATION LOGIC
   Matching Reference UI & Touchscreen Workflow
   =================================================== */

let inputIdNumber = '';
let kiosQueueCounter = 45;
let isSoundMuted = false;
let currentLanguage = 'th';

// Department Prefix mapping
const KIOSK_DEPT_PREFIX = {
    'อายุรกรรม': 'M',
    'ทันตกรรม': 'D',
    'ศัลยกรรม': 'SR',
    'กุมารเวชกรรม': 'P',
    'จักษุวิทยา': 'E',
    'กระดูกและข้อ': 'O',
};

// ============ 1. LIVE DATETIME CLOCK ============
function initKiosClock() {
    const el = document.getElementById('kios-live-datetime');
    if (!el) return;

    function update() {
        const now = new Date();
        const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const thaiMonths = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;

        const dayName = thaiDays[now.getDay()];
        const day = now.getDate();
        const month = thaiMonths[now.getMonth()];
        const year = now.getFullYear() + 543;

        el.textContent = `${formattedHours}:${minutes} ${ampm} | ${dayName} ${day} ${month} ${year}`;
    }

    update();
    setInterval(update, 1000);
}

// ============ 2. SOUND SIMULATOR ============
function playKiosChime() {
    if (isSoundMuted) return Promise.resolve();
    return new Promise((resolve) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return resolve();
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            
            // Ding-Dong Chime (G5 -> C5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(783.99, now);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.3, now + 0.04);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.85);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(523.25, now + 0.35);
            gain2.gain.setValueAtTime(0, now + 0.35);
            gain2.gain.linearRampToValueAtTime(0.32, now + 0.38);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.35);
            osc2.stop(now + 1.25);

            setTimeout(resolve, 700);
        } catch (e) {
            resolve();
        }
    });
}

function toggleKiosSound() {
    isSoundMuted = !isSoundMuted;
    const btn = document.getElementById('btn-kios-sound');
    if (btn) {
        btn.innerHTML = isSoundMuted 
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    }
    showKiosToast(isSoundMuted ? '🔇 ปิดเสียงลำโพงตู้คีออสก์แล้ว' : '🔊 เปิดเสียงลำโพงตู้คีออสก์แล้ว');
}

function callNurseAlert() {
    playKiosChime();
    showKiosToast('🚨 แจ้งเตือนเจ้าหน้าที่พยาบาลเรียบร้อยแล้ว กำลังเดินทางมายังตู้บริการ');
}

// ============ 3. LANGUAGE SWITCHER ============
function switchLanguage(lang) {
    currentLanguage = lang;
    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(lang));
    });
    showKiosToast(lang === 'th' ? '🇹🇭 เปลี่ยนภาษาเป็น ภาษาไทย' : '🇬🇧 Switched language to English');
}

// ============ 4. APPOINTMENT CHECK-IN MODAL FLOW ============
function openAppointmentModal() {
    const modal = document.getElementById('modal-appointment-options');
    if (modal) modal.style.display = 'flex';
}

function closeAppointmentModal() {
    const modal = document.getElementById('modal-appointment-options');
    if (modal) modal.style.display = 'none';
}

// Timer for dispensed ticket auto-redirect
let ticketAutoRedirectTimer = null;
let ticketCountdownInterval = null;

function clearTicketRedirectTimer() {
    if (ticketAutoRedirectTimer) {
        clearTimeout(ticketAutoRedirectTimer);
        ticketAutoRedirectTimer = null;
    }
    if (ticketCountdownInterval) {
        clearInterval(ticketCountdownInterval);
        ticketCountdownInterval = null;
    }
}

let currentCardMode = 'walkin';
let cardSyncTimer = null;
let cardSyncInterval = null;

function clearCardSyncTimers() {
    if (cardSyncTimer) {
        clearTimeout(cardSyncTimer);
        cardSyncTimer = null;
    }
    if (cardSyncInterval) {
        clearInterval(cardSyncInterval);
        cardSyncInterval = null;
    }
}

let selectedWalkinRight = 'สิทธิประกันสุขภาพถ้วนหน้า (บัตรทอง 30 บาท)';
let selectedWalkinDept = 'อายุรกรรมทั่วไป';
let selectedWalkinDeptPrefix = 'A';
let selectedWalkinTime = '08:30 - 09:30 น.';

function showKiosCardView(mode = 'walkin') {
    currentCardMode = mode;
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';
    if (cardView) {
        cardView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    inputIdNumber = '';
    const nameEl = document.getElementById('service-patient-name');
    if (nameEl) nameEl.textContent = 'นายสมชาย ใจดี';
    const cidEl = document.getElementById('service-patient-cid');
    if (cidEl) cidEl.textContent = '1-1004-00xxx-xx-9';
    const hnEl = document.getElementById('service-patient-hn');
    if (hnEl) hnEl.textContent = '67-0498124';
    if (subbarBack) {
        subbarBack.style.display = 'flex';
        subbarBack.onclick = showKiosHomeView;
    }

    // Configure steps in id-card-step-bar
    const pill2Text = document.getElementById('id-card-step-2-text');
    const sep2 = document.getElementById('id-card-sep-2');
    const pill3 = document.getElementById('id-card-pill-3');
    const counter = document.getElementById('id-card-step-counter');

    if (mode === 'walkin') {
        if (pill2Text) pill2Text.textContent = '2. เลือกประเภทบริการ';
        if (sep2) sep2.style.display = 'inline';
        if (pill3) pill3.style.display = 'inline-flex';
        if (counter) counter.textContent = 'ขั้นตอนที่ 1 จาก 3';
    } else {
        if (pill2Text) pill2Text.textContent = '2. รับบัตรคิว';
        if (sep2) sep2.style.display = 'none';
        if (pill3) pill3.style.display = 'none';
        if (counter) counter.textContent = 'ขั้นตอนที่ 1 จาก 2';
    }

    // Toggle alternate QR bar (walk-in patients don't have appointment QR)
    const altQr = document.getElementById('id-card-alt-qr');
    if (altQr) {
        altQr.style.display = (mode === 'walkin') ? 'none' : 'flex';
    }
}

function showKiosCardSyncingView() {
    clearTicketRedirectTimer();
    clearCardSyncTimers();

    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (cardView) cardView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';

    if (syncView) {
        syncView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) subbarBack.style.display = 'none';

    // Reset progress and Item 2 status
    const progressBar = document.getElementById('syncing-progress-bar');
    const nhsoBadge = document.getElementById('sync-nhso-badge');

    if (progressBar) progressBar.style.width = '15%';
    if (nhsoBadge) {
        nhsoBadge.className = 'check-item-badge badge-pending';
        nhsoBadge.innerHTML = '<span class="pulse-dot">●</span><span>กำลังตรวจสอบ...</span>';
    }

    playKiosChime();

    // Smoothly animate progress bar from 15% to 95%
    let progress = 20;
    cardSyncInterval = setInterval(() => {
        progress += 15;
        if (progress > 95) progress = 95;
        if (progressBar) progressBar.style.width = progress + '%';
    }, 280);

    // After 2.0s, mark NHSO check as completed
    cardSyncTimer = setTimeout(() => {
        if (progressBar) progressBar.style.width = '100%';
        if (nhsoBadge) {
            nhsoBadge.className = 'check-item-badge badge-done';
            nhsoBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg><span>สำเร็จแล้ว</span>`;
        }

        // After completion, transition to Step 2: เลือกประเภทบริการ (หน้าตามภาพ)
        setTimeout(() => {
            clearCardSyncTimers();
            showKiosServiceSelectionView();
        }, 900);
    }, 2200);
}

function showKiosServiceSelectionView() {
    clearTicketRedirectTimer();
    clearCardSyncTimers();

    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (cardView) cardView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';

    if (serviceView) {
        serviceView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) {
        subbarBack.style.display = 'flex';
        subbarBack.onclick = () => showKiosCardView('walkin');
    }

    playKiosChime();
}

function selectServiceRight(element, rightName) {
    selectedWalkinRight = rightName;
    document.querySelectorAll('#rights-card-grid .service-choice-card').forEach(c => {
        c.classList.remove('selected');
        const link = c.querySelector('.rights-action-link span');
        if (link) link.textContent = 'แตะเพื่อเลือกสิทธินี้';
    });
    element.classList.add('selected');
    const activeLink = element.querySelector('.rights-action-link span');
    if (activeLink) activeLink.textContent = 'เลือกใช้สิทธินี้แล้ว';
}

function selectServiceDept(element, deptName, prefix) {
    selectedWalkinDept = deptName;
    selectedWalkinDeptPrefix = prefix || 'A';
    document.querySelectorAll('#dept-select-grid .service-choice-card').forEach(c => {
        c.classList.remove('selected');
        const iconWrap = c.querySelector('.dept-card-icon-wrap');
        if (iconWrap) {
            iconWrap.classList.remove('teal-bg');
            iconWrap.classList.add('soft-bg');
        }
    });
    element.classList.add('selected');
    const iconWrap = element.querySelector('.dept-card-icon-wrap');
    if (iconWrap) {
        iconWrap.classList.remove('soft-bg');
        iconWrap.classList.add('teal-bg');
    }
}

function selectServiceTime(element, timeStr) {
    selectedWalkinTime = timeStr;
    document.querySelectorAll('#time-slot-grid .service-choice-card').forEach(c => {
        c.classList.remove('selected');
        const badge = c.querySelector('.slot-period-badge');
        if (badge) {
            badge.classList.remove('dark');
            badge.classList.add('light');
        }
    });
    element.classList.add('selected');
    const badge = element.querySelector('.slot-period-badge');
    if (badge) {
        badge.classList.remove('light');
        badge.classList.add('dark');
    }
}

function confirmAndPrintWalkinServiceTicket() {
    showKiosToast('🖨️ กำลังพิมพ์บัตรคิวสำหรับผู้รับบริการ...');

    kiosQueueCounter++;
    const qNum = `${selectedWalkinDeptPrefix}${String(kiosQueueCounter).padStart(3, '0')}`;
    const isManualInput = (inputIdNumber && inputIdNumber.length === 13);
    const patientName = isManualInput ? 'คุณ ผู้รับบริการ (คีย์เลขบัตร 13 หลัก)' : 'นายสมชาย ใจดี';
    const hn = isManualInput ? `HN 67-0${inputIdNumber.slice(8)}` : '67-0498124';
    const deptPill = `แผนก${selectedWalkinDept} (บริการจุดคัดกรอง)`;
    const servicePoint = `ห้องตรวจ / จุดบริการ (${selectedWalkinDept})`;
    const location = 'ชั้น 1 อาคารบริการผู้ป่วยนอก';

    addQueueToSharedState({
        queueNumber: qNum,
        patientName: patientName,
        hn: hn,
        department: selectedWalkinDept,
        type: 'walkin',
        bookingSource: isManualInput ? 'Smart Kiosk (คีย์เลข 13 หลัก)' : 'Smart Kiosk (Walk-in คัดกรองสิทธิ์)'
    });

    setTimeout(() => {
        showKiosTicketDispensedView({
            queueNumber: qNum,
            departmentPill: deptPill,
            patientName: patientName,
            hn: hn,
            servicePoint: servicePoint,
            location: location,
            rights: selectedWalkinRight,
            doctorNote: `รอบบริการ: ${selectedWalkinTime} (ตรวจสอบสิทธิ์ สปสช. สำเร็จ)`,
            barcodeText: `*Q-${qNum}-${hn.replace(/[^0-9]/g, '')}*`
        });
    }, 400);
}

function cancelCardSyncAndEject() {
    clearCardSyncTimers();
    showKiosToast('💳 คืนบัตรประจำตัวประชาชนเรียบร้อยแล้ว');
    showKiosHomeView();
}

function showKiosQrView() {
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (cardView) cardView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';
    if (qrView) {
        qrView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) subbarBack.style.display = 'flex';
}

function showKiosQrSuccessView(source = 'qr') {
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (cardView) cardView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';
    if (qrSuccessView) {
        qrSuccessView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) subbarBack.style.display = 'none';

    // Update title depending on whether user used ID Card or QR Code
    const titleEl = document.getElementById('qr-success-title');
    if (titleEl) {
        if (source === 'card') {
            titleEl.textContent = 'อ่านบัตรประจำตัวประชาชน สำเร็จ';
        } else {
            titleEl.textContent = 'สแกน QR Code สำเร็จเรียบร้อย';
        }
    }

    // Format current live timestamp
    const now = new Date();
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
    const tStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} น. (Kiosk 04)`;
    
    const dEl = document.getElementById('qr-success-date');
    const tEl = document.getElementById('qr-success-time');
    if (dEl) dEl.textContent = dStr;
    if (tEl) tEl.textContent = tStr;
}

function showKiosTicketDispensedView(customData) {
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (homeView) homeView.style.display = 'none';
    if (cardView) cardView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';

    if (ticketView) {
        ticketView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) subbarBack.style.display = 'none';

    // Set dynamic date & time
    const now = new Date();
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const tsStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
    const tsEl = document.getElementById('dispensed-timestamp');
    if (tsEl) tsEl.textContent = tsStr;

    // Configure step indicator (3 steps for walkin, 2 steps for appointment)
    const stepsLeft = document.getElementById('ticket-dispensed-steps-left');
    const stepCounter = document.getElementById('ticket-dispensed-step-counter');
    if (currentCardMode === 'walkin') {
        if (stepsLeft) {
            stepsLeft.innerHTML = `
                <div class="step-pill-item inactive"><span>1. ยืนยันตัวตน</span></div>
                <span class="step-separator">›</span>
                <div class="step-pill-item inactive"><span>2. เลือกประเภทบริการ</span></div>
                <span class="step-separator">›</span>
                <div class="step-pill-item active"><span>3. รับบัตรคิว</span></div>
            `;
        }
        if (stepCounter) stepCounter.textContent = 'ขั้นตอนที่ 3 จาก 3';
    } else {
        if (stepsLeft) {
            stepsLeft.innerHTML = `
                <div class="step-pill-item inactive"><span>1. ยืนยันตัวตน</span></div>
                <span class="step-separator">›</span>
                <div class="step-pill-item active"><span>2. รับบัตรคิว</span></div>
            `;
        }
        if (stepCounter) stepCounter.textContent = 'ขั้นตอนที่ 2 จาก 2';
    }

    // Default details matching image
    const data = Object.assign({
        queueNumber: 'A003',
        departmentPill: 'แผนกอายุรกรรม (Internal Medicine)',
        patientName: 'นายสมชาย ใจดี',
        hn: 'HN-689412',
        servicePoint: 'ห้องตรวจ 1-3 (อายุรกรรม)',
        location: 'ชั้น 2 อาคาร A',
        rights: 'สิทธิประกันสุขภาพถ้วนหน้า (บั...',
        doctorNote: 'นัดหมายตรวจกับ นพ. วิจัย เปี่ยมประสิทธิ์ (อายุรแพทย์)',
        barcodeText: '*Q-A003-680412*'
    }, customData || {});

    const qNumEl = document.getElementById('dispensed-queue-number');
    const deptPillEl = document.getElementById('dispensed-dept-pill');
    const pNameEl = document.getElementById('dispensed-patient-name');
    const pHnEl = document.getElementById('dispensed-patient-hn');
    const pServiceEl = document.getElementById('dispensed-service-point');
    const pLocEl = document.getElementById('dispensed-location');
    const pRightsEl = document.getElementById('dispensed-rights');
    const pDoctorEl = document.getElementById('dispensed-doctor-note');
    const pBarcodeEl = document.getElementById('dispensed-barcode-text');

    if (qNumEl) qNumEl.textContent = data.queueNumber;
    if (deptPillEl) deptPillEl.innerHTML = `<span>${data.departmentPill}</span>`;
    if (pNameEl) pNameEl.textContent = data.patientName;
    if (pHnEl) pHnEl.textContent = data.hn;
    if (pServiceEl) pServiceEl.textContent = data.servicePoint;
    if (pLocEl) pLocEl.textContent = data.location;
    if (pRightsEl) pRightsEl.textContent = data.rights;
    if (pDoctorEl) pDoctorEl.textContent = data.doctorNote;
    if (pBarcodeEl) pBarcodeEl.textContent = data.barcodeText;

    // Reset and replay paper dispensing slide animation
    const slipEl = document.getElementById('thermal-ticket-slip');
    if (slipEl) {
        slipEl.style.animation = 'none';
        // Trigger reflow
        void slipEl.offsetWidth;
        slipEl.style.animation = 'ticketDispenseSlide 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    }

    playKiosChime();

    // 15 seconds auto return countdown
    let remaining = 15;
    const countdownEl = document.getElementById('auto-return-countdown');
    if (countdownEl) countdownEl.textContent = remaining;

    ticketCountdownInterval = setInterval(() => {
        remaining--;
        if (countdownEl) countdownEl.textContent = remaining;
        if (remaining <= 0) {
            clearTicketRedirectTimer();
            showKiosHomeView();
        }
    }, 1000);
}

function finishKiosSession() {
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    showKiosHomeView();
}

function showKiosHomeView() {
    clearTicketRedirectTimer();
    clearCardSyncTimers();
    const homeView = document.getElementById('kios-view-home');
    const cardView = document.getElementById('kios-view-id-card');
    const qrView = document.getElementById('kios-view-qr');
    const qrSuccessView = document.getElementById('kios-view-qr-success');
    const ticketView = document.getElementById('kios-view-ticket-dispensed');
    const syncView = document.getElementById('kios-view-card-syncing');
    const serviceView = document.getElementById('kios-view-service-selection');
    const subbarBack = document.getElementById('btn-subbar-back');

    if (cardView) cardView.style.display = 'none';
    if (qrView) qrView.style.display = 'none';
    if (qrSuccessView) qrSuccessView.style.display = 'none';
    if (ticketView) ticketView.style.display = 'none';
    if (syncView) syncView.style.display = 'none';
    if (serviceView) serviceView.style.display = 'none';
    if (homeView) {
        homeView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (subbarBack) subbarBack.style.display = 'none';
}

function startCardCheckin() {
    closeAppointmentModal();
    showKiosCardView('appointment');
}

function startQrCheckin() {
    closeAppointmentModal();
    showKiosQrView();
}

// ============ 5. WALKIN SCREENING MODAL FLOW ============
function openWalkinModal() {
    const modal = document.getElementById('modal-walkin-screening');
    if (modal) modal.style.display = 'flex';
}

function closeWalkinModal() {
    const modal = document.getElementById('modal-walkin-screening');
    if (modal) modal.style.display = 'none';
}

function issueWalkinQueue(dept) {
    closeWalkinModal();

    const modal = document.getElementById('modal-card-reading');
    const spinner = document.getElementById('state-reading-spinner');
    const success = document.getElementById('state-reading-success');
    const spinnerTitle = document.getElementById('spinner-title');

    if (!modal) return;
    modal.style.display = 'flex';
    spinner.style.display = 'block';
    if (spinnerTitle) spinnerTitle.textContent = `กำลังลงทะเบียนคิวใหม่ แผนก${dept}...`;
    success.style.display = 'none';

    setTimeout(() => {
        spinner.style.display = 'none';
        success.style.display = 'block';

        kiosQueueCounter++;
        const prefix = KIOSK_DEPT_PREFIX[dept] || 'W';
        const qNum = `${prefix}-${String(kiosQueueCounter).padStart(3, '0')}`;
        const patientName = 'คุณ ผู้รับบริการทั่วไป (Walk-in)';
        const hn = `HN 67-0${Math.floor(10000 + Math.random() * 89999)}`;

        document.getElementById('kios-result-name').textContent = patientName;
        document.getElementById('kios-result-cid').textContent = 'เลขบัตร: บันทึกผ่านจุดคัดกรอง';
        document.getElementById('kios-result-hn').textContent = `รหัส HN: ${hn}`;
        document.getElementById('kios-result-rights').textContent = 'สิทธิการรักษา: ตรวจสอบ ณ จุดคัดกรอง';
        document.getElementById('kios-print-queue').textContent = qNum;
        document.getElementById('kios-print-dept').textContent = `แผนก${dept} • จุดคัดกรองอาการ`;
        document.getElementById('kios-print-wait').textContent = `คิวก่อนหน้า: 1 คิว • เวลารอโดยประมาณ 5-10 นาที`;

        // Save into shared hospitalQueueState so it syncs to Triage & Doctor
        addQueueToSharedState({
            queueNumber: qNum,
            patientName: patientName,
            hn: hn,
            department: dept,
            type: 'walkin',
            bookingSource: 'Smart Kiosk (Walk-in ใหม่)'
        });

        playKiosChime();
    }, 1200);
}

// ============ 6. SIMULATE INSERT SMART CARD ============
function simulateInsertCard(isAppointment = null) {
    const isThreeSteps = document.getElementById('id-step-total')?.textContent === '3';
    if ((currentCardMode === 'walkin' || isThreeSteps) && isAppointment !== true) {
        showKiosCardSyncingView();
    } else {
        showKiosToast('💳 กำลังอ่านข้อมูลชิปการ์ดบัตรประจำตัวประชาชน...');
        setTimeout(() => {
            showKiosQrSuccessView('card');
            playKiosChime();
        }, 600);
    }
}

// ============ 7. SIMULATE QR CODE SCAN ============
function simulateScanAppointmentQR() {
    showKiosToast('🔍 กำลังตรวจสอบข้อมูล QR Code ใบนัดหมาย...');
    setTimeout(() => {
        showKiosQrSuccessView();
        playKiosChime();
    }, 500);
}

function confirmAndPrintQrTicket() {
    showKiosToast('🖨️ กำลังพิมพ์บัตรคิว...');

    const qNum = 'A003';
    const patientName = 'นายสมชาย ใจดี';
    const hn = 'HN-689412';
    const deptPill = 'แผนกอายุรกรรม (Internal Medicine)';

    addQueueToSharedState({
        queueNumber: qNum,
        patientName: patientName,
        hn: hn,
        department: 'อายุรกรรม',
        type: 'appointment',
        bookingSource: 'Smart Kiosk (สแกน QR ใบนัด)'
    });

    setTimeout(() => {
        showKiosTicketDispensedView({
            queueNumber: qNum,
            departmentPill: deptPill,
            patientName: patientName,
            hn: hn,
            servicePoint: 'ห้องตรวจ 1-3 (อายุรกรรม)',
            location: 'ชั้น 2 อาคาร A',
            rights: 'สิทธิประกันสุขภาพถ้วนหน้า (บั...',
            doctorNote: 'นัดหมายตรวจกับ นพ. วิจัย เปี่ยมประสิทธิ์ (อายุรแพทย์)',
            barcodeText: '*Q-A003-680412*'
        });
    }, 300);
}

// ============ 8. SAVE QUEUE ITEM INTO SHARED STORAGE ============
function addQueueToSharedState(data) {
    try {
        const saved = localStorage.getItem('hospitalQueueState');
        let parsed = saved ? JSON.parse(saved) : {};
        if (!parsed.waitingQueue) parsed.waitingQueue = [];

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        parsed.waitingQueue.push({
            id: 'q_kios_' + Date.now(),
            queueNumber: data.queueNumber,
            type: data.type || 'walkin',
            appointmentTime: timeStr,
            patientName: data.patientName,
            hn: data.hn,
            department: data.department,
            enteredAt: now.toISOString(),
            isLate: false,
            lateMessage: '',
            source: data.bookingSource || 'Smart Kiosk'
        });

        parsed.lastUpdatedBy = 'kiosk';
        parsed.timestamp = Date.now();

        localStorage.setItem('hospitalQueueState', JSON.stringify(parsed));
    } catch (e) {
        console.error('Error adding queue from kiosk:', e);
    }
}

function finishKiosSession() {
    const modal = document.getElementById('modal-card-reading');
    if (modal) modal.style.display = 'none';
    showKiosHomeView();
    showKiosToast('🎟️ พิมพ์บัตรคิวเรียบร้อยแล้ว กรุณารับบัตรคิวที่ช่องรับด้านล่าง');
}

// ============ 9. MANUAL THAI ID INPUT ============
function openManualIdModal() {
    inputIdNumber = '';
    updateIdDisplay();
    const modal = document.getElementById('modal-manual-id');
    if (modal) modal.style.display = 'flex';
}

function closeManualIdModal() {
    const modal = document.getElementById('modal-manual-id');
    if (modal) modal.style.display = 'none';
}

function pressKey(num) {
    if (inputIdNumber.length < 13) {
        inputIdNumber += num;
        updateIdDisplay();
    }
}

function clearKeypad() {
    inputIdNumber = '';
    updateIdDisplay();
}

function backspaceKey() {
    inputIdNumber = inputIdNumber.slice(0, -1);
    updateIdDisplay();
}

function updateIdDisplay() {
    const display = document.getElementById('id-display-screen');
    const submitBtn = document.getElementById('btn-submit-manual-id');
    if (!display) return;

    if (inputIdNumber.length === 0) {
        display.innerHTML = '<span class="placeholder">กรุณากดหมายเลข 13 หลัก</span>';
        if (submitBtn) submitBtn.classList.remove('ready');
        return;
    }

    // Format: X-XXXX-XXXXX-XX-X
    let formatted = '';
    for (let i = 0; i < inputIdNumber.length; i++) {
        if (i === 1 || i === 5 || i === 10 || i === 12) {
            formatted += ' ';
        }
        formatted += inputIdNumber[i];
    }
    display.textContent = formatted;

    if (submitBtn) {
        if (inputIdNumber.length === 13) {
            submitBtn.classList.add('ready');
        } else {
            submitBtn.classList.remove('ready');
        }
    }
}

function submitManualId() {
    if (inputIdNumber.length !== 13) {
        showKiosToast('⚠️ กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
        return;
    }

    closeManualIdModal();

    // Format CID: X-XXXX-XXXXX-XX-X
    const formattedCid = `${inputIdNumber[0]}-${inputIdNumber.slice(1,5)}-${inputIdNumber.slice(5,10)}-${inputIdNumber.slice(10,12)}-${inputIdNumber[12]}`;
    
    // Update Step 2 patient profile
    const cidEl = document.getElementById('service-patient-cid');
    if (cidEl) cidEl.textContent = formattedCid;

    const nameEl = document.getElementById('service-patient-name');
    if (nameEl) nameEl.textContent = 'คุณ ผู้รับบริการ (คีย์เลขบัตร 13 หลัก)';

    // Update current mode
    currentCardMode = 'walkin';

    showKiosToast('✅ ตรวจสอบเลขบัตรประชาชน 13 หลักเรียบร้อยแล้ว');
    showKiosServiceSelectionView();
}

// ============ 10. ONLINE BOOKING QR MODAL ============
function openQrMobileModal() {
    const modal = document.getElementById('modal-online-qr');
    if (modal) modal.style.display = 'flex';
}

function closeQrMobileModal() {
    const modal = document.getElementById('modal-online-qr');
    if (modal) modal.style.display = 'none';
}

function handleKiosModalBackdrop(e) {
    if (e.target.classList.contains('kios-modal-overlay')) {
        e.target.style.display = 'none';
    }
}

// ============ 11. TOAST NOTIFICATION ============
let toastTimer = null;
function showKiosToast(msg) {
    const toast = document.getElementById('kios-toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// ============ INITIALIZER ============
document.addEventListener('DOMContentLoaded', () => {
    initKiosClock();
});
