// AI Prompt Templates for Privacy Policy Analysis
// Contains all prompt templates used with Chrome's built-in AI APIs

export const PROMPT_TEMPLATES = {

  // 1. Short summarizer pass
  SUMMARIZER: {
    name: 'privacy_summarizer',
    template: `You are a concise privacy-policy summarizer. Given the following privacy policy text, return:
• A 2-sentence plain English summary of what this site does with user personal data.
• A JSON array of the main categories of data collected (e.g., email, name, payment, device, location, IP).
• Any explicit retention times mentioned.

INPUT:
{policyText}

OUTPUT FORMAT:
{
"summary": "…",
"categories": ["email", "ip", …],
"retention_clauses": ["…"]
}`,
    maxTokens: 500
  },

  // 2. Cookie analysis prompt
  COOKIE_ANALYZER: {
    name: 'cookie_analyzer',
    template: `You are a cookie policy analyzer. Given cookies extracted from the site and any cookie table text from the policy, return:
• Number of first-party and third-party cookies.
• Whether cookies are used for tracking/advertising (yes/no/likely)
• If cookie categories (strictly-necessary, preferences, statistics, marketing) are explicitly present and which cookies belong to which category.

INPUT:
{cookieData}

OUTPUT FORMAT: JSON with fields { first_party: n, third_party: n, tracking: true|false|unknown, categories: {…} }`,
    maxTokens: 400
  },

  // 3. Deletion & rights prompt
  DELETION_ANALYZER: {
    name: 'deletion_analyzer',
    template: `You are a privacy-rights assistant. Read the policy and find whether it explains:
• How a user can request deletion of data.
• If a deletion process is described, provide step-by-step instructions and any links or emails.
• If deletion is not described, return "no deletion info".

INPUT:
{policyText}

OUTPUT FORMAT: JSON { can_delete: "yes|no|partial|unknown", instructions: "…" , links: ["…"], contacts: ["…"] }`,
    maxTokens: 300
  },

  // 4. Overall risk scoring + verdict (final combined prompt)
  RISK_SCORER: {
    name: 'risk_scorer',
    template: `You are a privacy risk scoring agent. Given the summarizer output, cookie analysis, and deletion analysis, produce:
• risk_score (0-100) where 0 = no known issues, 100 = high-risk (massive data sharing, no deletion, third-party trackers)
• verdict: SAFE | CAUTION | UNSAFE
• concise reasons (max 5 bullets)
• recommended user actions (max 4)

INPUT:
{
"summarizer": {summarizerResult},
"cookies": {cookieResult},
"deletion": {deletionResult},
"domain": "{domain}",
"url": "{url}"
}

OUTPUT FORMAT: JSON { "risk_score": int, "verdict":"", "reasons":[…], "actions":[…] }`,
    maxTokens: 400
  }
};

// Scoring criteria for risk assessment
export const RISK_FACTORS = {
  HIGH_RISK: {
    score: 30,
    factors: [
      'shares data with many third parties',
      'no clear deletion process',
      'extensive tracking cookies',
      'unclear data retention',
      'no user control over data'
    ]
  },
  MEDIUM_RISK: {
    score: 15,
    factors: [
      'limited third party sharing',
      'complex deletion process',
      'some tracking cookies',
      'vague retention periods',
      'limited user control'
    ]
  },
  LOW_RISK: {
    score: 5,
    factors: [
      'minimal data collection',
      'clear deletion process',
      'essential cookies only',
      'transparent practices',
      'strong user control'
    ]
  }
};

// Verdict thresholds
export const VERDICT_THRESHOLDS = {
  SAFE: { min: 0, max: 30 },
  CAUTION: { min: 31, max: 70 },
  UNSAFE: { min: 71, max: 100 }
};

// Format prompt with variables
export function formatPrompt(templateName, variables) {
  const template = PROMPT_TEMPLATES[templateName];

  if (!template) {
    throw new Error(`Unknown prompt template: ${templateName}`);
  }

  let formattedPrompt = template.template;

  // Replace variables in the template
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    formattedPrompt = formattedPrompt.replace(new RegExp(placeholder, 'g'), replacement);
  });

  return {
    prompt: formattedPrompt,
    maxTokens: template.maxTokens || 500,
    name: template.name
  };
}

// Validate AI response format
export function validateResponse(templateName, response) {
  try {
    const parsed = JSON.parse(response);

    switch (templateName) {
      case 'SUMMARIZER':
        return parsed.summary && Array.isArray(parsed.categories);

      case 'COOKIE_ANALYZER':
        return typeof parsed.first_party === 'number' &&
               typeof parsed.third_party === 'number';

      case 'DELETION_ANALYZER':
        return ['yes', 'no', 'partial', 'unknown'].includes(parsed.can_delete);

      case 'RISK_SCORER':
        return typeof parsed.risk_score === 'number' &&
               ['SAFE', 'CAUTION', 'UNSAFE'].includes(parsed.verdict) &&
               Array.isArray(parsed.reasons);

      default:
        return true;
    }
  } catch (error) {
    console.error('Response validation failed:', error);
    return false;
  }
}

// Generate fallback response for failed AI calls
export function generateFallbackResponse(templateName, inputData) {
  switch (templateName) {
    case 'SUMMARIZER':
      return {
        summary: "Unable to analyze privacy policy automatically. Manual review recommended.",
        categories: ["unknown"],
        retention_clauses: ["not specified"]
      };

    case 'COOKIE_ANALYZER':
      const cookieCount = inputData.cookieData?.cookieCount || 0;
      const thirdParty = inputData.cookieData?.thirdPartyCookies || 0;

      return {
        first_party: cookieCount - thirdParty,
        third_party: thirdParty,
        tracking: thirdParty > 0 ? "likely" : "unknown",
        categories: {}
      };

    case 'DELETION_ANALYZER':
      return {
        can_delete: "unknown",
        instructions: "Contact site support for data deletion requests",
        links: [],
        contacts: []
      };

    case 'RISK_SCORER':
      // Generate conservative risk score
      let riskScore = 50; // Default medium risk

      // Adjust based on available data
      if (inputData.cookies?.third_party > 5) riskScore += 20;
      if (inputData.deletion?.can_delete === 'no') riskScore += 15;

      const verdict = riskScore < 30 ? 'SAFE' : riskScore < 70 ? 'CAUTION' : 'UNSAFE';

      return {
        risk_score: Math.min(riskScore, 100),
        verdict,
        reasons: ["AI analysis unavailable", "Manual review recommended"],
        actions: ["Review privacy policy manually", "Contact site for data practices"]
      };

    default:
      return { error: "Unknown template for fallback" };
  }
}

// System prompts for different AI models/contexts
export const SYSTEM_PROMPTS = {
  GENERAL: "You are a privacy policy analysis assistant. Provide accurate, concise analysis of website privacy practices. Always return valid JSON in the specified format.",

  SUMMARIZER: "You are a privacy policy summarizer. Focus on data collection, usage, and sharing practices. Be concise but comprehensive.",

  RISK_ASSESSOR: "You are a privacy risk assessment expert. Evaluate privacy practices objectively and provide actionable recommendations for users."
};

// Configuration for AI API calls
export const AI_CONFIG = {
  temperature: 0.1, // Low temperature for consistent analysis
  maxRetries: 2,
  timeoutMs: 30000,
  fallbackEnabled: true
};