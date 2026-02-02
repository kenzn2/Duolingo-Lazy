// Internationalization (i18n) for Duolingo Lazy Extension

const translations = {
    en: {
        // Popup
        title: "Duolingo Lazy",
        xpLabel: "Desired EXP:",
        bonusLabel: "Get bonus points",
        startButton: "Start",
        stopButton: "Stop",
        reloadButton: "🔄 Reload page",
        progressText: "Progress: {percent}%",
        expCounter: "Earned: {current} / {target} EXP",
        
        // Footer
        rateExtension: "Rate this extension",
        reportIssue: "Report an issue",
        
        // Tooltips
        themeToggle: "Toggle theme",
        languageToggle: "Change language",
        githubLink: "View on GitHub",
        settingsLink: "Settings",
        
        // Messages
        completionMessage: "Congratulations! You've reached {xp} EXP!",
        errorMessage: "An error occurred. Please try again.",
        notDuolingoPage: "Please navigate to a Duolingo lesson page first.",
        
        // Settings page
        settingsTitle: "Settings",
        defaultXPLabel: "Default XP:",
        defaultBonusLabel: "Default bonus setting",
        saveSettings: "Save Settings",
        settingsSaved: "Settings saved successfully!",
        
        // Chrome notification
        extensionName: "Duolingo Lazy"
    },
    vi: {
        // Popup
        title: "Duolingo Lazy",
        xpLabel: "EXP mong muốn:",
        bonusLabel: "Nhận thêm điểm thưởng (Bonus)",
        startButton: "Bắt đầu",
        stopButton: "Dừng lại",
        reloadButton: "🔄 Reload trang",
        progressText: "Hoàn thành: {percent}%",
        expCounter: "Đã đạt: {current} / {target} EXP",
        
        // Footer
        rateExtension: "Đánh giá extension",
        reportIssue: "Báo cáo vấn đề",
        
        // Tooltips
        themeToggle: "Đổi giao diện",
        languageToggle: "Đổi ngôn ngữ",
        githubLink: "Xem trên GitHub",
        settingsLink: "Cài đặt",
        
        // Messages
        completionMessage: "Xin chúc mừng! Bạn đã đạt {xp} EXP!",
        errorMessage: "Đã xảy ra lỗi. Vui lòng thử lại.",
        notDuolingoPage: "Vui lòng truy cập vào trang bài học Duolingo trước.",
        
        // Settings page
        settingsTitle: "Cài đặt",
        defaultXPLabel: "EXP mặc định:",
        defaultBonusLabel: "Cài đặt bonus mặc định",
        saveSettings: "Lưu cài đặt",
        settingsSaved: "Đã lưu cài đặt thành công!",
        
        // Chrome notification
        extensionName: "Duolingo Lazy"
    }
};

// Get browser language and determine default language
function getDefaultLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // Support only English and Vietnamese, default to English for others
    if (langCode === 'vi') {
        return 'vi';
    }
    return 'en';
}

// Get current language from storage or use default
async function getCurrentLanguage() {
    try {
        const result = await chrome.storage.local.get('language');
        return result.language || getDefaultLanguage();
    } catch (error) {
        console.log('Error getting language:', error);
        return getDefaultLanguage();
    }
}

// Set language in storage
async function setLanguage(lang) {
    try {
        await chrome.storage.local.set({ language: lang });
        return true;
    } catch (error) {
        console.log('Error setting language:', error);
        return false;
    }
}

// Get translated text
function t(key, lang, params = {}) {
    const translation = translations[lang] && translations[lang][key] 
        ? translations[lang][key] 
        : translations['en'][key] || key;
    
    // Replace parameters in translation
    let result = translation;
    for (const [param, value] of Object.entries(params)) {
        result = result.replace(`{${param}}`, value);
    }
    
    return result;
}

// Update all UI text elements with translations
async function updateUILanguage() {
    const lang = await getCurrentLanguage();
    
    // Update popup elements
    const xpLabel = document.querySelector('label[for="xp-input"]');
    if (xpLabel) xpLabel.textContent = t('xpLabel', lang);
    
    const bonusLabel = document.querySelector('.checkbox-container');
    if (bonusLabel) {
        const span = bonusLabel.querySelector('span:not(.checkmark)');
        if (!span) {
            // Create text node after checkmark
            const checkmark = bonusLabel.querySelector('.checkmark');
            if (checkmark && checkmark.nextSibling) {
                checkmark.nextSibling.textContent = ' ' + t('bonusLabel', lang);
            }
        }
    }
    
    const executeButton = document.getElementById('execute-button');
    if (executeButton) {
        const isExecuting = executeButton.classList.contains('stop');
        executeButton.textContent = isExecuting ? t('stopButton', lang) : t('startButton', lang);
    }
    
    const reloadButton = document.getElementById('reload-button');
    if (reloadButton) reloadButton.textContent = t('reloadButton', lang);
    
    // Update tooltips
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.title = t('themeToggle', lang);
    
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) languageToggle.title = t('languageToggle', lang);
    
    const githubLink = document.getElementById('github-link');
    if (githubLink) githubLink.title = t('githubLink', lang);
    
    const settingsLink = document.getElementById('settings-link');
    if (settingsLink) settingsLink.title = t('settingsLink', lang);
    
    const rateLink = document.getElementById('rate-link');
    if (rateLink) rateLink.title = t('rateExtension', lang);
    
    const reportLink = document.getElementById('report-link');
    if (reportLink) reportLink.title = t('reportIssue', lang);
    
    // Update settings page if exists
    const settingsTitle = document.querySelector('.settings-title');
    if (settingsTitle) settingsTitle.textContent = t('settingsTitle', lang);
    
    const defaultXPLabel = document.querySelector('label[for="default-xp"]');
    if (defaultXPLabel) defaultXPLabel.textContent = t('defaultXPLabel', lang);
    
    const defaultBonusLabel = document.querySelector('label[for="default-bonus"]');
    if (defaultBonusLabel) defaultBonusLabel.textContent = t('defaultBonusLabel', lang);
    
    const saveButton = document.getElementById('save-settings');
    if (saveButton) saveButton.textContent = t('saveSettings', lang);
}

// Toggle language between English and Vietnamese
async function toggleLanguage() {
    const currentLang = await getCurrentLanguage();
    const newLang = currentLang === 'en' ? 'vi' : 'en';
    await setLanguage(newLang);
    await updateUILanguage();
    
    // Update language toggle button text
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) {
        languageToggle.textContent = newLang === 'en' ? 'VI' : 'EN';
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        t,
        getCurrentLanguage,
        setLanguage,
        updateUILanguage,
        toggleLanguage,
        getDefaultLanguage
    };
}
