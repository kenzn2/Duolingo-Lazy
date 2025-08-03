let jwtToken = null;
let isExecutionRunning = false;
let executionStopped = false;

// Create context menu on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "duolingo-quick-start",
        title: "🚀 Start Duolingo Lazy",
        contexts: ["page"],
        documentUrlPatterns: ["*://www.duolingo.com/*"]
    });
    
    // Initialize schedule
    chrome.storage.local.get(['autoScheduleEnabled', 'scheduleTime', 'scheduleXP', 'scheduleBonus', 'scheduleDays'], (settings) => {
        if (settings.autoScheduleEnabled) {
            updateSchedule(settings);
        }
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "duolingo-quick-start") {
        // Get default settings and start execution
        chrome.storage.local.get(['defaultXP', 'defaultBonus'], async (result) => {
            const defaultXP = result.defaultXP || 10;
            const defaultBonus = result.defaultBonus || false;
            const totalLessons = Math.ceil(defaultXP / 10);
            
            // Fetch JWT first
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
                    
                    // Start execution with default settings
                    if (!isExecutionRunning) {
                        isExecutionRunning = true;
                        executionStopped = false;
                        
                        // Save execution state
                        chrome.storage.local.set({
                            'executionState': {
                                targetXP: defaultXP,
                                totalLessons: totalLessons,
                                isExecuting: true,
                                timestamp: Date.now()
                            }
                        });
                        
                        // Show notification
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'src/icons/duolingo128.png',
                            title: 'Duolingo Lazy Started',
                            message: `Starting automation for ${defaultXP} XP...`
                        });
                        
                        // Start the automation
                        executeDuolingo(totalLessons, jwtToken, defaultBonus, tab.id);
                    }
                } else {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'src/icons/duolingo128.png',
                        title: 'Duolingo Lazy Error',
                        message: 'Please login to Duolingo first!'
                    });
                }
            });
        });
    }
});

// Auto-schedule management
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'duolingo-schedule') {
        handleScheduledExecution();
    }
});

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
        const [hours, minutes] = settings.scheduleTime.split(':').map(Number);
        
        // Calculate next scheduled time
        const nextRun = new Date();
        nextRun.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        
        // Find next valid day
        while (!settings.scheduleDays.includes(nextRun.getDay())) {
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
    // Get current settings
    chrome.storage.local.get(['autoScheduleEnabled', 'scheduleXP', 'scheduleBonus', 'scheduleDays', 'scheduleNotifications'], async (settings) => {
        if (!settings.autoScheduleEnabled) {
            return;
        }
        
        const today = new Date().getDay();
        if (!settings.scheduleDays.includes(today)) {
            // Re-schedule for next valid day
            updateSchedule(settings);
            return;
        }
        
        // Check if Duolingo tab is open
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, async (tabs) => {
            if (tabs.length === 0) {
                // No Duolingo tab - show notification
                if (settings.scheduleNotifications) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'src/icons/duolingo128.png',
                        title: 'Duolingo Lazy Schedule',
                        message: 'Please open Duolingo website for scheduled execution'
                    });
                }
                
                // Try again in 10 minutes
                chrome.alarms.create('duolingo-schedule', {
                    delayInMinutes: 10
                });
                return;
            }
            
            const tab = tabs[0];
            const targetXP = settings.scheduleXP || 20;
            const enableBonus = settings.scheduleBonus || false;
            const totalLessons = Math.ceil(targetXP / 10);
            
            // Check if already running
            if (isExecutionRunning) {
                console.log('Scheduled execution skipped - already running');
                updateSchedule(settings);
                return;
            }
            
            // Fetch JWT and start execution
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
                            iconUrl: 'src/icons/duolingo128.png',
                            title: 'Duolingo Lazy Scheduled Run',
                            message: `Starting scheduled execution for ${targetXP} XP...`
                        });
                    }
                    
                    // Start execution
                    try {
                        const totalXP = await executeDuolingo(totalLessons, jwtToken, enableBonus, tab.id, true);
                        
                        // Show completion notification for scheduled runs
                        if (settings.scheduleNotifications) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'src/icons/duolingo128.png',
                                title: 'Scheduled Run Completed! 🎉',
                                message: `Successfully earned ${totalXP} XP automatically!`
                            });
                        }
                    } catch (error) {
                        if (settings.scheduleNotifications) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'src/icons/duolingo128.png',
                                title: 'Scheduled Run Failed',
                                message: `Error: ${error.message}`
                            });
                        }
                    }
                } else {
                    if (settings.scheduleNotifications) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'src/icons/duolingo128.png',
                            title: 'Scheduled Run Failed',
                            message: 'Please login to Duolingo first!'
                        });
                    }
                }
                
                // Schedule next run
                updateSchedule(settings);
            });
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetch_jwt") {
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, (tabs) => {
            if (tabs.length > 0) {
                const activeTab = tabs[0];
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
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
                        sendResponse({ jwt: jwtToken });
                    } else {
                        sendResponse({ jwt: null });
                    }
                });
            } else {
                sendResponse({ jwt: null });
            }
        });
        return true;
    }

    if (message.action === "get_jwt") {
        sendResponse({ jwt: jwtToken || null });
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
        
        // Execute the Duolingo function in the background
        Duolingo(lessons, jwt, enableBonus)
            .then(totalXP => {
                console.log(`Duolingo execution completed with ${totalXP} XP`);
            })
            .catch(error => {
                console.error('Duolingo execution failed:', error);
            });
        
        sendResponse({ status: "started" });
        return true;
    }
    
    if (message.action === "stop_execution") {
        executionStopped = true;
        isExecutionRunning = false;
        sendProgressUpdate('duolingo_stopped');
    }
    
    if (message.action === "settings_updated") {
        handleSettingsUpdate(message.settings);
        sendResponse({ status: "settings_updated" });
    }
});

async function duolingoFetchViaContentScript(url, method, headers, body) {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: "*://www.duolingo.com/*" }, (tabs) => {
            if (!tabs.length) {
                resolve({ ok: false, error: "No Duolingo tab found. Please open Duolingo website." });
                return;
            }
            
            const tabId = tabs[0].id;
            
            // Set timeout for response
            const timeout = setTimeout(() => {
                resolve({ ok: false, error: "Content script timeout. Please refresh Duolingo page." });
            }, 10000); // 10 second timeout
            
            chrome.tabs.sendMessage(tabId, {
                action: "duolingo_api",
                url,
                method,
                headers,
                body
            }, (response) => {
                clearTimeout(timeout);
                
                // Handle undefined response or chrome.runtime.lastError
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: `Content script error: ${chrome.runtime.lastError.message}` });
                } else if (!response) {
                    resolve({ ok: false, error: "No response from content script. Please refresh Duolingo page." });
                } else {
                    resolve(response);
                }
            });
        });
    });
}

// Wrapper function for context menu execution
async function executeDuolingo(lessons, jwt, enableBonus, tabId, isScheduled = false) {
    try {
        const totalXP = await Duolingo(lessons, jwt, enableBonus);
        
        // Show completion notification (different for scheduled vs manual)
        const title = isScheduled ? 'Scheduled Run Completed! 🎉' : 'Duolingo Lazy Completed! 🎉';
        const message = isScheduled 
            ? `Successfully earned ${totalXP} XP automatically!`
            : `Successfully earned ${totalXP} XP!`;
            
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'src/icons/duolingo128.png',
            title: title,
            message: message
        });
        
        return totalXP;
    } catch (error) {
        const title = isScheduled ? 'Scheduled Run Error' : 'Duolingo Lazy Error';
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'src/icons/duolingo128.png',
            title: title,
            message: `Error: ${error.message}`
        });
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
