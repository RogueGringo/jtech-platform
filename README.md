---
title: JtechAi Intel
emoji: ⚡
colorFrom: gray
colorTo: green
sdk: docker
pinned: false
---

# JtechAi — All-Source Intelligence Platform

### Configurable Effects-Based Analysis Engine

**[Open the Dashboard] (https://roguegringo.github.io/IntelBrief-Hormuz-Iran/)** <Offline due to IP temporarily.

---

A configurable intelligence platform that tracks what physically changed in the real world — not what analysts predicted. Effects over events.

Live commodity prices. Live RSS feeds from open-source intelligence channels. Auto-classified as signal (measurable effects) or noise (narrative/prediction). Auto-refreshes.

## Architecture

- **Engine** (`src/engine/`) — Domain-agnostic classification, signal monitoring, feed ingestion, price fetching
- **UI** (`src/ui/`) — Generic shell that renders any domain configuration
- **Domains** (`src/domains/`) — Domain-specific configs, content, and glossaries

New intelligence domain = new folder in `src/domains/`. Copy `_template/` to start.

## Current Domain: Strait of Hormuz Crisis

The included domain tracks the effects-based analysis of the Iran/Hormuz situation — insurance cascades, physical flow indicators, price architecture, and regime detection.

---

*JtechAi — mr.white@jtech.ai*
