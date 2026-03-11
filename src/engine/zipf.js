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
