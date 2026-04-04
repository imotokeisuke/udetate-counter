(function() {
    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const appViews = document.querySelectorAll('.app-view');
    const appTitle = document.getElementById('app-title');

    // Settings
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsModal = document.getElementById('settings-modal');
    const firebaseUrlInput = document.getElementById('firebase-url');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const membersListEdit = document.getElementById('members-list-edit');
    const newMemberName = document.getElementById('new-member-name');
    const btnAddMember = document.getElementById('btn-add-member');

    // Strength elements
    const formStrength = document.getElementById('record-form-strength');
    const rankingListStrength = document.getElementById('ranking-list-strength');
    const rankingTitleStrength = document.getElementById('ranking-title-strength');
    const historyListStrength = document.getElementById('history-list-strength');
    const monthFilterStrength = document.getElementById('month-filter-strength');

    // Running elements
    const formRunning = document.getElementById('record-form-running');
    const rankingListRunning = document.getElementById('ranking-list-running');
    const rankingTitleRunning = document.getElementById('ranking-title-running');
    const historyListRunning = document.getElementById('history-list-running');
    const monthFilterRunning = document.getElementById('month-filter-running');

    // Calendar elements
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const btnPrevMonth = document.getElementById('btn-prev-month');
    const btnNextMonth = document.getElementById('btn-next-month');
    const dayDetails = document.getElementById('day-details');
    const detailsDate = document.getElementById('details-date');
    const detailsList = document.getElementById('details-list');

    // Goals elements
    const userSelectGoal = document.getElementById('user-select-goal');
    const goalInputStrength = document.getElementById('goal-strength');
    const goalInputRunning = document.getElementById('goal-running');
    const btnSaveGoals = document.getElementById('btn-save-goals');
    const chartStrength = document.getElementById('chart-strength');
    const chartRunning = document.getElementById('chart-running');

    // --- State ---
    let records = []; 
    let goals = {}; 
    let currentFilterMonth = { strength: 'all', running: 'all' }; // Default to 'all' to ensure visibility
    let activeView = 'view-strength';
    let calendarDate = new Date();
    
    // Load local settings
    const defaultMembers = ['井本', '藤原', '脇山'];
    let members = JSON.parse(localStorage.getItem('pushupMembers')) || defaultMembers;
    let firebaseUrl = localStorage.getItem('firebaseUrl') || 'https://push-up-record-default-rtdb.asia-southeast1.firebasedatabase.app/';

    // Firebase instances
    let database = null;
    let pushupsRef = null;
    let goalsRef = null;

    // Colors for user tags
    const userColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    
    // --- Initialization ---
    init();

    function init() {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localDateStr = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        document.querySelectorAll('.date-input').forEach(input => input.value = localDateStr);

        updateUserSelectOptions();
        renderSettingsMembers();
        firebaseUrlInput.value = firebaseUrl;

        if (firebaseUrl) {
            connectFirebase(firebaseUrl);
        } else {
            showNoConnectionState();
        }

        setupTabLogic();
        setupCalendarNav();
        
        userSelectGoal.addEventListener('change', renderGoalsView);
        document.getElementById('user-select-strength').addEventListener('change', () => renderGoalStatus('strength'));
        document.getElementById('user-select-running').addEventListener('change', () => renderGoalStatus('running'));
    }

    function showNoConnectionState() {
        const statusBadge = document.getElementById('connection-status');
        statusBadge.className = 'status-badge disconnected';
        statusBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> 設定が必要です';
    }

    function setupTabLogic() {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetView = item.getAttribute('data-view');
                if (targetView === activeView) return;

                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                appViews.forEach(v => v.classList.remove('active'));
                document.getElementById(targetView).classList.add('active');

                activeView = targetView;
                let title = 'Fitness Tracker';
                let icon = 'dumbbell';
                if (activeView === 'view-strength') icon = 'dumbbell';
                if (activeView === 'view-running') { title = 'Running Tracker'; icon = 'person-running'; }
                if (activeView === 'view-calendar') { title = 'Calendar'; icon = 'calendar-days'; }
                if (activeView === 'view-goals') { title = 'Monthly Goals'; icon = 'bullseye'; }
                appTitle.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${title}`;
                renderApp();
            });
        });
    }

    function connectFirebase(url) {
        if (!url || !url.startsWith('https://')) return;
        const statusBadge = document.getElementById('connection-status');
        try {
            statusBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 接続中...';
            const config = { databaseURL: url };
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
            database = firebase.database(app);
            pushupsRef = database.ref('pushups');
            goalsRef = database.ref('goals');

            pushupsRef.on('value', (snapshot) => {
                const data = snapshot.val();
                records = [];
                if (data) {
                    for (const key in data) {
                        records.push({
                            id: key,
                            type: data[key].type || 'strength',
                            ...data[key]
                        });
                    }
                }
                statusBadge.className = 'status-badge connected';
                statusBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> リアルタイム同期中';
                updateMonthFilterOptions('strength');
                updateMonthFilterOptions('running');
                renderApp();
            });

            goalsRef.on('value', (snapshot) => {
                goals = snapshot.val() || {};
                renderApp();
            });
        } catch (e) {
            console.error(e);
        }
    }

    async function addRecord(type, user, date, count) {
        if (!pushupsRef) return;
        const newRecord = { type, user, date, count, timestamp: firebase.database.ServerValue.TIMESTAMP };
        try { await pushupsRef.push(newRecord); showSubmitFeedback(type); } catch (e) { alert('失敗'); }
    }

    function showSubmitFeedback(type) {
        const btn = document.querySelector(`#record-form-${type} .btn-submit`);
        const originalText = btn.innerHTML;
        btn.innerHTML = '記録しました! <i class="fa-solid fa-check"></i>';
        btn.classList.add('success');
        setTimeout(() => { btn.innerHTML = originalText; btn.classList.remove('success'); }, 1500);
    }

    async function deleteRecord(id) {
        if (!database) return;
        try { await database.ref('pushups/' + id).remove(); } catch (e) { alert('失敗'); }
    }

    async function saveGoals() {
        if (!database) return;
        const currentMonth = new Date().toISOString().substring(0, 7);
        const selectedUser = userSelectGoal.value;
        const strength = parseInt(goalInputStrength.value) || 0;
        const running = parseFloat(goalInputRunning.value) || 0;
        if (!selectedUser) { alert('ユーザーを選択してください'); return; }

        try {
            await database.ref(`goals/${currentMonth}/${selectedUser}`).set({ strength, running });
            alert(`${selectedUser}さんの目標を保存しました！`);
        } catch (e) { alert('保存失敗'); }
    }

    window.confirmDelete = (id) => { if (confirm('削除しますか？')) deleteRecord(id); };

    window.removeMember = (name) => {
        if (members.length <= 1) return alert('最低1人必要です');
        members = members.filter(m => m !== name);
        localStorage.setItem('pushupMembers', JSON.stringify(members));
        renderSettingsMembers();
        updateUserSelectOptions();
    };

    [formStrength, formRunning].forEach(f => {
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = f.getAttribute('data-type');
            const user = document.getElementById(`user-select-${type}`).value;
            const date = document.getElementById(`date-input-${type}`).value;
            const countVal = document.getElementById(`count-input-${type}`).value;
            const count = type === 'strength' ? parseInt(countVal, 10) : parseFloat(countVal);
            if (!user || !date || isNaN(count) || count <= 0) { alert('正しく入力してください'); return; }
            addRecord(type, user, date, count);
            document.getElementById(`count-input-${type}`).value = '';
        });
    });

    monthFilterStrength.addEventListener('change', (e) => { currentFilterMonth.strength = e.target.value; renderApp(); });
    monthFilterRunning.addEventListener('change', (e) => { currentFilterMonth.running = e.target.value; renderApp(); });
    btnSaveGoals.addEventListener('click', saveGoals);
    btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    btnSaveSettings.addEventListener('click', () => {
        const url = firebaseUrlInput.value.trim();
        localStorage.setItem('firebaseUrl', url);
        settingsModal.classList.add('hidden');
        if (url) location.reload(); 
    });

    btnAddMember.addEventListener('click', () => {
        const val = newMemberName.value.trim();
        if (val && !members.includes(val)) {
            members.push(val);
            localStorage.setItem('pushupMembers', JSON.stringify(members));
            newMemberName.value = '';
            renderSettingsMembers();
            updateUserSelectOptions();
        }
    });

    function renderApp() {
        if (activeView === 'view-strength') renderSection('strength');
        else if (activeView === 'view-running') renderSection('running');
        else if (activeView === 'view-calendar') renderCalendar();
        else if (activeView === 'view-goals') renderGoalsView();
    }

    function renderSection(type) {
        const sectionRecords = records.filter(r => r.type === type);
        const sorted = sectionRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        const filter = currentFilterMonth[type];
        const filtered = filter && filter !== 'all' ? sorted.filter(r => r.date.substring(0, 7) === filter) : sorted;
        renderRanking(type, filtered);
        renderHistory(type, filtered);
        renderGoalStatus(type);
    }

    function renderRanking(type, filteredRecords) {
        const list = type === 'strength' ? rankingListStrength : rankingListRunning;
        const title = type === 'strength' ? rankingTitleStrength : rankingTitleRunning;
        const filter = currentFilterMonth[type];
        if (filteredRecords.length === 0) { list.innerHTML = `<div class="empty-state"><p>データがありません</p></div>`; title.innerText = "ランキング"; return; }
        title.innerText = (filter && filter !== 'all') ? `${filter.replace('-','/')} のランキング` : '総合ランキング';
        const totals = {};
        filteredRecords.forEach(r => totals[r.user] = (totals[r.user] || 0) + r.count);
        const sorted = Object.keys(totals).map(u => ({ name: u, score: totals[u] })).sort((a, b) => b.score - a.score);
        const max = sorted[0].score || 1;
        list.innerHTML = sorted.map((u, i) => {
            const rankIcon = i === 0 ? '<i class="fa-solid fa-crown"></i>' : (i + 1);
            const rankClass = i < 3 ? `rank-${i + 1}` : '';
            const width = Math.max(5, (u.score / max) * 100);
            return `<div class="ranking-item">
                <div class="ranking-rank ${rankClass}">${rankIcon}</div>
                <div class="ranking-bar-wrapper">
                    <div class="ranking-name-score"><span>${u.name}</span><span>${(type==='strength'?u.score:u.score.toFixed(1))} ${(type==='strength'?'回':'km')}</span></div>
                    <div class="ranking-bar-bg"><div class="ranking-bar ${type}" style="width: ${width}%"></div></div>
                </div>
            </div>`;
        }).join('');
    }

    function renderHistory(type, filteredRecords) {
        const container = type === 'strength' ? historyListStrength : historyListRunning;
        if (filteredRecords.length === 0) { container.innerHTML = `<div class="empty-state"><p>記録がありません</p></div>`; return; }
        container.innerHTML = filteredRecords.map(r => {
            const color = userColors[members.indexOf(r.user)%userColors.length || 0];
            return `<div class="history-item">
                <div class="history-info">
                    <div class="history-info-top"><span class="user-badge" style="background-color: ${color}">${r.user}</span><div class="history-date">${r.date.replace(/-/g, '/')}</div></div>
                    <div class="history-count">${(type==='strength'?r.count:r.count.toFixed(1))} <span>${(type==='strength'?'回':'km')}</span></div>
                </div>
                <button class="btn-delete" onclick="window.confirmDelete('${r.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        }).join('');
    }

    function setupCalendarNav() {
        btnPrevMonth.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
        btnNextMonth.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        dayDetails.classList.add('hidden');
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        calendarMonthYear.innerText = `${year}年${month+1}月`;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) calendarGrid.appendChild(createDayEl(daysInPrevMonth - i, true));
        for (let d = 1; d <= daysInMonth; d++) calendarGrid.appendChild(createDayEl(d, false, (new Date().toDateString() === new Date(year, month, d).toDateString())));
        const remaining = 42 - calendarGrid.children.length;
        for (let i = 1; i <= remaining; i++) calendarGrid.appendChild(createDayEl(i, true));
    }

    function createDayEl(day, otherMonth, isToday) {
        const el = document.createElement('div');
        el.className = `calendar-day ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
        el.innerHTML = `<span>${day}</span>`;
        if (!otherMonth) {
            const ds = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dr = records.filter(r => r.date === ds);
            if (dr.length > 0) {
                const mk = document.createElement('div'); mk.className = 'day-marker-container';
                
                // Group by user and type to show distinct icons
                const userTypePairs = [];
                dr.forEach(r => {
                    if (!userTypePairs.find(p => p.user === r.user && p.type === r.type)) {
                        userTypePairs.push({ user: r.user, type: r.type });
                    }
                });

                userTypePairs.forEach(p => {
                    const color = userColors[members.indexOf(p.user) % userColors.length || 0];
                    const icon = p.type === 'strength' ? 'dumbbell' : 'person-running';
                    mk.innerHTML += `<div class="marker" style="background-color: ${color}">
                        <i class="fa-solid fa-${icon}"></i>
                    </div>`;
                });

                el.appendChild(mk);
                el.addEventListener('click', () => {
                    dayDetails.classList.remove('hidden'); detailsDate.innerText = ds.replace(/-/g, '/');
                    detailsList.innerHTML = dr.map(r => {
                        const color = userColors[members.indexOf(r.user)%userColors.length || 0];
                        return `<div class="detail-item">
                            <span class="user-badge" style="background-color: ${color}">${r.user}</span>
                            <span>${r.type === 'strength' ? '<i class="fa-solid fa-dumbbell"></i> 筋トレ' : '<i class="fa-solid fa-person-running"></i> ランニング'}</span>
                            <b>${r.count}${r.type === 'strength' ? '回' : 'km'}</b>
                        </div>`;
                    }).join('');
                });
            }
        }
        return el;
    }

    function renderGoalsView() {
        const currentMonth = new Date().toISOString().substring(0, 7);
        const selectedUser = userSelectGoal.value;
        if (!selectedUser) return;

        const currentGoal = (goals[currentMonth] && goals[currentMonth][selectedUser]) || { strength: 0, running: 0 };
        goalInputStrength.placeholder = `設定中: ${currentGoal.strength || 'なし'}`;
        goalInputRunning.placeholder = `設定中: ${currentGoal.running || 'なし'}`;

        const ur = records.filter(r => r.date.substring(0, 7) === currentMonth && r.user === selectedUser);
        const ts = ur.filter(r => r.type === 'strength').reduce((s, r) => s + r.count, 0);
        const tr = ur.filter(r => r.type === 'running').reduce((s, r) => s + r.count, 0);

        renderGoalChart('strength', ts, currentGoal.strength);
        renderGoalChart('running', tr, currentGoal.running);
    }

    function renderGoalChart(type, act, tgt) {
        const container = type === 'strength' ? chartStrength : chartRunning;
        const max = Math.max(act, tgt || 0, 1) * 1.5; // 余裕を持たせる（1.5倍）
        const ap = Math.max((act / max) * 100, 4); // 最低4%の高さ
        const tp = tgt ? (tgt / max) * 100 : 0;
        const displayVal = type === 'strength' ? act : act.toFixed(1);
        container.innerHTML = `
            <div class="chart-bar-container">
                <div class="chart-bar ${type}" style="height: ${ap}%">
                    <span class="chart-value">${displayVal}</span>
                </div>
                <span class="chart-label">実績</span>
            </div>
            ${tgt ? `
                <div class="goal-line" style="bottom: calc(${tp}% + 36px)">
                    <span class="goal-line-label">${tgt}${(type==='strength'?'回':'km')}</span>
                </div>` : ''}
        `;
    }

    function renderGoalStatus(type) {
        const container = document.getElementById(`goal-status-${type}`);
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        let html = `
            <div class="goal-status-card">
                <h4>今月の${type === 'strength' ? '筋トレ' : 'ランニング'}目標進捗（全員）</h4>
                <div class="member-goal-list">
        `;

        members.forEach(user => {
            const ur = records.filter(r => r.date.substring(0, 7) === currentMonth && r.user === user && r.type === type);
            const total = ur.reduce((s, r) => s + r.count, 0);
            const goalVal = (goals[currentMonth] && goals[currentMonth][user] && goals[currentMonth][user][type]) || 0;
            const color = userColors[members.indexOf(user) % userColors.length || 0];
            
            const percent = goalVal > 0 ? Math.min(100, Math.round((total / goalVal) * 100)) : 0;
            
            html += `
                <div class="member-goal-item">
                    <div class="member-goal-header">
                        <span class="member-goal-name">
                            <div class="member-dot" style="background-color: ${color}"></div>
                            ${user}
                        </span>
                        <span class="member-goal-percent">${percent}%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-fill ${type}" style="width: ${percent}%; ${percent >= 100 ? 'background: var(--success-color)' : ''}"></div>
                    </div>
                    <div class="goal-status-text">
                        <span>実績: <b>${(type==='strength'?total:total.toFixed(1))}</b> / 目標: <b>${goalVal || '-'}</b></span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    function updateMonthFilterOptions(type) {
        const fe = type === 'strength' ? monthFilterStrength : monthFilterRunning;
        const ms = new Set();
        records.filter(r => r.type === type).forEach(r => ms.add(r.date.substring(0, 7)));
        const sorted = Array.from(ms).sort().reverse();
        fe.innerHTML = '<option value="all">すべての期間</option>';
        sorted.forEach(m => { fe.innerHTML += `<option value="${m}">${m.replace('-','年')}月</option>`; });
        fe.value = currentFilterMonth[type];
    }

    function updateUserSelectOptions() {
        document.querySelectorAll('.user-select').forEach(s => {
            s.innerHTML = members.map(m => `<option value="${m}">${m}</option>`).join('');
        });
    }

    function renderSettingsMembers() {
        membersListEdit.innerHTML = members.map(m => `<div class="member-tag"><span>${m}</span><button onclick="window.removeMember('${m}')"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
    }
})();
