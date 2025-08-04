// Default settings
const DEFAULT_SETTINGS = {
    defaultXP: 10,
    defaultBonus: false,
    autoScheduleEnabled: false,
    scheduleTime: '12:00',
    scheduleXP: 10,
    scheduleBonus: false,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6], // All days
    notificationsEnabled: true,
    scheduleNotifications: true,
    executionDelay: 2,
    autoClosePopup: false
};

// DOM elements
let elements = {};

document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeTheme();
    loadSettings();
    attachEventListeners();
});

function initializeElements() {
    elements = {
        // Theme
        themeToggle: document.getElementById('theme-toggle'),
        
        // Default Settings
        defaultXP: document.getElementById('default-xp'),
        defaultBonus: document.getElementById('default-bonus'),
        
        // Auto Schedule
        autoScheduleEnabled: document.getElementById('auto-schedule-enabled'),
        scheduleSettings: document.getElementById('schedule-settings'),
        scheduleTime: document.getElementById('schedule-time'),
        scheduleXP: document.getElementById('schedule-xp'),
        scheduleBonus: document.getElementById('schedule-bonus'),
        scheduleDays: document.getElementById('schedule-days'),
        
        // Notifications
        notificationsEnabled: document.getElementById('notifications-enabled'),
        scheduleNotifications: document.getElementById('schedule-notifications'),
        
        // Advanced
        executionDelay: document.getElementById('execution-delay'),
        autoClosePopup: document.getElementById('auto-close-popup'),
        
        // Actions
        saveSettings: document.getElementById('save-settings'),
        resetSettings: document.getElementById('reset-settings'),
        exportSettings: document.getElementById('export-settings'),
        importSettings: document.getElementById('import-settings'),
        importFile: document.getElementById('import-file'),
        
        // Schedule Status
        scheduleStatus: document.getElementById('schedule-status'),
        
        // Status
        statusMessage: document.getElementById('status-message')
    };
}

function attachEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Auto schedule toggle
    elements.autoScheduleEnabled.addEventListener('change', () => {
        toggleScheduleSettings();
        updateScheduleStatus();
    });
    
    // Schedule settings change listeners
    elements.scheduleTime.addEventListener('change', updateScheduleStatus);
    elements.scheduleDays.addEventListener('click', updateScheduleStatus);
    
    // Days selector
    elements.scheduleDays.addEventListener('click', handleDaySelection);
    
    // Actions
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    elements.exportSettings.addEventListener('click', exportSettings);
    elements.importSettings.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importSettings);
}

// Theme Management
function initializeTheme() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['theme'], function(result) {
            const savedTheme = result.theme || 'light';
            applyTheme(savedTheme);
        });
    } else {
        applyTheme('light');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    applyTheme(newTheme);
    
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: newTheme });
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeToggle.textContent = '☀️';
        elements.themeToggle.title = 'Switch to light mode';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        elements.themeToggle.textContent = '🌙';
        elements.themeToggle.title = 'Switch to dark mode';
    }
}

// Settings Management
function loadSettings() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), function(result) {
            const settings = { ...DEFAULT_SETTINGS, ...result };
            populateSettings(settings);
        });
    } else {
        populateSettings(DEFAULT_SETTINGS);
    }
}

function populateSettings(settings) {
    // Default Settings
    elements.defaultXP.value = settings.defaultXP;
    elements.defaultBonus.checked = settings.defaultBonus;
    
    // Auto Schedule
    elements.autoScheduleEnabled.checked = settings.autoScheduleEnabled;
    elements.scheduleTime.value = settings.scheduleTime;
    elements.scheduleXP.value = settings.scheduleXP;
    elements.scheduleBonus.checked = settings.scheduleBonus;
    
    // Schedule Days
    const dayButtons = elements.scheduleDays.querySelectorAll('.day-btn');
    dayButtons.forEach(btn => {
        const day = parseInt(btn.dataset.day);
        if (settings.scheduleDays.includes(day)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Notifications
    elements.notificationsEnabled.checked = settings.notificationsEnabled;
    elements.scheduleNotifications.checked = settings.scheduleNotifications;
    
    // Advanced
    elements.executionDelay.value = settings.executionDelay;
    elements.autoClosePopup.checked = settings.autoClosePopup;
    
    // Toggle schedule settings visibility
    toggleScheduleSettings();
    updateScheduleStatus();
}

function updateScheduleStatus() {
    if (!elements.autoScheduleEnabled.checked) {
        elements.scheduleStatus.querySelector('.status-text').textContent = 'Auto-schedule disabled';
        elements.scheduleStatus.querySelector('.status-text').className = 'status-text inactive';
        return;
    }
    
    const scheduleTime = elements.scheduleTime.value;
    const selectedDays = Array.from(elements.scheduleDays.querySelectorAll('.day-btn.active'))
        .map(btn => parseInt(btn.dataset.day));
    
    if (selectedDays.length === 0) {
        elements.scheduleStatus.querySelector('.status-text').textContent = 'No days selected';
        elements.scheduleStatus.querySelector('.status-text').className = 'status-text inactive';
        return;
    }
    
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Find next valid day
    while (!selectedDays.includes(nextRun.getDay())) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const nextRunText = `Next run: ${dayNames[nextRun.getDay()]} at ${scheduleTime}`;
    
    elements.scheduleStatus.querySelector('.status-text').textContent = nextRunText;
    elements.scheduleStatus.querySelector('.status-text').className = 'status-text active';
}

function toggleScheduleSettings() {
    if (elements.autoScheduleEnabled.checked) {
        elements.scheduleSettings.classList.add('enabled');
    } else {
        elements.scheduleSettings.classList.remove('enabled');
    }
}

function handleDaySelection(event) {
    if (event.target.classList.contains('day-btn')) {
        event.target.classList.toggle('active');
        updateScheduleStatus();
    }
}

function gatherSettings() {
    const scheduleDays = Array.from(elements.scheduleDays.querySelectorAll('.day-btn.active'))
        .map(btn => parseInt(btn.dataset.day));
    
    return {
        defaultXP: parseInt(elements.defaultXP.value),
        defaultBonus: elements.defaultBonus.checked,
        autoScheduleEnabled: elements.autoScheduleEnabled.checked,
        scheduleTime: elements.scheduleTime.value,
        scheduleXP: parseInt(elements.scheduleXP.value),
        scheduleBonus: elements.scheduleBonus.checked,
        scheduleDays: scheduleDays,
        notificationsEnabled: elements.notificationsEnabled.checked,
        scheduleNotifications: elements.scheduleNotifications.checked,
        executionDelay: parseInt(elements.executionDelay.value),
        autoClosePopup: elements.autoClosePopup.checked
    };
}

function saveSettings() {
    const settings = gatherSettings();
    
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(settings, function() {
            showStatusMessage('Settings saved successfully! 💾', 'success');
            
            // Update context menu and schedule if needed
            chrome.runtime.sendMessage({
                action: 'settings_updated',
                settings: settings
            });
        });
    } else {
        showStatusMessage('Unable to save settings - Chrome storage not available', 'error');
    }
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
        populateSettings(DEFAULT_SETTINGS);
        showStatusMessage('Settings reset to defaults! 🔄', 'success');
    }
}

function exportSettings() {
    const settings = gatherSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'duolingo-lazy-settings.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showStatusMessage('Settings exported successfully! 📤', 'success');
}

function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSettings = JSON.parse(e.target.result);
            
            // Validate settings
            const validatedSettings = { ...DEFAULT_SETTINGS, ...importedSettings };
            populateSettings(validatedSettings);
            
            showStatusMessage('Settings imported successfully! 📥 Click Save to apply.', 'success');
        } catch (error) {
            showStatusMessage('Invalid settings file format', 'error');
        }
    };
    reader.readAsText(file);
    
    // Clear the file input
    event.target.value = '';
}

function showStatusMessage(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message show ${type}`;
    
    setTimeout(() => {
        elements.statusMessage.classList.remove('show');
    }, 3000);
}

// Listen for theme changes from popup
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'theme_changed') {
            applyTheme(message.theme);
        }
    });
}
