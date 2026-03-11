/**
 * Financial Text Adapter — extracts Financial Semantic Primes from
 * news headlines and social text, transforms them into signals[] for
 * the JtechAi math engine.
 *
 * Same pattern as CrisisFACTS adapter but tuned for financial/market
 * language. Detects linguistic prime regression in financial stress:
 * when market language contracts to bankruptcy-default-collapse
 * primitives under extreme systemic stress.
 *
 * Input:  array of text records { text, timestamp }
 * Output: { signals[], entropy, primeDensity, dissolutionRate, propagationRate, wordCount }
 *
 * 37F Doctrine: Dissolution must be rare and undeniable.
 * Same strict threshold philosophy as CAMEO 17-20.
 */

// ================================================================
// STOPWORDS — filtered before prime extraction
// (same set as crisisfacts-adapter for consistency)
// ================================================================

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must",
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "it", "its", "they", "them", "their",
  "this", "that", "these", "those", "what", "which", "who", "whom",
  "and", "but", "or", "nor", "not", "so", "if", "then", "than",
  "of", "in", "on", "at", "to", "for", "with", "by", "from", "up",
  "out", "off", "over", "into", "through", "about", "after", "before",
  "during", "between", "under", "above", "below",
  "just", "also", "very", "too", "quite", "really", "still", "even",
  "how", "when", "where", "why", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "only",
  "same", "than", "like", "get", "got", "go", "going", "went",
  "come", "came", "take", "took", "make", "made", "see", "saw",
  "know", "knew", "think", "thought", "say", "said", "tell", "told",
  "rt", "via", "amp", "https", "http", "www", "com",
]);

// ================================================================
// PRIME EXTRACTION DICTIONARY — Financial Domain
// ================================================================

// DISSOLUTION PRIMES — Financial system breakdown indicators
// Strict 37F doctrine: only genuine irreversible financial harm or systemic panic

const DISSOLUTION_CRITICAL = {
  // BANKRUPTCY — legal/financial termination
  bankruptcy: new Set([
    "bankruptcy", "bankrupt", "insolvent", "insolvency", "chapter11",
  ]),
  // DEFAULT — failure to meet obligations
  default: new Set([
    "default", "defaults", "defaulted", "defaulting", "nonpayment",
  ]),
  // FRAUD — criminal financial misconduct
  fraud: new Set([
    "fraud", "fraudulent", "ponzi", "embezzlement", "scandal",
  ]),
  // LIQUIDATION — forced asset disposal / delisting
  liquidation: new Set([
    "liquidation", "liquidated", "liquidating", "delisted", "delisting", "seized", "seizes",
  ]),
  // COLLAPSE — total structural failure
  collapse: new Set([
    "collapse", "collapsed", "collapses", "collapsing", "implosion", "meltdown", "failure",
  ]),
};

const DISSOLUTION_HIGH = {
  // DOWNGRADE — credit/rating deterioration
  downgrade: new Set([
    "downgrade", "downgrades", "downgraded", "junk", "negative",
  ]),
  // LAYOFFS — workforce dissolution
  layoffs: new Set([
    "layoffs", "layoff", "firing", "fired", "terminated", "workforce", "reduction",
  ]),
  // INVESTIGATION — regulatory/legal threat
  investigation: new Set([
    "investigation", "sec", "probe", "subpoena", "indictment", "sued",
  ]),
  // SHORTFALL — missed targets / warnings
  shortfall: new Set([
    "cut", "slashed", "lowered", "missed", "shortfall", "warning",
  ]),
  // WRITEDOWN — asset impairment / losses
  writedown: new Set([
    "writedown", "impairment", "writeoff", "losses", "loss",
  ]),
  // RESTRUCTURING — organizational distress
  restructuring: new Set([
    "restructuring", "restructured", "reorganization", "bailout",
  ]),
  // CRASH — rapid price destruction
  crash: new Set([
    "crash", "crashes", "crashed", "crashing", "plunge", "plunges", "plunged", "plummeted", "tanked", "cratered",
  ]),
  // CONTAGION — systemic risk indicators
  contagion: new Set([
    "contagion", "spillover", "systemic", "panic", "run", "fears",
  ]),
};

// PROPAGATION PRIMES — Market stabilization / positive indicators

const PROPAGATION_MODERATE = {
  // UPGRADE — improved rating/outlook
  upgrade: new Set([
    "upgrade", "upgraded", "outperform", "overweight",
  ]),
  // BEAT — exceeded expectations
  beat: new Set([
    "beat", "beats", "exceeded", "surpassed", "topped",
  ]),
  // RAISED — increased guidance/targets
  raised: new Set([
    "raised", "raises", "raising", "increased", "boost", "boosted",
  ]),
  // BUYBACK — capital return to shareholders
  buyback: new Set([
    "buyback", "repurchase", "dividend",
  ]),
  // ACQUISITION — growth via M&A
  acquisition: new Set([
    "acquisition", "acquired", "merger", "deal",
  ]),
};

const PROPAGATION_WATCH = {
  // STABLE — maintenance of status quo
  stable: new Set([
    "stable", "reaffirmed", "maintained", "inline", "steady",
  ]),
  // OUTLOOK — forward-looking positive language
  outlook: new Set([
    "outlook", "forecast", "estimates", "growth", "improving",
  ]),
  // RALLY — positive price movement
  rally: new Set([
    "rally", "rallied", "surged", "soared", "gained", "record", "high",
  ]),
  // RECOVERY — return from distress
  recovery: new Set([
    "recovery", "recovered", "recovering", "rebound", "rebounded",
  ]),
};

// BIGRAM PRIMES — multi-word patterns with stronger signal than components

const BIGRAM_DISSOLUTION_CRITICAL = new Set([
  "going bankrupt", "margin called", "trading halted", "bank run",
  "debt default", "total collapse", "filing bankruptcy", "massive fraud",
  "complete failure", "wiped out",
]);

const BIGRAM_DISSOLUTION_HIGH = new Set([
  "guidance lowered", "sec investigation", "credit downgrade",
  "mass layoffs", "stock crashed", "shares plunged", "market crash",
  "sell off", "short selling", "credit crunch", "liquidity crisis",
]);

const BIGRAM_PROPAGATION_MODERATE = new Set([
  "beat estimates", "raised guidance", "strong buy", "price target",
  "earnings beat", "dividend increase", "stock upgrade", "buy rating",
]);

const BIGRAM_PROPAGATION_WATCH = new Set([
  "all clear", "stable outlook", "strong growth", "record high",
  "positive momentum", "broad rally", "market recovery",
]);

// ================================================================
// TOKENIZATION
// ================================================================

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")       // strip URLs
    .replace(/@\w+/g, "")                  // strip mentions
    .replace(/\$(\w+)/g, "$1")             // strip $ from $TICKER, keep word
    .replace(/#(\w+)/g, "$1")              // keep hashtag text, strip #
    .replace(/[^a-z\s]/g, " ")            // strip non-alpha
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(tokens[i] + " " + tokens[i + 1]);
  }
  return bigrams;
}

// ================================================================
// PRIME SCANNING
// ================================================================

function scanDictionary(tokens, dictionary) {
  const hits = {};
  let total = 0;
  for (const [category, wordSet] of Object.entries(dictionary)) {
    const matches = tokens.filter(t => wordSet.has(t));
    hits[category] = matches;
    total += matches.length;
  }
  return { hits, total };
}

function scanBigrams(bigrams, bigramSet) {
  return bigrams.filter(b => bigramSet.has(b));
}

// ================================================================
// SHANNON ENTROPY — over prime category distribution
// Low S = text concentrated on few prime categories = cognitive regression
// ================================================================

export function computeFinancialTextEntropy(categoryHits) {
  const counts = Object.values(categoryHits).map(arr => arr.length).filter(c => c > 0);
  if (counts.length === 0) return 0;
  const total = counts.reduce((a, b) => a + b, 0);
  let S = 0;
  for (const count of counts) {
    const p = count / total;
    if (p > 0) S -= p * Math.log2(p);
  }
  return S;
}

// ================================================================
// SEVERITY CLASSIFICATION — Density -> Severity Level
// ================================================================

function densityToSeverity(density, thresholds) {
  for (const [level, threshold] of thresholds) {
    if (density >= threshold) return level;
  }
  return "watch";
}

// ================================================================
// MAIN ADAPTER — raw financial text batch -> signals[]
// ================================================================

/**
 * Transform a batch of financial text records into signals[]
 * for the math engine.
 *
 * @param {Object[]} records - [{ text, timestamp }]
 * @param {Object} thresholds - severity threshold config
 * @returns {Object} { signals[], entropy, primeDensity, dissolutionRate, propagationRate, wordCount }
 */
export function financialTextToSignals(records, thresholds) {
  if (records.length === 0) {
    return { signals: [], entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0, wordCount: 0 };
  }

  // Concatenate all text for batch-level analysis
  const allTokens = [];
  const allBigrams = [];

  for (const rec of records) {
    const tokens = tokenize(rec.text || "");
    allTokens.push(...tokens);
    allBigrams.push(...extractBigrams(tokens));
  }

  if (allTokens.length === 0) {
    return { signals: [], entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0, wordCount: 0 };
  }

  // Scan unigrams
  const dissCrit = scanDictionary(allTokens, DISSOLUTION_CRITICAL);
  const dissHigh = scanDictionary(allTokens, DISSOLUTION_HIGH);
  const propMod = scanDictionary(allTokens, PROPAGATION_MODERATE);
  const propWatch = scanDictionary(allTokens, PROPAGATION_WATCH);

  // Scan bigrams
  const bigramDissCrit = scanBigrams(allBigrams, BIGRAM_DISSOLUTION_CRITICAL);
  const bigramDissHigh = scanBigrams(allBigrams, BIGRAM_DISSOLUTION_HIGH);
  const bigramPropMod = scanBigrams(allBigrams, BIGRAM_PROPAGATION_MODERATE);
  const bigramPropWatch = scanBigrams(allBigrams, BIGRAM_PROPAGATION_WATCH);

  // Totals (bigrams count as 1 hit each)
  const totalDissCrit = dissCrit.total + bigramDissCrit.length;
  const totalDissHigh = dissHigh.total + bigramDissHigh.length;
  const totalDissolution = totalDissCrit + totalDissHigh;

  const totalPropMod = propMod.total + bigramPropMod.length;
  const totalPropWatch = propWatch.total + bigramPropWatch.length;
  const totalPropagation = totalPropMod + totalPropWatch;

  const meaningful = allTokens.length;
  const totalPrimes = totalDissolution + totalPropagation;

  // Prime density (dissolution only — strict, like CAMEO 17-20)
  const primeDensity = totalDissolution / meaningful;
  const propagationDensity = totalPropagation / meaningful;

  // Dissolution/propagation rates (of all detected primes)
  const dissolutionRate = totalPrimes > 0 ? totalDissolution / totalPrimes : 0;
  const propagationRate = totalPrimes > 0 ? totalPropagation / totalPrimes : 0;

  // Shannon entropy over all prime categories (unigram hits only)
  const allCategoryHits = {
    ...dissCrit.hits, ...dissHigh.hits,
    ...propMod.hits, ...propWatch.hits,
  };
  const entropy = computeFinancialTextEntropy(allCategoryHits);

  // ================================================================
  // SIGNAL CONSTRUCTION — 5 universal categories
  // ================================================================

  // ft_condition (condition): collapse + bankruptcy + crash density
  const conditionHits = (dissCrit.hits.collapse?.length || 0)
    + (dissCrit.hits.bankruptcy?.length || 0)
    + (dissHigh.hits.crash?.length || 0);
  const conditionDensity = conditionHits / meaningful;

  // ft_info_flow (flow): earnings beat + investigation density
  const infoHits = (propMod.hits.beat?.length || 0)
    + (dissHigh.hits.investigation?.length || 0);
  const infoDensity = infoHits / meaningful;

  // ft_intensity (price): overall dissolution prime density (the core metric)
  const intensityDensity = primeDensity;

  // ft_capacity (capacity): restructuring + acquisition density
  const capacityHits = (dissHigh.hits.restructuring?.length || 0)
    + (propMod.hits.acquisition?.length || 0);
  const capacityDensity = capacityHits / meaningful;

  // ft_context (context): contagion + fraud density
  const contextHits = (dissHigh.hits.contagion?.length || 0)
    + (dissCrit.hits.fraud?.length || 0);
  const contextDensity = contextHits / meaningful;

  function computeSev(id, value) {
    const levels = thresholds[id];
    if (!levels || value === null || value === undefined) return "watch";
    for (const [level, threshold] of levels) {
      if (value >= threshold) return level;
    }
    return "watch";
  }

  const signals = [
    { id: "ft_condition", category: "condition", severity: computeSev("condition_density", conditionDensity) },
    { id: "ft_info_flow", category: "flow", severity: computeSev("info_density", infoDensity) },
    { id: "ft_intensity", category: "price", severity: computeSev("intensity_density", intensityDensity) },
    { id: "ft_capacity", category: "capacity", severity: computeSev("capacity_density", capacityDensity) },
    { id: "ft_context", category: "context", severity: computeSev("context_density", contextDensity) },
  ];

  return {
    signals,
    entropy,
    primeDensity,
    dissolutionRate,
    propagationRate,
    wordCount: meaningful,
  };
}

// ================================================================
// COMPUTE FINANCIAL PRIME DENSITY — standalone for single text analysis
// ================================================================

export function computeFinancialPrimeDensity(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { primeDensity: 0, propagationDensity: 0, dissolutionHits: 0, propagationHits: 0, tokens: 0 };

  const dissCrit = scanDictionary(tokens, DISSOLUTION_CRITICAL);
  const dissHigh = scanDictionary(tokens, DISSOLUTION_HIGH);
  const propMod = scanDictionary(tokens, PROPAGATION_MODERATE);
  const propWatch = scanDictionary(tokens, PROPAGATION_WATCH);

  const bigrams = extractBigrams(tokens);
  const bigramDiss = scanBigrams(bigrams, BIGRAM_DISSOLUTION_CRITICAL).length
    + scanBigrams(bigrams, BIGRAM_DISSOLUTION_HIGH).length;
  const bigramProp = scanBigrams(bigrams, BIGRAM_PROPAGATION_MODERATE).length
    + scanBigrams(bigrams, BIGRAM_PROPAGATION_WATCH).length;

  const totalDiss = dissCrit.total + dissHigh.total + bigramDiss;
  const totalProp = propMod.total + propWatch.total + bigramProp;

  return {
    primeDensity: totalDiss / tokens.length,
    propagationDensity: totalProp / tokens.length,
    dissolutionHits: totalDiss,
    propagationHits: totalProp,
    tokens: tokens.length,
  };
}
