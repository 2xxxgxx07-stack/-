/* ===================================================
   SMART HOSPITAL MOBILE QUEUE APP - JAVASCRIPT LOGIC
   =================================================== */

const mobileState = {
    currentTab: 'view-home',
    trackedQueueId: null,
    trackedQueueItem: null,
    selectedDeptBooking: 'อายุรกรรม',
    bookingServiceType: 'walkin',
    queueState: null,
    appointments: [],
    activeAppointment: null,
    appointmentHistory: []
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

    // Active Appointment for patient (Single Active Appointment rule)
    try {
        const savedActive = localStorage.getItem('hospitalPatientActiveAppt');
        if (savedActive !== null) {
            const parsed = JSON.parse(savedActive);
            mobileState.activeAppointment = (parsed && parsed.status === 'active') ? parsed : null;
        } else {
            // First time initialization: initialize with the exact appointment from user screenshot!
            mobileState.activeAppointment = {
                id: 'E1532',
                ticketPreQueue: 'E1532',
                name: 'คุณสมศักดิ์ รักสงบ',
                hn: '67-048123',
                department: 'อายุรกรรม',
                building: 'อาคารเฉลิมพระเกียรติ ชั้น 2',
                room: 'คลินิกอายุรกรรม 02 | ห้องตรวจ 204',
                fullLocation: 'อาคารเฉลิมพระเกียรติ ชั้น 2 | คลินิกอายุรกรรม 02 | ห้องตรวจ 204',
                dateDisplay: 'วันจันทร์ที่ 27 ต.ค. 2567',
                dateBadge: 'อีก 3 วัน',
                date: '2024-10-27',
                time: '10:30 - 11:30 น.',
                doctor: 'นพ. วิจัย เปี่ยมประสิทธิ์ (อายุรแพทย์)',
                status: 'active',
                checkedIn: false
            };
            localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify(mobileState.activeAppointment));
        }
    } catch (e) {
        console.error('Error loading active appointment:', e);
    }

    try {
        const historySaved = localStorage.getItem('hospitalPatientApptHistory');
        if (historySaved) {
            mobileState.appointmentHistory = JSON.parse(historySaved);
        }
    } catch (e) {
        console.error('Error loading appt history:', e);
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

    // Default to คุณสมศักดิ์ รักสงบ (M-201) matching user screenshot
    if (!mobileState.trackedQueueItem) {
        const somsak = (mobileState.queueState?.waitingQueue || []).find(q => 
            (q.patientName && q.patientName.includes('สมศักดิ์')) || q.queueNumber === 'M-201'
        );
        if (somsak) {
            mobileState.trackedQueueItem = {
                item: somsak,
                stage: 'waiting',
                stageLabel: 'กำลังรอเรียกเข้าห้องตรวจ'
            };
        } else {
            mobileState.trackedQueueItem = {
                item: {
                    queueNumber: 'M-201',
                    patientName: 'คุณสมศักดิ์ รักสงบ',
                    hn: 'HN - 048123',
                    department: 'อายุรกรรม',
                    roomName: 'ห้องตรวจ 1-4',
                    queuesAhead: 0,
                    estMinutes: 12
                },
                stage: 'waiting',
                stageLabel: 'กำลังรอเรียกเข้าห้องตรวจ'
            };
        }
    }

    const tracked = mobileState.trackedQueueItem;
    if (!tracked || !tracked.item) return;

    const p = tracked.item;

    // 1. Queue Number, Name, HN
    const qNumEl = document.getElementById('ticket-queue-num');
    if (qNumEl) qNumEl.textContent = p.queueNumber || 'M-201';

    const pNameEl = document.getElementById('ticket-patient-name');
    if (pNameEl) pNameEl.textContent = p.patientName || 'คุณสมศักดิ์ รักสงบ';

    const pHnEl = document.getElementById('ticket-patient-hn');
    if (pHnEl) {
        let hnText = p.hn || 'HN - 048123';
        if (/^HN\s*[-:]?\s*/i.test(hnText)) {
            hnText = hnText.replace(/^HN\s*[-:]?\s*/i, 'HN - ');
        } else {
            hnText = `HN - ${hnText}`;
        }
        pHnEl.textContent = hnText;
    }

    // 2. Status Pill
    const statusText = document.getElementById('ticket-status-text');
    if (statusText) {
        statusText.textContent = tracked.stageLabel || 'กำลังรอเรียกเข้าห้องตรวจ';
    }

    // 3. Calculate Queues Ahead & Est Wait
    let queuesAhead = 0;
    let estMinutes = 12;
    let targetRoom = 'ห้องตรวจ 1-4';

    if (mobileState.queueState?.waitingQueue && mobileState.queueState.waitingQueue.length > 0) {
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
    } else {
        queuesAhead = p.queuesAhead !== undefined ? p.queuesAhead : 0;
        estMinutes = p.estMinutes !== undefined ? p.estMinutes : 12;
        targetRoom = p.roomName || 'ห้องตรวจ 1-4';
    }

    const qAheadEl = document.getElementById('ticket-queues-ahead');
    if (qAheadEl) qAheadEl.textContent = queuesAhead;

    const estWaitEl = document.getElementById('ticket-est-wait');
    if (estWaitEl) {
        estWaitEl.textContent = estMinutes === 0 ? 'ถึงคิวคุณแล้ว' : `~ ${estMinutes}`;
    }

    const roomEl = document.getElementById('ticket-target-room');
    if (roomEl) roomEl.textContent = targetRoom;

    // 4. Update Stepper (5 Steps)
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

    steps.forEach((s, i) => {
        if (!s) return;
        s.className = 'eticket-step-item';
        const circle = s.querySelector('.eticket-step-circle') || s.querySelector('.step-circle');
        if (circle) circle.textContent = i + 1;
    });
    lines.forEach(l => { if (l) l.className = 'eticket-step-line'; });

    // Step 1 active by default
    if (steps[0]) steps[0].classList.add('active');

    if (stage === 'lab') {
        if (steps[1]) steps[1].classList.add('active');
        if (lines[0]) lines[0].classList.add('active');
    } else if (stage === 'waiting' || stage === 'waiting_room') {
        if (steps[0]) steps[0].classList.add('active');
    } else if (stage === 'examining') {
        if (steps[0]) steps[0].classList.add('active');
        if (steps[1]) steps[1].classList.add('active');
        if (steps[2]) steps[2].classList.add('active');
        if (steps[3]) steps[3].classList.add('active');
        if (lines[0]) lines[0].classList.add('active');
        if (lines[1]) lines[1].classList.add('active');
        if (lines[2]) lines[2].classList.add('active');
    } else if (stage === 'done') {
        steps.forEach((s, idx) => {
            if (s) s.classList.add('active');
            if (lines[idx]) lines[idx].classList.add('active');
        });
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

// ============ NEW BOOKING FORM (MATCHING USER SCREENSHOT) ============
function selectTimeChip(buttonEl) {
    if (!buttonEl) return;
    document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
    buttonEl.classList.add('active');
    const timeVal = buttonEl.getAttribute('data-time') || '08:30 - 09:30';
    const hidden = document.getElementById('selected-booking-time');
    if (hidden) hidden.value = timeVal;
}

function openNativeDatePicker() {
    const input = document.getElementById('new-book-date');
    if (!input) return;
    if (typeof input.showPicker === 'function') {
        input.showPicker();
    } else {
        input.focus();
        input.click();
    }
}

function onDateSelected(inputEl) {
    if (!inputEl || !inputEl.value) return;
    const val = inputEl.value; // YYYY-MM-DD
    const parts = val.split('-');
    if (parts.length === 3) {
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const year = parseInt(parts[0], 10) + 543;
        const month = thaiMonths[parseInt(parts[1], 10) - 1];
        const day = parseInt(parts[2], 10);
        const displayEl = document.getElementById('new-book-date-display');
        if (displayEl) {
            displayEl.value = `${day} ${month} ${year}`;
        }
    }
}

function handleQuickAppointmentAction() {
    loadSharedQueueState();
    if (mobileState.activeAppointment && mobileState.activeAppointment.status === 'active') {
        switchMobileNav('view-appointments');
    } else {
        switchMobileNav('view-booking');
    }
}

function submitNewBookingForm(e) {
    if (e) e.preventDefault();

    loadSharedQueueState();

    // Check if user already has an active appointment (Single appointment per user constraint)
    if (mobileState.activeAppointment && mobileState.activeAppointment.status === 'active') {
        showMobileToast('⚠️ คุณมีนัดหมายที่ยังไม่เสร็จสิ้นอยู่แล้ว (ระบบอนุญาต 1 นัดหมายต่อครั้ง)');
        switchMobileNav('view-appointments');
        return;
    }

    const deptEl = document.getElementById('new-book-dept');
    const dept = deptEl?.value;
    if (!dept) {
        showMobileToast('กรุณาเลือกแผนกที่ต้องการตรวจ');
        deptEl?.focus();
        return;
    }

    const dateVal = document.getElementById('new-book-date-display')?.value || document.getElementById('new-book-date')?.value;
    if (!dateVal) {
        showMobileToast('กรุณาเลือกวันตรวจ');
        openNativeDatePicker();
        return;
    }

    const timeSlot = document.getElementById('selected-booking-time')?.value || '08:30 - 09:30';
    const notes = document.getElementById('new-book-notes')?.value.trim() || '';

    // Generate Pre-queue Code: prefix + 4 digits (e.g. E1532, M2409, D5123)
    const prefix = DEPT_PREFIX_MAP[dept] || 'M';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const preQueueCode = `${prefix}${randomNum}`;

    // Patient info
    const patientName = 'คุณสมศักดิ์ รักสงบ';
    const hn = '67-048123';

    const newAppt = {
        id: preQueueCode,
        ticketPreQueue: preQueueCode,
        name: patientName,
        hn: hn,
        department: dept,
        building: 'อาคารเฉลิมพระเกียรติ ชั้น 2',
        room: `คลินิก${dept} 02 | ห้องตรวจ 204`,
        fullLocation: `อาคารเฉลิมพระเกียรติ ชั้น 2 | คลินิก${dept} 02 | ห้องตรวจ 204`,
        dateDisplay: dateVal.includes('วัน') ? dateVal : `วันนัดตรวจ: ${dateVal}`,
        dateBadge: 'อีก 3 วัน',
        date: dateVal,
        time: timeSlot,
        notes: notes,
        doctor: `แพทย์เวรประจำแผนก${dept}`,
        status: 'active',
        checkedIn: false
    };

    mobileState.activeAppointment = newAppt;
    localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify(newAppt));

    if (!mobileState.appointments) mobileState.appointments = [];
    mobileState.appointments.unshift(newAppt);
    localStorage.setItem('hospitalAppointments', JSON.stringify(mobileState.appointments));

    // Play chime sound
    playHospitalChime();

    // Reset fields
    if (deptEl) deptEl.selectedIndex = 0;
    const dateDisp = document.getElementById('new-book-date-display');
    if (dateDisp) dateDisp.value = '';
    const dateNative = document.getElementById('new-book-date');
    if (dateNative) dateNative.value = '';
    const notesEl = document.getElementById('new-book-notes');
    if (notesEl) notesEl.value = '';

    showMobileToast(`✅ นัดหมายสำเร็จ! รหัสคิวล่วงหน้า: ${preQueueCode}`);

    updateBookingLockBanner();
    updateNextApptHomeCard();

    // Switch to appointments tab to see new appointment ticket
    setTimeout(() => {
        switchMobileNav('view-appointments');
    }, 400);
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

// ============ TAB 3: APPOINTMENT TICKET & QR CODE (MATCHING USER UI) ============

/**
 * Generates an authentic, crisp vector SVG QR Code
 * Contains real corner finder patterns, timing rows, alignment pattern, and dense data modules.
 */
function generateCrispQrSvg(code, size = 170) {
    const N = 29;
    const grid = Array(N).fill(null).map(() => Array(N).fill(false));

    function drawFinder(r, c) {
        for (let dr = 0; dr < 7; dr++) {
            for (let dc = 0; dc < 7; dc++) {
                if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
                    grid[r + dr][c + dc] = true;
                }
            }
        }
    }

    drawFinder(1, 1);    // Top-Left
    drawFinder(1, 21);   // Top-Right
    drawFinder(21, 1);   // Bottom-Left

    // Separators
    for (let i = 0; i < 8; i++) {
        if (i < N && 8 < N) grid[8][i] = false;
        if (i < N && 8 < N) grid[i][8] = false;
        if (i < N && 20 < N) grid[8][20 + i] = false;
        if (20 + i < N && 8 < N) grid[20 + i][8] = false;
    }

    // Timing patterns
    for (let i = 8; i < 21; i++) {
        grid[6][i] = (i % 2 === 0);
        grid[i][6] = (i % 2 === 0);
    }

    // Alignment pattern
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) {
                grid[20 + dr][20 + dc] = true;
            }
        }
    }

    // Hash seed from appointment code
    let hash = 0;
    const str = String(code || 'E1532') + '|HOSPITAL_TICKET_PREQUEUE';
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    function seededRandom(step) {
        const x = Math.sin(hash + step) * 10000;
        return x - Math.floor(x);
    }

    let step = 1;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const inTL = r < 9 && c < 9;
            const inTR = r < 9 && c > 19;
            const inBL = r > 19 && c < 9;
            const inAlign = r >= 18 && r <= 22 && c >= 18 && c <= 22;
            const inTiming = r === 6 || c === 6;

            if (!inTL && !inTR && !inBL && !inAlign && !inTiming) {
                step++;
                grid[r][c] = seededRandom(step) > 0.48;
            }
        }
    }

    let rects = '';
    const cellSize = 100 / N;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (grid[r][c]) {
                const x = (c * cellSize).toFixed(2);
                const y = (r * cellSize).toFixed(2);
                const s = cellSize.toFixed(2);
                rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#0F172A"/>`;
            }
        }
    }

    return `
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
            <rect width="100" height="100" fill="#FFFFFF"/>
            ${rects}
        </svg>
    `;
}

function renderMobileAppointments() {
    const container = document.getElementById('mobile-appointments-view-content');
    if (!container) return;

    loadSharedQueueState();
    const appt = mobileState.activeAppointment;

    // Check if user has an active appointment
    if (appt && appt.status === 'active') {
        const qrSvg = generateCrispQrSvg(appt.ticketPreQueue || 'E1532', 170);

        container.innerHTML = `
            <!-- CARD 1: E-Ticket Pre-queue Voucher Card (Exact Match with Image) -->
            <div class="appt-ticket-card">
                <div class="ticket-top-row">
                    <div class="ticket-cal-icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </div>
                    <div class="ticket-info-col">
                        <div class="ticket-date-row">
                            <h3 class="ticket-date-title">${appt.dateDisplay || 'วันจันทร์ที่ 27 ต.ค. 2567'}</h3>
                            <span class="ticket-days-badge">${appt.dateBadge || 'อีก 3 วัน'}</span>
                        </div>
                        <div class="ticket-time-row">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span>ช่วงเวลาตรวจ: <strong>${appt.time || '10:30 - 11:30 น.'}</strong></span>
                        </div>
                        <div class="ticket-location-row">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span>${appt.fullLocation || 'อาคารเฉลิมพระเกียรติ ชั้น 2 | คลินิกอายุรกรรม 02 | ห้องตรวจ 204'}</span>
                        </div>
                    </div>
                </div>

                <!-- Perforation Line with Half-Circle Cutouts -->
                <div class="ticket-perforation-divider">
                    <div class="ticket-notch notch-left"></div>
                    <div class="ticket-dash-line"></div>
                    <div class="ticket-notch notch-right"></div>
                </div>

                <!-- Pre-queue Code, QR Code and Action Button -->
                <div class="ticket-qr-center-wrap">
                    <div class="ticket-prequeue-header">
                        <span>คิวล่วงหน้า (Ticket Pre-queue):</span>
                        <strong class="ticket-prequeue-code">${appt.ticketPreQueue || 'E1532'}</strong>
                    </div>

                    <div class="qr-viewfinder-frame" onclick="openQrZoomModal()" title="แตะเพื่อขยาย QR Code" style="cursor: pointer;">
                        <span class="qr-corner-bracket bracket-tl"></span>
                        <span class="qr-corner-bracket bracket-tr"></span>
                        <span class="qr-corner-bracket bracket-bl"></span>
                        <span class="qr-corner-bracket bracket-br"></span>
                        <div class="qr-code-img-wrap">
                            ${qrSvg}
                        </div>
                    </div>

                    <div class="ticket-kiosk-hint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                            <line x1="12" y1="18" x2="12.01" y2="18"/>
                        </svg>
                        <span>แสดง QR Code นี้ที่หน้า Kiosk เพื่อรับบัตรคิว</span>
                    </div>

                    <button type="button" class="btn-zoom-qr" onclick="openQrZoomModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <span>แตะเพื่อขยาย QR Code</span>
                    </button>
                </div>
            </div>

            <!-- TWO ACTION BUTTONS (DIRECTLY UNDER TICKET CARD MATCHING IMAGE) -->
            <div class="appt-ticket-action-btns">
                <button type="button" class="btn-ticket-cancel" onclick="cancelActiveAppointment()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>ยกเลิกนัดหมาย</span>
                </button>
                <button type="button" class="btn-ticket-reschedule" onclick="openRescheduleModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>เลื่อนนัดหมาย</span>
                </button>
            </div>

            <!-- CARD 2: Pre-examination Guidelines Card (Exact Match with Image) -->
            <div class="appt-guidelines-card">
                <div class="guidelines-header">
                    <div class="guidelines-icon-box">📋</div>
                    <h4 class="guidelines-title">ข้อควรปฏิบัติก่อนพบแพทย์</h4>
                </div>
                <ul class="guidelines-list">
                    <li class="guideline-item">
                        <span class="guideline-check-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <div class="guideline-text">
                            กรุณามาก่อนเวลานัดหมาย <strong>20-30 นาที</strong> เพื่อวัดความดัน ชั่งน้ำหนัก และคัดกรองอาการเบื้องต้น
                        </div>
                    </li>
                    <li class="guideline-item">
                        <span class="guideline-check-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <div class="guideline-text">
                            <strong>งดน้ำและอาหารหลังเที่ยงคืน</strong> (กรณีมีรายการเจาะตรวจเลือดประจำปีหรืออัลตราซาวด์) จิบน้ำเปล่าได้เล็กน้อย
                        </div>
                    </li>
                    <li class="guideline-item">
                        <span class="guideline-check-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <div class="guideline-text">
                            โปรดนำ <strong>ยาเดิมที่รับประทานประจำ</strong> และประวัติการรักษาเดิมมาด้วย เพื่อความต่อเนื่องในการรักษา
                        </div>
                    </li>
                    <li class="guideline-item">
                        <span class="guideline-check-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <div class="guideline-text">
                            แสดงบัตรประชาชนหรือบัตรคิวดิจิทัล (E-Ticket) ที่ตู้ Kiosk หรือเคาน์เตอร์พยาบาลชั้น 2
                        </div>
                    </li>
                </ul>
            </div>

            <!-- CONVENIENCE SERVICES SECTION (บริการอำนวยความสะดวก) -->
            <div class="appt-services-section">
                <h4 class="appt-services-title">บริการอำนวยความสะดวก</h4>
                
                <div class="appt-services-list">
                    <!-- Item 1: แผนที่ไปโรงพยาบาล & อาคารตรวจ -->
                    <div class="appt-service-card" onclick="openHospitalMapModal()">
                        <div class="service-card-left">
                            <div class="service-icon-box green-tint">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="20" height="20">
                                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                                    <line x1="8" y1="2" x2="8" y2="18"></line>
                                    <line x1="16" y1="6" x2="16" y2="22"></line>
                                </svg>
                            </div>
                            <div class="service-card-info">
                                <strong class="service-title">แผนที่ไปโรงพยาบาล & อาคารตรวจ</strong>
                                <span class="service-desc">แตะเพื่อดูผังอาคารของโรงพยาบาล</span>
                            </div>
                        </div>
                        <div class="service-chevron">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <!-- Item 2: ขั้นตอนการสแกนตู้ Kiosk -->
                    <div class="appt-service-card" onclick="openKioskGuideModal()">
                        <div class="service-card-left">
                            <div class="service-icon-box blue-tint">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="20" height="20">
                                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path>
                                    <rect x="7" y="7" width="10" height="10"></rect>
                                </svg>
                            </div>
                            <div class="service-card-info">
                                <div class="service-title-row">
                                    <strong class="service-title">ขั้นตอนการสแกนตู้ Kiosk</strong>
                                    <span class="service-pill-badge">4 ขั้นตอน</span>
                                </div>
                                <span class="service-desc">วิธีพิมพ์ใบนำทางและลำดับคิวด้วยตนเอง</span>
                            </div>
                        </div>
                        <div class="service-chevron">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <!-- Item 3: ต้องการสอบถามเพิ่มเติม? -->
                    <a href="tel:025558900" class="appt-service-card" style="text-decoration: none;">
                        <div class="service-card-left">
                            <div class="service-icon-box teal-tint">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                            </div>
                            <div class="service-card-info">
                                <strong class="service-title">ต้องการสอบถามเพิ่มเติม?</strong>
                                <span class="service-desc">โทร <strong>02-555-8900</strong> ต่อ 204 (เคาน์เตอร์พยาบาล)</span>
                            </div>
                        </div>
                        <div class="service-chevron">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </a>
                </div>
            </div>

            <div class="appt-dev-complete-row">
                <button type="button" class="btn-appt-finish-subtle" onclick="completeActiveAppointment()" title="คลิกเพื่อจบการนัดหมายนี้ เพื่อทดสอบการจองนัดใหม่">
                    (จำลองตรวจเสร็จสิ้น / จบการนัดหมาย เพื่อทดสอบการจองใหม่)
                </button>
            </div>
        `;
    } else {
        // RENDER NO ACTIVE APPOINTMENT / COMPLETED STATE (CAN BOOK AGAIN)
        const historyList = mobileState.appointmentHistory || [];
        const lastAppt = historyList[0];

        container.innerHTML = `
            <div class="appt-no-active-wrap">
                <div class="appt-completed-banner-card">
                    <div class="completed-banner-icon">✓</div>
                    <h3 class="completed-banner-title">การนัดหมายเสร็จสิ้นแล้ว</h3>
                    <p class="completed-banner-desc">
                        คุณไม่มีรายการนัดหมายที่รอรับบริการอยู่ในขณะนี้<br>
                        <strong>สามารถทำการจองนัดหมายแพทย์ครั้งใหม่ได้ทันที</strong>
                    </p>
                    <button type="button" class="btn-start-rebooking" onclick="switchMobileNav('view-booking')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                            <line x1="12" y1="14" x2="12" y2="18"/>
                            <line x1="10" y1="16" x2="14" y2="16"/>
                        </svg>
                        <span>นัดหมายแพทย์ครั้งใหม่</span>
                    </button>
                </div>

                ${lastAppt ? `
                    <div class="appt-past-history-box">
                        <div class="past-history-header">
                            <span class="past-history-title">ประวัติการนัดหมายล่าสุด</span>
                            <span class="past-history-badge">เสร็จสิ้นแล้ว</span>
                        </div>
                        <div class="past-history-item">
                            <div class="past-item-info">
                                <strong>${lastAppt.department} • รหัส: ${lastAppt.ticketPreQueue || lastAppt.id}</strong>
                                <span>วันที่: ${lastAppt.dateDisplay || lastAppt.date} (${lastAppt.time})</span>
                            </div>
                            <span class="past-item-status">จบการนัดหมาย</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

/**
 * Complete Active Appointment: Ends the appointment, moves to history, and enables rebooking
 */
function completeActiveAppointment() {
    if (!mobileState.activeAppointment) return;

    const appt = { ...mobileState.activeAppointment, status: 'completed', completedAt: new Date().toISOString() };
    if (!mobileState.appointmentHistory) mobileState.appointmentHistory = [];
    mobileState.appointmentHistory.unshift(appt);
    mobileState.activeAppointment = null;

    localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify({ status: 'completed' }));
    localStorage.setItem('hospitalPatientApptHistory', JSON.stringify(mobileState.appointmentHistory));

    showMobileToast('✅ จบการนัดหมายเรียบร้อยแล้ว ท่านสามารถทำการนัดหมายใหม่ได้ทันที');
    playHospitalChime();
    renderMobileAppointments();
    updateBookingLockBanner();
    updateNextApptHomeCard();
}

/**
 * Cancel Active Appointment: Cancels the appointment, enables rebooking
 */
function cancelActiveAppointment() {
    if (!mobileState.activeAppointment) return;

    if (!confirm('ต้องการยกเลิกการนัดหมายนี้ใช่หรือไม่? หลังจากยกเลิกแล้ว ท่านสามารถนัดหมายใหม่ได้ทันที')) {
        return;
    }

    const appt = { ...mobileState.activeAppointment, status: 'cancelled', cancelledAt: new Date().toISOString() };
    if (!mobileState.appointmentHistory) mobileState.appointmentHistory = [];
    mobileState.appointmentHistory.unshift(appt);
    mobileState.activeAppointment = null;

    localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify({ status: 'cancelled' }));
    localStorage.setItem('hospitalPatientApptHistory', JSON.stringify(mobileState.appointmentHistory));

    showMobileToast('ยกเลิกการนัดหมายเรียบร้อยแล้ว');
    renderMobileAppointments();
    updateBookingLockBanner();
    updateNextApptHomeCard();
}

/**
 * Reschedule Modal Handlers
 */
function openRescheduleModal() {
    const modal = document.getElementById('modal-reschedule');
    if (!modal) return;

    const appt = mobileState.activeAppointment || {
        ticketPreQueue: 'E1532',
        dateDisplay: 'วันจันทร์ที่ 27 ต.ค. 2567',
        time: '10:30 - 11:30 น.'
    };

    const sub = document.getElementById('reschedule-modal-sub');
    if (sub) sub.textContent = `รหัสคิวล่วงหน้า: ${appt.ticketPreQueue || 'E1532'}`;

    const currentDt = document.getElementById('reschedule-current-datetime');
    if (currentDt) currentDt.textContent = `${appt.dateDisplay || 'วันจันทร์ที่ 27 ต.ค. 2567'} (${appt.time || '10:30 - 11:30 น.'})`;

    // Reset date picker
    const dateDisp = document.getElementById('reschedule-date-display');
    if (dateDisp) dateDisp.value = '';
    const dateNative = document.getElementById('reschedule-date-native');
    if (dateNative) dateNative.value = '';

    modal.classList.add('active');
}

function closeRescheduleModal(e) {
    if (e && e.target && e.target !== e.currentTarget && !e.target.classList.contains('modal-close-btn') && !e.target.closest('.btn-modal-close-subtle')) {
        return;
    }
    const modal = document.getElementById('modal-reschedule');
    if (modal) modal.classList.remove('active');
}

function openRescheduleDatePicker() {
    const input = document.getElementById('reschedule-date-native');
    if (input) {
        if (typeof input.showPicker === 'function') {
            input.showPicker();
        } else {
            input.focus();
            input.click();
        }
    }
}

function onRescheduleDateSelected(input) {
    const val = input.value;
    if (!val) return;
    const parts = val.split('-');
    if (parts.length === 3) {
        const thaiMonths = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayName = thaiDays[dObj.getDay()];
        const year = parseInt(parts[0], 10) + 543;
        const month = thaiMonths[parseInt(parts[1], 10) - 1];
        const day = parseInt(parts[2], 10);
        const displayEl = document.getElementById('reschedule-date-display');
        if (displayEl) {
            displayEl.value = `วัน${dayName}ที่ ${day} ${month} ${year}`;
        }
    }
}

function selectRescheduleTime(btn) {
    document.querySelectorAll('#reschedule-time-grid .time-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const hidden = document.getElementById('selected-reschedule-time');
    if (hidden) hidden.value = btn.getAttribute('data-time');
}

function confirmRescheduleAppointment() {
    if (!mobileState.activeAppointment) return;

    const dateVal = document.getElementById('reschedule-date-display')?.value;
    if (!dateVal) {
        showMobileToast('กรุณาเลือกวันตรวจใหม่');
        openRescheduleDatePicker();
        return;
    }

    const timeSlot = document.getElementById('selected-reschedule-time')?.value || '10:30 - 11:30 น.';

    mobileState.activeAppointment.dateDisplay = dateVal;
    mobileState.activeAppointment.time = timeSlot.includes('น.') ? timeSlot : `${timeSlot} น.`;
    mobileState.activeAppointment.dateBadge = 'เลื่อนนัดแล้ว';

    localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify(mobileState.activeAppointment));

    closeRescheduleModal();
    playHospitalChime();
    renderMobileAppointments();
    updateNextApptHomeCard();
    showMobileToast('✅ เลื่อนนัดหมายเรียบร้อยแล้ว!');
}

/**
 * Open Zoomed QR Code Modal
 */
function openQrZoomModal() {
    const modal = document.getElementById('modal-qr-zoom');
    if (!modal) return;

    const appt = mobileState.activeAppointment || {
        ticketPreQueue: 'E1532',
        dateDisplay: 'วันจันทร์ที่ 27 ต.ค. 2567',
        time: '10:30 - 11:30 น.',
        fullLocation: 'อาคารเฉลิมพระเกียรติ ชั้น 2 | คลินิกอายุรกรรม 02 | ห้องตรวจ 204'
    };

    const container = document.getElementById('qr-zoom-svg-container');
    if (container) {
        container.innerHTML = generateCrispQrSvg(appt.ticketPreQueue || 'E1532', 210);
    }

    const codeDisp = document.getElementById('qr-zoom-code-display');
    if (codeDisp) codeDisp.textContent = appt.ticketPreQueue || 'E1532';

    const dateDisp = document.getElementById('qr-zoom-date-time');
    if (dateDisp) dateDisp.textContent = `📅 ${appt.dateDisplay || 'วันจันทร์ที่ 27 ต.ค. 2567'} • ${appt.time || '10:30 - 11:30 น.'}`;

    const locDisp = document.getElementById('qr-zoom-dept-room');
    if (locDisp) locDisp.textContent = `📍 ${appt.fullLocation || 'อาคารเฉลิมพระเกียรติ ชั้น 2 | คลินิกอายุรกรรม 02 | ห้องตรวจ 204'}`;

    modal.classList.add('active');
}

/**
 * Close Zoomed QR Code Modal
 */
function closeQrZoomModal(e) {
    if (e && e.target && e.target !== e.currentTarget && !e.target.classList.contains('modal-close-btn') && !e.target.closest('.btn-modal-close-subtle')) {
        return;
    }
    const modal = document.getElementById('modal-qr-zoom');
    if (modal) modal.classList.remove('active');
}

/**
 * Simulate Scanning Pre-queue QR Code at Kiosk Touch Screen
 */
function simulateScanAtKiosk() {
    closeQrZoomModal();
    showMobileToast('🔍 กำลังจำลองการสแกน QR Code ที่ตู้ Kiosk...');

    setTimeout(() => {
        const appt = mobileState.activeAppointment;
        const qNum = appt ? appt.ticketPreQueue : 'E1532';

        loadSharedQueueState();
        if (!mobileState.queueState) mobileState.queueState = {};
        if (!mobileState.queueState.waitingQueue) mobileState.queueState.waitingQueue = [];

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const queueItem = {
            id: 'q_kios_' + Date.now(),
            queueNumber: qNum,
            type: 'appointment',
            appointmentTime: timeStr,
            patientName: 'คุณสมศักดิ์ รักสงบ',
            hn: '67-048123',
            department: appt ? appt.department : 'อายุรกรรม',
            enteredAt: now.toISOString(),
            isLate: false,
            lateMessage: '',
            bookingSource: 'Smart Kiosk (สแกน QR ใบนัด)'
        };

        mobileState.queueState.waitingQueue.unshift(queueItem);
        mobileState.queueState.lastUpdatedBy = 'patient_mobile';
        mobileState.queueState.timestamp = Date.now();

        localStorage.setItem('hospitalQueueState', JSON.stringify(mobileState.queueState));

        mobileState.trackedQueueItem = {
            item: queueItem,
            stage: 'waiting',
            stageLabel: 'สแกนรับบัตรคิวที่ Kiosk สำเร็จ - รอเรียกตรวจ'
        };

        if (mobileState.activeAppointment) {
            mobileState.activeAppointment.checkedIn = true;
            localStorage.setItem('hospitalPatientActiveAppt', JSON.stringify(mobileState.activeAppointment));
        }

        playHospitalChime();
        showMobileToast(`✅ สแกนสำเร็จ! ได้รับบัตรคิวหมายเลข ${qNum}`);

        switchMobileNav('view-my-queue');
    }, 600);
}

function updateBookingLockBanner() {
    const banner = document.getElementById('booking-active-lock-banner');
    if (!banner) return;
    const hasActive = mobileState.activeAppointment && mobileState.activeAppointment.status === 'active';
    banner.style.display = hasActive ? 'block' : 'none';
}

function updateNextApptHomeCard() {
    const cardWrap = document.querySelector('.next-appt-card');
    if (!cardWrap) return;

    const appt = mobileState.activeAppointment;
    if (appt && appt.status === 'active') {
        const codeLabel = cardWrap.querySelector('.appt-code-label');
        if (codeLabel) codeLabel.textContent = `รหัส: ${appt.ticketPreQueue || appt.id}`;
        const deptTitle = cardWrap.querySelector('.next-appt-dept');
        if (deptTitle) deptTitle.textContent = appt.department;
        const schedSpan = cardWrap.querySelectorAll('.schedule-item span');
        if (schedSpan && schedSpan.length >= 2) {
            schedSpan[0].textContent = `${appt.dateDisplay || appt.date} • ${appt.time}`;
            schedSpan[1].textContent = appt.fullLocation;
        }
    }
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
    if (viewId === 'view-hospital') {
        viewId = 'view-history';
    }
    mobileState.currentTab = viewId;

    const frame = document.getElementById('smartphone-frame');
    if (frame) {
        frame.classList.toggle('home-tab-active', viewId === 'view-home');
        frame.classList.toggle('booking-tab-active', viewId === 'view-booking');
        frame.classList.toggle('history-tab-active', viewId === 'view-history');
        frame.classList.toggle('appointments-tab-active', viewId === 'view-appointments');
        frame.classList.toggle('my-queue-tab-active', viewId === 'view-my-queue');
    }

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
    } else if (viewId === 'view-booking') {
        updateBookingLockBanner();
    } else if (viewId === 'view-home') {
        updateNextApptHomeCard();
    } else if (viewId === 'view-history') {
        // Reset search and filters
        const searchInput = document.getElementById('history-search-input');
        if (searchInput) searchInput.value = '';
        const allBtn = document.querySelector('.filter-chip[data-filter="all"]');
        if (allBtn) filterHistoryItems('all', allBtn);
    }

    // Scroll to top
    const scrollContainer = document.getElementById('mobile-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
}

// ============ APPOINTMENT HISTORY HANDLERS ============
function filterHistoryItems(category, buttonEl) {
    document.querySelectorAll('.history-filter-chips .filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip === buttonEl);
    });

    const cards = document.querySelectorAll('#history-cards-container .history-record-card');
    cards.forEach(card => {
        if (category === 'all') {
            card.style.display = '';
        } else {
            const cardCat = card.getAttribute('data-category');
            card.style.display = (cardCat === category) ? '' : 'none';
        }
    });
}

function handleHistorySearch(keyword) {
    const term = (keyword || '').trim().toLowerCase();
    const cards = document.querySelectorAll('#history-cards-container .history-record-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!term || text.includes(term)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}


// ============ PATIENT HOME VIEW MODALS ============
function openKioskGuideModal() {
    const m = document.getElementById('modal-kiosk-guide');
    if (m) m.classList.add('active');
}
function closeKioskGuideModal(e) {
    const m = document.getElementById('modal-kiosk-guide');
    if (m) m.classList.remove('active');
}

function openApptDetailModal() {
    const m = document.getElementById('modal-appt-detail');
    if (m) m.classList.add('active');
}
function closeApptDetailModal(e) {
    const m = document.getElementById('modal-appt-detail');
    if (m) m.classList.remove('active');
}

function openHospitalMapModal() {
    const m = document.getElementById('modal-hospital-map');
    if (m) m.classList.add('active');
}
function closeHospitalMapModal(e) {
    const m = document.getElementById('modal-hospital-map');
    if (m) m.classList.remove('active');
}

function openMedicalRecordsModal() {
    const m = document.getElementById('modal-medical-records');
    if (m) m.classList.add('active');
}
function closeMedicalRecordsModal(e) {
    const m = document.getElementById('modal-medical-records');
    if (m) m.classList.remove('active');
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
    switchMobileNav('view-home');
    renderTicket();
    renderDepartmentTraffic();
    renderMobileAppointments();
    updateBookingLockBanner();
    updateNextApptHomeCard();
    updateMobileClock();

    setInterval(updateMobileClock, 1000);

    // Auto-refresh queue every 8 seconds
    setInterval(() => {
        refreshQueueData(false);
    }, 8000);

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
        if (
            e.key === 'hospitalQueueState' || 
            e.key === 'hospitalAppointments' || 
            e.key === 'hospitalPatientActiveAppt' ||
            e.key === 'hospitalPatientApptHistory'
        ) {
            loadSharedQueueState();
            refreshQueueData(false);
            renderMobileAppointments();
            updateBookingLockBanner();
            updateNextApptHomeCard();
        }
    });
});
