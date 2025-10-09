// Safemode Content Script - Scrapes page content and extracts privacy information

// Utility functions (inline to avoid import issues)

// Find privacy policy links on the current page
function findPrivacyPolicyLinks() {
  const links = [];
  const currentDomain = window.location.hostname;

  // Privacy-related patterns for URL paths (including fragments/anchors)
  const urlPatterns = [
    'privacy', 'privacy-policy', 'privacy_policy', 'privacypolicy',
    'data-protection', 'data-policy', 'cookie', 'cookies', 'cookie-policy',
    'terms', 'terms-of-service', 'terms-and-conditions', 'legal', 'gdpr', 'ccpa',
    // Fragment/anchor patterns
    '#privacy', '#privacy-policy', '#privacy_policy', '#data-protection',
    '#developer_policy', '#user_privacy', '#privacy_notice'
  ];

  // Privacy-related patterns for link text (more flexible)
  const textPatterns = [
    'privacy policy', 'privacy statement', 'privacy notice', 'privacy',
    'data protection', 'data policy', 'data usage', 'data handling',
    'cookie policy', 'cookie notice', 'cookies',
    'terms of service', 'terms and conditions', 'terms of use', 'terms',
    'legal', 'gdpr', 'ccpa', 'california privacy',
    // Developer/API specific
    'developer policy', 'api privacy', 'user privacy'
  ];

  // Get all links on the page
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkText = link.textContent.toLowerCase().trim();
    const linkUrl = href.toLowerCase();

    // Check URL patterns (including full URL with fragments)
    const urlMatches = urlPatterns.some(pattern => {
      // Handle anchor/fragment patterns specially
      if (pattern.startsWith('#')) {
        return linkUrl.includes(pattern) || href.includes(pattern);
      }
      return linkUrl.includes(pattern);
    });

    // Check text patterns (more flexible matching)
    const textMatches = textPatterns.some(pattern => {
      // For multi-word patterns, check for exact phrase or close matches
      if (pattern.includes(' ')) {
        return linkText.includes(pattern) ||
               linkText.replace(/\s+/g, ' ').includes(pattern) ||
               linkText.replace(/[^\w\s]/g, '').includes(pattern.replace(/[^\w\s]/g, ''));
      } else {
        return linkText.includes(pattern);
      }
    });

    // Special case: links that go to /legal pages with specific fragments
    const isLegalWithPrivacyFragment = (
      (linkUrl.includes('/legal') || linkUrl.includes('legal')) &&
      (href.includes('#privacy') || href.includes('#developer_policy') || href.includes('#data'))
    );

    const isPrivacyLink = urlMatches || textMatches || isLegalWithPrivacyFragment;

    if (isPrivacyLink) {
      // Convert relative URLs to absolute
      let absoluteUrl;
      try {
        absoluteUrl = new URL(href, window.location.href).href;
      } catch (e) {
        return; // Skip invalid URLs
      }

      const linkDomain = new URL(absoluteUrl).hostname;

      // Calculate priority for sorting
      let priority = 0;

      // Higher priority for exact "privacy policy" matches
      if (linkText.includes('privacy policy') || absoluteUrl.includes('privacy-policy')) {
        priority += 10;
      }

      // Medium priority for other privacy-related terms
      if (linkText.includes('privacy') || absoluteUrl.includes('privacy')) {
        priority += 5;
      }

      // Lower priority for general legal pages
      if (linkText.includes('legal') || absoluteUrl.includes('legal')) {
        priority += 1;
      }

      // Bonus for same domain
      if (linkDomain === currentDomain) {
        priority += 3;
      }

      links.push({
        url: absoluteUrl,
        text: linkText,
        isSameDomain: linkDomain === currentDomain,
        priority: priority
      });
    }
  });

  // Sort by priority (highest first)
  links.sort((a, b) => b.priority - a.priority);

  // Remove duplicates
  const uniqueLinks = [];
  const seenUrls = new Set();

  links.forEach(link => {
    if (!seenUrls.has(link.url)) {
      seenUrls.add(link.url);
      uniqueLinks.push(link);
    }
  });

  console.log('Found privacy policy links (objects):', uniqueLinks);
  const urls = uniqueLinks.map(link => link.url);
  console.log('Returning privacy policy URLs:', urls);
  return urls;
}

// Extract cookie data from the current page
async function extractCookieData() {
  const cookieData = {
    documentCookies: [],
    allCookies: [],
    cookieCount: 0,
    thirdPartyCookies: 0,
    thirdPartyDomains: []
  };

  const currentDomain = window.location.hostname;

  try {
    // Extract document.cookie (client-accessible cookies)
    const documentCookieString = document.cookie;

    if (documentCookieString) {
      const cookiePairs = documentCookieString.split(';');

      cookiePairs.forEach(pair => {
        const [name, value] = pair.trim().split('=');
        if (name && value !== undefined) {
          cookieData.documentCookies.push({
            name: name.trim(),
            value: value.trim(),
            domain: currentDomain,
            isThirdParty: false
          });
        }
      });
    }

    // Get all cookies for current URL using Chrome extension API
    try {
      const allCookies = await chrome.cookies.getAll({ url: window.location.href });
      cookieData.allCookies = allCookies;
      cookieData.cookieCount = allCookies.length;

      // Identify third-party cookies by domain
      const thirdPartyCookies = allCookies.filter(cookie => {
        // Extract domain from cookie domain (remove leading dots)
        const cookieDomain = cookie.domain.startsWith('.')
          ? cookie.domain.substring(1)
          : cookie.domain;

        // Check if cookie domain is different from current domain
        return !currentDomain.includes(cookieDomain) && !cookieDomain.includes(currentDomain);
      });

      cookieData.thirdPartyCookies = thirdPartyCookies.length;

      // Get unique third-party domains
      const uniqueDomains = [...new Set(thirdPartyCookies.map(cookie => {
        const domain = cookie.domain.startsWith('.')
          ? cookie.domain.substring(1)
          : cookie.domain;
        return domain;
      }))];

      cookieData.thirdPartyDomains = uniqueDomains;

    } catch (apiError) {
      console.log('Chrome cookies API not available, falling back to heuristics');

      // Fallback to simple heuristic detection
      cookieData.cookieCount = cookieData.documentCookies.length;

      const heuristicThirdParty = cookieData.documentCookies.filter(cookie => {
        return cookie.name.startsWith('_ga') ||
               cookie.name.startsWith('_fb') ||
               cookie.name.includes('doubleclick') ||
               cookie.name.includes('google') ||
               cookie.name.includes('analytics');
      });

      cookieData.thirdPartyCookies = heuristicThirdParty.length;

      // Estimate domains based on cookie names
      const estimatedDomains = [];
      heuristicThirdParty.forEach(cookie => {
        if (cookie.name.startsWith('_ga')) estimatedDomains.push('google-analytics.com');
        if (cookie.name.startsWith('_fb')) estimatedDomains.push('facebook.com');
        if (cookie.name.includes('doubleclick')) estimatedDomains.push('doubleclick.net');
      });

      cookieData.thirdPartyDomains = [...new Set(estimatedDomains)];
    }

  } catch (error) {
    console.error('Error extracting cookies:', error);
  }

  return cookieData;
}

// Analyze cookie banners and consent mechanisms
function analyzeCookieBanner() {
  const bannerData = {
    hasBanner: false,
    bannerText: '',
    hasAcceptButton: false,
    hasRejectButton: false
  };

  // Common cookie banner selectors
  const bannerSelectors = [
    '[class*="cookie"]', '[id*="cookie"]',
    '[class*="consent"]', '[id*="consent"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    '[class*="privacy"]', '[id*="privacy"]',
    '.notice', '.banner'
  ];

  // Find cookie banner elements
  let bannerElement = null;

  for (const selector of bannerSelectors) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      const text = element.textContent.toLowerCase();

      // Check if element contains cookie/privacy related keywords
      if (text.includes('cookie') || text.includes('consent') ||
          text.includes('privacy') || text.includes('gdpr')) {
        bannerElement = element;
        break;
      }
    }

    if (bannerElement) break;
  }

  if (bannerElement) {
    bannerData.hasBanner = true;
    bannerData.bannerText = bannerElement.textContent.trim();

    // Look for action buttons within the banner
    const buttons = bannerElement.querySelectorAll('button, a, input[type="button"], input[type="submit"]');

    buttons.forEach(button => {
      const buttonText = button.textContent.toLowerCase();

      if (buttonText.includes('accept') || buttonText.includes('agree') ||
          buttonText.includes('ok') || buttonText.includes('allow')) {
        bannerData.hasAcceptButton = true;
      }

      if (buttonText.includes('reject') || buttonText.includes('decline') ||
          buttonText.includes('deny') || buttonText.includes('refuse')) {
        bannerData.hasRejectButton = true;
      }
    });
  }

  return bannerData;
}

// Content script initialization
(function() {
  'use strict';

  console.log('Safemode content script loaded');

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.type);

    // Handle async operations properly
    (async () => {
      try {
        switch (message.type) {
          case 'SCRAPE_PAGE_DATA':
            console.log('Starting page data scraping...');
            const pageData = await scrapePageData();
            console.log('Page data scraped successfully:', pageData);
            sendResponse({ success: true, data: pageData });
            break;

          case 'AUTO_ANALYZE':
            console.log('Starting auto analysis...');
            await performAutoAnalysis();
            sendResponse({ success: true });
            break;

          default:
            console.log('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
        }
      } catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  });

  // Main function to scrape all page data
  async function scrapePageData() {
    const domain = window.location.hostname;
    const url = window.location.href;

    console.log(`Scraping data for ${domain}`);

    // Get page content
    const pageContent = getCleanPageText();

    // Find privacy policy links
    const privacyPolicyLinks = findPrivacyPolicyLinks();

    // Extract cookie data
    const cookies = await extractCookieData();

    // Analyze cookie banners
    const cookieBannerData = analyzeCookieBanner();

    // Get page title
    const pageTitle = document.title;

    return {
      domain,
      url,
      pageTitle,
      pageContent,
      privacyPolicyLinks,
      cookies,
      cookieBannerData,
      timestamp: Date.now()
    };
  }

  // Extract clean text content from the page
  function getCleanPageText() {
    // Clone the document to avoid modifying the original
    const clone = document.cloneNode(true);

    // Remove script and style elements
    const unwantedElements = clone.querySelectorAll('script, style, nav, header, footer, aside');
    unwantedElements.forEach(el => el.remove());

    // Get main content areas (prioritize main, article, .content, etc.)
    const mainContentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main'
    ];

    let contentText = '';

    // Try to find main content first
    for (const selector of mainContentSelectors) {
      const mainElement = clone.querySelector(selector);
      if (mainElement) {
        contentText = mainElement.textContent || '';
        break;
      }
    }

    // Fall back to body content if no main content found
    if (!contentText) {
      contentText = clone.body?.textContent || '';
    }

    // Clean up whitespace and limit length
    return contentText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit to prevent token overflow
  }

  // Perform automatic analysis when auto-scan is enabled
  async function performAutoAnalysis() {
    try {
      const pageData = await scrapePageData();

      // Send data to service worker for analysis
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_SITE',
        data: pageData
      });

      if (response.success) {
        console.log('Auto-analysis completed for', pageData.domain);

        // Show subtle notification if high risk detected
        if (response.data.verdict === 'UNSAFE') {
          showRiskNotification(response.data);
        }
      }
    } catch (error) {
      console.error('Auto-analysis failed:', error);
    }
  }

  // Show subtle risk notification overlay
  function showRiskNotification(analysisResult) {
    // Check if notification already exists
    if (document.getElementById('safemode-notification')) {
      return;
    }

    const notification = document.createElement('div');
    notification.id = 'safemode-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      max-width: 300px;
      cursor: pointer;
      transition: opacity 0.3s ease;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="font-size: 16px;">⚠️</div>
        <div>
          <div style="font-weight: 600;">Privacy Risk Detected</div>
          <div style="font-size: 12px; opacity: 0.9;">Click to view details</div>
        </div>
        <div style="margin-left: auto; cursor: pointer; opacity: 0.7;" onclick="this.parentElement.parentElement.remove();">✕</div>
      </div>
    `;

    // Click to open extension popup
    notification.addEventListener('click', (e) => {
      if (e.target.textContent !== '✕') {
        // This would ideally open the extension popup, but we can't do that from content script
        // Instead, we'll just remove the notification and let user click extension icon
        notification.remove();
      }
    });

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 10000);
  }

  // Inject page data extraction when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeExtension, 1000);
    });
  } else {
    setTimeout(initializeExtension, 1000);
  }

  function initializeExtension() {
    // Page is ready, extension can now respond to popup requests
    console.log('Safemode ready for', window.location.hostname);
  }

})();