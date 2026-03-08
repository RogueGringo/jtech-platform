import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

let passed = 0, failed = 0;
function assert(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); failed++; }
}

// --- Propagation capacity ---
// Category with max=critical(4), others=watch(1) -> high propagation
const mixedSignals = [
  { id: "a", category: "cond", severity: "critical" },
  { id: "b", category: "cond", severity: "watch" },
  { id: "c", category: "cond", severity: "watch" },
  { id: "d", category: "flow", severity: "moderate" },
  { id: "e", category: "flow", severity: "moderate" },
];
const prop = computePropagationCapacity(mixedSignals, ["cond", "flow"]);
assert(prop.perCategory.cond > prop.perCategory.flow,
  "Mixed category has higher propagation than uniform",
  `cond=${prop.perCategory.cond}, flow=${prop.perCategory.flow}`);
assert(prop.aggregate > 0, "Aggregate propagation > 0", `got ${prop.aggregate}`);

// Uniform signals -> zero propagation
const uniformSignals = [
  { id: "a", category: "cond", severity: "critical" },
  { id: "b", category: "cond", severity: "critical" },
  { id: "c", category: "flow", severity: "critical" },
];
const propUniform = computePropagationCapacity(uniformSignals, ["cond", "flow"]);
assert(propUniform.aggregate === 0, "Uniform signals = zero propagation", `got ${propUniform.aggregate}`);

// --- Dissolution rate ---
// Rising coherence -> negative dissolution (deepening)
const risingCoherence = [60, 65, 70, 75, 80];
const dissRising = computeDissolutionRate(risingCoherence);
assert(dissRising < 0, "Rising coherence = negative dissolution (deepening)", `got ${dissRising}`);

// Falling coherence -> positive dissolution (resolving)
const fallingCoherence = [80, 75, 70, 65, 60];
const dissFalling = computeDissolutionRate(fallingCoherence);
assert(dissFalling > 0, "Falling coherence = positive dissolution (resolving)", `got ${dissFalling}`);

// --- Trajectory classification ---
assert(classifyTrajectory(0.8, -0.5).label === "ACCELERATING",
  "High prop + negative diss = ACCELERATING", `got ${classifyTrajectory(0.8, -0.5).label}`);
assert(classifyTrajectory(0.1, -0.5).label === "CONSOLIDATING",
  "Low prop + negative diss = CONSOLIDATING", `got ${classifyTrajectory(0.1, -0.5).label}`);
assert(classifyTrajectory(0.8, 0.5).label === "TURBULENT",
  "High prop + positive diss = TURBULENT", `got ${classifyTrajectory(0.8, 0.5).label}`);
assert(classifyTrajectory(0.1, 0.5).label === "RESOLVING",
  "Low prop + positive diss = RESOLVING", `got ${classifyTrajectory(0.1, 0.5).label}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
