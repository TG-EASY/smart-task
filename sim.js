function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function capitalizeWords(str) {
    return str.split(' ').map(capitalize).join(' ');
}

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

const input = "Test task in 1 minute";
const parsedData = parseTaskInput(input);
console.log("Parsed:", parsedData);

const createdAt = new Date();
const targetTime = parseToTimestamp(parsedData.date, parsedData.time, createdAt.toISOString());
console.log("CreatedAt:", createdAt.toISOString());
console.log("TargetTime:", new Date(targetTime).toISOString());
console.log("Diff (ms):", targetTime - createdAt.getTime());
