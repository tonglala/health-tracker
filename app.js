// --- Firebase Configuration (Compat) ---
const firebaseConfig = {
    apiKey: "AIzaSyDKrYOLnjPhf7axdoI95php_JVCkgp3IW8",
    authDomain: "healthy-tracker-8740c.firebaseapp.com",
    projectId: "healthy-tracker-8740c",
    storageBucket: "healthy-tracker-8740c.firebasestorage.app",
    messagingSenderId: "78591275759",
    appId: "1:78591275759:web:d9b7e6221bd7235a31211a"
};

// Initialize Firebase (Compat)
// Initialize Firebase (Compat)
try {
    firebase.initializeApp(firebaseConfig);
    var auth = firebase.auth();
    var db = firebase.firestore();
    var provider = new firebase.auth.GoogleAuthProvider();
    console.log("Firebase initialized successfully");
} catch (e) {
    console.error("Firebase Init Error:", e);
    alert("Firebase 初始化失敗 (可能是網路問題): " + e.message);
}

let currentUser = null; // Global User State

// State Management
const STORAGE_KEY = 'pregnancy_tracker_data';
let state = {
    profile: {
        height: 165, // User provided
        startWeight: 64, // User provided
        lmpDate: null, // Will calculate
        dueDate: null
    },
    weights: [],
    meals: []
};

// IOM Guidelines for BMI 18.5-24.9 (Normal)
// Total Gain: 11.5 - 16 kg
// 1st Trimester (0-13w): 0.5 - 2kg total
// 2nd/3rd (14w+): 0.42 kg/week (approx range 0.35 - 0.50)
const GUIDELINES = {
    underweight: { total: [12.5, 18], weekly: [0.44, 0.58] },
    normal: { total: [11.5, 16], weekly: [0.35, 0.50] },
    overweight: { total: [7, 11.5], weekly: [0.23, 0.33] },
    obese: { total: [5, 9], weekly: [0.17, 0.27] }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Check local storage first for immediate render
    loadLocalData();

    // Setup UI
    setupNavigation();
    setupForms();
    setupCalculations();
    setupAuthListeners();

    // Initial Render
    renderAll();
});

// --- Auth & Sync Logic ---
function setupAuthListeners() {
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');

    // Login (Desktop & Mobile)
    const handleLogin = () => {
        auth.signInWithPopup(provider)
            .catch((error) => {
                console.error("Login failed", error);
                alert("登入失敗: " + error.message);
            });
    };
    if (btnLogin) btnLogin.addEventListener('click', handleLogin);
    const btnMobileLogin = document.getElementById('btn-mobile-login');
    if (btnMobileLogin) btnMobileLogin.addEventListener('click', handleLogin);

    // New Header Login Button
    const btnHeaderLogin = document.getElementById('btn-header-login');
    if (btnHeaderLogin) btnHeaderLogin.addEventListener('click', handleLogin);

    // Logout (Desktop & Mobile)
    const handleLogout = () => {
        auth.signOut().then(() => {
            alert("已登出");
            location.reload(); // Reload to clear state
        });
    };
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);
    const btnMobileLogout = document.getElementById('btn-mobile-logout');
    if (btnMobileLogout) btnMobileLogout.addEventListener('click', handleLogout);

    // Header Avatar Click -> Logout (Simple for now)
    const headerUserInfo = document.getElementById('header-user-info');
    if (headerUserInfo) {
        headerUserInfo.addEventListener('click', () => {
            if (confirm('要登出嗎？')) {
                handleLogout();
            }
        });
    }

    // Auth State Change
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            updateAuthUI(user);
            await syncData(); // Sync: Cloud <-> Local
        } else {
            // User is signed out
            currentUser = null;
            updateAuthUI(null);
        }
    });
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('btn-login');
    const userInfo = document.getElementById('user-info');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    // Mobile Elements
    const mobileLoginBtn = document.getElementById('btn-mobile-login');
    const mobileUserInfo = document.getElementById('mobile-user-info');
    const mobileUserPhoto = document.getElementById('mobile-user-photo');
    const mobileUserName = document.getElementById('mobile-user-name');

    // Header Elements
    const headerLoginBtn = document.getElementById('btn-header-login');
    const headerUserInfo = document.getElementById('header-user-info');
    const headerUserPhoto = document.getElementById('header-user-photo');

    if (user) {
        // Desktop Sidebar
        if (loginBtn) loginBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userPhoto) userPhoto.src = user.photoURL;
        if (userName) userName.textContent = user.displayName;

        // Mobile Settings
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        if (mobileUserInfo) mobileUserInfo.style.display = 'block';
        if (mobileUserPhoto) mobileUserPhoto.src = user.photoURL;
        if (mobileUserName) mobileUserName.textContent = user.displayName;

        // Header (Mobile Visible)
        if (headerLoginBtn) headerLoginBtn.style.display = 'none';
        if (headerUserInfo) headerUserInfo.style.display = 'block';
        if (headerUserPhoto) headerUserPhoto.src = user.photoURL;

    } else {
        // Desktop Sidebar
        if (loginBtn) loginBtn.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';

        // Mobile Settings
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
        if (mobileUserInfo) mobileUserInfo.style.display = 'none';

        // Header (Mobile Visible)
        if (headerLoginBtn) headerLoginBtn.style.display = 'flex';
        if (headerUserInfo) headerUserInfo.style.display = 'none';
    }
}

async function syncData() {
    if (!currentUser) return;

    // Compatible Firestore Reference
    const userDocRef = db.collection("users").doc(currentUser.uid);

    try {
        const docSnap = await userDocRef.get();

        if (docSnap.exists) {
            // Cloud data exists -> Pull from Cloud
            console.log("Found cloud data, downloading...");
            state = docSnap.data();
            saveLocalData(); // Update local cache
            renderAll();
            alert(`歡迎回來 ${currentUser.displayName}！資料已同步。`);
        } else {
            // No cloud data -> Check if we have local data to upload
            console.log("No cloud data, checking local...");
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                // Upload local data to cloud
                await userDocRef.set(JSON.parse(localData));
                alert("您的本地資料已成功備份到雲端！");
            } else {
                // New user completely
                await userDocRef.set(state);
            }
        }
    } catch (e) {
        console.error("Sync error:", e);
        alert("資料同步發生錯誤，請檢查網路連線。");
    }
}

// --- Data Persistence ---
function loadLocalData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
    } else {
        // Initial Defaults Logic based on user request
        const targetDate = new Date('2026-01-30');
        const lmp = new Date(targetDate);
        lmp.setDate(targetDate.getDate() - 140);

        if (isNaN(lmp.getTime())) {
            // Fallback if invalid
            lmp = new Date();
            lmp.setDate(lmp.getDate() - 140);
        }
        state.profile.lmpDate = lmp.toISOString().split('T')[0];

        // Add initial weight data point
        state.weights.push({
            id: Date.now(),
            date: lmp.toISOString().split('T')[0], // approx start
            weight: 64,
            type: 'home',
            note: '孕前初始體重'
        });

        // Add current weight data point mentioned
        state.weights.push({
            id: Date.now() + 1,
            date: '2026-01-27',
            weight: 70.1,
            type: 'home',
            note: '早上空腹量'
        });
    }

    // Fill Settings Form
    if (state.profile.height) document.getElementById('profile-height').value = state.profile.height;
    if (state.profile.startWeight) document.getElementById('profile-start-weight').value = state.profile.startWeight;
    if (state.profile.lmpDate) document.getElementById('profile-date-point').value = state.profile.lmpDate;
}

function saveLocalData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function saveData() {
    // 1. Save to Local Storage (Instant)
    saveLocalData();
    renderAll();

    // 2. Save to Cloud (Async)
    if (currentUser) {
        try {
            await db.collection("users").doc(currentUser.uid).set(state);
            console.log("Cloud save success");
        } catch (e) {
            console.error("Cloud save failed", e);
        }
    }
}

function setupNavigation() {
    // Add click listeners to ALL nav items (sidebar + mobile bottom nav)
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        // Remove any existing listeners to avoid duplicates
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        // Add click event
        newItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const sectionId = newItem.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });

        // Add touch event for mobile (more responsive)
        newItem.addEventListener('touchend', (e) => {
            e.preventDefault();
            const sectionId = newItem.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    // Define global showSection for compatibility and logic
    window.showSection = (id) => {
        // Hide all sections
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active-section'));

        // Show target section
        const target = document.getElementById(id);
        if (target) {
            target.classList.add('active-section');
        }

        // Update Nav State for ALL nav items (both sidebar and mobile)
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        // Find all nav items with matching data-section and activate them
        document.querySelectorAll(`.nav-item[data-section="${id}"]`).forEach(nav => {
            nav.classList.add('active');
        });

        if (id === 'dashboard') renderChart();
    };
}

function setupForms() {
    // Weight Form
    document.getElementById('weight-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('weight-value').value);
        const date = document.getElementById('weight-date').value;
        const type = document.querySelector('input[name="weight-type"]:checked').value;
        const note = document.getElementById('weight-note').value;

        // Add to state
        state.weights.push({
            id: Date.now(),
            date,
            weight,
            type,
            note
        });

        state.weights.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveData();

        // Reset
        document.getElementById('weight-value').value = '';
        document.getElementById('weight-note').value = '';
        document.getElementById('type-home').checked = true;
        // Default date to today
        document.getElementById('weight-date').valueAsDate = new Date();
        alert('體重紀錄已儲存');
        showSection('dashboard');
    });

    // Food Form
    document.getElementById('food-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const meal = document.getElementById('food-meal').value;
        const name = document.getElementById('food-name').value;
        const cals = parseInt(document.getElementById('food-calories').value);
        const date = document.getElementById('food-date').value;

        state.meals.push({ id: Date.now(), date, meal, name, cals });
        saveData();
        document.getElementById('food-name').value = '';
        document.getElementById('food-calories').value = '';
        alert('飲食紀錄已加入');
        renderAll(); // Re-render to show new item
    });

    // Re-render list when date changes
    document.getElementById('food-date').addEventListener('change', () => {
        renderLists();
    });

    // Smart Search
    document.getElementById('btn-search-calories').addEventListener('click', () => {
        const query = document.getElementById('food-name').value;
        if (!query) {
            alert('請先輸入食物名稱');
            return;
        }
        // Open Google Search in new tab
        const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' 熱量 卡路里')}`;
        window.open(url, '_blank');
    });

    // Profile Settings Form
    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        state.profile.height = parseFloat(document.getElementById('profile-height').value);
        state.profile.startWeight = parseFloat(document.getElementById('profile-start-weight').value);

        // Check if user selected LMP or Due Date
        const dateMethod = document.getElementById('date-method').value;
        const dateInput = document.getElementById('profile-date-point').value;

        if (dateMethod === 'due') {
            // User entered due date, need to calculate LMP (due date - 280 days)
            const dueDate = new Date(dateInput);
            const lmpDate = new Date(dueDate);
            lmpDate.setDate(dueDate.getDate() - 280); // 40 weeks = 280 days
            state.profile.lmpDate = lmpDate.toISOString().split('T')[0];
        } else {
            // User entered LMP directly
            state.profile.lmpDate = dateInput;
        }

        saveData();
        alert('設定已更新');
    });

    // Set default dates
    document.getElementById('weight-date').valueAsDate = new Date();
    document.getElementById('food-date').valueAsDate = new Date();
}

// Toggle date input hint based on method selection
window.toggleDateInput = () => {
    const method = document.getElementById('date-method').value;
    const hint = document.getElementById('date-hint');

    if (method === 'due') {
        hint.textContent = '輸入預產期,系統會自動倒推計算最後一次月經日期 (預產期 - 280 天)';
    } else {
        hint.textContent = '若妳知道1/30滿20週,建議直接輸入該推算出的 LMP。';
    }
}

function setupCalculations() {
    // Helper to get weeks from LMP
    window.getWeeksPregnant = (dateStr) => {
        if (!state.profile.lmpDate) return 0;
        const lmp = new Date(state.profile.lmpDate);
        const now = dateStr ? new Date(dateStr) : new Date();
        const diffTime = Math.abs(now - lmp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7);
    };

    window.getCurrentDaysPregnant = () => {
        if (!state.profile.lmpDate) return 0;
        const lmp = new Date(state.profile.lmpDate);
        const now = new Date();
        const diffTime = now - lmp;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
}

function renderAll() {
    renderDashboard();
    renderLists();
    renderChart();
}

function renderDashboard() {
    // Days/Weeks
    const days = getCurrentDaysPregnant();
    const weeks = Math.floor(days / 7);
    const dayRemain = days % 7;
    document.getElementById('current-week-display').textContent = `懷孕 ${weeks} 週 ${dayRemain} 天`;

    // BMI Calculation
    const h = state.profile.height / 100;
    const bmi = state.profile.startWeight / (h * h);
    let bmiText = "正常";
    let guide = GUIDELINES.normal;

    if (bmi < 18.5) { bmiText = "過輕"; guide = GUIDELINES.underweight; }
    else if (bmi >= 25) { bmiText = "過重"; guide = GUIDELINES.overweight; }

    document.getElementById('bmi-status-pill').textContent = `孕前 BMI ${bmi.toFixed(1)} (${bmiText})`;
    document.getElementById('gain-advice').textContent = `建議總增重: ${guide.total[0]}-${guide.total[1]}kg`;

    // Weight Stats
    const currentWeightData = state.weights.filter(w => w.type === 'home').slice(-1)[0] || { weight: state.profile.startWeight };
    const currentWeight = currentWeightData.weight;
    const gain = currentWeight - state.profile.startWeight;

    document.getElementById('current-weight-display').textContent = `${currentWeight} kg`;
    document.getElementById('total-gain-display').textContent = `${gain > 0 ? '+' : ''}${gain.toFixed(1)} kg`;

    if (currentWeightData.date) {
        document.getElementById('last-weigh-date').textContent = currentWeightData.date;
    }

    // Calories
    const todayStr = new Date().toISOString().split('T')[0];
    const todayMeals = state.meals.filter(m => m.date === todayStr);
    const totalCals = todayMeals.reduce((acc, m) => acc + m.cals, 0);
    document.getElementById('today-calories-display').textContent = totalCals;

    // Simple calorie target estimation (Harris-Benedict + pregnancy extra)
    // Very rough estimate: BMR * 1.2 + 300 (2nd trimester)
    // BMR = 655 + (9.6 * kg) + (1.8 * cm) - (4.7 * age) -> Age unknown, assume 30
    const bmr = 655 + (9.6 * currentWeight) + (1.8 * state.profile.height) - (4.7 * 30);
    const target = Math.round(bmr * 1.2 + 340); // +340 for 2nd trim
    document.getElementById('target-calories').textContent = target;
}

function renderLists() {
    // Weight List
    const wList = document.getElementById('weight-history-list');
    wList.innerHTML = '';
    // Reverse order for history
    [...state.weights].reverse().forEach(w => {
        const li = document.createElement('li');
        li.className = 'list-item';
        const weeks = getWeeksPregnant(w.date);
        li.innerHTML = `
            <div class="item-info">
                <div class="item-left">
                    <strong>${w.date} (${weeks}週) <span class="tag ${w.type}">${w.type === 'home' ? '家 / 空腹' : '診所 / 飯後'}</span></strong>
                    <small>${w.note || ''}</small>
                </div>
                <span class="item-right">${w.weight} kg</span>
            </div>
            <button class="btn-delete" onclick="deleteWeight(${w.id})" aria-label="刪除">
                <span class="material-icons-round" style="font-size: 18px;">delete</span>
            </button>
        `;
        wList.appendChild(li);
    });

    // Food List
    const fList = document.getElementById('food-history-list');
    fList.innerHTML = '';

    // Get date from input or default to today
    const dateInput = document.getElementById('food-date');
    const selectedDate = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split('T')[0];

    // Update header to show selected date
    const listHeader = document.querySelector('.history-list h3');
    if (listHeader) {
        listHeader.textContent = `${selectedDate} 飲食清單`;
    }

    const todayMeals = state.meals.filter(m => m.date === selectedDate);

    todayMeals.forEach(m => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <div class="item-info">
                <div class="item-left">
                    <strong>${m.name}</strong>
                    <small>${translateMeal(m.meal)}</small>
                </div>
                <span class="item-right">${m.cals} kcal</span>
            </div>
            <button class="btn-delete" onclick="deleteFood(${m.id})" aria-label="刪除">
                <span class="material-icons-round" style="font-size: 18px;">delete</span>
            </button>
        `;
        fList.appendChild(li);
    });

    // Update Daily total
    const dailyTotal = todayMeals.reduce((acc, m) => acc + m.cals, 0);
    document.getElementById('food-list-total').textContent = dailyTotal;
}

// Global function for onclick
window.deleteFood = (id) => {
    if (confirm('確定要刪除這筆紀錄嗎？')) {
        state.meals = state.meals.filter(m => m.id !== id);
        saveData(); // Will sync to cloud if logged in
        renderLists(); // Re-render list
        renderDashboard(); // Update daily total
    }
}

window.deleteWeight = (id) => {
    if (confirm('確定要刪除這筆體重紀錄嗎？')) {
        state.weights = state.weights.filter(w => w.id !== id);
        saveData();
        renderLists();
        renderDashboard(); // Update chart and stats
    }
}

function translateMeal(type) {
    const map = {
        'breakfast': '早餐',
        'lunch': '午餐',
        'dinner': '晚餐',
        'snack': '點心/宵夜'
    };
    return map[type] || type;
}

let chartInstance = null;

function renderChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Generate Ideal Curves (Min and Max)
    // 0-13 weeks: minimal gain (assume linear to 1kg)
    // 14-40 weeks: steady gain
    // We plot points every week from 0 to 40

    // Guideline params
    const h = state.profile.height / 100;
    const bmi = state.profile.startWeight / (h * h);
    let rangeWeek = [0.35, 0.50]; // normal
    let firstTriMax = 2;

    if (bmi >= 25) rangeWeek = [0.23, 0.33]; // overweight

    // Generate ideal line data
    const lmp = new Date(state.profile.lmpDate);
    const minDataPoints = [];
    const maxDataPoints = [];

    for (let w = 0; w <= 40; w++) {
        // Date for this week
        // Date for this week
        const d = new Date(lmp);
        if (isNaN(d.getTime())) {
            console.error("Invalid LMP date for chart");
            continue;
        }
        d.setDate(lmp.getDate() + w * 7);
        const dateStr = d.toISOString().split('T')[0];

        // Calculate ideal weight range
        let minGain = 0;
        let maxGain = 0;

        if (w <= 13) {
            // First trimester: Slow gain
            minGain = 0; // conservative
            maxGain = (w / 13) * firstTriMax;
        } else {
            // Second+
            minGain = 0 + (w - 13) * rangeWeek[0];
            maxGain = firstTriMax + (w - 13) * rangeWeek[1];
        }

        minDataPoints.push({ x: dateStr, y: state.profile.startWeight + minGain });
        maxDataPoints.push({ x: dateStr, y: state.profile.startWeight + maxGain });
    }

    // Process User Data for Chart
    // Filter Home vs Clinic
    const homePoints = state.weights.filter(w => w.type === 'home').map(w => ({ x: w.date, y: w.weight }));
    const clinicPoints = state.weights.filter(w => w.type === 'clinic').map(w => ({ x: w.date, y: w.weight }));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '建議上限',
                    data: maxDataPoints,
                    borderColor: 'rgba(75, 192, 192, 0.2)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: '+1' // fill to next dataset
                },
                {
                    label: '建議下限',
                    data: minDataPoints,
                    borderColor: 'rgba(75, 192, 192, 0.2)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: '家裡測量',
                    data: homePoints,
                    borderColor: '#D6336C',
                    backgroundColor: '#D6336C',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 4,
                    type: 'line'
                },
                {
                    label: '診所測量',
                    data: clinicPoints,
                    backgroundColor: '#868E96',
                    borderColor: '#868E96',
                    pointStyle: 'triangle',
                    pointRadius: 6,
                    showLine: false, // scatter only
                    type: 'line' // mixed type trick
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1.2 : 2, // Taller on mobile
            scales: {
                x: {
                    type: 'time',
                    suggestedMin: state.profile.lmpDate, // Suggest starting from LMP date
                    suggestedMax: new Date(new Date(state.profile.lmpDate).getTime() + 40 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Suggest ending at 40 weeks
                    time: {
                        unit: 'week',
                        parser: 'yyyy-MM-dd', // Explicit date format
                        displayFormats: {
                            week: window.innerWidth < 768 ? 'M/d' : 'MMM d' // Shorter format on mobile
                        },
                        tooltipFormat: 'yyyy-MM-dd'
                    },
                    title: {
                        display: true,
                        text: '日期',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    ticks: {
                        maxRotation: window.innerWidth < 768 ? 45 : 0, // Rotate labels on mobile
                        minRotation: window.innerWidth < 768 ? 45 : 0,
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        maxTicksLimit: window.innerWidth < 768 ? 8 : 15 // Fewer ticks on mobile
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '體重 (kg)',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: window.innerWidth >= 768, // Hide legend on mobile
                    labels: {
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        },
                        usePointStyle: true,
                        padding: window.innerWidth < 768 ? 10 : 15
                    }
                },
                tooltip: {
                    callbacks: {
                        afterBody: (items) => {
                            // Show weeks info
                            const date = new Date(items[0].parsed.x);
                            const w = getWeeksPregnant(date);
                            return `懷孕週數: ${w} 週`;
                        }
                    },
                    titleFont: {
                        size: window.innerWidth < 768 ? 11 : 13
                    },
                    bodyFont: {
                        size: window.innerWidth < 768 ? 10 : 12
                    }
                }
            }
        }
    });

    // Update Analysis Text
    analyzeProgress(homePoints);
}

function analyzeProgress(points) {
    if (points.length < 2) return;
    const last = points[points.length - 1]; // user data
    // Find expected max at this date
    // Simple lookup: approx weeks
    const w = getWeeksPregnant(last.x);
    // ... logic for advice ...
    const adviceBox = document.getElementById('chart-analysis');

    // Very simple check
    // If recent gain > 0.8kg in a week?
    adviceBox.innerHTML = `<strong>體重分析：</strong> 目前約 ${w} 週，體重 ${last.y}kg。<br>
    持續保持紀錄，系統將能更準確分析您的增重速度。`;
}

window.resetAllData = () => {
    if (confirm('確定要刪除所有紀錄並重置嗎？')) {
        localStorage.removeItem(STORAGE_KEY);
        if (currentUser) {
            // Corrected syntax for Compat SDK
            db.collection("users").doc(currentUser.uid).set({})
                .then(() => {
                    console.log("Cloud data cleared");
                    location.reload();
                })
                .catch((e) => {
                    console.error("Error clearing cloud data", e);
                    alert("清除雲端資料失敗");
                });
        } else {
            location.reload();
        }
    }
}
