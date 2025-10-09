// AI Client - Wrapper for Chrome's built-in AI APIs
import {
  PROMPT_TEMPLATES,
  formatPrompt,
  validateResponse,
  generateFallbackResponse,
  SYSTEM_PROMPTS,
  AI_CONFIG
} from './prompt-templates.js';

// Main function to analyze privacy policy using AI
export async function analyzePrivacyPolicy(analysisData) {
  console.log('Starting AI analysis for:', analysisData.domain);

  try {
    // Step 1: Summarize privacy policy
    const summarizerResult = await runSummarizer(analysisData.privacyPolicyText);

    // Step 2: Analyze cookies
    const cookieResult = await runCookieAnalysis(analysisData.cookies);

    // Step 3: Analyze deletion rights
    const deletionResult = await runDeletionAnalysis(analysisData.privacyPolicyText);

    // Step 4: Generate overall risk assessment
    const riskResult = await runRiskAssessment({
      summarizer: summarizerResult,
      cookies: cookieResult,
      deletion: deletionResult,
      domain: analysisData.domain,
      url: analysisData.url
    });

    // Combine all results into final output
    const finalResult = combineAnalysisResults({
      domain: analysisData.domain,
      url: analysisData.url,
      summarizer: summarizerResult,
      cookies: cookieResult,
      deletion: deletionResult,
      risk: riskResult,
      timestamp: Date.now()
    });

    console.log('AI analysis completed for:', analysisData.domain);
    return finalResult;

  } catch (error) {
    console.error('AI analysis failed:', error);

    // Return fallback analysis
    return generateFallbackAnalysis(analysisData);
  }
}

// Step 1: Summarize privacy policy text
async function runSummarizer(policyText) {
  if (!policyText || policyText.length < 100) {
    return generateFallbackResponse('SUMMARIZER', { policyText });
  }

  const { prompt } = formatPrompt('SUMMARIZER', { policyText });

  try {
    const response = await callAISummarizer(policyText, {
      type: 'key-points',
      format: 'json',
      length: 'short'
    });

    if (validateResponse('SUMMARIZER', response)) {
      return JSON.parse(response);
    } else {
      throw new Error('Invalid summarizer response format');
    }

  } catch (error) {
    console.warn('Summarizer failed, using fallback:', error);
    return generateFallbackResponse('SUMMARIZER', { policyText });
  }
}

// Step 2: Analyze cookie data
async function runCookieAnalysis(cookieData) {
  const { prompt } = formatPrompt('COOKIE_ANALYZER', { cookieData });

  try {
    const response = await callAIPrompt(prompt, {
      temperature: 0.1,
      maxTokens: 400
    });

    if (validateResponse('COOKIE_ANALYZER', response)) {
      return JSON.parse(response);
    } else {
      throw new Error('Invalid cookie analysis response');
    }

  } catch (error) {
    console.warn('Cookie analysis failed, using fallback:', error);
    return generateFallbackResponse('COOKIE_ANALYZER', { cookieData });
  }
}

// Step 3: Analyze deletion rights
async function runDeletionAnalysis(policyText) {
  const { prompt } = formatPrompt('DELETION_ANALYZER', { policyText });

  try {
    const response = await callAIPrompt(prompt, {
      temperature: 0.1,
      maxTokens: 300
    });

    if (validateResponse('DELETION_ANALYZER', response)) {
      return JSON.parse(response);
    } else {
      throw new Error('Invalid deletion analysis response');
    }

  } catch (error) {
    console.warn('Deletion analysis failed, using fallback:', error);
    return generateFallbackResponse('DELETION_ANALYZER', { policyText });
  }
}

// Step 4: Generate risk assessment
async function runRiskAssessment(combinedData) {
  const { prompt } = formatPrompt('RISK_SCORER', {
    summarizerResult: combinedData.summarizer,
    cookieResult: combinedData.cookies,
    deletionResult: combinedData.deletion,
    domain: combinedData.domain,
    url: combinedData.url
  });

  try {
    const response = await callAIPrompt(prompt, {
      temperature: 0.2,
      maxTokens: 400
    });

    if (validateResponse('RISK_SCORER', response)) {
      return JSON.parse(response);
    } else {
      throw new Error('Invalid risk assessment response');
    }

  } catch (error) {
    console.warn('Risk assessment failed, using fallback:', error);
    return generateFallbackResponse('RISK_SCORER', combinedData);
  }
}

// Combine all analysis results into final format
function combineAnalysisResults(data) {
  const cookieSummary = data.cookies.categories ?
    Object.entries(data.cookies.categories).map(([category, cookies]) => ({
      category,
      count: cookies.length,
      examples: cookies.slice(0, 3).map(c => ({ name: c.name, domain: c.domain }))
    })) : [];

  return {
    domain: data.domain,
    url: data.url,
    summary: data.summarizer.summary,
    data_use: extractDataUseFromSummary(data.summarizer),
    deletion: {
      can_user_delete: data.deletion.can_delete,
      how: data.deletion.instructions,
      contacts_found: data.deletion.contacts || []
    },
    cookies: {
      cookie_count: data.cookies.first_party + data.cookies.third_party,
      third_party_cookies: data.cookies.third_party,
      tracking_cookies_detected: data.cookies.tracking === true || data.cookies.tracking === "likely",
      cookies_summary: cookieSummary
    },
    risk_score: data.risk.risk_score,
    verdict: data.risk.verdict,
    reasons: data.risk.reasons,
    actions: data.risk.actions || [],
    confidence: calculateConfidence(data),
    timestamp: data.timestamp
  };
}

// Extract data use information from summary
function extractDataUseFromSummary(summarizerResult) {
  return summarizerResult.categories.map(category => ({
    type: category,
    purpose: "not specified",
    retention: summarizerResult.retention_clauses?.[0] || "not specified",
    shared_with: []
  }));
}

// Calculate confidence score based on data quality
function calculateConfidence(data) {
  let confidence = 0.5; // Base confidence

  // Increase confidence based on data quality
  if (data.summarizer.summary && data.summarizer.summary.length > 50) confidence += 0.2;
  if (data.cookies.first_party + data.cookies.third_party > 0) confidence += 0.1;
  if (data.deletion.can_delete !== 'unknown') confidence += 0.1;
  if (data.risk.reasons && data.risk.reasons.length > 1) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

// Generate fallback analysis when AI fails completely
function generateFallbackAnalysis(analysisData) {
  const cookieCount = analysisData.cookies?.cookieCount || 0;
  const thirdPartyCount = analysisData.cookies?.thirdPartyCookies || 0;

  // Simple heuristic-based risk assessment
  let riskScore = 30; // Base risk
  if (thirdPartyCount > 5) riskScore += 30;
  if (thirdPartyCount > 10) riskScore += 20;
  if (!analysisData.privacyPolicyText) riskScore += 20;

  const verdict = riskScore < 40 ? 'SAFE' : riskScore < 70 ? 'CAUTION' : 'UNSAFE';

  return {
    domain: analysisData.domain,
    url: analysisData.url,
    summary: "AI analysis unavailable. Manual privacy policy review recommended.",
    data_use: [{ type: "unknown", purpose: "unknown", retention: "unknown", shared_with: [] }],
    deletion: {
      can_user_delete: "unknown",
      how: "Contact website support for data deletion requests",
      contacts_found: []
    },
    cookies: {
      cookie_count: cookieCount,
      third_party_cookies: thirdPartyCount,
      tracking_cookies_detected: thirdPartyCount > 0,
      cookies_summary: []
    },
    risk_score: Math.min(riskScore, 100),
    verdict,
    reasons: ["AI analysis unavailable", "High number of third-party cookies detected"],
    actions: ["Review privacy policy manually", "Consider blocking third-party cookies"],
    confidence: 0.3,
    timestamp: Date.now()
  };
}

// Chrome AI API wrapper functions
async function callAISummarizer(text, options = {}) {
  // Try Chrome's built-in summarizer API
  if (typeof chrome !== 'undefined' && chrome.ai && chrome.ai.summarizer) {
    try {
      const summarizer = await chrome.ai.summarizer.create({
        type: options.type || 'key-points',
        format: options.format || 'markdown',
        length: options.length || 'medium'
      });

      const result = await summarizer.summarize(text);
      summarizer.destroy();

      return result;
    } catch (error) {
      console.warn('Chrome AI summarizer failed:', error);
      throw error;
    }
  }

  // Fallback to experimental API
  if (typeof chrome !== 'undefined' && chrome.ai && chrome.ai.languageModel) {
    return await callAIPrompt(`Summarize this privacy policy in 2 sentences and list data categories as JSON: ${text}`, options);
  }

  throw new Error('Chrome AI APIs not available');
}

async function callAIPrompt(prompt, options = {}) {
  // Try Chrome's built-in prompt API
  if (typeof chrome !== 'undefined' && chrome.ai && chrome.ai.languageModel) {
    try {
      const session = await chrome.ai.languageModel.create({
        temperature: options.temperature || AI_CONFIG.temperature,
        topK: options.topK || 3
      });

      const result = await session.prompt(prompt);
      session.destroy();

      return result;
    } catch (error) {
      console.warn('Chrome AI prompt API failed:', error);
      throw error;
    }
  }

  // Fallback for development/testing
  if (typeof globalThis !== 'undefined' && globalThis.mockAI) {
    return await globalThis.mockAI.prompt(prompt, options);
  }

  throw new Error('Chrome AI APIs not available');
}

// Mock AI for development/testing
export function enableMockAI() {
  globalThis.mockAI = {
    async prompt(prompt, options) {
      console.log('Mock AI prompt:', prompt.substring(0, 100) + '...');

      // Simple mock responses based on prompt content
      if (prompt.includes('summarizer')) {
        return JSON.stringify({
          summary: "This site collects personal data for analytics and marketing. Data may be shared with third parties.",
          categories: ["email", "ip", "device"],
          retention_clauses: ["24 months for analytics data"]
        });
      }

      if (prompt.includes('cookie')) {
        return JSON.stringify({
          first_party: 3,
          third_party: 7,
          tracking: true,
          categories: { analytics: 4, advertising: 3 }
        });
      }

      if (prompt.includes('deletion')) {
        return JSON.stringify({
          can_delete: "yes",
          instructions: "Contact privacy@example.com to request data deletion",
          links: ["mailto:privacy@example.com"],
          contacts: ["privacy@example.com"]
        });
      }

      if (prompt.includes('risk')) {
        return JSON.stringify({
          risk_score: 65,
          verdict: "CAUTION",
          reasons: ["Third-party tracking detected", "Data sharing with partners"],
          actions: ["Review privacy settings", "Consider ad blockers"]
        });
      }

      return "Mock AI response";
    }
  };

  console.log('Mock AI enabled for development');
}