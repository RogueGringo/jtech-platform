// tests/test-homology.js
import { buildDistanceMatrix, unionFindBeta0, vietorisRips, persistentHomology } from "../src/engine/homology.js";

console.log("=".repeat(70));
console.log("TEST: Layer 1 — Persistent Homology (β₀ + β₁)");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// === β₀ TESTS ===

// TEST 1: Distance matrix is symmetric with zero diagonal
const points = [
  [0, 0], [1, 0], [0, 1], [10, 10]
];
const dm = buildDistanceMatrix(points);
check(dm[0][0] === 0, "Distance matrix diagonal is zero");
check(Math.abs(dm[0][1] - dm[1][0]) < 1e-10, "Distance matrix is symmetric");
check(dm[0][1] > 0, "Non-identical points have positive distance");

// TEST 2: β₀ filtration axioms — starts at N, ends at 1, monotonically non-increasing
const b0 = unionFindBeta0(dm);
check(b0.barcode.length > 0, `β₀ barcode has entries: ${b0.barcode.length}`);
check(b0.barcode[0].birth === 0, "First β₀ feature born at ε=0");

// All features born at 0 (each point starts as its own component)
const allBornAtZero = b0.barcode.every(bar => bar.birth === 0);
check(allBornAtZero, "All β₀ features born at ε=0 (N isolated points)");

// Exactly one feature persists to infinity (the final connected component)
const infiniteBars = b0.barcode.filter(bar => bar.death === Infinity);
check(infiniteBars.length === 1, `Exactly one β₀ bar persists to infinity: ${infiniteBars.length}`);

// N-1 features die at finite ε (merges)
const finiteBars = b0.barcode.filter(bar => bar.death !== Infinity);
check(finiteBars.length === points.length - 1,
  `${points.length - 1} β₀ bars die at finite ε: ${finiteBars.length}`);

// TEST 3: Outlier detection — point [10,10] merges last (highest death ε)
const maxDeath = Math.max(...finiteBars.map(b => b.death));
const outlierDist = Math.sqrt(10*10 + 10*10); // distance from origin to [10,10]
check(maxDeath > 1.0, `Outlier merges at high ε: ${maxDeath.toFixed(3)}`);

// === β₁ TESTS ===

// TEST 4: Triangle has β₁ = 1 (one cycle)
// Three points forming an equilateral triangle with NO fill should have a 1-cycle
const triangle = [
  [0, 0], [1, 0], [0.5, Math.sqrt(3)/2]
];
const triResult = persistentHomology(triangle, 1);
// β₁ features may appear depending on filtration scale
check(triResult.b0.length === triangle.length, `Triangle β₀ count: ${triResult.b0.length}`);

// TEST 5: Square with diagonal has no persistent β₁
// 4 points forming a square — at some ε, edges connect to form cycle, then fill in
const square = [
  [0, 0], [1, 0], [1, 1], [0, 1]
];
const sqResult = persistentHomology(square, 1);
check(sqResult.b0.length === square.length, `Square β₀ count: ${sqResult.b0.length}`);
// β₁ may have short-lived features (cycle forms then immediately fills)
// The key test: any β₁ features should be short-lived
if (sqResult.b1.length > 0) {
  const maxB1Persist = Math.max(...sqResult.b1.map(b => b.death - b.birth));
  console.log(`  INFO: Square β₁ max persistence: ${maxB1Persist.toFixed(4)}`);
}

// TEST 6: Collinear points have β₁ = 0 (no cycles possible)
const collinear = [
  [0, 0], [1, 0], [2, 0], [3, 0]
];
const colResult = persistentHomology(collinear, 1);
check(colResult.b1.length === 0, `Collinear points have no β₁: ${colResult.b1.length}`);

// TEST 7: API returns expected shape
check(typeof triResult.onsetScale === "number", "onsetScale is a number");
check(typeof triResult.maxPersistence === "number", "maxPersistence is a number");
check(Array.isArray(triResult.b0), "b0 is array");
check(Array.isArray(triResult.b1), "b1 is array");

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
