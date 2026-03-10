/**
 * Inferential Statistics Library — V&V Statistical Audit Task 1
 * Pure functions: bootstrap CI, permutation test, binomial test,
 * Fisher z-transform CI/test, power analysis.
 * No dependencies beyond Math.
 */

// ================================================================
// INTERNAL HELPERS (not exported)
// ================================================================

/**
 * Normal CDF — Abramowitz & Stegun approximation (7.1.26)
 * Max error ~1.5e-7
 */
function normalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Normal quantile — Beasley-Springer-Moro rational approximation
 * Accurate to ~1e-9 for p in (0, 1)
 */
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e+01,  2.209460984245205e+02,
    -2.759285104469687e+02,  1.383577518672690e+02,
    -3.066479806614716e+01,  2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02,
    -1.556989798598866e+02,  6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
     4.374664141464968e+00,  2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700398e-01,
     2.445134137142996e+00,  3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    // Rational approximation for lower region
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    // Rational approximation for central region
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Rational approximation for upper region
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

// ================================================================
// EXPORTED FUNCTIONS
// ================================================================

/**
 * Percentile bootstrap confidence interval.
 * Resamples data B times, computes statFn on each resample,
 * returns [lower, upper] at the (1-α) confidence level.
 *
 * @param {number[]} data - observed data
 * @param {function} statFn - statistic to compute on each resample (array -> number)
 * @param {number} α - significance level (default 0.001 for 99.9% CI)
 * @param {number} B - number of bootstrap replicates (default 10000)
 * @returns {{ lo: number, hi: number, boots: number[] }}
 */
export function bootstrapCI(data, statFn, α = 0.001, B = 10000) {
  const n = data.length;
  const boots = new Array(B);

  for (let b = 0; b < B; b++) {
    const resample = new Array(n);
    for (let i = 0; i < n; i++) {
      resample[i] = data[Math.floor(Math.random() * n)];
    }
    boots[b] = statFn(resample);
  }

  boots.sort((a, b) => a - b);

  const loIdx = Math.floor((α / 2) * B);
  const hiIdx = Math.floor((1 - α / 2) * B) - 1;

  return {
    lo: boots[Math.max(0, loIdx)],
    hi: boots[Math.min(B - 1, hiIdx)],
    boots,
  };
}

/**
 * Permutation test for association between xs and ys.
 * Shuffles ys B times using Fisher-Yates, computes |statFn(xs, shuffled)|.
 * p-value = fraction of permuted |stat| >= |observed stat|.
 *
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {function} statFn - (xs, ys) -> number
 * @param {number} B - number of permutations (default 10000)
 * @returns {{ observed: number, p: number }}
 */
export function permutationTest(xs, ys, statFn, B = 10000) {
  const observed = Math.abs(statFn(xs, ys));
  let count = 0;

  for (let b = 0; b < B; b++) {
    // Fisher-Yates shuffle of a copy of ys
    const shuffled = ys.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    const permStat = Math.abs(statFn(xs, shuffled));
    if (permStat >= observed) count++;
  }

  return { observed, p: count / B };
}

/**
 * One-sided binomial test (greater).
 * P(X >= successes) under H0: p = p0.
 * Computed in log-space for numerical stability.
 *
 * @param {number} successes
 * @param {number} trials
 * @param {number} p0 - null hypothesis probability (default 0.5)
 * @returns {number} p-value
 */
export function binomialTest(successes, trials, p0 = 0.5) {
  // Edge guards
  if (trials === 0) return 1.0;
  if (successes <= trials * p0) return 1.0;
  if (successes > trials) return 0.0;

  // Log-space binomial coefficient: log(C(n, k))
  function logChoose(n, k) {
    if (k === 0 || k === n) return 0;
    if (k === 1 || k === n - 1) return Math.log(n);
    // Use log-gamma via Stirling for large n, else direct sum
    let s = 0;
    for (let i = 0; i < k; i++) {
      s += Math.log(n - i) - Math.log(i + 1);
    }
    return s;
  }

  // P(X >= successes) = sum_{k=successes}^{trials} C(n,k) * p0^k * (1-p0)^(n-k)
  const logP0 = Math.log(p0);
  const logQ0 = Math.log(1 - p0);

  // Compute in log-space, then use log-sum-exp for stability
  const logTerms = [];
  for (let k = successes; k <= trials; k++) {
    logTerms.push(logChoose(trials, k) + k * logP0 + (trials - k) * logQ0);
  }

  // Log-sum-exp
  const maxLog = Math.max(...logTerms);
  let sumExp = 0;
  for (const lt of logTerms) {
    sumExp += Math.exp(lt - maxLog);
  }

  return Math.exp(maxLog + Math.log(sumExp));
}

/**
 * Fisher z-transform confidence interval for Pearson r.
 *
 * @param {number} r - observed Pearson correlation
 * @param {number} n - sample size
 * @param {number} α - significance level (default 0.001)
 * @returns {{ lo: number, hi: number }}
 */
export function pearsonCI(r, n, α = 0.001) {
  // Fisher z-transform
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const zCrit = normalQuantile(1 - α / 2);

  const zLo = z - zCrit * se;
  const zHi = z + zCrit * se;

  // Back-transform with tanh
  return {
    lo: Math.tanh(zLo),
    hi: Math.tanh(zHi),
  };
}

/**
 * Fisher z-test: compare two independent Pearson correlations.
 * Clamps r values to [-0.9999, 0.9999] to avoid atanh domain errors.
 *
 * @param {number} r1 - first correlation
 * @param {number} n1 - first sample size
 * @param {number} r2 - second correlation
 * @param {number} n2 - second sample size
 * @returns {{ z: number, p: number }}
 */
export function fisherZTest(r1, n1, r2, n2) {
  const clamp = (r) => Math.max(-0.9999, Math.min(0.9999, r));
  const z1 = Math.atanh(clamp(r1));
  const z2 = Math.atanh(clamp(r2));

  const se = Math.sqrt(1 / (n1 - 3) + 1 / (n2 - 3));
  const z = (z1 - z2) / se;
  const p = 2 * (1 - normalCDF(Math.abs(z))); // two-tailed

  return { z, p };
}

/**
 * Power analysis via bootstrap.
 * Runs bootstrapCI, checks if CI width <= targetWidth.
 * If not, estimates recommended N using (width/target)^2 scaling.
 *
 * @param {number[]} data
 * @param {function} statFn
 * @param {number} targetWidth - desired CI width
 * @param {number} α - significance level (default 0.001)
 * @param {number} B - bootstrap replicates (default 5000)
 * @returns {{ sufficient: boolean, width: number, recommendedN: number|null, ci: {lo: number, hi: number} }}
 */
export function powerAnalysis(data, statFn, targetWidth, α = 0.001, B = 5000) {
  const ci = bootstrapCI(data, statFn, α, B);
  const width = ci.hi - ci.lo;
  const sufficient = width <= targetWidth;

  let recommendedN = null;
  if (!sufficient) {
    // CI width scales as 1/sqrt(n), so n_needed ~ n * (width/target)^2
    recommendedN = Math.ceil(data.length * (width / targetWidth) ** 2);
  }

  return {
    sufficient,
    width,
    recommendedN,
    ci: { lo: ci.lo, hi: ci.hi },
  };
}
