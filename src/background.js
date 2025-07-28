let jwtToken = null;
let isExecutionRunning = false;
let executionStopped = false;

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
