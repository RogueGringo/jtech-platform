const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

export function assessPhase(signals, phases) {
  if (!phases || phases.length === 0) return { currentPhase: null, phaseScores: [], transitionIndicators: [] };

  const signalMap = {};
  for (const s of signals) signalMap[s.id] = s;

  const phaseScores = phases.map(phase => {
    const required = phase.requiredSignals || [];
    if (required.length === 0) {
      return { ...phase, met: 0, total: 0, score: 0, signals: [] };
    }
    let met = 0;
    const signalDetails = required.map(req => {
      const signal = signalMap[req.signalId];
      const currentRank = signal ? (SEVERITY_RANK[signal.severity] || 0) : 0;
      const requiredRank = SEVERITY_RANK[req.minSeverity] || 1;
      const isMet = currentRank >= requiredRank;
      if (isMet) met++;
      return {
        signalId: req.signalId, name: signal?.name || req.signalId,
        currentSeverity: signal?.severity || "unknown", requiredSeverity: req.minSeverity,
        value: signal?.value || "—", isMet,
      };
    });
    return { ...phase, met, total: required.length, score: required.length > 0 ? Math.round((met / required.length) * 100) : 0, signals: signalDetails };
  });

  let currentPhase = phaseScores[0];
  for (let i = phaseScores.length - 1; i >= 1; i--) {
    if (phaseScores[i].score === 100) { currentPhase = phaseScores[i]; break; }
  }

  const transitionIndicators = phaseScores
    .filter(p => p.total > 0 && p.score > 0 && p.score < 100)
    .map(p => ({ id: p.id, name: p.name, score: p.score, met: p.met, total: p.total }));

  return { currentPhase, phaseScores, transitionIndicators };
}
