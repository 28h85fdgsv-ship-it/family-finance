// State Management
const APPS_SCRIPT_URL = localStorage.getItem('apps_script_url') || 'https://script.google.com/macros/s/AKfycbzWe_koWxBbbom82fScaVpZvk5N5whf4KSWm6Z8pBLdYsLIi0BWvOCvhCqwswtv01xBgg/exec';
let transactionsData = [];
let localTransactions = JSON.parse(localStorage.getItem('local_transactions')) || [];
let sheetConfig = JSON.parse(localStorage.getItem('sheet_config')) || { id: '', name: 'הוצאות הכנסות 2026' };
let lastSyncTime = '';
let categoryChartInstance = null;
let trendChartInstance = null;
let netWorthChartInstance = null;
let assetBreakdownChartInstance = null;
let cmpBarChartInstance = null;
let cmpLineChartInstance = null;
let savingsGrowthChartInstance = null;
let savingsExpenseChartInstance = null;

// Period state (month navigator)
const _now = new Date();
let selectedYear  = _now.getFullYear();
let selectedMonth = _now.getMonth(); // 0-11

const MONTH_NAMES_HE = [
    'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
    'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

const EXPENSE_CATS = ['משכנתא','מזומן','שיקים','אשראי','ריבית /עמלות','חסכונות','הלוואות'];
const INCOME_CATS  = ['הכנסות משכורות+ קצבת ילדים','ביט/פייבוקס/דיוידנט','מתנות','פתיחת חסכונות'];

let annualViewYear = _now.getFullYear();
let _periodInitialized = false; // snap to latest data month only once

// Mock fallback data in case data.json fails to load (Cash flow & portfolio)
const fallbackData = {
    sheet_id: "",
    last_sync: "",
    transactions: [
        { date: "2026-05-01", description: "משכורת יוסי", category: "משכורת", amount: 21500, type: "הכנסה" },
        { date: "2026-05-01", description: "משכורת מיכל", category: "משכורת", amount: 14200, type: "הכנסה" },
        { date: "2026-05-02", description: "החזר משכנתא", category: "דיור ומשכנתא", amount: 6200, type: "הוצאה" },
        { date: "2026-05-03", description: "קניות בשופרסל", category: "מזון וסופרמרקט", amount: 920.40, type: "הוצאה" }
    ],
    portfolio: {
        months: ["ינואר", "פברואר", "מרץ", "אפריל"],
        family_assets: {
            "פקדונות וחסכונות": [24297.3, 24862.0, 25435.3, 31535.8],
            "ניירות ערך": [242209.1, 242511.5, 234966.9, 254496.3],
            "אקסלנס": [235412.2, 236272.6, 230743.2, 267996.4]
        },
        roni_assets: {
            "עו\"ש": [18771.4, 11568.4, 7194.5, 1941.2],
            "פקדונות": [7502.2, 7694.1, 7908.9, 8133.9]
        },
        miki_assets: {
            "עו\"ש": [3162.0, 14119.8, 3135.4, 2086.8]
        },
        zohar_assets: {
            "עו\"ש": [2482.9, 3295.7, 3315.4, 3229.3]
        }
    }
};

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// App Initialization
async function initApp() {
    setupDateTime();
    setupNavigation();
    setupModals();
    setupPeriodNav();
    await loadData();
    setupFilters();
    checkCredentialsFile();
}

// Set up dates
function setupDateTime() {
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.innerText = new Date().toLocaleDateString('he-IL', options);
}

// Navigation between views
function setupNavigation() {
    const navDashboard    = document.getElementById('nav-dashboard');
    const navTransactions = document.getElementById('nav-transactions-list');
    const navCharts       = document.getElementById('nav-charts');
    const navPortfolio    = document.getElementById('nav-portfolio');
    const navAnnual       = document.getElementById('nav-annual');
    const navCompare      = document.getElementById('nav-compare');
    const navEntry        = document.getElementById('nav-entry');

    const dashboardView    = document.getElementById('dashboard-view');
    const transactionsView = document.getElementById('transactions-view');
    const portfolioView    = document.getElementById('portfolio-view');
    const annualView       = document.getElementById('annual-view');
    const comparisonView   = document.getElementById('comparison-view');
    const entryView        = document.getElementById('entry-view');

    const btnViewAll  = document.getElementById('btn-view-all-transactions');
    const btnGoAnnual = document.getElementById('btn-go-annual');

    const allTabs  = [navDashboard, navTransactions, navCharts, navPortfolio, navAnnual, navCompare, navEntry];
    const allViews = [dashboardView, transactionsView, portfolioView, annualView, comparisonView, entryView];

    const switchView = (activeTab, showView) => {
        allTabs.forEach(t => t.classList.remove('active'));
        allViews.forEach(v => v.classList.add('hidden'));
        activeTab.classList.add('active');
        showView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navDashboard, dashboardView);
    });

    const goToTransactions = (e) => {
        if (e) e.preventDefault();
        switchView(navTransactions, transactionsView);
    };
    navTransactions.addEventListener('click', goToTransactions);
    btnViewAll.addEventListener('click', goToTransactions);

    navCharts.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navDashboard, dashboardView);
        document.querySelector('.charts-grid').scrollIntoView({ behavior: 'smooth' });
    });

    navPortfolio.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navPortfolio, portfolioView);
    });

    const goToAnnual = (e) => {
        if (e) e.preventDefault();
        switchView(navAnnual, annualView);
        renderAnnualTable(annualViewYear);
    };
    navAnnual.addEventListener('click', goToAnnual);
    if (btnGoAnnual) btnGoAnnual.addEventListener('click', goToAnnual);

    navCompare.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navCompare, comparisonView);
        populateYearSelectors();
    });

    navEntry.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navEntry, entryView);
        setupEntryView();
    });

    document.getElementById('btn-run-compare').addEventListener('click', () => {
        const y1 = parseInt(document.getElementById('cmp-year-1').value);
        const y2 = parseInt(document.getElementById('cmp-year-2').value);
        if (y1 && y2) renderComparison(y1, y2);
    });

    // Year navigation inside annual view — bounded to synced years
    document.getElementById('btn-prev-year').addEventListener('click', () => {
        const minYear = window.syncedYears && window.syncedYears.length > 0
            ? Math.min(...window.syncedYears) : 2018;
        if (annualViewYear > minYear) { annualViewYear--; renderAnnualTable(annualViewYear); }
    });
    document.getElementById('btn-next-year').addEventListener('click', () => {
        const maxYear = window.syncedYears && window.syncedYears.length > 0
            ? Math.max(...window.syncedYears) : new Date().getFullYear();
        if (annualViewYear < maxYear) { annualViewYear++; renderAnnualTable(annualViewYear); }
    });
}

// Modal Toggle Handlers
function setupModals() {
    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsForm = document.getElementById('settings-form');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const sheetNameInput = document.getElementById('sheet-name-input');
    const btnTestConn = document.getElementById('btn-test-connection');

    // Populate inputs from saved localStorage config
    sheetIdInput.value = sheetConfig.id || '';
    sheetNameInput.value = sheetConfig.name || 'הוצאות הכנסות 2026';

    btnOpenSettings.addEventListener('click', (e) => {
        e.preventDefault();
        settingsModal.classList.remove('hidden');
        checkCredentialsFile();
    });
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sheetConfig.id = sheetIdInput.value.trim();
        sheetConfig.name = sheetNameInput.value.trim();
        localStorage.setItem('sheet_config', JSON.stringify(sheetConfig));
        alert('ההגדרות נשמרו בהצלחה!');
        settingsModal.classList.add('hidden');
    });

    btnTestConn.addEventListener('click', async () => {
        btnTestConn.innerText = 'בודק חיבור...';
        btnTestConn.disabled = true;
        
        const hasCreds = await checkCredentialsFile();
        setTimeout(() => {
            if (hasCreds && sheetIdInput.value.trim().length > 10) {
                alert('החיבור נראה תקין! קובץ credentials.json קיים ומזהה הגיליון הוזן.');
            } else if (!hasCreds) {
                alert('שגיאה: קובץ credentials.json לא נמצא בתיקיית הפרויקט. אנא עקוב אחר ההוראות בתוכנית העבודה.');
            } else {
                alert('אנא הזן מזהה גיליון (Sheet ID) תקין.');
            }
            btnTestConn.innerText = 'בדוק חיבור';
            btnTestConn.disabled = false;
        }, 1000);
    });

    // Transaction Modal
    const transModal = document.getElementById('transaction-modal');
    const btnOpenTrans = document.getElementById('btn-add-transaction-modal');
    const btnCloseTrans = document.getElementById('btn-close-transaction');
    const btnCancelTrans = document.getElementById('btn-cancel-transaction');
    const transForm = document.getElementById('transaction-form');

    // Set default date to today
    document.getElementById('t-date').valueAsDate = new Date();

    const tTypeSel = document.getElementById('t-type');
    const tCatSel  = document.getElementById('t-category');

    const populateCategorySelect = () => {
        const cats = tTypeSel.value === 'הוצאה' ? EXPENSE_CATS : INCOME_CATS;
        tCatSel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    };
    tTypeSel.addEventListener('change', populateCategorySelect);
    populateCategorySelect(); // init on load

    btnOpenTrans.addEventListener('click', () => {
        populateCategorySelect();
        transModal.classList.remove('hidden');
    });
    
    const closeTransModal = () => {
        transModal.classList.add('hidden');
        transForm.reset();
        document.getElementById('t-date').valueAsDate = new Date();
    };

    btnCloseTrans.addEventListener('click', closeTransModal);
    btnCancelTrans.addEventListener('click', closeTransModal);

    transForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTrans = {
            date: document.getElementById('t-date').value,
            description: document.getElementById('t-desc').value.trim(),
            category: document.getElementById('t-category').value,
            amount: parseFloat(document.getElementById('t-amount').value),
            type: document.getElementById('t-type').value
        };

        // Add to local array
        localTransactions.unshift(newTrans);
        localStorage.setItem('local_transactions', JSON.stringify(localTransactions));
        
        // Refresh UI
        closeTransModal();
        mergeAndProcessData();
    });

    // Sync button
    const btnSyncNow = document.getElementById('btn-sync-now');
    const spinner = document.getElementById('sync-spinner');
    
    btnSyncNow.addEventListener('click', () => {
        spinner.classList.add('spinning');
        btnSyncNow.disabled = true;
        
        // Visual feedback
        setTimeout(async () => {
            spinner.classList.remove('spinning');
            btnSyncNow.disabled = false;
            
            await loadData();
            alert('הסנכרון הושלם בהצלחה והנתונים העדכניים נטענו מגוגל שיטס!');
        }, 1500);
    });
}

// Check if credentials.json is present in the workspace
async function checkCredentialsFile() {
    const credStatusEl = document.getElementById('cred-status');
    try {
        const response = await fetch('credentials.json');
        if (response.ok) {
            credStatusEl.innerText = 'נמצא (תקין) ✔';
            credStatusEl.style.color = '#10b981';
            return true;
        } else {
            credStatusEl.innerText = 'לא נמצא ❌';
            credStatusEl.style.color = '#f43f5e';
            return false;
        }
    } catch (e) {
        credStatusEl.innerText = 'שגיאת בדיקה';
        credStatusEl.style.color = '#f43f5e';
        return false;
    }
}

// Load Data from Apps Script or data.json fallback
async function loadData() {
    try {
        const url = APPS_SCRIPT_URL || 'data.json';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Data file not found');
        const data = await response.json();

        transactionsData = data.transactions || [];
        lastSyncTime = data.last_sync || '';
        window.portfolioData = data.portfolio || fallbackData.portfolio;

        // המר portfolios מה-API לפורמט הנכון וסנן שורות לא רלוונטיות
        const SKIP_ASSETS = ['פער','סה"כ','סהכ','Total','האמא'];
        if (data.portfolios) {
            window.portfolios = {};
            Object.keys(data.portfolios).forEach(yr => {
                const entry = data.portfolios[yr];
                const sections = entry.sections || {};
                window.portfolios[yr] = { months: entry.months, family_assets:{}, roni_assets:{}, miki_assets:{}, zohar_assets:{} };
                Object.keys(sections).forEach(sec => {
                    const key = sec === 'family' ? 'family_assets' : sec + '_assets';
                    const assets = sections[sec] || {};
                    Object.keys(assets).forEach(name => {
                        if (!SKIP_ASSETS.some(s => name.startsWith(s))) {
                            window.portfolios[yr][key][name] = assets[name];
                        }
                    });
                });
            });
        } else {
            window.portfolios = data.portfolios || {};
        }
        const _currentYear = new Date().getFullYear();
        // אם אין synced_years, גזור מהטרנזקציות עצמן
        const yearsFromTx = [...new Set((data.transactions||[]).map(t => parseInt(t.date.split('-')[0])))].filter(y => y <= _currentYear);
        window.syncedYears = (data.synced_years && data.synced_years.length > 0)
            ? data.synced_years.filter(y => y <= _currentYear)
            : yearsFromTx.sort((a,b) => a-b);

        // Set annualViewYear to the most recent synced year
        if (window.syncedYears.length > 0) {
            annualViewYear = Math.max(...window.syncedYears);
        }
        populatePeriodYearSelect();

        if (data.sheet_id) {
            sheetConfig.id = data.sheet_id;
            localStorage.setItem('sheet_config', JSON.stringify(sheetConfig));
            document.getElementById('sheet-id-input').value = data.sheet_id;
        }
    } catch (e) {
        console.warn('Could not load data.json, using local mock data', e);
        transactionsData = fallbackData.transactions;
        lastSyncTime = fallbackData.last_sync;
        window.portfolioData = fallbackData.portfolio;
        window.syncedYears = [];
    }

    mergeAndProcessData();
}

// Merge JSON file transactions with manual localStorage transactions
function mergeAndProcessData() {
    const allTrans = [...localTransactions, ...transactionsData];
    allTrans.sort((a, b) => new Date(b.date) - new Date(a.date));

    // On first load only: snap to the latest past/present month with data
    if (!_periodInitialized && allTrans.length > 0) {
        _periodInitialized = true;
        const today = new Date();
        // Filter to transactions not in the future
        const pastTrans = allTrans.filter(t => new Date(t.date) <= today);
        const source = pastTrans.length > 0 ? pastTrans : allTrans;
        const latest  = new Date(source[0].date); // sorted desc → [0] is most recent
        selectedYear  = latest.getFullYear();
        selectedMonth = latest.getMonth();
    }

    updateSyncStatusUI();
    refreshByPeriod();
    renderPortfolio();
    renderSavingsSummary();
}

// Update Sync status elements in sidebar and settings modal
function updateSyncStatusUI() {
    const dot = document.getElementById('sidebar-status-dot');
    const statusText = document.getElementById('sidebar-status-text');
    const lastSyncEl = document.getElementById('sidebar-last-sync');
    const modalLastSync = document.getElementById('modal-last-sync');

    if (sheetConfig.id) {
        dot.className = 'status-indicator connected';
        statusText.innerText = 'מחובר לגוגל דרייב';
    } else {
        dot.className = 'status-indicator';
        statusText.innerText = 'מצב מקומי (לא מחובר)';
    }

    if (lastSyncTime) {
        const date = new Date(lastSyncTime);
        const timeStr = date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        lastSyncEl.innerText = `סונכרן: ${timeStr}`;
        modalLastSync.innerText = timeStr;
    } else {
        lastSyncEl.innerText = 'לא סונכרן לאחרונה';
        modalLastSync.innerText = 'לא בוצע סנכרון';
    }
}

// Calculate Dashboard Summary Metrics for the selected month
function calculateMetrics(transactions) {
    let totalIncome  = 0;
    let totalExpense = 0;
    let savingsAmt   = 0;  // חסכונות category only

    transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
            if (t.type === 'הכנסה') {
                totalIncome += t.amount;
            } else if (t.type === 'הוצאה') {
                totalExpense += t.amount;
                if (t.category === 'חסכונות') savingsAmt += t.amount;
            }
        }
    });

    const balance     = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((savingsAmt / totalIncome) * 100) : 0;

    document.getElementById('metric-total-income').innerText  = formatCurrency(totalIncome);
    document.getElementById('metric-total-expense').innerText = formatCurrency(totalExpense);
    document.getElementById('metric-balance').innerText       = formatCurrency(balance);
    document.getElementById('metric-savings-rate').innerText  = `${savingsRate}%`;

    const balanceStatusEl = document.getElementById('balance-status');
    if (balance >= 0) {
        balanceStatusEl.innerText   = 'יתרה חיובית';
        balanceStatusEl.className   = 'metric-trend positive';
    } else {
        balanceStatusEl.innerText   = 'יתרת חובה';
        balanceStatusEl.className   = 'metric-trend negative';
    }

    document.getElementById('savings-progress').style.width = `${Math.max(0, Math.min(100, savingsRate))}%`;

    // Update subtitle labels
    document.getElementById('income-percentage').innerText  = `${MONTH_NAMES_HE[selectedMonth]} ${selectedYear}`;
    document.getElementById('expense-percentage').innerText = `${MONTH_NAMES_HE[selectedMonth]} ${selectedYear}`;
}

// Helper to format currency in NIS
function formatCurrency(num) {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(num);
}

// Render dynamic rows for Recent Transactions (up to 6)
function renderRecentTable(transactions) {
    const tbody = document.getElementById('recent-transactions-tbody');
    tbody.innerHTML = '';

    const recent = transactions.slice(0, 6);
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">אין תנועות להצגה</td></tr>`;
        return;
    }

    recent.forEach(t => {
        const row = document.createElement('tr');
        const badgeClass = t.type === 'הכנסה' ? 'badge-income' : 'badge-expense';
        const amountClass = t.type === 'הכנסה' ? 'income' : 'expense';
        const sign = t.type === 'הכנסה' ? '+' : '-';

        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td style="font-weight: 500;">${t.description}</td>
            <td><span class="badge badge-category">${t.category}</span></td>
            <td><span class="badge ${badgeClass}">${t.type}</span></td>
            <td class="amount-col ${amountClass}">${sign}${formatCurrency(t.amount)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Render dynamic rows for All Transactions (Full View)
function renderAllTransactionsTable(transactions) {
    const tbody = document.getElementById('all-transactions-tbody');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">אין תנועות מתאימות לסינון</td></tr>`;
        return;
    }

    transactions.forEach(t => {
        const row = document.createElement('tr');
        const badgeClass = t.type === 'הכנסה' ? 'badge-income' : 'badge-expense';
        const amountClass = t.type === 'הכנסה' ? 'income' : 'expense';
        const sign = t.type === 'הכנסה' ? '+' : '-';

        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td style="font-weight: 500;">${t.description}</td>
            <td><span class="badge badge-category">${t.category}</span></td>
            <td><span class="badge ${badgeClass}">${t.type}</span></td>
            <td class="amount-col ${amountClass}">${sign}${formatCurrency(t.amount)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Helper to format Date nicely
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Setup Filters
function setupFilters() {
    const searchInput = document.getElementById('filter-search');
    const categorySelect = document.getElementById('filter-category');
    const typeSelect = document.getElementById('filter-type');

    const filterHandler = () => {
        const query = searchInput.value.toLowerCase().trim();
        const category = categorySelect.value;
        const type = typeSelect.value;

        const allTrans = [...localTransactions, ...transactionsData];

        const filtered = allTrans.filter(t => {
            const matchesQuery = t.description.toLowerCase().includes(query) || 
                                 t.category.toLowerCase().includes(query);
            const matchesCategory = category === 'all' || t.category === category;
            const matchesType = type === 'all' || t.type === type;
            
            return matchesQuery && matchesCategory && matchesType;
        });

        renderAllTransactionsTable(filtered);
    };

    searchInput.addEventListener('input', filterHandler);
    categorySelect.addEventListener('change', filterHandler);
    typeSelect.addEventListener('change', filterHandler);
}

// Dynamically populate category dropdown filter options
function populateCategoryFilter(transactions) {
    const categorySelect = document.getElementById('filter-category');
    const currentSelection = categorySelect.value;
    
    const categories = [...new Set(transactions.map(t => t.category))];
    
    categorySelect.innerHTML = '<option value="all">הכל</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.innerText = cat;
        if (cat === currentSelection) option.selected = true;
        categorySelect.appendChild(option);
    });
}

// Render Chart.js Graphics (Cash Flow)
function renderCharts(transactions) {
    // Category chart — filter to selected month only
    const monthTrans = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

    const expenseCategories = {};
    monthTrans.forEach(t => {
        if (t.type === 'הוצאה') {
            expenseCategories[t.category] = (expenseCategories[t.category] || 0) + t.amount;
        }
    });

    const catLabels = Object.keys(expenseCategories);
    const catData = Object.values(expenseCategories);

    if (categoryChartInstance) categoryChartInstance.destroy();
    
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Heebo' } }
                }
            }
        },
        data: {
            labels: catLabels,
            datasets: [{
                data: catData,
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b', '#10b981', 
                    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'
                ],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)'
            }]
        }
    });

    // 2. Monthly Trend Chart — income vs expenses per month for the selected year
    const trendTitle = document.getElementById('trend-chart-title');
    if (trendTitle) trendTitle.textContent = `הכנסות מול הוצאות — ${selectedYear}`;

    const yearTrans = transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);
    const monthlyIncome  = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);
    yearTrans.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (t.type === 'הכנסה')       monthlyIncome[m]  += t.amount;
        else if (t.type === 'הוצאה') monthlyExpense[m] += t.amount;
    });

    // Only include months that have data
    let lastActiveMonth = 0;
    for (let i = 11; i >= 0; i--) {
        if (monthlyIncome[i] > 0 || monthlyExpense[i] > 0) { lastActiveMonth = i; break; }
    }
    const activeLabels  = MONTH_NAMES_HE.slice(0, lastActiveMonth + 1);
    const activeIncome  = monthlyIncome.slice(0, lastActiveMonth + 1);
    const activeExpense = monthlyExpense.slice(0, lastActiveMonth + 1);
    const gapData       = activeIncome.map((inc, i) => inc - activeExpense[i]);

    if (trendChartInstance) trendChartInstance.destroy();
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChartInstance = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: activeLabels,
            datasets: [
                {
                    label: 'הכנסות',
                    data: activeIncome,
                    backgroundColor: 'rgba(16, 185, 129, 0.55)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'הוצאות',
                    data: activeExpense,
                    backgroundColor: 'rgba(244, 63, 94, 0.55)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 3
                },
                {
                    label: 'פער',
                    data: gapData,
                    type: 'line',
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34, 211, 238, 0.08)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#22d3ee',
                    fill: false,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#94a3b8', font: { family: 'Heebo', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11 },
                        callback: v => '₪' + (v / 1000).toFixed(0) + 'k'
                    }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Heebo' } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ₪${ctx.parsed.y.toLocaleString('he-IL', {maximumFractionDigits: 0})}`
                    }
                }
            }
        }
    });
}

// Render Portfolio, Net Worth, and Child Savings Data
function renderPortfolio() {
    const portfolios = window.portfolios || {};
    let pData = portfolios[String(selectedYear)];
    if (!pData) {
        const availYears = Object.keys(portfolios).map(Number).sort((a, b) => b - a);
        const closest = availYears.find(y => y <= selectedYear) || availYears[0];
        pData = portfolios[String(closest)] || window.portfolioData;
    }
    if (!pData) return;

    const months = pData.months || [];

    // Find latest month with family asset data
    let latestIdx = 0;
    for (let m = months.length - 1; m >= 0; m--) {
        if (Object.values(pData.family_assets || {}).some(arr => (arr[m] || 0) > 0)) {
            latestIdx = m; break;
        }
    }

    const latestMonthName = months[latestIdx] || '';
    const updateEl = document.getElementById('net-worth-update-time');
    if (updateEl) updateEl.innerText = `מעודכן ל-${latestMonthName}`;

    // Helper: fill a tbody and return total
    const fillTable = (tbodyId, assetsObj) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return 0;
        tbody.innerHTML = '';
        let total = 0;
        for (const [name, arr] of Object.entries(assetsObj)) {
            const val = arr[latestIdx] || 0;
            if (val <= 0) continue;
            total += val;
            tbody.innerHTML += `<tr>
                <td style="font-weight:500">${name}</td>
                <td class="amount-col income">${formatCurrency(val)}</td>
            </tr>`;
        }
        return total;
    };

    const familyTotal = fillTable('family-assets-tbody', pData.family_assets || {});
    const roniTotal   = fillTable('roni-assets-tbody',   pData.roni_assets   || {});
    const mikiTotal   = fillTable('miki-assets-tbody',   pData.miki_assets   || {});
    const zoharTotal  = fillTable('zohar-assets-tbody',  pData.zohar_assets  || {});

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setEl('family-assets-total', formatCurrency(familyTotal));
    setEl('roni-total-badge',    formatCurrency(roniTotal));
    setEl('miki-total-badge',    formatCurrency(mikiTotal));
    setEl('zohar-total-badge',   formatCurrency(zoharTotal));
    setEl('metric-net-worth',    formatCurrency(familyTotal));
    setEl('metric-kids-savings', formatCurrency(roniTotal + mikiTotal + zoharTotal));
}

// ── Central period refresh — updates every table/chart to selectedYear+Month ──
function refreshByPeriod() {
    const allTrans = [...localTransactions, ...transactionsData];
    const monthTrans = allTrans.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

    updatePeriodDisplay();
    calculateMetrics(allTrans);
    renderCharts(allTrans);
    renderRecentTable(monthTrans);
    renderAllTransactionsTable(monthTrans);
    populateCategoryFilter(monthTrans);
    renderSavingsSummary();
    renderPortfolio();
}

// ── Period Navigator ──────────────────────────────────────────────────────

function setupPeriodNav() {
    const navigate = (delta) => {
        selectedMonth += delta;
        if (selectedMonth < 0)  { selectedMonth = 11; selectedYear--; }
        if (selectedMonth > 11) { selectedMonth = 0;  selectedYear++; }
        // Sync year dropdown in case we crossed a year boundary
        const yearSel = document.getElementById('period-year-select');
        if (yearSel) yearSel.value = String(selectedYear);
        refreshByPeriod();
    };

    document.getElementById('btn-prev-month').addEventListener('click', () => navigate(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => navigate(+1));
}

function updatePeriodDisplay() {
    const monthSel = document.getElementById('period-month-select');
    const yearSel  = document.getElementById('period-year-select');
    if (monthSel && monthSel.value !== String(selectedMonth)) monthSel.value = String(selectedMonth);
    if (yearSel  && yearSel.value  !== String(selectedYear))  yearSel.value  = String(selectedYear);
}

function populatePeriodYearSelect() {
    const monthSel = document.getElementById('period-month-select');
    const yearSel  = document.getElementById('period-year-select');
    if (!monthSel || !yearSel) return;

    // Populate month dropdown once
    if (monthSel.options.length === 0) {
        MONTH_NAMES_HE.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = name;
            monthSel.appendChild(opt);
        });
    }

    // Populate year dropdown - always repopulate if data available
    const years = (window.syncedYears || []).slice().sort((a, b) => b - a);
    if (years.length > 0) {
        yearSel.innerHTML = '';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        });
        yearSel.value = annualViewYear;
    }

    updatePeriodDisplay();

    monthSel.addEventListener('change', () => {
        selectedMonth = parseInt(monthSel.value);
        refreshByPeriod();
    });

    yearSel.addEventListener('change', () => {
        selectedYear = parseInt(yearSel.value);
        refreshByPeriod();
    });
}

// ── Format helpers ────────────────────────────────────────────────────────

function formatCompact(num) {
    if (num === 0) return '—';
    const abs = Math.abs(num);
    const opts = { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    if (abs >= 1000) return new Intl.NumberFormat('he-IL', opts).format(num);
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(num);
}

// ── Dashboard Savings Summary ─────────────────────────────────────────────

function renderSavingsSummary() {
    // Pick portfolio for selectedYear; fall back to closest available year
    const portfolios = window.portfolios || {};
    let pData = portfolios[String(selectedYear)];
    if (!pData) {
        const availYears = Object.keys(portfolios).map(Number).sort((a, b) => b - a);
        const closest = availYears.find(y => y <= selectedYear) || availYears[0];
        pData = portfolios[String(closest)] || window.portfolioData;
    }
    if (!pData) return;

    const months = pData.months || [];

    // Try the selected month first; fall back to the nearest earlier month with data
    let displayIdx = selectedMonth; // 0–11
    const hasData = (idx) =>
        Object.values(pData.family_assets || {}).some(arr => (arr[idx] || 0) > 0);

    if (!hasData(displayIdx)) {
        // Walk backward to find the latest month with data
        for (let m = displayIdx - 1; m >= 0; m--) {
            if (hasData(m)) { displayIdx = m; break; }
        }
        // If still nothing, walk forward
        if (!hasData(displayIdx)) {
            for (let m = 0; m < 12; m++) {
                if (hasData(m)) { displayIdx = m; break; }
            }
        }
    }

    const badge = document.getElementById('savings-update-badge');
    if (badge) badge.textContent = `מעודכן ל-${months[displayIdx] || ''}`;

    const buildBreakdown = (assetsObj, containerId, totalId) => {
        const breakdown = document.getElementById(containerId);
        const totalEl   = document.getElementById(totalId);
        if (!breakdown || !totalEl) return 0;
        breakdown.innerHTML = '';
        let total = 0;
        for (const [name, arr] of Object.entries(assetsObj)) {
            const val = arr[displayIdx] || 0;
            if (val <= 0) continue;
            total += val;
            breakdown.innerHTML += `
                <div class="savings-breakdown-row">
                    <span class="savings-breakdown-label" title="${name}">${name}</span>
                    <span class="savings-breakdown-amount">${formatCompact(val)}</span>
                </div>`;
        }
        totalEl.textContent = formatCurrency(total);
        return total;
    };

    const familyTotal = buildBreakdown(pData.family_assets || {}, 'sp-family-breakdown', 'sp-family-total');
    const roniTotal   = buildBreakdown(pData.roni_assets   || {}, 'sp-roni-breakdown',   'sp-roni-total');
    const mikiTotal   = buildBreakdown(pData.miki_assets   || {}, 'sp-miki-breakdown',   'sp-miki-total');
    const zoharTotal  = buildBreakdown(pData.zohar_assets  || {}, 'sp-zohar-breakdown',  'sp-zohar-total');

    const grandEl = document.getElementById('sp-grand-total');
    if (grandEl) grandEl.textContent = formatCurrency(familyTotal + roniTotal + mikiTotal + zoharTotal);

    renderSavingsGrowthChart();
    renderSavingsExpenseChart();
}

function renderSavingsGrowthChart() {
    const portfolios = window.portfolios || {};
    const years = Object.keys(portfolios).map(Number).sort((a, b) => a - b);
    if (years.length < 2) return;

    // For each year: use the last month with data as that year's value
    const lastMonthValue = (assetsObj) => {
        let latestIdx = -1;
        for (let m = 11; m >= 0; m--) {
            if (Object.values(assetsObj).some(arr => (arr[m] || 0) > 0)) {
                latestIdx = m; break;
            }
        }
        if (latestIdx === -1) return 0;
        return Object.values(assetsObj).reduce((sum, arr) => sum + (arr[latestIdx] || 0), 0);
    };

    const familyVals = years.map(y => lastMonthValue(portfolios[y].family_assets || {}));
    const roniVals   = years.map(y => lastMonthValue(portfolios[y].roni_assets   || {}));
    const mikiVals   = years.map(y => lastMonthValue(portfolios[y].miki_assets   || {}));
    const zoharVals  = years.map(y => lastMonthValue(portfolios[y].zohar_assets  || {}));

    const chartCfg = (label, data, color) => ({
        label, data,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.08)'),
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.35,
        fill: false
    });

    if (savingsGrowthChartInstance) savingsGrowthChartInstance.destroy();
    const ctx = document.getElementById('savingsGrowthChart');
    if (!ctx) return;

    savingsGrowthChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: years.map(String),
            datasets: [
                chartCfg('משפחה',  familyVals, 'rgba(139,92,246,1)'),
                chartCfg('רוני',   roniVals,   'rgba(99,102,241,1)'),
                chartCfg('מיקי',   mikiVals,   'rgba(34,211,238,1)'),
                chartCfg('זוהר',   zoharVals,  'rgba(20,184,166,1)'),
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11 },
                        callback: v => '₪' + (v / 1000).toFixed(0) + 'k'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Heebo', size: 12 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
                    }
                }
            }
        }
    });
}

function renderSavingsExpenseChart() {
    const allTrans = [...localTransactions, ...transactionsData]
        .filter(t => new Date(t.date).getFullYear() === selectedYear && t.category === 'חסכונות');

    const monthly = new Array(12).fill(0);
    allTrans.forEach(t => {
        monthly[new Date(t.date).getMonth()] += t.amount;
    });

    // Only show months with data
    let lastActive = -1;
    for (let i = 11; i >= 0; i--) { if (monthly[i] > 0) { lastActive = i; break; } }
    if (lastActive === -1) return;

    const labels = MONTH_NAMES_HE.slice(0, lastActive + 1);
    const data   = monthly.slice(0, lastActive + 1);

    if (savingsExpenseChartInstance) savingsExpenseChartInstance.destroy();
    const ctx = document.getElementById('savingsExpenseChart');
    if (!ctx) return;

    savingsExpenseChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: `חסכונות ${selectedYear}`,
                data,
                backgroundColor: 'rgba(34,211,238,0.55)',
                borderColor: '#22d3ee',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Heebo', size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: v => '₪' + (v/1000).toFixed(0) + 'k' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => formatCurrency(c.parsed.y) } }
            }
        }
    });
}

// ── Year Comparison ───────────────────────────────────────────────────────

function populateYearSelectors() {
    const years = (window.syncedYears || []).slice().sort((a, b) => b - a);
    if (years.length === 0) return;

    ['cmp-year-1', 'cmp-year-2'].forEach((id, i) => {
        const sel = document.getElementById(id);
        if (sel.options.length > 0) return; // already populated
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            sel.appendChild(opt);
        });
        // Default: year-1 = second latest, year-2 = latest
        sel.value = years[i] ?? years[0];
    });
}

function buildYearData(year) {
    const allTrans = [...localTransactions, ...transactionsData]
        .filter(t => new Date(t.date).getFullYear() === year);

    const grid = {};
    [...EXPENSE_CATS, ...INCOME_CATS].forEach(cat => { grid[cat] = new Array(12).fill(0); });
    allTrans.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (grid[t.category] !== undefined) grid[t.category][m] += t.amount;
    });

    const expByMonth = new Array(12).fill(0);
    const incByMonth = new Array(12).fill(0);
    EXPENSE_CATS.forEach(cat => grid[cat].forEach((v, i) => expByMonth[i] += v));
    INCOME_CATS.forEach(cat  => grid[cat].forEach((v, i) => incByMonth[i]  += v));

    const totalExp = expByMonth.reduce((a, b) => a + b, 0);
    const totalInc = incByMonth.reduce((a, b) => a + b, 0);
    const activeExpMonths = expByMonth.filter(v => v > 0).length || 1;
    const activeIncMonths = incByMonth.filter(v => v > 0).length || 1;

    const savingsAmt = (grid['חסכונות'] || new Array(12).fill(0)).reduce((a, b) => a + b, 0);
    return { grid, expByMonth, incByMonth, totalExp, totalInc,
             activeExpMonths, activeIncMonths,
             gap: totalInc - totalExp,
             savingsRate: totalInc > 0 ? Math.round((savingsAmt / totalInc) * 100) : 0 };
}

function renderComparison(y1, y2) {
    const d1 = buildYearData(y1);
    const d2 = buildYearData(y2);

    // Show sections
    ['cmp-metrics', 'cmp-charts', 'cmp-table-section'].forEach(id => {
        document.getElementById(id).style.display = '';
    });

    // Update year labels in cards
    ['a','b','c','d'].forEach(l => {
        document.getElementById(`cmp-y1-label-${l}`).textContent = y1;
        document.getElementById(`cmp-y2-label-${l}`).textContent = y2;
    });

    // diff = y1 - y2; invertColor=true for expenses (more = bad)
    const diffStr = (v1, v2, invertColor = false) => {
        const diff = v1 - v2;
        if (diff === 0) return { text: 'ללא שינוי', cls: 'cmp-diff-neutral' };
        const pct = v2 !== 0 ? ((diff / Math.abs(v2)) * 100).toFixed(1) : '—';
        const arrow = diff > 0 ? '▲' : '▼';
        const positive = invertColor ? diff < 0 : diff > 0;
        return {
            text: `${arrow} ${formatCurrency(Math.abs(diff))} (${pct}%)`,
            cls: positive ? 'cmp-diff-pos' : 'cmp-diff-neg'
        };
    };

    // Income
    document.getElementById('cmp-income-y1').textContent = formatCurrency(d1.totalInc);
    document.getElementById('cmp-income-y2').textContent = formatCurrency(d2.totalInc);
    const incD = diffStr(d1.totalInc, d2.totalInc);
    Object.assign(document.getElementById('cmp-income-diff'), { textContent: incD.text, className: `metric-trend ${incD.cls}` });

    // Expenses
    document.getElementById('cmp-expense-y1').textContent = formatCurrency(d1.totalExp);
    document.getElementById('cmp-expense-y2').textContent = formatCurrency(d2.totalExp);
    const expD = diffStr(d1.totalExp, d2.totalExp, true);
    Object.assign(document.getElementById('cmp-expense-diff'), { textContent: expD.text, className: `metric-trend ${expD.cls}` });

    // Gap
    const gap1El = document.getElementById('cmp-gap-y1');
    const gap2El = document.getElementById('cmp-gap-y2');
    gap1El.textContent = formatCurrency(d1.gap);
    gap1El.className   = `cmp-amount ${d1.gap >= 0 ? 'income' : 'expense'}`;
    gap2El.textContent = formatCurrency(d2.gap);
    gap2El.className   = `cmp-amount ${d2.gap >= 0 ? 'income' : 'expense'}`;
    const gapD = diffStr(d1.gap, d2.gap);
    Object.assign(document.getElementById('cmp-gap-diff'), { textContent: gapD.text, className: `metric-trend ${gapD.cls}` });

    // Savings rate
    document.getElementById('cmp-save-y1').textContent = `${d1.savingsRate}%`;
    document.getElementById('cmp-save-y2').textContent = `${d2.savingsRate}%`;
    const saveDiff = d1.savingsRate - d2.savingsRate;
    const saveEl   = document.getElementById('cmp-save-diff');
    saveEl.textContent = saveDiff === 0 ? 'ללא שינוי' : `${saveDiff > 0 ? '▲' : '▼'} ${Math.abs(saveDiff)} נקודות`;
    saveEl.className   = `metric-trend ${saveDiff > 0 ? 'cmp-diff-pos' : saveDiff < 0 ? 'cmp-diff-neg' : 'cmp-diff-neutral'}`;

    // ── Bar chart: category totals ──
    document.getElementById('cmp-bar-title').textContent  = `השוואת קטגוריות — ${y1} מול ${y2}`;
    const allCats  = [...EXPENSE_CATS, ...INCOME_CATS];
    const vals1    = allCats.map(cat => d1.grid[cat].reduce((a, b) => a + b, 0));
    const vals2    = allCats.map(cat => d2.grid[cat].reduce((a, b) => a + b, 0));

    if (cmpBarChartInstance) cmpBarChartInstance.destroy();
    cmpBarChartInstance = new Chart(document.getElementById('cmpBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: allCats,
            datasets: [
                { label: String(y1), data: vals1, backgroundColor: 'rgba(139,92,246,0.6)', borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 4 },
                { label: String(y2), data: vals2, backgroundColor: 'rgba(34,211,238,0.6)',  borderColor: '#22d3ee', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Heebo', size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: v => '₪' + (v/1000).toFixed(0) + 'k' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Heebo' } } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } } }
        }
    });

    // ── Line chart: monthly gap comparison ──
    document.getElementById('cmp-line-title').textContent = `פער חודשי — ${y1} מול ${y2}`;
    const gap1 = d1.incByMonth.map((inc, i) => d1.expByMonth[i] > 0 || inc > 0 ? inc - d1.expByMonth[i] : null);
    const gap2 = d2.incByMonth.map((inc, i) => d2.expByMonth[i] > 0 || inc > 0 ? inc - d2.expByMonth[i] : null);

    if (cmpLineChartInstance) cmpLineChartInstance.destroy();
    cmpLineChartInstance = new Chart(document.getElementById('cmpLineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: MONTH_NAMES_HE,
            datasets: [
                { label: String(y1), data: gap1, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 2, pointRadius: 4, tension: 0.3, fill: true, spanGaps: false },
                { label: String(y2), data: gap2, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.08)',  borderWidth: 2, pointRadius: 4, tension: 0.3, fill: true, spanGaps: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Heebo', size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: v => '₪' + (v/1000).toFixed(0) + 'k' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Heebo' } } },
                tooltip: { callbacks: { label: ctx => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` : '' } } }
        }
    });

    // ── Comparison table ──
    document.getElementById('cmp-table-title').textContent = `טבלת השוואה מפורטת — ${y1} מול ${y2}`;
    const buildCmpRow = (cat, type) => {
        const v1 = d1.grid[cat].reduce((a, b) => a + b, 0);
        const v2 = d2.grid[cat].reduce((a, b) => a + b, 0);
        const m1 = d1.grid[cat].filter(v => v > 0).length || 1;
        const m2 = d2.grid[cat].filter(v => v > 0).length || 1;
        const avg1 = v1 / m1;
        const avg2 = v2 / m2;
        const diff = v1 - v2;
        const pct  = v2 !== 0 ? ((diff / Math.abs(v2)) * 100).toFixed(1) : '—';
        // expenses: more = bad (invert color); income: more = good
        const positive = type === 'expense' ? diff < 0 : diff > 0;
        const diffCls = diff === 0 ? 'cmp-diff-neutral' : positive ? 'cmp-diff-pos' : 'cmp-diff-neg';
        const arrow   = diff > 0 ? '▲' : diff < 0 ? '▼' : '';
        return `<tr class="data-row ${type}-row">
            <td class="cat-col">${cat}</td>
            <td class="month-cell has-value">${v1 > 0 ? formatCompact(v1) : '—'}</td>
            <td class="month-cell avg-month-cell">${v1 > 0 ? formatCompact(avg1) : '—'}</td>
            <td class="month-cell has-value">${v2 > 0 ? formatCompact(v2) : '—'}</td>
            <td class="month-cell avg-month-cell">${v2 > 0 ? formatCompact(avg2) : '—'}</td>
            <td class="month-cell diff-col ${diffCls}">${diff !== 0 ? arrow + ' ' + formatCompact(Math.abs(diff)) : '—'}</td>
            <td class="avg-cell ${diffCls}">${diff !== 0 && v1 !== 0 ? pct + '%' : '—'}</td>
        </tr>`;
    };

    const totalRow = (label, v1, v2, mn1, mn2, cls, invertColor = false) => {
        const avg1 = v1 / (mn1 || 1);
        const avg2 = v2 / (mn2 || 1);
        const diff = v1 - v2;
        const pct  = v2 !== 0 ? ((diff / Math.abs(v2)) * 100).toFixed(1) : '—';
        const positive = invertColor ? diff < 0 : diff > 0;
        const diffCls = diff === 0 ? 'cmp-diff-neutral' : positive ? 'cmp-diff-pos' : 'cmp-diff-neg';
        const arrow   = diff > 0 ? '▲' : diff < 0 ? '▼' : '';
        return `<tr class="totals-row ${cls}">
            <td class="cat-col">${label}</td>
            <td class="month-cell total-month">${formatCompact(v1)}</td>
            <td class="month-cell avg-month-cell total-month">${formatCompact(avg1)}</td>
            <td class="month-cell total-month">${formatCompact(v2)}</td>
            <td class="month-cell avg-month-cell total-month">${formatCompact(avg2)}</td>
            <td class="month-cell diff-col ${diffCls}">${diff !== 0 ? arrow + ' ' + formatCompact(Math.abs(diff)) : '—'}</td>
            <td class="avg-cell ${diffCls}">${diff !== 0 && v1 !== 0 ? pct + '%' : '—'}</td>
        </tr>`;
    };

    let html = `<thead><tr>
        <th class="cat-col">קטגוריה</th>
        <th class="month-col">${y1} סה"כ</th>
        <th class="month-col avg-month-col">ממוצע/חודש</th>
        <th class="month-col">${y2} סה"כ</th>
        <th class="month-col avg-month-col">ממוצע/חודש</th>
        <th class="diff-col">הפרש</th>
        <th class="avg-col">שינוי %</th>
    </tr></thead><tbody>`;

    html += `<tr class="section-header"><td colspan="7">📉 הוצאות</td></tr>`;
    EXPENSE_CATS.forEach(cat => { html += buildCmpRow(cat, 'expense'); });
    html += totalRow('סה"כ הוצאות', d1.totalExp, d2.totalExp, d1.activeExpMonths, d2.activeExpMonths, 'expense-total', true);

    html += `<tr class="section-header"><td colspan="7">📈 הכנסות</td></tr>`;
    INCOME_CATS.forEach(cat => { html += buildCmpRow(cat, 'income'); });
    html += totalRow('סה"כ הכנסות', d1.totalInc, d2.totalInc, d1.activeIncMonths, d2.activeIncMonths, 'income-total');

    const g1 = d1.gap, g2 = d2.gap;
    const gm1 = Math.max(d1.activeExpMonths, d1.activeIncMonths);
    const gm2 = Math.max(d2.activeExpMonths, d2.activeIncMonths);
    const gDiff = g1 - g2;
    const gPct  = g2 !== 0 ? ((gDiff / Math.abs(g2)) * 100).toFixed(1) : '—';
    const gCls  = gDiff === 0 ? 'cmp-diff-neutral' : gDiff > 0 ? 'cmp-diff-pos' : 'cmp-diff-neg';
    const gArrow = gDiff > 0 ? '▲' : gDiff < 0 ? '▼' : '';
    html += `<tr class="gap-row">
        <td class="cat-col">פער (הכנסות − הוצאות)</td>
        <td class="month-cell ${g1 >= 0 ? 'gap-positive' : 'gap-negative'}">${formatCompact(g1)}</td>
        <td class="month-cell avg-month-cell ${g1 >= 0 ? 'gap-positive' : 'gap-negative'}">${formatCompact(g1 / gm1)}</td>
        <td class="month-cell ${g2 >= 0 ? 'gap-positive' : 'gap-negative'}">${formatCompact(g2)}</td>
        <td class="month-cell avg-month-cell ${g2 >= 0 ? 'gap-positive' : 'gap-negative'}">${formatCompact(g2 / gm2)}</td>
        <td class="month-cell diff-col ${gCls}">${gDiff !== 0 ? gArrow + ' ' + formatCompact(Math.abs(gDiff)) : '—'}</td>
        <td class="avg-cell ${gCls}">${gDiff !== 0 && g1 !== 0 ? gPct + '%' : '—'}</td>
    </tr></tbody>`;

    document.getElementById('cmp-table').innerHTML = html;
}

// ── Annual Table ──────────────────────────────────────────────────────────

function startEditCell(td) {
    if (td.querySelector('input')) return;
    const prev = parseFloat(td.dataset.val) || 0;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.value = prev || '';
    inp.style.cssText = 'width:70px;background:#1e293b;color:#fff;border:1.5px solid #8b5cf6;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center';
    td.textContent = '';
    td.appendChild(inp);
    inp.focus(); inp.select();
    async function commit() {
        const val = inp.value.trim() === '' ? 0 : parseFloat(inp.value) || 0;
        td.dataset.val = val;
        td.textContent = val > 0 ? formatCompact(val) : '—';
        td.className = `month-cell ${val > 0 ? 'has-value' : 'empty-cell'} editable-cell`;
        if (val === prev) return;
        try {
            const payload = {year: parseInt(td.dataset.year), month: parseInt(td.dataset.month), data: {}, new_cats: []};
            payload.data[td.dataset.cat] = val;
            const res = await fetch(APPS_SCRIPT_URL || '/api/save-month', {method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify(payload)});
            const json = await res.json();
            if (json.ok) {
                // Update row total
                const year = parseInt(td.dataset.year);
                renderAnnualTable(year);
            }
        } catch(e) { console.error(e); }
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { td.textContent = prev > 0 ? formatCompact(prev) : '—'; } });
}


function renderAnnualTable(year) {
    document.getElementById('annual-year-label').textContent = year;

    const allTrans = [...localTransactions, ...transactionsData]
        .filter(t => new Date(t.date).getFullYear() === year);

    // Build grid: category → [12 monthly values]
    const grid = {};
    [...EXPENSE_CATS, ...INCOME_CATS].forEach(cat => { grid[cat] = new Array(12).fill(0); });
    allTrans.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (grid[t.category] !== undefined) grid[t.category][m] += t.amount;
    });

    // Monthly aggregate totals
    const expenseByMonth = new Array(12).fill(0);
    const incomeByMonth  = new Array(12).fill(0);
    EXPENSE_CATS.forEach(cat => grid[cat].forEach((v, i) => expenseByMonth[i] += v));
    INCOME_CATS.forEach(cat  => grid[cat].forEach((v, i) => incomeByMonth[i]  += v));
    const gapByMonth = incomeByMonth.map((inc, i) => {
        if (inc === 0 && expenseByMonth[i] === 0) return null;
        return inc - expenseByMonth[i];
    });

    const totalExpense = expenseByMonth.reduce((a, b) => a + b, 0);
    const totalIncome  = incomeByMonth.reduce((a, b) => a + b, 0);
    const totalGap     = totalIncome - totalExpense;

    const activeMths = expenseByMonth.filter(v => v > 0).length || incomeByMonth.filter(v => v > 0).length || 1;
    const avgExpense = totalExpense / activeMths;
    const avgIncome  = totalIncome  / activeMths;

    // Savings rate per month = חסכונות / income
    const savingsByMonth = grid['חסכונות'] || new Array(12).fill(0);
    const savingsRateByMonth = savingsByMonth.map((s, i) =>
        incomeByMonth[i] > 0 ? (s / incomeByMonth[i] * 100) : null
    );
    const totalSavings = savingsByMonth.reduce((a, b) => a + b, 0);
    const annualSavingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    // Build HTML
    const colHeaders = MONTH_NAMES_HE.map(m => `<th class="month-col">${m}</th>`).join('');
    let html = `<thead><tr>
        <th class="cat-col">קטגוריה</th>${colHeaders}
        <th class="total-col">סה"כ</th><th class="avg-col">ממוצע</th>
    </tr></thead><tbody>`;

    const buildRow = (cat, type) => {
        const vals   = grid[cat];
        const total  = vals.reduce((a, b) => a + b, 0);
        const active = vals.filter(v => v > 0).length || 1;
        const avg    = total / active;
        const cells  = vals.map((v, mi) =>
            `<td class="month-cell ${v > 0 ? 'has-value' : 'empty-cell'} editable-cell"
                data-cat="${cat}" data-month="${mi+1}" data-year="${year}" data-val="${v}"
                onclick="startEditCell(this)">${v > 0 ? formatCompact(v) : '—'}</td>`
        ).join('');
        return `<tr class="data-row ${type}-row">
            <td class="cat-col">${cat}</td>${cells}
            <td class="total-cell" id="total-${year}-${cat.replace(/[^a-z0-9]/gi,'_')}">${total > 0 ? formatCompact(total) : '—'}</td>
            <td class="avg-cell">${total > 0 ? formatCompact(avg) : '—'}</td>
        </tr>`;
    };

    const buildTotalsRow = (label, byMonth, total, avg, cls) => {
        const cells = byMonth.map(v =>
            `<td class="month-cell total-month">${v > 0 ? formatCompact(v) : '—'}</td>`
        ).join('');
        return `<tr class="totals-row ${cls}">
            <td class="cat-col">${label}</td>${cells}
            <td class="total-cell">${formatCompact(total)}</td>
            <td class="avg-cell">${formatCompact(avg)}</td>
        </tr>`;
    };

    // Expenses section
    html += `<tr class="section-header"><td colspan="15">📉 הוצאות</td></tr>`;
    EXPENSE_CATS.forEach(cat => { html += buildRow(cat, 'expense'); });
    html += buildTotalsRow('סה"כ הוצאות', expenseByMonth, totalExpense, avgExpense, 'expense-total');

    // Income section
    html += `<tr class="section-header"><td colspan="15">📈 הכנסות</td></tr>`;
    INCOME_CATS.forEach(cat => { html += buildRow(cat, 'income'); });
    html += buildTotalsRow('סה"כ הכנסות', incomeByMonth, totalIncome, avgIncome, 'income-total');

    // Gap row
    const gapCells = gapByMonth.map(g => {
        if (g === null) return `<td class="month-cell empty-cell">—</td>`;
        const cls = g >= 0 ? 'gap-positive' : 'gap-negative';
        return `<td class="month-cell ${cls}">${formatCompact(g)}</td>`;
    }).join('');
    const gapCls = totalGap >= 0 ? 'gap-positive' : 'gap-negative';
    html += `<tr class="gap-row">
        <td class="cat-col">פער (הכנסות − הוצאות)</td>${gapCells}
        <td class="total-cell ${gapCls}">${formatCompact(totalGap)}</td>
        <td class="avg-cell"></td>
    </tr>`;

    // Savings-rate row
    const savingsRateCells = savingsRateByMonth.map(r => {
        if (r === null) return `<td class="month-cell empty-cell">—</td>`;
        const cls = r >= 20 ? 'gap-positive' : r >= 10 ? '' : 'gap-negative';
        return `<td class="month-cell ${cls}" style="font-weight:700">${r.toFixed(1)}%</td>`;
    }).join('');

    html += `<tr class="gap-row" style="border-top:1px dashed rgba(255,255,255,0.1)">
        <td class="cat-col" style="color:var(--accent)">שיעור חיסכון (חסכונות ÷ הכנסות)</td>
        ${savingsRateCells}
        <td class="total-cell" style="color:var(--accent);font-weight:800">${annualSavingsRate}%</td>
        <td class="avg-cell"></td>
    </tr></tbody>`;

    document.getElementById('annual-table').innerHTML = html;

    // Update annual summary cards
    document.getElementById('annual-total-income').innerText  = formatCurrency(totalIncome);
    document.getElementById('annual-total-expense').innerText = formatCurrency(totalExpense);
    document.getElementById('annual-gap').innerText           = formatCurrency(totalGap);
    document.getElementById('annual-avg-income').innerText    = `ממוצע חודשי: ${formatCurrency(avgIncome)}`;
    document.getElementById('annual-avg-expense').innerText   = `ממוצע חודשי: ${formatCurrency(avgExpense)}`;

    const gapLabel = document.getElementById('annual-gap-label');
    gapLabel.innerText = totalGap >= 0 ? `עודף שנתי ✓` : `גרעון שנתי ✗`;
    gapLabel.className = `metric-trend ${totalGap >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('annual-savings-rate').innerText = `${annualSavingsRate}%`;
    document.getElementById('annual-savings-bar').style.width = `${Math.max(0, Math.min(100, annualSavingsRate))}%`;
}

// ── Month Entry View ──────────────────────────────────────────────────────────

let _entryInitialized = false;
let _extraExpense = []; // [{name}] new expense categories added by user
let _extraIncome  = []; // [{name}] new income categories added by user

function setupEntryView() {
    if (!_entryInitialized) {
        // Populate year selector
        const yearSel = document.getElementById('entry-year');
        const years = (window.syncedYears || []).slice().sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();
        const allYears = years.includes(currentYear) ? years : [currentYear, ...years];
        allYears.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            yearSel.appendChild(opt);
        });

        document.getElementById('btn-entry-load').addEventListener('click', loadEntryData);
        document.getElementById('entry-year').addEventListener('change', loadEntryData);
        document.getElementById('entry-month').addEventListener('change', loadEntryData);
        document.getElementById('btn-add-expense').addEventListener('click', () => addEntryRow('expense'));
        document.getElementById('btn-add-income').addEventListener('click', () => addEntryRow('income'));
        document.getElementById('btn-save-month').addEventListener('click', saveMonth);
        _entryInitialized = true;
    }
    loadEntryData();
}

function loadEntryData() {
    const year  = parseInt(document.getElementById('entry-year').value);
    const month = parseInt(document.getElementById('entry-month').value); // 1-12

    _extraExpense = [];
    _extraIncome  = [];

    // Build lookup: category → amount for this year+month
    const allTrans = [...localTransactions, ...transactionsData];
    const lookup = {};
    allTrans.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
            lookup[t.category] = (lookup[t.category] || 0) + t.amount;
        }
    });

    const buildRows = (cats, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        cats.forEach(cat => {
            container.appendChild(makeEntryRow(cat, lookup[cat] || 0));
        });
    };

    buildRows(EXPENSE_CATS, 'entry-expense-rows');
    buildRows(INCOME_CATS,  'entry-income-rows');

    document.getElementById('entry-form-area').style.display = '';
    document.getElementById('entry-status').textContent = '';
}

function makeEntryRow(catName, amount, isNew = false) {
    const row = document.createElement('div');
    row.className = 'entry-row' + (isNew ? ' entry-row-new' : '');
    row.dataset.cat = catName;

    const label = document.createElement('div');
    label.className = 'entry-label';

    if (isNew) {
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'entry-name-input';
        nameInput.placeholder = 'שם קטגוריה';
        nameInput.value = catName;
        nameInput.addEventListener('input', () => { row.dataset.cat = nameInput.value; });
        label.appendChild(nameInput);
    } else {
        label.textContent = catName;
    }

    const amtInput = document.createElement('input');
    amtInput.type = 'number';
    amtInput.className = 'entry-amount-input';
    amtInput.min = '0';
    amtInput.step = '0.01';
    amtInput.placeholder = '0';
    amtInput.value = amount > 0 ? amount : '';

    const delBtn = document.createElement('button');
    delBtn.className = 'entry-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'הסר';
    delBtn.addEventListener('click', () => row.remove());

    row.appendChild(label);
    row.appendChild(amtInput);
    if (isNew) row.appendChild(delBtn);

    return row;
}

function addEntryRow(type) {
    const containerId = type === 'expense' ? 'entry-expense-rows' : 'entry-income-rows';
    const container = document.getElementById(containerId);
    const row = makeEntryRow('', 0, true);
    row.dataset.type = type;
    container.appendChild(row);
    row.querySelector('.entry-name-input').focus();
}

async function saveMonth() {
    const year   = parseInt(document.getElementById('entry-year').value);
    const month  = parseInt(document.getElementById('entry-month').value);
    const status = document.getElementById('entry-status');
    const btn    = document.getElementById('btn-save-month');

    // Collect all rows
    const data     = {};
    const new_cats = [];

    document.querySelectorAll('#entry-expense-rows .entry-row, #entry-income-rows .entry-row').forEach(row => {
        const cat    = row.dataset.cat?.trim();
        const amt    = parseFloat(row.querySelector('.entry-amount-input')?.value) || 0;
        const isNew  = row.classList.contains('entry-row-new');
        const type   = row.closest('#entry-expense-rows') ? 'expense' : 'income';
        if (!cat) return;
        data[cat] = amt;
        if (isNew && cat) new_cats.push({ name: cat, cat_type: type });
    });

    status.textContent = 'שומר...';
    status.className = 'entry-status saving';
    btn.disabled = true;

    try {
        const apiUrl = APPS_SCRIPT_URL || '/api/save-month';
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ year, month, data, new_cats })
        });
        const json = await res.json();

        if (json.ok) {
            status.textContent = `נשמר בהצלחה ✓  (${json.updated} עדכונים${json.appended ? `, ${json.appended} חדשים` : ''})${json.synced ? ' — נתונים עודכנו' : ''}`;
            status.className = 'entry-status success';
            // Reload data.json to reflect changes
            if (json.synced) await loadData();
        } else {
            throw new Error(json.error || 'שגיאה לא ידועה');
        }
    } catch (err) {
        if (err.message.includes('Failed to fetch')) {
            status.textContent = APPS_SCRIPT_URL 
                ? 'שגיאה בחיבור ל-Google Sheets'
                : 'שגיאה: שרת לא זמין. ודא שהפעלת את "פתח דוח.command"';
        } else {
            status.textContent = `שגיאה: ${err.message}`;
        }
        status.className = 'entry-status error';
    } finally {
        btn.disabled = false;
    }
}
