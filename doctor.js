/* ============================================
   DOCTOR EXAMINATION ROOM - APPLICATION LOGIC
   ============================================ */

// ============ STATE ============
const doctorState = {
    currentPage: 'patients',
    currentFilter: 'all',          // 'all' | 'waiting' | 'examining'
    rooms: [],
    completedToday: 0,
    doctorHistory: [],
};

// ============ DEPARTMENT SVG ICONS & HELPERS ============
function getDeptIconSvg(dept) {
    switch (dept) {
        case 'ทันตกรรม':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M7 3C4.5 3 3 5 3 7.5C3 10.5 4.5 12 5.5 14L7.5 21C8 22 9.5 22 10 21L12 16L14 21C14.5 22 16 22 16.5 21L18.5 14C19.5 12 21 10.5 21 7.5C21 5 19.5 3 17 3C14.5 3 13.5 4.5 12 4.5C10.5 4.5 9.5 3 7 3Z"/></svg>`;
        case 'อายุรกรรม':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3"/><path d="M9 12.5v4a3 3 0 0 0 6 0v-2"/><circle cx="18" cy="14" r="2.5"/><path d="M3 3h3M12 3h3"/></svg>`;
        case 'ศัลยกรรม':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
        case 'กุมารเวชกรรม':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><path d="M12 3a2.5 2.5 0 0 1 2 2.5"/></svg>`;
        case 'จักษุวิทยา':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
        case 'กระดูกและข้อ':
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 10a3 3 0 0 0-3-3l-6 6a3 3 0 1 0 4.24 4.24l6-6A3 3 0 0 0 18 10z"/><circle cx="19" cy="5" r="2.5"/><circle cx="15" cy="2" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="9" cy="22" r="2.5"/></svg>`;
        default:
            return `<svg class="dept-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M12 7v6M9 10h6"/></svg>`;
    }
}

function getDeptBadge(dept) {
    const map = {
        'ทันตกรรม': { cls: 'dept-dental' },
        'อายุรกรรม': { cls: 'dept-med' },
        'ศัลยกรรม': { cls: 'dept-surg' },
        'กุมารเวชกรรม': { cls: 'dept-pedia' },
        'จักษุวิทยา': { cls: 'dept-eye' },
        'กระดูกและข้อ': { cls: 'dept-ortho' },
    };
    const d = map[dept] || { cls: 'dept-med' };
    return `<span class="card-dept-badge ${d.cls}">${getDeptIconSvg(dept)} <span>${dept}</span></span>`;
}

// ============ QUEUE SOUND NOTIFICATION SYSTEM ============
const soundManager = {
    enabled: true,
    audioCtx: null,

    init() {
        const saved = localStorage.getItem('queueSoundEnabled');
        if (saved !== null) {
            this.enabled = saved === 'true';
        }
        this.updateUI();
    },

    getAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    },

    // Play hospital announcement bell chime (Ding-Dong Melodic Chime)
    playChime(isUrgent = false) {
        if (!this.enabled) return Promise.resolve();

        const ctx = this.getAudioContext();
        if (!ctx) return Promise.resolve();

        return new Promise((resolve) => {
            const now = ctx.currentTime;

            if (isUrgent) {
                const notes = [783.99, 1046.50, 1318.51];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.14);

                    gain.gain.setValueAtTime(0, now + idx * 0.14);
                    gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.14 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + idx * 0.14);
                    osc.stop(now + idx * 0.14 + 0.5);
                });

                setTimeout(resolve, 550);
            } else {
                // Classic hospital chime (G5 -> E5 -> C5)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(783.99, now);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.28, now + 0.03);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.7);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(659.25, now + 0.25);
                gain2.gain.setValueAtTime(0, now + 0.25);
                gain2.gain.linearRampToValueAtTime(0.28, now + 0.28);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.25);
                osc2.stop(now + 1.0);

                const osc3 = ctx.createOscillator();
                const gain3 = ctx.createGain();
                osc3.type = 'sine';
                osc3.frequency.setValueAtTime(523.25, now + 0.5);
                gain3.gain.setValueAtTime(0, now + 0.5);
                gain3.gain.linearRampToValueAtTime(0.32, now + 0.53);
                gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
                osc3.connect(gain3);
                gain3.connect(ctx.destination);
                osc3.start(now + 0.5);
                osc3.stop(now + 1.5);

                setTimeout(resolve, 750);
            }
        });
    },

    formatQueueForSpeech(queueNumber) {
        const letterMap = {
            'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี',
            'F': 'เอฟ', 'G': 'จี', 'H': 'เอช', 'I': 'ไอ', 'J': 'เจ',
            'K': 'เค', 'L': 'แอล', 'M': 'เอ็ม', 'N': 'เอ็น', 'O': 'โอ',
            'P': 'พี', 'Q': 'คิว', 'R': 'อาร์', 'S': 'เอส', 'T': 'ที',
            'U': 'ยู', 'V': 'วี', 'W': 'ดับเบิ้ลยู', 'X': 'เอ็กซ์', 'Y': 'วาย', 'Z': 'แซด',
        };
        const digitMap = {
            '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
            '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า',
        };

        const parts = queueNumber.toUpperCase().split('');
        const spoken = parts.map(char => {
            if (letterMap[char]) return letterMap[char];
            if (digitMap[char]) return digitMap[char];
            if (char === '-') return ' ';
            return char;
        }).join(' ');

        return spoken;
    },

    speakAnnouncement(text) {
        if (!this.enabled || !('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 0.92;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.startsWith('th'));
        if (thaiVoice) utterance.voice = thaiVoice;

        window.speechSynthesis.speak(utterance);
    },

    announceQueue(queueNumber, type = 'call', extra = '') {
        if (!this.enabled) return;

        const isUrgent = type === 'urgent';
        const spokenQueue = this.formatQueueForSpeech(queueNumber);

        let phrase = '';
        if (type === 'urgent') {
            phrase = `คิวด่วนพิเศษ ขอเชิญหมายเลข ${spokenQueue} ค่ะ`;
        } else if (type === 'recall') {
            phrase = `ขอเชิญหมายเลข ${spokenQueue} อีกครั้งค่ะ`;
        } else if (type === 'room') {
            phrase = `ขอเชิญหมายเลข ${spokenQueue} ที่ ${extra} ค่ะ`;
        } else {
            phrase = `ขอเชิญหมายเลข ${spokenQueue} ค่ะ`;
        }

        this.playChime(isUrgent).then(() => {
            this.speakAnnouncement(phrase);
        });
    },

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('queueSoundEnabled', String(this.enabled));
        this.updateUI();
        if (this.enabled) {
            this.playChime(false);
            showToast('🔊 เปิดระบบเสียงเรียกคิวเรียบร้อย', 'success');
        } else {
            showToast('🔇 ปิดระบบเสียงเรียกคิวแล้ว', 'warning');
        }
    },

    updateUI() {
        const btn = document.getElementById('btn-sound-toggle');
        const iconOn = document.querySelector('.sound-icon-on');
        const iconOff = document.querySelector('.sound-icon-off');
        const text = document.getElementById('sound-status-text');

        if (btn) {
            if (this.enabled) {
                btn.classList.remove('muted');
                if (iconOn) iconOn.style.display = 'inline-block';
                if (iconOff) iconOff.style.display = 'none';
                if (text) text.textContent = 'เสียง: เปิด';
            } else {
                btn.classList.add('muted');
                if (iconOn) iconOn.style.display = 'none';
                if (iconOff) iconOff.style.display = 'inline-block';
                if (text) text.textContent = 'เสียง: ปิด';
            }
        }
    }
};

function toggleSound() {
    soundManager.toggle();
}


// ============ LOCALSTORAGE SYNC ============

function loadSharedState() {
    const saved = localStorage.getItem('hospitalQueueState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.rooms) {
                doctorState.rooms = parsed.rooms.map((r, i) => ({
                    ...r,
                    department: r.department || (i < 2 ? 'ทันตกรรม' : (i < 4 ? 'อายุรกรรม' : (i === 4 ? 'ศัลยกรรม' : 'กุมารเวชกรรม'))),
                    patient: r.patient ? {
                        ...r.patient,
                        sentAt: new Date(r.patient.sentAt),
                        status: r.patient.status || 'waiting'
                    } : null,
                }));
            }
            if (parsed.completedToday !== undefined) doctorState.completedToday = parsed.completedToday;
            return parsed;
        } catch (e) {
            console.warn('Failed to load shared state', e);
        }
    }

    // Default sample rooms with patients across departments if nothing in localStorage
    const now = new Date();
    doctorState.rooms = [
        {
            id: 1,
            name: 'ห้องตรวจที่ 1',
            department: 'ทันตกรรม',
            patient: {
                id: 'r1',
                queueNumber: 'S-095',
                patientName: 'คุณ สมชาย มีสุข',
                hn: 'HN 67-041904',
                department: 'ทันตกรรม',
                sentAt: new Date(now.getTime() - 25 * 60000),
                status: 'waiting',
            }
        },
        {
            id: 2,
            name: 'ห้องตรวจที่ 2',
            department: 'ทันตกรรม',
            patient: {
                id: 'r2',
                queueNumber: 'S-096',
                patientName: 'คุณ วิภาดา เจริญกุล',
                hn: 'HN 67-041905',
                department: 'ทันตกรรม',
                sentAt: new Date(now.getTime() - 15 * 60000),
                status: 'examining',
            }
        },
        {
            id: 3,
            name: 'ห้องตรวจที่ 3',
            department: 'อายุรกรรม',
            patient: {
                id: 'r3',
                queueNumber: 'M-038',
                patientName: 'คุณ พิมพ์ใจ แสงทอง',
                hn: 'HN 67-046633',
                department: 'อายุรกรรม',
                sentAt: new Date(now.getTime() - 18 * 60000),
                status: 'examining',
            }
        },
        { id: 4, name: 'ห้องตรวจที่ 4', department: 'อายุรกรรม', patient: null },
        {
            id: 5,
            name: 'ห้องตรวจที่ 5',
            department: 'ศัลยกรรม',
            patient: {
                id: 'r5',
                queueNumber: 'SR-008',
                patientName: 'คุณ วีระชาติ สุขสม',
                hn: 'HN 67-050112',
                department: 'ศัลยกรรม',
                sentAt: new Date(now.getTime() - 10 * 60000),
                status: 'waiting',
            }
        },
        { id: 6, name: 'ห้องตรวจที่ 6', department: 'กุมารเวชกรรม', patient: null },
    ];
    doctorState.completedToday = 28;
    saveSharedState();
    return null;
}

function saveSharedState() {
    const saved = localStorage.getItem('hospitalQueueState');
    let existing = {};
    if (saved) {
        try { existing = JSON.parse(saved); } catch(e) {}
    }

    existing.rooms = doctorState.rooms;
    existing.completedToday = doctorState.completedToday;
    existing.lastUpdatedBy = 'doctor';
    existing.timestamp = Date.now();

    localStorage.setItem('hospitalQueueState', JSON.stringify(existing));
}

function loadDoctorHistory() {
    const saved = localStorage.getItem('doctorExamHistory');
    if (saved) {
        try {
            doctorState.doctorHistory = JSON.parse(saved);
        } catch(e) {}
    }

    // Default sample history if empty
    if (!doctorState.doctorHistory || doctorState.doctorHistory.length === 0) {
        const now = new Date();
        doctorState.doctorHistory = [
            {
                time: '14:45',
                queueNumber: 'S-094',
                patientName: 'นาย สมชาย เรืองมณี',
                roomName: 'ห้องตรวจที่ 1',
                department: 'ทันตกรรม',
                duration: '20 นาที',
                status: 'done',
                date: now.toISOString(),
            },
            {
                time: '14:30',
                queueNumber: 'M-037',
                patientName: 'นาย ปรีชา วงศ์สุวรรณ',
                roomName: 'ห้องตรวจที่ 3',
                department: 'อายุรกรรม',
                duration: '25 นาที',
                status: 'done',
                date: now.toISOString(),
            },
            {
                time: '14:15',
                queueNumber: 'SR-007',
                patientName: 'นาง สุรีย์รัตน์ มั่นคง',
                roomName: 'ห้องตรวจที่ 5',
                department: 'ศัลยกรรม',
                duration: '15 นาที',
                status: 'done',
                date: now.toISOString(),
            },
            {
                time: '13:50',
                queueNumber: 'S-092',
                patientName: 'นาย สุรชัย ชัยชนะ',
                roomName: 'ห้องตรวจที่ 1',
                department: 'ทันตกรรม',
                duration: '-',
                status: 'sent-lab',
                date: now.toISOString(),
            }
        ];
        saveDoctorHistory();
    }
}

function saveDoctorHistory() {
    localStorage.setItem('doctorExamHistory', JSON.stringify(doctorState.doctorHistory));
}

// ============ RENDERING ============

function renderAll() {
    renderPatientList();
    updateStats();
    renderHistory();
}

function updateStats() {
    const occupiedRooms = doctorState.rooms.filter(r => r.patient !== null);
    const waitingCount = occupiedRooms.filter(r => r.patient && r.patient.status === 'waiting').length;
    const examiningCount = occupiedRooms.filter(r => r.patient && r.patient.status === 'examining').length;
    const totalCount = occupiedRooms.length;

    // Top Stats Bar
    const statPending = document.getElementById('stat-pending');
    if (statPending) statPending.textContent = waitingCount;

    const statExamining = document.getElementById('stat-examining');
    if (statExamining) statExamining.textContent = examiningCount;

    const statDone = document.getElementById('stat-done');
    if (statDone) statDone.textContent = doctorState.completedToday;

    // Filter Badges
    const countAll = document.getElementById('filter-count-all');
    if (countAll) countAll.textContent = totalCount;

    const countWaiting = document.getElementById('filter-count-waiting');
    if (countWaiting) countWaiting.textContent = waitingCount;

    const countExamining = document.getElementById('filter-count-examining');
    if (countExamining) countExamining.textContent = examiningCount;
}

// ============ PATIENT LIST ============

function renderPatientList() {
    const container = document.getElementById('patient-list');
    const emptyState = document.getElementById('empty-state');
    if (!container) return;

    const occupiedRooms = doctorState.rooms.filter(r => r.patient !== null);

    // Filter by status tab (all / waiting / examining)
    let filtered = occupiedRooms;
    if (doctorState.currentFilter === 'waiting') {
        filtered = occupiedRooms.filter(r => r.patient.status === 'waiting');
    } else if (doctorState.currentFilter === 'examining') {
        filtered = occupiedRooms.filter(r => r.patient.status === 'examining');
    }

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
            const h3 = emptyState.querySelector('h3');
            if (h3) h3.textContent = 'ยังไม่มีคนไข้ในห้องตรวจ';
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered.map(room => renderPatientCard(room)).join('');
}

function renderPatientCard(room) {
    const p = room.patient;
    const status = p.status || 'waiting';
    const isExamining = status === 'examining';

    const sentAt = new Date(p.sentAt);
    const elapsedMinutes = Math.floor((Date.now() - sentAt.getTime()) / 60000);
    const sentTime = `${String(sentAt.getHours()).padStart(2,'0')}:${String(sentAt.getMinutes()).padStart(2,'0')}`;

    const elapsedH = Math.floor(elapsedMinutes / 60);
    const elapsedM = elapsedMinutes % 60;
    const timerDisplay = elapsedH > 0
        ? `${elapsedH} ชม. ${elapsedM} นาที`
        : `${elapsedM} นาที`;

    const statusStripClass = isExamining ? 'examining' : 'waiting';
    const avatarClass = isExamining ? 'examining-avatar' : 'waiting-avatar';
    const indicatorClass = isExamining ? 'examining' : 'waiting';
    const dotClass = isExamining ? 'examining' : 'waiting';
    const statusLabel = isExamining ? 'กำลังตรวจ' : 'รอตรวจ';
    const elapsedLabel = isExamining ? 'ตรวจแล้ว' : 'รอตรวจแล้ว';

    let actionButtonsHtml = '';
    if (isExamining) {
        actionButtonsHtml = `
            <button class="btn-doctor btn-transfer-dept" onclick="openTransferModal(${room.id})" title="ส่งต่อผู้ป่วยไปแผนกอื่น">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                ส่งไปแผนกอื่น
            </button>
            <button class="btn-doctor btn-send-lab" onclick="doctorSendLab(${room.id})" title="ส่งกลับไปตรวจแล็บ/วัดสัญญาณชีพ">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v2h1v7.15l-4.35 7.61C2.87 20.11 3.84 22 5.44 22h13.12c1.6 0 2.57-1.89 1.79-3.24L16 11.15V4h1V2H7zm6 9.68l3.82 6.68H7.18L11 11.68V4h2v7.68z"/></svg>
                ส่งตรวจแล็บ
            </button>
            <button class="btn-doctor btn-finish-exam" onclick="doctorFinishExam(${room.id})" title="เสร็จสิ้นการตรวจ">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ตรวจเสร็จสิ้น
            </button>
        `;
    } else {
        actionButtonsHtml = `
            <button class="btn-doctor btn-return-prev" onclick="doctorReturnPrevious(${room.id})" title="ส่งผู้ป่วยกลับไปยังจุดบริการก่อนหน้านี้ (จุดซักประวัติ/สัญญาณชีพ/แล็บ)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                ส่งกลับก่อนหน้านี้
            </button>
            <button class="btn-doctor btn-transfer-dept" onclick="openTransferModal(${room.id})" title="ส่งต่อผู้ป่วยไปแผนกอื่น">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                ส่งไปแผนกอื่น
            </button>
            <button class="btn-doctor btn-start-exam" onclick="doctorStartExam(${room.id})" title="เริ่มทำการตรวจผู้ป่วย">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                เริ่มตรวจ
            </button>
        `;
    }

    return `
    <div class="patient-card ${isExamining ? 'is-examining' : ''}" data-room-id="${room.id}">
        <div class="card-status-strip ${statusStripClass}"></div>
        <div class="card-main">
            <div class="patient-avatar ${avatarClass}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <div class="card-queue">
                <div class="card-queue-number">${p.queueNumber}</div>
                <div class="card-room-name">${room.name}</div>
            </div>
            <div class="card-patient-info">
                <div class="card-patient-name">${p.patientName}</div>
                <div class="card-patient-hn">${p.hn}</div>
            </div>
            <div class="card-detail-chips">
                <div class="detail-chip">
                    <span class="chip-label">แผนก</span>
                    <span class="chip-value">${getDeptBadge(p.department || room.department || 'ทันตกรรม')}</span>
                </div>
                <div class="detail-chip">
                    <span class="chip-label">เวลาเข้าห้อง</span>
                    <span class="chip-value">${sentTime} น.</span>
                </div>
                <div class="detail-chip">
                    <span class="chip-label">${elapsedLabel}</span>
                    <span class="chip-value elapsed">${timerDisplay}</span>
                </div>
            </div>
            <div class="card-status-area">
                <div class="status-indicator ${indicatorClass}">
                    <span class="status-dot ${dotClass}"></span>
                    <span>${statusLabel}</span>
                </div>
            </div>
        </div>
        <div class="card-actions">
            ${actionButtonsHtml}
        </div>
    </div>`;
}

// ============ DOCTOR ACTIONS ============

function doctorStartExam(roomId) {
    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    room.patient.status = 'examining';
    room.patient.examStartedAt = new Date().toISOString();

    saveSharedState();
    renderAll();
    soundManager.announceQueue(room.patient.queueNumber, 'room', room.name);
    showToast(`👨‍⚕️ เริ่มตรวจคิว ${room.patient.queueNumber} - ${room.patient.patientName} (${room.patient.department})`, 'info');
}

function doctorFinishExam(roomId) {
    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    const enteredAt = new Date(patient.sentAt);
    const elapsed = Math.floor((Date.now() - enteredAt.getTime()) / 60000);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    doctorState.doctorHistory.unshift({
        time: timeStr,
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        roomName: room.name,
        department: patient.department || room.department || 'ทั่วไป',
        duration: `${elapsed} นาที`,
        status: 'done',
        date: now.toISOString(),
    });

    doctorState.completedToday++;
    room.patient = null;

    const saved = localStorage.getItem('hospitalQueueState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (!parsed.historyRecords) parsed.historyRecords = [];
            parsed.historyRecords.unshift({
                time: timeStr,
                queue: patient.queueNumber,
                name: patient.patientName,
                hn: patient.hn || '-',
                an: '-',
                type: 'appointment',
                aptTime: '-',
                dept: patient.department || room.department || 'ทั่วไป',
                status: 'done',
            });
            localStorage.setItem('hospitalQueueState', JSON.stringify(parsed));
        } catch(e) {}
    }

    saveSharedState();
    saveDoctorHistory();
    renderAll();
    showToast(`✅ ตรวจเสร็จสิ้น ${patient.queueNumber} - ${patient.patientName}`, 'success');
}

function doctorSendLab(roomId) {
    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const saved = localStorage.getItem('hospitalQueueState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (!parsed.labQueue) parsed.labQueue = [];
            parsed.labQueue.push({
                id: 'lab_doc_' + Date.now(),
                queueNumber: patient.queueNumber,
                patientName: patient.patientName,
                hn: patient.hn,
                department: patient.department || room.department || 'ทั่วไป',
                labType: 'Vitalsign / Lab',
                labStatus: 'รอผลแล็บ',
                sentAt: new Date().toISOString(),
            });
            localStorage.setItem('hospitalQueueState', JSON.stringify(parsed));
        } catch(e) {}
    }

    doctorState.doctorHistory.unshift({
        time: timeStr,
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        roomName: room.name,
        department: patient.department || room.department || 'ทั่วไป',
        duration: '-',
        status: 'sent-lab',
        date: now.toISOString(),
    });

    room.patient = null;

    saveSharedState();
    saveDoctorHistory();
    renderAll();
    showToast(`🔬 ส่ง ${patient.queueNumber} ไปตรวจแล็บ`, 'warning');
}

// ---- Action 1: Return Patient to Previous Station ----
function doctorReturnPrevious(roomId) {
    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Read latest shared state
    const saved = localStorage.getItem('hospitalQueueState');
    let parsed = {};
    if (saved) {
        try { parsed = JSON.parse(saved); } catch(e) {}
    }
    if (!parsed.labQueue) parsed.labQueue = [];
    if (!parsed.waitingQueue) parsed.waitingQueue = [];
    if (!parsed.historyRecords) parsed.historyRecords = [];

    let targetStationName = 'จุดตรวจแล็บ/สัญญาณชีพ';

    // Check where patient came from
    if (patient.previousStation === 'waiting') {
        targetStationName = 'คิวรอเรียกตรวจ';
        parsed.waitingQueue.unshift({
            id: patient.previousData?.id || patient.id || ('q_' + Date.now()),
            queueNumber: patient.queueNumber,
            type: patient.previousData?.type || 'walkin',
            appointmentTime: patient.previousData?.appointmentTime || timeStr,
            patientName: patient.patientName,
            hn: patient.hn,
            department: patient.department || room.department || 'ทั่วไป',
            enteredAt: new Date().toISOString(),
            isLate: false,
            lateMessage: '',
        });
    } else {
        // Default: return to labQueue (vitalsign / lab / triage station)
        targetStationName = 'จุดตรวจแล็บ/สัญญาณชีพ';
        parsed.labQueue.unshift({
            id: patient.previousData?.id || patient.id || ('lab_' + Date.now()),
            queueNumber: patient.queueNumber,
            patientName: patient.patientName,
            hn: patient.hn,
            department: patient.department || room.department || 'ทั่วไป',
            labType: patient.previousData?.labType || 'Vitalsign / ซักประวัติ',
            labStatus: 'ส่งกลับจากห้องตรวจ',
            sentAt: new Date().toISOString(),
        });
    }

    // Add to doctor's history
    doctorState.doctorHistory.unshift({
        time: timeStr,
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        roomName: room.name,
        department: patient.department || room.department || 'ทั่วไป',
        duration: '-',
        status: 'returned',
        date: now.toISOString(),
    });

    // Add to global shared history records
    parsed.historyRecords.unshift({
        time: timeStr,
        queue: patient.queueNumber,
        name: patient.patientName,
        hn: patient.hn || '-',
        an: '-',
        type: 'return',
        aptTime: '-',
        dept: patient.department || room.department || 'ทั่วไป',
        status: 'returned',
    });

    // Vacate room
    room.patient = null;
    parsed.rooms = doctorState.rooms;
    parsed.lastUpdatedBy = 'doctor';
    parsed.timestamp = Date.now();

    localStorage.setItem('hospitalQueueState', JSON.stringify(parsed));
    saveDoctorHistory();
    renderAll();

    showToast(`↩️ ส่งผู้ป่วยคิว ${patient.queueNumber} กลับ${targetStationName} เรียบร้อย`, 'warning');
}

// ---- Action 2: Transfer to Another Department (Modal & Logic) ----
const DEPARTMENTS_LIST = [
    { name: 'ทันตกรรม', desc: 'ทันตกรรมและศัลยกรรมช่องปาก' },
    { name: 'อายุรกรรม', desc: 'ตรวจรักษาโรคทั่วไปและโรคเรื้อรัง' },
    { name: 'ศัลยกรรม', desc: 'ตรวจรักษาโรคทางศัลยกรรมและผ่าตัด' },
    { name: 'กุมารเวชกรรม', desc: 'คลินิกเด็กและสุขภาพเด็ก' },
    { name: 'จักษุวิทยา', desc: 'ตรวจรักษาโรคตาและสายตา' },
    { name: 'กระดูกและข้อ', desc: 'ตรวจรักษาโรคกระดูก ข้อ และกล้ามเนื้อ' },
];

let transferModalState = {
    roomId: null,
    selectedDept: null,
};

function openTransferModal(roomId) {
    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    transferModalState.roomId = roomId;
    transferModalState.selectedDept = null;

    const p = room.patient;
    const currentDept = p.department || room.department || 'ทันตกรรม';

    // Render patient summary
    const summaryContainer = document.getElementById('transfer-patient-summary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="summary-patient-left">
                <div class="summary-queue-badge">${p.queueNumber}</div>
                <div class="summary-patient-details">
                    <span class="summary-patient-name">${p.patientName}</span>
                    <span class="summary-patient-hn">${p.hn}</span>
                </div>
            </div>
            <div class="summary-patient-right">
                <span class="summary-room-tag">ประจำ ${room.name}</span>
                <div>${getDeptBadge(currentDept)}</div>
            </div>
        `;
    }

    // Render department grid
    const gridContainer = document.getElementById('transfer-dept-grid');
    if (gridContainer) {
        gridContainer.innerHTML = DEPARTMENTS_LIST.map(d => {
            const isCurrent = d.name === currentDept;
            const disabledCls = isCurrent ? 'disabled' : '';
            return `
                <div class="dept-choice-card ${disabledCls}" data-dept="${d.name}" ${isCurrent ? '' : `onclick="selectTransferDept('${d.name}')"`}>
                    <div class="dept-card-info">
                        <span class="dept-card-icon">${getDeptIconSvg(d.name)}</span>
                        <div class="dept-card-text">
                            <span class="dept-card-name">${d.name}</span>
                            <span class="dept-card-desc">${d.desc}</span>
                        </div>
                    </div>
                    ${isCurrent 
                        ? `<span class="dept-badge-current">แผนกปัจจุบัน</span>` 
                        : `<span class="dept-check-indicator"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg></span>`
                    }
                </div>
            `;
        }).join('');
    }

    // Reset notes & buttons
    const textarea = document.getElementById('transfer-reason');
    if (textarea) textarea.value = '';

    document.querySelectorAll('.quick-tag').forEach(tag => tag.classList.remove('active'));

    const confirmBtn = document.getElementById('btn-confirm-transfer');
    if (confirmBtn) confirmBtn.disabled = true;

    // Show modal
    const modal = document.getElementById('transfer-modal');
    if (modal) modal.style.display = 'flex';
}

function closeTransferModal() {
    const modal = document.getElementById('transfer-modal');
    if (modal) modal.style.display = 'none';
    transferModalState.roomId = null;
    transferModalState.selectedDept = null;
}

function handleModalBackdropClick(e) {
    if (e.target.id === 'transfer-modal') {
        closeTransferModal();
    }
}

function selectTransferDept(deptName) {
    transferModalState.selectedDept = deptName;

    document.querySelectorAll('.dept-choice-card').forEach(card => {
        if (card.getAttribute('data-dept') === deptName) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    const confirmBtn = document.getElementById('btn-confirm-transfer');
    if (confirmBtn) confirmBtn.disabled = false;
}

function selectQuickReason(text) {
    const textarea = document.getElementById('transfer-reason');
    if (!textarea) return;

    if (textarea.value.trim() === '') {
        textarea.value = text;
    } else if (!textarea.value.includes(text)) {
        textarea.value = `${textarea.value}, ${text}`;
    }

    document.querySelectorAll('.quick-tag').forEach(tag => {
        if (tag.textContent.trim() === text) {
            tag.classList.toggle('active');
        }
    });
}

function confirmTransferDept() {
    const roomId = transferModalState.roomId;
    const targetDept = transferModalState.selectedDept;
    if (!roomId || !targetDept) return;

    const room = doctorState.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    const currentDept = patient.department || room.department || 'ทั่วไป';
    const reasonText = (document.getElementById('transfer-reason')?.value || '').trim();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Read shared state
    const saved = localStorage.getItem('hospitalQueueState');
    let parsed = {};
    if (saved) {
        try { parsed = JSON.parse(saved); } catch(e) {}
    }
    if (!parsed.waitingQueue) parsed.waitingQueue = [];
    if (!parsed.historyRecords) parsed.historyRecords = [];

    // Transfer patient into new department's waiting queue
    parsed.waitingQueue.unshift({
        id: 'trans_' + Date.now(),
        queueNumber: patient.queueNumber,
        type: 'transfer',
        appointmentTime: timeStr,
        patientName: patient.patientName,
        hn: patient.hn,
        department: targetDept,
        enteredAt: new Date().toISOString(),
        isLate: false,
        lateMessage: '',
        transferFrom: currentDept,
        transferReason: reasonText || 'ส่งต่อจากแพทย์ห้องตรวจ',
    });

    // Add to doctor's history records
    doctorState.doctorHistory.unshift({
        time: timeStr,
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        roomName: room.name,
        department: `${currentDept} → ${targetDept}`,
        duration: '-',
        status: 'transfer',
        date: now.toISOString(),
    });

    // Add to global shared history records
    parsed.historyRecords.unshift({
        time: timeStr,
        queue: patient.queueNumber,
        name: patient.patientName,
        hn: patient.hn || '-',
        an: '-',
        type: 'transfer',
        aptTime: '-',
        dept: `${currentDept} → ${targetDept}`,
        status: 'transfer',
    });

    // Vacate room
    room.patient = null;
    parsed.rooms = doctorState.rooms;
    parsed.lastUpdatedBy = 'doctor';
    parsed.timestamp = Date.now();

    localStorage.setItem('hospitalQueueState', JSON.stringify(parsed));
    saveDoctorHistory();
    closeTransferModal();
    renderAll();

    showToast(`🔀 ส่งต่อคิว ${patient.queueNumber} ไปแผนก${targetDept} เรียบร้อย`, 'success');
}

// ============ FILTER ============

function setFilter(filter) {
    doctorState.currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(btn => {
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderPatientList();
    updateStats();
}

// ============ HISTORY ============

function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('search-queue')?.value || '').toLowerCase();
    let records = doctorState.doctorHistory;

    if (searchTerm) {
        records = records.filter(r =>
            (r.queueNumber && r.queueNumber.toLowerCase().includes(searchTerm)) ||
            (r.patientName && r.patientName.toLowerCase().includes(searchTerm)) ||
            (r.department && r.department.toLowerCase().includes(searchTerm))
        );
    }

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="no-history">
                <svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" width="48" height="48"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                <h3>ยังไม่มีประวัติการตรวจ</h3>
                <p>ประวัติจะแสดงเมื่อแพทย์ทำการตรวจเสร็จสิ้นหรือส่งตรวจแล็บ</p>
            </div>
        </td></tr>`;
    } else {
        tbody.innerHTML = records.map(rec => {
            let statusBadge = '';
            if (rec.status === 'done') {
                statusBadge = '<span class="history-status done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="vertical-align:middle;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>ตรวจเสร็จ</span>';
            } else if (rec.status === 'sent-lab') {
                statusBadge = '<span class="history-status sent-lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-right:4px;"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>ส่งแล็บ</span>';
            } else if (rec.status === 'returned') {
                statusBadge = '<span class="history-status returned"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-right:4px;"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>ส่งกลับก่อนหน้า</span>';
            } else if (rec.status === 'transfer') {
                statusBadge = '<span class="history-status transfer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-right:4px;"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>ส่งต่อแผนก</span>';
            }

            return `<tr>
                <td>${rec.time}</td>
                <td><strong>${rec.queueNumber}</strong></td>
                <td>${rec.patientName}</td>
                <td>${rec.roomName || '-'}</td>
                <td>${getDeptBadge(rec.department || '-')}</td>
                <td>${rec.duration || '-'}</td>
                <td>${statusBadge}</td>
            </tr>`;
        }).join('');
    }

    const doneCount = doctorState.doctorHistory.filter(r => r.status === 'done').length;
    const labCount = doctorState.doctorHistory.filter(r => r.status === 'sent-lab').length;

    const historyDoneEl = document.getElementById('history-done-count');
    if (historyDoneEl) historyDoneEl.textContent = doneCount;

    const historyLabEl = document.getElementById('history-lab-count');
    if (historyLabEl) historyLabEl.textContent = labCount;
}

// ============ NAVIGATION ============

function switchPage(pageName) {
    doctorState.currentPage = pageName;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const activePage = document.getElementById(`page-${pageName}`);
    if (activePage) activePage.classList.add('active');

    const titles = {
        patients: 'รายชื่อคนไข้',
        history: 'ประวัติการตรวจ',
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'รายชื่อคนไข้';
}

// ============ DATETIME ============

function updateDateTime() {
    const now = new Date();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const thaiDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

    const buddhist = now.getFullYear() + 543;
    const dayName = thaiDays[now.getDay()];
    const date = now.getDate();
    const month = thaiMonths[now.getMonth()];

    const dateTextEl = document.getElementById('date-text');
    if (dateTextEl) dateTextEl.textContent = `วัน${dayName}ที่ ${date} ${month} ${buddhist}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeTextEl = document.getElementById('time-text');
    if (timeTextEl) timeTextEl.textContent = `${hours}:${minutes}`;
}

// ============ TOAST ============

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ EVENT LISTENERS ============

function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage(item.getAttribute('data-page'));
        });
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            setFilter(tab.getAttribute('data-filter'));
        });
    });

    // History search
    const searchInput = document.getElementById('search-queue');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderHistory();
        });
    }

    // Modal keyboard shortcuts (Escape to close)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTransferModal();
        }
    });
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', () => {
    loadSharedState();
    loadDoctorHistory();
    initEventListeners();
    updateDateTime();
    soundManager.init();
    renderAll();

    // Real-time clock
    setInterval(updateDateTime, 1000);

    // Update patient elapsed timer every 30 seconds
    setInterval(() => {
        renderPatientList();
    }, 30000);

    // Listen for changes from nurse's page (cross-tab sync)
    window.addEventListener('storage', (e) => {
        if (e.key === 'hospitalQueueState' && e.newValue) {
            try {
                const parsed = JSON.parse(e.newValue);
                if (parsed.lastUpdatedBy !== 'doctor') {
                    loadSharedState();
                    renderAll();
                }
            } catch(err) {}
        }
    });
});
