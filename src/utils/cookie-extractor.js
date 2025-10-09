// Cookie Extraction Utilities
// Extracts and analyzes cookies and cookie banner information

// Extract cookie data from the current page
export async function extractCookieData() {
  const cookieData = {
    documentCookies: [],
    chromeCookies: [],
    cookieCount: 0,
    thirdPartyCookies: 0,
    summary: []
  };

  const currentDomain = window.location.hostname;

  try {
    // Extract document.cookie (client-accessible cookies)
    const documentCookieString = document.cookie;

    if (documentCookieString) {
      cookieData.documentCookies = parseCookieString(documentCookieString, currentDomain);
    }

    // Try to get all cookies via Chrome API (requires permissions)
    try {
      if (chrome && chrome.cookies) {
        const allCookies = await chrome.cookies.getAll({ domain: currentDomain });
        cookieData.chromeCookies = allCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate,
          isThirdParty: !cookie.domain.includes(currentDomain)
        }));
      }
    } catch (error) {
      console.log('Chrome cookies API not available:', error);
    }

    // Combine and analyze cookies
    const allCookies = [...cookieData.documentCookies, ...cookieData.chromeCookies];
    cookieData.cookieCount = allCookies.length;

    // Count third-party cookies
    cookieData.thirdPartyCookies = allCookies.filter(cookie =>
      cookie.isThirdParty || !cookie.domain.includes(currentDomain)
    ).length;

    // Create summary with categorized cookies
    cookieData.summary = categorizeCookies(allCookies);

    console.log(`Extracted ${cookieData.cookieCount} cookies (${cookieData.thirdPartyCookies} third-party)`);

  } catch (error) {
    console.error('Error extracting cookies:', error);
  }

  return cookieData;
}

// Parse document.cookie string into structured data
function parseCookieString(cookieString, currentDomain) {
  const cookies = [];

  if (!cookieString) return cookies;

  const cookiePairs = cookieString.split(';');

  cookiePairs.forEach(pair => {
    const [name, value] = pair.trim().split('=');
    if (name && value !== undefined) {
      cookies.push({
        name: name.trim(),
        value: value.trim(),
        domain: currentDomain,
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'Lax',
        expirationDate: null,
        isThirdParty: false,
        source: 'document.cookie'
      });
    }
  });

  return cookies;
}

// Categorize cookies by their likely purpose
function categorizeCookies(cookies) {
  const categories = {
    essential: [],
    analytics: [],
    advertising: [],
    preferences: [],
    social: [],
    unknown: []
  };

  const patterns = {
    essential: [
      /^session/i, /^csrf/i, /^auth/i, /^login/i, /^security/i,
      /^consent/i, /^necessary/i, /^required/i
    ],
    analytics: [
      /^_ga/i, /^_gid/i, /^_gtm/i, /^_gat/i, /^google/i,
      /^analytics/i, /^tracking/i, /^stats/i, /^metrics/i,
      /^utm/i, /^hotjar/i, /^mixpanel/i, /^amplitude/i
    ],
    advertising: [
      /^_fbp/i, /^_fbc/i, /^facebook/i, /^fb/i,
      /^doubleclick/i, /^googleads/i, /^adsystem/i,
      /^ad/i, /^marketing/i, /^retargeting/i, /^conversion/i
    ],
    preferences: [
      /^pref/i, /^settings/i, /^theme/i, /^language/i,
      /^locale/i, /^timezone/i, /^currency/i
    ],
    social: [
      /^twitter/i, /^linkedin/i, /^instagram/i, /^youtube/i,
      /^social/i, /^share/i, /^like/i
    ]
  };

  cookies.forEach(cookie => {
    let categorized = false;

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      if (categoryPatterns.some(pattern => pattern.test(cookie.name))) {
        categories[category].push({
          name: cookie.name,
          domain: cookie.domain,
          type: category,
          expires: formatExpiration(cookie.expirationDate),
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          isThirdParty: cookie.isThirdParty
        });
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.unknown.push({
        name: cookie.name,
        domain: cookie.domain,
        type: 'unknown',
        expires: formatExpiration(cookie.expirationDate),
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        isThirdParty: cookie.isThirdParty
      });
    }
  });

  return categories;
}

// Format cookie expiration date
function formatExpiration(expirationDate) {
  if (!expirationDate) return 'Session';

  const expireTime = new Date(expirationDate * 1000);
  const now = new Date();
  const diffTime = expireTime - now;

  if (diffTime <= 0) return 'Expired';

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return '1 day';
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;

  return `${Math.ceil(diffDays / 365)} years`;
}

// Analyze cookie banners and consent mechanisms
export function analyzeCookieBanner() {
  const bannerData = {
    hasBanner: false,
    bannerText: '',
    hasAcceptButton: false,
    hasRejectButton: false,
    hasSettingsButton: false,
    consentCategories: [],
    bannerElement: null
  };

  // Common cookie banner selectors
  const bannerSelectors = [
    '[class*="cookie"]',
    '[id*="cookie"]',
    '[class*="consent"]',
    '[id*="consent"]',
    '[class*="gdpr"]',
    '[id*="gdpr"]',
    '[class*="privacy"]',
    '[id*="privacy"]',
    '.notice',
    '.banner',
    '[role="banner"]'
  ];

  // Find cookie banner elements
  let bannerElement = null;

  for (const selector of bannerSelectors) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      const text = element.textContent.toLowerCase();

      // Check if element contains cookie/privacy related keywords
      if (text.includes('cookie') || text.includes('consent') ||
          text.includes('privacy') || text.includes('gdpr') ||
          text.includes('tracking')) {
        bannerElement = element;
        break;
      }
    }

    if (bannerElement) break;
  }

  if (bannerElement) {
    bannerData.hasBanner = true;
    bannerData.bannerElement = getElementInfo(bannerElement);
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

      if (buttonText.includes('setting') || buttonText.includes('option') ||
          buttonText.includes('preference') || buttonText.includes('customize')) {
        bannerData.hasSettingsButton = true;
      }
    });

    // Look for consent categories
    bannerData.consentCategories = extractConsentCategories(bannerElement);
  }

  // Also check for common cookie consent frameworks
  const frameworks = detectConsentFrameworks();
  if (frameworks.length > 0) {
    bannerData.detectedFrameworks = frameworks;
  }

  console.log('Cookie banner analysis:', bannerData);

  return bannerData;
}

// Extract consent categories from banner
function extractConsentCategories(bannerElement) {
  const categories = [];
  const categoryKeywords = {
    necessary: ['necessary', 'essential', 'required', 'functional'],
    analytics: ['analytics', 'statistical', 'performance', 'measurement'],
    advertising: ['advertising', 'marketing', 'targeting', 'personalization'],
    social: ['social', 'media', 'sharing', 'embed']
  };

  const text = bannerElement.textContent.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category);
    }
  }

  return categories;
}

// Detect common consent management frameworks
function detectConsentFrameworks() {
  const frameworks = [];

  // Check for common CMP frameworks
  const cmpChecks = {
    'OneTrust': () => window.OneTrust || document.querySelector('[data-domain-script]'),
    'Cookiebot': () => window.Cookiebot || document.querySelector('#CookieDeclaration'),
    'TrustArc': () => window.truste || document.querySelector('#consent_blackbar'),
    'Quantcast': () => window.__cmp || document.querySelector('.qc-cmp-ui'),
    'ConsentManager': () => window.consentmanager || document.querySelector('[data-cmp-ab]'),
    'Iubenda': () => window._iub || document.querySelector('.iubenda-cookie-banner')
  };

  for (const [name, check] of Object.entries(cmpChecks)) {
    try {
      if (check()) {
        frameworks.push(name);
      }
    } catch (error) {
      // Ignore errors in framework detection
    }
  }

  return frameworks;
}

// Get element information for reference
function getElementInfo(element) {
  return {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    visible: isElementVisible(element),
    position: getElementPosition(element)
  };
}

// Check if element is visible
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

// Get element position information
function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right
  };
}