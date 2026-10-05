/* ===================================================
   SMART HOSPITAL MOBILE QUEUE APP - JAVASCRIPT LOGIC
   =================================================== */

const mobileState = {
    currentTab: 'view-my-queue',
    trackedQueueId: null,
    trackedQueueItem: null,
    selectedDeptBooking: 'อายุรกรรม',
    bookingServiceType: 'walkin',
    queueState: null,
    appointments: [],
};

// Department Metadata
const DEPARTMENTS = [
    { name: 'อายุรกรรม', icon: '🩺', avgWait: 15, tag: 'ทั่วไป/เรื้อรัง' },
    { name: 'ทันตกรรม', icon: '🦷', avgWait: 20, tag: 'ตรวจฟัน/ขูดหินปูน' },
    { name: 'ศัลยกรรม', icon: '✂️', avgWait: 18, tag: 'ผ่าตัด/แผล' },
    { name: 'กุมารเวชกรรม', icon: '👶', avgWait: 12, tag: 'คลินิกเด็ก' },
    { name: 'จักษุวิทยา', icon: '👁️', avgWait: 10, tag: 'ตรวจตา/สายตา' },
    { name: 'กระดูกและข้อ', icon: '🦴', avgWait: 16, tag: 'ข้อต่อ/กระดูก' },
];

// Department Prefixes for generated queues
const DEPT_PREFIX_MAP = {
    'อายุรกรรม': 'M',
    'ทันตกรรม': 'D',
    'ศัลยกรรม': 'SR',
    'กุมารเวชกรรม': 'P',
    'จักษุวิทยา': 'E',
    'กระดูกและข้อ': 'O',
};

// ============ LOAD DATA FROM LOCALSTORAGE ============
function loadSharedQueueState() {
    try {
        const saved = localStorage.getItem('hospitalQueueState');
        if (saved) {
            mobileState.queueState = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading hospitalQueueState:', e);
    }

    try {
        const appts = localStorage.getItem('hospitalAppointments');
        if (appts) {
            mobileState.appointments = JSON.parse(appts);
        }
    } catch (e) {
        console.error('Error loading hospitalAppointments:', e);
    }
}

// Find queue item across waitingQueue, labQueue, and rooms
function findQueueItem(query) {
    if (!mobileState.queueState) return null;
    const q = (query || '').trim().toLowerCase();
    if (!q) return null;

    const { waitingQueue = [], labQueue = [], rooms = [] } = mobileState.queueState;

    // 1. Check in waitingQueue
    const inWaiting = waitingQueue.find(item => 
        (item.queueNumber && item.queueNumber.toLowerCase() === q) ||
        (item.hn && item.hn.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase() === q)
    );
    if (inWaiting) return { item: inWaiting, stage: 'waiting', stageLabel: 'กำลังรอเรียกเข้าห้องตรวจ' };

    // 2. Check in labQueue
    const inLab = labQueue.find(item => 
        (item.queueNumber && item.queueNumber.toLowerCase() === q) ||
        (item.hn && item.hn.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase() === q)
    );
    if (inLab) return { item: inLab, stage: 'lab', stageLabel: inLab.labStatus || 'พักรอผลตรวจ / แล็บ' };

    // 3. Check in rooms
    for (const room of rooms) {
        if (room.patient) {
            const p = room.patient;
            if (
                (p.queueNumber && p.queueNumber.toLowerCase() === q) ||
                (p.hn && p.hn.toLowerCase().includes(q)) ||
                (p.id && p.id.toLowerCase() === q)
            ) {
                const isExamining = p.status === 'examining';
                return { 
                    item: { ...p, roomName: room.name }, 
                    stage: isExamining ? 'examining' : 'waiting_room',
                    stageLabel: isExamining ? `แพทย์กำลังตรวจใน ${room.name}` : `รอแพทย์ตรวจใน ${room.name}`,
                    room: room
                };
            }
        }
    }

    // 4. Check completed history
    const history = mobileState.queueState.historyRecords || [];
    const inHistory = history.find(h => 
        (h.queue && h.queue.toLowerCase() === q) ||
        (h.hn && h.hn.toLowerCase().includes(q))
    );
    if (inHistory) {
        return {
            item: {
                queueNumber: inHistory.queue,
                patientName: inHistory.name,
                hn: inHistory.hn,
                department: inHistory.dept,
            },
            stage: 'done',
            stageLabel: 'ตรวจเสร็จสิ้นแล้ว'
        };
    }

    return null;
}

// Department SVG Helper
function getDeptSvgIcon(dept) {
    switch (dept) {
        case 'ทันตกรรม':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M7 3C4.5 3 3 5 3 7.5C3 10.5 4.5 12 5.5 14L7.5 21C8 22 9.5 22 10 21L12 16L14 21C14.5 22 16 22 16.5 21L18.5 14C19.5 12 21 10.5 21 7.5C21 5 19.5 3 17 3C14.5 3 13.5 4.5 12 4.5C10.5 4.5 9.5 3 7 3Z"/></svg>`;
        case 'อายุรกรรม':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3"/><path d="M9 12.5v4a3 3 0 0 0 6 0v-2"/><circle cx="18" cy="14" r="2.5"/><path d="M3 3h3M12 3h3"/></svg>`;
        case 'ศัลยกรรม':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
        case 'กุมารเวชกรรม':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><path d="M12 3a2.5 2.5 0 0 1 2 2.5"/></svg>`;
        case 'จักษุวิทยา':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
        case 'กระดูกและข้อ':
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M18 10a3 3 0 0 0-3-3l-6 6a3 3 0 1 0 4.24 4.24l6-6A3 3 0 0 0 18 10z"/><circle cx="19" cy="5" r="2.5"/><circle cx="15" cy="2" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="9" cy="22" r="2.5"/></svg>`;
        default:
            return `<svg class="dept-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M12 7v6M9 10h6"/></svg>`;
    }
}

// ============ RENDER TICKET VIEW ============
function renderTicket() {
    loadSharedQueueState();

    // Default to first item in waitingQueue if none tracked
    if (!mobileState.trackedQueueItem && mobileState.queueState?.waitingQueue?.length > 0) {
        const first = mobileState.queueState.waitingQueue[0];
        mobileState.trackedQueueItem = {
            item: first,
            stage: 'waiting',
            stageLabel: 'กำลังรอเรียกเข้าห้องตรวจ'
        };
    }

    const tracked = mobileState.trackedQueueItem;
    if (!tracked || !tracked.item) {
        document.getElementById('ticket-queue-num').textContent = '--';
        document.getElementById('ticket-patient-name').textContent = 'ยังไม่มีคิวในขณะนี้';
        document.getElementById('ticket-status-text').textContent = 'สามารถกด "จองคิวใหม่" ด้านล่างเพื่อรับบัตรคิว';
        return;
    }

    const p = tracked.item;

    // 1. Queue Number, Name, HN
    document.getElementById('ticket-queue-num').textContent = p.queueNumber || '-';
    document.getElementById('ticket-patient-name').textContent = p.patientName || 'ผู้เข้ารับบริการ';
    document.getElementById('ticket-patient-hn').textContent = p.hn ? `${p.hn}` : 'HN --';

    // 2. Department & Type Badge
    const deptBadge = document.getElementById('ticket-dept-badge');
    if (deptBadge) {
        deptBadge.innerHTML = `
            ${getDeptSvgIcon(p.department)}
            <span>${p.department || 'ทั่วไป'}</span>
        `;
    }

    const typeBadge = document.getElementById('ticket-type-badge');
    if (typeBadge) {
        const isAppt = p.type === 'appointment';
        typeBadge.textContent = isAppt ? 'คิวนัดหมาย (Appointment)' : 'คิวทั่วไป (Walk-in)';
        typeBadge.style.background = isAppt ? '#EFF6FF' : '#F0FDF4';
        typeBadge.style.color = isAppt ? '#1D4ED8' : '#15803D';
        typeBadge.style.borderColor = isAppt ? '#BFDBFE' : '#86EFAC';
    }

    // 3. Stage & Status Pill
    const statusPill = document.getElementById('ticket-live-status-pill');
    const statusText = document.getElementById('ticket-status-text');
    if (statusPill && statusText) {
        statusText.textContent = tracked.stageLabel || 'กำลังรอเรียกคิว';
        statusPill.className = `live-status-pill ${tracked.stage}`;
    }

    // 4. Calculate Queues Ahead & Est Wait
    let queuesAhead = 0;
    let estMinutes = 10;
    let targetRoom = 'ห้องตรวจ 1-4';

    if (mobileState.queueState?.waitingQueue) {
        const waitList = mobileState.queueState.waitingQueue;
        const myIdx = waitList.findIndex(q => q.queueNumber === p.queueNumber);
        if (myIdx !== -1) {
            queuesAhead = myIdx;
            estMinutes = Math.max(5, (myIdx + 1) * 12);
        } else if (tracked.stage === 'lab') {
            queuesAhead = 1;
            estMinutes = 15;
            targetRoom = 'จุดเจาะเลือด/แล็บ';
        } else if (tracked.stage === 'examining' || tracked.stage === 'waiting_room') {
            queuesAhead = 0;
            estMinutes = 0;
            targetRoom = tracked.item.roomName || 'ห้องตรวจ';
        } else if (tracked.stage === 'done') {
            queuesAhead = 0;
            estMinutes = 0;
            targetRoom = 'ห้องจ่ายยา / การเงิน';
        }
    }

    document.getElementById('ticket-queues-ahead').textContent = queuesAhead;
    document.getElementById('ticket-est-wait').textContent = estMinutes === 0 ? 'ถึงคิวคุณแล้ว' : `~ ${estMinutes}`;
    document.getElementById('ticket-target-room').textContent = targetRoom;

    // 5. Update Stepper (5 Steps)
    updateStepper(tracked.stage);
}

function updateStepper(stage) {
    const steps = [
        document.getElementById('step-1'),
        document.getElementById('step-2'),
        document.getElementById('step-3'),
        document.getElementById('step-4'),
        document.getElementById('step-5'),
    ];
    const lines = [
        document.getElementById('line-1'),
        document.getElementById('line-2'),
        document.getElementById('line-3'),
        document.getElementById('line-4'),
    ];

    const STEP_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>';

    steps.forEach((s, i) => {
        if (!s) return;
        s.className = 'step-item';
        s.querySelector('.step-circle').textContent = i + 1;
    });
    lines.forEach(l => { if (l) l.className = 'step-line'; });

    // Step 1 is always completed once registered
    steps[0].classList.add('completed');
    steps[0].querySelector('.step-circle').innerHTML = STEP_CHECK_SVG;

    if (stage === 'lab') {
        steps[1].classList.add('current');
        lines[0].classList.add('active');
    } else if (stage === 'waiting' || stage === 'waiting_room') {
        steps[1].classList.add('completed');
        steps[1].querySelector('.step-circle').innerHTML = STEP_CHECK_SVG;
        lines[0].classList.add('active');
        steps[2].classList.add('current');
        lines[1].classList.add('active');
    } else if (stage === 'examining') {
        steps[1].classList.add('completed');
        steps[1].querySelector('.step-circle').innerHTML = STEP_CHECK_SVG;
        steps[2].classList.add('completed');
        steps[2].querySelector('.step-circle').innerHTML = STEP_CHECK_SVG;
        lines[0].classList.add('active');
        lines[1].classList.add('active');
        steps[3].classList.add('current');
        lines[2].classList.add('active');
    } else if (stage === 'done') {
        steps.forEach((s, idx) => {
            s.classList.add('completed');
            s.querySelector('.step-circle').innerHTML = STEP_CHECK_SVG;
            if (lines[idx]) lines[idx].classList.add('active');
        });
    } else {
        steps[2].classList.add('current');
        lines[0].classList.add('active');
    }
}

function renderQuickQueueChips() {
    const container = document.getElementById('quick-queue-chips');
    if (!container || !mobileState.queueState) return;

    const allQueues = [
        ...(mobileState.queueState.waitingQueue || []),
        ...(mobileState.queueState.labQueue || []),
    ];

    if (allQueues.length === 0) {
        container.innerHTML = '<span style="font-size:0.7rem;color:#94a3b8;">ไม่มีคิวรอในระบบ</span>';
        return;
    }

    container.innerHTML = allQueues.slice(0, 7).map(q => {
        const isCurrent = mobileState.trackedQueueItem?.item?.queueNumber === q.queueNumber;
        return `
            <button type="button" class="quick-chip ${isCurrent ? 'active' : ''}" onclick="selectTrackQueue('${q.queueNumber}')">
                ${q.queueNumber} (${q.patientName.split(' ')[1] || q.patientName})
            </button>
        `;
    }).join('');
}

function selectTrackQueue(queueNumber) {
    const match = findQueueItem(queueNumber);
    if (match) {
        mobileState.trackedQueueItem = match;
        renderTicket();
        showMobileToast(`กำลังติดตามคิว ${queueNumber}`);
    }
}

function searchQueue() {
    const input = document.getElementById('input-track-queue');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showMobileToast('กรุณากรอกหมายเลขคิว หรือ HN');
        return;
    }

    const match = findQueueItem(val);
    if (match) {
        mobileState.trackedQueueItem = match;
        renderTicket();
        showMobileToast(`พบข้อมูลคิว ${match.item.queueNumber}`);
        input.value = '';
    } else {
        showMobileToast(`ไม่พบข้อมูลคิว "${val}" ในระบบ`);
    }
}

function handleQueueSearchKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchQueue();
    }
}

function refreshQueueData(notify = false) {
    loadSharedQueueState();
    if (mobileState.trackedQueueItem?.item?.queueNumber) {
        const updated = findQueueItem(mobileState.trackedQueueItem.item.queueNumber);
        if (updated) {
            mobileState.trackedQueueItem = updated;
        }
    }
    renderTicket();
    renderDepartmentTraffic();
    renderMobileAppointments();
    if (notify) {
        showMobileToast('🔄 อัปเดตข้อมูลคิวล่าสุดแล้ว');
    }
}

// ============ AUDIO / SOUND SIMULATOR ============
function testPlayMyQueueAudio() {
    const tracked = mobileState.trackedQueueItem;
    if (!tracked || !tracked.item) {
        showMobileToast('ยังไม่มีคิวที่กำลังติดตาม');
        return;
    }

    const qNum = tracked.item.queueNumber || 'M-041';
    const pName = tracked.item.patientName || '';
    const room = tracked.item.roomName || 'ห้องตรวจที่ 3';

    // Play Bell Chime via Web Audio API
    playHospitalChime().then(() => {
        // Voice Announcement via SpeechSynthesis
        speakThaiAnnouncement(qNum, pName, room);
    });

    showMobileToast(`🔊 กำลังจำลองเสียงเรียกคิว ${qNum}`);
}

function playHospitalChime() {
    return new Promise((resolve) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                resolve();
                return;
            }
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            const notes = [783.99, 659.25, 523.25]; // G5 -> E5 -> C5

            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.22);
                gain.gain.setValueAtTime(0, now + idx * 0.22);
                gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.22 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.9);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.22);
                osc.stop(now + idx * 0.22 + 0.95);
            });

            setTimeout(resolve, 800);
        } catch (e) {
            resolve();
        }
    });
}

function speakThaiAnnouncement(queueNumber, patientName, roomName) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // Natural Thai pronunciation format
    const letterMap = {
        'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี',
        'M': 'เอ็ม', 'S': 'เอส', 'P': 'พี', 'W': 'ดับเบิ้ลยู', 'O': 'โอ',
        'SR': 'เอส อาร์'
    };
    const parts = queueNumber.toUpperCase().split('-');
    let prefixSpoken = letterMap[parts[0]] || parts[0];
    let numSpoken = parts[1] || '';

    const text = `ขอเชิญหมายเลขคิว ${prefixSpoken} ${numSpoken} คุณ ${patientName} ที่ ${roomName} ค่ะ`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.startsWith('th'));
    if (thaiVoice) utterance.voice = thaiVoice;

    window.speechSynthesis.speak(utterance);
}

// ============ TAB 2: ONLINE QUEUE BOOKING ============
function selectMobileDept(deptName) {
    mobileState.selectedDeptBooking = deptName;
    document.querySelectorAll('.dept-tile').forEach(t => {
        t.classList.toggle('selected', t.getAttribute('data-dept') === deptName);
    });
}

function toggleBookingType(type) {
    mobileState.bookingServiceType = type;
    const picker = document.getElementById('appt-time-picker');
    if (picker) {
        picker.style.display = type === 'appointment' ? 'block' : 'none';
    }

    document.querySelectorAll('.service-radio-card').forEach(card => {
        const input = card.querySelector('input');
        if (input) card.classList.toggle('active', input.value === type);
    });
}

let mobileQueueCounter = 200;

function submitMobileBooking(e) {
    e.preventDefault();

    const name = document.getElementById('book-patient-name')?.value.trim();
    const phone = document.getElementById('book-patient-phone')?.value.trim();
    let hn = document.getElementById('book-patient-hn')?.value.trim();
    const symptoms = document.getElementById('book-symptoms')?.value.trim();
    const dept = mobileState.selectedDeptBooking || 'อายุรกรรม';
    const isWalkin = mobileState.bookingServiceType === 'walkin';
    const apptTime = isWalkin ? '' : document.getElementById('book-appt-time')?.value;

    if (!name || !phone) {
        showMobileToast('กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์');
        return;
    }

    if (!hn) {
        hn = `HN 67-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Generate unique Queue Number
    mobileQueueCounter++;
    const prefix = DEPT_PREFIX_MAP[dept] || 'M';
    const queueNumber = `${prefix}-${String(mobileQueueCounter).padStart(3, '0')}`;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Read current state
    loadSharedQueueState();
    if (!mobileState.queueState) mobileState.queueState = {};
    if (!mobileState.queueState.waitingQueue) mobileState.queueState.waitingQueue = [];

    const newQueueItem = {
        id: 'q_mob_' + Date.now(),
        queueNumber: queueNumber,
        type: isWalkin ? 'walkin' : 'appointment',
        appointmentTime: isWalkin ? timeStr : apptTime,
        patientName: name,
        hn: hn,
        department: dept,
        enteredAt: now.toISOString(),
        isLate: false,
        lateMessage: '',
        symptoms: symptoms || '',
        bookingSource: 'Mobile App'
    };

    // Add to waiting queue
    mobileState.queueState.waitingQueue.push(newQueueItem);
    mobileState.queueState.lastUpdatedBy = 'patient_mobile';
    mobileState.queueState.timestamp = Date.now();

    // Save to shared localStorage
    localStorage.setItem('hospitalQueueState', JSON.stringify(mobileState.queueState));

    // Update tracked item to this newly generated queue!
    mobileState.trackedQueueItem = {
        item: newQueueItem,
        stage: 'waiting',
        stageLabel: 'รับบัตรคิวสำเร็จ - กำลังรอเรียกตรวจ'
    };

    // Play chime sound
    playHospitalChime();

    // Reset form
    document.getElementById('form-mobile-booking')?.reset();

    // Switch to ticket view
    switchMobileNav('view-my-queue');
    renderTicket();

    showMobileToast(`✅ ออกบัตรคิวสำเร็จ! หมายเลข ${queueNumber}`);
}

// ============ TAB 3: MY APPOINTMENTS ============
function renderMobileAppointments() {
    const container = document.getElementById('mobile-appt-list');
    if (!container) return;

    loadSharedQueueState();
    const appts = mobileState.appointments || [];

    if (appts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 16px; background:#FFFFFF; border-radius:14px; border:1px solid #E2E8F0;">
                <div style="font-size:2rem; margin-bottom:8px;">📅</div>
                <div style="font-weight:600; color:#1E293B;">ไม่พบรายการนัดหมาย</div>
                <div style="font-size:0.78rem; color:#64748B; margin-top:4px;">คุณสามารถจองคิวรับบริการใหม่ได้ที่แท็บ "จองคิวใหม่"</div>
            </div>
        `;
        return;
    }

    container.innerHTML = appts.map(a => {
        const isCheckedIn = a.checkedIn;
        return `
            <div class="mobile-appt-card">
                <div class="appt-card-top">
                    <span class="appt-date-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>วันที่ ${a.date}</span>
                    </span>
                    <span class="appt-time-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>${a.time} น.</span>
                    </span>
                </div>
                <div class="appt-patient-info">
                    <strong>${a.name}</strong>
                    <span>${a.hn} • รหัสนัด: ${a.id}</span>
                </div>
                <div class="appt-doctor-dept">
                    <span class="appt-dept-icon">${getDeptSvgIcon(a.department)}</span>
                    <span>${a.department}</span>
                    <span>•</span>
                    <span>${a.doctor || 'แพทย์เวรประจำแผนก'}</span>
                </div>
                <div class="appt-actions-row">
                    ${isCheckedIn ? `
                        <span style="font-size:0.78rem; color:#4F46E5; font-weight:600; padding:6px 0; display:flex; align-items:center; gap:4px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                            เช็คอินเข้าระบบคิวแล้ว
                        </span>
                    ` : `
                        <button type="button" class="btn-appt-checkin-mobile" onclick="mobileCheckInAppt('${a.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>เช็คอินรับคิวตรวจทันที</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function mobileCheckInAppt(apptId) {
    const appt = (mobileState.appointments || []).find(a => a.id === apptId);
    if (!appt) return;

    if (appt.checkedIn) {
        showMobileToast('นัดหมายนี้ทำการเช็คอินแล้ว');
        return;
    }

    // Generate queue
    const prefix = DEPT_PREFIX_MAP[appt.department] || 'M';
    mobileQueueCounter++;
    const qNum = `${prefix}-${String(mobileQueueCounter).padStart(3, '0')}`;

    loadSharedQueueState();
    if (!mobileState.queueState) mobileState.queueState = {};
    if (!mobileState.queueState.waitingQueue) mobileState.queueState.waitingQueue = [];

    const newQueueItem = {
        id: 'q_appt_' + Date.now(),
        queueNumber: qNum,
        type: 'appointment',
        appointmentTime: appt.time,
        patientName: appt.name,
        hn: appt.hn,
        department: appt.department,
        enteredAt: new Date().toISOString(),
        isLate: false,
        lateMessage: '',
        apptId: appt.id
    };

    mobileState.queueState.waitingQueue.unshift(newQueueItem);
    mobileState.queueState.lastUpdatedBy = 'patient_mobile';
    mobileState.queueState.timestamp = Date.now();

    appt.checkedIn = true;

    localStorage.setItem('hospitalQueueState', JSON.stringify(mobileState.queueState));
    localStorage.setItem('hospitalAppointments', JSON.stringify(mobileState.appointments));

    mobileState.trackedQueueItem = {
        item: newQueueItem,
        stage: 'waiting',
        stageLabel: 'เช็คอินสำเร็จ - กำลังรอเรียกตรวจ'
    };

    playHospitalChime();
    renderMobileAppointments();
    switchMobileNav('view-my-queue');
    renderTicket();

    showMobileToast(`เช็คอินสำเร็จ! หมายเลขคิวของคุณคือ ${qNum}`);
}

// ============ TAB 4: DEPARTMENT TRAFFIC ============
function renderDepartmentTraffic() {
    const container = document.getElementById('dept-traffic-cards');
    if (!container) return;

    loadSharedQueueState();
    const waitList = mobileState.queueState?.waitingQueue || [];
    const roomsList = mobileState.queueState?.rooms || [];

    container.innerHTML = DEPARTMENTS.map(d => {
        const waitingInDept = waitList.filter(q => q.department === d.name).length;
        const activeRooms = roomsList.filter(r => r.department === d.name && r.patient !== null).length;
        const totalActive = waitingInDept + activeRooms;

        let statusClass = 'normal';
        let statusLabel = 'คิวปกติ';
        if (totalActive >= 4) {
            statusClass = 'high';
            statusLabel = 'หนาแน่น';
        } else if (totalActive >= 2) {
            statusClass = 'moderate';
            statusLabel = 'ปานกลาง';
        }

        const estWait = totalActive === 0 ? '< 10 นาที' : `~ ${totalActive * d.avgWait} นาที`;

        return `
            <div class="traffic-card">
                <div class="traffic-left">
                    <div class="traffic-icon-bubble">
                        ${getDeptSvgIcon(d.name)}
                    </div>
                    <div class="traffic-name-group">
                        <strong>แผนก${d.name}</strong>
                        <span>รอตรวจ ${waitingInDept} คิว • เปิดตรวจ ${activeRooms} ห้อง</span>
                    </div>
                </div>
                <div class="traffic-right">
                    <span class="traffic-pill ${statusClass}">
                        <span class="traffic-dot ${statusClass}"></span>
                        <span>${statusLabel}</span>
                    </span>
                    <div class="traffic-est">รอคอย ${estWait}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============ NAVIGATION TABS ============
function switchMobileNav(viewId) {
    mobileState.currentTab = viewId;

    document.querySelectorAll('.mobile-tab-view').forEach(view => {
        view.classList.toggle('active', view.id === viewId);
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === viewId);
    });

    if (viewId === 'view-my-queue') {
        renderTicket();
    } else if (viewId === 'view-appointments') {
        renderMobileAppointments();
    } else if (viewId === 'view-hospital') {
        renderDepartmentTraffic();
    }

    // Scroll to top
    const scrollContainer = document.getElementById('mobile-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
}

// ============ VIEW MODE TOGGLE (FRAME / FULL WIDTH) ============
function toggleViewMode(mode) {
    const frame = document.getElementById('smartphone-frame');
    const btnFrame = document.getElementById('btn-device-frame');
    const btnFull = document.getElementById('btn-full-width');

    if (!frame) return;

    if (mode === 'full') {
        frame.classList.add('full-width-mode');
        btnFrame.classList.remove('active');
        btnFull.classList.add('active');
    } else {
        frame.classList.remove('full-width-mode');
        btnFrame.classList.add('active');
        btnFull.classList.remove('active');
    }
}

// ============ TOAST ============
function showMobileToast(msg) {
    const toast = document.getElementById('mobile-toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// ============ REAL-TIME CLOCK ============
function updateMobileClock() {
    const now = new Date();
    const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const dateEl = document.getElementById('mobile-date');
    if (dateEl) {
        const d = now.getDate();
        const m = thaiMonths[now.getMonth()];
        const y = now.getFullYear() + 543;
        const day = thaiDays[now.getDay()];
        dateEl.textContent = `วัน${day}ที่ ${d} ${m} ${y}`;
    }

    const timeEl = document.getElementById('mobile-time');
    if (timeEl) {
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${h}:${min}`;
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    loadSharedQueueState();
    renderTicket();
    renderDepartmentTraffic();
    renderMobileAppointments();
    updateMobileClock();

    setInterval(updateMobileClock, 1000);

    // Auto-refresh queue every 8 seconds
    setInterval(() => {
        refreshQueueData(false);
    }, 8000);

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
        if (e.key === 'hospitalQueueState' || e.key === 'hospitalAppointments') {
            loadSharedQueueState();
            refreshQueueData(false);
        }
    });
});
