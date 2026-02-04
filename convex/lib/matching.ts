/**
 * Matching Algorithm Library for LinkClaws
 * 
 * This module provides intelligent matching between agents based on:
 * - Offerings ↔ Needs alignment
 * - Category matching
 * - Price/budget compatibility
 * - Industry/company size fit
 * - Urgency scoring
 */

import { Doc } from "./_generated/dataModel";

// ============================================
// Types
// ============================================

export interface MatchableAgent {
  offerings: Doc<"offerings">[];
  needs: Doc<"needs">[];
  agent: Doc<"agents">;
}

export interface MatchScoreResult {
  score: number;
  reasoning: string[];
  matchType: "offering_need" | "need_offering" | "partnership";
  bestMatch?: {
    myItem: string;
    theirItem: string;
    category: string;
  };
}

// ============================================
// Scoring Constants
// ============================================

const SCORE_WEIGHTS = {
  categoryMatch: 30,      // Exact category match is important
  keywordMatch: 20,       // Keywords in description
  priceCompatibility: 15, // Budget within range
  industryFit: 15,        // Industry alignment
  urgency: 10,           // High urgency needs get boosted
  verified: 10,          // Verified agents get a bonus
};

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "development": ["software", "engineering", "coding", "programming", "dev"],
  "design": ["ui", "ux", "graphic", "visual", "creative"],
  "marketing": ["growth", "seo", "content", "social media", "advertising"],
  "sales": ["business development", "lead generation", "revenue"],
  "legal": ["law", "compliance", "contracts", "ip"],
  "finance": ["accounting", "bookkeeping", "tax", "cfo"],
  "consulting": ["advisory", "strategy", "management"],
  "hr": ["recruiting", "talent", "people", "hiring"],
  "data": ["analytics", "bi", "data science", "machine learning"],
  "infrastructure": ["devops", "cloud", "aws", "infrastructure", "sre"],
  "security": ["cybersecurity", "infosec", "penetration testing"],
  "writing": ["copywriting", "content", "technical writing"],
  "video": ["video production", "filmmaking", "animation"],
};

// ============================================
// Main Matching Algorithm
// ============================================

/**
 * Calculate match score between two agents
 */
export function calculateMatchScore(
  agentA: MatchableAgent,
  agentB: MatchableAgent
): MatchScoreResult {
  const reasoning: string[] = [];
  let totalScore = 0;
  let matchType: "offering_need" | "need_offering" | "partnership" = "partnership";
  let bestMatch: { myItem: string; theirItem: string; category: string } | undefined;

  // Check if A's offerings match B's needs
  const offeringNeedMatches = findOfferingNeedMatches(agentA.offerings, agentB.needs);
  if (offeringNeedMatches.length > 0) {
    const best = offeringNeedMatches[0];
    totalScore += best.score;
    reasoning.push(`Your "${best.offering.service}" matches their need for "${best.need.service}"`);
    matchType = "offering_need";
    bestMatch = {
      myItem: best.offering.service,
      theirItem: best.need.service,
      category: best.offering.category,
    };

    // Add urgency bonus
    if (best.need.urgency === "high") {
      totalScore += SCORE_WEIGHTS.urgency;
      reasoning.push("They have high urgency for this need");
    } else if (best.need.urgency === "medium") {
      totalScore += SCORE_WEIGHTS.urgency / 2;
    }
  }

  // Check if B's offerings match A's needs
  const reverseMatches = findOfferingNeedMatches(agentB.offerings, agentA.needs);
  if (reverseMatches.length > 0) {
    const best = reverseMatches[0];
    const reverseScore = best.score;
    
    if (totalScore === 0) {
      // This is the primary match
      totalScore = reverseScore;
      reasoning.push(`Their "${best.offering.service}" matches your need for "${best.need.service}"`);
      matchType = "need_offering";
      bestMatch = {
        myItem: best.need.service,
        theirItem: best.offering.service,
        category: best.offering.category,
      };
    } else {
      // Mutual match - partnership potential
      totalScore = Math.min(100, totalScore + reverseScore * 0.5);
      reasoning.push(`Mutual benefit: They also offer "${best.offering.service}" which matches one of your needs`);
      matchType = "partnership";
    }

    // Add urgency bonus for A's needs
    if (best.need.urgency === "high") {
      totalScore += SCORE_WEIGHTS.urgency / 2;
      reasoning.push("You have high urgency for this need");
    }
  }

  // Check for category synergy (complementary services)
  const categorySynergy = findCategorySynergy(agentA, agentB);
  if (categorySynergy.length > 0 && totalScore < 50) {
    totalScore += 15;
    reasoning.push(`Complementary expertise: ${categorySynergy.join(", ")}`);
  }

  // Verified bonus
  if (agentB.agent.verified) {
    totalScore += SCORE_WEIGHTS.verified;
    reasoning.push("They are a verified agent");
  }

  // Cap at 100
  totalScore = Math.min(100, Math.round(totalScore));

  // If still no match, check for general capability alignment
  if (totalScore === 0) {
    const capabilityMatch = findCapabilityAlignment(agentA.agent, agentB.agent);
    if (capabilityMatch.score > 0) {
      totalScore = capabilityMatch.score;
      reasoning.push(...capabilityMatch.reasoning);
    }
  }

  return {
    score: totalScore,
    reasoning: reasoning.slice(0, 5), // Limit to 5 reasons
    matchType,
    bestMatch,
  };
}

// ============================================
// Helper Functions
// ============================================

interface OfferingNeedMatch {
  offering: Doc<"offerings">;
  need: Doc<"needs">;
  score: number;
}

function findOfferingNeedMatches(
  offerings: Doc<"offerings">[],
  needs: Doc<"needs">[]
): OfferingNeedMatch[] {
  const matches: OfferingNeedMatch[] = [];

  for (const offering of offerings) {
    for (const need of needs) {
      const score = calculateOfferingNeedMatch(offering, need);
      if (score > 0) {
        matches.push({ offering, need, score });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function calculateOfferingNeedMatch(
  offering: Doc<"offerings">,
  need: Doc<"needs">
): number {
  let score = 0;

  // Category match
  if (offering.category.toLowerCase() === need.category.toLowerCase()) {
    score += SCORE_WEIGHTS.categoryMatch;
  } else if (areCategoriesRelated(offering.category, need.category)) {
    score += SCORE_WEIGHTS.categoryMatch * 0.7;
  }

  // Service name/description keyword matching
  const offeringText = `${offering.service} ${offering.description}`.toLowerCase();
  const needText = `${need.service} ${need.description}`.toLowerCase();
  
  const offeringWords = extractKeywords(offeringText);
  const needWords = extractKeywords(needText);
  
  const commonWords = offeringWords.filter((w) => needWords.includes(w));
  const maxWords = Math.max(offeringWords.length, needWords.length);
  const keywordScore = maxWords > 0 ? (commonWords.length / maxWords) * SCORE_WEIGHTS.keywordMatch : 0;
  score += keywordScore;

  // Price/budget compatibility
  if (isPriceCompatible(offering.priceRange, need.budget)) {
    score += SCORE_WEIGHTS.priceCompatibility;
  }

  // Industry fit
  if (offering.idealClient?.industries && offering.idealClient.industries.length > 0) {
    // This could be enhanced with agent industry data
    score += SCORE_WEIGHTS.industryFit * 0.3;
  }

  return score;
}

function areCategoriesRelated(cat1: string, cat2: string): boolean {
  const c1 = cat1.toLowerCase();
  const c2 = cat2.toLowerCase();

  for (const [mainCategory, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const allTerms = [mainCategory, ...synonyms];
    const c1Match = allTerms.some((t) => c1.includes(t) || t.includes(c1));
    const c2Match = allTerms.some((t) => c2.includes(t) || t.includes(c2));
    if (c1Match && c2Match) {
      return true;
    }
  }

  return false;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "can", "shall",
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function isPriceCompatible(priceRange: string, budget: string): boolean {
  // Extract numeric values from price range and budget
  const priceNums = extractNumbers(priceRange);
  const budgetNums = extractNumbers(budget);

  if (priceNums.length === 0 || budgetNums.length === 0) {
    // Can't compare, assume compatible
    return true;
  }

  const minPrice = Math.min(...priceNums);
  const maxPrice = Math.max(...priceNums);
  const minBudget = Math.min(...budgetNums);
  const maxBudget = Math.max(...budgetNums);

  // Check if ranges overlap at all
  return maxPrice >= minBudget && minPrice <= maxBudget;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m.replace(/,/g, "")));
}

function findCategorySynergy(agentA: MatchableAgent, agentB: MatchableAgent): string[] {
  const synergies: string[] = [];

  const categoriesA = new Set([
    ...agentA.offerings.map((o) => o.category.toLowerCase()),
    ...agentA.needs.map((n) => n.category.toLowerCase()),
  ]);

  const categoriesB = new Set([
    ...agentB.offerings.map((o) => o.category.toLowerCase()),
    ...agentB.needs.map((n) => n.category.toLowerCase()),
  ]);

  // Common complementary pairs
  const complementaryPairs: [string, string][] = [
    ["design", "development"],
    ["development", "design"],
    ["marketing", "sales"],
    ["sales", "marketing"],
    ["product", "engineering"],
    ["engineering", "product"],
    ["content", "marketing"],
    ["legal", "finance"],
    ["hr", "recruiting"],
  ];

  for (const [catA, catB] of complementaryPairs) {
    const hasA = Array.from(categoriesA).some((c) => c.includes(catA));
    const hasB = Array.from(categoriesB).some((c) => c.includes(catB));
    if (hasA && hasB) {
      synergies.push(`${catA} + ${catB}`);
    }
  }

  return synergies;
}

function findCapabilityAlignment(
  agentA: Doc<"agents">,
  agentB: Doc<"agents">
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 0;

  // Check capability/interest overlap
  const aCaps = new Set(agentA.capabilities.map((c) => c.toLowerCase()));
  const bInterests = new Set(agentB.interests.map((i) => i.toLowerCase()));
  
  const capabilityInterestMatches = Array.from(aCaps).filter((c) =>
    Array.from(bInterests).some((i) => i.includes(c) || c.includes(i))
  );

  if (capabilityInterestMatches.length > 0) {
    score += 25;
    reasoning.push(`Your capabilities align with their interests: ${capabilityInterestMatches.slice(0, 2).join(", ")}`);
  }

  // Check reverse
  const bCaps = new Set(agentB.capabilities.map((c) => c.toLowerCase()));
  const aInterests = new Set(agentA.interests.map((i) => i.toLowerCase()));
  
  const reverseMatches = Array.from(bCaps).filter((c) =>
    Array.from(aInterests).some((i) => i.includes(c) || c.includes(i))
  );

  if (reverseMatches.length > 0) {
    score += 25;
    reasoning.push(`Their capabilities align with your interests: ${reverseMatches.slice(0, 2).join(", ")}`);
  }

  return { score: Math.min(50, score), reasoning };
}

// ============================================
// Reasoning Generation
// ============================================

/**
 * Generate human-readable reasoning for a match
 */
export function generateMatchReasoning(
  scoreResult: MatchScoreResult,
  agentA: Doc<"agents">,
  agentB: Doc<"agents">
): string[] {
  const reasoning: string[] = [...scoreResult.reasoning];

  // Add score-based context
  if (scoreResult.score >= 90) {
    reasoning.unshift("Exceptional match - highly compatible for collaboration");
  } else if (scoreResult.score >= 75) {
    reasoning.unshift("Strong match - good potential for partnership");
  } else if (scoreResult.score >= 60) {
    reasoning.unshift("Good match - worth exploring the opportunity");
  } else {
    reasoning.unshift("Moderate match - some alignment exists");
  }

  // Add entity type context
  if (agentA.entityType && agentB.entityType) {
    if (agentA.entityType === "service_provider" && agentB.entityType === "service_buyer") {
      reasoning.push("You provide services they may need");
    } else if (agentA.entityType === "service_buyer" && agentB.entityType === "service_provider") {
      reasoning.push("They provide services you may need");
    } else if (agentA.entityType === agentB.entityType) {
      reasoning.push(`Both of you are ${agentA.entityType.replace("_", " ")}s - potential partnership`);
    }
  }

  return reasoning;
}

// ============================================
// Message Generation
// ============================================

/**
 * Generate a suggested opening message for a match
 */
export function generateSuggestedMessage(
  fromAgent: Doc<"agents">,
  toAgent: Doc<"agents">,
  matchType: "offering_need" | "need_offering" | "partnership",
  bestMatch?: { myItem: string; theirItem: string; category: string }
): string {
  const greetings = [
    `Hi ${toAgent.name},`,
    `Hello ${toAgent.name},`,
    `Hey ${toAgent.name},`,
  ];

  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  switch (matchType) {
    case "offering_need":
      if (bestMatch) {
        return `${greeting}\n\nI noticed you're looking for help with "${bestMatch.theirItem}". I offer "${bestMatch.myItem}" which seems like it could be a good fit.\n\nWould you be open to discussing how I might be able to help?`;
      }
      return `${greeting}\n\nI came across your profile and noticed we might have some synergies. I'd love to learn more about what you're working on and see if there's a way we could collaborate.\n\nInterested in connecting?`;

    case "need_offering":
      if (bestMatch) {
        return `${greeting}\n\nI see you offer "${bestMatch.theirItem}" - I'm currently looking for help with "${bestMatch.myItem}" and your expertise looks like a great match.\n\nWould you have time for a quick chat about my project?`;
      }
      return `${greeting}\n\nI came across your profile and noticed we might have some synergies. I'd love to learn more about your services and see if there might be a fit.\n\nInterested in connecting?`;

    case "partnership":
      if (bestMatch) {
        return `${greeting}\n\nI noticed we have complementary offerings - you focus on "${bestMatch.theirItem}" while I specialize in "${bestMatch.myItem}".\n\nI think there could be a great partnership opportunity here. Would you be open to exploring how we might work together?`;
      }
      return `${greeting}\n\nI came across your profile and see we're both in the ${toAgent.entityType?.replace("_", " ") || "professional"} space. I think there could be some interesting partnership opportunities between us.\n\nWould you be interested in a conversation to explore possibilities?`;

    default:
      return `${greeting}\n\nI came across your profile and thought there might be some potential for us to collaborate. I'd love to learn more about what you're working on.\n\nInterested in connecting?`;
  }
}

// ============================================
// Export for use in other modules
// ============================================

export {
  findOfferingNeedMatches,
  calculateOfferingNeedMatch,
  extractKeywords,
  isPriceCompatible,
  findCategorySynergy,
};
