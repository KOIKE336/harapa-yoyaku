// Global variables
let resourceColors = {};
let eventsData = [];
let currentConfig = {};

// Default configuration for LogoForm
const defaultConfig = {
    dateColumn: '5:date',
    roomColumn: '1:checkbox',
    nameColumns: ['244:lastname', '244:firstname', '91:lastname', '91:firstname'],
    facilities: [
        { 
            id: '会議室(さくら)', 
            name: '会議室(さくら)', 
            timeColumn: '7:checkbox',
            keywords: ['会議室', 'さくら']
        },
        { 
            id: '相談室(スミレ・コスモス)', 
            name: '相談室(スミレ・コスモス)', 
            timeColumn: '8:checkbox',
            keywords: ['相談室', 'スミレ', 'コスモス']
        },
        { 
            id: 'テレワークルームA', 
            name: 'テレワークルームA', 
            timeColumn: '234:checkbox',
            keywords: ['テレワークルームA']
        },
        { 
            id: 'テレワークルームB', 
            name: 'テレワークルームB', 
            timeColumn: '235:checkbox',
            keywords: ['テレワークルームB']
        }
    ]
};

// Initialize with default config
currentConfig = JSON.parse(JSON.stringify(defaultConfig));

// Get current resources from config
function getCurrentResources() {
    return currentConfig.facilities || [];
}

// Generate random colors for each resource
function generateRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.random() * 20; // 70-90%
    const lightness = 50 + Math.random() * 20;  // 50-70%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Initialize resource colors
function initializeResourceColors() {
    getCurrentResources().forEach(resource => {
        resourceColors[resource.id] = generateRandomColor();
    });
}

// Show/hide UI elements
function showElement(id) {
    document.getElementById(id).style.display = 'block';
}

function hideElement(id) {
    document.getElementById(id).style.display = 'none';
}

function showMessage(type, message) {
    const elementId = type === 'error' ? 'errorMessage' : 'successMessage';
    const element = document.getElementById(elementId);
    element.textContent = message;
    showElement(elementId);
    
    // Hide other message type
    const otherElementId = type === 'error' ? 'successMessage' : 'errorMessage';
    hideElement(otherElementId);
}

// Parse time slots from string
function parseTimeSlots(timeStr) {
    if (!timeStr || timeStr.trim() === '') {
        return [];
    }
    
    const slots = [];
    const timeSlots = timeStr.split(';');
    
    for (let slot of timeSlots) {
        slot = slot.trim();
        if (slot && slot.includes('～')) {
            const [startTime, endTime] = slot.split('～');
            if (startTime && endTime) {
                // Convert full-width colon to half-width
                const start = startTime.replace('：', ':').trim();
                const end = endTime.replace('：', ':').trim();
                slots.push({ start, end });
            }
        }
    }
    
    return slots;
}

// Merge continuous time slots
function mergeContinuousSlots(slots) {
    if (!slots || slots.length === 0) {
        return [];
    }
    
    // Sort slots by start time
    slots.sort((a, b) => {
        const timeA = a.start.split(':').map(n => parseInt(n));
        const timeB = b.start.split(':').map(n => parseInt(n));
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
    
    const merged = [];
    let currentSlot = { ...slots[0] };
    
    for (let i = 1; i < slots.length; i++) {
        if (currentSlot.end === slots[i].start) {
            // Continuous slots - merge them
            currentSlot.end = slots[i].end;
        } else {
            // Gap found - save current and start new
            merged.push({ ...currentSlot });
            currentSlot = { ...slots[i] };
        }
    }
    
    merged.push(currentSlot);
    return merged;
}

// Get calendar ID for room using dynamic config
function getCalendarIdForRoom(room) {
    const facilities = getCurrentResources();
    for (const facility of facilities) {
        if (facility.keywords.some(keyword => room.includes(keyword))) {
            return facility.id;
        }
    }
    return room; // fallback
}

// Get time slots column for room using dynamic config
function getTimeSlotsForRoom(room, row) {
    const facilities = getCurrentResources();
    for (const facility of facilities) {
        if (facility.keywords.some(keyword => room.includes(keyword))) {
            return row[facility.timeColumn] || '';
        }
    }
    return '';
}

// Parse CSV data and create events
function parseCSVData(csvData) {
    const events = [];
    let eventId = 1;
    
    for (const row of csvData) {
        // Get date using dynamic config
        const date = (row[currentConfig.dateColumn] || '').trim();
        if (!date) continue;
        
        // Get rooms using dynamic config
        const rooms = (row[currentConfig.roomColumn] || '').trim();
        if (!rooms) continue;
        
        // Get name using dynamic config
        let name = '';
        const nameColumns = currentConfig.nameColumns;
        
        // Try to build name from configured columns
        const nameParts = [];
        for (const column of nameColumns) {
            const value = (row[column] || '').trim();
            if (value) {
                nameParts.push(value);
            }
        }
        
        if (nameParts.length > 0) {
            name = nameParts.join(' ');
        }
        
        if (!name) {
            name = '予約者不明';
        }
        
        // Split rooms
        const roomList = rooms.split(';').map(r => r.trim()).filter(r => r);
        
        for (const room of roomList) {
            const calendarId = getCalendarIdForRoom(room);
            const timeSlotsStr = getTimeSlotsForRoom(room, row);
            
            if (!timeSlotsStr) continue;
            
            const timeSlots = parseTimeSlots(timeSlotsStr);
            const mergedSlots = mergeContinuousSlots(timeSlots);
            
            for (const slot of mergedSlots) {
                try {
                    const event = {
                        id: String(eventId++),
                        resourceId: calendarId,
                        title: `${name}`,
                        room: room,
                        date: date,
                        startTime: slot.start,
                        endTime: slot.end,
                        color: resourceColors[calendarId] || '#007bff'
                    };
                    events.push(event);
                } catch (error) {
                    console.warn('Error creating event:', error, { date, slot, room });
                }
            }
        }
    }
    
    return events;
}

// Generate date range based on events or current month
function generateDateRange(events = []) {
    if (events.length === 0) {
        // Fallback to current month
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const dates = [];
        for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
            dates.push(new Date(date));
        }
        return dates;
    }
    
    // Get date range from events
    const eventDates = events.map(event => new Date(event.date));
    const minDate = new Date(Math.min(...eventDates));
    const maxDate = new Date(Math.max(...eventDates));
    
    // Extend to show full weeks
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 7); // Show week before
    
    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 7); // Show week after
    
    const dates = [];
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        dates.push(new Date(date));
    }
    
    return dates;
}

// Format date for display
function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[date.getDay()];
    
    return {
        display: `${month}/${day}(${dayOfWeek})`,
        dateString: date.toISOString().split('T')[0]
    };
}

// Render timeline calendar
function renderTimelineCalendar(events) {
    const calendarElement = document.getElementById('calendar');
    
    console.log('Rendering calendar with', events.length, 'events:', events);
    
    if (events.length === 0) {
        calendarElement.innerHTML = '<div class="no-events">予約がありません</div>';
        return;
    }
    
    const dates = generateDateRange(events);
    console.log('Generated dates:', dates.map(d => formatDate(d).dateString));
    
    // Create header
    const header = document.createElement('div');
    header.className = 'timeline-header';
    header.style.gridTemplateColumns = `200px repeat(${dates.length}, 100px)`;
    
    // Resource header cell
    const resourceHeader = document.createElement('div');
    resourceHeader.className = 'timeline-row-header';
    resourceHeader.textContent = '施設';
    header.appendChild(resourceHeader);
    
    // Date headers
    dates.forEach(date => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-day-header';
        dateHeader.textContent = formatDate(date).display;
        header.appendChild(dateHeader);
    });
    
    // Create body
    const body = document.createElement('div');
    body.className = 'timeline-body';
    
    // Create rows for each resource
    getCurrentResources().forEach(resource => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        row.style.gridTemplateColumns = `200px repeat(${dates.length}, 100px)`;
        
        // Resource name cell
        const resourceCell = document.createElement('div');
        resourceCell.className = 'timeline-resource';
        resourceCell.style.backgroundColor = resourceColors[resource.id] + '20'; // Add transparency
        resourceCell.textContent = resource.name;
        row.appendChild(resourceCell);
        
        // Date cells
        dates.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'timeline-cell';
            
            const dateString = formatDate(date).dateString;
            
            // Find events for this resource and date
            const dayEvents = events.filter(event => {
                const match = event.resourceId === resource.id && event.date === dateString;
                if (match) {
                    console.log(`Found event for ${resource.id} on ${dateString}:`, event);
                }
                return match;
            });
            
            console.log(`Events for ${resource.id} on ${dateString}:`, dayEvents);
            
            // Add events to cell
            if (dayEvents.length > 0) {
                dayEvents.forEach(event => {
                    const eventElement = document.createElement('div');
                    eventElement.className = 'timeline-event';
                    eventElement.style.backgroundColor = event.color;
                    eventElement.style.marginBottom = '2px';
                    
                    // Create event content with name, time, and room
                    const eventContent = document.createElement('div');
                    eventContent.style.fontSize = '10px';
                    eventContent.style.lineHeight = '1.1';
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.fontWeight = 'bold';
                    nameDiv.textContent = event.title;
                    
                    const timeDiv = document.createElement('div');
                    timeDiv.style.fontSize = '9px';
                    timeDiv.style.opacity = '0.9';
                    timeDiv.textContent = `${event.startTime}-${event.endTime}`;
                    
                    const roomDiv = document.createElement('div');
                    roomDiv.style.fontSize = '9px';
                    roomDiv.style.opacity = '0.8';
                    roomDiv.textContent = `(${event.room})`;
                    
                    eventContent.appendChild(nameDiv);
                    eventContent.appendChild(timeDiv);
                    eventContent.appendChild(roomDiv);
                    
                    eventElement.appendChild(eventContent);
                    eventElement.title = `${event.title} (${event.room}) - ${event.startTime}〜${event.endTime}`;
                    
                    cell.appendChild(eventElement);
                });
            }
            
            row.appendChild(cell);
        });
        
        body.appendChild(row);
    });
    
    // Clear and rebuild calendar
    calendarElement.innerHTML = '';
    calendarElement.appendChild(header);
    calendarElement.appendChild(body);
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
        return;
    }
    
    // Sort files by last modified date (newest first)
    files.sort((a, b) => b.lastModified - a.lastModified);
    const selectedFile = files[0];
    
    // Show file info
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = `
        <strong>選択されたファイル:</strong> ${selectedFile.name}<br>
        <strong>サイズ:</strong> ${(selectedFile.size / 1024).toFixed(2)} KB<br>
        <strong>最終更新:</strong> ${new Date(selectedFile.lastModified).toLocaleString('ja-JP')}
        ${files.length > 1 ? `<br><em>注意: ${files.length}個のファイルが選択されましたが、最新のファイルのみを使用します</em>` : ''}
    `;
    showElement('fileInfo');
    
    // Hide previous messages
    hideElement('errorMessage');
    hideElement('successMessage');
    
    // Process the file
    processCSVFile(selectedFile);
}

// Process CSV file
function processCSVFile(file) {
    showElement('loading');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let csvText;
            const arrayBuffer = e.target.result;
            
            // Try to detect encoding and convert if necessary
            try {
                // Check if it's Shift-JIS by trying to decode
                const sjisArray = new Uint8Array(arrayBuffer);
                const detectedEncoding = Encoding.detect(sjisArray);
                
                if (detectedEncoding === 'SJIS' || detectedEncoding === 'EUCJP') {
                    // Convert from Shift-JIS to UTF-8
                    const unicodeArray = Encoding.convert(sjisArray, {
                        to: 'UNICODE',
                        from: detectedEncoding
                    });
                    csvText = Encoding.codeToString(unicodeArray);
                } else {
                    // Assume UTF-8
                    csvText = new TextDecoder('utf-8').decode(arrayBuffer);
                }
            } catch (encodingError) {
                console.warn('Encoding detection failed, trying UTF-8:', encodingError);
                csvText = new TextDecoder('utf-8').decode(arrayBuffer);
            }
            
            // Parse CSV
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    hideElement('loading');
                    
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    
                    try {
                        // Load current config from UI
                        loadConfigFromUI();
                        
                        const events = parseCSVData(results.data);
                        eventsData = events;
                        
                        // Render timeline calendar
                        renderTimelineCalendar(events);
                        
                        if (events.length === 0) {
                            showMessage('error', 'CSVファイルから有効な予約データが見つかりませんでした。');
                            document.getElementById('exportPdfBtn').disabled = true;
                        } else {
                            showMessage('success', `${events.length}件の予約をカレンダーに読み込みました。`);
                            document.getElementById('exportPdfBtn').disabled = false;
                        }
                        
                    } catch (parseError) {
                        console.error('Data parsing error:', parseError);
                        showMessage('error', 'データの解析中にエラーが発生しました: ' + parseError.message);
                    }
                },
                error: function(error) {
                    hideElement('loading');
                    console.error('CSV parsing error:', error);
                    showMessage('error', 'CSVファイルの解析に失敗しました: ' + error.message);
                }
            });
            
        } catch (error) {
            hideElement('loading');
            console.error('File processing error:', error);
            showMessage('error', 'ファイルの処理中にエラーが発生しました: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        hideElement('loading');
        showMessage('error', 'ファイルの読み込みに失敗しました。');
    };
    
    // Read as ArrayBuffer to handle encoding detection
    reader.readAsArrayBuffer(file);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize resource colors
    initializeResourceColors();
    
    // Set up file input handler
    document.getElementById('csvFile').addEventListener('change', handleFileSelect);
    
    // Show initial empty state
    document.getElementById('calendar').innerHTML = '<div class="no-events">CSVファイルを選択してください</div>';
    
    // Initialize configuration UI
    initializeConfigUI();
    
    console.log('施設予約タイムラインカレンダー が初期化されました');
});

// Configuration UI functions
function initializeConfigUI() {
    loadConfigFromUI();
    renderFacilityList();
}

function loadPreset(presetName) {
    if (presetName === 'logoform') {
        currentConfig = JSON.parse(JSON.stringify(defaultConfig));
    } else if (presetName === 'custom') {
        // Keep current config or create minimal config
        if (!currentConfig.facilities || currentConfig.facilities.length === 0) {
            currentConfig = {
                dateColumn: 'date',
                roomColumn: 'room',
                nameColumns: ['name'],
                facilities: []
            };
        }
    }
    
    updateConfigUI();
    initializeResourceColors();
}

function updateConfigUI() {
    document.getElementById('dateColumn').value = currentConfig.dateColumn;
    document.getElementById('roomColumn').value = currentConfig.roomColumn;
    document.getElementById('nameColumns').value = currentConfig.nameColumns.join(',');
    renderFacilityList();
}

function loadConfigFromUI() {
    currentConfig.dateColumn = document.getElementById('dateColumn').value;
    currentConfig.roomColumn = document.getElementById('roomColumn').value;
    currentConfig.nameColumns = document.getElementById('nameColumns').value.split(',').map(s => s.trim());
}

function renderFacilityList() {
    const facilityList = document.getElementById('facilityList');
    facilityList.innerHTML = '';
    
    getCurrentResources().forEach((facility, index) => {
        const facilityDiv = document.createElement('div');
        facilityDiv.className = 'facility-config';
        facilityDiv.innerHTML = `
            <div class="config-row">
                <label style="width: 80px;">施設名:</label>
                <input type="text" class="config-input" value="${facility.name}" onchange="updateFacility(${index}, 'name', this.value)">
                <button class="config-button" onclick="removeFacility(${index})" style="background-color: #dc3545;">削除</button>
            </div>
            <div class="config-row">
                <label style="width: 80px;">時間列:</label>
                <input type="text" class="config-input" value="${facility.timeColumn}" onchange="updateFacility(${index}, 'timeColumn', this.value)" placeholder="例: 7:checkbox">
            </div>
            <div class="config-row">
                <label style="width: 80px;">キーワード:</label>
                <input type="text" class="config-input" value="${facility.keywords.join(',')}" onchange="updateFacility(${index}, 'keywords', this.value)" placeholder="例: 会議室,さくら">
            </div>
        `;
        facilityList.appendChild(facilityDiv);
    });
}

function addFacility() {
    const newFacility = {
        id: `facility_${Date.now()}`,
        name: '新しい施設',
        timeColumn: '',
        keywords: ['新しい施設']
    };
    
    currentConfig.facilities.push(newFacility);
    resourceColors[newFacility.id] = generateRandomColor();
    renderFacilityList();
}

function removeFacility(index) {
    const facility = currentConfig.facilities[index];
    delete resourceColors[facility.id];
    currentConfig.facilities.splice(index, 1);
    renderFacilityList();
}

function updateFacility(index, field, value) {
    const facility = currentConfig.facilities[index];
    
    if (field === 'keywords') {
        facility.keywords = value.split(',').map(s => s.trim()).filter(s => s);
    } else if (field === 'name') {
        const oldId = facility.id;
        facility.name = value;
        facility.id = value;
        
        // Update color mapping
        if (resourceColors[oldId]) {
            resourceColors[facility.id] = resourceColors[oldId];
            delete resourceColors[oldId];
        }
    } else {
        facility[field] = value;
    }
}

// Generate weekly date ranges
function getWeeklyRanges(events) {
    if (events.length === 0) return [];
    
    const eventDates = events.map(event => new Date(event.date));
    const minDate = new Date(Math.min(...eventDates));
    const maxDate = new Date(Math.max(...eventDates));
    
    const weeks = [];
    let currentDate = new Date(minDate);
    
    // Start from the beginning of the week (Sunday)
    currentDate.setDate(currentDate.getDate() - currentDate.getDay());
    
    while (currentDate <= maxDate) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Check if this week has any events
        const weekEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= weekStart && eventDate <= weekEnd;
        });
        
        if (weekEvents.length > 0) {
            weeks.push({
                start: weekStart,
                end: weekEnd,
                events: weekEvents
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return weeks;
}

// Create weekly table HTML for PDF export
function createWeeklyTableHTML(week) {
    const weekDates = [];
    for (let d = new Date(week.start); d <= week.end; d.setDate(d.getDate() + 1)) {
        weekDates.push(new Date(d));
    }
    
    let html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: white;">
            <h2 style="text-align: center; margin-bottom: 20px; font-size: 18px;">
                施設予約表 ${formatDate(week.start).display.split('(')[0]} - ${formatDate(week.end).display.split('(')[0]}
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="border: 1px solid #333; padding: 8px; width: 120px; text-align: center;">施設</th>
    `;
    
    weekDates.forEach(date => {
        html += `<th style="border: 1px solid #333; padding: 6px; text-align: center; width: 100px;">${formatDate(date).display}</th>`;
    });
    
    html += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    getCurrentResources().forEach(resource => {
        html += `<tr>`;
        html += `<td style="border: 1px solid #333; padding: 8px; font-weight: bold; background-color: ${resourceColors[resource.id]}20;">${resource.name}</td>`;
        
        weekDates.forEach(date => {
            const dateString = formatDate(date).dateString;
            const dayEvents = week.events.filter(event => 
                event.resourceId === resource.id && event.date === dateString
            );
            
            html += `<td style="border: 1px solid #333; padding: 4px; vertical-align: top; height: 80px;">`;
            
            dayEvents.forEach((event, index) => {
                if (index < 3) { // Limit to 3 events per cell
                    html += `
                        <div style="background-color: ${event.color}; color: white; padding: 2px 4px; margin: 1px 0; border-radius: 3px; font-size: 10px; line-height: 1.2;">
                            <div style="font-weight: bold;">${event.title}</div>
                            <div style="font-size: 9px;">${event.startTime}-${event.endTime}</div>
                            <div style="font-size: 8px;">(${event.room})</div>
                        </div>
                    `;
                } else if (index === 3) {
                    html += `<div style="font-size: 8px; color: #666;">...</div>`;
                }
            });
            
            html += `</td>`;
        });
        
        html += `</tr>`;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Export weekly PDF using html2canvas
async function exportWeeklyPDF() {
    if (eventsData.length === 0) {
        alert('予約データがありません。CSVファイルを読み込んでください。');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const weeks = getWeeklyRanges(eventsData);
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
        if (weekIndex > 0) {
            pdf.addPage();
        }
        
        const week = weeks[weekIndex];
        
        // Create temporary container for the table
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '1200px'; // Fixed width for consistent rendering
        tempContainer.innerHTML = createWeeklyTableHTML(week);
        document.body.appendChild(tempContainer);
        
        try {
            // Convert HTML to canvas
            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 1200,
                height: 600
            });
            
            // Calculate dimensions to fit A4 landscape
            const imgWidth = 277; // A4 landscape width in mm (minus margins)
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Add image to PDF
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('PDF生成中にエラーが発生しました。');
        } finally {
            // Clean up
            document.body.removeChild(tempContainer);
        }
    }
    
    // Save PDF
    const today = new Date();
    const filename = `施設予約表_${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}.pdf`;
    pdf.save(filename);
}