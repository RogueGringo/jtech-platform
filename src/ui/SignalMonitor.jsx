import { useState, useEffect, useCallback } from "react";
import { COLORS, severityColor, trendArrow } from "./DesignSystem.js";
import { computeSeverity, computeCoherence } from "../engine/signals.js";
import { fetchCommodityPrices } from "../engine/prices.js";
import { classifyText } from "../engine/classify.js";
import RegimeBadge from "./RegimeBadge.jsx";
import Term from "./Term.jsx";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function SignalMonitor({ config, terms }) {
  const livePriceIds = new Set(config.livePriceIds || []);

  const [signals, setSignals] = useState(() =>
    (config.signals || []).map(s => ({
      ...s,
      dataSource: livePriceIds.has(s.id) ? "pending" : "reference",
      lastUpdate: null,
    }))
  );
  const [filter, setFilter] = useState({ severity: "all", category: "all" });
  const [analyzerText, setAnalyzerText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [priceStatus, setPriceStatus] = useState("loading");

  // Resolve category meta from config — map color names to COLORS values
  const categoryMeta = {};
  for (const [key, meta] of Object.entries(config.categories || {})) {
    categoryMeta[key] = { label: meta.label, color: COLORS[meta.color] || COLORS.textMuted };
  }

  // Fetch real commodity prices — the ONLY live data source
  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        const data = await fetchCommodityPrices(config.priceSymbols || {}, config.derivedPrices || {});
        if (cancelled) return;
        setPriceStatus(data.source);

        if (data.source === "live" || data.source === "cached") {
          setSignals(prev => prev.map(s => {
            const priceInfo = data.prices[s.id];
            if (!priceInfo || priceInfo.price === undefined) return s;
            const newNumeric = priceInfo.price;
            let formatted;
            if (s.unit === "/bbl" || s.id === "spread") formatted = "$" + newNumeric.toFixed(2);
            else if (s.unit === "%") formatted = Math.round(newNumeric) + "%";
            else formatted = newNumeric.toFixed(1);
            const newSeverity = computeSeverity(s.id, newNumeric, s.severity, config.severityThresholds || {});
            return {
              ...s,
              numeric: newNumeric,
              value: formatted,
              severity: newSeverity,
              lastUpdate: new Date(),
              dataSource: priceInfo.source === "live" ? "live" : "derived",
            };
          }));
        }
      } catch {
        if (!cancelled) setPriceStatus("error");
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Compute coherence score
  const coherence = computeCoherence(signals);
  const { score: coherenceScore, criticalCount, highCount } = coherence;
  const regimeColor = coherenceScore >= 75 ? COLORS.red : coherenceScore >= 50 ? COLORS.orange : COLORS.green;

  // Filter signals
  const filteredSignals = signals.filter(s => {
    if (filter.severity !== "all" && s.severity !== filter.severity) return false;
    if (filter.category !== "all" && s.category !== filter.category) return false;
    return true;
  });

  // Semantic analyzer
  const analyzeText = useCallback(() => {
    if (!analyzerText.trim()) return;
    const result = classifyText(analyzerText, {
      effectKeywords: config.effectKeywords || [],
      eventKeywords: config.eventKeywords || [],
      chainTerms: config.chainTerms || {},
    });
    setAnalysisResult(result);
  }, [analyzerText, config]);

  const liveSignalCount = signals.filter(s => s.dataSource === "live" || s.dataSource === "derived").length;
  const referenceSignalCount = signals.filter(s => s.dataSource === "reference").length;

  return (
    <div style={{ padding: "32px", maxWidth: 1200 }}>
      {/* SYSTEM STATUS HEADER */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: COLORS.gold, margin: "0 0 6px" }}>
            Signal Monitor
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textDim, margin: 0, lineHeight: 1.5 }}>
            <Term t="condition:state" terms={terms}>Condition:state</Term> tracking across all effect-indicators. Price signals update from live market data.{" "}
            <Term t="coherence" terms={terms}>Coherence</Term> measures whether independent indicators agree — <Term t="consolidation" terms={terms}>consolidation</Term> indicates structural shift.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {/* Data source indicator */}
          <div style={{
            padding: "10px 14px", borderRadius: 8, textAlign: "center",
            background: `${priceStatus === "live" ? COLORS.green : priceStatus === "cached" ? COLORS.blue : COLORS.orange}10`,
            border: `1px solid ${priceStatus === "live" ? COLORS.green : priceStatus === "cached" ? COLORS.blue : COLORS.orange}30`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center", marginBottom: 3 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: priceStatus === "live" ? COLORS.green : priceStatus === "cached" ? COLORS.blue : COLORS.orange,
                animation: priceStatus === "live" ? "pulse 2s infinite" : "none",
              }} />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: priceStatus === "live" ? COLORS.green : priceStatus === "cached" ? COLORS.blue : COLORS.orange,
              }}>
                {priceStatus === "live" ? "LIVE PRICES" : priceStatus === "cached" ? "CACHED" : priceStatus === "loading" ? "FETCHING" : "NO LIVE PRICES"}
              </span>
            </div>
            <div style={{ fontSize: 9, color: COLORS.textMuted }}>
              {liveSignalCount} live · {referenceSignalCount} reference
            </div>
          </div>
          {/* Regime badge */}
          <RegimeBadge coherence={coherence} />
        </div>
      </div>

      {/* COHERENCE GAUGE + FILTER CONTROLS */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24,
      }}>
        {/* Coherence gauge */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "20px 24px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
            SIGNAL <Term t="coherence" terms={terms}>COHERENCE</Term> — <Term t="gini trajectory" terms={terms}>GINI TRAJECTORY</Term>
          </div>
          <div style={{
            height: 24, borderRadius: 12, background: COLORS.bg, position: "relative", overflow: "hidden", marginBottom: 10,
          }}>
            <div style={{
              height: "100%", borderRadius: 12, width: coherenceScore + "%",
              background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.orange}, ${COLORS.red})`,
              transition: "width 0.5s ease",
            }} />
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: COLORS.text,
            }}>
              {coherenceScore}% CONSOLIDATION
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted }}>
            <span><Term t="dispersion" terms={terms}>DISPERSING</Term> (transient)</span>
            <span><Term t="consolidation" terms={terms}>CONSOLIDATING</Term> (structural)</span>
          </div>
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 6,
            background: `${regimeColor}10`, border: `1px solid ${regimeColor}25`,
            fontSize: 12, color: COLORS.textDim, lineHeight: 1.5,
          }}>
            {coherenceScore >= 75
              ? <>Positive Gini trajectory. <strong style={{ color: COLORS.red }}>{criticalCount} critical</strong> and <strong style={{ color: COLORS.orange }}>{highCount} high</strong> signals consolidating — independent systems confirm structural phase transition.</>
              : coherenceScore >= 50
                ? <>Intermediate coherence. Signals partially aligned — monitoring for consolidation or dispersion trend.</>
                : <>Negative Gini trajectory. Signals dispersing — current perturbation appears transient, not structural.</>
            }
          </div>
        </div>

        {/* Filter + summary */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "20px 24px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
            NOISE FILTER
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, letterSpacing: 1 }}>BY SEVERITY</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", "critical", "high", "moderate", "watch"].map(sev => (
                <button key={sev} onClick={() => setFilter(f => ({ ...f, severity: sev }))} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                  cursor: "pointer", border: "1px solid", textTransform: "uppercase",
                  background: filter.severity === sev ? (sev === "all" ? COLORS.gold + "20" : severityColor(sev) + "25") : "transparent",
                  borderColor: filter.severity === sev ? (sev === "all" ? COLORS.gold : severityColor(sev)) : COLORS.border,
                  color: filter.severity === sev ? (sev === "all" ? COLORS.gold : severityColor(sev)) : COLORS.textMuted,
                }}>
                  {sev === "all" ? "ALL" : sev}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6, letterSpacing: 1 }}>BY CATEGORY</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", ...Object.keys(config.categories || {})].map(cat => (
                <button key={cat} onClick={() => setFilter(f => ({ ...f, category: cat }))} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                  cursor: "pointer", border: "1px solid", textTransform: "uppercase",
                  background: filter.category === cat ? (cat === "all" ? COLORS.gold + "20" : (categoryMeta[cat]?.color || COLORS.gold) + "25") : "transparent",
                  borderColor: filter.category === cat ? (cat === "all" ? COLORS.gold : categoryMeta[cat]?.color || COLORS.gold) : COLORS.border,
                  color: filter.category === cat ? (cat === "all" ? COLORS.gold : categoryMeta[cat]?.color || COLORS.gold) : COLORS.textMuted,
                }}>
                  {cat === "all" ? "ALL" : categoryMeta[cat]?.label || cat}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            {Object.entries(categoryMeta).map(([key, meta]) => {
              const count = signals.filter(s => s.category === key).length;
              const criticals = signals.filter(s => s.category === key && s.severity === "critical").length;
              return (
                <div key={key} style={{
                  textAlign: "center", padding: "8px 4px", borderRadius: 6,
                  background: `${meta.color}10`, border: `1px solid ${meta.color}20`,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: meta.color }}>{count}</div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 }}>{meta.label}</div>
                  {criticals > 0 && (
                    <div style={{ fontSize: 9, color: COLORS.red, marginTop: 2 }}>{criticals} CRITICAL</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LIVE SIGNAL GRID */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 16 }}>
          LIVE CONDITION:STATES — {filteredSignals.length} SIGNALS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {filteredSignals.map(s => {
            return (
              <div key={s.id} style={{
                padding: "14px 16px", borderRadius: 8,
                background: `${severityColor(s.severity)}08`,
                borderTop: `1px solid ${severityColor(s.severity)}20`,
                borderRight: `1px solid ${severityColor(s.severity)}20`,
                borderBottom: `1px solid ${severityColor(s.severity)}20`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 }}>{s.name}</span>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
                      padding: "1px 4px", borderRadius: 2,
                      background: s.dataSource === "live" ? `${COLORS.green}25`
                        : s.dataSource === "derived" ? `${COLORS.blue}25`
                        : `${COLORS.textMuted}15`,
                      color: s.dataSource === "live" ? COLORS.green
                        : s.dataSource === "derived" ? COLORS.blue
                        : COLORS.textMuted,
                    }}>
                      {s.dataSource === "live" ? "LIVE" : s.dataSource === "derived" ? "CALC" : "REF"}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: 1,
                      padding: "1px 5px", borderRadius: 3,
                      background: `${severityColor(s.severity)}20`, color: severityColor(s.severity),
                    }}>
                      {s.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: COLORS.textDim }}>{s.unit}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: s.trend === "up" ? COLORS.red : s.trend === "down" ? COLORS.green : COLORS.textMuted,
                  }}>
                    {trendArrow(s.trend)} {s.trend.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 8, color: COLORS.textMuted }}>
                    {s.dataSource === "live" || s.dataSource === "derived"
                      ? (s.lastUpdate ? new Date(s.lastUpdate).toLocaleTimeString() : "fetching...")
                      : s.source || "reference"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEMANTIC ANALYTICS */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 6 }}>
          SEMANTIC SIGNAL ANALYZER
        </div>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: "0 0 12px", lineHeight: 1.5 }}>
          Paste a headline, report excerpt, or data point below. The analyzer classifies the input as
          an <strong style={{ color: COLORS.green }}><Term t="effect" terms={terms}>effect</Term></strong> (measurable change in the physical world) or
          an <strong style={{ color: COLORS.red }}><Term t="event" terms={terms}>event</Term></strong> (narrative, prediction, or sentiment) and maps it to the relevant effect chain.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <textarea
            value={analyzerText}
            onChange={e => setAnalyzerText(e.target.value)}
            placeholder={'e.g., "7 of 12 P&I clubs withdrew war risk coverage, removing insurance from 90% of global fleet"'}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 8, fontSize: 13,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, resize: "vertical", minHeight: 60,
              fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
            }}
          />
          <button onClick={analyzeText} style={{
            padding: "12px 24px", borderRadius: 8, fontSize: 11, fontWeight: 700,
            letterSpacing: 1, cursor: "pointer",
            background: `${COLORS.gold}20`, border: `1px solid ${COLORS.gold}`,
            color: COLORS.gold, alignSelf: "flex-start",
          }}>
            ANALYZE
          </button>
        </div>

        {analysisResult && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 12 }}>
              {/* Classification badge */}
              <div style={{
                padding: "16px 24px", borderRadius: 8, textAlign: "center", minWidth: 140,
                background: `${analysisResult.classification === "EFFECT" ? COLORS.green : analysisResult.classification === "EVENT" ? COLORS.red : COLORS.orange}15`,
                border: `1px solid ${analysisResult.classification === "EFFECT" ? COLORS.green : analysisResult.classification === "EVENT" ? COLORS.red : COLORS.orange}40`,
              }}>
                <div style={{
                  fontSize: 18, fontWeight: 800, letterSpacing: 1,
                  color: analysisResult.classification === "EFFECT" ? COLORS.green : analysisResult.classification === "EVENT" ? COLORS.red : COLORS.orange,
                }}>
                  {analysisResult.classification}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                  {analysisResult.classification === "EFFECT" ? "SIGNAL" : analysisResult.classification === "EVENT" ? "NOISE" : "AMBIGUOUS"}
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 }}>SIGNAL STRENGTH</div>
                <div style={{ height: 14, borderRadius: 7, background: `${COLORS.border}`, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 7,
                    width: analysisResult.confidence + "%",
                    background: analysisResult.classification === "EFFECT" ? COLORS.green : analysisResult.classification === "EVENT" ? COLORS.red : COLORS.orange,
                    transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>
                  {analysisResult.confidence}% confidence — {analysisResult.effectHits.length} effect terms, {analysisResult.eventHits.length} event terms detected
                </div>
              </div>
            </div>

            {/* Keyword highlights */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              {analysisResult.effectHits.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.green, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>EFFECT TERMS</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {analysisResult.effectHits.map((k, i) => (
                      <span key={i} style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11,
                        background: `${COLORS.green}15`, color: COLORS.green,
                        border: `1px solid ${COLORS.green}30`,
                      }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.eventHits.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>EVENT TERMS</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {analysisResult.eventHits.map((k, i) => (
                      <span key={i} style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11,
                        background: `${COLORS.red}15`, color: COLORS.red,
                        border: `1px solid ${COLORS.red}30`,
                      }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chain mapping */}
            {analysisResult.chainMap.length > 0 && (
              <div style={{
                padding: "10px 14px", borderRadius: 6,
                background: `${COLORS.gold}08`, border: `1px solid ${COLORS.gold}20`,
              }}>
                <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>MAPS TO EFFECT CHAIN</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {analysisResult.chainMap.map((chain, i) => (
                    <span key={i} style={{
                      padding: "4px 10px", borderRadius: 4, fontSize: 11,
                      background: `${COLORS.gold}15`, color: COLORS.gold,
                      border: `1px solid ${COLORS.gold}30`, fontWeight: 600,
                    }}>{chain}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <SourceVerifyLink sources={config.verifySources?.monitor} />
    </div>
  );
}
