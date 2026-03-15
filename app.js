document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const form = document.getElementById('pushup-form');
    const dateInput = document.getElementById('date-input');
    const countInput = document.getElementById('count-input');
    const historyList = document.getElementById('history-list');
    const monthlyTotalEl = document.getElementById('monthly-total');
    const monthFilter = document.getElementById('month-filter');

    // --- State ---
    let records = JSON.parse(localStorage.getItem('pushupRecords')) || [];
    let currentFilterMonth = '';

    // --- Initialization ---
    init();

    function init() {
        // Set default date to today
        const today = new Date();
        // Adjust for timezone offset to get valid local YYYY-MM-DD
        const offset = today.getTimezoneOffset();
        const localDate = new Date(today.getTime() - (offset * 60 * 1000));
        dateInput.value = localDate.toISOString().split('T')[0];

        // Setup filter
        updateMonthFilterOptions();

        // Initial render
        renderApp();
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = dateInput.value;
        const count = parseInt(countInput.value, 10);

        if (!date || isNaN(count) || count <= 0) {
            alert('正しい日付と回数を入力してください。');
            return;
        }

        addRecord(date, count);

        // Reset count input and focus
        countInput.value = '';
        countInput.focus();
    });

    monthFilter.addEventListener('change', (e) => {
        currentFilterMonth = e.target.value;
        renderApp();
    });

    // --- Core Logic ---
    function addRecord(date, count) {
        const id = Date.now().toString();

        const newRecord = {
            id,
            date,
            count,
            timestamp: Date.now()
        };

        records.push(newRecord);
        saveRecords();
        updateMonthFilterOptions(); // Add new month to filter if needed
        renderApp();

        // Optional: show a micro-animation success state
        const submitBtn = form.querySelector('button');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '記録しました! <i class="fa-solid fa-check"></i>';
        submitBtn.style.backgroundColor = 'var(--success-color)';

        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.style.backgroundColor = '';
        }, 1500);
    }

    function deleteRecord(id) {
        records = records.filter(record => record.id !== id);
        saveRecords();
        updateMonthFilterOptions();
        renderApp();
    }

    function saveRecords() {
        localStorage.setItem('pushupRecords', JSON.stringify(records));
    }

    // --- Rendering Logic ---
    function renderApp() {
        // Sort records by date descending
        const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Get unique months for filtering
        const viewRecords = currentFilterMonth && currentFilterMonth !== 'all'
            ? sortedRecords.filter(r => r.date.substring(0, 7) === currentFilterMonth)
            : sortedRecords;

        renderHistory(viewRecords);
        updateDashboard();
    }

    function renderHistory(recordsToRender) {
        historyList.innerHTML = '';

        if (recordsToRender.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <p>記録がありません。</p>
                </div>
            `;
            return;
        }

        recordsToRender.forEach(record => {
            const item = document.createElement('div');
            item.className = 'history-item';

            // Format date: YYYY-MM-DD to YYYY/MM/DD
            const formattedDate = record.date.replace(/-/g, '/');

            item.innerHTML = `
                <div class="history-info">
                    <div class="history-date">${formattedDate}</div>
                    <div class="history-count">${record.count} <span>回</span></div>
                </div>
                <button class="btn-delete" data-id="${record.id}" title="削除">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Add delete event listener
            item.querySelector('.btn-delete').addEventListener('click', function () {
                if (confirm('この記録を削除しますか？')) {
                    const id = this.getAttribute('data-id');
                    deleteRecord(id);
                }
            });

            historyList.appendChild(item);
        });
    }

    function updateDashboard() {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localDate = new Date(today.getTime() - (offset * 60 * 1000));
        const todayString = localDate.toISOString().split('T')[0];

        const currentMonthString = currentFilterMonth !== 'all' && currentFilterMonth
            ? currentFilterMonth
            : todayString.substring(0, 7);

        // Calculate monthly total
        const monthRecords = records.filter(r => r.date.substring(0, 7) === currentMonthString);
        const monthlyTotal = monthRecords.reduce((sum, record) => sum + record.count, 0);

        // Animate numbers
        animateValue(monthlyTotalEl, parseInt(monthlyTotalEl.innerText), monthlyTotal, 500);

        // Update dashboard title based on filter
        const monthlyTitle = document.querySelector('.dashboard .stat-card:first-child h3');
        if (currentFilterMonth && currentFilterMonth !== 'all') {
            const [year, month] = currentFilterMonth.split('-');
            monthlyTitle.innerText = `${year}年${parseInt(month, 10)}月の合計`;
        } else {
            monthlyTitle.innerText = '今月の合計';
        }
    }

    function updateMonthFilterOptions() {
        const months = new Set();
        records.forEach(r => {
            months.add(r.date.substring(0, 7)); // Extract YYYY-MM
        });

        const sortedMonths = Array.from(months).sort().reverse();

        // Save current selection
        const currentSelected = monthFilter.value;

        monthFilter.innerHTML = '<option value="all">すべての月</option>';

        sortedMonths.forEach(month => {
            const [year, m] = month.split('-');
            const option = document.createElement('option');
            option.value = month;
            option.textContent = `${year}年${parseInt(m, 10)}月`;
            monthFilter.appendChild(option);
        });

        // Restore selection if it still exists
        if (currentSelected && sortedMonths.includes(currentSelected)) {
            monthFilter.value = currentSelected;
        } else if (sortedMonths.length > 0 && !currentFilterMonth) {
            // Default to most recent month if nothing is selected
            currentFilterMonth = sortedMonths[0];
            monthFilter.value = currentFilterMonth;
        }
    }

    // Number animation utility
    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end; // Ensure exact final value
            }
        };
        window.requestAnimationFrame(step);
    }
});
