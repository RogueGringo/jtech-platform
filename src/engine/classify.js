const WORD_BOUNDARY_SET = new Set([
  "if", "may", "says", "ais", "spr", "duc", "bbl", "eur", "lng", "wti",
]);

function matchesKeyword(lower, keyword) {
  if (WORD_BOUNDARY_SET.has(keyword)) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    return re.test(lower);
  }
  return lower.includes(keyword);
}

export function classifyText(text, { effectKeywords = [], eventKeywords = [], chainTerms = {} } = {}) {
  if (!text) return { classification: "MIXED", score: 0, effectHits: [], eventHits: [], chainMap: [], confidence: 0 };
  const lower = text.toLowerCase();
  const effectHits = effectKeywords.filter(k => matchesKeyword(lower, k));
  const eventHits = eventKeywords.filter(k => matchesKeyword(lower, k));
  const totalHits = effectHits.length + eventHits.length;
  const score = totalHits > 0 ? (effectHits.length - eventHits.length) / totalHits : 0;
  const chainMap = [];
  for (const [chain, terms] of Object.entries(chainTerms)) {
    if (terms.some(t => matchesKeyword(lower, t))) chainMap.push(chain);
  }
  return {
    classification: score > 0.15 ? "EFFECT" : score < -0.15 ? "EVENT" : "MIXED",
    score, effectHits, eventHits, chainMap,
    confidence: totalHits > 0 ? Math.min(100, Math.round((totalHits / 8) * 100)) : 0,
  };
}
