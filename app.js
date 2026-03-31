import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const form = document.getElementById('pushup-form');
    const dateInput = document.getElementById('date-input');
    const countInput = document.getElementById('count-input');
    const userSelect = document.getElementById('user-select');
    const historyList = document.getElementById('history-list');
    const rankingList = document.getElementById('ranking-list');
    const rankingTitle = document.getElementById('ranking-title');
    const monthFilter = document.getElementById('month-filter');
    const statusBadge = document.getElementById('connection-status');
    const btnSubmit = document.getElementById('btn-submit');

    // Settings
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsModal = document.getElementById('settings-modal');
    const firebaseUrlInput = document.getElementById('firebase-url');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const membersListEdit = document.getElementById('members-list-edit');
    const newMemberName = document.getElementById('new-member-name');
    const btnAddMember = document.getElementById('btn-add-member');

    // --- State ---
    let records = []; // From Firebase
    let currentFilterMonth = '';
    
    // Load local settings
    const defaultMembers = ['井本', '藤原', '脇山'];
    let members = JSON.parse(localStorage.getItem('pushupMembers')) || defaultMembers;
    let firebaseUrl = localStorage.getItem('firebaseUrl') || '';

    // Firebase refs
    let app = null;
    let db = null;
    let dbRef = null;

    // Colors for user tags
    const userColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    
    // --- Initialization ---
    init();

    function init() {
        // Init Inputs
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localDate = new Date(today.getTime() - (offset * 60 * 1000));
        dateInput.value = localDate.toISOString().split('T')[0];

        // Init UI
        updateUserSelectOptions();
        updateMonthFilterOptions();
        renderSettingsMembers();

        firebaseUrlInput.value = firebaseUrl;

        if (firebaseUrl) {
            connectFirebase(firebaseUrl);
        } else {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> 設定が必要です';
            historyList.innerHTML = `<div class="empty-state"><p>右上の⚙️からデータベースを設定してください</p></div>`;
            rankingList.innerHTML = `<div class="empty-state"><p>設定待ち</p></div>`;
            btnSubmit.disabled = true;
        }
    }

    // --- Firebase Logic ---
    function connectFirebase(url) {
        if (!url || !url.startsWith('https://')) return;
        
        try {
            statusBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 接続中...';
            statusBadge.className = 'status-badge disconnected';

            const firebaseConfig = { databaseURL: url };
            
            // Delete old app if exists
            if (app) {
                // Not perfectly clean without deleteApp but sufficient for standard usage
            }

            app = initializeApp(firebaseConfig);
            db = getDatabase(app);
            dbRef = ref(db, 'pushups');

            // Listen to real-time updates
            onValue(dbRef, (snapshot) => {
                const data = snapshot.val();
                records = [];
                if (data) {
                    for (const key in data) {
                        records.push({
                            id: key,
                            ...data[key]
                        });
                    }
                }
                statusBadge.className = 'status-badge connected';
                statusBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> リアルタイム同期中';
                btnSubmit.disabled = false;
                
                updateMonthFilterOptions();
                renderApp();
            }, (error) => {
                console.error(error);
                statusBadge.className = 'status-badge disconnected';
                statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 接続エラー';
            });
        } catch (e) {
            console.error('Firebase connection error', e);
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> データベースを確認してください';
        }
    }

    async function addRecord(user, date, count) {
        if (!dbRef) return;
        const newRecord = {
            user: user,
            date: date,
            count: count,
            timestamp: Date.now()
        };
        try {
            await push(dbRef, newRecord);
            // Optional: micro-animation
            const originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '記録しました! <i class="fa-solid fa-check"></i>';
            btnSubmit.style.backgroundColor = 'var(--success-color)';
            setTimeout(() => {
                btnSubmit.innerHTML = originalText;
                btnSubmit.style.backgroundColor = '';
            }, 1000);
        } catch (e) {
            alert('保存に失敗しました。URLや設定を確認してください。');
        }
    }

    async function deleteRecord(id) {
        if (!db) return;
        try {
            const itemRef = ref(db, 'pushups/' + id);
            await remove(itemRef);
        } catch (e) {
            alert('削除に失敗しました。');
        }
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = userSelect.value;
        const date = dateInput.value;
        const count = parseInt(countInput.value, 10);

        if (!user || !date || isNaN(count) || count <= 0) {
            alert('正しく入力してください。');
            return;
        }
        addRecord(user, date, count);
        countInput.value = '';
        countInput.focus();
    });

    monthFilter.addEventListener('change', (e) => {
        currentFilterMonth = e.target.value;
        renderApp();
    });

    // Settings
    btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    btnSaveSettings.addEventListener('click', () => {
        const url = firebaseUrlInput.value.trim();
        localStorage.setItem('firebaseUrl', url);
        firebaseUrl = url;
        settingsModal.classList.add('hidden');
        if (url) connectFirebase(url);
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

    // --- Rendering Logic ---
    function renderApp() {
        const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

        const viewRecords = currentFilterMonth && currentFilterMonth !== 'all'
            ? sortedRecords.filter(r => r.date.substring(0, 7) === currentFilterMonth)
            : sortedRecords;

        renderHistory(viewRecords);
        updateRanking(viewRecords);
    }

    function renderHistory(recordsToRender) {
        historyList.innerHTML = '';
        if (recordsToRender.length === 0) {
            historyList.innerHTML = `<div class="empty-state"><p>記録がありません。</p></div>`;
            return;
        }

        recordsToRender.forEach(record => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const colorIndex = members.indexOf(record.user) >= 0 ? members.indexOf(record.user) % userColors.length : 0;
            const userColor = userColors[colorIndex];
            const formattedDate = record.date.replace(/-/g, '/');

            item.innerHTML = `
                <div class="history-info">
                    <div class="history-info-top">
                        <span class="user-badge" style="background-color: ${userColor}">${record.user}</span>
                        <div class="history-date">${formattedDate}</div>
                    </div>
                    <div class="history-count">${record.count} <span>回</span></div>
                </div>
                <button class="btn-delete" data-id="${record.id}" title="削除">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            item.querySelector('.btn-delete').addEventListener('click', function () {
                if (confirm('この記録を削除しますか？')) {
                    deleteRecord(this.getAttribute('data-id'));
                }
            });
            historyList.appendChild(item);
        });
    }

    function updateRanking(recordsToRender) {
        if (recordsToRender.length === 0) {
            rankingList.innerHTML = `<div class="empty-state"><p>データがありません</p></div>`;
            rankingTitle.innerText = "ランキング";
            return;
        }

        // Title
        if (currentFilterMonth && currentFilterMonth !== 'all') {
            const [year, month] = currentFilterMonth.split('-');
            rankingTitle.innerText = `${year}年${parseInt(month, 10)}月のランキング`;
        } else {
            rankingTitle.innerText = '総合ランキング';
        }

        // Aggregate scores by user
        const totalsMap = {};
        recordsToRender.forEach(r => {
            if (!totalsMap[r.user]) totalsMap[r.user] = 0;
            totalsMap[r.user] += r.count;
        });

        const sortedUsers = Object.keys(totalsMap).map(u => ({
            name: u,
            score: totalsMap[u]
        })).sort((a, b) => b.score - a.score);

        const maxScore = sortedUsers[0].score || 1; // Prevent division by zero

        rankingList.innerHTML = '';
        sortedUsers.forEach((u, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            
            const rankClass = index < 3 ? `rank-${index + 1}` : '';
            const rankIcon = index === 0 ? '<i class="fa-solid fa-crown"></i>' : (index + 1);
            
            const widthPct = Math.max(5, (u.score / maxScore) * 100);

            item.innerHTML = `
                <div class="ranking-rank ${rankClass}">${rankIcon}</div>
                <div class="ranking-bar-wrapper">
                    <div class="ranking-name-score">
                        <span class="ranking-name">${u.name}</span>
                        <span class="ranking-score">${u.score} 回</span>
                    </div>
                    <div class="ranking-bar-bg">
                        <div class="ranking-bar" style="width: ${widthPct}%"></div>
                    </div>
                </div>
            `;
            rankingList.appendChild(item);
        });
    }

    function updateMonthFilterOptions() {
        const months = new Set();
        records.forEach(r => {
            months.add(r.date.substring(0, 7)); // Extract YYYY-MM
        });

        const sortedMonths = Array.from(months).sort().reverse();
        const currentSelected = monthFilter.value;

        monthFilter.innerHTML = '<option value="all">すべての期間</option>';
        sortedMonths.forEach(month => {
            const [year, m] = month.split('-');
            const option = document.createElement('option');
            option.value = month;
            option.textContent = `${year}年${parseInt(m, 10)}月`;
            monthFilter.appendChild(option);
        });

        if (currentSelected && (sortedMonths.includes(currentSelected) || currentSelected === 'all')) {
            monthFilter.value = currentSelected;
        } else if (sortedMonths.length > 0 && !currentFilterMonth) {
            currentFilterMonth = sortedMonths[0]; // Auto select current month
            monthFilter.value = currentFilterMonth;
        }
    }

    function updateUserSelectOptions() {
        userSelect.innerHTML = '';
        members.forEach(member => {
            const opt = document.createElement('option');
            opt.value = member;
            opt.textContent = member;
            userSelect.appendChild(opt);
        });
    }

    function renderSettingsMembers() {
        membersListEdit.innerHTML = '';
        members.forEach(member => {
            const tag = document.createElement('div');
            tag.className = 'member-tag';
            tag.innerHTML = `<span>${member}</span> <button data-name="${member}"><i class="fa-solid fa-xmark"></i></button>`;
            
            tag.querySelector('button').addEventListener('click', function() {
                const name = this.getAttribute('data-name');
                if (members.length <= 1) {
                    alert('メンバーは最低1人必要です。');
                    return;
                }
                members = members.filter(m => m !== name);
                localStorage.setItem('pushupMembers', JSON.stringify(members));
                renderSettingsMembers();
                updateUserSelectOptions();
            });

            membersListEdit.appendChild(tag);
        });
    }
});
