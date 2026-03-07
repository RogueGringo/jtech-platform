// Domain Content Template
// Export components for each content tab.

import { COLORS } from "../../ui/DesignSystem.js";

export function ThesisContent() {
  return (
    <div style={{ padding: 32, color: COLORS.textDim }}>
      <p>Define your thesis here — the core insight this domain tracks.</p>
    </div>
  );
}

export function getNodesCategories() {
  return [];
}

export function getEffectChains() {
  return [];
}

export function getScenarioPricing() {
  return [];
}

export function EffectChainClosing() {
  return null;
}

export function PatternsContent() {
  return (
    <div style={{ padding: 32, color: COLORS.textDim }}>
      <p>Define patterns of life analysis for this domain.</p>
    </div>
  );
}
