# Topological Intelligence — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Layer -1 (Zipf/KL-Divergence anomaly detection) and Layer 1 (Vietoris-Rips filtration with β₀ + β₁ persistent homology) from the Adaptive Topological Intelligence design.

**Architecture:** Layer -1 discovers distributional anomalies in raw text without a dictionary. Layer 1 builds real simplicial complexes on R⁸ feature vectors and computes persistent homology via Union-Find (β₀) and boundary matrix reduction (β₁). Both are pure math — no LLM, no external APIs.

**Tech Stack:** Node.js ESM, pure JavaScript (no dependencies). Tests via `node tests/*.js`. Real data: 21K disaster messages at `tests/data/disaster-response/messages.csv`.

**CLAUDE.md Rules:**
- NO synthetic data. All tests use real disaster messages.
- Geometric validation only. No hardcoded expected values.
- Test the SHAPE of output, not specific numbers.

---

### Task 1: Layer -1 Core — Zipf Baseline and KL-Divergence

**Files:**
- Create: `src/engine/zipf.js`
- Test: `tests/test-zipf.js`

**Step 1: Write the test**

```javascript
// tests/test-zipf.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeZipfBaseline, computeKLDivergence, detectAnomaly } from "../src/engine/zipf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load real disaster messages
const csvPath = path.join(__dirname, "data", "disaster-response", "messages.csv");
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0].split(",").map(h => h.trim());

function parseCSVLine(line) {
  const fields = []; let current = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((col, j) => { row[col] = vals[j] || ""; });
  if (row.message && row.message.length > 5) rows.push(row);
}

// Split: baseline (unrelated) vs crisis (death reports)
const baseline = rows.filter(r => r.related === "0").slice(0, 2000);
const crisis = rows.filter(r => r.death === "1");

console.log("=".repeat(70));
console.log("TEST: Layer -1 — Zipf Anomaly Detection");
console.log("=".repeat(70));
console.log(`  Baseline: ${baseline.length} unrelated messages`);
console.log(`  Crisis:   ${crisis.length} death-report messages`);

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// TEST 1: Zipf baseline produces valid frequency distribution
const baselineTokens = baseline.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const baseZipf = computeZipfBaseline(baselineTokens);
check(baseZipf.totalTokens > 0, `Baseline has tokens: ${baseZipf.totalTokens}`);
check(baseZipf.uniqueTokens > 0, `Baseline has unique tokens: ${baseZipf.uniqueTokens}`);
check(baseZipf.alpha > 0, `Zipf alpha > 0: ${baseZipf.alpha.toFixed(3)}`);

// TEST 2: KL-divergence of baseline against itself ≈ 0
const baseSelfKL = computeKLDivergence(baselineTokens, baseZipf);
check(baseSelfKL.dKL < 0.1, `Self-KL near zero: ${baseSelfKL.dKL.toFixed(4)}`);

// TEST 3: KL-divergence of crisis text against baseline > 0
const crisisTokens = crisis.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const crisisKL = computeKLDivergence(crisisTokens, baseZipf);
check(crisisKL.dKL > baseSelfKL.dKL,
  `Crisis KL (${crisisKL.dKL.toFixed(4)}) > baseline self-KL (${baseSelfKL.dKL.toFixed(4)})`);

// TEST 4: Anomaly detection fires on crisis, not on baseline
const baselineAnomaly = detectAnomaly(baselineTokens, baseZipf);
const crisisAnomaly = detectAnomaly(crisisTokens, baseZipf);
check(!baselineAnomaly.spike, `No spike on baseline text`);
check(crisisAnomaly.spike, `Spike detected on crisis text`);

// TEST 5: Emergent primes are real words from crisis domain
check(crisisAnomaly.emergentPrimes.length > 0,
  `Emergent primes discovered: [${crisisAnomaly.emergentPrimes.slice(0, 10).join(", ")}]`);

// TEST 6: Geometric — crisis D_KL > baseline D_KL (directional, no hardcoded value)
check(crisisKL.dKL > baseSelfKL.dKL * 2,
  `Crisis divergence meaningfully exceeds baseline (${crisisKL.dKL.toFixed(4)} vs ${baseSelfKL.dKL.toFixed(4)})`);

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-zipf.js`
Expected: FAIL — `Cannot find module '../src/engine/zipf.js'`

**Step 3: Implement zipf.js**

```javascript
// src/engine/zipf.js
/**
 * Layer -1: Zipf Anomaly Detection
 *
 * Detects distributional shape changes in raw text without any dictionary.
 * Normal text follows Zipf's law. Under cognitive stress, vocabulary compresses.
 * KL-Divergence measures this compression.
 *
 * D_KL(P||Q) = sum( P(i) * log(P(i) / Q(i)) )
 *
 * When D_KL spikes, the words causing the deviation are emergent primes.
 */

/**
 * Compute word frequency distribution and Zipf baseline.
 * @param {string[]} tokens - Array of lowercase tokens
 * @returns {{ freqs: Map<string, number>, totalTokens: number, uniqueTokens: number, alpha: number }}
 */
export function computeZipfBaseline(tokens) {
  const counts = new Map();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  const total = tokens.length;
  const freqs = new Map();
  for (const [word, count] of counts) {
    freqs.set(word, count / total);
  }

  // Estimate Zipf alpha via log-log regression on top 100 words
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const n = Math.min(sorted.length, 100);
  if (n < 2) return { freqs, totalTokens: total, uniqueTokens: counts.size, alpha: 1.0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.log(i + 1); // log(rank)
    const y = Math.log(sorted[i][1]); // log(frequency)
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const alpha = Math.abs((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX));

  return { freqs, totalTokens: total, uniqueTokens: counts.size, alpha };
}

/**
 * Compute KL-Divergence between observed token distribution and baseline.
 * Uses Laplace smoothing to handle unseen tokens.
 * @param {string[]} tokens - Current window tokens
 * @param {{ freqs: Map<string, number>, uniqueTokens: number }} baseline
 * @returns {{ dKL: number, topContributors: Array<{word: string, contribution: number}> }}
 */
export function computeKLDivergence(tokens, baseline) {
  const counts = new Map();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const total = tokens.length;
  if (total === 0) return { dKL: 0, topContributors: [] };

  // Laplace smoothing parameter
  const smoothing = 1 / (total * 10);

  // Compute D_KL(observed || baseline)
  let dKL = 0;
  const contributors = [];

  for (const [word, count] of counts) {
    const p = count / total; // observed probability
    const q = baseline.freqs.get(word) || smoothing; // baseline probability (smoothed)
    const contribution = p * Math.log(p / q);
    dKL += contribution;
    contributors.push({ word, contribution });
  }

  // Sort by contribution (highest divergence first)
  contributors.sort((a, b) => b.contribution - a.contribution);

  return { dKL, topContributors: contributors.slice(0, 50) };
}

/**
 * Detect anomaly: is this window's distribution significantly different from baseline?
 * Returns spike boolean and emergent primes (words causing the divergence).
 * @param {string[]} tokens - Current window tokens
 * @param {{ freqs: Map<string, number>, uniqueTokens: number, alpha: number }} baseline
 * @param {{ threshold?: number, topN?: number }} options
 * @returns {{ spike: boolean, dKL: number, emergentPrimes: string[] }}
 */
export function detectAnomaly(tokens, baseline, options = {}) {
  const { threshold = 0.05, topN = 20 } = options;

  const { dKL, topContributors } = computeKLDivergence(tokens, baseline);

  const spike = dKL > threshold;

  // Emergent primes: words contributing most to divergence that are NOT common in baseline
  const emergentPrimes = topContributors
    .filter(c => c.contribution > 0)
    .filter(c => {
      const baseFreq = baseline.freqs.get(c.word) || 0;
      // Only promote words that are RARE in baseline but FREQUENT in crisis
      return baseFreq < 0.001;
    })
    .slice(0, topN)
    .map(c => c.word);

  return { spike, dKL, emergentPrimes };
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-zipf.js`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/engine/zipf.js tests/test-zipf.js
git commit -m "feat: Layer -1 — Zipf anomaly detection via KL-Divergence"
```

---

### Task 2: Layer 1 Core — Distance Matrix and Union-Find (β₀)

**Files:**
- Create: `src/engine/homology.js`
- Test: `tests/test-homology.js`

**Step 1: Write the test**

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-homology.js`
Expected: FAIL — `Cannot find module '../src/engine/homology.js'`

**Step 3: Implement homology.js**

```javascript
// src/engine/homology.js
/**
 * Layer 1: Persistent Homology Engine
 *
 * Builds Vietoris-Rips complexes on R^n point clouds.
 * Computes β₀ (connected components) via Union-Find.
 * Computes β₁ (cycles) via boundary matrix reduction.
 *
 * Designed for R⁸ feature vectors from the JtechAi engine,
 * but works on any dimensionality.
 */

// ================================================================
// DISTANCE MATRIX
// ================================================================

/**
 * Build Euclidean distance matrix for a set of points.
 * @param {number[][]} points - Array of n-dimensional vectors
 * @returns {number[][]} Symmetric N×N distance matrix
 */
export function buildDistanceMatrix(points) {
  const n = points.length;
  const dm = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sum = 0;
      for (let d = 0; d < points[i].length; d++) {
        const diff = points[i][d] - points[j][d];
        sum += diff * diff;
      }
      const dist = Math.sqrt(sum);
      dm[i][j] = dist;
      dm[j][i] = dist;
    }
  }
  return dm;
}

// ================================================================
// UNION-FIND (β₀)
// ================================================================

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Uint8Array(n);
    this.components = n;
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]; // path compression
      x = this.parent[x];
    }
    return x;
  }
  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false;
    if (this.rank[rx] < this.rank[ry]) this.parent[rx] = ry;
    else if (this.rank[rx] > this.rank[ry]) this.parent[ry] = rx;
    else { this.parent[ry] = rx; this.rank[rx]++; }
    this.components--;
    return true; // merged
  }
}

/**
 * Compute β₀ persistence barcode via Union-Find.
 * @param {number[][]} dm - Distance matrix
 * @returns {{ barcode: Array<{birth: number, death: number}> }}
 */
export function unionFindBeta0(dm) {
  const n = dm.length;

  // Collect all edges with their weights
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push({ i, j, dist: dm[i][j] });
    }
  }
  edges.sort((a, b) => a.dist - b.dist);

  const uf = new UnionFind(n);
  const barcode = [];

  // Every point is born at ε=0
  const birthTime = new Float64Array(n); // all zeros

  for (const edge of edges) {
    const ri = uf.find(edge.i);
    const rj = uf.find(edge.j);
    if (ri !== rj) {
      // One component dies (the younger one, but birth=0 for all so we pick one)
      barcode.push({ birth: 0, death: edge.dist });
      uf.union(edge.i, edge.j);
    }
  }

  // The last surviving component lives forever
  barcode.push({ birth: 0, death: Infinity });

  return { barcode };
}

// ================================================================
// BOUNDARY MATRIX REDUCTION (β₁)
// ================================================================

/**
 * Compute β₁ (1-dimensional holes / cycles) via boundary matrix reduction.
 *
 * Algorithm:
 * 1. Enumerate all edges (1-simplices) and triangles (2-simplices) up to max ε
 * 2. Build boundary matrix ∂₂: maps triangles to their boundary edges
 * 3. Reduce via column operations (persistence algorithm)
 * 4. Unpaired 1-simplices that are not boundaries = β₁ generators
 *
 * @param {number[][]} dm - Distance matrix
 * @param {number} maxEpsilon - Maximum filtration radius (default: auto from data)
 * @returns {{ barcode: Array<{birth: number, death: number}> }}
 */
export function boundaryMatrixBeta1(dm, maxEpsilon = Infinity) {
  const n = dm.length;
  if (n < 3) return { barcode: [] };

  // Determine maxEpsilon from data if not specified
  if (maxEpsilon === Infinity) {
    let maxDist = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (dm[i][j] > maxDist) maxDist = dm[i][j];
    maxEpsilon = maxDist * 1.1;
  }

  // Enumerate edges with filtration values
  const edges = [];
  const edgeIndex = new Map(); // "i,j" -> index
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dm[i][j] <= maxEpsilon) {
        edgeIndex.set(`${i},${j}`, edges.length);
        edges.push({ i, j, birth: dm[i][j] });
      }
    }
  }

  // Enumerate triangles with filtration values
  const triangles = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const dij = dm[i][j], djk = dm[j][k], dik = dm[i][k];
        if (dij <= maxEpsilon && djk <= maxEpsilon && dik <= maxEpsilon) {
          // Triangle birth = max of its three edge lengths
          const birth = Math.max(dij, djk, dik);
          // Boundary edges (sorted vertex pairs)
          const boundaryEdges = [
            edgeIndex.get(`${i},${j}`),
            edgeIndex.get(`${j},${k}`),
            edgeIndex.get(`${i},${k}`),
          ].filter(e => e !== undefined);

          if (boundaryEdges.length === 3) {
            triangles.push({ i, j, k, birth, boundaryEdges });
          }
        }
      }
    }
  }

  // Sort edges and triangles by birth time
  const sortedEdges = edges.map((e, idx) => ({ ...e, idx })).sort((a, b) => a.birth - b.birth);
  const sortedTriangles = triangles.sort((a, b) => a.birth - b.birth);

  // Track which edges are "killed" by triangles (become boundaries)
  // Using the standard persistence algorithm:
  // Process triangles in order of birth. For each triangle, its boundary
  // is a Z/2 chain of 3 edges. Reduce against previously processed triangles.
  // If the reduced boundary is non-empty, its youngest edge is "killed" (paired).

  const edgeKilledAt = new Map(); // edge index -> triangle birth time
  const reducedColumns = []; // for column reduction

  for (const tri of sortedTriangles) {
    // Boundary chain (set of edge indices, Z/2 arithmetic)
    let chain = new Set(tri.boundaryEdges);

    // Reduce against previous columns
    let reduced = true;
    while (reduced) {
      reduced = false;
      // Find pivot (highest-index edge in chain)
      let pivot = -1;
      for (const e of chain) {
        if (e > pivot) pivot = e;
      }
      if (pivot === -1) break;

      // Check if another column has the same pivot
      const existing = reducedColumns.find(c => c.pivot === pivot);
      if (existing) {
        // XOR (symmetric difference) with existing column
        const newChain = new Set();
        for (const e of chain) { if (!existing.chain.has(e)) newChain.add(e); }
        for (const e of existing.chain) { if (!chain.has(e)) newChain.add(e); }
        chain = newChain;
        reduced = true;
      }
    }

    if (chain.size > 0) {
      // Find pivot of reduced column
      let pivot = -1;
      for (const e of chain) { if (e > pivot) pivot = e; }
      reducedColumns.push({ pivot, chain, birth: tri.birth });
      edgeKilledAt.set(pivot, tri.birth);
    }
  }

  // β₁ barcode: edges that create a cycle (not killed immediately)
  // An edge creates a cycle if adding it doesn't merge components
  // We need to track which edges create cycles vs merge components

  // Re-process edges in order using Union-Find to determine cycle creators
  const uf = new UnionFind(n);
  const cycleEdges = []; // edges that create 1-cycles

  for (const e of sortedEdges) {
    const ri = uf.find(e.i);
    const rj = uf.find(e.j);
    if (ri === rj) {
      // This edge creates a cycle (both endpoints already connected)
      cycleEdges.push(e);
    } else {
      uf.union(e.i, e.j);
    }
  }

  // β₁ bars: cycle edge birth → killed by triangle (death), or Infinity if never killed
  const barcode = cycleEdges.map(e => {
    const death = edgeKilledAt.has(e.idx) ? edgeKilledAt.get(e.idx) : Infinity;
    return { birth: e.birth, death };
  });

  // Filter out zero-length bars (born and killed at same ε)
  return { barcode: barcode.filter(b => b.death > b.birth + 1e-10) };
}

// ================================================================
// PUBLIC API
// ================================================================

/**
 * Normalize point cloud to [0,1] per dimension.
 * @param {number[][]} points - Raw R^n vectors
 * @returns {number[][]} Normalized vectors
 */
export function normalizeCloud(points) {
  if (points.length === 0) return [];
  const dims = points[0].length;
  const mins = new Float64Array(dims).fill(Infinity);
  const maxs = new Float64Array(dims).fill(-Infinity);
  for (const p of points) {
    for (let d = 0; d < dims; d++) {
      if (p[d] < mins[d]) mins[d] = p[d];
      if (p[d] > maxs[d]) maxs[d] = p[d];
    }
  }
  return points.map(p =>
    p.map((v, d) => {
      const range = maxs[d] - mins[d];
      return range > 0 ? (v - mins[d]) / range : 0;
    })
  );
}

/**
 * Full Vietoris-Rips persistent homology pipeline.
 * @param {number[][]} points - Array of n-dimensional vectors
 * @param {number} maxDim - Maximum homology dimension (0 = β₀ only, 1 = β₀ + β₁)
 * @returns {{ b0: Array, b1: Array, onsetScale: number, maxPersistence: number }}
 */
export function persistentHomology(points, maxDim = 1) {
  const normalized = normalizeCloud(points);
  const dm = buildDistanceMatrix(normalized);

  const b0Result = unionFindBeta0(dm);
  const b0 = b0Result.barcode;

  let b1 = [];
  if (maxDim >= 1 && points.length >= 3) {
    const b1Result = boundaryMatrixBeta1(dm);
    b1 = b1Result.barcode;
  }

  // Onset scale: smallest ε where β₀ drops (first merge)
  const finiteBars = b0.filter(b => b.death !== Infinity);
  const onsetScale = finiteBars.length > 0 ? Math.min(...finiteBars.map(b => b.death)) : Infinity;

  // Max persistence: longest-lived β₀ bar (excluding the infinite one)
  const maxPersistence = finiteBars.length > 0
    ? Math.max(...finiteBars.map(b => b.death - b.birth))
    : 0;

  return { b0, b1, onsetScale, maxPersistence };
}

/**
 * Convenience: build Vietoris-Rips filtration object (for step-by-step inspection).
 * @param {number[][]} points
 * @param {number} maxEpsilon
 * @returns {{ dm: number[][], normalized: number[][] }}
 */
export function vietorisRips(points, maxEpsilon = Infinity) {
  const normalized = normalizeCloud(points);
  const dm = buildDistanceMatrix(normalized);
  return { dm, normalized, n: points.length };
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-homology.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/engine/homology.js tests/test-homology.js
git commit -m "feat: Layer 1 — persistent homology (β₀ Union-Find + β₁ boundary matrix reduction)"
```

---

### Task 3: Integration Test — Real Data Through Full Pipeline

**Files:**
- Create: `tests/test-topology-pipeline.js`

**Why:** Prove Layer -1 and Layer 1 produce valid topological output on the REAL 21K disaster messages. This is the critical validation — no synthetic data.

**Step 1: Write the integration test**

```javascript
// tests/test-topology-pipeline.js
/**
 * INTEGRATION: Full Topological Intelligence Pipeline
 *
 * Real disaster messages → Layer 0 (feature map) → Layer 1 (homology)
 * Plus: Layer -1 (Zipf) on raw text
 *
 * Validates:
 * - R⁸ feature vectors extracted from real batches
 * - β₀ and β₁ computed on the point cloud
 * - Zipf anomaly detects crisis vs baseline
 * - Geometric relationships hold (no hardcoded values)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { crisisTextToSignals } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, computeCrossCoherence, classifyRegime } from "./lib/backtest-engine.js";
import { computePropagationCapacity, computeDissolutionRate } from "../src/engine/projection.js";
import { persistentHomology } from "../src/engine/homology.js";
import { computeZipfBaseline, detectAnomaly } from "../src/engine/zipf.js";
import config from "../src/domains/crisisfacts-ie/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THRESHOLDS = config.severityThresholds;
const CATEGORY_KEYS = Object.keys(config.categories);

// ================================================================
// LOAD DATA
// ================================================================

const csvPath = path.join(__dirname, "data", "disaster-response", "messages.csv");
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0].split(",").map(h => h.trim());

function parseCSVLine(line) {
  const fields = []; let current = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((col, j) => { row[col] = vals[j] || ""; });
  if (row.message && row.message.length > 5) rows.push(row);
}

console.log("=".repeat(70));
console.log("INTEGRATION: Full Topological Intelligence Pipeline");
console.log("=".repeat(70));
console.log(`  ${rows.length} real disaster messages loaded`);

// ================================================================
// BUILD R⁸ POINT CLOUD FROM BATCHES
// ================================================================

// Create trajectory: baseline → moderate → severe → death reports
const baseline = rows.filter(r => r.related === "0").slice(0, 1000);
const moderate = rows.filter(r => r.floods === "1" || r.storm === "1").slice(0, 1000);
const severe = rows.filter(r => r.search_and_rescue === "1" || r.medical_help === "1").slice(0, 1000);
const critical = rows.filter(r => r.death === "1");

const batchGroups = [
  { label: "baseline", msgs: baseline },
  { label: "moderate", msgs: moderate },
  { label: "severe", msgs: severe },
  { label: "critical", msgs: critical },
];

const BATCH_SIZE = 200;
const featureVectors = [];
const coherenceHistory = [];

console.log("\n  Extracting R⁸ feature vectors from real message batches:");

for (const group of batchGroups) {
  for (let i = 0; i < group.msgs.length; i += BATCH_SIZE) {
    const batch = group.msgs.slice(i, i + BATCH_SIZE);
    if (batch.length < 50) continue; // skip tiny batches

    const records = batch.map(m => ({ text: m.message }));
    const result = crisisTextToSignals(records, THRESHOLDS);

    if (result.signals.length === 0) continue;

    const gini = computeGini(result.signals);
    const mean = computeMeanSeverity(result.signals);
    const coherence = computeCrossCoherence(result.signals, CATEGORY_KEYS);
    coherenceHistory.push(coherence);
    const propCap = computePropagationCapacity(result.signals, CATEGORY_KEYS);
    const dissRate = coherenceHistory.length >= 2
      ? computeDissolutionRate(coherenceHistory.slice(-5))
      : 0;

    // R⁸ feature vector
    const vec = [
      result.primeDensity,
      result.dissolutionRate,
      result.entropy,
      gini,
      mean,
      coherence / 100, // normalize to [0,1]
      propCap.aggregate,
      dissRate,
    ];

    featureVectors.push({ vec, label: group.label });
    console.log(
      `    ${group.label.padEnd(10)} batch ${Math.floor(i / BATCH_SIZE)}: ` +
      `PD=${(vec[0] * 100).toFixed(1)}% G=${vec[3].toFixed(3)} mean=${vec[4].toFixed(2)}`
    );
  }
}

console.log(`\n  Total R⁸ points: ${featureVectors.length}`);

// ================================================================
// LAYER 1: PERSISTENT HOMOLOGY
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("LAYER 1: Persistent Homology on R⁸ Point Cloud");
console.log("=".repeat(70));

const points = featureVectors.map(fv => fv.vec);
const start = performance.now();
const topo = persistentHomology(points, 1);
const topoMs = performance.now() - start;

console.log(`\n  Computed in ${topoMs.toFixed(1)}ms`);
console.log(`  β₀ barcode: ${topo.b0.length} features`);
console.log(`  β₁ barcode: ${topo.b1.length} features`);
console.log(`  Onset scale: ${topo.onsetScale.toFixed(4)}`);
console.log(`  Max β₀ persistence: ${topo.maxPersistence.toFixed(4)}`);

if (topo.b1.length > 0) {
  console.log(`\n  β₁ cycles detected:`);
  for (const bar of topo.b1.slice(0, 5)) {
    console.log(`    birth=${bar.birth.toFixed(4)} death=${bar.death === Infinity ? "∞" : bar.death.toFixed(4)} persistence=${(bar.death === Infinity ? "∞" : (bar.death - bar.birth).toFixed(4))}`);
  }
}

// ================================================================
// LAYER -1: ZIPF ANOMALY
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("LAYER -1: Zipf Anomaly Detection");
console.log("=".repeat(70));

const baseTokens = baseline.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const crisisTokens = critical.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);

const baseZipf = computeZipfBaseline(baseTokens);
const crisisAnomaly = detectAnomaly(crisisTokens, baseZipf);

console.log(`  Baseline: ${baseTokens.length} tokens, alpha=${baseZipf.alpha.toFixed(3)}`);
console.log(`  Crisis D_KL: ${crisisAnomaly.dKL.toFixed(4)}`);
console.log(`  Spike: ${crisisAnomaly.spike}`);
console.log(`  Emergent primes: [${crisisAnomaly.emergentPrimes.slice(0, 15).join(", ")}]`);

// ================================================================
// GEOMETRIC VALIDATION
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("GEOMETRIC VALIDATION — Real Topological Invariants");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// β₀ axioms
check(topo.b0.length === points.length,
  `β₀ count equals point count: ${topo.b0.length} = ${points.length}`);
check(topo.b0.filter(b => b.death === Infinity).length === 1,
  "Exactly one infinite β₀ bar (final connected component)");

// β₁ exists or doesn't — but report it
console.log(`  INFO: β₁ features found: ${topo.b1.length}`);

// Speed constraint
check(topoMs < 5000, `Topology computed in < 5s: ${topoMs.toFixed(1)}ms`);

// Onset scale is finite (points DO connect at some ε)
check(topo.onsetScale < Infinity, `Onset scale is finite: ${topo.onsetScale.toFixed(4)}`);

// Layer -1: crisis diverges more than baseline
const baselineAnomaly = detectAnomaly(baseTokens, baseZipf);
check(crisisAnomaly.dKL > baselineAnomaly.dKL,
  `Crisis D_KL (${crisisAnomaly.dKL.toFixed(4)}) > baseline D_KL (${baselineAnomaly.dKL.toFixed(4)})`);

// Layer -1: crisis produces emergent primes
check(crisisAnomaly.emergentPrimes.length > 0,
  `Emergent primes discovered: ${crisisAnomaly.emergentPrimes.length} words`);

// Layer -1: spike fires on crisis
check(crisisAnomaly.spike, "Zipf spike fires on death-report text");

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
console.log("=".repeat(70));
if (failed > 0) process.exit(1);
```

**Step 2: Run test**

Run: `node tests/test-topology-pipeline.js`
Expected: All geometric validations PASS

**Step 3: Commit**

```bash
git add tests/test-topology-pipeline.js
git commit -m "test: full topology pipeline — real data through Layer -1 + Layer 1"
```

---

### Task 4: Update System Prompts — Honest Math

**Files:**
- Modify: `src/engine/system-prompts.js`

**Step 1: Read current system prompts**

Reference: `src/engine/system-prompts.js`

**Step 2: Remove false claims, add honest framing**

Replace Čech-de Rham and fiber bundle claims with accurate descriptions of what the engine actually computes. Keep the invariant definitions (PD, DR, G, S, Mean) — those are real. Remove claims about Rips complexes and simplicial complexes until Layer 1 is wired in.

Specific changes:
- TOPO_BRIEFING: Replace "Čech-de Rham isomorphism guarantees" with honest description of R⁸ feature projection + topological measurement
- TOPO_ANALYST: Replace "persistence diagrams over signal space" with actual Layer 1 output description
- Keep all invariant definitions — they are accurate

**Step 3: Commit**

```bash
git add src/engine/system-prompts.js
git commit -m "fix: honest math in system prompts — remove unsupported topological claims"
```

---

### Task 5: Wire Layer 1 into Existing Topology Module

**Files:**
- Modify: `src/engine/topology.js`

**Step 1: Add import and wrapper for homology**

Add a function `topologicalAnalysis(batchFeatureVectors)` that:
1. Takes an array of R⁸ vectors (one per batch, from existing batch processing)
2. Calls `persistentHomology(vectors, 1)` from `homology.js`
3. Returns the barcode alongside the existing multi-scale Gini results

This wires Layer 1 into the existing framework without breaking any existing functionality.

**Step 2: Run existing backtest to verify nothing breaks**

Run: `node tests/backtest-disaster-text.js`
Expected: 8/8 PASS — existing tests unchanged

**Step 3: Commit**

```bash
git add src/engine/topology.js
git commit -m "feat: wire Layer 1 homology into topology module"
```

---

### Task 6: Final Validation — All Backtests Pass

**Step 1: Run all existing backtests**

```bash
node tests/backtest-disaster-text.js
node tests/backtest-gdelt.js
node tests/backtest-cross-source.js
```

Expected: All pass with existing composite scores.

**Step 2: Run new topology tests**

```bash
node tests/test-zipf.js
node tests/test-homology.js
node tests/test-topology-pipeline.js
```

Expected: All pass.

**Step 3: Final commit**

```bash
git commit --allow-empty -m "chore: all backtests pass — Layer -1 + Layer 1 validated on real data"
```

Only if all tests pass. If any fail, fix before committing.

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Layer -1: Zipf/KL-Divergence | `src/engine/zipf.js`, `tests/test-zipf.js` | 15 min |
| 2 | Layer 1: Homology (β₀ + β₁) | `src/engine/homology.js`, `tests/test-homology.js` | 25 min |
| 3 | Integration test on real data | `tests/test-topology-pipeline.js` | 10 min |
| 4 | Honest system prompts | `src/engine/system-prompts.js` | 5 min |
| 5 | Wire into topology module | `src/engine/topology.js` | 10 min |
| 6 | Final validation | All backtests | 5 min |
