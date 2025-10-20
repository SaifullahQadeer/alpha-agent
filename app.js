// Alpha Agent - AI Task Management Application
// Data Management
class AlphaAgent {
    constructor() {
        this.tasks = this.loadFromStorage('tasks', []);
        this.clients = this.loadFromStorage('clients', []);
        this.timeEntries = this.loadFromStorage('timeEntries', []);
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderAll();
        this.updateHeaderStats();
        this.populateClientSelects();
        this.setDefaultDate();
    }

    // Local Storage Management
    loadFromStorage(key, defaultValue) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.closest('.nav-tab')));
        });

        // Modal Controls
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openModal('taskModal'));
        document.getElementById('addTimeBtn').addEventListener('click', () => this.openModal('timeModal'));
        document.getElementById('addClientBtn').addEventListener('click', () => this.openModal('clientModal'));

        document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeAllModals();
            });
        });

        // Forms
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        document.getElementById('timeForm').addEventListener('submit', (e) => this.handleTimeSubmit(e));
        document.getElementById('clientForm').addEventListener('submit', (e) => this.handleClientSubmit(e));

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.target));
        });

        // Reports & Insights
        document.getElementById('generateReportBtn').addEventListener('click', () => this.generateReport());
        document.getElementById('refreshInsightsBtn').addEventListener('click', () => this.generateInsights());

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });
    }

    // Tab Switching
    switchTab(tab) {
        const tabName = tab.dataset.tab;

        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-content="${tabName}"]`).classList.add('active');

        // Render content for specific tabs
        if (tabName === 'reports') this.generateReport();
        if (tabName === 'ai') this.generateInsights();
    }

    // Modal Management
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        document.querySelectorAll('form').forEach(f => f.reset());
    }

    // Task Management
    handleTaskSubmit(e) {
        e.preventDefault();

        const task = {
            id: Date.now(),
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            clientId: parseInt(document.getElementById('taskClient').value),
            priority: document.getElementById('taskPriority').value,
            estimatedHours: parseFloat(document.getElementById('taskEstimate').value),
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.saveToStorage('tasks', this.tasks);
        this.renderTasks();
        this.populateTaskSelects();
        this.closeAllModals();
        this.updateHeaderStats();
    }

    renderTasks(filter = 'all') {
        const container = document.getElementById('tasksList');
        let filteredTasks = this.tasks;

        if (filter === 'active') {
            filteredTasks = this.tasks.filter(t => !t.completed);
        } else if (filter === 'completed') {
            filteredTasks = this.tasks.filter(t => t.completed);
        }

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>No tasks found</h3>
                    <p>Create your first task to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredTasks.map(task => {
            const client = this.clients.find(c => c.id === task.clientId);
            const timeSpent = this.getTaskTimeSpent(task.id);

            return `
                <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                    <div class="task-header">
                        <div>
                            <div class="task-title">${task.title}</div>
                            <div class="task-client">${client ? client.name : 'No Client'}</div>
                        </div>
                        <div class="task-actions">
                            <button class="task-btn" onclick="app.toggleTask(${task.id})" title="${task.completed ? 'Mark as Active' : 'Mark as Complete'}">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                            <button class="task-btn" onclick="app.deleteTask(${task.id})" title="Delete Task">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    <div class="task-meta">
                        <div class="task-meta-item">
                            <svg viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            ${timeSpent}h / ${task.estimatedHours}h
                        </div>
                        <span class="priority-badge priority-${task.priority}">
                            ${task.priority.toUpperCase()}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    getTaskTimeSpent(taskId) {
        return this.timeEntries
            .filter(e => e.taskId === taskId)
            .reduce((sum, e) => sum + e.hours, 0)
            .toFixed(1);
    }

    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage('tasks', this.tasks);
            this.renderTasks();
            this.updateHeaderStats();
        }
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveToStorage('tasks', this.tasks);
            this.renderTasks();
            this.updateHeaderStats();
        }
    }

    handleFilter(btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTasks(btn.dataset.filter);
    }

    // Time Tracking
    handleTimeSubmit(e) {
        e.preventDefault();

        const entry = {
            id: Date.now(),
            taskId: parseInt(document.getElementById('timeTask').value),
            date: document.getElementById('timeDate').value,
            hours: parseFloat(document.getElementById('timeHours').value),
            notes: document.getElementById('timeNotes').value,
            createdAt: new Date().toISOString()
        };

        this.timeEntries.unshift(entry);
        this.saveToStorage('timeEntries', this.timeEntries);
        this.renderTimeEntries();
        this.renderTasks();
        this.closeAllModals();
        this.updateHeaderStats();
    }

    renderTimeEntries() {
        const container = document.getElementById('timeEntries');

        if (this.timeEntries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>No time entries</h3>
                    <p>Log your first time entry to start tracking</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.timeEntries.map(entry => {
            const task = this.tasks.find(t => t.id === entry.taskId);
            const client = task ? this.clients.find(c => c.id === task.clientId) : null;
            const revenue = client ? (entry.hours * client.hourlyRate).toFixed(2) : 0;

            return `
                <div class="time-entry">
                    <div class="time-entry-info">
                        <h4>${task ? task.title : 'Deleted Task'}</h4>
                        <div class="time-entry-meta">
                            <span>${client ? client.name : 'No Client'}</span>
                            <span>•</span>
                            <span>${this.formatDate(entry.date)}</span>
                            ${entry.notes ? `<span>•</span><span>${entry.notes}</span>` : ''}
                        </div>
                    </div>
                    <div class="time-entry-stats">
                        <div class="time-stat">
                            <span class="time-stat-label">Hours</span>
                            <span class="time-stat-value">${entry.hours}h</span>
                        </div>
                        <div class="time-stat">
                            <span class="time-stat-label">Revenue</span>
                            <span class="time-stat-value">$${revenue}</span>
                        </div>
                        <button class="task-btn" onclick="app.deleteTimeEntry(${entry.id})">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    deleteTimeEntry(entryId) {
        if (confirm('Are you sure you want to delete this time entry?')) {
            this.timeEntries = this.timeEntries.filter(e => e.id !== entryId);
            this.saveToStorage('timeEntries', this.timeEntries);
            this.renderTimeEntries();
            this.renderTasks();
            this.updateHeaderStats();
        }
    }

    // Client Management
    handleClientSubmit(e) {
        e.preventDefault();

        const client = {
            id: Date.now(),
            name: document.getElementById('clientName').value,
            email: document.getElementById('clientEmail').value,
            hourlyRate: parseFloat(document.getElementById('clientRate').value),
            projectType: document.getElementById('clientProject').value,
            createdAt: new Date().toISOString()
        };

        this.clients.unshift(client);
        this.saveToStorage('clients', this.clients);
        this.renderClients();
        this.populateClientSelects();
        this.closeAllModals();
    }

    renderClients() {
        const container = document.getElementById('clientsList');

        if (this.clients.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M17 21V19C17 17.9 16.1 17 15 17H9C7.9 17 7 17.9 7 19V21" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>No clients</h3>
                    <p>Add your first client to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.clients.map(client => {
            const clientTasks = this.tasks.filter(t => t.clientId === client.id);
            const totalHours = this.timeEntries
                .filter(e => {
                    const task = this.tasks.find(t => t.id === e.taskId);
                    return task && task.clientId === client.id;
                })
                .reduce((sum, e) => sum + e.hours, 0);
            const totalRevenue = totalHours * client.hourlyRate;

            return `
                <div class="client-card">
                    <h3>${client.name}</h3>
                    <div class="client-email">${client.email || 'No email'}</div>
                    <div class="client-stats">
                        <div class="client-stat">
                            <span class="client-stat-label">Hourly Rate</span>
                            <span class="client-stat-value">$${client.hourlyRate}</span>
                        </div>
                        <div class="client-stat">
                            <span class="client-stat-label">Total Hours</span>
                            <span class="client-stat-value">${totalHours.toFixed(1)}h</span>
                        </div>
                        <div class="client-stat">
                            <span class="client-stat-label">Tasks</span>
                            <span class="client-stat-value">${clientTasks.length}</span>
                        </div>
                        <div class="client-stat">
                            <span class="client-stat-label">Revenue</span>
                            <span class="client-stat-value">$${totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Reports Generation
    generateReport() {
        const container = document.getElementById('reportsContainer');
        const weekData = this.getWeekData();

        container.innerHTML = `
            <div class="report-card">
                <div class="report-header">
                    <div>
                        <div class="report-title">Weekly Report</div>
                        <div class="report-date">${weekData.weekStart} - ${weekData.weekEnd}</div>
                    </div>
                </div>

                <div class="report-stats">
                    <div class="report-stat-card">
                        <h4>Total Hours</h4>
                        <div class="value">${weekData.totalHours.toFixed(1)}h</div>
                    </div>
                    <div class="report-stat-card">
                        <h4>Total Revenue</h4>
                        <div class="value">$${weekData.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div class="report-stat-card">
                        <h4>Tasks Completed</h4>
                        <div class="value">${weekData.completedTasks}</div>
                    </div>
                    <div class="report-stat-card">
                        <h4>Avg. Daily Hours</h4>
                        <div class="value">${weekData.avgDailyHours.toFixed(1)}h</div>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Work by Client</h3>
                    <div class="report-list">
                        ${weekData.clientBreakdown.map(item => `
                            <div class="report-list-item">
                                <span>${item.client}</span>
                                <span>${item.hours.toFixed(1)}h ($${item.revenue.toFixed(2)})</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="report-section">
                    <h3>Daily Breakdown</h3>
                    <div class="report-list">
                        ${weekData.dailyBreakdown.map(item => `
                            <div class="report-list-item">
                                <span>${item.day}</span>
                                <span>${item.hours.toFixed(1)}h</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="report-section">
                    <h3>Top Tasks</h3>
                    <div class="report-list">
                        ${weekData.topTasks.map(item => `
                            <div class="report-list-item">
                                <span>${item.task}</span>
                                <span>${item.hours.toFixed(1)}h</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getWeekData() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekEntries = this.timeEntries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate >= weekStart && entryDate <= weekEnd;
        });

        const totalHours = weekEntries.reduce((sum, e) => sum + e.hours, 0);

        const totalRevenue = weekEntries.reduce((sum, e) => {
            const task = this.tasks.find(t => t.id === e.taskId);
            const client = task ? this.clients.find(c => c.id === task.clientId) : null;
            return sum + (client ? e.hours * client.hourlyRate : 0);
        }, 0);

        const completedTasks = this.tasks.filter(t => {
            const completedDate = new Date(t.createdAt);
            return t.completed && completedDate >= weekStart && completedDate <= weekEnd;
        }).length;

        const avgDailyHours = totalHours / 7;

        // Client breakdown
        const clientMap = new Map();
        weekEntries.forEach(e => {
            const task = this.tasks.find(t => t.id === e.taskId);
            const client = task ? this.clients.find(c => c.id === task.clientId) : null;
            if (client) {
                const existing = clientMap.get(client.id) || { client: client.name, hours: 0, revenue: 0 };
                existing.hours += e.hours;
                existing.revenue += e.hours * client.hourlyRate;
                clientMap.set(client.id, existing);
            }
        });

        const clientBreakdown = Array.from(clientMap.values())
            .sort((a, b) => b.hours - a.hours);

        // Daily breakdown
        const dailyMap = new Map();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dayName = days[day.getDay()];
            dailyMap.set(dayName, 0);
        }

        weekEntries.forEach(e => {
            const entryDate = new Date(e.date);
            const dayName = days[entryDate.getDay()];
            dailyMap.set(dayName, (dailyMap.get(dayName) || 0) + e.hours);
        });

        const dailyBreakdown = Array.from(dailyMap.entries())
            .map(([day, hours]) => ({ day, hours }));

        // Top tasks
        const taskMap = new Map();
        weekEntries.forEach(e => {
            const task = this.tasks.find(t => t.id === e.taskId);
            if (task) {
                const existing = taskMap.get(task.id) || { task: task.title, hours: 0 };
                existing.hours += e.hours;
                taskMap.set(task.id, existing);
            }
        });

        const topTasks = Array.from(taskMap.values())
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 5);

        return {
            weekStart: this.formatDate(weekStart),
            weekEnd: this.formatDate(weekEnd),
            totalHours,
            totalRevenue,
            completedTasks,
            avgDailyHours,
            clientBreakdown,
            dailyBreakdown,
            topTasks
        };
    }

    // AI Insights Generation
    generateInsights() {
        const container = document.getElementById('aiInsights');
        const weekData = this.getWeekData();
        const insights = [];

        // Workload Analysis
        if (weekData.avgDailyHours > 8) {
            insights.push({
                type: 'warning',
                title: 'High Workload Detected',
                description: `You're averaging ${weekData.avgDailyHours.toFixed(1)} hours per day this week, which is above the recommended 8 hours. Consider redistributing tasks or extending deadlines to prevent burnout.`,
                actions: ['View task distribution', 'Schedule break time']
            });
        } else if (weekData.avgDailyHours < 4) {
            insights.push({
                type: 'suggestion',
                title: 'Capacity Available',
                description: `You're averaging ${weekData.avgDailyHours.toFixed(1)} hours per day. You have capacity for additional projects or could focus on high-priority tasks.`,
                actions: ['View available tasks', 'Take on new projects']
            });
        }

        // Weekend Planning
        const today = new Date().getDay();
        if (today >= 5) { // Friday or weekend
            const activeTasks = this.tasks.filter(t => !t.completed);
            if (activeTasks.length > 0) {
                insights.push({
                    type: 'suggestion',
                    title: 'Weekend Planning',
                    description: `You have ${activeTasks.length} active tasks. Consider planning light work for the weekend or schedule them for next week. Work-life balance is important!`,
                    actions: ['Schedule for Monday', 'Mark low priority']
                });
            }
        }

        // Client Revenue Optimization
        if (weekData.clientBreakdown.length > 0) {
            const highestRevenue = weekData.clientBreakdown[0];
            const lowestRevenue = weekData.clientBreakdown[weekData.clientBreakdown.length - 1];

            if (highestRevenue.revenue > lowestRevenue.revenue * 3) {
                insights.push({
                    type: 'optimization',
                    title: 'Revenue Optimization Opportunity',
                    description: `${highestRevenue.client} is your highest revenue client this week ($${highestRevenue.revenue.toFixed(2)}). Consider focusing more hours on high-value clients or adjusting rates for lower-paying projects.`,
                    actions: ['Review client rates', 'Adjust priorities']
                });
            }
        }

        // Task Completion Rate
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        if (completionRate < 30 && totalTasks > 5) {
            insights.push({
                type: 'warning',
                title: 'Low Task Completion Rate',
                description: `Only ${completionRate.toFixed(0)}% of your tasks are completed. Focus on finishing existing tasks before starting new ones. Break down large tasks into smaller, manageable pieces.`,
                actions: ['Review task priorities', 'Break down tasks']
            });
        } else if (completionRate > 80) {
            insights.push({
                type: 'optimization',
                title: 'Excellent Progress!',
                description: `You've completed ${completionRate.toFixed(0)}% of your tasks! You're doing great. Keep up the momentum and consider taking on more challenging projects.`,
                actions: ['View achievements', 'Set new goals']
            });
        }

        // Upcoming Week Suggestions
        const upcomingWeekInsight = this.generateUpcomingWeekPlan(weekData);
        if (upcomingWeekInsight) {
            insights.push(upcomingWeekInsight);
        }

        // Time Distribution
        const hoursVariance = this.calculateDailyVariance(weekData.dailyBreakdown);
        if (hoursVariance > 3) {
            insights.push({
                type: 'optimization',
                title: 'Uneven Work Distribution',
                description: 'Your daily work hours vary significantly. Try to distribute work more evenly throughout the week for better consistency and reduced stress.',
                actions: ['Balance schedule', 'Set daily limits']
            });
        }

        // Render insights
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>Looking good!</h3>
                    <p>No insights at the moment. Keep tracking your time and tasks.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-card type-${insight.type}">
                <div class="insight-header">
                    <div class="insight-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            ${insight.type === 'optimization' ?
                                '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2"/>' :
                            insight.type === 'warning' ?
                                '<path d="M12 9v4m0 4h.01M12 3l9 18H3L12 3z" stroke="currentColor" stroke-width="2"/>' :
                                '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2"/>'
                            }
                        </svg>
                    </div>
                    <div class="insight-title">${insight.title}</div>
                </div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-actions">
                    ${insight.actions.map(action => `
                        <div class="insight-action">${action}</div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    generateUpcomingWeekPlan(currentWeekData) {
        const activeTasks = this.tasks.filter(t => !t.completed);

        if (activeTasks.length === 0) {
            return {
                type: 'suggestion',
                title: 'Plan Your Upcoming Week',
                description: 'You have no active tasks! Great job completing everything. Take this time to plan new projects, learn new skills, or take a well-deserved break.',
                actions: ['Create new tasks', 'Review goals', 'Schedule planning time']
            };
        }

        const totalEstimatedHours = activeTasks.reduce((sum, t) => {
            const spent = parseFloat(this.getTaskTimeSpent(t.id));
            return sum + Math.max(0, t.estimatedHours - spent);
        }, 0);

        const recommendedDailyHours = Math.min(8, totalEstimatedHours / 5);

        return {
            type: 'suggestion',
            title: 'Upcoming Week Plan',
            description: `You have ${activeTasks.length} active tasks with approximately ${totalEstimatedHours.toFixed(1)} hours of work remaining. Aim for ${recommendedDailyHours.toFixed(1)} hours per day to complete them by week's end. Prioritize ${activeTasks.filter(t => t.priority === 'high').length} high-priority tasks first.`,
            actions: ['View task schedule', 'Set daily goals', 'Review priorities']
        };
    }

    calculateDailyVariance(dailyBreakdown) {
        const hours = dailyBreakdown.map(d => d.hours);
        const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
        const variance = hours.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hours.length;
        return Math.sqrt(variance);
    }

    // Header Stats Update
    updateHeaderStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayEntries = this.timeEntries.filter(e => {
            const entryDate = new Date(e.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
        });

        const todayHours = todayEntries.reduce((sum, e) => sum + e.hours, 0);

        const weekData = this.getWeekData();

        document.getElementById('todayHours').textContent = `${todayHours.toFixed(1)}h`;
        document.getElementById('weekHours').textContent = `${weekData.totalHours.toFixed(1)}h`;
        document.getElementById('weekRevenue').textContent = `$${weekData.totalRevenue.toFixed(0)}`;
    }

    // Helper Functions
    populateClientSelects() {
        const select = document.getElementById('taskClient');
        select.innerHTML = '<option value="">Select Client</option>' +
            this.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    populateTaskSelects() {
        const select = document.getElementById('timeTask');
        const activeTasks = this.tasks.filter(t => !t.completed);
        select.innerHTML = '<option value="">Select Task</option>' +
            activeTasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('timeDate').value = today;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    renderAll() {
        this.renderTasks();
        this.renderTimeEntries();
        this.renderClients();
        this.populateTaskSelects();
    }
}

// Initialize the application
const app = new AlphaAgent();

// Add demo data if storage is empty
if (app.clients.length === 0) {
    // Add sample clients
    const sampleClients = [
        {
            id: Date.now() + 1,
            name: 'TechCorp Inc.',
            email: 'contact@techcorp.com',
            hourlyRate: 150,
            projectType: 'Web Development',
            createdAt: new Date().toISOString()
        },
        {
            id: Date.now() + 2,
            name: 'StartupXYZ',
            email: 'hello@startupxyz.com',
            hourlyRate: 120,
            projectType: 'Mobile App',
            createdAt: new Date().toISOString()
        }
    ];

    app.clients = sampleClients;
    app.saveToStorage('clients', app.clients);

    // Add sample tasks
    const sampleTasks = [
        {
            id: Date.now() + 10,
            title: 'Build user authentication system',
            description: 'Implement JWT-based authentication with refresh tokens',
            clientId: sampleClients[0].id,
            priority: 'high',
            estimatedHours: 8,
            completed: false,
            createdAt: new Date().toISOString()
        },
        {
            id: Date.now() + 11,
            title: 'Design mobile app UI',
            description: 'Create mockups for the main app screens',
            clientId: sampleClients[1].id,
            priority: 'medium',
            estimatedHours: 12,
            completed: false,
            createdAt: new Date().toISOString()
        },
        {
            id: Date.now() + 12,
            title: 'API integration',
            description: 'Integrate third-party payment gateway',
            clientId: sampleClients[0].id,
            priority: 'high',
            estimatedHours: 6,
            completed: true,
            createdAt: new Date().toISOString()
        }
    ];

    app.tasks = sampleTasks;
    app.saveToStorage('tasks', app.tasks);

    // Add sample time entries
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sampleTimeEntries = [
        {
            id: Date.now() + 20,
            taskId: sampleTasks[0].id,
            date: today.toISOString().split('T')[0],
            hours: 4,
            notes: 'Implemented login and registration endpoints',
            createdAt: new Date().toISOString()
        },
        {
            id: Date.now() + 21,
            taskId: sampleTasks[1].id,
            date: yesterday.toISOString().split('T')[0],
            hours: 5.5,
            notes: 'Created wireframes and color schemes',
            createdAt: new Date().toISOString()
        }
    ];

    app.timeEntries = sampleTimeEntries;
    app.saveToStorage('timeEntries', app.timeEntries);

    // Re-render with sample data
    app.renderAll();
    app.updateHeaderStats();
}
