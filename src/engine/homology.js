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

  // Enumerate edges with filtration values, then sort by birth (filtration order)
  const rawEdges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dm[i][j] <= maxEpsilon) {
        rawEdges.push({ i, j, birth: dm[i][j], key: `${i},${j}` });
      }
    }
  }
  // Sort edges by birth time, break ties by vertex indices for determinism
  rawEdges.sort((a, b) => a.birth - b.birth || a.i - b.i || a.j - b.j);

  // Assign filtration-ordered indices
  const edgeFiltIndex = new Map(); // "i,j" -> filtration index
  const edges = rawEdges.map((e, filtIdx) => {
    edgeFiltIndex.set(e.key, filtIdx);
    return { ...e, filtIdx };
  });

  // Enumerate triangles with filtration values
  const triangles = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const dij = dm[i][j], djk = dm[j][k], dik = dm[i][k];
        if (dij <= maxEpsilon && djk <= maxEpsilon && dik <= maxEpsilon) {
          // Triangle birth = max of its three edge lengths
          const birth = Math.max(dij, djk, dik);
          // Boundary edges using filtration-ordered indices
          const be0 = edgeFiltIndex.get(`${i},${j}`);
          const be1 = edgeFiltIndex.get(`${j},${k}`);
          const be2 = edgeFiltIndex.get(`${i},${k}`);

          if (be0 !== undefined && be1 !== undefined && be2 !== undefined) {
            triangles.push({ i, j, k, birth, boundaryEdges: [be0, be1, be2] });
          }
        }
      }
    }
  }

  // Sort triangles by birth time
  triangles.sort((a, b) => a.birth - b.birth);

  // Standard persistence algorithm: column reduction over Z/2
  // Process triangles in filtration order. For each triangle, reduce its
  // boundary chain against previously reduced columns. The pivot (highest
  // filtration-index edge) of a non-zero reduced column pairs with that edge.
  // Pivot edge = cycle creator that gets killed by this triangle.

  const pivotToCol = new Map(); // pivot filtration index -> column info
  const edgeKilledAt = new Map(); // edge filtration index -> triangle birth time

  for (const tri of triangles) {
    // Boundary chain as set of filtration indices (Z/2 arithmetic)
    let chain = new Set(tri.boundaryEdges);

    // Reduce against previous columns
    let changing = true;
    while (changing) {
      changing = false;
      // Find pivot (highest filtration-index edge in chain)
      let pivot = -1;
      for (const e of chain) {
        if (e > pivot) pivot = e;
      }
      if (pivot === -1) break;

      // Check if another column has the same pivot
      if (pivotToCol.has(pivot)) {
        const existing = pivotToCol.get(pivot);
        // XOR (symmetric difference) with existing column
        const newChain = new Set();
        for (const e of chain) { if (!existing.has(e)) newChain.add(e); }
        for (const e of existing) { if (!chain.has(e)) newChain.add(e); }
        chain = newChain;
        changing = true;
      }
    }

    if (chain.size > 0) {
      // Find pivot of reduced column
      let pivot = -1;
      for (const e of chain) { if (e > pivot) pivot = e; }
      pivotToCol.set(pivot, chain);
      edgeKilledAt.set(pivot, tri.birth);
    }
  }

  // Determine which edges are cycle creators using Union-Find
  const uf = new UnionFind(n);
  const cycleEdges = [];

  for (const e of edges) {
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
    const death = edgeKilledAt.has(e.filtIdx) ? edgeKilledAt.get(e.filtIdx) : Infinity;
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
