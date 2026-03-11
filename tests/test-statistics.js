// tests/test-statistics.js — V&V Statistical Audit Task 1
// Unit tests for inferential statistics library
import {
  bootstrapCI,
  permutationTest,
  binomialTest,
  pearsonCI,
  fisherZTest,
  powerAnalysis,
  lag1Autocorrelation,
} from "./lib/statistics.js";

console.log("=".repeat(70));
console.log("TEST: Inferential Statistics Library — V&V Audit");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
// 1. bootstrapCI
// ================================================================
console.log("\n--- bootstrapCI ---");

// Generate N(100, 10) data — 200 points, seeded deterministically
const normalData = [];
for (let i = 0; i < 200; i++) {
  // Box-Muller using a simple deterministic sequence
  // Use known values centered at 100 with spread ~10
  normalData.push(100 + 10 * Math.sin(i * 0.317) + 5 * Math.cos(i * 0.731));
}
const trueMean = mean(normalData);

const ci999 = bootstrapCI(normalData, mean, 0.001, 10000);
check(ci999.lo <= trueMean && trueMean <= ci999.hi,
  `99.9% CI [${ci999.lo.toFixed(3)}, ${ci999.hi.toFixed(3)}] contains sample mean ${trueMean.toFixed(3)}`);

const ci95 = bootstrapCI(normalData, mean, 0.05, 10000);
check(ci95.lo <= trueMean && trueMean <= ci95.hi,
  `95% CI [${ci95.lo.toFixed(3)}, ${ci95.hi.toFixed(3)}] contains sample mean`);

const width999 = ci999.hi - ci999.lo;
const width95 = ci95.hi - ci95.lo;
check(width999 > width95,
  `99.9% CI width (${width999.toFixed(3)}) > 95% CI width (${width95.toFixed(3)})`);

// ================================================================
// 2. permutationTest
// ================================================================
console.log("\n--- permutationTest ---");

// Correlated data: y = 2x + noise
const xs = [];
const ysCorr = [];
const ysRand = [];
for (let i = 0; i < 50; i++) {
  xs.push(i);
  ysCorr.push(2 * i + Math.sin(i * 1.23) * 3);
  ysRand.push(Math.sin(i * 7.91) * 50);
}

function pearsonR(a, b) {
  const n = a.length;
  const muA = mean(a), muB = mean(b);
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - muA) * (b[i] - muB);
    dA += (a[i] - muA) ** 2;
    dB += (b[i] - muB) ** 2;
  }
  return dA > 0 && dB > 0 ? num / (Math.sqrt(dA) * Math.sqrt(dB)) : 0;
}

const permCorr = permutationTest(xs, ysCorr, pearsonR, 5000);
const permRand = permutationTest(xs, ysRand, pearsonR, 5000);

check(permCorr.p < 0.01,
  `Correlated data p=${permCorr.p.toFixed(4)} < 0.01`);
check(permRand.p > permCorr.p,
  `Uncorrelated p=${permRand.p.toFixed(4)} > correlated p=${permCorr.p.toFixed(4)}`);

// ================================================================
// 3. binomialTest
// ================================================================
console.log("\n--- binomialTest ---");

// 100/100 successes should be extremely significant
const p100 = binomialTest(100, 100, 0.5);
check(p100 < 1e-10,
  `100/100 p=${p100.toExponential(3)} < 1e-10`);

// 50/100 should not be significant (null is p=0.5)
const p50 = binomialTest(50, 100, 0.5);
check(p50 >= 1.0,
  `50/100 p=${p50.toFixed(4)} >= 1.0 (at or below null expectation)`);

// Ordering: 90/100 more significant than 70/100
const p90 = binomialTest(90, 100, 0.5);
const p70 = binomialTest(70, 100, 0.5);
check(p90 < p70,
  `90/100 p=${p90.toExponential(3)} < 70/100 p=${p70.toExponential(3)}`);

// Edge: trials=0 returns 1.0
const pZero = binomialTest(0, 0, 0.5);
check(pZero === 1.0,
  `0/0 trials returns 1.0`);

// Edge: successes > trials returns 0.0
const pOver = binomialTest(5, 3, 0.5);
check(pOver === 0.0,
  `successes > trials returns 0.0`);

// ================================================================
// 4. pearsonCI
// ================================================================
console.log("\n--- pearsonCI ---");

const rObs = pearsonR(xs, ysCorr);
const ciR999 = pearsonCI(rObs, xs.length, 0.001);
check(ciR999.lo <= rObs && rObs <= ciR999.hi,
  `99.9% CI [${ciR999.lo.toFixed(4)}, ${ciR999.hi.toFixed(4)}] contains r=${rObs.toFixed(4)}`);

// Stricter alpha => wider CI
const ciR95 = pearsonCI(rObs, xs.length, 0.05);
const widthR999 = ciR999.hi - ciR999.lo;
const widthR95 = ciR95.hi - ciR95.lo;
check(widthR999 > widthR95,
  `99.9% pearsonCI width (${widthR999.toFixed(4)}) > 95% width (${widthR95.toFixed(4)})`);

// r=0 CI should include 0
const ciR0 = pearsonCI(0, 50, 0.05);
check(ciR0.lo < 0 && ciR0.hi > 0,
  `r=0 CI [${ciR0.lo.toFixed(4)}, ${ciR0.hi.toFixed(4)}] includes zero`);

// ================================================================
// 5. fisherZTest
// ================================================================
console.log("\n--- fisherZTest ---");

// Opposite correlations should be significant
const oppResult = fisherZTest(0.9, 50, -0.9, 50);
check(oppResult.p < 0.001,
  `r=0.9 vs r=-0.9 p=${oppResult.p.toExponential(3)} < 0.001`);

// Similar correlations should not be significant
const simResult = fisherZTest(0.85, 50, 0.88, 50);
check(simResult.p > 0.05,
  `r=0.85 vs r=0.88 p=${simResult.p.toFixed(4)} > 0.05`);

// Test clamping: r=1.0 and r=-1.0 should not blow up
const clampResult = fisherZTest(1.0, 50, -1.0, 50);
check(Number.isFinite(clampResult.z) && Number.isFinite(clampResult.p),
  `Clamping prevents NaN: z=${clampResult.z.toFixed(3)}, p=${clampResult.p.toExponential(3)}`);

// ================================================================
// 6. powerAnalysis
// ================================================================
console.log("\n--- powerAnalysis ---");

// Large dataset with tight target => sufficient
const largePower = powerAnalysis(normalData, mean, 10.0, 0.001, 5000);
check(largePower.sufficient === true,
  `n=200 sufficient for width=10: actual width=${largePower.width.toFixed(3)}`);

// Tiny dataset with tight target => insufficient, recommends more
const tinyData = normalData.slice(0, 5);
const tinyPower = powerAnalysis(tinyData, mean, 0.5, 0.001, 5000);
check(tinyPower.sufficient === false,
  `n=5 insufficient for width=0.5: actual width=${tinyPower.width.toFixed(3)}`);
check(tinyPower.recommendedN !== null && tinyPower.recommendedN > tinyData.length,
  `Recommends N=${tinyPower.recommendedN} > current n=${tinyData.length}`);

// ================================================================
// 7. lag1Autocorrelation
// ================================================================
console.log("\n--- lag1Autocorrelation ---");

// Perfect autocorrelation: [1,2,3,4,5] — next value always increases
const increasing = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const acInc = lag1Autocorrelation(increasing);
check(acInc > 0.95, `Monotonic increasing: ρ₁=${acInc.toFixed(4)} > 0.95`);

// High autocorrelation: smooth sine wave (adjacent values are similar)
const sine = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.1));
const acSine = lag1Autocorrelation(sine);
check(acSine > 0.9, `Sine wave: ρ₁=${acSine.toFixed(4)} > 0.9`);

// Low autocorrelation: alternating series (each value negates previous)
const alternating = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 1 : -1));
const acAlt = lag1Autocorrelation(alternating);
check(acAlt < -0.9, `Alternating ±1: ρ₁=${acAlt.toFixed(4)} < -0.9`);

// Near-zero autocorrelation: pseudo-random (LCG)
let seed = 42;
const pseudoRandom = Array.from({ length: 200 }, () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
});
const acRandom = lag1Autocorrelation(pseudoRandom);
check(Math.abs(acRandom) < 0.15, `Pseudo-random: |ρ₁|=${Math.abs(acRandom).toFixed(4)} < 0.15`);

// Edge case: too short
const acShort = lag1Autocorrelation([1, 2]);
check(acShort === 0, `Length 2: ρ₁=${acShort} === 0`);

// ================================================================
// SUMMARY
// ================================================================
console.log(`\n${"=".repeat(70)}`);
console.log(`RESULT: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log("SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED");
}
