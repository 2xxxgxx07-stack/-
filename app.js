/* ============================================
   HOSPITAL QUEUE MANAGEMENT - APPLICATION LOGIC
   ============================================ */

// ============ STATE ============
const state = {
    currentPage: 'dashboard',
    currentFilter: 'all',          // 'all' | 'appointment' | 'walkin'
    currentDepartment: 'all',      // 'all' | 'อายุรกรรม' | 'ทันตกรรม' | 'ศัลยกรรม' | 'กุมารเวชกรรม' | 'จักษุวิทยา' | 'กระดูกและข้อ'
    searchQuery: '',
    selectedRoomIndex: null,
    callingQueueId: null,
    callingLabId: null,
    completedToday: 28,
    historyRecords: [],
    waitingQueue: [],
    labQueue: [],
    appointments: [],
    rooms: [
        { id: 1, name: 'ห้องตรวจที่ 1', department: 'ทันตกรรม', patient: null },
        { id: 2, name: 'ห้องตรวจที่ 2', department: 'ทันตกรรม', patient: null },
        { id: 3, name: 'ห้องตรวจที่ 3', department: 'อายุรกรรม', patient: null },
        { id: 4, name: 'ห้องตรวจที่ 4', department: 'อายุรกรรม', patient: null },
        { id: 5, name: 'ห้องตรวจที่ 5', department: 'ศัลยกรรม', patient: null },
        { id: 6, name: 'ห้องตรวจที่ 6', department: 'กุมารเวชกรรม', patient: null },
    ],
};

// ============ DEPARTMENT HELPERS ============
function getDeptBadge(dept) {
    const map = {
        'ทันตกรรม': { icon: '🦷', cls: 'dept-dental' },
        'อายุรกรรม': { icon: '🩺', cls: 'dept-med' },
        'ศัลยกรรม': { icon: '✂️', cls: 'dept-surg' },
        'กุมารเวชกรรม': { icon: '👶', cls: 'dept-pedia' },
        'จักษุวิทยา': { icon: '👁️', cls: 'dept-eye' },
        'กระดูกและข้อ': { icon: '🦴', cls: 'dept-ortho' },
    };
    const d = map[dept] || { icon: '🏥', cls: 'dept-med' };
    return `<span class="card-dept-badge ${d.cls}">${d.icon} ${dept}</span>`;
}

// ============ QUEUE SOUND NOTIFICATION SYSTEM ============
const soundManager = {
    enabled: true,
    audioCtx: null,
    volume: 0.85,
    speechRate: 1.0,
    chimeType: 'hospital',
    announceName: true,
    repeatCount: 1,

    init() {
        const settings = typeof getSystemSettings === 'function' ? getSystemSettings() : null;
        if (settings) {
            this.enabled = settings.soundEnabled !== undefined ? settings.soundEnabled : true;
            this.volume = (settings.soundVolume || 85) / 100;
            this.speechRate = parseFloat(settings.speechRate) || 1.0;
            this.chimeType = settings.chimeType || 'hospital';
            this.announceName = settings.voiceAnnounceName !== undefined ? settings.voiceAnnounceName : true;
            this.repeatCount = parseInt(settings.repeatCount, 10) || 1;
        } else {
            const saved = localStorage.getItem('queueSoundEnabled');
            if (saved !== null) {
                this.enabled = saved === 'true';
            }
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

    // Play hospital announcement bell chime (Ding-Dong Melodic Chime / Urgent / Classic)
    playChime(isUrgent = false, forcedTone = null) {
        if (!this.enabled) return Promise.resolve();

        const ctx = this.getAudioContext();
        if (!ctx) return Promise.resolve();

        const tone = forcedTone || (isUrgent ? 'urgent' : this.chimeType);
        const vol = this.volume || 0.85;

        return new Promise((resolve) => {
            const now = ctx.currentTime;

            if (tone === 'urgent') {
                // Urgent alert: 3 brisk alert chimes (G5 -> C6 -> E6)
                const notes = [783.99, 1046.50, 1318.51];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.14);

                    gain.gain.setValueAtTime(0, now + idx * 0.14);
                    gain.gain.linearRampToValueAtTime(0.35 * vol, now + idx * 0.14 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + idx * 0.14);
                    osc.stop(now + idx * 0.14 + 0.5);
                });

                setTimeout(resolve, 550);
            } else if (tone === 'classic') {
                // Soft 2-tone chime (F5: 698.46 Hz -> C5: 523.25 Hz)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(698.46, now);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.32 * vol, now + 0.04);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.9);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(523.25, now + 0.35);
                gain2.gain.setValueAtTime(0, now + 0.35);
                gain2.gain.linearRampToValueAtTime(0.36 * vol, now + 0.38);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.35);
                osc2.stop(now + 1.5);

                setTimeout(resolve, 750);
            } else {
                // Classic hospital 3-tone melody (G5: 784 Hz -> E5: 659 Hz -> C5: 523 Hz)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(783.99, now);
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.28 * vol, now + 0.03);
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
                gain2.gain.linearRampToValueAtTime(0.28 * vol, now + 0.28);
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
                gain3.gain.linearRampToValueAtTime(0.32 * vol, now + 0.53);
                gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
                osc3.connect(gain3);
                gain3.connect(ctx.destination);
                osc3.start(now + 0.5);
                osc3.stop(now + 1.5);

                setTimeout(resolve, 750);
            }
        });
    },

    // Convert queue number letters and numbers into natural Thai pronunciation
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

        const parts = (queueNumber || '').toUpperCase().split('');
        const spoken = parts.map(char => {
            if (letterMap[char]) return letterMap[char];
            if (digitMap[char]) return digitMap[char];
            if (char === '-') return ' ';
            return char;
        }).join(' ');

        return spoken;
    },

    // Voice announcement (Text-To-Speech)
    speakAnnouncement(text) {
        if (!this.enabled || !('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = this.speechRate || 1.0;
        utterance.pitch = 1.05;
        utterance.volume = this.volume !== undefined ? this.volume : 0.85;

        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.startsWith('th'));
        if (thaiVoice) utterance.voice = thaiVoice;

        window.speechSynthesis.speak(utterance);
    },

    // Main Announcement function
    announceQueue(queueNumber, type = 'call', extra = '', patientName = '') {
        if (!this.enabled) return;

        const isUrgent = type === 'urgent';
        const spokenQueue = this.formatQueueForSpeech(queueNumber);
        const namePart = (this.announceName && patientName) ? ` คุณ ${patientName}` : '';

        let phrase = '';
        if (type === 'urgent') {
            phrase = `คิวด่วนพิเศษ ขอเชิญหมายเลข ${spokenQueue}${namePart} ค่ะ`;
        } else if (type === 'recall') {
            phrase = `ขอเชิญหมายเลข ${spokenQueue}${namePart} อีกครั้งค่ะ`;
        } else if (type === 'room') {
            phrase = `ขอเชิญหมายเลข ${spokenQueue}${namePart} ที่ ${extra} ค่ะ`;
        } else {
            phrase = `ขอเชิญหมายเลข ${spokenQueue}${namePart} ค่ะ`;
        }

        // Play chime first, then voice
        this.playChime(isUrgent).then(() => {
            this.speakAnnouncement(phrase);

            // Repeat announcement if repeatCount is set to 2
            if (this.repeatCount === 2) {
                setTimeout(() => {
                    if (this.enabled) {
                        this.speakAnnouncement(phrase);
                    }
                }, 4000);
            }
        });
    },

    toggle(forceState = null) {
        this.enabled = forceState !== null ? forceState : !this.enabled;
        localStorage.setItem('queueSoundEnabled', String(this.enabled));
        
        // Sync with system settings if present
        if (typeof getSystemSettings === 'function' && typeof saveSystemSettings === 'function') {
            const cur = getSystemSettings();
            cur.soundEnabled = this.enabled;
            saveSystemSettings(cur, false);
        }

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
        const settingSoundToggle = document.getElementById('setting-sound-enabled');

        if (settingSoundToggle) {
            settingSoundToggle.checked = this.enabled;
        }

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

// ============ INITIAL DATA ============
function initializeData() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();

    state.waitingQueue = [
        {
            id: 'q1',
            queueNumber: 'M-041',
            type: 'appointment',
            appointmentTime: `${String(h).padStart(2,'0')}:${String(m + 10 < 60 ? m + 10 : 10).padStart(2,'0')}`,
            patientName: 'คุณ อารีย์ พิทักษ์ไทย',
            hn: 'HN 67-048123',
            department: 'อายุรกรรม',
            enteredAt: new Date(now.getTime() - 15 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q2',
            queueNumber: 'S-099',
            type: 'appointment',
            appointmentTime: `${String(h).padStart(2,'0')}:${String(m + 30 < 60 ? m + 30 : 30).padStart(2,'0')}`,
            patientName: 'คุณ สมศักดิ์ ส***',
            hn: 'HN 67-041901',
            department: 'ทันตกรรม',
            enteredAt: new Date(now.getTime() - 20 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q3',
            queueNumber: 'M-042',
            type: 'walkin',
            appointmentTime: `${String(h).padStart(2,'0')}:${String(m + 30 < 60 ? m + 30 : 30).padStart(2,'0')}`,
            patientName: 'คุณ นภัสวรรณ รักษาสิทธิ์',
            hn: 'HN 67-049876',
            department: 'อายุรกรรม',
            enteredAt: new Date(now.getTime() - 5 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q4',
            queueNumber: 'W-100',
            type: 'walkin',
            appointmentTime: `${String(h).padStart(2,'0')}:${String(m + 30 < 60 ? m + 30 : 30).padStart(2,'0')}`,
            patientName: 'คุณ มนตรีจันทร์ ส***',
            hn: 'HN 67-041902',
            department: 'ทันตกรรม',
            enteredAt: new Date(now.getTime() - 2 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q5',
            queueNumber: 'SR-012',
            type: 'appointment',
            appointmentTime: `${String(h + 1 > 23 ? 0 : h + 1).padStart(2,'0')}:00`,
            patientName: 'คุณ ธนากร วิเศษโสภา',
            hn: 'HN 67-052341',
            department: 'ศัลยกรรม',
            enteredAt: new Date(now.getTime() - 10 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q6',
            queueNumber: 'P-025',
            type: 'appointment',
            appointmentTime: `${String(h + 1 > 23 ? 0 : h + 1).padStart(2,'0')}:15`,
            patientName: 'ด.ช. ภูผา วงศ์สว่าง',
            hn: 'HN 67-061122',
            department: 'กุมารเวชกรรม',
            enteredAt: new Date(now.getTime() - 8 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q7',
            queueNumber: 'E-015',
            type: 'walkin',
            appointmentTime: `${String(h + 1 > 23 ? 0 : h + 1).padStart(2,'0')}:30`,
            patientName: 'คุณ วิชัย มณีฉาย',
            hn: 'HN 67-074455',
            department: 'จักษุวิทยา',
            enteredAt: new Date(now.getTime() - 3 * 60000),
            isLate: false,
            lateMessage: '',
        },
        {
            id: 'q8',
            queueNumber: 'O-009',
            type: 'walkin',
            appointmentTime: `${String(h + 1 > 23 ? 0 : h + 1).padStart(2,'0')}:45`,
            patientName: 'คุณ นพดล แก้วสุวรรณ',
            hn: 'HN 67-083311',
            department: 'กระดูกและข้อ',
            enteredAt: new Date(now.getTime() - 1 * 60000),
            isLate: false,
            lateMessage: '',
        },
    ];

    state.labQueue = [
        {
            id: 'lab1',
            queueNumber: 'M-039',
            patientName: 'คุณ ประสิทธิ์ เจริญพร',
            hn: 'HN 67-047712',
            department: 'อายุรกรรม',
            labType: 'ตรวจเลือด CBC / น้ำตาล',
            labStatus: 'รอผลแล็บ',
            sentAt: new Date(now.getTime() - 35 * 60000),
        },
        {
            id: 'lab2',
            queueNumber: 'S-098',
            patientName: 'คุณ สมศักดิ์ ส***',
            hn: 'HN 67-041903',
            department: 'ทันตกรรม',
            labType: 'Vitalsign / Lab',
            labStatus: 'กำลังตรวจ',
            sentAt: new Date(now.getTime() - 25 * 60000),
        },
        {
            id: 'lab3',
            queueNumber: 'SR-010',
            patientName: 'คุณ กมลวรรณ ปรีชา',
            hn: 'HN 67-051890',
            department: 'ศัลยกรรม',
            labType: 'เอกซเรย์ช่องท้อง (X-Ray)',
            labStatus: 'รอผล X-Ray',
            sentAt: new Date(now.getTime() - 20 * 60000),
        },
        {
            id: 'lab4',
            queueNumber: 'P-023',
            patientName: 'ด.ช. ภัทรกร มีทรัพย์',
            hn: 'HN 67-060455',
            department: 'กุมารเวชกรรม',
            labType: 'พ่นยาขยายหลอดลม',
            labStatus: 'กำลังตรวจ',
            sentAt: new Date(now.getTime() - 12 * 60000),
        },
    ];

    // Pre-fill rooms
    state.rooms = [
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
        {
            id: 4,
            name: 'ห้องตรวจที่ 4',
            department: 'อายุรกรรม',
            patient: null,
        },
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
        {
            id: 6,
            name: 'ห้องตรวจที่ 6',
            department: 'กุมารเวชกรรม',
            patient: null,
        },
    ];

    // Pre-fill history
    state.historyRecords = [
        { time: '15:00', queue: 'M-037', name: 'นาย ปรีชา วงศ์สุวรรณ', hn: '67-041122', an: '-', type: 'appointment', aptTime: '14:30', dept: 'อายุรกรรม', status: 'done' },
        { time: '14:45', queue: 'S-094', name: 'นาย สมชาย เรืองมณี', hn: '67-041123', an: '-', type: 'appointment', aptTime: '14:00', dept: 'ทันตกรรม', status: 'done' },
        { time: '14:30', queue: 'SR-007', name: 'นาง สุรีย์รัตน์ มั่นคง', hn: '67-050089', an: '-', type: 'walkin', aptTime: '14:00', dept: 'ศัลยกรรม', status: 'done' },
        { time: '14:15', queue: 'P-022', name: 'ด.ช. กิตติภพ ทองคำ', hn: '67-060111', an: '-', type: 'appointment', aptTime: '13:30', dept: 'กุมารเวชกรรม', status: 'done' },
        { time: '14:00', queue: 'E-014', name: 'นาง พวงเพ็ญ สมุทร', hn: '67-074120', an: '-', type: 'walkin', aptTime: '13:30', dept: 'จักษุวิทยา', status: 'overdue' },
        { time: '13:40', queue: 'M-036', name: 'นาย ธวัชชัย บุญมี', hn: '67-040988', an: '-', type: 'appointment', aptTime: '13:00', dept: 'อายุรกรรม', status: 'done' },
    ];
}

// ============ LOCALSTORAGE SYNC ============

function saveState() {
    const shared = {
        waitingQueue: state.waitingQueue,
        labQueue: state.labQueue,
        rooms: state.rooms,
        completedToday: state.completedToday,
        historyRecords: state.historyRecords,
        lastUpdatedBy: 'nurse',
        timestamp: Date.now(),
    };
    localStorage.setItem('hospitalQueueState', JSON.stringify(shared));
}

function loadState() {
    const saved = localStorage.getItem('hospitalQueueState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.waitingQueue) {
                state.waitingQueue = parsed.waitingQueue.map(q => ({
                    ...q,
                    enteredAt: new Date(q.enteredAt),
                }));
            }
            if (parsed.labQueue) {
                state.labQueue = parsed.labQueue.map(q => ({
                    ...q,
                    sentAt: new Date(q.sentAt),
                }));
            }
            if (parsed.rooms) {
                state.rooms = parsed.rooms.map((r, i) => ({
                    ...r,
                    department: r.department || (i < 2 ? 'ทันตกรรม' : (i < 4 ? 'อายุรกรรม' : (i === 4 ? 'ศัลยกรรม' : 'กุมารเวชกรรม'))),
                    patient: r.patient ? {
                        ...r.patient,
                        sentAt: new Date(r.patient.sentAt),
                        status: r.patient.status || 'waiting'
                    } : null,
                }));
            }
            if (parsed.completedToday !== undefined) state.completedToday = parsed.completedToday;
            if (parsed.historyRecords) state.historyRecords = parsed.historyRecords;
            return true;
        } catch (e) {
            console.warn('Failed to load state from localStorage', e);
        }
    }
    return false;
}

// ============ RENDERING ============

function renderAll() {
    renderWaitingQueue();
    renderLabQueue();
    renderRooms();
    updateStats();
    renderHistory();
    renderAppointments();
    if (state.currentPage === 'reports') {
        renderReportsDashboard();
    } else if (state.currentPage === 'appointments') {
        renderAppointments();
    }
    saveState();
}

// ---- Stat Cards ----
function updateStats() {
    const allWaiting = state.waitingQueue;
    const allLab = state.labQueue;
    const allOccupied = state.rooms.filter(r => r.patient !== null);

    // Filtered by current department
    let waitingFiltered = allWaiting;
    let labFiltered = allLab;
    let roomsFiltered = allOccupied;

    if (state.currentDepartment !== 'all') {
        waitingFiltered = allWaiting.filter(q => q.department === state.currentDepartment);
        labFiltered = allLab.filter(q => q.department === state.currentDepartment);
        roomsFiltered = allOccupied.filter(r => (r.department === state.currentDepartment) || (r.patient && r.patient.department === state.currentDepartment));
    }

    // Top Stats Cards
    const statWaitingCountEl = document.getElementById('stat-waiting-count');
    if (statWaitingCountEl) statWaitingCountEl.textContent = waitingFiltered.length;

    const statLabCountEl = document.getElementById('stat-lab-count');
    if (statLabCountEl) statLabCountEl.textContent = labFiltered.length;

    const statExaminingCountEl = document.getElementById('stat-examining-count');
    if (statExaminingCountEl) statExaminingCountEl.textContent = roomsFiltered.length;

    const statDoneCountEl = document.getElementById('stat-done-count');
    if (statDoneCountEl) statDoneCountEl.textContent = state.completedToday;

    // Column Headers
    const colWaitCountEl = document.getElementById('col-waiting-count');
    if (colWaitCountEl) colWaitCountEl.textContent = waitingFiltered.length;

    const colLabCountEl = document.getElementById('col-lab-count');
    if (colLabCountEl) colLabCountEl.textContent = labFiltered.length;

    const colRoomsActiveEl = document.getElementById('col-rooms-active');
    if (colRoomsActiveEl) colRoomsActiveEl.textContent = `Active ${roomsFiltered.length} ห้อง`;

    // Department Pill Badge Counts (Total active in dept = waiting + lab + examining)
    const getDeptTotal = (deptName) => {
        const w = allWaiting.filter(q => q.department === deptName).length;
        const l = allLab.filter(q => q.department === deptName).length;
        const r = allOccupied.filter(rm => (rm.department === deptName) || (rm.patient && rm.patient.department === deptName)).length;
        return w + l + r;
    };

    const countAllEl = document.getElementById('count-dept-all');
    if (countAllEl) countAllEl.textContent = allWaiting.length + allLab.length + allOccupied.length;

    const countMedEl = document.getElementById('count-dept-med');
    if (countMedEl) countMedEl.textContent = getDeptTotal('อายุรกรรม');

    const countDentalEl = document.getElementById('count-dept-dental');
    if (countDentalEl) countDentalEl.textContent = getDeptTotal('ทันตกรรม');

    const countSurgEl = document.getElementById('count-dept-surg');
    if (countSurgEl) countSurgEl.textContent = getDeptTotal('ศัลยกรรม');

    const countPediaEl = document.getElementById('count-dept-pedia');
    if (countPediaEl) countPediaEl.textContent = getDeptTotal('กุมารเวชกรรม');

    const countEyeEl = document.getElementById('count-dept-eye');
    if (countEyeEl) countEyeEl.textContent = getDeptTotal('จักษุวิทยา');

    const countOrthoEl = document.getElementById('count-dept-ortho');
    if (countOrthoEl) countOrthoEl.textContent = getDeptTotal('กระดูกและข้อ');

    // Update Sidebar Navigation Badges
    const taskBadge = document.getElementById('nav-task-badge');
    if (taskBadge) {
        taskBadge.textContent = allWaiting.length > 0 ? allWaiting.length : 12;
    }
    const overdueBadge = document.getElementById('nav-notification-badge');
    if (overdueBadge) {
        const lateCount = allWaiting.filter(q => q.isLate).length;
        overdueBadge.textContent = lateCount > 0 ? lateCount : 14;
    }
}

// ---- Waiting Queue (Column 1) ----
function renderWaitingQueue() {
    const container = document.getElementById('waiting-list');
    if (!container) return;

    let filtered = state.waitingQueue;

    // Filter by type (appointment / walkin)
    if (state.currentFilter === 'appointment') filtered = filtered.filter(q => q.type === 'appointment');
    if (state.currentFilter === 'walkin') filtered = filtered.filter(q => q.type === 'walkin');

    // Filter by department
    if (state.currentDepartment !== 'all') {
        filtered = filtered.filter(q => q.department === state.currentDepartment);
    }

    // Filter by search query
    if (state.searchQuery) {
        filtered = filtered.filter(q =>
            q.queueNumber.toLowerCase().includes(state.searchQuery) ||
            q.patientName.toLowerCase().includes(state.searchQuery) ||
            (q.hn && q.hn.toLowerCase().includes(state.searchQuery)) ||
            (q.department && q.department.toLowerCase().includes(state.searchQuery))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
        <div class="column-empty-state">
            <div class="column-empty-icon">✓</div>
            <p>ไม่มีคิวรอเรียกตรวจ${state.currentDepartment !== 'all' ? `<br><strong>แผนก${state.currentDepartment}</strong>` : ''}</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map((q) => {
        const waitMinutes = Math.floor((Date.now() - q.enteredAt.getTime()) / 60000);
        const isAppointment = q.type === 'appointment';
        const isTransfer = q.type === 'transfer';
        let tagTypeClass = isAppointment ? 'tag-appointment' : 'tag-walkin';
        let tagTypeLabel = isAppointment ? 'นัดหมาย' : 'Walk-in';
        if (isTransfer) {
            tagTypeClass = 'tag-transfer';
            tagTypeLabel = '🔀 ส่งต่อ';
        }
        const lateClass = q.isLate ? 'late-arrival' : '';
        const timeTagClass = q.isLate ? 'tag-appointment-time late' : 'tag-appointment-time';

        return `
        <div class="queue-card ${lateClass}" data-id="${q.id}">
            <div class="card-header">
                <span class="queue-number">${q.queueNumber}</span>
                <div class="card-tags">
                    <span class="${timeTagClass}">
                        ${q.isLate ? '⚠️' : '🕐'} ${isTransfer ? 'ส่งต่อเมื่อ' : 'นัด'} ${q.appointmentTime} น.
                    </span>
                    <span class="tag ${tagTypeClass}">${tagTypeLabel}</span>
                </div>
            </div>
            <div class="card-patient-name">${q.patientName} (${q.hn})</div>
            <div class="card-department">
                ${getDeptBadge(q.department)}
                <span class="card-wait-time">รอมาแล้ว ${waitMinutes} นาที</span>
            </div>
            ${q.transferFrom ? `<div style="font-size:0.75rem; color:#1D4ED8; background:#EFF6FF; padding:3px 8px; border-radius:6px; margin:4px 0;">🔀 ส่งต่อจากแผนก${q.transferFrom}${q.transferReason ? `: ${q.transferReason}` : ''}</div>` : ''}
            ${q.isLate ? `<div class="late-warning">⚠️ มาสาย > 30น. (ย้ายต่อท้าย)</div>` : ''}
            <div class="card-actions">
                <button class="btn-action btn-arrow" onclick="moveQueueUp('${q.id}')" title="เลื่อนคิวขึ้น">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button class="btn-action btn-arrow" onclick="moveQueueDown('${q.id}')" title="เลื่อนคิวลง">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button class="btn-action" onclick="skipQueue('${q.id}')" title="ข้ามคิว">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/><polyline points="15 18 21 12 15 6"/></svg>
                    ข้ามคิว
                </button>
                <button class="btn-action" onclick="recallQueue('${q.id}')" title="เรียกซ้ำ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    เรียกซ้ำ
                </button>
                <button class="btn-action btn-urgent" onclick="callUrgentQueue('${q.id}')" title="เรียกคิวด่วน / แทรกคิวกระทันหัน">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    เรียกด่วน
                </button>
                <button class="btn-action btn-call" onclick="callQueue('${q.id}')" title="เรียกคิว">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    เรียกคิว
                </button>
            </div>
        </div>`;
    }).join('');
}

// ---- Lab Queue (Column 2) ----
function renderLabQueue() {
    const container = document.getElementById('lab-list');
    if (!container) return;

    let filtered = state.labQueue;

    // Filter by department
    if (state.currentDepartment !== 'all') {
        filtered = filtered.filter(q => q.department === state.currentDepartment);
    }

    // Filter by search query
    if (state.searchQuery) {
        filtered = filtered.filter(q =>
            q.queueNumber.toLowerCase().includes(state.searchQuery) ||
            q.patientName.toLowerCase().includes(state.searchQuery) ||
            (q.hn && q.hn.toLowerCase().includes(state.searchQuery)) ||
            (q.department && q.department.toLowerCase().includes(state.searchQuery))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
        <div class="column-empty-state">
            <div class="column-empty-icon">✓</div>
            <p>ไม่มีคิวรอผลตรวจ${state.currentDepartment !== 'all' ? `<br><strong>แผนก${state.currentDepartment}</strong>` : ''}</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(q => {
        const sentMinutes = Math.floor((Date.now() - q.sentAt.getTime()) / 60000);
        const sentTime = `${String(q.sentAt.getHours()).padStart(2,'0')}:${String(q.sentAt.getMinutes()).padStart(2,'0')}`;
        const isUrgent = q.isUrgent;
        const statusClass = isUrgent ? 'lab-status-badge urgent' : (q.labStatus === 'รอผล X-Ray' ? 'lab-status-badge xray' : 'lab-status-badge');
        const cardUrgentClass = isUrgent ? 'urgent-card' : '';

        return `
        <div class="lab-card ${cardUrgentClass}" data-id="${q.id}">
            <div class="lab-card-header">
                <span class="lab-queue-number">${q.queueNumber}</span>
                <span class="${statusClass}">${q.labStatus}</span>
            </div>
            <div class="lab-card-body">
                <div class="lab-patient-name">${q.patientName} (${q.hn})</div>
                <div class="lab-dept" style="margin-bottom:6px;">
                    ${getDeptBadge(q.department)}
                </div>
                <div class="lab-time-info">ส่งตรวจเมื่อ ${sentTime} น. (ผ่านไป ${sentMinutes} นาที)</div>
                <div class="lab-test-type">การตรวจ: ${q.labType}</div>
            </div>
            <div class="lab-card-actions">
                <button class="btn-send-room" onclick="sendBackToQueue('${q.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>
                    ส่งเข้าห้องตรวจ
                </button>
            </div>
        </div>`;
    }).join('');
}

// ---- Rooms (Column 3) ----
function renderRooms() {
    const container = document.getElementById('rooms-list');
    if (!container) return;

    let displayRooms = state.rooms;
    if (state.currentDepartment !== 'all') {
        displayRooms = state.rooms.filter(r =>
            r.department === state.currentDepartment ||
            (r.patient && r.patient.department === state.currentDepartment)
        );
    }

    if (displayRooms.length === 0) {
        container.innerHTML = `
        <div class="column-empty-state">
            <div class="column-empty-icon">🏥</div>
            <p>ไม่มีห้องตรวจสำหรับ<strong>แผนก${state.currentDepartment}</strong></p>
        </div>`;
        return;
    }

    container.innerHTML = displayRooms.map(room => {
        if (room.patient) {
            const sentMinutes = Math.floor((Date.now() - room.patient.sentAt.getTime()) / 60000);
            const sentTime = `${String(room.patient.sentAt.getHours()).padStart(2,'0')}:${String(room.patient.sentAt.getMinutes()).padStart(2,'0')}`;
            const isExamining = room.patient.status === 'examining';
            const badgeClass = isExamining ? 'examining' : 'waiting';
            const badgeText = isExamining ? 'แพทย์กำลังตรวจ' : 'รอแพทย์ตรวจ';
            return `
            <div class="room-card" data-room="${room.id}">
                <div class="room-header">
                    <span class="room-dot occupied"></span>
                    <span class="room-name">${room.name}</span>
                    <span class="room-dept-tag">${room.department}</span>
                    <span class="room-doctor-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="room-content">
                    <div class="room-queue-number">${room.patient.queueNumber}</div>
                    <div class="room-patient-name">${room.patient.patientName} (${room.patient.hn})</div>
                    <div class="room-dept" style="margin-bottom:6px;">
                        ${getDeptBadge(room.patient.department)}
                    </div>
                    <div class="room-send-time">ส่งตรวจ ${sentTime} น. (ผ่านไป ${sentMinutes} นาที)</div>
                </div>
            </div>`;
        } else {
            return `
            <div class="room-card" data-room="${room.id}">
                <div class="room-header">
                    <span class="room-dot vacant"></span>
                    <span class="room-name">${room.name}</span>
                    <span class="room-dept-tag">${room.department}</span>
                </div>
                <div class="room-vacant-text">ว่าง</div>
            </div>`;
        }
    }).join('');
}

// ============ ACTIONS ============

// Move queue up
function moveQueueUp(queueId) {
    const idx = state.waitingQueue.findIndex(q => q.id === queueId);
    if (idx > 0) {
        [state.waitingQueue[idx - 1], state.waitingQueue[idx]] =
            [state.waitingQueue[idx], state.waitingQueue[idx - 1]];
        renderWaitingQueue();
        updateStats();
        showToast(`เลื่อนคิว ${state.waitingQueue[idx - 1].queueNumber} ขึ้น`, 'success');
    }
}

// Move queue down
function moveQueueDown(queueId) {
    const idx = state.waitingQueue.findIndex(q => q.id === queueId);
    if (idx < state.waitingQueue.length - 1) {
        [state.waitingQueue[idx], state.waitingQueue[idx + 1]] =
            [state.waitingQueue[idx + 1], state.waitingQueue[idx]];
        renderWaitingQueue();
        updateStats();
        showToast(`เลื่อนคิว ${state.waitingQueue[idx + 1].queueNumber} ลง`, 'success');
    }
}

// Skip queue - move to end
function skipQueue(queueId) {
    const idx = state.waitingQueue.findIndex(q => q.id === queueId);
    if (idx !== -1) {
        const [item] = state.waitingQueue.splice(idx, 1);
        state.waitingQueue.push(item);
        renderWaitingQueue();
        updateStats();
        showToast(`ข้ามคิว ${item.queueNumber} ไปท้ายสุด`, 'warning');
    }
}

// Recall queue
function recallQueue(queueId) {
    const q = state.waitingQueue.find(q => q.id === queueId);
    if (q) {
        soundManager.announceQueue(q.queueNumber, 'recall', '', q.patientName);
        showToast(`📢 เรียกซ้ำคิว ${q.queueNumber} - ${q.patientName} (${q.department})`, 'success');
    }
}

// Call queue - send to lab/vitalsign first
function callQueue(queueId) {
    const idx = state.waitingQueue.findIndex(q => q.id === queueId);
    if (idx === -1) return;

    const [patient] = state.waitingQueue.splice(idx, 1);

    // Move patient to lab queue (column 2)
    state.labQueue.push({
        id: 'lab_' + Date.now(),
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        department: patient.department,
        labType: 'Vitalsign / Lab',
        labStatus: 'กำลังตรวจ',
        sentAt: new Date(),
    });

    renderAll();
    soundManager.announceQueue(patient.queueNumber, 'call', '', patient.patientName);
    showToast(`📋 เรียกคิว ${patient.queueNumber} → ส่งตรวจแล็บ/Vitalsign (${patient.department})`, 'success');
}

// Call urgent queue - insert to top of lab queue immediately
function callUrgentQueue(queueId) {
    const idx = state.waitingQueue.findIndex(q => q.id === queueId);
    if (idx === -1) return;

    const [patient] = state.waitingQueue.splice(idx, 1);

    // Insert at front of lab queue
    state.labQueue.unshift({
        id: 'lab_urgent_' + Date.now(),
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        department: patient.department,
        labType: '⚡ ตรวจด่วนฉุกเฉิน / Vitalsign',
        labStatus: '🚨 คิวด่วนพิเศษ',
        sentAt: new Date(),
        isUrgent: true,
    });

    renderAll();
    soundManager.announceQueue(patient.queueNumber, 'urgent', '', patient.patientName);
    showToast(`🚨 เรียกด่วน! คิว ${patient.queueNumber} - ${patient.patientName} (แทรกคิวส่งตรวจทันที)`, 'error');
}

// ============ URGENT MODAL LOGIC ============
let urgentQueueCounter = 1;

function openUrgentModal() {
    const deptPrefixMap = {
        'อายุรกรรม': 'EM-M',
        'ทันตกรรม': 'EM-D',
        'ศัลยกรรม': 'EM-S',
        'กุมารเวชกรรม': 'EM-P',
        'จักษุวิทยา': 'EM-E',
        'กระดูกและข้อ': 'EM-O'
    };
    const prefix = (deptPrefixMap[state.currentDepartment] || 'EM');
    const code = prefix + '-' + String(urgentQueueCounter++).padStart(3, '0');

    const queueInput = document.getElementById('urgent-queue-number');
    if (queueInput) queueInput.value = code;

    const hnInput = document.getElementById('urgent-hn');
    if (hnInput) {
        const randHN = 'HN 67-' + Math.floor(100000 + Math.random() * 900000);
        hnInput.value = randHN;
    }

    const nameInput = document.getElementById('urgent-patient-name');
    if (nameInput) {
        nameInput.value = '';
        setTimeout(() => nameInput.focus(), 150);
    }

    const deptSelect = document.getElementById('urgent-department');
    if (deptSelect && state.currentDepartment !== 'all') {
        deptSelect.value = state.currentDepartment;
    }

    const modal = document.getElementById('urgent-modal');
    if (modal) modal.style.display = 'flex';
}

function closeUrgentModal() {
    const modal = document.getElementById('urgent-modal');
    if (modal) modal.style.display = 'none';
}

function handleUrgentModalBackdrop(e) {
    if (e.target.id === 'urgent-modal') {
        closeUrgentModal();
    }
}

function submitUrgentQueue() {
    const queueNumber = (document.getElementById('urgent-queue-number')?.value || '').trim();
    const patientName = (document.getElementById('urgent-patient-name')?.value || '').trim();
    const hn = (document.getElementById('urgent-hn')?.value || '').trim() || '-';
    const department = document.getElementById('urgent-department')?.value || 'อายุรกรรม';
    const actionType = document.querySelector('input[name="urgent-action-type"]:checked')?.value || 'lab';

    if (!queueNumber) {
        showToast('กรุณาระบุหมายเลขคิวด่วน', 'error');
        return;
    }
    if (!patientName) {
        showToast('กรุณาระบุชื่อผู้ป่วยหรือรายละเอียดอาการ', 'error');
        return;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    if (actionType === 'lab') {
        // Send directly to top of labQueue
        state.labQueue.unshift({
            id: 'lab_urgent_' + Date.now(),
            queueNumber: queueNumber,
            patientName: patientName,
            hn: hn,
            department: department,
            labType: '⚡ ตรวจด่วนฉุกเฉิน / Vitalsign',
            labStatus: '🚨 คิวด่วนพิเศษ',
            sentAt: now,
            isUrgent: true,
        });
        showToast(`🚨 แทรกคิวด่วน! ${queueNumber} - ${patientName} ส่งไปจุดตรวจสัญญาณชีพ/แล็บทันที`, 'error');
        soundManager.announceQueue(queueNumber, 'urgent');
    } else {
        // Insert as #1 in waitingQueue
        state.waitingQueue.unshift({
            id: 'q_urgent_' + Date.now(),
            queueNumber: queueNumber,
            type: 'walkin',
            appointmentTime: timeStr,
            patientName: patientName,
            hn: hn,
            department: department,
            enteredAt: now,
            isLate: false,
            lateMessage: '',
            isUrgent: true,
        });
        showToast(`⚡ แทรกคิวด่วน! ${queueNumber} - ${patientName} ไว้ลำดับที่ 1 ของคิวรอตรวจ`, 'error');
        soundManager.announceQueue(queueNumber, 'urgent');
    }

    closeUrgentModal();
    renderAll();
}


// Send back from lab to room modal
function sendBackToQueue(labId) {
    state.callingLabId = labId;
    const labItem = state.labQueue.find(q => q.id === labId);
    if (!labItem) return;

    // Check if there are vacant rooms
    const hasVacant = state.rooms.some(r => r.patient === null);
    if (!hasVacant) {
        showToast('ไม่มีห้องตรวจว่าง กรุณารอจนกว่าจะมีห้องว่าง', 'error');
        return;
    }

    renderRoomModal();
    document.getElementById('room-modal').style.display = 'flex';
}

function renderRoomModal() {
    const grid = document.getElementById('modal-room-grid');
    const callingPatient = state.labQueue.find(q => q.id === state.callingLabId);

    grid.innerHTML = state.rooms.map((room, idx) => {
        const isOccupied = room.patient !== null;
        const disabledClass = isOccupied ? 'disabled' : '';
        const isMatchingDept = callingPatient && callingPatient.department === room.department;
        const highlightStyle = isMatchingDept ? 'border: 2px solid var(--teal-500);' : '';

        if (isOccupied) {
            return `
            <div class="room-option ${disabledClass}" data-room-idx="${idx}">
                <div class="room-option-name">
                    <span class="room-option-dot occupied"></span> ${room.name}
                    <span class="room-dept-tag">${room.department}</span>
                </div>
                <div class="room-option-queue">${room.patient.queueNumber}</div>
                <div class="room-option-patient">${room.patient.patientName}</div>
            </div>`;
        } else {
            return `
            <div class="room-option" data-room-idx="${idx}" onclick="selectRoom(${idx})" style="${highlightStyle}">
                <div class="room-option-name">
                    <span class="room-option-dot vacant"></span> ${room.name}
                    <span class="room-dept-tag">${room.department}</span>
                </div>
                <div class="room-option-vacant">${isMatchingDept ? '⭐ แนะนำ (ตรงแผนก)' : 'ว่าง'}</div>
            </div>`;
        }
    }).join('');

    document.getElementById('btn-confirm-room').disabled = true;
}

function selectRoom(roomIdx) {
    document.querySelectorAll('.room-option').forEach(el => el.classList.remove('selected'));

    const el = document.querySelector(`.room-option[data-room-idx="${roomIdx}"]`);
    if (el && !el.classList.contains('disabled')) {
        el.classList.add('selected');
        state.selectedRoomIndex = roomIdx;
        document.getElementById('btn-confirm-room').disabled = false;
    }
}

function confirmRoomSelection() {
    if (state.selectedRoomIndex === null || state.callingLabId === null) return;

    const labIdx = state.labQueue.findIndex(q => q.id === state.callingLabId);
    if (labIdx === -1) return;

    const [labItem] = state.labQueue.splice(labIdx, 1);
    const room = state.rooms[state.selectedRoomIndex];

    room.patient = {
        id: labItem.id,
        queueNumber: labItem.queueNumber,
        patientName: labItem.patientName,
        hn: labItem.hn,
        department: labItem.department,
        sentAt: new Date(),
        status: 'waiting',
        previousStation: 'lab',
        previousData: { ...labItem },
    };

    document.getElementById('room-modal').style.display = 'none';
    state.callingLabId = null;
    state.selectedRoomIndex = null;

    renderAll();
    showToast(`ส่ง ${labItem.queueNumber} เข้า ${room.name} (${room.department})`, 'success');
}

// Send to Lab (from room)
function sendToLab(roomId) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    state.labQueue.push({
        id: 'lab_' + Date.now(),
        queueNumber: patient.queueNumber,
        patientName: patient.patientName,
        hn: patient.hn,
        department: patient.department,
        labType: 'Vitalsign / Lab',
        labStatus: 'รอผลแล็บ',
        sentAt: new Date(),
    });

    room.patient = null;
    renderAll();
    showToast(`ส่ง ${patient.queueNumber} ไปตรวจแล็บ`, 'success');
}

// Exam Done
function examDone(roomId) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room || !room.patient) return;

    const patient = room.patient;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    state.historyRecords.unshift({
        time: timeStr,
        queue: patient.queueNumber,
        name: patient.patientName,
        hn: patient.hn || '-',
        an: '-',
        type: 'appointment',
        aptTime: '-',
        dept: patient.department,
        status: 'done',
    });

    state.completedToday++;
    room.patient = null;

    renderAll();
    showToast(`ตรวจเสร็จสิ้น ${patient.queueNumber} - ${patient.patientName}`, 'success');
}

// ============ GENERATE PATIENT QUEUE ============
let genQueueCounter = 120;

function generateNewPatientQueue() {
    const thaiFirstNames = [
        'สมชาย', 'วิภา', 'กิตติศักดิ์', 'พรทิพย์', 'ชัยวัฒน์',
        'สุภาพร', 'ธนาคาร', 'กัญญารัตน์', 'พีรพล', 'ณัฐวุฒิ',
        'ศิริพร', 'ปิยะวัฒน์', 'วรัญญา', 'อัครเดช', 'จิราภรณ์',
        'ธนพล', 'พิมลวรรณ', 'ชลธิชา', 'บุญส่ง', 'วรรณวิมล',
        'ธีรพงษ์', 'กาญจนา', 'ประสิทธิ์', 'อรทัย', 'ศุภชัย'
    ];
    const thaiLastNames = [
        'สุขใจ', 'ทองดี', 'เจริญสุข', 'รักษ์ไทย', 'ศรีสวัสดิ์',
        'วงศ์สว่าง', 'พงษ์พาณิชย์', 'รัตนโกสินทร์', 'บุญฤทธิ์', 'ประเสริฐสม',
        'มงคลกุล', 'เลิศวิริยะ', 'สุวรรณศรี', 'จารุวัฒน์', 'เกษมสุข',
        'ชัยมงคล', 'ศิริโรจน์', 'ทวีโชค', 'สมบัติอนันต์', 'แสงสุวรรณ'
    ];
    const departments = [
        { name: 'อายุรกรรม', prefix: 'M' },
        { name: 'ทันตกรรม', prefix: 'D' },
        { name: 'ศัลยกรรม', prefix: 'SR' },
        { name: 'กุมารเวชกรรม', prefix: 'P' },
        { name: 'จักษุวิทยา', prefix: 'E' },
        { name: 'กระดูกและข้อ', prefix: 'OR' }
    ];

    // Select department: prioritize current department filter if active, otherwise random
    let deptObj;
    if (state.currentDepartment && state.currentDepartment !== 'all') {
        deptObj = departments.find(d => d.name === state.currentDepartment) || departments[0];
    } else {
        deptObj = departments[Math.floor(Math.random() * departments.length)];
    }

    const firstName = thaiFirstNames[Math.floor(Math.random() * thaiFirstNames.length)];
    const lastName = thaiLastNames[Math.floor(Math.random() * thaiLastNames.length)];
    const title = deptObj.name === 'กุมารเวชกรรม'
        ? (Math.random() > 0.5 ? 'ด.ช. ' : 'ด.ญ. ')
        : 'คุณ ';
    const patientName = `${title}${firstName} ${lastName}`;

    // Generate unique queue number with prefix
    genQueueCounter++;
    const queueNumber = `${deptObj.prefix}-${String(genQueueCounter).padStart(3, '0')}`;

    // Generate HN
    const hn = `HN 67-0${Math.floor(10000 + Math.random() * 90000)}`;

    // Type: appointment or walkin
    const isAppointment = Math.random() > 0.4;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const aptTime = isAppointment
        ? `${String(h).padStart(2,'0')}:${String((m + 15) % 60).padStart(2,'0')}`
        : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

    const newQueueItem = {
        id: 'q_gen_' + Date.now(),
        queueNumber: queueNumber,
        type: isAppointment ? 'appointment' : 'walkin',
        appointmentTime: aptTime,
        patientName: patientName,
        hn: hn,
        department: deptObj.name,
        enteredAt: now,
        isLate: false,
        lateMessage: '',
    };

    // Add to waiting queue
    state.waitingQueue.push(newQueueItem);

    // Save and re-render all views
    renderAll();

    // Play a gentle notification chime
    soundManager.playChime(false);

    showToast(`✅ เจนเพิ่มคิวใหม่: ${queueNumber} - ${patientName} (${deptObj.name})`, 'success');
}

// ============ LATE ARRIVAL SIMULATION ============
function simulateLateArrival() {
    let lateCount = 0;
    state.waitingQueue.forEach(q => {
        if (q.type === 'appointment' && !q.isLate) {
            q.isLate = true;
            q.lateMessage = '⚠️ มาสาย > 30น. (ย้ายต่อท้าย)';
            lateCount++;
        }
    });

    if (lateCount > 0) {
        const lateItems = state.waitingQueue.filter(q => q.isLate);
        const normalItems = state.waitingQueue.filter(q => !q.isLate);
        state.waitingQueue = [...normalItems, ...lateItems];

        renderAll();
        showToast(`⚠️ พบ ${lateCount} คิวมาสาย > 30 นาที ย้ายต่อท้ายแล้ว`, 'warning');
    } else {
        showToast('ไม่มีคิวนัดหมายที่ต้องย้าย', 'warning');
    }
}

// ============ NAVIGATION & SIDEBAR CONTROLS ============
function switchPage(pageName, activeEl = null) {
    if (!pageName) return;
    state.currentPage = pageName;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (activeEl) {
        activeEl.classList.add('active');
    } else {
        const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (activeNav) activeNav.classList.add('active');
    }

    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const activePage = document.getElementById(`page-${pageName}`);
    if (activePage) activePage.classList.add('active');

    // Toggle active state on bottom sidebar user profile
    const sidebarProfile = document.getElementById('sidebar-user-profile');
    if (sidebarProfile) {
        sidebarProfile.classList.toggle('active', pageName === 'profile');
    }

    const titles = {
        dashboard: 'หน้าจอหลัก',
        appointments: 'การจัดการนัดหมายผู้ป่วย',
        history: 'ประวัติการเรียกคิว',
        overdue: 'คิวเกินกำหนด',
        reports: 'รายงานสถิติ',
        settings: 'ตั้งค่าระบบ',
        profile: 'ข้อมูลผู้ใช้งาน (User Profile)',
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        titleEl.textContent = titles[pageName] || 'หน้าจอหลัก';
    }

    if (pageName === 'appointments') {
        renderAppointments();
    } else if (pageName === 'reports') {
        renderReportsDashboard();
    } else if (pageName === 'history') {
        renderHistory();
    } else if (pageName === 'profile') {
        renderUserProfilePage();
    } else if (pageName === 'settings') {
        renderSettingsPage();
    }
}

// Sidebar Collapse / Expand Toggle
function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const layout = document.querySelector('.app-layout');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (layout) {
        layout.classList.toggle('sidebar-collapsed', isCollapsed);
    }
    localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
}

// ============ REPORTS & STATISTICS DASHBOARD ============

function getReportsCalculatedData() {
    const dateRange = document.getElementById('reports-date-range')?.value || 'today';
    const deptFilter = document.getElementById('reports-dept-filter')?.value || 'all';

    // Multiplier for timeframe aggregation
    const multiplier = dateRange === 'week' ? 6 : (dateRange === 'month' ? 24 : 1);

    const depts = [
        { name: 'อายุรกรรม', icon: '🩺', baseWait: 18, baseExam: 15, baseDone: 9 },
        { name: 'ทันตกรรม', icon: '🦷', baseWait: 12, baseExam: 20, baseDone: 7 },
        { name: 'ศัลยกรรม', icon: '✂️', baseWait: 22, baseExam: 18, baseDone: 4 },
        { name: 'กุมารเวชกรรม', icon: '👶', baseWait: 14, baseExam: 12, baseDone: 5 },
        { name: 'จักษุวิทยา', icon: '👁️', baseWait: 11, baseExam: 10, baseDone: 2 },
        { name: 'กระดูกและข้อ', icon: '🦴', baseWait: 16, baseExam: 16, baseDone: 1 },
    ];

    const deptStats = depts.map(d => {
        const waiting = state.waitingQueue.filter(q => q.department === d.name).length;
        const examining = state.rooms.filter(r => (r.department === d.name && r.patient) || (r.patient && r.patient.department === d.name)).length;
        const lab = state.labQueue.filter(q => q.department === d.name).length;
        const historyDone = state.historyRecords.filter(r => r.dept === d.name && r.status === 'done').length;

        const completed = (d.baseDone + historyDone) * multiplier;
        const total = completed + (waiting + examining + lab) * (dateRange === 'today' ? 1 : multiplier);
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

        const activeLoad = waiting + examining + lab;
        let density = 'normal';
        let densityLabel = '🟢 ปกติ';
        if (activeLoad >= 4) {
            density = 'high';
            densityLabel = '🔴 หนาแน่นสูง';
        } else if (activeLoad >= 2) {
            density = 'moderate';
            densityLabel = '🟡 ปานกลาง';
        }

        return {
            ...d,
            waiting,
            examining,
            lab,
            completed,
            total,
            completionRate,
            avgWait: d.baseWait,
            avgExam: d.baseExam,
            density,
            densityLabel,
            activeLoad
        };
    });

    return {
        dateRange,
        deptFilter,
        deptStats,
        multiplier
    };
}

function renderReportsDashboard() {
    const data = getReportsCalculatedData();
    const filteredStats = data.deptFilter === 'all'
        ? data.deptStats
        : data.deptStats.filter(d => d.name === data.deptFilter);

    const totalPatients = filteredStats.reduce((s, d) => s + d.total, 0);
    const completedPatients = filteredStats.reduce((s, d) => s + d.completed, 0);
    const completionRate = totalPatients > 0 ? Math.round((completedPatients / totalPatients) * 100) : 0;
    const avgWait = Math.round(filteredStats.reduce((s, d) => s + d.avgWait * d.total, 0) / (totalPatients || 1));
    const avgExam = Math.round(filteredStats.reduce((s, d) => s + d.avgExam * d.total, 0) / (totalPatients || 1));
    const urgentCount = (state.waitingQueue.filter(q => q.isUrgent).length + state.labQueue.filter(q => q.isUrgent).length + 3) * data.multiplier;

    // 1. Update KPI Cards
    const totalEl = document.getElementById('kpi-total-patients');
    if (totalEl) totalEl.textContent = totalPatients;

    const completedEl = document.getElementById('kpi-completed-patients');
    if (completedEl) completedEl.textContent = completedPatients;

    const rateEl = document.getElementById('kpi-completion-rate');
    if (rateEl) rateEl.textContent = `ความสำเร็จ ${completionRate}%`;

    const waitEl = document.getElementById('kpi-avg-waiting');
    if (waitEl) waitEl.textContent = avgWait;

    const examEl = document.getElementById('kpi-avg-exam');
    if (examEl) examEl.textContent = avgExam;

    const urgentEl = document.getElementById('kpi-urgent-count');
    if (urgentEl) urgentEl.textContent = urgentCount;

    // 2. Render Hourly Chart
    const hourlyContainer = document.getElementById('hourly-bars-container');
    if (hourlyContainer) {
        const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
        const ratios = [0.06, 0.16, 0.20, 0.15, 0.05, 0.12, 0.11, 0.08, 0.04, 0.03];
        const hourlyCounts = ratios.map(r => Math.max(1, Math.round(r * totalPatients)));
        const maxCount = Math.max(...hourlyCounts, 1);

        hourlyContainer.innerHTML = hours.map((hour, idx) => {
            const count = hourlyCounts[idx];
            const heightPercent = Math.max(12, Math.round((count / maxCount) * 88));
            const isPeak = ['09:00', '10:00', '11:00'].includes(hour);
            const peakClass = isPeak ? 'peak' : '';

            return `
            <div class="hourly-bar-col" title="${hour} น. : ${count} คน">
                <span class="hourly-bar-val">${count}</span>
                <div class="hourly-bar-fill ${peakClass}" style="height: ${heightPercent}%;"></div>
                <span class="hourly-bar-label">${hour}</span>
            </div>`;
        }).join('');
    }

    // 3. Render Queue Type Breakdown
    const typeBreakdownContainer = document.getElementById('queue-type-breakdown');
    if (typeBreakdownContainer) {
        const aptCount = Math.round(totalPatients * 0.46);
        const walkinCount = Math.round(totalPatients * 0.38);
        const urgentTypeCount = Math.round(totalPatients * 0.10);
        const transferCount = Math.max(1, totalPatients - aptCount - walkinCount - urgentTypeCount);

        const types = [
            { label: 'นัดหมาย (Appointment)', count: aptCount, pct: Math.round((aptCount / (totalPatients || 1)) * 100), color: '#00897B' },
            { label: 'Walk-in ทั่วไป', count: walkinCount, pct: Math.round((walkinCount / (totalPatients || 1)) * 100), color: '#10B981' },
            { label: 'คิวด่วนพิเศษ / แทรกคิว', count: urgentTypeCount, pct: Math.round((urgentTypeCount / (totalPatients || 1)) * 100), color: '#E11D48' },
            { label: 'ส่งต่อระหว่างแผนก', count: transferCount, pct: Math.round((transferCount / (totalPatients || 1)) * 100), color: '#3B82F6' },
        ];

        typeBreakdownContainer.innerHTML = types.map(t => `
            <div class="type-bar-item">
                <div class="type-bar-header">
                    <span>${t.label}</span>
                    <span><strong>${t.count} คน</strong> (${t.pct}%)</span>
                </div>
                <div class="type-bar-track">
                    <div class="type-bar-thumb" style="width: ${t.pct}%; background: ${t.color};"></div>
                </div>
            </div>
        `).join('');
    }

    // 4. Render Department Workload Bars
    const deptListContainer = document.getElementById('dept-progress-list');
    if (deptListContainer) {
        const sortedDepts = [...data.deptStats].sort((a, b) => b.total - a.total);
        const maxDeptTotal = Math.max(...sortedDepts.map(d => d.total), 1);

        deptListContainer.innerHTML = sortedDepts.map(d => {
            const pct = Math.round((d.total / (totalPatients || 1)) * 100);
            const barWidth = Math.round((d.total / maxDeptTotal) * 100);
            return `
            <div class="dept-progress-item">
                <div class="dept-name-wrap">
                    <span>${d.icon}</span>
                    <span>${d.name}</span>
                </div>
                <div class="dept-bar-track">
                    <div class="dept-bar-fill" style="width: ${barWidth}%;"></div>
                </div>
                <div class="dept-count-badge">${d.total} คน (${pct}%)</div>
            </div>`;
        }).join('');
    }

    // 5. Render Department Table
    const tbody = document.getElementById('reports-dept-tbody');
    if (tbody) {
        tbody.innerHTML = filteredStats.map(d => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;font-weight:600;">
                        <span>${d.icon}</span>
                        <span>${d.name}</span>
                    </div>
                </td>
                <td><strong>${d.total}</strong> คน</td>
                <td style="color:#059669;font-weight:600;">${d.completed} คน</td>
                <td style="color:#2563EB;">${d.examining} คน</td>
                <td style="color:#D97706;">${d.waiting} คน</td>
                <td>${d.avgWait} นาที</td>
                <td>
                    <span style="font-weight:600;color:${d.completionRate >= 80 ? '#15803D' : '#B45309'};">
                        ${d.completionRate}%
                    </span>
                </td>
                <td>
                    <span class="density-pill ${d.density}">${d.densityLabel}</span>
                </td>
            </tr>
        `).join('');

        // Add summary row if more than one department
        if (filteredStats.length > 1) {
            const totWaiting = filteredStats.reduce((s, d) => s + d.waiting, 0);
            const totExamining = filteredStats.reduce((s, d) => s + d.examining, 0);
            tbody.innerHTML += `
            <tr style="background:#F0FDF4;font-weight:700;border-top:2px solid var(--teal-200);">
                <td><strong>รวมทั้งหมด (${filteredStats.length} แผนก)</strong></td>
                <td><strong>${totalPatients} คน</strong></td>
                <td style="color:#059669;"><strong>${completedPatients} คน</strong></td>
                <td style="color:#2563EB;"><strong>${totExamining} คน</strong></td>
                <td style="color:#D97706;"><strong>${totWaiting} คน</strong></td>
                <td><strong>${avgWait} นาที</strong></td>
                <td style="color:#15803D;"><strong>${completionRate}%</strong></td>
                <td><span class="density-pill normal">🟢 ระบบคล่องตัว</span></td>
            </tr>`;
        }
    }
}

// ============ EXPORT REPORT TO EXCEL (CSV) ============
function exportReportCSV() {
    const data = getReportsCalculatedData();
    const now = new Date();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const timeFormatted = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const dateRangeLabel = {
        today: 'วันนี้ (Today)',
        week: 'สัปดาห์นี้ (This Week)',
        month: 'เดือนนี้ (This Month)'
    }[data.dateRange] || data.dateRange;

    const deptFilterLabel = data.deptFilter === 'all' ? 'ทุกแผนก (All Departments)' : data.deptFilter;

    const filteredStats = data.deptFilter === 'all'
        ? data.deptStats
        : data.deptStats.filter(d => d.name === data.deptFilter);

    const totalPatients = filteredStats.reduce((s, d) => s + d.total, 0);
    const completedPatients = filteredStats.reduce((s, d) => s + d.completed, 0);
    const completionRate = totalPatients > 0 ? Math.round((completedPatients / totalPatients) * 100) : 0;
    const avgWait = Math.round(filteredStats.reduce((s, d) => s + d.avgWait * d.total, 0) / (totalPatients || 1));
    const avgExam = Math.round(filteredStats.reduce((s, d) => s + d.avgExam * d.total, 0) / (totalPatients || 1));
    const urgentCount = (state.waitingQueue.filter(q => q.isUrgent).length + state.labQueue.filter(q => q.isUrgent).length + 3) * data.multiplier;

    let csv = '';
    // Title Header
    csv += `"รายงานสถิติการให้บริการระบบคิวผู้ป่วย (Hospital Queue Management Report)"\r\n`;
    csv += `"วันที่พิมพ์รายงาน","${dateFormatted} ${timeFormatted} น."\r\n`;
    csv += `"ช่วงเวลาที่เลือก","${dateRangeLabel}"\r\n`;
    csv += `"แผนกที่เลือก","${deptFilterLabel}"\r\n\r\n`;

    // Key Performance Indicators Section
    csv += `"=== สรุปตัวชี้วัดหลัก (Key Performance Indicators) ==="\r\n`;
    csv += `"ตัวชี้วัด","ค่าสถิติ","หน่วย"\r\n`;
    csv += `"ผู้ป่วยเข้ารับบริการทั้งหมด","${totalPatients}","คน"\r\n`;
    csv += `"ตรวจเสร็จสิ้นแล้ว","${completedPatients}","คน"\r\n`;
    csv += `"อัตราความสำเร็จ (Completion Rate)","${completionRate}%","%"\r\n`;
    csv += `"เวลารอคอยเฉลี่ย","${avgWait}","นาที"\r\n`;
    csv += `"เวลาตรวจเฉลี่ยต่อคน","${avgExam}","นาที"\r\n`;
    csv += `"คิวด่วนพิเศษ / แทรกคิว","${urgentCount}","เคส"\r\n\r\n`;

    // Department Breakdown Section
    csv += `"=== สถิติประสิทธิภาพการให้บริการรายแผนก ==="\r\n`;
    csv += `"แผนกการรักษา","คิวทั้งหมด","ตรวจเสร็จแล้ว","กำลังตรวจในห้อง","รอเรียกตรวจ","เวลารอเฉลี่ย (นาที)","อัตราสำเร็จ (%)","สถานะความหนาแน่น"\r\n`;

    filteredStats.forEach(d => {
        csv += `"${d.name}","${d.total}","${d.completed}","${d.examining}","${d.waiting}","${d.avgWait}","${d.completionRate}%","${d.densityLabel}"\r\n`;
    });

    const totalWaiting = filteredStats.reduce((s, d) => s + d.waiting, 0);
    const totalExamining = filteredStats.reduce((s, d) => s + d.examining, 0);
    csv += `"รวมทั้งหมด (${filteredStats.length} แผนก)","${totalPatients}","${completedPatients}","${totalExamining}","${totalWaiting}","${avgWait}","${completionRate}%","-"\r\n`;

    // Create Blob with UTF-8 BOM so Thai characters show correctly in Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hospital_Queue_Report_${dateFormatted}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('📥 ดาวน์โหลดรายงานสถิติ Excel (CSV) สำเร็จ เรียบร้อยแล้ว', 'success');
}

// ============ PRINT / PDF ============
function printReport() {
    window.print();
}

// ========================================================
// APPOINTMENT MANAGEMENT SYSTEM (การจัดการนัดหมาย)
// ========================================================

const DEPARTMENT_DOCTORS = {
    'อายุรกรรม': ['นพ. เกียรติศักดิ์ มณีโชติ', 'พญ. นภาพร รัตนเสถียร', 'นพ. วรพงษ์ จิตประภัสสร'],
    'ทันตกรรม': ['ทพญ. อรทัย รุ่งเรืองกิจ', 'ทพ. ธีรพัฒน์ สมบูรณ์ผล', 'ทพญ. ปิยะฉัตร วัฒนา'],
    'ศัลยกรรม': ['นพ. ประวิทย์ ศรีสวัสดิ์', 'นพ. รณชัย เกษมสันต์'],
    'กุมารเวชกรรม': ['พญ. ศศิธร เจริญศิลป์', 'พญ. ดลหทัย บุญญาภิวัฒน์'],
    'จักษุวิทยา': ['พญ. วิภาดา ชัยพิทักษ์', 'นพ. สรยุทธ วิริยกิจ'],
    'กระดูกและข้อ': ['นพ. คมกริช ชุณหศิลป์', 'นพ. นพรัตน์ แสนสุข'],
};

function getSampleAppointments() {
    const today = new Date();
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const dToday = formatDate(today);
    const tom = new Date(today);
    tom.setDate(today.getDate() + 1);
    const dTomorrow = formatDate(tom);
    const next2 = new Date(today);
    next2.setDate(today.getDate() + 2);
    const dNext2 = formatDate(next2);
    const next5 = new Date(today);
    next5.setDate(today.getDate() + 5);
    const dNext5 = formatDate(next5);

    return [
        {
            id: 'APT-6701',
            hn: 'HN 67-041920',
            name: 'นาย ประสิทธิ์ รุ่งกิจ',
            phone: '081-456-7890',
            department: 'อายุรกรรม',
            doctor: 'นพ. เกียรติศักดิ์ มณีโชติ',
            date: dToday,
            time: '09:00',
            reason: 'ตรวจติดตามความดันโลหิตสูงและเบาหวาน',
            status: 'confirmed',
            checkedIn: false,
        },
        {
            id: 'APT-6702',
            hn: 'HN 67-041921',
            name: 'นาง สุดาพร แก้วมณี',
            phone: '089-234-5678',
            department: 'ทันตกรรม',
            doctor: 'ทพญ. อรทัย รุ่งเรืองกิจ',
            date: dToday,
            time: '09:30',
            reason: 'นัดตรวจฟันและขูดหินปูนประจำปี',
            status: 'confirmed',
            checkedIn: false,
        },
        {
            id: 'APT-6703',
            hn: 'HN 67-050119',
            name: 'นาย วิเชียร ทรัพย์เพิ่ม',
            phone: '086-789-0123',
            department: 'ศัลยกรรม',
            doctor: 'นพ. ประวิทย์ ศรีสวัสดิ์',
            date: dToday,
            time: '10:00',
            reason: 'ตัดไหมและตรวจแผลผ่าตัดช่องท้อง',
            status: 'rescheduled',
            oldDate: dToday,
            oldTime: '08:30',
            rescheduleReason: 'ผู้ป่วยขอเลื่อนเวลาติดภารกิจช่วงเช้า',
            checkedIn: false,
        },
        {
            id: 'APT-6704',
            hn: 'HN 67-061005',
            name: 'ด.ช. อนันต์ รักษ์ดี',
            phone: '085-678-9012',
            department: 'กุมารเวชกรรม',
            doctor: 'พญ. ศศิธร เจริญศิลป์',
            date: dToday,
            time: '10:30',
            reason: 'ฉีดวัคซีนป้องกันไข้หวัดใหญ่และตรวจพัฒนาการ',
            status: 'confirmed',
            checkedIn: false,
        },
        {
            id: 'APT-6705',
            hn: 'HN 67-074199',
            name: 'นาง นิตยา ประเสริฐยิ่ง',
            phone: '084-567-8901',
            department: 'จักษุวิทยา',
            doctor: 'พญ. วิภาดา ชัยพิทักษ์',
            date: dToday,
            time: '11:00',
            reason: 'ตรวจวัดสายตาประกอบแว่นและตรวจต้อกระจก',
            status: 'cancelled',
            cancelReason: 'คนไข้แจ้งติดธุระต่างจังหวัดขอยกเลิก',
            checkedIn: false,
        },
        {
            id: 'APT-6706',
            hn: 'HN 67-083410',
            name: 'นาย กิตติศักดิ์ แสนกล้า',
            phone: '083-456-7890',
            department: 'กระดูกและข้อ',
            doctor: 'นพ. คมกริช ชุณหศิลป์',
            date: dTomorrow,
            time: '09:00',
            reason: 'ตรวจติดตามอาการปวดเข่าและฉีดยาข้อเข่า',
            status: 'confirmed',
            checkedIn: false,
        },
        {
            id: 'APT-6707',
            hn: 'HN 67-042100',
            name: 'นาง บุญเรือน พัฒนกิจ',
            phone: '082-345-6789',
            department: 'อายุรกรรม',
            doctor: 'พญ. นภาพร รัตนเสถียร',
            date: dTomorrow,
            time: '13:30',
            reason: 'ตรวจไขมันในเลือดและติดตามผลตรวจสุขภาพ',
            status: 'confirmed',
            checkedIn: false,
        },
        {
            id: 'APT-6708',
            hn: 'HN 67-041999',
            name: 'นาย ชัยรัตน์ โสภณ',
            phone: '087-123-9876',
            department: 'ทันตกรรม',
            doctor: 'ทพ. ธีรพัฒน์ สมบูรณ์ผล',
            date: dNext5,
            time: '10:00',
            reason: 'อุดฟันกรามซ้ายล่าง',
            status: 'rescheduled',
            oldDate: dNext2,
            oldTime: '10:00',
            rescheduleReason: 'แพทย์ติดประชุมวิชาการ',
            checkedIn: false,
        },
    ];
}

function initAppointments() {
    const saved = localStorage.getItem('hospitalAppointments');
    if (saved) {
        try {
            state.appointments = JSON.parse(saved);
        } catch (e) {
            state.appointments = getSampleAppointments();
        }
    } else {
        state.appointments = getSampleAppointments();
        saveAppointments();
    }
}

function saveAppointments() {
    localStorage.setItem('hospitalAppointments', JSON.stringify(state.appointments));
}

// Render Appointments Table & KPIs
function renderAppointments() {
    const tbody = document.getElementById('appt-table-tbody');
    if (!state.appointments) state.appointments = [];

    // 1. KPI Counts
    const totalCount = state.appointments.length;
    const confirmedCount = state.appointments.filter(a => a.status === 'confirmed').length;
    const rescheduledCount = state.appointments.filter(a => a.status === 'rescheduled').length;
    const cancelledCount = state.appointments.filter(a => a.status === 'cancelled').length;

    const elTotal = document.getElementById('kpi-appt-total');
    if (elTotal) elTotal.textContent = totalCount;
    const elConf = document.getElementById('kpi-appt-confirmed');
    if (elConf) elConf.textContent = confirmedCount;
    const elResch = document.getElementById('kpi-appt-rescheduled');
    if (elResch) elResch.textContent = rescheduledCount;
    const elCanc = document.getElementById('kpi-appt-cancelled');
    if (elCanc) elCanc.textContent = cancelledCount;

    // Update Sidebar Badge
    const badge = document.getElementById('nav-appointments-badge');
    if (badge) {
        const activeCount = confirmedCount + rescheduledCount;
        badge.textContent = activeCount;
        badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
    }

    if (!tbody) return;

    // 2. Filters
    const dateFilter = document.getElementById('appt-date-filter')?.value || 'today';
    const deptFilter = document.getElementById('appt-dept-filter')?.value || 'all';
    const statusFilter = document.getElementById('appt-status-filter')?.value || 'all';
    const searchQuery = (document.getElementById('appt-search-input')?.value || '').trim().toLowerCase();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

    const tom = new Date(now);
    tom.setDate(now.getDate() + 1);
    const tomStr = `${tom.getFullYear()}-${pad(tom.getMonth()+1)}-${pad(tom.getDate())}`;

    // Calculate Week range (next 7 days)
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);
    const weekAheadStr = `${weekAhead.getFullYear()}-${pad(weekAhead.getMonth()+1)}-${pad(weekAhead.getDate())}`;

    let filtered = state.appointments.filter(appt => {
        // Date filter
        if (dateFilter === 'today' && appt.date !== todayStr) return false;
        if (dateFilter === 'tomorrow' && appt.date !== tomStr) return false;
        if (dateFilter === 'week' && (appt.date < todayStr || appt.date > weekAheadStr)) return false;

        // Department filter
        if (deptFilter !== 'all' && appt.department !== deptFilter) return false;

        // Status filter
        if (statusFilter !== 'all' && appt.status !== statusFilter) return false;

        // Search query
        if (searchQuery) {
            const matchName = (appt.name || '').toLowerCase().includes(searchQuery);
            const matchHn = (appt.hn || '').toLowerCase().includes(searchQuery);
            const matchPhone = (appt.phone || '').toLowerCase().includes(searchQuery);
            const matchId = (appt.id || '').toLowerCase().includes(searchQuery);
            const matchDoctor = (appt.doctor || '').toLowerCase().includes(searchQuery);
            if (!matchName && !matchHn && !matchPhone && !matchId && !matchDoctor) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 42px 20px; color: var(--text-muted);">
                    <div style="font-size: 1.8rem; margin-bottom: 8px;">📅</div>
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">ไม่พบรายการนัดหมายตามเงื่อนไขที่เลือก</div>
                    <div style="font-size: 0.82rem;">ลองปรับตัวกรอง หรือคลิก "+ สร้างนัดหมายใหม่" เพื่อเพิ่มนัดหมาย</div>
                </td>
            </tr>
        `;
        return;
    }

    // Helper: format Thai date
    const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const formatThaiDate = (dateStr) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = (parseInt(parts[0], 10) + 543) % 100;
        return `${d} ${thaiMonthsShort[m]} ${y}`;
    };

    tbody.innerHTML = filtered.map(appt => {
        // Status Badge
        let statusBadgeHtml = '';
        if (appt.checkedIn) {
            statusBadgeHtml = `<span class="appt-status-pill checked-in">🟣 เช็คอินเข้าระบบแล้ว</span>`;
        } else if (appt.status === 'confirmed') {
            statusBadgeHtml = `<span class="appt-status-pill confirmed">🟢 ยืนยันนัด</span>`;
        } else if (appt.status === 'rescheduled') {
            statusBadgeHtml = `
                <div>
                    <span class="appt-status-pill rescheduled">🟡 เลื่อนนัดแล้ว</span>
                    <div class="appt-sub-note">นัดเดิม: ${formatThaiDate(appt.oldDate)} ${appt.oldTime || ''} น.</div>
                    ${appt.rescheduleReason ? `<div class="appt-sub-note" style="color:var(--text-secondary)">เหตุผล: ${appt.rescheduleReason}</div>` : ''}
                </div>
            `;
        } else if (appt.status === 'cancelled') {
            statusBadgeHtml = `
                <div>
                    <span class="appt-status-pill cancelled">🔴 ยกเลิกนัด</span>
                    ${appt.cancelReason ? `<div class="appt-cancel-note">เหตุผล: ${appt.cancelReason}</div>` : ''}
                </div>
            `;
        }

        // Action Buttons
        let actionButtonsHtml = '';
        if (appt.checkedIn) {
            actionButtonsHtml = `
                <div class="appt-action-buttons">
                    <span style="font-size:0.78rem; font-weight:600; color:#4338CA; background:#EEF2FF; padding:4px 10px; border-radius:var(--radius-sm); border:1px solid #C7D2FE;">
                        ✓ รอพบแพทย์
                    </span>
                </div>
            `;
        } else if (appt.status === 'cancelled') {
            actionButtonsHtml = `
                <div class="appt-action-buttons">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">ยกเลิกแล้ว</span>
                </div>
            `;
        } else {
            actionButtonsHtml = `
                <div class="appt-action-buttons">
                    <button type="button" class="btn-appt-checkin" onclick="checkinApptToQueue('${appt.id}')" title="ออกบัตรคิวและส่งเข้าห้องตรวจทันที">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        รับคิว
                    </button>
                    <button type="button" class="btn-appt-reschedule" onclick="openRescheduleApptModal('${appt.id}')" title="เลื่อนวัน/เวลานัดหมาย">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 14 14"/>
                        </svg>
                        เลื่อนนัด
                    </button>
                    <button type="button" class="btn-appt-cancel" onclick="openCancelApptModal('${appt.id}')" title="ยกเลิกนัดหมายนี้">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        ยกเลิก
                    </button>
                </div>
            `;
        }

        return `
            <tr>
                <td>
                    <div class="appt-time-badge">
                        <span class="appt-time-date">${formatThaiDate(appt.date)}</span>
                        <span class="appt-time-hour">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/>
                            </svg>
                            ${appt.time} น.
                        </span>
                    </div>
                </td>
                <td>
                    <div class="appt-code-badge">${appt.id}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${appt.hn}</div>
                </td>
                <td>
                    <div class="appt-patient-cell">
                        <span class="appt-patient-name">${appt.name}</span>
                        <span class="appt-patient-phone">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            ${appt.phone}
                        </span>
                    </div>
                </td>
                <td>
                    <div class="appt-doc-cell">
                        <div>${getDeptBadge(appt.department)}</div>
                        <span class="appt-doctor-name">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${appt.doctor || 'แพทย์เวรประจำแผนก'}
                        </span>
                    </div>
                </td>
                <td>
                    <div class="appt-reason-cell" title="${appt.reason || '-'}">${appt.reason || '-'}</div>
                </td>
                <td>${statusBadgeHtml}</td>
                <td>${actionButtonsHtml}</td>
            </tr>
        `;
    }).join('');
}

// ============ MODALS: CREATE APPOINTMENT ============

function updateDoctorOptionsForDept() {
    const deptSelect = document.getElementById('appt-department');
    const doctorSelect = document.getElementById('appt-doctor');
    if (!deptSelect || !doctorSelect) return;

    const dept = deptSelect.value;
    const docs = DEPARTMENT_DOCTORS[dept] || ['แพทย์เวรประจำแผนก'];

    doctorSelect.innerHTML = docs.map(d => `<option value="${d}">${d}</option>`).join('');
}

function autoGenerateHN() {
    const rand = Math.floor(100000 + Math.random() * 900000);
    const hnInput = document.getElementById('appt-hn');
    if (hnInput) {
        hnInput.value = `HN 67-${rand}`;
    }
}

function openCreateApptModal() {
    const modal = document.getElementById('modal-create-appt');
    if (!modal) return;

    // Set default date to today
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

    const dateInput = document.getElementById('appt-date');
    if (dateInput) {
        dateInput.value = todayStr;
        dateInput.min = todayStr;
    }

    // Auto generate HN if empty
    const hnInput = document.getElementById('appt-hn');
    if (hnInput && !hnInput.value) {
        autoGenerateHN();
    }

    updateDoctorOptionsForDept();
    modal.style.display = 'flex';
}

function closeCreateApptModal() {
    const modal = document.getElementById('modal-create-appt');
    if (modal) modal.style.display = 'none';
}

function submitCreateAppt(e) {
    if (e) e.preventDefault();

    const hn = document.getElementById('appt-hn')?.value.trim();
    const phone = document.getElementById('appt-phone')?.value.trim();
    const name = document.getElementById('appt-patient-name')?.value.trim();
    const department = document.getElementById('appt-department')?.value;
    const doctor = document.getElementById('appt-doctor')?.value;
    const date = document.getElementById('appt-date')?.value;
    const time = document.getElementById('appt-time')?.value;
    const reason = document.getElementById('appt-reason')?.value.trim();

    if (!hn || !phone || !name || !date || !time) {
        showToast('กรุณากรอกข้อมูลนัดหมายให้ครบถ้วน', 'warning');
        return;
    }

    const nextIdNum = 6700 + (state.appointments.length + 1);
    const newAppt = {
        id: `APT-${nextIdNum}`,
        hn,
        name,
        phone,
        department,
        doctor,
        date,
        time,
        reason: reason || 'ตรวจติดตามอาการตามนัด',
        status: 'confirmed',
        checkedIn: false,
        createdAt: new Date().toISOString(),
    };

    state.appointments.unshift(newAppt);
    saveAppointments();
    closeCreateApptModal();
    renderAppointments();

    showToast(`✅ สร้างนัดหมายใหม่สำเร็จ: ${newAppt.id} (${name})`, 'success');

    // Reset form fields
    document.getElementById('form-create-appt')?.reset();
}

// ============ MODALS: RESCHEDULE APPOINTMENT ============

function openRescheduleApptModal(id) {
    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    document.getElementById('reschedule-appt-id').value = appt.id;
    document.getElementById('reschedule-patient-name').textContent = appt.name;
    document.getElementById('reschedule-hn').textContent = appt.hn;
    document.getElementById('reschedule-dept').textContent = appt.department;
    document.getElementById('reschedule-old-datetime').textContent = `${appt.date} เวลา ${appt.time} น.`;

    // Min date is today
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

    const dateInput = document.getElementById('reschedule-new-date');
    if (dateInput) {
        dateInput.value = appt.date;
        dateInput.min = todayStr;
    }

    const timeInput = document.getElementById('reschedule-new-time');
    if (timeInput) timeInput.value = appt.time;

    const modal = document.getElementById('modal-reschedule-appt');
    if (modal) modal.style.display = 'flex';
}

function closeRescheduleApptModal() {
    const modal = document.getElementById('modal-reschedule-appt');
    if (modal) modal.style.display = 'none';
}

function toggleCustomRescheduleReason() {
    const select = document.getElementById('reschedule-reason-select');
    const custom = document.getElementById('reschedule-reason-custom');
    if (select && custom) {
        custom.style.display = select.value === 'custom' ? 'block' : 'none';
    }
}

function submitRescheduleAppt(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('reschedule-appt-id')?.value;
    const newDate = document.getElementById('reschedule-new-date')?.value;
    const newTime = document.getElementById('reschedule-new-time')?.value;

    const selectReason = document.getElementById('reschedule-reason-select')?.value;
    const customReason = document.getElementById('reschedule-reason-custom')?.value.trim();
    const reason = selectReason === 'custom' ? (customReason || 'ผู้ป่วยขอเปลี่ยนวันนัด') : selectReason;

    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    appt.oldDate = appt.date;
    appt.oldTime = appt.time;
    appt.date = newDate;
    appt.time = newTime;
    appt.status = 'rescheduled';
    appt.rescheduleReason = reason;

    saveAppointments();
    closeRescheduleApptModal();
    renderAppointments();

    showToast(`🗓️ เลื่อนนัดหมาย ${appt.name} เป็นวันที่ ${newDate} เวลา ${newTime} น. สำเร็จ`, 'info');
}

// ============ MODALS: CANCEL APPOINTMENT ============

function openCancelApptModal(id) {
    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    document.getElementById('cancel-appt-id').value = appt.id;
    document.getElementById('cancel-patient-name').textContent = appt.name;
    document.getElementById('cancel-hn').textContent = appt.hn;
    document.getElementById('cancel-dept').textContent = appt.department;
    document.getElementById('cancel-datetime').textContent = `${appt.date} เวลา ${appt.time} น.`;

    const modal = document.getElementById('modal-cancel-appt');
    if (modal) modal.style.display = 'flex';
}

function closeCancelApptModal() {
    const modal = document.getElementById('modal-cancel-appt');
    if (modal) modal.style.display = 'none';
}

function toggleCustomCancelReason() {
    const select = document.getElementById('cancel-reason-select');
    const custom = document.getElementById('cancel-reason-custom');
    if (select && custom) {
        custom.style.display = select.value === 'custom' ? 'block' : 'none';
    }
}

function submitCancelAppt(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('cancel-appt-id')?.value;
    const selectReason = document.getElementById('cancel-reason-select')?.value;
    const customReason = document.getElementById('cancel-reason-custom')?.value.trim();
    const reason = selectReason === 'custom' ? (customReason || 'ผู้ป่วยขอยกเลิกนัด') : selectReason;

    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    appt.status = 'cancelled';
    appt.cancelReason = reason;

    saveAppointments();
    closeCancelApptModal();
    renderAppointments();

    showToast(`❌ ยกเลิกนัดหมายของ ${appt.name} เรียบร้อยแล้ว`, 'warning');
}

// ============ CHECK-IN APPOINTMENT TO ACTIVE QUEUE ============

function checkinApptToQueue(id) {
    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    if (appt.checkedIn) {
        showToast('นัดหมายนี้ทำการเช็คอินเข้าระบบคิวแล้ว', 'info');
        return;
    }

    // Generate Dept prefix for queue
    const deptPrefixMap = {
        'ทันตกรรม': 'S',
        'อายุรกรรม': 'M',
        'ศัลยกรรม': 'SR',
        'กุมารเวชกรรม': 'P',
        'จักษุวิทยา': 'E',
        'กระดูกและข้อ': 'O',
    };
    const prefix = deptPrefixMap[appt.department] || 'A';
    const randNum = Math.floor(10 + Math.random() * 89);
    const queueNumber = `${prefix}-0${randNum}`;

    const newQueueItem = {
        id: `q_appt_${Date.now()}`,
        queueNumber,
        type: 'appointment',
        appointmentTime: appt.time,
        patientName: appt.name,
        hn: appt.hn,
        department: appt.department,
        doctor: appt.doctor,
        enteredAt: new Date(),
        isLate: false,
        lateMessage: '',
        apptId: appt.id
    };

    state.waitingQueue.unshift(newQueueItem);
    appt.checkedIn = true;

    saveAppointments();
    saveState();

    // Re-render and announce
    renderAll();
    soundManager.playChime(false);

    showToast(`🎟️ เช็คอินสำเร็จ! ออกบัตรคิว ${queueNumber} ให้ ${appt.name} เรียบร้อยแล้ว`, 'success');
}

function handleApptModalBackdrop(event, modalId) {
    if (event.target.id === modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }
}

// ============ FILTERS ============
function setFilter(filter) {
    state.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(el => el.classList.remove('active'));
    document.querySelector(`.filter-btn[data-filter="${filter}"]`).classList.add('active');
    renderWaitingQueue();
}

function setDepartmentFilter(dept) {
    state.currentDepartment = dept;
    document.querySelectorAll('.dept-pill').forEach(pill => {
        if (pill.getAttribute('data-dept') === dept) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    renderWaitingQueue();
    renderLabQueue();
    renderRooms();
    updateStats();
}

// ============ HISTORY ============
function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    const deptFilter = document.getElementById('history-dept-filter')?.value || 'all';
    let records = state.historyRecords;

    if (deptFilter !== 'all') {
        records = records.filter(r => r.dept === deptFilter);
    }

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--text-muted)">
            ไม่มีประวัติในเงื่อนไขที่เลือก
        </td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(rec => {
        const typeLabel = rec.type === 'appointment'
            ? '<span class="tag tag-appointment">นัดหมาย</span>'
            : '<span class="tag tag-walkin">Walk-in</span>';

        let statusLabel = '';
        if (rec.status === 'examining') statusLabel = '<span class="status-badge examining">กำลังตรวจ</span>';
        else if (rec.status === 'done') statusLabel = '<span class="status-badge done">สิ้นสุดการตรวจ</span>';
        else if (rec.status === 'overdue') statusLabel = '<span class="status-badge overdue">เกินกำหนด</span>';
        else if (rec.status === 'in-queue') statusLabel = '<span class="status-badge in-queue">รอเรียกคิว</span>';

        return `<tr>
            <td>${rec.time}</td>
            <td>${rec.queue}</td>
            <td>
                <div>${rec.name}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">HN : ${rec.hn}<br>AN : ${rec.an || '-'}</div>
            </td>
            <td>${typeLabel}</td>
            <td>${rec.aptTime}</td>
            <td>${getDeptBadge(rec.dept)}</td>
            <td>${statusLabel}</td>
        </tr>`;
    }).join('');

    const doneCount = state.historyRecords.filter(r => r.status === 'done').length;
    const overdueCount = state.historyRecords.filter(r => r.status === 'overdue').length;

    const doneEl = document.getElementById('history-done-count');
    if (doneEl) doneEl.textContent = doneCount;
    const overdueEl = document.getElementById('history-overdue-count');
    if (overdueEl) overdueEl.textContent = overdueCount;
}

// ============ DATETIME ============
function updateDateTime() {
    const now = new Date();
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const buddhistYear = now.getFullYear() + 543;
    const dayName = thaiDays[now.getDay()];
    const date = now.getDate();
    const month = thaiMonths[now.getMonth()];

    document.getElementById('date-text').textContent = `วัน${dayName}ที่ ${date} ${month} ${buddhistYear}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time-text').textContent = `${hours}:${minutes}`;
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateWaitTimes() {
    renderWaitingQueue();
    renderLabQueue();
    renderRooms();
}

// ============ EVENT LISTENERS ============
function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            switchPage(page, item);
        });
    });

    // Sidebar Collapse / Expand Toggle
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebarCollapse();
        });
    }

    // Column Filters (Appointment / Walkin)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.getAttribute('data-filter'));
        });
    });

    // Department Pills
    document.querySelectorAll('.dept-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            setDepartmentFilter(pill.getAttribute('data-dept'));
        });
    });

    // Quick Search Input
    const searchInput = document.getElementById('quick-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            renderWaitingQueue();
            renderLabQueue();
            renderRooms();
        });
    }

    // History department filter
    const histDeptSelect = document.getElementById('history-dept-filter');
    if (histDeptSelect) {
        histDeptSelect.addEventListener('change', () => {
            renderHistory();
        });
    }

    // Generate new patient queue
    const genQueueBtn = document.getElementById('btn-generate-queue');
    if (genQueueBtn) {
        genQueueBtn.addEventListener('click', generateNewPatientQueue);
    }

    // Simulate late arrival
    const simLateBtn = document.getElementById('btn-simulate-late');
    if (simLateBtn) {
        simLateBtn.addEventListener('click', simulateLateArrival);
    }

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('room-modal').style.display = 'none';
    });
    document.getElementById('btn-confirm-room').addEventListener('click', confirmRoomSelection);

    // Close modal on overlay click
    document.getElementById('room-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('room-modal')) {
            document.getElementById('room-modal').style.display = 'none';
        }
    });

    // Appointments Search Input
    const apptSearchInput = document.getElementById('appt-search-input');
    if (apptSearchInput) {
        apptSearchInput.addEventListener('input', () => {
            renderAppointments();
        });
    }

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('room-modal').style.display = 'none';
            closeUrgentModal();
            closeCreateApptModal();
            closeRescheduleApptModal();
            closeCancelApptModal();
            closeAvatarSelectorModal();
        }
    });

    // History filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // Sidebar User Profile click -> switch to profile page
    const sidebarProfile = document.getElementById('sidebar-user-profile');
    if (sidebarProfile) {
        sidebarProfile.style.cursor = 'pointer';
        sidebarProfile.addEventListener('click', () => {
            switchPage('profile');
        });
    }
}

// ============ USER PROFILE MANAGEMENT ============
const DEFAULT_USER_PROFILE = {
    prefix: 'นาย',
    firstName: 'ธนกฤต',
    lastName: 'พิพัฒน์ชัย',
    nickname: 'กฤต',
    staffId: 'ST-4029',
    role: 'เจ้าหน้าที่ฝ่ายตรวจสอบและคัดกรองคิว',
    department: 'ฝ่ายเวชระเบียนและจัดการคิวผู้ป่วย',
    station: 'เคาน์เตอร์คัดกรองจุดที่ 1',
    email: 'thanakrit.p@hospital.mail',
    phoneExt: 'Ext. 2104',
    mobile: '089-123-4567',
    emergencyContact: 'คุณสมใจ พิพัฒน์ชัย (มารดา) - 081-987-6543',
    shift: 'กะเช้า (08:00 - 16:30 น.)',
    status: 'กำลังปฏิบัติหน้าที่',
    bio: 'ดูแลระบบจัดการคิว คัดกรองผู้ป่วยกลุ่มนัดหมายและ Walk-in ประจำจุดคัดกรองกลาง ประสานงานแพทย์และพยาบาลทุกห้องตรวจ พร้อมควบคุมการเรียกคิวผ่านระบบเสียงและหน้าจอแสดงผลดิจิทัล',
    avatarType: 'emoji', // 'image' | 'emoji'
    avatarImage: '',     // Base64 data URL
    avatarEmoji: '👨‍💼',
    avatarBg: '#006D6F',
    startDate: '15 มกราคม 2565'
};

function getUserProfile() {
    try {
        const saved = localStorage.getItem('hospitalUserProfile');
        if (saved) {
            return { ...DEFAULT_USER_PROFILE, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Error reading user profile from localStorage:', e);
    }
    return { ...DEFAULT_USER_PROFILE };
}

function saveUserProfile(profileData) {
    try {
        localStorage.setItem('hospitalUserProfile', JSON.stringify(profileData));
        updateSidebarUserProfileDisplay(profileData);
        renderUserProfilePage(profileData);
    } catch (e) {
        console.error('Error saving user profile to localStorage:', e);
        showProfileToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
}

function updateSidebarUserProfileDisplay(profile = getUserProfile()) {
    const sidebarProfile = document.getElementById('sidebar-user-profile');
    if (!sidebarProfile) return;

    const nameEl = sidebarProfile.querySelector('.user-profile-name');
    if (nameEl) {
        nameEl.textContent = `${profile.firstName} ${profile.lastName}`;
    }

    const roleEl = sidebarProfile.querySelector('.user-profile-email');
    if (roleEl) {
        roleEl.textContent = profile.role;
    }

    sidebarProfile.setAttribute('data-tooltip', `${profile.prefix} ${profile.firstName} ${profile.lastName} (${profile.role})`);
    sidebarProfile.setAttribute('title', 'คลิกเพื่อดูและแก้ไขโปรไฟล์');

    const avatarWrap = sidebarProfile.querySelector('.user-avatar-wrap');
    if (avatarWrap) {
        avatarWrap.style.background = profile.avatarBg || '#006D6F';
        avatarWrap.style.borderRadius = '50%';
        avatarWrap.style.display = 'flex';
        avatarWrap.style.alignItems = 'center';
        avatarWrap.style.justifyContent = 'center';
        avatarWrap.style.width = '36px';
        avatarWrap.style.height = '36px';
        avatarWrap.style.flexShrink = '0';
        avatarWrap.style.overflow = 'hidden';

        if (profile.avatarType === 'image' && profile.avatarImage) {
            avatarWrap.innerHTML = `<img src="${profile.avatarImage}" alt="${profile.firstName}" class="sidebar-avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        } else {
            avatarWrap.innerHTML = `<span style="font-size:1.15rem;line-height:1;">${profile.avatarEmoji || '👨‍💼'}</span>`;
        }
    }
}

function renderUserProfilePage(profile = getUserProfile()) {
    // 1. Hero Card
    const heroName = document.getElementById('hero-profile-name');
    if (heroName) heroName.textContent = `${profile.prefix} ${profile.firstName} ${profile.lastName}`;

    const heroStaffId = document.getElementById('hero-profile-staff-id');
    if (heroStaffId) heroStaffId.textContent = `ID: ${profile.staffId}`;

    const heroRole = document.getElementById('hero-profile-role');
    if (heroRole) {
        heroRole.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${profile.role}
        `;
    }

    const heroDept = document.getElementById('hero-profile-dept');
    if (heroDept) {
        heroDept.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            ${profile.department}
        `;
    }

    const heroShift = document.getElementById('hero-profile-shift');
    if (heroShift) {
        heroShift.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${profile.shift}
        `;
    }

    const heroAvatar = document.getElementById('profile-main-avatar');
    if (heroAvatar) {
        heroAvatar.style.background = profile.avatarBg || '#006D6F';

        const overlayHtml = `
            <div class="avatar-edit-overlay" title="คลิกเพื่อเปลี่ยนรูปภาพโปรไฟล์">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                </svg>
            </div>
        `;

        if (profile.avatarType === 'image' && profile.avatarImage) {
            heroAvatar.innerHTML = `
                <img src="${profile.avatarImage}" alt="${profile.firstName}" class="avatar-img-display" id="avatar-img-display" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">
                ${overlayHtml}
            `;
        } else {
            heroAvatar.innerHTML = `
                <span class="avatar-emoji-display" id="avatar-emoji-display">${profile.avatarEmoji || '👨‍💼'}</span>
                ${overlayHtml}
            `;
        }
    }

    // 2. View Tab 1: Personal
    const viewPrefix = document.getElementById('view-prefix');
    if (viewPrefix) viewPrefix.textContent = profile.prefix;

    const viewFullname = document.getElementById('view-fullname');
    if (viewFullname) viewFullname.textContent = `${profile.firstName} ${profile.lastName}`;

    const viewNickname = document.getElementById('view-nickname');
    if (viewNickname) viewNickname.textContent = profile.nickname || '-';

    const viewStaffId = document.getElementById('view-staff-id');
    if (viewStaffId) viewStaffId.textContent = profile.staffId;

    const viewStartDate = document.getElementById('view-start-date');
    if (viewStartDate) viewStartDate.textContent = profile.startDate || '15 มกราคม 2565';

    const viewRole = document.getElementById('view-role');
    if (viewRole) viewRole.textContent = profile.role;

    const viewDept = document.getElementById('view-department');
    if (viewDept) viewDept.textContent = profile.department;

    const viewStation = document.getElementById('view-station');
    if (viewStation) viewStation.textContent = profile.station;

    const viewShift = document.getElementById('view-shift');
    if (viewShift) viewShift.textContent = profile.shift;

    const viewStatus = document.getElementById('view-status');
    if (viewStatus) viewStatus.textContent = profile.status || 'กำลังปฏิบัติหน้าที่';

    const viewBio = document.getElementById('view-bio');
    if (viewBio) viewBio.textContent = profile.bio;

    // 3. View Tab 2: Contact
    const viewEmail = document.getElementById('view-email');
    if (viewEmail) {
        viewEmail.innerHTML = `<a href="mailto:${profile.email}" class="link-contact">${profile.email}</a>`;
    }

    const viewPhoneExt = document.getElementById('view-phone-ext');
    if (viewPhoneExt) viewPhoneExt.textContent = profile.phoneExt;

    const viewMobile = document.getElementById('view-mobile');
    if (viewMobile) viewMobile.textContent = profile.mobile;

    const viewEmergency = document.getElementById('view-emergency');
    if (viewEmergency) viewEmergency.textContent = profile.emergencyContact;

    const viewShiftDetail = document.getElementById('view-shift-detail');
    if (viewShiftDetail) viewShiftDetail.textContent = profile.shift;

    // 4. Quick KPI chips
    const kpiServed = document.getElementById('kpi-served-today');
    if (kpiServed) kpiServed.textContent = `${state.completedToday || 28} คิว`;

    const kpiStation = document.getElementById('kpi-station');
    if (kpiStation) kpiStation.textContent = profile.station || 'เคาน์เตอร์คัดกรอง 1';

    // 5. Populate form inputs
    populateProfileFormInputs(profile);
}

function populateProfileFormInputs(profile = getUserProfile()) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined ? val : '';
    };

    setVal('input-prefix', profile.prefix);
    setVal('input-firstname', profile.firstName);
    setVal('input-lastname', profile.lastName);
    setVal('input-nickname', profile.nickname);
    setVal('input-staff-id', profile.staffId);
    setVal('input-role', profile.role);
    setVal('input-department', profile.department);
    setVal('input-station', profile.station);
    setVal('input-bio', profile.bio);
    setVal('input-email', profile.email);
    setVal('input-phone-ext', profile.phoneExt);
    setVal('input-mobile', profile.mobile);
    setVal('input-shift', profile.shift);
    setVal('input-emergency', profile.emergencyContact);
}

function setProfileMode(mode) {
    const isEdit = mode === 'edit';

    const btnView = document.getElementById('btn-mode-view');
    const btnEdit = document.getElementById('btn-mode-edit');
    if (btnView) btnView.classList.toggle('active', !isEdit);
    if (btnEdit) btnEdit.classList.toggle('active', isEdit);

    const viewPersonal = document.getElementById('view-mode-personal');
    const editPersonal = document.getElementById('edit-mode-personal');
    const viewContact = document.getElementById('view-mode-contact');
    const editContact = document.getElementById('edit-mode-contact');
    const editActions = document.getElementById('profile-edit-actions');

    if (viewPersonal) viewPersonal.style.display = isEdit ? 'none' : 'block';
    if (editPersonal) editPersonal.style.display = isEdit ? 'block' : 'none';
    if (viewContact) viewContact.style.display = isEdit ? 'none' : 'block';
    if (editContact) editContact.style.display = isEdit ? 'block' : 'none';
    if (editActions) editActions.style.display = isEdit ? 'flex' : 'none';

    if (isEdit) {
        populateProfileFormInputs();
    }
}

function switchProfileTab(tabId) {
    document.querySelectorAll('.profile-nav-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.profile-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === tabId);
    });
}

function submitSaveUserProfile() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const firstName = getVal('input-firstname');
    const lastName = getVal('input-lastname');
    if (!firstName || !lastName) {
        showProfileToast('กรุณาระบุชื่อและนามสกุล', 'info');
        return;
    }

    const current = getUserProfile();
    const updated = {
        ...current,
        prefix: getVal('input-prefix') || current.prefix,
        firstName: firstName,
        lastName: lastName,
        nickname: getVal('input-nickname'),
        staffId: getVal('input-staff-id') || current.staffId,
        role: getVal('input-role') || current.role,
        department: getVal('input-department') || current.department,
        station: getVal('input-station') || current.station,
        bio: getVal('input-bio') || current.bio,
        email: getVal('input-email') || current.email,
        phoneExt: getVal('input-phone-ext') || current.phoneExt,
        mobile: getVal('input-mobile') || current.mobile,
        shift: getVal('input-shift') || current.shift,
        emergencyContact: getVal('input-emergency') || current.emergencyContact,
    };

    saveUserProfile(updated);
    showProfileToast('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!', 'success');
    setProfileMode('view');
}

function resetUserProfileForm() {
    populateProfileFormInputs();
    showProfileToast('คืนค่าข้อมูลเดิมเรียบร้อยแล้ว', 'info');
}

function copyProfileContactInfo() {
    const p = getUserProfile();
    const text = `[ข้อมูลบุคลากรการแพทย์]\nชื่อ: ${p.prefix} ${p.firstName} ${p.lastName}${p.nickname ? ' (' + p.nickname + ')' : ''}\nรหัสพนักงาน: ${p.staffId}\nตำแหน่ง: ${p.role}\nแผนก: ${p.department}\nสถานีประจำการ: ${p.station}\nอีเมล: ${p.email}\nเบอร์ภายใน: ${p.phoneExt}\nมือถือ: ${p.mobile}\nกะการทำงาน: ${p.shift}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showProfileToast('คัดลอกข้อมูลนามบัตรแล้ว!', 'success');
        }).catch(() => {
            showProfileToast('คัดลอกข้อมูลแล้ว', 'info');
        });
    } else {
        showProfileToast('คัดลอกข้อมูลแล้ว', 'info');
    }
}

// ============ AVATAR MODAL & UPLOAD LOGIC ============
function openAvatarSelectorModal(tab = 'upload') {
    const modal = document.getElementById('avatar-modal');
    if (modal) {
        modal.style.display = 'flex';
        switchAvatarModalTab(tab);
        updateModalAvatarPreview();
    }
}

function closeAvatarSelectorModal() {
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.style.display = 'none';
}

function handleAvatarModalBackdrop(event) {
    if (event.target === document.getElementById('avatar-modal')) {
        closeAvatarSelectorModal();
    }
}

function switchAvatarModalTab(tab) {
    const isUpload = tab === 'upload';
    const btnUpload = document.getElementById('tab-btn-avatar-upload');
    const btnPreset = document.getElementById('tab-btn-avatar-preset');
    const paneUpload = document.getElementById('avatar-pane-upload');
    const panePreset = document.getElementById('avatar-pane-preset');

    if (btnUpload) btnUpload.classList.toggle('active', isUpload);
    if (btnPreset) btnPreset.classList.toggle('active', !isUpload);
    if (paneUpload) paneUpload.style.display = isUpload ? 'block' : 'none';
    if (panePreset) panePreset.style.display = !isUpload ? 'block' : 'none';
}

function updateModalAvatarPreview(profile = getUserProfile()) {
    const previewCircle = document.getElementById('avatar-modal-preview');
    const previewEmoji = document.getElementById('avatar-preview-emoji');
    const previewImg = document.getElementById('avatar-preview-img');
    const previewStatus = document.getElementById('avatar-preview-status');
    const btnRemove = document.getElementById('btn-remove-avatar-photo');

    if (previewCircle) {
        previewCircle.style.background = profile.avatarBg || '#006D6F';
    }

    if (profile.avatarType === 'image' && profile.avatarImage) {
        if (previewImg) {
            previewImg.src = profile.avatarImage;
            previewImg.style.display = 'block';
        }
        if (previewEmoji) previewEmoji.style.display = 'none';
        if (previewStatus) previewStatus.textContent = 'ใช้รูปถ่ายส่วนตัว (Custom Photo)';
        if (btnRemove) btnRemove.style.display = 'inline-flex';
    } else {
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (previewEmoji) {
            previewEmoji.textContent = profile.avatarEmoji || '👨‍💼';
            previewEmoji.style.display = 'block';
        }
        if (previewStatus) previewStatus.textContent = 'ใช้ไอคอนอิโมจิ';
        if (btnRemove) btnRemove.style.display = 'none';
    }

    // Update color dots active state
    document.querySelectorAll('#color-palette-options .color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.style.background === (profile.avatarBg || '#006D6F'));
    });
}

function triggerAvatarFileInput() {
    const input = document.getElementById('avatar-file-input');
    if (input) {
        input.value = ''; // Reset to allow re-selection
        input.click();
    }
}

function handleAvatarFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
        processAndSaveAvatarFile(file);
    }
}

function handleAvatarDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('avatar-dropzone');
    if (dropzone) dropzone.classList.add('drag-over');
}

function handleAvatarDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('avatar-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
}

function handleAvatarDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('avatar-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');

    const dt = event.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
        processAndSaveAvatarFile(dt.files[0]);
    }
}

function processAndSaveAvatarFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showProfileToast('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)', 'error');
        return;
    }

    // Check size limit (< 12MB)
    if (file.size > 12 * 1024 * 1024) {
        showProfileToast('ไฟล์รูปภาพมีขนาดใหญ่เกินไป (ไม่เกิน 12MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                // Compress & square-crop image via canvas for crisp avatar quality
                const maxDim = 400;
                const width = img.width;
                const height = img.height;

                // Center crop square
                const minDim = Math.min(width, height);
                const startX = (width - minDim) / 2;
                const startY = (height - minDim) / 2;

                const canvas = document.createElement('canvas');
                const targetDim = Math.min(minDim, maxDim);
                canvas.width = targetDim;
                canvas.height = targetDim;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetDim, targetDim);

                // Export optimized data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

                const profile = getUserProfile();
                profile.avatarType = 'image';
                profile.avatarImage = dataUrl;
                saveUserProfile(profile);
                updateModalAvatarPreview(profile);
                showProfileToast('อัปโหลดรูปภาพโปรไฟล์เรียบร้อยแล้ว!', 'success');
            } catch (err) {
                console.error('Error processing avatar image:', err);
                showProfileToast('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', 'error');
            }
        };
        img.onerror = function() {
            showProfileToast('ไม่สามารถอ่านไฟล์รูปภาพได้', 'error');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        showProfileToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
    };
    reader.readAsDataURL(file);
}

function removeCustomAvatarImage() {
    const profile = getUserProfile();
    profile.avatarType = 'emoji';
    profile.avatarImage = '';
    saveUserProfile(profile);
    updateModalAvatarPreview(profile);
    showProfileToast('เปลี่ยนกลับมาใช้ไอคอนเรียบร้อยแล้ว', 'info');
}

function chooseAvatarPreset(emoji) {
    const current = getUserProfile();
    current.avatarType = 'emoji';
    current.avatarEmoji = emoji;
    saveUserProfile(current);
    updateModalAvatarPreview(current);
    showProfileToast(`เปลี่ยนไอคอนเป็น ${emoji} เรียบร้อยแล้ว`, 'success');
}

function chooseAvatarBg(color) {
    const current = getUserProfile();
    current.avatarBg = color;
    saveUserProfile(current);
    updateModalAvatarPreview(current);
}

function showProfileToast(message, type = 'success') {
    const container = document.getElementById('profile-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `profile-toast ${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span style="font-weight:700;margin-right:4px;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
}

function initUserProfile() {
    const profile = getUserProfile();
    updateSidebarUserProfileDisplay(profile);
    renderUserProfilePage(profile);
}

// ============ SYSTEM SETTINGS MANAGEMENT ============
const DEFAULT_SYSTEM_SETTINGS = {
    // 1. Sound & Voice
    soundEnabled: true,
    soundVolume: 85,
    speechRate: 1.0,
    chimeType: 'hospital',
    voiceAnnounceName: true,
    repeatCount: 1,

    // 2. Queue Rules & Timing
    lateThresholdMins: 30,
    avgServiceTimeMins: 15,
    allowUrgentQueue: true,
    smartRoomMatch: true,

    // 3. Hospital & Station
    hospitalName: 'โรงพยาบาลกรุงเทพเมดิคอล เซ็นเตอร์',
    hospitalBranch: 'สาขาหลัก (อาคารผู้ป่วยนอก OPD)',
    stationName: 'จุดคัดกรองและจัดการคิวกลาง (Counter 1)',
    hospitalPhone: '02-123-4567 ต่อ 101',

    // 4. Display & Kiosk
    showCompletedHistory: true,
    kioskRefreshIntervalSec: 30,
    kioskAnnouncementBanner: 'กรุณารอเรียกหมายเลขคิวของท่าน และตรวจสอบห้องตรวจที่ระบุบนหน้าจอ'
};

function getSystemSettings() {
    try {
        const saved = localStorage.getItem('hospitalSystemSettings');
        if (saved) {
            return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Error reading system settings:', e);
    }
    return { ...DEFAULT_SYSTEM_SETTINGS };
}

function saveSystemSettings(settings, notify = true) {
    try {
        localStorage.setItem('hospitalSystemSettings', JSON.stringify(settings));
        
        // Apply settings to soundManager
        if (typeof soundManager !== 'undefined' && soundManager) {
            soundManager.enabled = settings.soundEnabled;
            soundManager.volume = (settings.soundVolume || 85) / 100;
            soundManager.speechRate = parseFloat(settings.speechRate) || 1.0;
            soundManager.chimeType = settings.chimeType || 'hospital';
            soundManager.announceName = settings.voiceAnnounceName;
            soundManager.repeatCount = parseInt(settings.repeatCount, 10) || 1;
            soundManager.updateUI();
        }

        if (notify) {
            showProfileToast('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!', 'success');
        }
    } catch (e) {
        console.error('Error saving system settings:', e);
        if (notify) {
            showProfileToast('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error');
        }
    }
}

function updateSettingVolumeText(val) {
    const el = document.getElementById('setting-vol-text');
    if (el) el.textContent = `${val}%`;
}

function renderSettingsPage() {
    const settings = getSystemSettings();

    // 1. Sound
    const soundToggle = document.getElementById('setting-sound-enabled');
    if (soundToggle) soundToggle.checked = settings.soundEnabled;

    const volSlider = document.getElementById('setting-sound-volume');
    if (volSlider) {
        volSlider.value = settings.soundVolume;
        updateSettingVolumeText(settings.soundVolume);
    }

    const speechRate = document.getElementById('setting-speech-rate');
    if (speechRate) speechRate.value = String(settings.speechRate);

    const chimeTone = document.getElementById('setting-chime-tone');
    if (chimeTone) chimeTone.value = settings.chimeType;

    const announceName = document.getElementById('setting-announce-name');
    if (announceName) announceName.checked = settings.voiceAnnounceName;

    const repeatCount = document.getElementById('setting-repeat-count');
    if (repeatCount) repeatCount.value = String(settings.repeatCount);

    // 2. Queue Rules
    const lateThreshold = document.getElementById('setting-late-threshold');
    if (lateThreshold) lateThreshold.value = String(settings.lateThresholdMins);

    const avgService = document.getElementById('setting-avg-service');
    if (avgService) avgService.value = String(settings.avgServiceTimeMins);

    const allowUrgent = document.getElementById('setting-allow-urgent');
    if (allowUrgent) allowUrgent.checked = settings.allowUrgentQueue;

    const smartRoom = document.getElementById('setting-smart-room');
    if (smartRoom) smartRoom.checked = settings.smartRoomMatch;

    // 3. Hospital Info
    const hospName = document.getElementById('setting-hosp-name');
    if (hospName) hospName.value = settings.hospitalName;

    const hospBranch = document.getElementById('setting-hosp-branch');
    if (hospBranch) hospBranch.value = settings.hospitalBranch;

    const stationName = document.getElementById('setting-station-name');
    if (stationName) stationName.value = settings.stationName;

    const hospPhone = document.getElementById('setting-hosp-phone');
    if (hospPhone) hospPhone.value = settings.hospitalPhone;

    // 4. Display
    const showCompleted = document.getElementById('setting-show-completed');
    if (showCompleted) showCompleted.checked = settings.showCompletedHistory;

    const refreshInterval = document.getElementById('setting-refresh-interval');
    if (refreshInterval) refreshInterval.value = String(settings.kioskRefreshIntervalSec);

    const bannerText = document.getElementById('setting-banner-text');
    if (bannerText) bannerText.value = settings.kioskAnnouncementBanner;
}

function saveSystemSettingsFromUI() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };
    const getCheck = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    const current = getSystemSettings();
    const updated = {
        ...current,
        soundEnabled: getCheck('setting-sound-enabled'),
        soundVolume: parseInt(getVal('setting-sound-volume'), 10) || 85,
        speechRate: parseFloat(getVal('setting-speech-rate')) || 1.0,
        chimeType: getVal('setting-chime-tone') || 'hospital',
        voiceAnnounceName: getCheck('setting-announce-name'),
        repeatCount: parseInt(getVal('setting-repeat-count'), 10) || 1,

        lateThresholdMins: parseInt(getVal('setting-late-threshold'), 10) || 30,
        avgServiceTimeMins: parseInt(getVal('setting-avg-service'), 10) || 15,
        allowUrgentQueue: getCheck('setting-allow-urgent'),
        smartRoomMatch: getCheck('setting-smart-room'),

        hospitalName: getVal('setting-hosp-name') || current.hospitalName,
        hospitalBranch: getVal('setting-hosp-branch') || current.hospitalBranch,
        stationName: getVal('setting-station-name') || current.stationName,
        hospitalPhone: getVal('setting-hosp-phone') || current.hospitalPhone,

        showCompletedHistory: getCheck('setting-show-completed'),
        kioskRefreshIntervalSec: parseInt(getVal('setting-refresh-interval'), 10) || 30,
        kioskAnnouncementBanner: getVal('setting-banner-text') || current.kioskAnnouncementBanner
    };

    saveSystemSettings(updated);
}

function testQueueSoundAnnouncement() {
    const chimeSelect = document.getElementById('setting-chime-tone');
    const chimeType = chimeSelect ? chimeSelect.value : 'hospital';
    const announceName = document.getElementById('setting-announce-name')?.checked !== false;

    // Temporarily apply UI tone for preview
    const origTone = soundManager.chimeType;
    soundManager.chimeType = chimeType;
    soundManager.announceName = announceName;

    soundManager.announceQueue('A001', 'room', 'ห้องตรวจที่ 1', 'สมชาย มั่นคง');

    showProfileToast('🔔 กำลังเล่นตัวอย่างเสียงประกาศจำลอง...', 'info');

    // Restore after test
    setTimeout(() => {
        soundManager.chimeType = origTone;
    }, 4500);
}

function exportSystemDataBackup() {
    try {
        const backupData = {
            exportDate: new Date().toISOString(),
            version: '2.5',
            state: state,
            appointments: typeof appointments !== 'undefined' ? appointments : [],
            userProfile: getUserProfile(),
            systemSettings: getSystemSettings(),
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
        const filename = `hospital_queue_backup_${dateStr}_${timeStr}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showProfileToast('ส่งออกไฟล์สำรองข้อมูลสำเร็จ!', 'success');
    } catch (e) {
        console.error('Error exporting backup:', e);
        showProfileToast('เกิดข้อผิดพลาดในการส่งออกข้อมูล', 'error');
    }
}

function handleImportSystemData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid JSON structure');
            }

            if (data.state) {
                Object.assign(state, data.state);
                saveState();
            }
            if (data.appointments && typeof appointments !== 'undefined') {
                appointments = data.appointments;
                saveAppointments();
            }
            if (data.userProfile) {
                saveUserProfile(data.userProfile);
            }
            if (data.systemSettings) {
                saveSystemSettings(data.systemSettings, false);
            }

            renderAll();
            renderSettingsPage();
            showProfileToast('นำเข้าและกู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว!', 'success');
        } catch (err) {
            console.error('Error importing JSON:', err);
            showProfileToast('ไฟล์ JSON ไม่ถูกต้องหรือไม่รองรับ', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset
}

function confirmResetDailyQueue() {
    if (confirm('ยืนยันการรีเซ็ตคิวประจำวัน?\n\nระบบจะทำการล้างคิวรอตรวจของวันนี้ และรีเซ็ตยอดคิวที่ให้บริการเสร็จสิ้นเป็น 0 เพื่อเริ่มวันใหม่')) {
        state.waitingQueue = [];
        state.labQueue = [];
        state.completedToday = 0;
        state.rooms.forEach(r => { r.patient = null; });
        saveState();
        renderAll();
        showProfileToast('รีเซ็ตคิวเพื่อเริ่มวันใหม่เรียบร้อยแล้ว!', 'success');
    }
}

function confirmFactoryReset() {
    if (confirm('⚠️ คำเตือน: คุณต้องการคืนค่าเริ่มต้นจากโรงงานทั้งหมดหรือไม่?\n\nข้อมูลคิว นัดหมาย โปรไฟล์ และการตั้งค่าทั้งหมดจะถูกล้างและกลับสู่ค่าเริ่มต้น')) {
        localStorage.removeItem('hospitalQueueState');
        localStorage.removeItem('hospitalAppointments');
        localStorage.removeItem('hospitalUserProfile');
        localStorage.removeItem('hospitalSystemSettings');
        localStorage.removeItem('queueSoundEnabled');
        
        showProfileToast('กำลังคืนค่าเริ่มต้นระบบ...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

function initSystemSettings() {
    const settings = getSystemSettings();
    saveSystemSettings(settings, false);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    // Restore sidebar collapse preference
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed === 'true') {
        const sidebar = document.getElementById('sidebar');
        const layout = document.querySelector('.app-layout');
        if (sidebar) sidebar.classList.add('collapsed');
        if (layout) layout.classList.add('sidebar-collapsed');
    }

    // Try loading from localStorage first, fallback to default data
    const loaded = loadState();
    if (!loaded) {
        initializeData();
    }
    initAppointments();
    initUserProfile();
    initSystemSettings();
    initEventListeners();
    updateDateTime();
    soundManager.init();
    renderAll();

    // Real-time clock
    setInterval(updateDateTime, 1000);

    // Update wait times every 30 seconds
    setInterval(updateWaitTimes, 30000);

    // Listen for changes from doctor's page
    window.addEventListener('storage', (e) => {
        if (e.key === 'hospitalQueueState' && e.newValue) {
            try {
                const parsed = JSON.parse(e.newValue);
                if (parsed && parsed.lastUpdatedBy === 'doctor') {
                    loadState();
                    renderWaitingQueue();
                    renderLabQueue();
                    renderRooms();
                    updateStats();
                    renderHistory();
                }
            } catch(err) {}
        }
    });
});
