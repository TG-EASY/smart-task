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

    // Initial Render
    updateCounter();
    renderTasks();
});
