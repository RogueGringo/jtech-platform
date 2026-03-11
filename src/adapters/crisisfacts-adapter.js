/**
 * CrisisFACTS Adapter — extracts Semantic Primes from raw human text
 * and transforms them into signals[] for the JtechAi math engine.
 *
 * Unlike GDELT (pre-structured CAMEO codes), CrisisFACTS provides
 * unstructured text (tweets, posts) under cognitive load. This adapter
 * detects linguistic prime regression: when language contracts to
 * survival-action-state primitives under extreme stress.
 *
 * Input:  array of text records { text, timestamp, [id] }
 * Output: { signals[], entropy, primeDensity, dissolutionRate, propagationRate }
 *
 * 37F Doctrine: Dissolution must be rare and undeniable.
 * Same strict threshold philosophy as CAMEO 17-20.
 */

// ================================================================
// STOPWORDS — filtered before prime extraction
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
// PRIME EXTRACTION DICTIONARY
// ================================================================

// DISSOLUTION PRIMES — Cognitive breakdown indicators
// Strict 37F doctrine: only genuine irreversible harm or survival panic

const DISSOLUTION_CRITICAL = {
  // DEATH — irreversible biological termination
  death: new Set(["dead", "died", "killed", "death", "bodies", "body", "corpse", "fatality", "casualties", "morgue", "fatal"]),
  // DESTROY — irreversible structural/environmental destruction
  destroy: new Set(["destroyed", "collapsed", "explosion", "exploded", "leveled", "obliterated", "rubble", "devastated", "demolished", "flattened"]),
  // TRAPPED — physical immobilization, survival threat
  trapped: new Set(["trapped", "buried", "pinned", "crushed", "suffocating", "drowning"]),
  // VIOLENCE — active lethal force
  violence: new Set(["shooting", "shot", "stabbed", "massacre", "slaughter", "gunfire", "executed"]),
  // PANIC — flight/freeze survival response
  panic: new Set(["screaming", "panic", "chaos", "stampede", "flee", "fleeing"]),
  // LOSS OF AGENCY — total systemic failure, cognitive freeze (37F doctrinal addition)
  // Transition from action to inaction = unlocked manifold
  // Note: "nothing" and "lost" excluded — too ambiguous in normal speech.
  // They only signal dissolution in co-occurrence with other dissolution primes,
  // which the bigram scanner handles ("no help", "no escape").
  agency: new Set(["helpless", "abandoned", "gone", "nowhere", "hopeless", "powerless", "alone"]),
};

const DISSOLUTION_HIGH = {
  // INJURY — reversible physical harm, not yet fatal
  injury: new Set(["injured", "wounded", "hurt", "bleeding", "broken", "burns", "burned", "trauma"]),
  // FIRE — active thermal threat
  fire: new Set(["fire", "burning", "flames", "blaze", "inferno", "smoke", "wildfire"]),
  // THREAT — imminent lethal potential
  threat: new Set(["bomb", "shooter", "armed", "weapon", "hostage", "siege", "threat", "explosive"]),
  // FLOOD — active hydrological threat
  flood: new Set(["flooding", "submerged", "underwater", "swept", "floodwater", "inundated"]),
  // URGENT — distress signal, requesting immediate intervention
  urgent: new Set(["emergency", "desperate", "sos", "mayday", "critical", "urgent", "dire"]),
  // DEPRIVATION — unmet basic biological needs (the implicit crisis the old dictionary missed)
  // "starving and thirsty" = dissolution. "food distribution" = propagation (handled by bigrams).
  deprivation: new Set(["starving", "thirsty", "hungry", "dehydrated", "starvation", "malnourished", "famished", "starved"]),
  // SUFFERING — active medical/physical distress without explicit injury
  // Distinct from injury (which implies trauma event). Suffering = ongoing deterioration.
  suffering: new Set(["suffering", "sick", "fever", "infection", "disease", "cholera", "epidemic", "malaria", "plague", "dying"]),
  // DISPLACEMENT — loss of shelter/home, forced movement
  // "homeless" is unambiguous. "shelter" alone is propagation (provided). "no shelter" is bigram dissolution.
  displacement: new Set(["homeless", "displaced", "unsheltered", "stranded", "refugee", "refugees", "uprooted"]),
};

// PROPAGATION PRIMES — Stabilization / coordination indicators

const PROPAGATION_MODERATE = {
  // RESPONSE — active system re-formation
  response: new Set(["responding", "dispatched", "deployed", "mobilized", "activated", "staging"]),
  // MEDICAL — health system engagement
  medical: new Set(["hospital", "ambulance", "paramedic", "triage", "treated", "evacuated", "medevac"]),
  // AUTHORITY — institutional presence (re-establishing control)
  authority: new Set(["police", "military", "guard", "fema", "firefighters", "responders", "officers"]),
  // INFO — verified information flow (counter to rumor/chaos)
  info: new Set(["confirmed", "official", "update", "verified", "breaking", "reported", "briefing"]),
};

const PROPAGATION_WATCH = {
  // SAFE — survival confirmed
  safe: new Set(["safe", "alive", "rescued", "found", "recovered", "shelter", "sheltered", "unharmed"]),
  // RESOLVE — threat neutralized
  resolve: new Set(["contained", "controlled", "stable", "cleared", "reopened", "restored", "resolved"]),
  // COMMUNITY — collective action (cognitive re-integration)
  community: new Set(["volunteers", "donations", "support", "rebuild", "together", "united", "relief"]),
  // IMPROVE — trajectory toward baseline
  improve: new Set(["improving", "receding", "weakening", "passing", "ended", "over", "recovering"]),
};

// BIGRAM PRIMES — multi-word patterns that carry stronger signal than components

const BIGRAM_DISSOLUTION_CRITICAL = new Set([
  "please help", "help us", "help me", "no help", "no response", "no rescue",
  "all dead", "many dead", "people dead", "people dying", "mass casualty",
  "cant breathe", "can breathe", "no way", "no escape", "no one",
  // Expanded: mass deprivation / systemic collapse
  "people starving", "people hungry", "people sick", "people suffering",
  "nothing eat", "nowhere go", "nobody coming", "all alone",
]);

const BIGRAM_DISSOLUTION_HIGH = new Set([
  "on fire", "under water", "rising water", "active shooter", "shots fired",
  "need help", "need rescue", "need water", "need food", "still trapped",
  "no power", "no water", "no food", "cut off",
  // Expanded: unmet needs (word alone is ambiguous, pair is unambiguous)
  "send food", "send water", "send medicine", "send help",
  "need medicine", "need shelter", "need doctor", "need hospital",
  "no medicine", "no shelter", "no doctor", "no hospital",
  "without food", "without water", "without shelter", "without medicine",
  "pregnant woman", "small child", "little kid",
]);

const BIGRAM_PROPAGATION_MODERATE = new Set([
  "en route", "search rescue", "first responders", "emergency services",
  "red cross", "national guard", "being evacuated", "help arriving",
]);

const BIGRAM_PROPAGATION_WATCH = new Set([
  "all clear", "under control", "back normal", "power restored",
  "roads open", "schools open", "water safe",
]);

// ================================================================
// TOKENIZATION
// ================================================================

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")       // strip URLs
    .replace(/@\w+/g, "")                  // strip mentions
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

export function computeTextEntropy(categoryHits) {
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
// SEVERITY CLASSIFICATION — Prime Density → Severity Level
// ================================================================

function densityToSeverity(density, thresholds) {
  for (const [level, threshold] of thresholds) {
    if (density >= threshold) return level;
  }
  return "watch";
}

// ================================================================
// MAIN ADAPTER — raw text batch → signals[]
// ================================================================

/**
 * Transform a batch of CrisisFACTS text records into signals[]
 * for the math engine.
 *
 * @param {Object[]} records - [{ text, timestamp, [id] }]
 * @param {Object} thresholds - severity threshold config
 * @returns {Object} { signals[], entropy, primeDensity, dissolutionRate, propagationRate, wordCount }
 */
export function crisisTextToSignals(records, thresholds) {
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
  const entropy = computeTextEntropy(allCategoryHits);

  // Condition signal: physical state primes (death + injury + trapped + safe)
  const conditionDiss = (dissCrit.hits.death?.length || 0) + (dissCrit.hits.trapped?.length || 0) + (dissHigh.hits.injury?.length || 0);
  const conditionProp = (propWatch.hits.safe?.length || 0);
  const conditionDensity = (conditionDiss - conditionProp * 0.5) / meaningful;

  // NEGATIVE SPACE DOCTRINE (37F):
  // When dissolution overwhelms propagation (>80%), the ABSENCE of
  // stabilizing language (info, response) is itself evidence of system failure.
  // "No one is coming" doesn't need to say "police" — the silence IS the signal.
  const absenceAmplifier = dissolutionRate > 0.80 ? primeDensity : 0;

  // Info flow signal: verified language present, OR absence under dissolution
  const infoPresent = (propMod.hits.info?.length || 0) / meaningful;
  const infoDensity = Math.max(infoPresent, absenceAmplifier);

  // Intensity signal: overall dissolution prime density (the core metric)
  const intensityDensity = primeDensity;

  // Capacity signal: response engagement present, OR absence under dissolution
  const capacityPrimes = (propMod.hits.response?.length || 0) + (propMod.hits.medical?.length || 0) + (propMod.hits.authority?.length || 0);
  const capacityPresent = capacityPrimes / meaningful;
  const capacityDensity = Math.max(capacityPresent, absenceAmplifier);

  // Context signal: agency loss + panic (37F doctrinal markers)
  const contextDiss = (dissCrit.hits.agency?.length || 0) + (dissCrit.hits.panic?.length || 0);
  const contextDensity = contextDiss / meaningful;

  function computeSev(id, value) {
    const levels = thresholds[id];
    if (!levels || value === null || value === undefined) return "watch";
    for (const [level, threshold] of levels) {
      if (value >= threshold) return level;
    }
    return "watch";
  }

  const signals = [
    { id: "cf_crisis_condition", category: "crisis_condition", severity: computeSev("condition_density", conditionDensity) },
    { id: "cf_info_flow", category: "info_flow", severity: computeSev("info_density", infoDensity) },
    { id: "cf_crisis_intensity", category: "crisis_intensity", severity: computeSev("intensity_density", intensityDensity) },
    { id: "cf_response_capacity", category: "response_capacity", severity: computeSev("capacity_density", capacityDensity) },
    { id: "cf_event_context", category: "event_context", severity: computeSev("context_density", contextDensity) },
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
// COMPUTE PRIME DENSITY — standalone for single text analysis
// ================================================================

export function computeTextPrimeDensity(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { primeDensity: 0, propagationDensity: 0, tokens: 0 };

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
