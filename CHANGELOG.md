# Changelog

All notable changes to Duolingo Lazy extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-08-05

### Added
- **Context menu integration**: Right-click on any page to quickly execute Duolingo automation
- **Auto-schedule system**: Schedule automatic XP farming at specific times with daily recurrence
- **Advanced settings page**: Comprehensive configuration interface with theme support
- **Schedule status display**: Real-time display of next scheduled run time
- **Chrome alarms API**: Background scheduling system for automated execution
- **Notification system**: Alerts for execution start, completion, and errors
- **Settings import/export**: Backup and restore extension configuration
- **Time picker interface**: User-friendly time selection with AM/PM format

### Changed
- **Button layout**: Reorganized popup footer with Settings button rightmost, GitHub button adjacent
- **Default values**: Updated to 10 XP target and disabled bonus across all interfaces
- **Auto-schedule defaults**: All days selected by default, 12:00 PM default time
- **UI optimization**: Removed verbose setting descriptions for cleaner interface
- **Time format**: Restored AM/PM format with clear labeling for better UX

### Fixed
- **Progress display bug**: Fixed issue where progress wasn't shown when using context menu execution
- **Execution state synchronization**: Unified state management between popup and context menu
- **JWT token persistence**: Improved token validation and storage across browser sessions
- **Settings persistence**: Enhanced Chrome storage integration for reliable configuration saving

### Technical Details
- Added `contextMenus`, `alarms`, and `notifications` permissions to manifest
- Implemented comprehensive background script with schedule management
- Enhanced content script with health check mechanism
- Added CSS improvements for time input styling and responsive design
- Implemented execution state synchronization between different interface methods

## [1.2.0] - 2025-08-02

### Added
- **Page reload feature**: New reload button to refresh Duolingo page after automation completes
- **"tabs" permission**: Added to manifest for reload functionality

### Changed
- **Default XP setting**: Changed from 20 to 10 EXP for better user experience
- **Default bonus setting**: Bonus checkbox now unchecked by default
- **Reload button styling**: Consistent design with main action button (green background, white text)

### Fixed
- **UI consistency**: Reload button now matches extension's design language
- **Dark mode support**: Proper theming for reload button in dark mode
- **Button spacing**: Optimized layout between progress section and footer

### Technical Details
- Updated `manifest.json` version to 1.2.0
- Modified default values in `popup.html` and `popup.js`
- Enhanced CSS with reload button styles and dark mode support
- Added Chrome tabs API integration for page reload functionality

## [1.1.0] - 2025-07-30

### Added
- **Footer section**: Modern footer with GitHub icon navigation
- **GitHub integration**: Direct link to repository from extension popup
- **Enhanced UI layout**: Improved spacing and visual hierarchy

### Changed
- **Popup height optimization**: Maintained 520px height with better content distribution
- **Footer styling**: Professional gradient divider and hover effects

### Technical Details
- Enhanced CSS with footer components and responsive design
- Added GitHub SVG icon with proper theming
- Improved flexbox layout for better content organization

## [1.0.0] - 2025-07-25

### Added
- **Initial release**: Complete Duolingo automation extension
- **Modern UI**: Beautiful popup interface with Duolingo theming
- **Dark/Light mode**: Toggle between themes with persistent settings
- **Progress tracking**: Real-time progress bar and XP counter
- **State persistence**: Extension remembers progress across popup sessions
- **Error handling**: User-friendly error messages with automatic recovery
- **JWT authentication**: Secure integration with Duolingo API
- **Bonus XP option**: Toggle to enable/disable bonus points
- **Auto-completion**: Shows completion message with earned XP

### Core Features
- Automated lesson completion with configurable XP targets
- Background script execution with content script integration
- Chrome storage API for state management
- Responsive design with 350x520px optimal dimensions
- Professional gradient styling and animations

### Technical Foundation
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background script for automation logic
- **Content Scripts**: Duolingo page integration
- **Chrome APIs**: Storage, tabs, scripting, and web request permissions
- **Modern CSS**: CSS variables, flexbox, and smooth transitions

---

## Release Notes Format

Each release includes:
- **Added**: New features and functionality
- **Changed**: Modifications to existing features
- **Fixed**: Bug fixes and improvements
- **Technical Details**: Implementation specifics for developers

## Contributing

When contributing to this project, please:
1. Update this CHANGELOG.md with your changes
2. Follow semantic versioning for version numbers
3. Include clear descriptions of all modifications
4. Test thoroughly before releasing

## Links

- [GitHub Repository](https://github.com/kenzn2/Duolingo-Lazy)
- [Latest Release](https://github.com/kenzn2/Duolingo-Lazy/releases/latest)
- [Issue Tracker](https://github.com/kenzn2/Duolingo-Lazy/issues)
