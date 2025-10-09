// Privacy Policy Scraper Utilities
// Finds and extracts privacy policy content from web pages

// Common privacy policy link patterns
const PRIVACY_PATTERNS = [
  'privacy',
  'privacy-policy',
  'privacy_policy',
  'privacypolicy',
  'data-protection',
  'data-policy',
  'cookie',
  'cookies',
  'cookie-policy',
  'terms',
  'terms-of-service',
  'terms-and-conditions',
  'legal',
  'gdpr',
  'ccpa'
];

// Find privacy policy links on the current page
export function findPrivacyPolicyLinks() {
  const links = [];
  const currentDomain = window.location.hostname;

  // Get all links on the page
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkText = link.textContent.toLowerCase().trim();
    const linkUrl = href.toLowerCase();

    // Check if link matches privacy patterns
    const isPrivacyLink = PRIVACY_PATTERNS.some(pattern => {
      return linkText.includes(pattern) || linkUrl.includes(pattern);
    });

    if (isPrivacyLink) {
      // Convert relative URLs to absolute
      let absoluteUrl;
      try {
        absoluteUrl = new URL(href, window.location.href).href;
      } catch (e) {
        return; // Skip invalid URLs
      }

      const linkDomain = new URL(absoluteUrl).hostname;

      links.push({
        url: absoluteUrl,
        text: linkText,
        isSameDomain: linkDomain === currentDomain,
        element: getElementSelector(link)
      });
    }
  });

  // Sort by relevance (same domain first, then by privacy relevance)
  links.sort((a, b) => {
    // Same domain links first
    if (a.isSameDomain && !b.isSameDomain) return -1;
    if (!a.isSameDomain && b.isSameDomain) return 1;

    // Then by privacy keyword relevance
    const aScore = getPrivacyRelevanceScore(a.text, a.url);
    const bScore = getPrivacyRelevanceScore(b.text, b.url);

    return bScore - aScore;
  });

  // Remove duplicates
  const uniqueLinks = [];
  const seenUrls = new Set();

  links.forEach(link => {
    if (!seenUrls.has(link.url)) {
      seenUrls.add(link.url);
      uniqueLinks.push(link);
    }
  });

  console.log(`Found ${uniqueLinks.length} privacy policy links:`, uniqueLinks);

  return uniqueLinks;
}

// Calculate privacy relevance score for sorting
function getPrivacyRelevanceScore(text, url) {
  let score = 0;

  // High priority terms
  const highPriorityTerms = ['privacy policy', 'privacy-policy', 'data protection'];
  highPriorityTerms.forEach(term => {
    if (text.includes(term) || url.includes(term)) {
      score += 10;
    }
  });

  // Medium priority terms
  const mediumPriorityTerms = ['privacy', 'cookie', 'data'];
  mediumPriorityTerms.forEach(term => {
    if (text.includes(term) || url.includes(term)) {
      score += 5;
    }
  });

  // Low priority terms
  const lowPriorityTerms = ['legal', 'terms'];
  lowPriorityTerms.forEach(term => {
    if (text.includes(term) || url.includes(term)) {
      score += 1;
    }
  });

  return score;
}

// Fetch privacy policy text from URL
export async function fetchPolicyText(url) {
  try {
    console.log(`Fetching privacy policy from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return extractTextFromHTML(html);

  } catch (error) {
    console.error('Error fetching policy text:', error);
    throw error;
  }
}

// Extract clean text from HTML content
export function extractTextFromHTML(html) {
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer',
    '.navigation', '.menu', '.sidebar', '.advertisement',
    '.ad', '.cookie-banner', '.cookie-notice'
  ];

  unwantedSelectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Try to find main content areas
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '.policy-content',
    '.privacy-policy',
    '.legal-content',
    '#content',
    '#main'
  ];

  let contentText = '';

  // Look for main content containers
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      contentText = element.textContent || '';
      break;
    }
  }

  // Fall back to body if no main content found
  if (!contentText) {
    contentText = doc.body?.textContent || '';
  }

  // Clean up the text
  return cleanPolicyText(contentText);
}

// Clean and normalize policy text
function cleanPolicyText(text) {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Remove extra spaces around punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Clean up quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim and limit length
    .trim()
    .substring(0, 50000); // Limit to prevent token overflow
}

// Generate CSS selector for an element (for debugging/reference)
function getElementSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes.join('.')}`;
    }
  }

  let selector = element.tagName.toLowerCase();
  const parent = element.parentElement;

  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    if (index > 0) {
      selector += `:nth-child(${index + 1})`;
    }
  }

  return selector;
}

// Look for privacy-related content in page text
export function findPrivacyTextInPage() {
  const pageText = document.body.textContent || '';

  // Privacy-related patterns to search for
  const privacyPatterns = [
    /privacy policy/gi,
    /data protection/gi,
    /personal information/gi,
    /we collect.*information/gi,
    /we use.*data/gi,
    /third.{0,10}part/gi,
    /cookies?/gi,
    /tracking/gi,
    /analytics/gi,
    /advertising/gi
  ];

  const matches = [];

  privacyPatterns.forEach(pattern => {
    const patternMatches = pageText.match(pattern);
    if (patternMatches) {
      matches.push(...patternMatches);
    }
  });

  // Extract sentences containing privacy keywords
  const sentences = pageText.split(/[.!?]+/);
  const privacySentences = sentences.filter(sentence => {
    const lowerSentence = sentence.toLowerCase();
    return privacyPatterns.some(pattern => pattern.test(lowerSentence));
  });

  return {
    keywordMatches: matches,
    relevantSentences: privacySentences.slice(0, 20), // Limit to prevent overflow
    hasPrivacyContent: matches.length > 0
  };
}