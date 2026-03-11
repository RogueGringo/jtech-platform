import { UNIVERSAL_CATEGORIES, validateDomainMapping, mapToUniversal } from "../src/engine/primes.js";

let passed = 0, failed = 0;
function assert(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); failed++; }
}

// Universal categories exist
assert(UNIVERSAL_CATEGORIES.length === 5, "5 universal categories", `got ${UNIVERSAL_CATEGORIES.length}`);
assert(UNIVERSAL_CATEGORIES.includes("condition"), "Has 'condition'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("flow"), "Has 'flow'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("price"), "Has 'price'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("capacity"), "Has 'capacity'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("context"), "Has 'context'", "missing");

// Valid mapping passes
const validMapping = {
  kernel: "condition",
  physical: "flow",
  price: "price",
  domestic: "capacity",
  geopolitical: "context",
};
const validResult = validateDomainMapping(validMapping);
assert(validResult.valid === true, "Valid mapping passes", `errors: ${validResult.errors}`);

// Invalid mapping caught — unknown universal category
const badMapping = { kernel: "bogus" };
const badResult = validateDomainMapping(badMapping);
assert(badResult.valid === false, "Invalid mapping caught", "should have failed");

// mapToUniversal translates domain categories
const signals = [
  { id: "pni", category: "kernel", severity: "critical" },
  { id: "ais", category: "physical", severity: "high" },
];
const mapped = mapToUniversal(signals, validMapping);
assert(mapped[0].universalCategory === "condition", "kernel -> condition", `got ${mapped[0].universalCategory}`);
assert(mapped[1].universalCategory === "flow", "physical -> flow", `got ${mapped[1].universalCategory}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
