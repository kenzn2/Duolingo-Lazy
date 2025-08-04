let jwtToken = null;
let isExecutionRunning = false;
let executionStopped = false;

// Constants
const NOTIFICATION_ICON = chrome.runtime.getURL('src/icons/duolingo128.png');

// Load stored JWT token on startup
chrome.storage.local.get(['storedJWT'], (result) => {
    if (result.storedJWT) {
        jwtToken = result.storedJWT;
        console.log('Loaded stored JWT token');
    }
});

// Utility function to validate JWT token
async function isJWTValid(jwt) {
    if (!jwt) return false;
    
    try {
        // Decode JWT payload to check expiration
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Check if token is expired (with 5 minute buffer)
        if (payload.exp && payload.exp < (currentTime + 300)) {
            console.log('JWT token is expired or will expire soon');
            return false;
        }
        
        // Test token with a simple API call
        const testResult = await duolingoFetchViaContentScript(
            `https://www.duolingo.com/2017-06-30/users/${payload.sub}?fields=id`,
            "GET",
            {
                "Authorization": `Bearer ${jwt}`,
                "Content-Type": "application/json"
            },
            undefined
        );
        
        return testResult && testResult.ok;
    } catch (error) {
        console.log('JWT validation failed:', error);
        return false;
    }
}

// Get or refresh JWT token
async function getValidJWT(forceRefresh = false) {
    // If we have a token and not forcing refresh, validate it first
    if (!forceRefresh && jwtToken) {
        const isValid = await isJWTValid(jwtToken);
        if (isValid) {
            console.log('Using existing valid JWT token');
            return jwtToken;
        } else {
            console.log('Stored JWT token is invalid, will refresh');
            jwtToken = null;
            chrome.storage.local.remove('storedJWT');
        }
    }
    
    // Try to get token from any open Duolingo tab
    return new Promise((resolve) => {
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                console.log('No Duolingo tabs found for JWT refresh');
                resolve(null);
                return;
            }
            
            const tab = tabs[0];
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    try {
                        const jwt = document.cookie
                            .split(';')
                            .find(cookie => cookie.includes('jwt_token'))
                            ?.split('=')[1];
                        return jwt || null;
                    } catch (error) {
                        console.error("Error retrieving JWT:", error);
                        return null;
                    }
                }
            }, (results) => {
                if (results && results[0]?.result) {
                    jwtToken = results[0].result;
                    // Store token for future use
                    chrome.storage.local.set({ 'storedJWT': jwtToken });
                    console.log('JWT token refreshed and stored');
                    resolve(jwtToken);
                } else {
                    console.log('Failed to retrieve JWT from page');
                    resolve(null);
                }
            });
        });
    });
}

// Auto-create Duolingo tab if needed
async function ensureDuolingoTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, (tabs) => {
            if (tabs.length > 0) {
                resolve(tabs[0]);
            } else {
                // Create new Duolingo tab
                chrome.tabs.create({ 
                    url: 'https://www.duolingo.com/learn',
                    active: false  // Don't switch to the tab
                }, (newTab) => {
                    // Wait a bit for the page to load
                    setTimeout(() => {
                        resolve(newTab);
                    }, 3000);
                });
            }
        });
    });
}
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "duolingo-quick-start",
        title: "🚀 Start Duolingo Lazy",
        contexts: ["page"],
        documentUrlPatterns: ["*://www.duolingo.com/*"]
    });
    
    // Initialize schedule
    initializeSchedule();
});

// Handle Chrome startup (when browser restarts)
chrome.runtime.onStartup.addListener(() => {
    console.log('Chrome startup detected - reinitializing schedule');
    initializeSchedule();
});

function initializeSchedule() {
    chrome.storage.local.get([
        'autoScheduleEnabled', 
        'scheduleTime', 
        'scheduleXP', 
        'scheduleBonus', 
        'scheduleDays',
        'scheduleNotifications'
    ], (settings) => {
        if (settings.autoScheduleEnabled) {
            console.log('Auto-schedule enabled, setting up alarms...');
            
            // Check if we missed any scheduled runs
            checkMissedSchedules(settings);
            
            // Set up next schedule
            updateSchedule(settings);
        }
    });
}

function checkMissedSchedules(settings) {
    // Get last execution time
    chrome.storage.local.get(['lastScheduledExecution'], (data) => {
        const lastExecution = data.lastScheduledExecution || 0;
        const now = new Date();
        
        // Validate scheduleTime and provide default
        const scheduleTime = settings.scheduleTime || '09:00';
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        
        // Validate parsed time
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error('Invalid schedule time for missed check:', scheduleTime);
            return;
        }
        
        // Validate scheduleDays and provide default
        const scheduleDays = settings.scheduleDays || [1, 2, 3, 4, 5]; // Mon-Fri default
        
        // Check if we missed today's schedule
        const todaySchedule = new Date();
        todaySchedule.setHours(hours, minutes, 0, 0);
        
        // If today is a scheduled day and time has passed and we haven't run today
        if (scheduleDays.includes(now.getDay()) && 
            now > todaySchedule && 
            lastExecution < todaySchedule.getTime()) {
            
            console.log('Missed schedule detected for today');
            
            // Show notification about missed schedule
            if (settings.scheduleNotifications) {
                chrome.notifications.create('missed-schedule', {
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Duolingo Lazy - Missed Schedule',
                    message: `Missed scheduled run at ${scheduleTime}. Click to run now or wait for tomorrow.`,
                    buttons: [
                        { title: 'Run Now' },
                        { title: 'Skip' }
                    ]
                });
            }
        }
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "duolingo-quick-start") {
        // Get default settings and start execution
        chrome.storage.local.get(['defaultXP', 'defaultBonus'], async (result) => {
            const defaultXP = result.defaultXP || 10;
            const defaultBonus = result.defaultBonus || false;
            const totalLessons = Math.ceil(defaultXP / 10);
            
            // Check if already running
            if (isExecutionRunning) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Duolingo Lazy',
                    message: 'Another execution is already running!'
                });
                return;
            }
            
            // Try to get valid JWT token
            let jwt = await getValidJWT();
            
            // If no JWT and we're on Duolingo page, try to get it
            if (!jwt && tab.url.includes('duolingo.com')) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        try {
                            const jwt = document.cookie
                                .split(';')
                                .find(cookie => cookie.includes('jwt_token'))
                                ?.split('=')[1];
                            return jwt || null;
                        } catch (error) {
                            console.error("Error retrieving JWT:", error);
                            return null;
                        }
                    }
                }, async (results) => {
                    if (results && results[0]?.result) {
                        jwtToken = results[0].result;
                        // Store the new token
                        chrome.storage.local.set({ 'storedJWT': jwtToken });
                        
                        // Start execution
                        await startContextMenuExecution(defaultXP, defaultBonus, totalLessons, tab.id);
                    } else {
                        showJWTError(tab.id);
                    }
                });
            } else if (jwt) {
                // We have a valid JWT, start execution
                await startContextMenuExecution(defaultXP, defaultBonus, totalLessons, tab.id);
            } else {
                showJWTError(tab.id);
            }
        });
    }
});

async function startContextMenuExecution(defaultXP, defaultBonus, totalLessons, tabId) {
    try {
        // Show alert and wait for user to click OK before starting
        if (tabId) {
            await new Promise((resolve) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (xp) => {
                        const confirmed = confirm(`🚀 Duolingo Lazy sẵn sàng!\n\nSẽ thực hiện tự động cho ${xp} XP.\n\nNhấn OK để bắt đầu ngay!`);
                        return confirmed;
                    },
                    args: [defaultXP]
                }, (results) => {
                    if (results && results[0]?.result) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }).then(async (confirmed) => {
                if (!confirmed) {
                    // User cancelled, stop execution
                    isExecutionRunning = false;
                    return;
                }
                
                // User confirmed, start execution immediately
                isExecutionRunning = true;
                executionStopped = false;
                
                // Save execution state to mark as running
                chrome.storage.local.set({
                    'executionState': {
                        targetXP: defaultXP,
                        totalLessons: totalLessons,
                        isExecuting: true,
                        timestamp: Date.now(),
                        contextMenu: true // Mark as context menu execution
                    }
                });
                
                // Start the automation
                await executeDuolingo(totalLessons, jwtToken, defaultBonus, tabId);
            });
        } else {
            // No tab ID, start directly
            isExecutionRunning = true;
            executionStopped = false;
            
            // Save execution state
            chrome.storage.local.set({
                'executionState': {
                    targetXP: defaultXP,
                    totalLessons: totalLessons,
                    isExecuting: true,
                    timestamp: Date.now(),
                    contextMenu: true
                }
            });
            
            await executeDuolingo(totalLessons, jwtToken, defaultBonus, tabId);
        }
        
    } catch (error) {
        isExecutionRunning = false;
        chrome.storage.local.remove('executionState');
        console.error('Context menu execution failed:', error);
    }
}

function showJWTError(tabId = null) {
    if (tabId) {
        // Show alert on webpage if we have a tab ID
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                alert(`❌ Duolingo Lazy lỗi!\n\nVui lòng đăng nhập vào Duolingo trước!`);
            }
        }).catch(error => {
            console.log('Could not show JWT error alert on page:', error);
            // Fallback to notification if alert fails
            chrome.notifications.create({
                type: 'basic',
                iconUrl: NOTIFICATION_ICON,
                title: 'Duolingo Lazy Error',
                message: 'Please login to Duolingo first!',
                buttons: [
                    { title: 'Open Duolingo' }
                ]
            });
        });
    } else {
        // No tab available, use notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Duolingo Lazy Error',
            message: 'Please login to Duolingo first!',
            buttons: [
                { title: 'Open Duolingo' }
            ]
        });
    }
}

// Auto-schedule management
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'duolingo-schedule') {
        handleScheduledExecution();
    }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === 'missed-schedule') {
        if (buttonIndex === 0) { // Run Now button
            // Trigger immediate execution
            chrome.storage.local.get([
                'scheduleXP', 
                'scheduleBonus', 
                'scheduleNotifications'
            ], (settings) => {
                executeMissedScheduleOptimized(settings);
            });
        }
        // Clear the notification
        chrome.notifications.clear(notificationId);
    } else if (notificationId.startsWith('chrome-extension://') && notificationId.includes('scheduled')) {
        // Handle scheduled execution notification buttons
        if (buttonIndex === 0) { // Open Duolingo button
            chrome.tabs.create({ url: 'https://www.duolingo.com/learn' });
        } else if (buttonIndex === 1) { // Retry in 10 min button
            chrome.alarms.create('duolingo-schedule', {
                delayInMinutes: 10
            });
        }
        chrome.notifications.clear(notificationId);
    } else {
        // Handle other notification types that might have "Open Duolingo" button
        if (buttonIndex === 0) { // Likely "Open Duolingo" button
            chrome.tabs.create({ url: 'https://www.duolingo.com/learn' });
        }
        chrome.notifications.clear(notificationId);
    }
});

async function executeMissedSchedule(tab, settings) {
    const targetXP = settings.scheduleXP || 20;
    const enableBonus = settings.scheduleBonus || false;
    const totalLessons = Math.ceil(targetXP / 10);
    
    // Check if already running
    if (isExecutionRunning) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Duolingo Lazy',
            message: 'Another execution is already running!'
        });
        return;
    }
    
    // Get JWT and execute
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
                const jwt = document.cookie
                    .split(';')
                    .find(cookie => cookie.includes('jwt_token'))
                    ?.split('=')[1];
                return jwt || null;
            } catch (error) {
                console.error("Error retrieving JWT:", error);
                return null;
            }
        }
    }, async (results) => {
        if (results && results[0]?.result) {
            jwtToken = results[0].result;
            
            // Show start notification
            const showNotification = settings.scheduleNotifications !== false;
            if (showNotification) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Duolingo Lazy - Manual Run',
                    message: `Starting manual execution for ${targetXP} XP...`
                });
            }
            
            try {
                isExecutionRunning = true;
                executionStopped = false;
                
                // Save execution state
                chrome.storage.local.set({
                    'executionState': {
                        targetXP: targetXP,
                        totalLessons: totalLessons,
                        isExecuting: true,
                        timestamp: Date.now(),
                        scheduledRun: true
                    }
                });
                
                await executeDuolingo(totalLessons, jwtToken, enableBonus, tab.id, true);
                
                isExecutionRunning = false;
                
                // Mark as executed and clear execution state
                chrome.storage.local.set({
                    'lastScheduledExecution': Date.now()
                });
                chrome.storage.local.remove('executionState');
                
            } catch (error) {
                isExecutionRunning = false;
                chrome.storage.local.remove('executionState');
                console.error('Manual execution failed:', error);
            }
        } else {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: NOTIFICATION_ICON,
                title: 'Duolingo Lazy Error',
                message: 'Please login to Duolingo first!'
            });
        }
    });
}

// Optimized version that doesn't require tab to be open
async function executeMissedScheduleOptimized(settings) {
    const targetXP = settings.scheduleXP || 20;
    const enableBonus = settings.scheduleBonus || false;
    const totalLessons = Math.ceil(targetXP / 10);
    
    // Check if already running
    if (isExecutionRunning) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Duolingo Lazy',
            message: 'Another execution is already running!'
        });
        return;
    }
    
    // Try to get valid JWT token
    let jwt = await getValidJWT();
    
    if (!jwt) {
        // Try to ensure we have a Duolingo tab and get JWT
        try {
            await ensureDuolingoTab();
            // Wait a bit more for login state to be available
            await new Promise(resolve => setTimeout(resolve, 2000));
            jwt = await getValidJWT();
        } catch (error) {
            console.log('Failed to create Duolingo tab:', error);
        }
    }
    
    if (!jwt) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Duolingo Lazy',
            message: 'Please login to Duolingo website first!',
            buttons: [
                { title: 'Open Duolingo' }
            ]
        });
        return;
    }
    
    // Show start notification
    const showNotification = settings.scheduleNotifications !== false;
    if (showNotification) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Duolingo Lazy - Manual Run',
            message: `Starting manual execution for ${targetXP} XP...`
        });
    }
    
    try {
        isExecutionRunning = true;
        executionStopped = false;
        
        // Save execution state
        chrome.storage.local.set({
            'executionState': {
                targetXP: targetXP,
                totalLessons: totalLessons,
                isExecuting: true,
                timestamp: Date.now(),
                scheduledRun: true
            }
        });
        
        await executeDuolingo(totalLessons, jwt, enableBonus, null, true);
        
        isExecutionRunning = false;
        
        // Mark as executed and clear execution state
        chrome.storage.local.set({
            'lastScheduledExecution': Date.now()
        });
        chrome.storage.local.remove('executionState');
        
    } catch (error) {
        isExecutionRunning = false;
        chrome.storage.local.remove('executionState');
        
        // If JWT became invalid during execution, clear it
        if (error.message.includes('JWT') || error.message.includes('401')) {
            jwtToken = null;
            chrome.storage.local.remove('storedJWT');
        }
        
        console.error('Manual execution failed:', error);
    }
}

// Settings update handler
function handleSettingsUpdate(settings) {
    // Update context menu visibility
    updateContextMenu();
    
    // Update schedule
    updateSchedule(settings);
}

function updateContextMenu() {
    // Context menu always available, no changes needed for now
    // Could add conditional visibility based on settings in future
}

function updateSchedule(settings) {
    // Clear existing alarm
    chrome.alarms.clear('duolingo-schedule');
    
    if (settings.autoScheduleEnabled) {
        const now = new Date();
        
        // Validate scheduleTime and provide default
        const scheduleTime = settings.scheduleTime || '09:00';
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        
        // Validate parsed time
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error('Invalid schedule time:', scheduleTime, 'Using default 09:00');
            return;
        }
        
        // Calculate next scheduled time
        const nextRun = new Date();
        nextRun.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        
        // Validate scheduleDays and provide default
        const scheduleDays = settings.scheduleDays || [1, 2, 3, 4, 5]; // Mon-Fri default
        
        // Find next valid day
        while (!scheduleDays.includes(nextRun.getDay())) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        
        // Create alarm
        chrome.alarms.create('duolingo-schedule', {
            when: nextRun.getTime()
        });
        
        console.log(`Auto-schedule set for: ${nextRun.toLocaleString()}`);
    }
}

async function handleScheduledExecution() {
    // Get current settings - include scheduleTime for proper rescheduling
    chrome.storage.local.get([
        'autoScheduleEnabled', 
        'scheduleTime', 
        'scheduleXP', 
        'scheduleBonus', 
        'scheduleDays', 
        'scheduleNotifications'
    ], async (settings) => {
        if (!settings.autoScheduleEnabled) {
            return;
        }
        
        const today = new Date().getDay();
        if (!settings.scheduleDays.includes(today)) {
            // Re-schedule for next valid day
            updateSchedule(settings);
            return;
        }
        
        // Check if already running
        if (isExecutionRunning) {
            console.log('Scheduled execution skipped - already running');
            updateSchedule(settings);
            return;
        }
        
        const targetXP = settings.scheduleXP || 20;
        const enableBonus = settings.scheduleBonus || false;
        const totalLessons = Math.ceil(targetXP / 10);
        
        // Try to get valid JWT token
        let jwt = await getValidJWT();
        
        if (!jwt) {
            // Try to ensure we have a Duolingo tab and get JWT
            try {
                await ensureDuolingoTab();
                // Wait a bit more for login state to be available
                await new Promise(resolve => setTimeout(resolve, 2000));
                jwt = await getValidJWT();
            } catch (error) {
                console.log('Failed to create Duolingo tab:', error);
            }
        }
        
        if (!jwt) {
            // Still no JWT - show notification and retry later
            if (settings.scheduleNotifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Duolingo Lazy Schedule',
                    message: 'Please login to Duolingo website for scheduled execution',
                    buttons: [
                        { title: 'Open Duolingo' },
                        { title: 'Retry in 10 min' }
                    ]
                });
            }
            
            // Try again in 10 minutes
            chrome.alarms.create('duolingo-schedule', {
                delayInMinutes: 10
            });
            return;
        }
        
        // Save execution state
        chrome.storage.local.set({
            'executionState': {
                targetXP: targetXP,
                totalLessons: totalLessons,
                isExecuting: true,
                timestamp: Date.now(),
                scheduledRun: true
            }
        });
        
        // Show notification
        if (settings.scheduleNotifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: NOTIFICATION_ICON,
                title: 'Duolingo Lazy Scheduled Run',
                message: `Starting scheduled execution for ${targetXP} XP...`
            });
        }
        
        // Start execution
        try {
            isExecutionRunning = true;
            executionStopped = false;
            
            console.log(`[SCHEDULED] Starting execution with ${totalLessons} lessons, JWT: ${jwt ? 'Available' : 'Missing'}`);
            
            const totalXP = await executeDuolingo(totalLessons, jwt, enableBonus, null, true);
            
            console.log(`[SCHEDULED] Execution completed with ${totalXP} XP`);
            
            isExecutionRunning = false;
            
            // Mark as executed and clear execution state
            chrome.storage.local.set({
                'lastScheduledExecution': Date.now()
            });
            chrome.storage.local.remove('executionState');
            
        } catch (error) {
            console.error('[SCHEDULED] Execution failed:', error);
            isExecutionRunning = false;
            chrome.storage.local.remove('executionState');
            
            // If JWT became invalid during execution, clear it
            if (error.message.includes('JWT') || error.message.includes('401')) {
                jwtToken = null;
                chrome.storage.local.remove('storedJWT');
            }
        }
        
        // Schedule next run
        updateSchedule(settings);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetch_jwt") {
        // Try to get JWT from storage first, then from page if needed
        getValidJWT().then(jwt => {
            sendResponse({ jwt: jwt });
        }).catch(() => {
            sendResponse({ jwt: null });
        });
        return true;
    }

    if (message.action === "get_jwt") {
        sendResponse({ jwt: jwtToken || null });
    }
    
    if (message.action === "get_execution_status") {
        sendResponse({ 
            isRunning: isExecutionRunning,
            isStopped: executionStopped
        });
    }
    
    if (message.action === "execute_duolingo") {
        if (isExecutionRunning) {
            sendResponse({ error: "Execution already running" });
            return;
        }
        
        const lessons = message.lessons;
        const jwt = message.jwt;
        const enableBonus = message.enableBonus || false;
        
        console.log(`Starting Duolingo execution: ${lessons} lessons, bonus: ${enableBonus}`);
        
        isExecutionRunning = true;
        executionStopped = false;
        
        // Save execution state for popup synchronization
        chrome.storage.local.set({
            'executionState': {
                targetXP: lessons * 10, // Estimate target XP
                totalLessons: lessons,
                isExecuting: true,
                timestamp: Date.now()
            }
        });
        
        // Execute the Duolingo function in the background
        Duolingo(lessons, jwt, enableBonus)
            .then(totalXP => {
                console.log(`Duolingo execution completed with ${totalXP} XP`);
                isExecutionRunning = false;
                // Clear execution state
                chrome.storage.local.remove('executionState');
            })
            .catch(error => {
                console.error('Duolingo execution failed:', error);
                isExecutionRunning = false;
                // Clear execution state
                chrome.storage.local.remove('executionState');
            });
        
        sendResponse({ status: "started" });
        return true;
    }
    
    if (message.action === "stop_execution") {
        executionStopped = true;
        isExecutionRunning = false;
        // Clear execution state when stopped
        chrome.storage.local.remove('executionState');
        sendProgressUpdate('duolingo_stopped');
    }
    
    if (message.action === "settings_updated") {
        handleSettingsUpdate(message.settings);
        sendResponse({ status: "settings_updated" });
    }
});

async function duolingoFetchViaContentScript(url, method, headers, body) {
    // Prioritize content script for reliable communication
    return new Promise((resolve) => {
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, (tabs) => {
            if (tabs.length > 0) {
                // We have a Duolingo tab, use content script
                const tabId = tabs[0].id;
                
                const timeout = setTimeout(() => {
                    console.log('Content script timeout');
                    resolve({ ok: false, error: "Content script timeout" });
                }, 10000); // 10 seconds timeout
                
                chrome.tabs.sendMessage(tabId, {
                    action: "duolingo_api",
                    url,
                    method,
                    headers,
                    body
                }, (response) => {
                    clearTimeout(timeout);
                    
                    if (chrome.runtime.lastError || !response) {
                        console.log('Content script failed:', chrome.runtime.lastError?.message);
                        resolve({ ok: false, error: "Content script failed" });
                    } else {
                        console.log('Content script response received successfully');
                        resolve(response);
                    }
                });
            } else {
                resolve({ ok: false, error: "No Duolingo tab found" });
            }
        });
    });
}

// Wrapper function for context menu execution
async function executeDuolingo(lessons, jwt, enableBonus, tabId, isScheduled = false) {
    try {
        const totalXP = await Duolingo(lessons, jwt, enableBonus);
        
        // Clear execution state when completed
        if (!isScheduled) {
            chrome.storage.local.remove('executionState');
        }
        
        // Show completion notification/alert based on execution type
        if (isScheduled) {
            // For scheduled runs, check if notifications are enabled
            const settings = await new Promise(resolve => {
                chrome.storage.local.get(['scheduleNotifications'], (result) => {
                    console.log('Schedule notification settings:', result);
                    resolve(result);
                });
            });
            
            // Default to true if not set, or if explicitly enabled
            const showNotification = settings.scheduleNotifications !== false;
            
            console.log('Should show scheduled completion notification:', showNotification);
            
            if (showNotification) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Scheduled Run Completed! 🎉',
                    message: `Successfully earned ${totalXP} XP automatically!`
                });
            }
        } else {
            // For manual runs (context menu), only show alert on webpage
            if (tabId) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (earnedXP) => {
                        alert(`🎉 Duolingo Lazy hoàn thành!\n\nĐã kiếm được ${earnedXP} XP thành công!`);
                        // Reload page to show updated results
                        window.location.reload();
                    },
                    args: [totalXP]
                }).catch(error => {
                    console.log('Could not show completion alert on page:', error);
                });
            }
        }
        
        return totalXP;
    } catch (error) {
        // Clear execution state on error
        if (!isScheduled) {
            chrome.storage.local.remove('executionState');
        }
        
        // Show error notification/alert based on execution type
        if (isScheduled) {
            // For scheduled runs, check if notifications are enabled
            const settings = await new Promise(resolve => {
                chrome.storage.local.get(['scheduleNotifications'], (result) => {
                    resolve(result);
                });
            });
            
            // Default to true if not set, or if explicitly enabled
            const showNotification = settings.scheduleNotifications !== false;
            
            if (showNotification) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: NOTIFICATION_ICON,
                    title: 'Scheduled Run Error',
                    message: `Error: ${error.message}`
                });
            }
        } else {
            // For manual runs (context menu), only show alert on webpage
            if (tabId) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (errorMessage) => {
                        alert(`❌ Duolingo Lazy lỗi!\n\nLỗi: ${errorMessage}`);
                        // Reload page in case of error to reset state
                        window.location.reload();
                    },
                    args: [error.message]
                }).catch(consoleError => {
                    console.log('Could not show error alert on page:', consoleError);
                });
            }
        }
        
        throw error;
    }
}

async function Duolingo(LESSONS, DUOLINGO_JWT, ENABLE_BONUS = false) {
    try {
        if (!DUOLINGO_JWT) {
            sendProgressUpdate('duolingo_error', { errorText: "JWT token is missing" });
            isExecutionRunning = false;
            return 0;
        }

        // Headers chuẩn browser
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DUOLINGO_JWT}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.duolingo.com/learn",
            "Origin": "https://www.duolingo.com",
            "DNT": "1",
            "Connection": "keep-alive"
        };

        // Giải mã JWT để lấy user id
        const jwtPayload = DUOLINGO_JWT.split(".")[1];
        const decodedPayload = JSON.parse(atob(jwtPayload));
        const sub = decodedPayload.sub;
        
        // Lấy ngôn ngữ
        const userResult = await duolingoFetchViaContentScript(
            `https://www.duolingo.com/2017-06-30/users/${sub}?fields=fromLanguage,learningLanguage`,
            "GET",
            headers,
            undefined
        );
        
        if (!userResult || !userResult.ok) {
            const errorMsg = userResult?.error || `Failed to fetch user data (${userResult?.status || 'unknown'})`;
            sendProgressUpdate('duolingo_error', { errorText: errorMsg });
            isExecutionRunning = false;
            return 0;
        }
        const { fromLanguage, learningLanguage } = JSON.parse(userResult.body);
        
        let xp = 0;
        for (let i = 0; i < LESSONS; i++) {
            // Check if execution was stopped
            if (executionStopped) {
                isExecutionRunning = false;
                return xp;
            }
            
            try {
                const sessionBody = {
                    challengeTypes: [
                        "assist", "characterIntro", "characterMatch", "characterPuzzle", "characterSelect", "characterTrace", "characterWrite", "completeReverseTranslation", "definition", "dialogue", "extendedMatch", "extendedListenMatch", "form", "freeResponse", "gapFill", "judge", "listen", "listenComplete", "listenMatch", "match", "name", "listenComprehension", "listenIsolation", "listenSpeak", "listenTap", "orderTapComplete", "partialListen", "partialReverseTranslate", "patternTapComplete", "radioBinary", "radioImageSelect", "radioListenMatch", "radioListenRecognize", "radioSelect", "readComprehension", "reverseAssist", "sameDifferent", "select", "selectPronunciation", "selectTranscription", "svgPuzzle", "syllableTap", "syllableListenTap", "speak", "tapCloze", "tapClozeTable", "tapComplete", "tapCompleteTable", "tapDescribe", "translate", "transliterate", "transliterationAssist", "typeCloze", "typeClozeTable", "typeComplete", "typeCompleteTable", "writeComprehension"
                    ],
                    fromLanguage,
                    isFinalLevel: false,
                    isV2: true,
                    juicy: true,
                    learningLanguage,
                    smartTipsVersion: 2,
                    type: "GLOBAL_PRACTICE",
                    enableBonusPoints: ENABLE_BONUS
                };
                
                const sessionResult = await duolingoFetchViaContentScript(
                    "https://www.duolingo.com/2017-06-30/sessions",
                    "POST",
                    headers,
                    sessionBody
                );
                
                if (!sessionResult || !sessionResult.ok) {
                    const errorMsg = sessionResult?.error || `Session creation failed (${sessionResult?.status || 'unknown'}): ${sessionResult?.body?.substring(0, 200) || 'no response'}`;
                    sendProgressUpdate('duolingo_error', { errorText: errorMsg });
                    isExecutionRunning = false;
                    return xp;
                }
                
                const session = JSON.parse(sessionResult.body);
                
                // --- PUT SESSION UPDATE ---
                // Clone toàn bộ object trả về từ POST, chỉ cập nhật các trường cần thiết
                const putBody = {
                    ...session,
                    heartsLeft: 0,
                    startTime: Math.floor(Date.now() / 1000) - 60,
                    enableBonusPoints: ENABLE_BONUS,
                    endTime: Math.floor(Date.now() / 1000),
                    failed: false,
                    maxInLessonStreak: 9,
                    shouldLearnThings: true
                };
                
                const putResult = await duolingoFetchViaContentScript(
                    `https://www.duolingo.com/2017-06-30/sessions/${session.id}`,
                    "PUT",
                    headers,
                    putBody
                );
                
                if (!putResult || !putResult.ok) {
                    const errorMsg = putResult?.error || `Session update failed (${putResult?.status || 'unknown'}): ${putResult?.body?.substring(0, 200) || 'no response'}`;
                    sendProgressUpdate('duolingo_error', { errorText: errorMsg });
                    isExecutionRunning = false;
                    return xp;
                }
                
                const sessionResultObj = JSON.parse(putResult.body);
                const gainedXP = sessionResultObj.xpGain;
                xp += gainedXP;
                
                console.log(`Lesson ${i + 1}/${LESSONS} completed. Gained ${gainedXP} XP. Total: ${xp} XP`);
                
                // Send progress update AFTER completing the lesson
                sendProgressUpdate('duolingo_progress', { 
                    completed: i + 1, 
                    total: LESSONS,
                    currentXP: xp
                });
                
                console.log('Progress update sent for lesson', i + 1);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (err) {
                sendProgressUpdate('duolingo_error', { errorText: `Exception in session creation: ${err.message}` });
                isExecutionRunning = false;
                return xp;
            }
        }

        console.log(`All lessons completed! Total XP gained: ${xp}`);
        sendProgressUpdate('duolingo_completed', { totalXP: xp });
        isExecutionRunning = false;
        return xp;
    } catch (error) {
        sendProgressUpdate('duolingo_error', { errorText: error.message });
        isExecutionRunning = false;
        return 0;
    }
}

// Helper function to send progress updates to the popup
function sendProgressUpdate(type, data) {
    // Send message to popup if it's open
    chrome.runtime.sendMessage({
        type: type,
        ...data
    }).catch((error) => {
        // Popup is likely closed, that's fine
    });
    
    // Also save to storage for popup to read when it opens
    chrome.storage.local.set({
        lastProgressUpdate: {
            type: type,
            data: data,
            timestamp: Date.now()
        }
    });
}
