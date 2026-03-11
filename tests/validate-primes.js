import { validateDomainMapping, UNIVERSAL_CATEGORIES } from "../src/engine/primes.js";
import hormuz from "../src/domains/hormuz-iran/config.js";
import gfc from "../src/domains/gfc-2008/config.js";
import covid from "../src/domains/covid-2020/config.js";
import svb from "../src/domains/svb-2023/config.js";

console.log("SEMANTIC PRIME VALIDATION");
console.log("=".repeat(60));
console.log(`Universal categories: ${UNIVERSAL_CATEGORIES.join(", ")}\n`);

const domains = [hormuz, gfc, covid, svb];
let allValid = true;

for (const d of domains) {
  const result = validateDomainMapping(d.primeMapping);
  const primes = [...new Set(Object.values(d.primeMapping))];
  const coverage = primes.length === UNIVERSAL_CATEGORIES.length ? "FULL" : `${primes.length}/5`;
  console.log(`  ${d.id.padEnd(15)} | valid=${result.valid} | coverage=${coverage} | ${primes.join(", ")}`);
  if (!result.valid) {
    console.log(`    ERRORS: ${result.errors.join("; ")}`);
    allValid = false;
  }
}

console.log(`\n${allValid ? "ALL PASS" : "FAILURES DETECTED"}: ${domains.length} domains validated`);
if (!allValid) process.exit(1);
