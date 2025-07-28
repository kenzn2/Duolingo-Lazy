// This file contains the JavaScript logic for the popup, handling user interactions and updating the popup's content.
let jwt_key = null;
let isExecuting = false;
let targetXP = 0;
let currentXP = 0;
let totalLessons = 0;
let completedLessons = 0;
let completionShown = false;

// UI Elements
let executeButton, xpInput, bonusCheckbox, progressSection, progressTextSpan, progressBar, expCounter, jwtDisplay, themeToggle;
let progressPollingInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    executeButton = document.getElementById('execute-button');
    xpInput = document.getElementById('xp-input');
    bonusCheckbox = document.getElementById('bonus-checkbox');
    progressSection = document.getElementById('progress-section');
    progressTextSpan = document.getElementById('progress-text-span');
    progressBar = document.getElementById('progress-bar');
    expCounter = document.getElementById('exp-counter');
    jwtDisplay = document.getElementById('jwt-display');
    themeToggle = document.getElementById('theme-toggle');
    
    // Initialize theme
    initializeTheme();
    
    // Check for saved progress state
    checkSavedProgress();
    
    // Initialize checkbox state
    if (bonusCheckbox) {
        bonusCheckbox.checked = true;
    }

    // Theme toggle handler
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Execute button click handler
    if (executeButton) {
        executeButton.addEventListener('click', () => {
            if (!isExecuting) {
                startExecution();
            } else {
                stopExecution();
            }
        });
    }
    
    // We use storage-based polling instead of direct message listener
    // to handle cases when popup is closed during execution
});

// Cleanup when popup is closed
window.addEventListener('beforeunload', () => {
    stopProgressPolling();
});

// Execution Functions
function startExecution() {
    // Reset completion flag
    completionShown = false;
    
    // Remove any previous completion message
    const completionMessage = document.querySelector('.completion-message');
    if (completionMessage) {
        completionMessage.remove();
    }
    
    // Get target XP value
    targetXP = parseInt(xpInput.value || 20, 10);
    totalLessons = Math.ceil(targetXP / 10);
    currentXP = 0;
    completedLessons = 0;

    // Switch to execution state
    isExecuting = true;
    updateUIToExecutionState();

    // Fetch JWT and start execution
    chrome.runtime.sendMessage({ action: 'fetch_jwt' }, (fetchResponse) => {
        chrome.runtime.sendMessage({ action: 'get_jwt' }, (getResponse) => {
            if (getResponse && getResponse.jwt) {
                jwt_key = getResponse.jwt;
                jwtDisplay.textContent = getResponse.jwt.substring(0, 50) + '...';
                
                // Send execution request to background script
                chrome.runtime.sendMessage({ 
                    action: 'execute_duolingo', 
                    lessons: totalLessons, 
                    jwt: jwt_key,
                    enableBonus: bonusCheckbox.checked
                });
            } else {
                showError("JWT token không tìm thấy. Vui lòng đăng nhập Duolingo trước.");
                resetToInitialState();
            }
        });
    });
}

function stopExecution() {
    isExecuting = false;
    
    // Send stop message to background script
    chrome.runtime.sendMessage({ action: 'stop_execution' });
    
    resetToInitialState();
}

// UI Update Functions
function updateUIToExecutionState() {
    // Disable inputs
    xpInput.disabled = true;
    bonusCheckbox.disabled = true;
    bonusCheckbox.parentElement.classList.add('disabled');
    
    // Change button to stop
    executeButton.textContent = 'Dừng';
    executeButton.classList.add('stop');
    
    // Show progress section
    progressSection.classList.remove('hidden');
    updateProgress(0, totalLessons, 0);
    
    // Start polling for progress updates
    startProgressPolling();
}

function resetToInitialState(keepCompletion = false) {
    // Reset execution state
    isExecuting = false;
    
    // Stop polling
    stopProgressPolling();
    
    // Enable inputs
    xpInput.disabled = false;
    bonusCheckbox.disabled = false;
    bonusCheckbox.parentElement.classList.remove('disabled');
    
    // Reset button
    executeButton.textContent = 'Bắt đầu';
    executeButton.classList.remove('stop');
    
    // Hide progress section unless keeping completion
    if (!keepCompletion) {
        progressSection.classList.add('hidden');
        
        // Remove completion message if exists
        const completionMessage = document.querySelector('.completion-message');
        if (completionMessage) {
            completionMessage.remove();
        }
    }
}

function updateProgress(completed, total, xp) {
    completedLessons = completed;
    currentXP = xp;
    
    // Calculate percentage based on actual XP earned vs target XP
    const percentage = targetXP > 0 ? Math.min(100, Math.round((currentXP / targetXP) * 100)) : 0;
    
    // Update UI elements
    if (progressTextSpan) {
        progressTextSpan.textContent = `Hoàn thành: ${percentage}%`;
    }
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    if (expCounter) {
        expCounter.textContent = `Đã đạt: ${currentXP} / ${targetXP} EXP`;
    }
}

function showCompletion(totalXP) {
    // Prevent showing completion multiple times
    if (completionShown) return;
    completionShown = true;
    
    updateProgress(completedLessons, totalLessons, totalXP);
    
    // Show completion message below the progress (like old version)
    setTimeout(() => {
        const completionMessage = document.createElement('div');
        completionMessage.className = 'completion-message';
        completionMessage.innerHTML = `🎉 Hoàn thành! Bạn đã nhận được ${totalXP} XP!`;
        
        // Insert after exp counter
        if (expCounter && expCounter.parentNode) {
            expCounter.parentNode.insertBefore(completionMessage, expCounter.nextSibling);
        }
        
        // Reset UI but keep progress section visible
        setTimeout(() => {
            resetToInitialState(true);
        }, 3000);
    }, 500);
}

function showError(errorMessage) {
    // Make error messages more user-friendly
    let friendlyMessage = errorMessage;
    
    if (errorMessage.includes("Content script error") || errorMessage.includes("No response from content script")) {
        friendlyMessage = "Lỗi kết nối với trang Duolingo. Vui lòng refresh trang Duolingo và thử lại.";
    } else if (errorMessage.includes("No Duolingo tab found")) {
        friendlyMessage = "Không tìm thấy trang Duolingo. Vui lòng mở trang duolingo.com trước.";
    } else if (errorMessage.includes("JWT token is missing")) {
        friendlyMessage = "Chưa đăng nhập Duolingo. Vui lòng đăng nhập vào duolingo.com trước.";
    } else if (errorMessage.includes("timeout")) {
        friendlyMessage = "Kết nối timeout. Vui lòng kiểm tra mạng và thử lại.";
    }
    
    // Show error using alert like old version
    alert(friendlyMessage);
    
    // Reset UI
    resetToInitialState();
}

// Theme management functions
function initializeTheme() {
    // Get saved theme from chrome storage or default to light
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
    
    // Save theme preference
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: newTheme });
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) {
            themeToggle.textContent = '☀️';
            themeToggle.title = 'Chuyển sang chế độ sáng';
        }
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) {
            themeToggle.textContent = '🌙';
            themeToggle.title = 'Chuyển sang chế độ tối';
        }
    }
}

// Check for saved progress state when popup opens
function checkSavedProgress() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['lastProgressUpdate'], function(result) {
            if (result.lastProgressUpdate) {
                const update = result.lastProgressUpdate;
                const timeDiff = Date.now() - update.timestamp;
                
                // Only apply if update is recent (within 5 minutes) and is active progress
                if (timeDiff < 5 * 60 * 1000) {
                    switch (update.type) {
                        case 'duolingo_progress':
                            // Only restore if execution is still in progress
                            isExecuting = true;
                            targetXP = parseInt(xpInput.value || 20, 10);
                            updateUIToExecutionState();
                            updateProgress(update.data.completed, update.data.total, update.data.currentXP);
                            break;
                            
                        // Don't auto-show completed/error states on popup open
                        case 'duolingo_completed':
                        case 'duolingo_error':
                            // Clear old completed states
                            chrome.storage.local.remove(['lastProgressUpdate']);
                            break;
                    }
                }
            }
        });
    }
}

// Progress polling functions
function startProgressPolling() {
    if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
    }
    
    progressPollingInterval = setInterval(() => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['lastProgressUpdate'], function(result) {
                if (result.lastProgressUpdate) {
                    const update = result.lastProgressUpdate;
                    const timeDiff = Date.now() - update.timestamp;
                    
                    // Only process if update is fresh (within 30 seconds)
                    if (timeDiff < 30000) {
                        switch (update.type) {
                            case 'duolingo_progress':
                                updateProgress(update.data.completed, update.data.total, update.data.currentXP);
                                break;
                                
                            case 'duolingo_completed':
                                if (!completionShown) {
                                    showCompletion(update.data.totalXP);
                                }
                                stopProgressPolling();
                                chrome.storage.local.remove(['lastProgressUpdate']);
                                break;
                                
                            case 'duolingo_error':
                                showError(`Lỗi: ${update.data.errorText}`);
                                stopProgressPolling();
                                break;
                        }
                    }
                }
            });
        }
    }, 2000); // Check every 2 seconds
}

function stopProgressPolling() {
    if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
    }
}
