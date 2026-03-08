// The 5 universal categories derived from semantic primes.
// Every domain maps its specific categories to these.
//   CONDITION — state of core system (ACTORS + STATE)
//   FLOW      — movement of primary resource (ACTION + INSTRUMENTS)
//   PRICE     — market valuation signals (MAGNITUDE + INSTRUMENTS)
//   CAPACITY  — available reserves/ability (MAGNITUDE + STATE)
//   CONTEXT   — external environment (CAUSE + ACTORS)
export const UNIVERSAL_CATEGORIES = [
  "condition", "flow", "price", "capacity", "context",
];

// Validate that a domain's category mapping covers universal categories
export function validateDomainMapping(mapping) {
  const errors = [];
  for (const [domainCat, universalCat] of Object.entries(mapping)) {
    if (!UNIVERSAL_CATEGORIES.includes(universalCat)) {
      errors.push(`"${domainCat}" maps to unknown universal category "${universalCat}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Annotate signals with their universal category
export function mapToUniversal(signals, mapping) {
  return signals.map(s => ({
    ...s,
    universalCategory: mapping[s.category] || s.category,
  }));
}
