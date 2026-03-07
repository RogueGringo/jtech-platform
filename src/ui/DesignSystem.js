export const COLORS = {
  bg: "#0a0c10",
  surface: "#12151c",
  surfaceHover: "#1a1e28",
  border: "#1e2330",
  borderActive: "#d4a843",
  gold: "#d4a843",
  goldDim: "#8a6e2f",
  goldBright: "#f0c95a",
  red: "#e04040",
  redDim: "#8b2020",
  green: "#3dba6f",
  greenDim: "#1d6b3a",
  blue: "#4a8fd4",
  blueDim: "#2a5580",
  text: "#e8e4dc",
  textDim: "#8a8678",
  textMuted: "#5a5850",
  orange: "#e08840",
  purple: "#9070d0",
};

export const FONTS = {
  heading: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', sans-serif",
};

export const SPACING = {
  page: 32,
  section: 24,
  card: 20,
  element: 12,
  tight: 6,
};

export function severityColor(severity) {
  if (severity === "critical") return COLORS.red;
  if (severity === "high") return COLORS.orange;
  if (severity === "moderate") return COLORS.blue;
  return COLORS.textMuted;
}

export function trendArrow(trend) {
  if (trend === "up") return "\u25B2";
  if (trend === "down") return "\u25BC";
  return "\u25A0";
}
