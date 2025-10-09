// Safemode Popup Script
// Handles the extension popup UI and interactions

class SafemodePopup {
  constructor() {
    console.log('SafemodePopup constructor called');
    this.currentTab = null;
    this.analysisResult = null;
    this.isAnalyzing = false;

    this.init();
  }

  async init() {
    console.log('SafemodePopup init called');

    // Wake up service worker
    try {
      console.log('Waking up service worker...');
      await chrome.runtime.sendMessage({ type: 'PING' });
      console.log('Service worker ping successful');
    } catch (error) {
      console.log('Service worker ping failed:', error);
    }

    await this.setupUI();
    await this.loadCurrentTab();
    await this.loadSettings();
    this.bindEvents();
    console.log('SafemodePopup initialization complete');

    // Check for cached results
    if (this.currentTab) {
      await this.checkCachedResult();
    }
  }

  async setupUI() {
    // Show initial state
    this.showState('main');
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      if (tab && tab.url) {
        // Check for unsupported URLs
        const unsupportedPatterns = [
          'chrome://',
          'chrome-extension://',
          'moz-extension://',
          'edge://',
          'about:',
          'file://'
        ];

        const isUnsupported = unsupportedPatterns.some(pattern =>
          tab.url.startsWith(pattern)
        );

        if (isUnsupported) {
          this.showUnsupportedSite();
          return;
        }

        const domain = new URL(tab.url).hostname;
        document.getElementById('siteDomain').textContent = domain;
      } else {
        this.showUnsupportedSite();
      }
    } catch (error) {
      console.error('Failed to get current tab:', error);
      this.showError('Unable to access current tab');
    }
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get(['autoScan']);
      const autoScanToggle = document.getElementById('autoScanToggle');
      autoScanToggle.checked = settings.autoScan || false;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  bindEvents() {
    console.log('bindEvents called - setting up event listeners');

    // Analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    console.log('Found analyze button:', analyzeBtn);

    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        console.log('Analyze button clicked!');
        this.analyzeCurrentSite();
      });
      console.log('Analyze button event listener added');
    } else {
      console.error('Analyze button not found!');
    }

    // Retry button
    document.getElementById('retryBtn').addEventListener('click', () => {
      this.analyzeCurrentSite();
    });

    // Full report button
    document.getElementById('fullReportBtn').addEventListener('click', () => {
      this.showFullReport();
    });

    // Auto-scan toggle
    document.getElementById('autoScanToggle').addEventListener('change', (e) => {
      this.updateAutoScanSetting(e.target.checked);
    });

    // Modal controls
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.hideModal();
    });

    // Close modal on backdrop click
    document.getElementById('reportModal').addEventListener('click', (e) => {
      if (e.target.id === 'reportModal') {
        this.hideModal();
      }
    });
  }

  async checkCachedResult() {
    if (!this.currentTab) return;

    const domain = new URL(this.currentTab.url).hostname;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CACHED_RESULT',
        domain
      });

      if (response.success && response.data) {
        this.analysisResult = response.data.result;
        this.displayAnalysisResult();

        // Update timestamp
        const timestamp = new Date(response.data.timestamp);
        document.getElementById('analysisTime').textContent =
          `Analyzed ${this.formatTimeAgo(timestamp)}`;
      }
    } catch (error) {
      console.log('No cached result available');
    }
  }

  async analyzeCurrentSite() {
    console.log('analyzeCurrentSite called');
    if (!this.currentTab || this.isAnalyzing) return;

    console.log('Starting analysis for tab:', this.currentTab);
    this.isAnalyzing = true;
    this.showState('loading');

    try {
      // Try to get page data from content script
      let pageDataResponse;

      try {
        console.log('Sending SCRAPE_PAGE_DATA message to tab:', this.currentTab.id);
        pageDataResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
          type: 'SCRAPE_PAGE_DATA'
        });
        console.log('Received page data response:', pageDataResponse);
      } catch (error) {
        console.log('Content script message failed:', error);
        // Content script not loaded, try to inject it
        console.log('Content script not found, injecting...');

        try {
          await chrome.scripting.executeScript({
            target: { tabId: this.currentTab.id },
            files: ['src/content-script.js']
          });

          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Try again
          pageDataResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
            type: 'SCRAPE_PAGE_DATA'
          });
        } catch (injectionError) {
          throw new Error('Cannot analyze this page. The page may not allow content scripts or you may need to refresh and try again.');
        }
      }

      if (!pageDataResponse) {
        throw new Error('Content script not responding. Try refreshing the page or navigate to a regular website (not a Chrome internal page) and try again.');
      }

      if (!pageDataResponse.success) {
        throw new Error(pageDataResponse.error || 'Failed to scrape page data');
      }

      // Send data to service worker for analysis
      const analysisResponse = await chrome.runtime.sendMessage({
        type: 'ANALYZE_SITE',
        data: pageDataResponse.data
      });

      console.log('Popup received analysis response:', analysisResponse);

      if (!analysisResponse) {
        throw new Error('Service worker not responding. Try reloading the extension.');
      }

      if (!analysisResponse.success) {
        throw new Error(analysisResponse.error || 'Analysis failed');
      }

      console.log('Popup setting analysisResult to:', analysisResponse.data);
      this.analysisResult = analysisResponse.data;
      this.displayAnalysisResult();
      this.showState('main');

      // Update timestamp
      document.getElementById('analysisTime').textContent = 'Just analyzed';

    } catch (error) {
      console.error('Analysis failed:', error);
      this.showError(error.message);
    } finally {
      this.isAnalyzing = false;
    }
  }

  displayAnalysisResult() {
    if (!this.analysisResult) return;

    const result = this.analysisResult;
    console.log('Popup displaying analysis result:', result);
    console.log('Summary text:', result.summary);

    // Update risk badge
    const riskBadge = document.getElementById('riskBadge');
    const riskScore = document.getElementById('riskScore');
    const riskVerdict = document.getElementById('riskVerdict');

    riskScore.textContent = result.risk_score;
    riskVerdict.textContent = result.verdict;

    // Set risk badge style
    riskBadge.className = 'risk-badge';
    switch (result.verdict) {
      case 'SAFE':
        riskBadge.classList.add('safe');
        break;
      case 'CAUTION':
        riskBadge.classList.add('caution');
        break;
      case 'UNSAFE':
        riskBadge.classList.add('unsafe');
        break;
    }

    // Show and populate quick summary
    const quickSummary = document.getElementById('quickSummary');
    quickSummary.style.display = 'block';

    // Data collection summary
    const dataTypes = result.data_use?.map(d => d.type).slice(0, 3) || ['Unknown'];
    document.getElementById('dataCollection').textContent = dataTypes.join(', ');

    // Third-party cookies
    const cookieElement = document.getElementById('thirdPartyCookies');
    const thirdPartyCookies = result.cookies?.third_party_cookies || 0;
    const thirdPartyDomains = result.cookies?.thirdPartyDomains || [];

    let cookieText = thirdPartyCookies.toString();
    if (thirdPartyCookies > 0 && thirdPartyDomains.length > 0) {
      const displayDomains = thirdPartyDomains.slice(0, 3); // Show max 3 domains
      const domainsText = displayDomains.join(', ');
      const extraCount = thirdPartyDomains.length - displayDomains.length;

      cookieText += ` (${domainsText}${extraCount > 0 ? `, +${extraCount} more` : ''})`;
    }

    cookieElement.textContent = cookieText;
    cookieElement.className = 'summary-value ' + (thirdPartyCookies > 5 ? 'high-risk' : thirdPartyCookies > 0 ? 'medium-risk' : 'low-risk');

    // Data deletion
    const deleteElement = document.getElementById('canDelete');
    const canDelete = result.deletion?.can_user_delete || 'unknown';
    deleteElement.textContent = canDelete === 'yes' ? 'Yes' : canDelete === 'no' ? 'No' : 'Unknown';
    deleteElement.className = 'summary-value ' + (canDelete === 'yes' ? 'low-risk' : canDelete === 'no' ? 'high-risk' : 'medium-risk');

    // Show key issues
    if (result.reasons && result.reasons.length > 0) {
      const keyPoints = document.getElementById('keyPoints');
      const keyPointsList = document.getElementById('keyPointsList');

      keyPoints.style.display = 'block';
      keyPointsList.innerHTML = '';

      // Show top 3 most important issues
      result.reasons.slice(0, 3).forEach(reason => {
        const li = document.createElement('li');
        li.textContent = this.shortenReason(reason);
        keyPointsList.appendChild(li);
      });
    }

    // Show full report button
    document.getElementById('fullReportBtn').style.display = 'flex';

    // Update analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.innerHTML = '<span class="btn-icon">🔄</span>Re-analyze';
  }

  // Shorten reason text for concise display
  shortenReason(reason) {
    const shortReasons = {
      'shares data with many third parties': 'Data shared with advertisers',
      'no clear deletion process': 'Cannot delete data',
      'extensive tracking cookies': 'Heavy tracking',
      'unclear data retention': 'Unclear data retention',
      'no user control over data': 'No user control',
      'limited third party sharing': 'Some data sharing',
      'complex deletion process': 'Complex deletion',
      'some tracking cookies': 'Some tracking',
      'vague retention periods': 'Vague retention',
      'limited user control': 'Limited control'
    };

    // Try to find a shorter version
    for (const [long, short] of Object.entries(shortReasons)) {
      if (reason.toLowerCase().includes(long)) {
        return short;
      }
    }

    // Fallback: truncate if too long
    return reason.length > 30 ? reason.substring(0, 27) + '...' : reason;
  }

  showFullReport() {
    if (!this.analysisResult) return;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = this.generateReportHTML();

    document.getElementById('reportModal').style.display = 'flex';
  }

  generateReportHTML() {
    const result = this.analysisResult;

    if (!result) {
      return '<div class="error">No analysis data available</div>';
    }

    return `
      <!-- Overview Section -->
      <div class="report-section">
        <h3><span class="report-section-icon">📊</span>Overview</h3>
        <p><strong>Domain:</strong> ${result.domain}</p>
        <p><strong>Risk Score:</strong> ${result.risk_score}/100</p>
        <p><strong>Verdict:</strong> <span style="color: ${this.getVerdictColor(result.verdict)}">${result.verdict}</span></p>
        <p><strong>Confidence:</strong> ${Math.round(result.confidence * 100)}%</p>
      </div>

      <!-- Data Collection Section -->
      <div class="report-section">
        <h3><span class="report-section-icon">📝</span>Data Collection</h3>
        <p>${result.summary}</p>
        ${result.data_use && result.data_use.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Data Type</th>
                <th>Purpose</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              ${result.data_use.map(item => `
                <tr>
                  <td>${item.type}</td>
                  <td>${item.purpose}</td>
                  <td>${item.retention}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No specific data collection details found.</p>'}
      </div>

      <!-- Cookies Section -->
      <div class="report-section">
        <h3><span class="report-section-icon">🍪</span>Cookies & Tracking</h3>
        <p><strong>Total Cookies:</strong> ${result.cookies.cookie_count}</p>
        <p><strong>Third-party Cookies:</strong> ${result.cookies.third_party_cookies}</p>
        ${result.cookies.thirdPartyDomains && result.cookies.thirdPartyDomains.length > 0 ? `
          <p><strong>Third-party Domains:</strong> ${result.cookies.thirdPartyDomains.join(', ')}</p>
        ` : ''}
        <p><strong>Tracking Detected:</strong> ${result.cookies.tracking_cookies_detected ? 'Yes' : 'No'}</p>

        ${result.cookies.cookies_summary && result.cookies.cookies_summary.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Examples</th>
              </tr>
            </thead>
            <tbody>
              ${result.cookies.cookies_summary.map(category => `
                <tr>
                  <td>${category.category}</td>
                  <td>${category.count}</td>
                  <td>${category.examples?.map(e => e.name).join(', ') || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>

      <!-- Data Deletion Section -->
      <div class="report-section">
        <h3><span class="report-section-icon">🗑️</span>Data Deletion Rights</h3>
        <p><strong>Can Delete Data:</strong> ${result.deletion.can_user_delete}</p>
        ${result.deletion.how ? `<p><strong>How:</strong> ${result.deletion.how}</p>` : ''}
        ${result.deletion.contacts_found && result.deletion.contacts_found.length > 0 ? `
          <p><strong>Contacts:</strong> ${result.deletion.contacts_found.join(', ')}</p>
        ` : ''}
      </div>

      <!-- Risk Analysis Section -->
      <div class="report-section">
        <h3><span class="report-section-icon">⚠️</span>Risk Analysis</h3>
        ${result.reasons && result.reasons.length > 0 ? `
          <h4>Reasons for ${result.verdict} rating:</h4>
          <ul class="reasons-list">
            ${result.reasons.map(reason => `<li>${reason}</li>`).join('')}
          </ul>
        ` : ''}

        ${result.actions && result.actions.length > 0 ? `
          <h4>Recommended Actions:</h4>
          <ul class="actions-list">
            ${result.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  getVerdictColor(verdict) {
    switch (verdict) {
      case 'SAFE': return '#22c55e';
      case 'CAUTION': return '#f59e0b';
      case 'UNSAFE': return '#ef4444';
      default: return '#6b7280';
    }
  }

  hideModal() {
    document.getElementById('reportModal').style.display = 'none';
  }

  async exportAnalysisJSON() {
    if (!this.analysisResult) return;

    const dataStr = JSON.stringify(this.analysisResult, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `safemode-analysis-${this.analysisResult.domain}-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async updateAutoScanSetting(enabled) {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { autoScan: enabled }
      });
    } catch (error) {
      console.error('Failed to update auto-scan setting:', error);
    }
  }

  showState(state) {
    const states = ['main', 'loading', 'error'];
    const elements = {
      main: document.getElementById('mainContent'),
      loading: document.getElementById('loadingState'),
      error: document.getElementById('errorState')
    };

    states.forEach(s => {
      elements[s].style.display = s === state ? 'block' : 'none';
    });
  }

  showError(message) {
    document.getElementById('errorMessage').textContent = message;
    this.showState('error');
  }

  showUnsupportedSite() {
    this.showError('This site cannot be analyzed (Chrome internal pages are not supported)');
    document.getElementById('retryBtn').style.display = 'none';
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
}

// Simple loading check
console.log('Popup script loaded!');

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, creating SafemodePopup');
  try {
    new SafemodePopup();
  } catch (error) {
    console.error('Failed to create SafemodePopup:', error);
  }
});