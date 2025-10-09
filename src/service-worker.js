// Safemode Service Worker - Main background script for Chrome extension

// Simple fallback analysis function (inline to avoid import issues)
async function analyzePrivacyPolicy(analysisData) {
  console.log('Running fallback analysis for:', analysisData.domain);
  console.log('Privacy policy links received:', analysisData.privacyPolicyLinks);

  const cookieCount = analysisData.cookies?.cookieCount || 0;
  const thirdPartyCount = analysisData.cookies?.thirdPartyCookies || 0;
  const thirdPartyDomains = analysisData.cookies?.thirdPartyDomains || [];
  const hasPrivacyPolicy = analysisData.privacyPolicyLinks && analysisData.privacyPolicyLinks.length > 0;

  console.log('hasPrivacyPolicy determined as:', hasPrivacyPolicy, 'from links:', analysisData.privacyPolicyLinks);

  // Simple heuristic-based risk assessment
  let riskScore = 30; // Base risk
  if (thirdPartyCount > 5) riskScore += 30;
  if (thirdPartyCount > 10) riskScore += 20;
  if (!hasPrivacyPolicy) riskScore += 20;
  if (!analysisData.privacyPolicyText || analysisData.privacyPolicyText.length < 100) riskScore += 15;

  const verdict = riskScore < 40 ? 'SAFE' : riskScore < 70 ? 'CAUTION' : 'UNSAFE';

  const reasons = [];
  if (thirdPartyCount > 5) reasons.push('High number of tracking cookies');
  if (!hasPrivacyPolicy) reasons.push('No privacy policy found');
  if (analysisData.cookieBannerData?.hasBanner && !analysisData.cookieBannerData?.hasRejectButton) {
    reasons.push('Cookie banner without reject option');
  }

  return {
    domain: analysisData.domain,
    url: analysisData.url,
    summary: `This site has ${cookieCount} cookies (${thirdPartyCount} third-party). ${hasPrivacyPolicy ? 'Privacy policy found.' : 'No privacy policy detected.'}`,
    data_use: [
      { type: "cookies", purpose: "tracking and analytics", retention: "varies", shared_with: thirdPartyCount > 0 ? ["third parties"] : [] }
    ],
    deletion: {
      can_user_delete: hasPrivacyPolicy ? "unknown" : "no",
      how: hasPrivacyPolicy ? "Check privacy policy for details" : "No privacy policy available",
      contacts_found: []
    },
    cookies: {
      cookie_count: cookieCount,
      third_party_cookies: thirdPartyCount,
      thirdPartyDomains: thirdPartyDomains,
      tracking_cookies_detected: thirdPartyCount > 0,
      cookies_summary: []
    },
    risk_score: Math.min(riskScore, 100),
    verdict,
    reasons,
    actions: [
      thirdPartyCount > 0 ? "Consider blocking third-party cookies" : "Cookie usage appears minimal",
      hasPrivacyPolicy ? "Review privacy policy manually" : "Request privacy information from site"
    ],
    confidence: 0.6,
    timestamp: Date.now()
  };
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_DELAY = 10 * 1000; // 10 seconds between AI calls per domain

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Safemode extension installed');

  // Set default settings
  await chrome.storage.local.set({
    autoScan: false,
    allowlist: [],
    blocklist: [],
    lastAnalysis: {}
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message.type);

  // Handle async operations properly
  (async () => {
    try {
      switch (message.type) {
        case 'ANALYZE_SITE':
          console.log('Service worker received ANALYZE_SITE message');
          console.log('Message data:', message.data);
          console.log('Starting site analysis...');
          const result = await analyzeSite(message.data);
          console.log('Site analysis completed:', result);
          sendResponse({ success: true, data: result });
          break;

        case 'GET_CACHED_RESULT':
          const cached = await getCachedResult(message.domain);
          sendResponse({ success: true, data: cached });
          break;

        case 'CLEAR_CACHE':
          await clearCache(message.domain);
          sendResponse({ success: true });
          break;

        case 'UPDATE_SETTINGS':
          await updateSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'PING':
          console.log('Service worker received PING, responding...');
          sendResponse({ success: true, message: 'Service worker is awake' });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Service worker error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Analyze a website's privacy policy and cookies
async function analyzeSite(siteData) {
  const { domain, url, pageContent, privacyPolicyLinks, cookies, cookieBannerData } = siteData;

  console.log('Service worker analyzeSite called for:', domain);
  console.log('Received privacyPolicyLinks:', privacyPolicyLinks);

  // Check rate limiting
  const lastAnalysis = await getLastAnalysisTime(domain);
  const now = Date.now();

  if (lastAnalysis && (now - lastAnalysis) < RATE_LIMIT_DELAY) {
    throw new Error(`Rate limited. Please wait ${Math.ceil((RATE_LIMIT_DELAY - (now - lastAnalysis)) / 1000)} seconds.`);
  }

  // Check cache first
  const cached = await getCachedResult(domain);
  if (cached && !isExpired(cached.timestamp)) {
    return cached.result;
  }

  // Perform analysis
  console.log(`Analyzing ${domain}...`);

  // Fetch privacy policy content if links were found
  let privacyPolicyText = '';
  if (privacyPolicyLinks && privacyPolicyLinks.length > 0) {
    try {
      privacyPolicyText = await fetchPrivacyPolicyContent(privacyPolicyLinks[0]);
      console.log('Successfully fetched privacy policy content');
    } catch (error) {
      console.log('Privacy policy fetch failed (this is normal due to browser security), analyzing page content instead');
      // Fall back to analyzing page content
      privacyPolicyText = extractPrivacyTextFromPage(pageContent);
    }
  } else {
    console.log('No privacy policy links found, analyzing page content');
    privacyPolicyText = extractPrivacyTextFromPage(pageContent);
  }

  // Prepare data for AI analysis
  const analysisData = {
    domain,
    url,
    privacyPolicyText,
    privacyPolicyLinks, // Include the links array for analysis
    cookies,
    cookieBannerData,
    pageContent: pageContent.substring(0, 5000) // Limit page content to avoid token limits
  };

  // Call AI analysis
  const analysisResult = await analyzePrivacyPolicy(analysisData);

  // Cache the result
  await cacheResult(domain, analysisResult);

  // Update last analysis time
  await updateLastAnalysisTime(domain, now);

  return analysisResult;
}

// Fetch privacy policy content from URL
async function fetchPrivacyPolicyContent(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Basic HTML to text conversion (without DOMParser)
    // Remove script and style tags
    let cleanHtml = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]*>/g, ' ') // Remove all HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return cleanHtml;
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    throw error;
  }
}

// Extract privacy-related text from page content
function extractPrivacyTextFromPage(pageContent) {
  const privacyKeywords = [
    'privacy policy', 'data protection', 'personal information',
    'cookies', 'tracking', 'data collection', 'third party',
    'gdpr', 'ccpa', 'personal data', 'data processing'
  ];

  const sentences = pageContent.split(/[.!?]+/);
  const privacySentences = sentences.filter(sentence =>
    privacyKeywords.some(keyword =>
      sentence.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  return privacySentences.join('. ').substring(0, 2000);
}

// Cache management functions
async function getCachedResult(domain) {
  const cache = await chrome.storage.local.get(`cache_${domain}`);
  return cache[`cache_${domain}`] || null;
}

async function cacheResult(domain, result) {
  const cacheData = {
    result,
    timestamp: Date.now()
  };

  await chrome.storage.local.set({
    [`cache_${domain}`]: cacheData
  });
}

async function clearCache(domain) {
  if (domain) {
    await chrome.storage.local.remove(`cache_${domain}`);
  } else {
    // Clear all cache
    const items = await chrome.storage.local.get();
    const cacheKeys = Object.keys(items).filter(key => key.startsWith('cache_'));
    await chrome.storage.local.remove(cacheKeys);
  }
}

function isExpired(timestamp) {
  return Date.now() - timestamp > CACHE_TTL;
}

// Rate limiting functions
async function getLastAnalysisTime(domain) {
  const data = await chrome.storage.local.get('lastAnalysis');
  return data.lastAnalysis?.[domain] || null;
}

async function updateLastAnalysisTime(domain, timestamp) {
  const data = await chrome.storage.local.get('lastAnalysis');
  const lastAnalysis = data.lastAnalysis || {};
  lastAnalysis[domain] = timestamp;

  await chrome.storage.local.set({ lastAnalysis });
}

// Settings management
async function updateSettings(newSettings) {
  const currentSettings = await chrome.storage.local.get(['autoScan', 'allowlist', 'blocklist']);
  const updatedSettings = { ...currentSettings, ...newSettings };

  await chrome.storage.local.set(updatedSettings);
}

// Tab update listener for auto-scan functionality
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    const settings = await chrome.storage.local.get(['autoScan', 'allowlist', 'blocklist']);

    if (settings.autoScan) {
      const domain = new URL(tab.url).hostname;

      // Check allowlist/blocklist
      if (settings.blocklist?.includes(domain)) {
        return;
      }

      if (settings.allowlist?.length > 0 && !settings.allowlist.includes(domain)) {
        return;
      }

      // Trigger content script analysis
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'AUTO_ANALYZE' });
      } catch (error) {
        // Tab might not have content script loaded yet
        console.log('Auto-analyze failed:', error.message);
      }
    }
  }
});