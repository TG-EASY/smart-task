document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let tasks = JSON.parse(localStorage.getItem('smart_tasks')) || [];
    let currentFilter = 'all';

    // --- DOM Elements ---
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const reminderSelect = document.getElementById('reminder-select');
    const taskListContainer = document.getElementById('task-list-container');
    const emptyState = document.getElementById('empty-state');
    const taskCounter = document.getElementById('task-counter');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const exampleChips = document.querySelectorAll('.chip');
    const currentYearSpan = document.getElementById('current-year');

    // Set current year in footer
    currentYearSpan.textContent = new Date().getFullYear();

    // --- Natural Language Parsing ---
    function parseTaskInput(input) {
        let title = input;
        let date = null;
        let time = null;
        let recurring = null;

        const lowerInput = input.toLowerCase();

        // 1. Extract Recurring
        const recurringRegex = /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|week|month|year)/i;
        const recurringMatch = lowerInput.match(recurringRegex);
        if (recurringMatch) {
            recurring = `Every ${capitalize(recurringMatch[1])}`;
            title = title.replace(recurringRegex, '').trim();
        }

        // 2. Extract Date
        const dateRegex = /(today|tomorrow|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week))/i;
        const dateMatch = lowerInput.match(dateRegex);
        if (dateMatch) {
            date = capitalizeWords(dateMatch[0]);
            title = title.replace(dateRegex, '').trim();
        }

        // 3. Extract Relative Time (in X hours/minutes)
        const relativeTimeRegex = /in\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i;
        const relativeTimeMatch = lowerInput.match(relativeTimeRegex);
        if (relativeTimeMatch && !date) { // Only if date wasn't already caught by 'tomorrow' etc
            date = capitalizeWords(relativeTimeMatch[0]);
            title = title.replace(relativeTimeRegex, '').trim();
        }

        // 4. Extract Specific Time
        const timeRegex = /(at\s+)?(\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.))/i;
        const timeMatch = lowerInput.match(timeRegex);
        if (timeMatch) {
            time = timeMatch[2].toUpperCase();
            title = title.replace(timeRegex, '').trim();
        }

        // Clean up title (remove trailing prepositions/spaces)
        title = title.replace(/^(at|on|in)\s+/i, '').replace(/\s+(at|on|in)$/i, '').trim();
        
        // Capitalize first letter of title
        if (title.length > 0) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }

        return { title, date, time, recurring };
    }

    // Helpers
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    function capitalizeWords(str) {
        return str.split(' ').map(capitalize).join(' ');
    }

    // --- Core Functions ---
    
    function saveTasks() {
        localStorage.setItem('smart_tasks', JSON.stringify(tasks));
        updateCounter();
    }

    function addTask(rawInput, reminderValue) {
        if (!rawInput.trim()) return;

        // Request notification permission if not already granted or denied
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const parsedData = parseTaskInput(rawInput);
        
        // If parsing stripped everything, fallback to raw input
        const taskTitle = parsedData.title || rawInput.trim();

        const newTask = {
            id: Date.now().toString(),
            title: taskTitle,
            rawText: rawInput.trim(),
            date: parsedData.date,
            time: parsedData.time,
            recurring: parsedData.recurring,
            reminder: reminderValue !== 'none' ? reminderValue : null,
            completed: false,
            notified: false,
            createdAt: new Date().toISOString()
        };

        tasks.unshift(newTask); // Add to beginning
        saveTasks();
        renderTasks();
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    }

    function deleteTask(id) {
        const taskElement = document.querySelector(`.task-card[data-id="${id}"]`);
        
        if (taskElement) {
            // Add animation class
            taskElement.classList.add('removing');
            
            // Wait for animation to finish before removing from array and DOM
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== id);
                saveTasks();
                renderTasks();
            }, 400); // Matches CSS animation duration
        } else {
            // Fallback
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    function updateCounter() {
        taskCounter.textContent = `(${tasks.length})`;
    }

    // --- Rendering ---
    
    function renderTasks() {
        // Clear current tasks (but keep empty state element reference)
        const tasksToRemove = taskListContainer.querySelectorAll('.task-card');
        tasksToRemove.forEach(task => task.remove());

        // Apply filters
        let filteredTasks = tasks;
        if (currentFilter === 'today') {
            filteredTasks = tasks.filter(t => t.date && t.date.toLowerCase().includes('today'));
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        }

        // Show/Hide Empty State
        if (filteredTasks.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';

            // Render each task
            filteredTasks.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = `task-card ${task.completed ? 'completed' : ''} adding`;
                taskEl.dataset.id = task.id;

                // Build Meta HTML
                let metaHtml = '';
                if (task.date) metaHtml += `<span class="meta-item"><i class="fa-regular fa-calendar"></i> ${task.date}</span>`;
                if (task.time) metaHtml += `<span class="meta-item"><i class="fa-regular fa-clock"></i> ${task.time}</span>`;
                if (task.recurring) metaHtml += `<span class="meta-item"><i class="fa-solid fa-rotate-right"></i> ${task.recurring}</span>`;
                if (task.reminder) {
                    const reminderText = task.reminder.replace('m', ' min').replace('h', ' hour').replace('d', ' day');
                    metaHtml += `<span class="meta-item"><i class="fa-solid fa-bell"></i> ${reminderText} before</span>`;
                }

                taskEl.innerHTML = `
                    <div class="task-content">
                        <div class="task-title">${escapeHTML(task.title)}</div>
                        ${metaHtml ? `<div class="task-meta">${metaHtml}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="action-btn btn-complete" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
                            <i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i>
                        </button>
                        <button class="action-btn btn-delete" aria-label="Delete task">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                `;

                // Add event listeners to buttons
                const completeBtn = taskEl.querySelector('.btn-complete');
                completeBtn.addEventListener('click', () => toggleTask(task.id));

                const deleteBtn = taskEl.querySelector('.btn-delete');
                deleteBtn.addEventListener('click', () => deleteTask(task.id));

                taskListContainer.appendChild(taskEl);

                // Remove 'adding' class after animation completes so it doesn't re-animate on re-render
                setTimeout(() => {
                    taskEl.classList.remove('adding');
                }, 400);
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    // --- Notification & Timer Logic ---
    function parseToTimestamp(dateStr, timeStr, createdAtStr) {
        if (!dateStr && !timeStr) return null;
        
        let targetDate = createdAtStr ? new Date(createdAtStr) : new Date();
        
        // Handle Date part
        if (dateStr) {
            const lowerDate = dateStr.toLowerCase();
            if (lowerDate === 'tomorrow') {
                targetDate.setDate(targetDate.getDate() + 1);
            } else if (lowerDate.startsWith('next ')) {
                targetDate.setDate(targetDate.getDate() + 7);
            } else if (lowerDate.startsWith('in ')) {
                const match = lowerDate.match(/in\s+(\d+)\s+(hour|minute|day)/);
                if (match) {
                    const num = parseInt(match[1]);
                    const unit = match[2];
                    if (unit === 'minute') targetDate.setMinutes(targetDate.getMinutes() + num);
                    if (unit === 'hour') targetDate.setHours(targetDate.getHours() + num);
                    if (unit === 'day') targetDate.setDate(targetDate.getDate() + num);
                    return targetDate.getTime();
                }
            }
        }

        // Handle Time part (e.g. 4PM, 6:30AM)
        if (timeStr) {
            const timeMatch = timeStr.match(/(\d{1,2})(:(\d{2}))?\s*(AM|PM)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                const ampm = timeMatch[4].toUpperCase();
                
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                
                targetDate.setHours(hours, minutes, 0, 0);
                
                // If time has passed today and no specific date given, assume tomorrow
                const baseTime = createdAtStr ? new Date(createdAtStr).getTime() : Date.now();
                if (!dateStr && targetDate.getTime() < baseTime) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
            }
        }

        return targetDate.getTime();
    }

    function checkNotifications() {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        
        const now = Date.now();
        let changed = false;

        tasks.forEach(task => {
            if (task.completed || task.notified) return;
            
            const targetTime = parseToTimestamp(task.date, task.time, task.createdAt);
            if (!targetTime) return; // Cannot parse exact time

            let reminderMs = 0;
            if (task.reminder) {
                if (task.reminder === '5m') reminderMs = 5 * 60 * 1000;
                if (task.reminder === '10m') reminderMs = 10 * 60 * 1000;
                if (task.reminder === '30m') reminderMs = 30 * 60 * 1000;
                if (task.reminder === '1h') reminderMs = 60 * 60 * 1000;
                if (task.reminder === '1d') reminderMs = 24 * 60 * 60 * 1000;
            }

            const triggerTime = targetTime - reminderMs;

            if (now >= triggerTime) {
                // Fire notification
                new Notification("Smart Task Manager", {
                    body: `${task.title}\nDue: ${task.date || 'Today'} ${task.time || ''}`,
                    icon: 'assets/background2.jpg'
                });

                // Play alarm sound
                try {
                    const alarmSound = new Audio('assets/alarm.mp3');
                    alarmSound.play().catch(e => console.log("Audio autoplay blocked or file not found."));
                } catch (e) {
                    console.error("Error playing alarm:", e);
                }

                task.notified = true;
                changed = true;
            }
        });

        if (changed) {
            saveTasks();
        }
    }

    // Run checker every 10 seconds
    setInterval(checkNotifications, 10000);

    // --- Event Listeners ---

    // Form Submit
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputVal = taskInput.value;
        const reminderVal = reminderSelect.value;
        
        if (inputVal.trim()) {
            addTask(inputVal, reminderVal);
            taskInput.value = ''; // Clear input
            reminderSelect.value = 'none'; // Reset reminder
        }
    });

    // Example Chips Click
    exampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            taskInput.value = chip.textContent;
            taskInput.focus();
        });
    });

    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Apply filter
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // --- Report Modal & Export Logic ---
    const reportModal = document.getElementById('report-modal');
    const openReportBtn = document.getElementById('open-report-btn');
    const closeReportModal = document.getElementById('close-report-modal');
    const reportFilterSelect = document.getElementById('report-filter');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportDocBtn = document.getElementById('export-doc-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    function openModal() {
        reportModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        reportModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function getFilteredReportTasks() {
        const filterVal = reportFilterSelect.value;
        if (filterVal === 'completed') {
            return tasks.filter(t => t.completed);
        } else if (filterVal === 'pending') {
            return tasks.filter(t => !t.completed);
        }
        return tasks;
    }

    function exportToCSV() {
        const reportTasks = getFilteredReportTasks();
        if (reportTasks.length === 0) {
            alert("No tasks found matching your filter!");
            return;
        }

        const headers = ['Task Title', 'Status', 'Due Date', 'Due Time', 'Recurring', 'Reminder', 'Created At'];
        const csvRows = [headers.join(',')];

        reportTasks.forEach(task => {
            const status = task.completed ? 'Completed' : 'Pending';
            const reminderText = task.reminder ? `${task.reminder.replace('m', ' min').replace('h', ' hour').replace('d', ' day')} before` : 'None';
            const rowValues = [
                task.title || '',
                status,
                task.date || 'None',
                task.time || 'None',
                task.recurring || 'None',
                reminderText,
                task.createdAt ? new Date(task.createdAt).toLocaleString() : 'None'
            ];
            
            const escapedRow = rowValues.map(val => `"${val.replace(/"/g, '""')}"`).join(',');
            csvRows.push(escapedRow);
        });

        const csvContent = "\ufeff" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `smart_tasks_report_${reportFilterSelect.value}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportToWord() {
        const reportTasks = getFilteredReportTasks();
        if (reportTasks.length === 0) {
            alert("No tasks found matching your filter!");
            return;
        }

        const total = reportTasks.length;
        const completed = reportTasks.filter(t => t.completed).length;
        const pending = total - completed;
        const compRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        let tableRowsHtml = '';
        reportTasks.forEach((task, idx) => {
            const status = task.completed ? 'COMPLETED' : 'PENDING';
            const statusColor = task.completed ? '#10b981' : '#f5c518';
            tableRowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-weight: bold; width: 40px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 10px; font-weight: 500;">${escapeHTML(task.title)}</td>
                    <td style="padding: 10px; color: ${statusColor}; font-weight: bold; text-align: center;">${status}</td>
                    <td style="padding: 10px; text-align: center;">${task.date || '-'}</td>
                    <td style="padding: 10px; text-align: center;">${task.time || '-'}</td>
                    <td style="padding: 10px; text-align: center;">${task.recurring || '-'}</td>
                </tr>
            `;
        });

        const wordHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>Task Report - Smart Task Manager</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
                h1 { color: #0f172a; border-bottom: 2px solid #f5c518; padding-bottom: 10px; font-size: 24pt; margin-bottom: 5px; }
                .meta { color: #64748b; font-size: 10pt; margin-bottom: 20px; }
                .stats-container { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
                .stats-table { width: 100%; border-collapse: collapse; }
                .stats-table td { padding: 5px 15px; font-size: 11pt; }
                .tasks-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .tasks-header { background-color: #0f172a; color: #ffffff; font-weight: bold; }
                .tasks-header th { padding: 12px 10px; font-size: 11pt; border: 1px solid #0f172a; text-align: center; }
                .tasks-table td { border: 1px solid #e2e8f0; font-size: 10.5pt; }
                .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            </style>
        </head>
        <body>
            <h1>Smart Task Manager | Productivity Report</h1>
            <div class="meta">Report Generated on: ${new Date().toLocaleString()} | Filter: ${capitalize(reportFilterSelect.value)} Tasks</div>
            
            <div class="stats-container">
                <h3 style="margin-top: 0; color: #0f172a; font-size: 13pt;">Report Summary</h3>
                <table class="stats-table">
                    <tr>
                        <td><strong>Total Tasks in Report:</strong> ${total}</td>
                        <td><strong>Completed Tasks:</strong> ${completed}</td>
                    </tr>
                    <tr>
                        <td><strong>Pending Tasks:</strong> ${pending}</td>
                        <td><strong>Completion Rate:</strong> ${compRate}%</td>
                    </tr>
                </table>
            </div>

            <h3 style="color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Task Details</h3>
            <table class="tasks-table">
                <thead>
                    <tr class="tasks-header">
                        <th style="width: 40px;">#</th>
                        <th>Task Title</th>
                        <th style="width: 120px;">Status</th>
                        <th style="width: 120px;">Due Date</th>
                        <th style="width: 100px;">Time</th>
                        <th style="width: 120px;">Recurring</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div class="footer">
                <p>Generated by Smart Task Manager - AI-Powered Productivity</p>
            </div>
        </body>
        </html>
        `;

        const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `smart_tasks_report_${reportFilterSelect.value}_${new Date().toISOString().slice(0, 10)}.doc`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportToPDF() {
        const reportTasks = getFilteredReportTasks();
        if (reportTasks.length === 0) {
            alert("No tasks found matching your filter!");
            return;
        }

        const total = reportTasks.length;
        const completed = reportTasks.filter(t => t.completed).length;
        const pending = total - completed;
        const compRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        let tableRowsHtml = '';
        reportTasks.forEach((task, idx) => {
            const status = task.completed ? 'Completed' : 'Pending';
            const statusClass = task.completed ? 'status-completed' : 'status-pending';
            const reminderText = task.reminder ? `${task.reminder.replace('m', 'm').replace('h', 'h').replace('d', 'd')} before` : '';
            
            let metaString = '';
            if (task.date) metaString += `Date: ${task.date} &nbsp;&nbsp;`;
            if (task.time) metaString += `Time: ${task.time} &nbsp;&nbsp;`;
            if (task.recurring) metaString += `Recurring: ${task.recurring} &nbsp;&nbsp;`;
            if (task.reminder) metaString += `Reminder: ${reminderText}`;

            tableRowsHtml += `
                <tr>
                    <td style="text-align: center; font-weight: bold; width: 30px;">${idx + 1}</td>
                    <td>
                        <div class="task-title">${escapeHTML(task.title)}</div>
                        ${metaString ? `<div class="task-meta">${metaString}</div>` : ''}
                    </td>
                    <td style="width: 100px; text-align: center;">
                        <span class="status-badge ${statusClass}">${status}</span>
                    </td>
                </tr>
            `;
        });

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            alert("Popup blocked! Please allow popups to generate PDF report.");
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>Task Report - Smart Task Manager</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            line-height: 1.5;
            padding: 40px;
            background: #ffffff;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f5c518;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title h1 {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
        }
        .title p {
            font-size: 12px;
            color: #64748b;
            margin-top: 5px;
        }
        .brand {
            text-align: right;
        }
        .brand-name {
            font-weight: 700;
            font-size: 16px;
            color: #0f172a;
        }
        .brand-sub {
            font-size: 12px;
            color: #64748b;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 35px;
        }
        .stat-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            background: #f8fafc;
            text-align: center;
        }
        .stat-val {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .stat-lbl {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        h2.section-title {
            font-size: 16px;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
        }
        th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 16px;
            text-align: left;
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
            vertical-align: middle;
        }
        tr:nth-child(even) td {
            background: #fafafa;
        }
        .task-title {
            font-weight: 600;
            color: #1e293b;
        }
        .task-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
        }
        .status-completed {
            background: #dcfce7;
            color: #15803d;
        }
        .status-pending {
            background: #fef9c3;
            color: #a16207;
        }
        
        .footer {
            margin-top: auto;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
        }
        
        @media print {
            body { padding: 0; }
            .stat-card { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .status-completed { background: #dcfce7 !important; color: #15803d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .status-pending { background: #fef9c3 !important; color: #a16207 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            th { background: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tr:nth-child(even) td { background: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { border-bottom-color: #f5c518 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <h1>Smart Task Manager</h1>
            <p>Productivity &amp; Task Report</p>
        </div>
        <div class="brand">
            <div class="brand-name">Offline Task Report</div>
            <div class="brand-sub">Generated: ${new Date().toLocaleString()}</div>
        </div>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-val">${total}</div>
            <div class="stat-lbl">Total Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-val">${completed}</div>
            <div class="stat-lbl">Completed</div>
        </div>
        <div class="stat-card">
            <div class="stat-val">${pending}</div>
            <div class="stat-lbl">Pending</div>
        </div>
        <div class="stat-card">
            <div class="stat-val">${compRate}%</div>
            <div class="stat-lbl">Completion Rate</div>
        </div>
    </div>
    
    <h2 class="section-title">Tasks List (${capitalize(reportFilterSelect.value)})</h2>
    <table>
        <thead>
            <tr>
                <th style="text-align: center; width: 30px;">#</th>
                <th>Task Details</th>
                <th style="text-align: center; width: 100px;">Status</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHtml}
        </tbody>
    </table>
    
    <div class="footer">
        <div>Smart Task Manager &copy; ${new Date().getFullYear()}</div>
        <div>Scope: ${capitalize(reportFilterSelect.value)} Tasks</div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                window.close();
            }, 500);
        };
    </script>
</body>
</html>
        `);
        printWindow.document.close();
    }

    // Modal triggers
    openReportBtn.addEventListener('click', openModal);
    closeReportModal.addEventListener('click', closeModal);
    
    // Close modal when clicking outside content
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            closeModal();
        }
    });

    // Export buttons action
    exportCsvBtn.addEventListener('click', () => {
        exportToCSV();
        closeModal();
    });
    
    exportDocBtn.addEventListener('click', () => {
        exportToWord();
        closeModal();
    });
    
    exportPdfBtn.addEventListener('click', () => {
        exportToPDF();
        closeModal();
    });

    // Initial Render
    updateCounter();
    renderTasks();
});
