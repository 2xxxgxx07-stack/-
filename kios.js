/* ===================================================
   SMART HOSPITAL KIOSK - APPLICATION LOGIC
   =================================================== */

let inputIdNumber = '';
let kiosQueueCounter = 300;
let isSoundMuted = false;

// Department Prefix mapping
const KIOSK_DEPT_PREFIX = {
    'อายุรกรรม': 'M',
    'ทันตกรรม': 'D',
    'ศัลยกรรม': 'SR',
    'กุมารเวชกรรม': 'P',
    'จักษุวิทยา': 'E',
    'กระดูกและข้อ': 'O',
};

// ============ SOUND SIMULATOR ============
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
    showKiosToast(isSoundMuted ? '🔇 ปิดเสียงลำโพงตู้คีออสก์แล้ว' : '🔊 เปิดเสียงลำโพงตู้คีออสก์แล้ว');
}

function callNurseAlert() {
    playKiosChime();
    showKiosToast('🚨 แจ้งเตือนเจ้าหน้าที่พยาบาลเรียบร้อยแล้ว กำลังเดินทางมายังตู้บริการ');
}

// ============ SIMULATE INSERT SMART CARD ============
function simulateInsertCard() {
    const modal = document.getElementById('modal-card-reading');
    const spinner = document.getElementById('state-reading-spinner');
    const success = document.getElementById('state-reading-success');

    if (!modal) return;
    modal.style.display = 'flex';
    spinner.style.display = 'block';
    success.style.display = 'none';

    // Simulate 2 seconds card reading
    setTimeout(() => {
        spinner.style.display = 'none';
        success.style.display = 'block';

        // Sample Citizen Card Data
        const samplePatients = [
            { name: 'นาย ปริญญา เกษมสันต์', cid: '1-1004-00234-89-1', dept: 'อายุรกรรม' },
            { name: 'นาง สุพิชชา พิทักษ์ไทย', cid: '1-1004-00567-12-3', dept: 'ทันตกรรม' },
            { name: 'นาย อดิศร มณีรัตน์', cid: '1-1004-00890-45-6', dept: 'ศัลยกรรม' },
        ];
        const selected = samplePatients[Math.floor(Math.random() * samplePatients.length)];

        // Generate Ticket
        kiosQueueCounter++;
        const prefix = KIOSK_DEPT_PREFIX[selected.dept] || 'M';
        const qNum = `${prefix}-${String(kiosQueueCounter).padStart(3, '0')}`;
        const hn = `HN 67-0${Math.floor(10000 + Math.random() * 89999)}`;

        document.getElementById('kios-result-name').textContent = selected.name;
        document.getElementById('kios-result-hn').textContent = `รหัส HN: ${hn}`;
        document.getElementById('kios-print-queue').textContent = qNum;
        document.getElementById('kios-print-dept').textContent = `แผนก${selected.dept} • คัดกรอง/ห้องตรวจ`;

        // Save into shared hospitalQueueState
        addQueueToSharedState({
            queueNumber: qNum,
            patientName: selected.name,
            hn: hn,
            department: selected.dept,
            type: 'walkin',
            bookingSource: 'Smart Kiosk (บัตรประชาชน)'
        });

        playKiosChime();
    }, 1800);
}

// ============ SIMULATE QR CODE SCAN ============
function simulateScanAppointmentQR() {
    const modal = document.getElementById('modal-card-reading');
    const spinner = document.getElementById('state-reading-spinner');
    const success = document.getElementById('state-reading-success');

    if (!modal) return;
    modal.style.display = 'flex';
    spinner.style.display = 'block';
    spinner.querySelector('h3').textContent = 'กำลังสแกน QR Code ใบนัดหมาย...';
    success.style.display = 'none';

    setTimeout(() => {
        spinner.style.display = 'none';
        success.style.display = 'block';

        kiosQueueCounter++;
        const qNum = `APT-${String(kiosQueueCounter).padStart(3, '0')}`;
        const patientName = 'คุณ สุดาพร แก้วมณี';
        const hn = 'HN 67-041921';
        const dept = 'ทันตกรรม';

        document.getElementById('kios-result-name').textContent = patientName;
        document.getElementById('kios-result-hn').textContent = `รหัส HN: ${hn}`;
        document.getElementById('kios-print-queue').textContent = qNum;
        document.getElementById('kios-print-dept').textContent = `แผนก${dept} • มีนัดตรวจวันนี้`;

        addQueueToSharedState({
            queueNumber: qNum,
            patientName: patientName,
            hn: hn,
            department: dept,
            type: 'appointment',
            bookingSource: 'Smart Kiosk (สแกนใบนัด)'
        });

        playKiosChime();
    }, 1500);
}

// Save Queue Item into shared localStorage
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
    showKiosToast('🎟️ พิมพ์บัตรคิวเรียบร้อยแล้ว กรุณารับบัตรคิวที่ช่องรับบัตรด้านล่าง');
}

// ============ MANUAL THAI ID INPUT ============
function openManualIdModal() {
    inputIdNumber = '';
    updateKeypadDisplay();
    document.getElementById('modal-manual-id').style.display = 'flex';
}

function closeManualIdModal() {
    document.getElementById('modal-manual-id').style.display = 'none';
}

function handleKiosModalBackdrop(e) {
    if (e.target.id === 'modal-manual-id') {
        closeManualIdModal();
    }
}

function pressKey(char) {
    if (inputIdNumber.length < 13) {
        inputIdNumber += char;
        updateKeypadDisplay();
    }
}

function clearKeypad() {
    inputIdNumber = '';
    updateKeypadDisplay();
}

function backspaceKey() {
    if (inputIdNumber.length > 0) {
        inputIdNumber = inputIdNumber.slice(0, -1);
        updateKeypadDisplay();
    }
}

function updateKeypadDisplay() {
    const textEl = document.getElementById('id-display-text');
    if (!textEl) return;

    if (inputIdNumber.length === 0) {
        textEl.textContent = 'กรุณากดหมายเลข 13 หลัก';
        textEl.className = 'placeholder';
    } else {
        // Format Thai ID: X-XXXX-XXXXX-XX-X
        let formatted = '';
        for (let i = 0; i < inputIdNumber.length; i++) {
            if (i === 1 || i === 5 || i === 10 || i === 12) formatted += '-';
            formatted += inputIdNumber[i];
        }
        textEl.textContent = formatted;
        textEl.className = '';
    }
}

function submitManualId() {
    if (inputIdNumber.length < 13) {
        showKiosToast('⚠️ กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก');
        return;
    }

    const dept = document.getElementById('manual-kios-dept')?.value || 'อายุรกรรม';
    closeManualIdModal();

    // Trigger Success State in reading modal
    const modal = document.getElementById('modal-card-reading');
    const spinner = document.getElementById('state-reading-spinner');
    const success = document.getElementById('state-reading-success');

    modal.style.display = 'flex';
    spinner.style.display = 'none';
    success.style.display = 'block';

    kiosQueueCounter++;
    const prefix = KIOSK_DEPT_PREFIX[dept] || 'M';
    const qNum = `${prefix}-${String(kiosQueueCounter).padStart(3, '0')}`;
    const name = `คุณ ผู้รับบริการ (เลขท้าย ${inputIdNumber.slice(-4)})`;
    const hn = `HN 67-${Math.floor(100000 + Math.random() * 900000)}`;

    document.getElementById('kios-result-name').textContent = name;
    document.getElementById('kios-result-hn').textContent = `รหัส HN: ${hn}`;
    document.getElementById('kios-print-queue').textContent = qNum;
    document.getElementById('kios-print-dept').textContent = `แผนก${dept} • ออกบัตรคิวสำเร็จ`;

    addQueueToSharedState({
        queueNumber: qNum,
        patientName: name,
        hn: hn,
        department: dept,
        type: 'walkin',
        bookingSource: 'Smart Kiosk (คีย์เลข 13 หลัก)'
    });

    playKiosChime();
}

// ============ TOAST ============
function showKiosToast(msg) {
    const toast = document.getElementById('kios-toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

// ============ REAL-TIME CLOCK ============
function updateKiosClock() {
    const now = new Date();
    const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const d = now.getDate();
    const m = thaiMonths[now.getMonth()];
    const y = now.getFullYear() + 543;
    const day = thaiDays[now.getDay()];
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const clockEl = document.getElementById('kios-live-datetime');
    if (clockEl) {
        clockEl.textContent = `${h}:${min} น. | วัน${day}ที่ ${d} ${m} ${y}`;
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    updateKiosClock();
    setInterval(updateKiosClock, 1000);
});
