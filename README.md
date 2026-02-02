# Duolingo Lazy Extension

A Chrome extension that automates Duolingo lesson completion to help you maintain your learning streak effortlessly.

## ✨ Features

- 🎯 **Auto XP Farming**: Automatically complete lessons to earn desired XP
- � **Multi-language Support**: Switch between English and Vietnamese (auto-detects browser language)
- 🎨 **Beautiful UI**: Modern design with Dark/Light theme support
- 📊 **Real-time Progress**: Live progress tracking with persistence
- 🎁 **Bonus Points**: Option to enable bonus XP rewards
- ⭐ **Quick Rate & Report**: Easy access to rate the extension or report issues
- 🛡️ **Error Handling**: Robust error handling and user-friendly messages
- 💾 **Smart Persistence**: Maintains progress even when popup is closed

## 🎮 How It Works

The extension works entirely client-side by:
1. Extracting your Duolingo JWT token from the browser
2. Creating practice sessions using Duolingo's API
3. Automatically completing lessons to earn XP
4. Tracking progress in real-time with a beautiful UI

## 📁 Project Structure

```
duolingo-lazy/
├── src/
│   ├── background.js        # Service worker for API calls and automation
│   ├── content.js          # Content script for Duolingo page interaction
│   ├── i18n.js             # Internationalization (multi-language support)
│   ├── popup/
│   │   ├── popup.html      # Extension popup UI structure
│   │   ├── popup.js        # Popup logic and user interactions
│   │   └── popup.css       # Modern styling with theme support
│   ├── options/
│   │   ├── options.html    # Settings page structure
│   │   ├── options.js      # Settings page logic
│   │   └── options.css     # Settings page styling
│   └── icons/              # Extension icons
├── manifest.json           # Chrome extension configuration
└── README.md              # This documentation
```

## 🚀 Installation

### Method 1: Chrome Web Store (Recommended)
1. Visit [Chrome Web Store](https://chromewebstore.google.com/detail/omooaaecencefjcahmekmohhpbcmjldi?utm_source=github)
2. Click "Add to Chrome" to install the extension
3. Confirm installation and the extension will be ready to use

### Method 2: From GitHub Releases
1. Go to the [Releases page](https://github.com/kenzn2/Duolingo-Lazy/releases)
2. Download the latest file
3. Extract the ZIP file to a folder
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" (toggle in top right)
6. Click "Load unpacked" and select the extracted folder

### Method 3: Clone from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/kenzn2/Duolingo-Lazy.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the `duolingo-lazy` directory

## 📱 Usage

1. **Login to Duolingo**: Make sure you're logged into [duolingo.com](https://duolingo.com)
2. **Open Extension**: Click the extension icon in your Chrome toolbar
3. **Set Target XP**: Enter your desired XP amount (default: 20)
4. **Enable Bonus** (optional): Check the bonus checkbox for extra XP
5. **Start Automation**: Click "Bắt đầu" to begin automatic lesson completion
6. **Monitor Progress**: Watch real-time progress with the built-in progress bar
7. **Completion**: Extension will show completion message when target XP is reached

## 🎨 Features Showcase

- **🌙 Dark Mode**: Toggle between light and dark themes
- **📊 Progress Tracking**: Real-time progress bar and XP counter  
- **⚡ Smart Resume**: Continues progress even if popup is closed and reopened
- **🎉 Completion Animation**: Beautiful completion message with celebration
- **🛠️ Error Recovery**: User-friendly error messages with helpful guidance

## 🔧 Troubleshooting

- **"Không tìm thấy trang Duolingo"**: 
  - Make sure you have [duolingo.com](https://duolingo.com) open in a tab
  - Ensure you're logged into your Duolingo account

- **"Chưa đăng nhập Duolingo"**: 
  - Log into your Duolingo account first
  - Refresh the Duolingo page and try again

- **"Lỗi kết nối với trang Duolingo"**: 
  - Refresh the Duolingo page
  - Make sure the page has fully loaded
  - Try disabling other extensions temporarily

- **Extension not working**: 
  - Try refreshing both the Duolingo page and reloading the extension
  - Check that you're on the main Duolingo domain (not mobile version)

## ⚠️ Disclaimer

This extension is for educational purposes only. Use responsibly and in accordance with Duolingo's terms of service. The automation is designed to help maintain learning streaks, but real learning comes from genuine practice.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🌟 Support

If you find this extension helpful, please consider giving it a star on GitHub! ⭐
