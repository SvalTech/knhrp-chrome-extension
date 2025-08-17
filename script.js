    document.addEventListener('DOMContentLoaded', () => {
        // --- CONFIGURATION & STATE ---
        const STORAGE_KEYS = {
            tests: 'jeePartTests_v2',
            layout: 'jeeDashboardLayout_v3',
            customCards: 'jeeCustomCards_v3',
            settings: 'jeeDashboardSettings_v1',
            mobileAlertDismissed: 'jeeMobileAlertDismissed_v1',
            cardProps: 'jeeCardProps_v1'
        };

        const AppState = {
            tests: JSON.parse(localStorage.getItem(STORAGE_KEYS.tests)) || {},
            customCards: JSON.parse(localStorage.getItem(STORAGE_KEYS.customCards)) || [],
            layout: JSON.parse(localStorage.getItem(STORAGE_KEYS.layout)) || ['countdown', 'graph', 'tests', 'quote', 'time'],
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) || { theme: 'default', font: "'Inter', sans-serif", bgUrl: '' },
            cardProps: JSON.parse(localStorage.getItem(STORAGE_KEYS.cardProps)) || {},
            chartInstances: {},
            
            save(key) {
                localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(this[key]));
            },
            saveSettings() {
                 localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings));
            }
        };

        const quotes = [
            { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
            { text: "It’s not whether you get knocked down, it’s whether you get up.", author: "Vince Lombardi" },
            { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
            { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
            { text: "Kyu nahi ho rahi padhai?", author: "🥰 Alakh Pandey 🥰" },
        ];

        // --- DOM ELEMENTS ---
        const D = {
            body: document.body,
            dashboardGrid: document.getElementById('dashboard-grid'),
            modals: {
                addCard: document.getElementById('add-card-modal'),
                customize: document.getElementById('customize-modal'),
                info: document.getElementById('info-modal'),
            },
            buttons: {
                addCard: document.getElementById('add-card-btn'),
                cancelAddCard: document.getElementById('cancel-add-card'),
                customize: document.getElementById('customize-btn'),
                closeCustomize: document.getElementById('close-customize'),
                removeBg: document.getElementById('remove-bg-btn'),
                closeAlert: document.getElementById('close-alert-btn'),
                resetDashboard: document.getElementById('reset-dashboard-btn'),
                info: document.getElementById('info-btn'),
                closeInfo: document.getElementById('close-info-modal'),
            },
            forms: {
                newCard: document.getElementById('new-card-form'),
            },
            inputs: {
                cardType: document.getElementById('new-card-type'),
                cardContent: document.getElementById('new-card-content'),
                theme: document.getElementById('theme-select'),
                font: document.getElementById('font-select'),
                bgUrl: document.getElementById('bg-image-url'),
            },
            mobileAlert: document.getElementById('mobile-alert'),
        };

        // --- HELPER FUNCTIONS ---
        const toLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        // --- CARD TYPE DEFINITIONS ---
        const cardTypes = {
            countdown: {
                templateId: 'countdown-template',
                isDefault: true,
                render: (cardEl) => {
                    const diff = new Date("2026-01-22T00:00:00") - new Date();
                    cardEl.querySelector('[data-value="days"]').innerText = Math.floor(diff / 864e5).toString().padStart(2, '0');
                    cardEl.querySelector('[data-value="hours"]').innerText = Math.floor(diff / 36e5 % 24).toString().padStart(2, '0');
                    cardEl.querySelector('[data-value="minutes"]').innerText = Math.floor(diff / 6e4 % 60).toString().padStart(2, '0');
                    cardEl.querySelector('[data-value="seconds"]').innerText = Math.floor(diff / 1e3 % 60).toString().padStart(2, '0');
                }
            },
            time: {
                templateId: 'time-template',
                isDefault: true,
                render: (cardEl) => {
                    const now = new Date();
                    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
                    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                    cardEl.querySelector('[data-value="time"]').textContent = now.toLocaleTimeString('en-US', timeOptions);
                    cardEl.querySelector('[data-value="date"]').textContent = now.toLocaleDateString('en-US', dateOptions);
                }
            },
            graph: {
                templateId: 'graph-template',
                isDefault: true,
                render: (cardEl) => {
                    const graphContainer = cardEl.querySelector('#contribution-graph');
                    graphContainer.innerHTML = '';
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    let currentDate = new Date("2025-01-01T00:00:00");
                    const examDay = new Date("2026-01-22T00:00:00"); examDay.setHours(0, 0, 0, 0);
                    
                    while (currentDate <= examDay) {
                        const dayDiv = document.createElement('div');
                        const tooltip = document.createElement('span');
                        const dateString = toLocalDateString(currentDate);
                        
                        dayDiv.className = 'day';
                        dayDiv.dataset.date = dateString;
                        tooltip.className = 'tooltip';
                        
                        let typeClass = 'day-future', tooltipText = currentDate.toDateString();
                        if (currentDate < today) typeClass = 'day-past';
                        if (currentDate.getTime() === today.getTime()) { typeClass = 'day-today'; tooltipText += ' - Today'; }
                        if (AppState.tests[dateString]) { 
                            typeClass = 'day-part-test';
                            const daysRemaining = Math.ceil((new Date(dateString) - today) / (1000 * 60 * 60 * 24));
                            tooltipText = `${AppState.tests[dateString]} (${daysRemaining} days from now)`;
                        }
                        if (currentDate.getTime() === examDay.getTime()) { typeClass = 'day-exam'; tooltipText += ' - Exam!'; }
                        
                        dayDiv.classList.add(typeClass);
                        tooltip.textContent = tooltipText;
                        dayDiv.appendChild(tooltip);
                        graphContainer.appendChild(dayDiv);
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
            },
            tests: {
                templateId: 'tests-template',
                isDefault: true,
                render: (cardEl) => {
                    const listEl = cardEl.querySelector('#test-list');
                    listEl.innerHTML = '';
                    const sortedDates = Object.keys(AppState.tests).sort();
                    if (sortedDates.length === 0) {
                        listEl.innerHTML = '<li class="text-secondary px-2 text-sm">No tests scheduled.</li>';
                        return;
                    }
                    sortedDates.forEach(date => {
                        const li = document.createElement('li');
                        li.className = 'flex justify-between items-center bg-gray-800 p-2 rounded-md';
                        li.innerHTML = `<div class="flex flex-col"><span class="font-semibold text-sm">${AppState.tests[date]}</span><span class="text-xs text-secondary">${new Date(date + 'T00:00:00').toDateString()}</span></div><button data-date="${date}" class="delete-test-btn text-red-500 hover:text-red-400 font-semibold text-xs">Delete</button>`;
                        listEl.appendChild(li);
                    });
                }
            },
            quote: {
                templateId: 'quote-template',
                isDefault: true,
                render: (cardEl) => {
                    const { text, author } = quotes[Math.floor(Math.random() * quotes.length)];
                    cardEl.querySelector('#quote').textContent = `"${text}"`;
                    cardEl.querySelector('#author').textContent = `- ${author}`;
                }
            },
            note: {
                templateId: 'note-card-template',
                render: (cardEl, cardData) => {
                    cardEl.querySelector('.card-content').textContent = cardData.content;
                }
            },
            todo: {
                templateId: 'todo-card-template',
                render: (cardEl, cardData) => {
                    const listEl = cardEl.querySelector('.todo-list');
                    listEl.innerHTML = '';
                    if (Array.isArray(cardData.content)) {
                        cardData.content.forEach((item, index) => {
                            const li = document.createElement('li');
                            li.className = `flex items-center gap-2 todo-item ${item.completed ? 'completed' : ''}`;
                            li.dataset.index = index;
                            li.innerHTML = `<input type="checkbox" ${item.completed ? 'checked' : ''} class="todo-checkbox bg-gray-900 rounded"><span class="flex-grow text-sm">${item.text}</span><button class="delete-todo-item text-red-500 hover:text-red-400 font-semibold text-xs">×</button>`;
                            listEl.appendChild(li);
                        });
                    }
                }
            },
            'line-graph': {
                templateId: 'line-graph-card-template',
                render: (cardEl, cardData) => {
                    const listEl = cardEl.querySelector('.marks-list');
                    listEl.innerHTML = '';
                    
                    cardData.content.forEach((item, index) => {
                        const li = document.createElement('li');
                        li.className = 'flex justify-between items-center text-xs bg-gray-800 p-1 rounded';
                        li.innerHTML = `<span>${item.name}: <strong>${item.marks} / ${item.maxMarks}</strong></span><button data-index="${index}" class="delete-mark-item text-red-500 px-1">×</button>`;
                        listEl.appendChild(li);
                    });

                    const ctx = cardEl.querySelector('.marks-chart').getContext('2d');
                    if (AppState.chartInstances[cardData.id]) {
                        AppState.chartInstances[cardData.id].destroy();
                    }
                    
                    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
                    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
                    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
                    
                    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
                    gradient.addColorStop(0, `${accentColor}40`);
                    gradient.addColorStop(1, `${accentColor}00`);

                    const maxMarkValue = cardData.content.length > 0 ? Math.max(...cardData.content.map(d => d.maxMarks || 0)) : 300;

                    AppState.chartInstances[cardData.id] = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: cardData.content.map(d => d.name),
                            datasets: [{
                                label: 'Marks',
                                data: cardData.content.map(d => d.marks),
                                borderColor: accentColor,
                                backgroundColor: gradient,
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: accentColor,
                                pointBorderColor: 'var(--card-bg-color)',
                                pointHoverBackgroundColor: '#fff',
                                pointHoverBorderColor: accentColor,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                borderWidth: 2
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, max: maxMarkValue, ticks: { color: textColor }, grid: { color: gridColor } },
                                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
                            }
                        }
                    });
                }
            }
        };

        // --- CORE FUNCTIONS ---
        function renderDashboard() {
            Object.values(AppState.chartInstances).forEach(chart => chart.destroy());
            AppState.chartInstances = {};
            D.dashboardGrid.innerHTML = '';
            
            const customCardIds = AppState.customCards.map(c => c.id);
            AppState.layout = AppState.layout.filter(id => cardTypes[id]?.isDefault || customCardIds.includes(id));
            AppState.customCards.forEach(card => {
                if (!AppState.layout.includes(card.id)) AppState.layout.push(card.id);
            });
            AppState.save('layout');

            AppState.layout.forEach(cardId => {
                const cardData = AppState.customCards.find(c => c.id === cardId);
                const type = cardData ? cardData.type : cardId;
                const cardDef = cardTypes[type];
                if (cardDef) {
                    const template = document.getElementById(cardDef.templateId);
                    const cardNode = template.content.cloneNode(true);
                    const cardEl = cardNode.querySelector('.card');
                    cardEl.dataset.cardId = cardId;
                    
                    const props = AppState.cardProps[cardId] || { colspan: (type === 'graph' || type === 'line-graph') ? 2 : 1 };
                    AppState.cardProps[cardId] = props;
                    if (props.colspan === 2) {
                        cardEl.classList.add('md:col-span-2');
                    }
                    if (cardData) {
                        cardEl.querySelector('.card-title').textContent = cardData.title;
                    }
                    D.dashboardGrid.appendChild(cardNode);
                }
            });

            D.dashboardGrid.querySelectorAll('.card').forEach(cardEl => {
                const cardId = cardEl.dataset.cardId;
                const cardData = AppState.customCards.find(c => c.id === cardId);
                const type = cardData ? cardData.type : cardId;
                const cardDef = cardTypes[type];
                if (cardDef) {
                    cardDef.render(cardEl, cardData);
                }
            });
        }

        function applySettings() {
            document.documentElement.dataset.theme = AppState.settings.theme;
            D.body.style.fontFamily = AppState.settings.font;
            D.body.style.backgroundImage = AppState.settings.bgUrl ? `url(${AppState.settings.bgUrl})` : 'none';
            D.inputs.theme.value = AppState.settings.theme;
            D.inputs.font.value = AppState.settings.font;
            D.inputs.bgUrl.value = AppState.settings.bgUrl;
        }

        // --- EVENT HANDLERS (DELEGATED) ---
        D.dashboardGrid.addEventListener('click', (e) => {
            const cardEl = e.target.closest('.card');
            if (!cardEl) return;
            const cardId = cardEl.dataset.cardId;

            if (cardId === 'quote') cardTypes.quote.render(cardEl);

            if (e.target.closest('.delete-test-btn')) {
                delete AppState.tests[e.target.closest('.delete-test-btn').dataset.date];
                AppState.save('tests');
                renderDashboard();
            }
            if (e.target.classList.contains('day')) {
                const dateString = e.target.dataset.date;
                if (AppState.tests[dateString]) {
                    delete AppState.tests[dateString];
                    AppState.save('tests');
                    renderDashboard();
                } else {
                    const testForm = D.dashboardGrid.querySelector('#add-test-form');
                    if(testForm) {
                        testForm.date.value = dateString;
                        testForm.name.focus();
                    }
                }
            }

            const cardData = AppState.customCards.find(c => c.id === cardId);
            
            if (e.target.closest('.toggle-colspan-btn')) {
                const props = AppState.cardProps[cardId] || { colspan: 1 };
                props.colspan = props.colspan === 2 ? 1 : 2;
                AppState.cardProps[cardId] = props;
                AppState.save('cardProps');
                renderDashboard();
            }
            if (e.target.closest('.delete-card-btn')) {
                AppState.layout = AppState.layout.filter(id => id !== cardId);
                if (cardData) {
                    AppState.customCards = AppState.customCards.filter(c => c.id !== cardId);
                    delete AppState.cardProps[cardId];
                    AppState.save('customCards');
                    AppState.save('cardProps');
                }
                AppState.save('layout');
                renderDashboard();
            }
            if (cardData && cardData.type === 'todo') {
                const itemEl = e.target.closest('.todo-item');
                if (itemEl) {
                    const itemIndex = parseInt(itemEl.dataset.index);
                    if (e.target.closest('.delete-todo-item')) {
                        cardData.content.splice(itemIndex, 1);
                    } else if (e.target.classList.contains('todo-checkbox')) {
                        cardData.content[itemIndex].completed = !cardData.content[itemIndex].completed;
                    }
                    AppState.save('customCards');
                    cardTypes.todo.render(cardEl, cardData);
                }
            }
             if (cardData && cardData.type === 'line-graph' && e.target.closest('.delete-mark-item')) {
                const itemIndex = parseInt(e.target.closest('.delete-mark-item').dataset.index);
                cardData.content.splice(itemIndex, 1);
                AppState.save('customCards');
                cardTypes['line-graph'].render(cardEl, cardData);
            }
        });

        D.dashboardGrid.addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.target;
            const cardEl = form.closest('.card');
            const cardId = cardEl.dataset.cardId;

            if (form.id === 'add-test-form') {
                const { date, name } = form.elements;
                if (date.value && name.value.trim()) {
                    AppState.tests[date.value] = name.value.trim();
                    AppState.save('tests');
                    renderDashboard();
                    form.reset();
                }
            } else if (form.classList.contains('add-todo-form')) {
                const card = AppState.customCards.find(c => c.id === cardId);
                const input = form.querySelector('input');
                if (card && input.value.trim()) {
                    card.content.push({ text: input.value.trim(), completed: false });
                    AppState.save('customCards');
                    cardTypes.todo.render(cardEl, card);
                    input.value = '';
                }
            } else if (form.classList.contains('add-marks-form')) {
                const card = AppState.customCards.find(c => c.id === cardId);
                const { name, marks, maxMarks } = form.elements;
                if (card && name.value.trim() && marks.value && maxMarks.value) {
                    card.content.push({ 
                        name: name.value.trim(), 
                        marks: parseFloat(marks.value),
                        maxMarks: parseFloat(maxMarks.value)
                    });
                    AppState.save('customCards');
                    cardTypes['line-graph'].render(cardEl, card);
                    form.reset();
                }
            }
        });

        // --- MODAL & SETTINGS LISTENERS ---
        D.buttons.addCard.addEventListener('click', () => D.modals.addCard.classList.remove('hidden'));
        D.buttons.cancelAddCard.addEventListener('click', () => D.modals.addCard.classList.add('hidden'));
        D.inputs.cardType.addEventListener('change', (e) => {
            D.inputs.cardContent.style.display = e.target.value === 'note' ? 'block' : 'none';
        });

        D.forms.newCard.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = D.inputs.cardType.value;
            const title = D.forms.newCard.querySelector('input[type="text"]').value.trim();
            if (!title) return;
            
            const newCard = {
                id: `custom-${Date.now()}`,
                type,
                title,
                content: type === 'note' ? D.inputs.cardContent.value.trim() : []
            };
            AppState.customCards.push(newCard);
            AppState.cardProps[newCard.id] = { colspan: type === 'line-graph' ? 2 : 1 };
            AppState.save('customCards');
            AppState.save('cardProps');
            renderDashboard();
            D.modals.addCard.classList.add('hidden');
            D.forms.newCard.reset();
            D.inputs.cardContent.style.display = 'block';
        });

        D.buttons.customize.addEventListener('click', () => D.modals.customize.classList.remove('hidden'));
        D.buttons.closeCustomize.addEventListener('click', () => D.modals.customize.classList.add('hidden'));

        D.inputs.theme.addEventListener('change', () => { AppState.settings.theme = D.inputs.theme.value; AppState.saveSettings(); applySettings(); renderDashboard(); });
        D.inputs.font.addEventListener('change', () => { AppState.settings.font = D.inputs.font.value; AppState.saveSettings(); applySettings(); });
        D.inputs.bgUrl.addEventListener('input', () => { AppState.settings.bgUrl = D.inputs.bgUrl.value; AppState.saveSettings(); applySettings(); });
        D.buttons.removeBg.addEventListener('click', () => { AppState.settings.bgUrl = ''; AppState.saveSettings(); applySettings(); });
        
        D.buttons.resetDashboard.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the dashboard? This will delete all custom cards and reset the layout.')) {
                AppState.customCards = [];
                AppState.layout = ['countdown', 'graph', 'tests', 'quote', 'time'];
                AppState.cardProps = {};
                AppState.save('customCards');
                AppState.save('layout');
                AppState.save('cardProps');
                renderDashboard();
                D.modals.customize.classList.add('hidden');
            }
        });

        // --- MOBILE ALERT ---
        if (window.innerWidth < 768 && localStorage.getItem(STORAGE_KEYS.mobileAlertDismissed) !== 'true') {
            D.mobileAlert.classList.remove('hidden');
        }
        D.buttons.closeAlert.addEventListener('click', () => {
            D.mobileAlert.classList.add('hidden');
            localStorage.setItem(STORAGE_KEYS.mobileAlertDismissed, 'true');
        });
        
        // --- INFO MODAL ---
        D.buttons.info.addEventListener('click', () => D.modals.info.classList.remove('hidden'));
        D.buttons.closeInfo.addEventListener('click', () => D.modals.info.classList.add('hidden'));

        // --- INITIALIZATION ---
        applySettings();
        renderDashboard();
        new Sortable(D.dashboardGrid, {
            animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
            onEnd: () => {
                AppState.layout = [...D.dashboardGrid.children].map(item => item.dataset.cardId);
                AppState.save('layout');
            },
        });
        setInterval(() => {
            const countdownCard = D.dashboardGrid.querySelector('[data-card-id="countdown"]');
            if (countdownCard) cardTypes.countdown.render(countdownCard);
            const timeCard = D.dashboardGrid.querySelector('[data-card-id="time"]');
            if (timeCard) cardTypes.time.render(timeCard);
        }, 1000);
    });