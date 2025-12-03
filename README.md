# Catch-Clause Chrome Extension

A comprehensive privacy policy analyzer that evaluates website data collection practices and provides safety recommendations using Chrome's built-in AI APIs.

## 🛡️ What is Catch-clause?

Catchclause is a Chrome extension that automatically analyzes website privacy policies and cookie practices to help you make informed decisions about your data privacy. It extracts privacy policy text, analyzes cookies, and uses Chrome's built-in AI to provide:

- **Risk Assessment**: 0-100 privacy risk score
- **Safety Verdict**: SAFE, CAUTION, or UNSAFE rating
- **Data Analysis**: What data is collected and how it's used
- **Deletion Rights**: Whether and how you can delete your data
- **Cookie Analysis**: Detailed breakdown of tracking cookies
- **Actionable Recommendations**: Steps you can take to protect your privacy

## 🚀 Features

### Core Functionality
- **Privacy Policy Detection**: Automatically finds and fetches privacy policy links
- **Cookie Analysis**: Extracts and categorizes all cookies (essential, analytics, advertising, etc.)
- **AI-Powered Analysis**: Uses Chrome's built-in summarizer and prompt APIs
- **Risk Scoring**: Comprehensive 0-100 risk assessment
- **Data Rights Analysis**: Identifies deletion rights and contact information
- **Caching**: 24-hour cache to avoid repeated analysis

### User Interface
- **Clean Popup**: Risk badge, summary, and quick actions
- **Full Reports**: Detailed breakdown with tables and recommendations
- **Auto-scan**: Optional automatic analysis on page load
- **Export**: Download analysis results as JSON
- **Settings**: Toggle auto-scan, manage allowlist/blocklist

### Privacy & Security
- **No External Servers**: Uses only Chrome's built-in AI APIs
- **Local Processing**: All analysis happens in your browser
- **No Data Collection**: Extension doesn't collect or transmit your data
- **Rate Limiting**: Prevents API abuse with 10-second delays

## 📋 Requirements

- **Chrome Browser**: Version 88+ with Manifest V3 support
- **Chrome AI APIs**: Built-in summarizer and prompt APIs (experimental features may need to be enabled)
- **Permissions**: Storage, cookies, activeTab, scripting

## 🛠️ Installation

### Option 1: Load Unpacked Extension (Development)

1. **Download or Clone the Repository**
   ```bash
   git clone <repository-url>
   cd safemode-extension
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder containing `manifest.json`

4. **Verify Installation**
   - Extension icon should appear in Chrome toolbar
   - Click icon to open Safemode popup


## 📖 Usage Guide

### Basic Usage

1. **Visit Any Website**
   - Navigate to any website you want to analyze

2. **Open Safemode**
   - Click the Catchclause icon in the Chrome toolbar
   - Or use keyboard shortcut (if configured)

3. **Analyze the Site**
   - Click "Analyze Site" button
   - Wait for AI analysis to complete (10-30 seconds)

4. **Review Results**
   - Check the risk score and verdict
   - Read the summary of privacy practices
   - Click "Full Report" for detailed analysis

### Auto-Scan Mode

1. **Enable Auto-Scan**
   - Open Catchclause popup
   - Toggle "Auto-scan on page load" setting

2. **Automatic Analysis**
   - Extension automatically analyzes new sites you visit
   - High-risk sites show warning notifications
   - Results are cached for faster future visits

### Understanding Results

#### Risk Scores
- **0-30**: SAFE - Good privacy practices
- **31-70**: CAUTION - Some privacy concerns
- **71-100**: UNSAFE - Significant privacy risks

#### Analysis Sections
- **Data Collection**: What personal data is collected
- **Cookie Analysis**: Types and purposes of cookies
- **Third-party Sharing**: Data sharing with external companies
- **Deletion Rights**: How to delete your data
- **Recommendations**: Actions you can take

## 🔧 Configuration

### Settings

The extension stores settings in Chrome's local storage:

```javascript
{
  autoScan: false,           // Auto-analyze on page load
  allowlist: [],             // Domains to always scan
  blocklist: [],             // Domains to never scan
  lastAnalysis: {}           // Rate limiting timestamps
}
```

### AI Configuration

Edit `src/ai/ai-client.js` to customize AI behavior:

```javascript
export const AI_CONFIG = {
  temperature: 0.1,          // Lower = more consistent
  maxRetries: 2,             // Retry failed requests
  timeoutMs: 30000,          // Request timeout
  fallbackEnabled: true      // Use fallback when AI fails
}
```

### Mock AI for Development

Enable mock AI for testing without Chrome AI APIs:

```javascript
import { enableMockAI } from './src/ai/ai-client.js';
enableMockAI(); // Call before using AI functions
```

## 🧪 Testing

### Running Tests

The extension includes a comprehensive test suite:

```bash
# Run basic functionality tests
node tests/test-runner.js

# Test with sample privacy policies
# Open tests/test-privacy-policy-1.html in Chrome
# Open tests/test-privacy-policy-2.html in Chrome
```

### Test Cases

Two example privacy policies are included:

1. **Test Case 1** (`tests/test-privacy-policy-1.html`)
   - High-risk site with extensive tracking
   - Data sharing with advertisers
   - No deletion rights
   - Expected verdict: UNSAFE

2. **Test Case 2** (`tests/test-privacy-policy-2.html`)
   - Privacy-focused site with minimal data collection
   - No third-party sharing
   - Strong deletion rights
   - Expected verdict: SAFE

### Expected Outputs

See `tests/expected/` for detailed JSON outputs showing what the AI analysis should produce for each test case.

## 🏗️ Architecture

### File Structure

```
catch-clause/
├── manifest.json                 # Extension manifest
├── src/
│   ├── service-worker.js         # Background script
│   ├── content-script.js         # Page content analysis
│   ├── popup.html               # Extension popup UI
│   ├── popup.css                # Popup styles
│   ├── popup.js                 # Popup interactions
│   ├── utils/
│   │   ├── privacy-scraper.js   # Policy link detection
│   │   └── cookie-extractor.js  # Cookie analysis
│   └── ai/
│       ├── prompt-templates.js  # AI prompts
│       └── ai-client.js         # AI API wrapper
├── tests/
│   ├── test-runner.js           # Test harness
│   ├── test-privacy-policy-1.html # High-risk test
│   ├── test-privacy-policy-2.html # Low-risk test
│   └── expected/                # Expected outputs
├── icons/                       # Extension icons
└── README.md
```

### Component Interactions

1. **Content Script** scrapes page data (privacy links, cookies, text)
2. **Service Worker** receives data and orchestrates AI analysis
3. **AI Client** calls Chrome's built-in APIs with structured prompts
4. **Popup** displays results and handles user interactions
5. **Storage** caches results and manages settings

## 🔌 AI Integration

### Chrome AI APIs

The extension uses Chrome's experimental AI APIs:

```javascript
// Summarizer API
const summarizer = await chrome.ai.summarizer.create({
  type: 'key-points',
  format: 'json',
  length: 'short'
});

// Language Model API
const session = await chrome.ai.languageModel.create({
  temperature: 0.1,
  topK: 3
});
```

### Fallback Handling

When Chrome AI APIs are unavailable:

1. **Heuristic Analysis**: Basic rule-based privacy assessment
2. **Cookie Counting**: Simple cookie analysis without AI
3. **Pattern Matching**: Detect common privacy policy patterns
4. **Conservative Scoring**: Default to medium-high risk scores

## 🛡️ Privacy & Security

### Data Handling

- **No External Servers**: All processing happens locally
- **No Data Collection**: Extension doesn't collect user data
- **Local Storage Only**: Analysis results stored locally
- **No Network Requests**: Except to fetch privacy policies from same-origin

### Permissions

Required permissions and their purposes:

- **storage**: Cache analysis results and settings
- **cookies**: Analyze cookies for tracking assessment
- **activeTab**: Access current page content
- **scripting**: Inject content scripts for data extraction
- **host_permissions**: Fetch privacy policies from websites

### Security Measures

- **Content Security Policy**: Restricts inline scripts
- **Same-Origin Policy**: Only fetches same-origin privacy policies
- **Input Sanitization**: Cleans HTML content before analysis
- **Rate Limiting**: Prevents API abuse

## 🐛 Troubleshooting

### Common Issues

**Extension Not Loading**
- Check Chrome version (88+ required)
- Verify Developer mode is enabled
- Reload extension from chrome://extensions/

**AI Analysis Failing**
- Chrome AI APIs may not be available in your region
- Enable Chrome experimental features: `chrome://flags/#optimization-guide-on-device-model`
- Check console for specific error messages

**No Privacy Policy Found**
- Some sites don't have privacy policies
- Privacy policy links may use non-standard naming
- Try manual analysis by viewing page source

**Popup Not Opening**
- Extension may be disabled
- Check if site is supported (not chrome:// pages)
- Try refreshing the page

### Debug Mode

Enable debug logging:

```javascript
// In service-worker.js
const DEBUG = true;

if (DEBUG) {
  console.log('Debug info:', data);
}
```

### Support

For technical issues:

1. Check browser console for errors
2. Verify all files are present and permissions granted
3. Test with provided sample privacy policies
4. Review Chrome extension documentation

## 🚧 Development

### Adding New Features

1. **New Analysis Types**: Add prompts to `prompt-templates.js`
2. **UI Improvements**: Modify `popup.html/css/js`
3. **Data Sources**: Extend scrapers in `utils/` directory
4. **AI Enhancements**: Update `ai-client.js` logic

### Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

### Roadmap
- [ ] Additional privacy frameworks (CCPA, GDPR indicators)
- [ ] Historical tracking of site privacy changes
- [ ] Integration with privacy-focused search engines
- [ ] Batch analysis for multiple tabs

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Chrome team for built-in AI APIs
- Privacy advocacy organizations for guidance
- Open source community for tools and libraries

---

**Disclaimer**: This extension provides automated analysis of privacy policies and should not be considered legal advice. Users should review privacy policies manually for complete understanding. The extension's analysis is based on publicly available information and AI interpretation, which may not be 100% accurate.
