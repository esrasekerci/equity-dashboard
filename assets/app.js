/* Daily Equity Research Dynamic Dashboard (Desktop + Mobile-First) */
(() => {
  const state = {
    index: null,
    date: null,
    summary: null,
    breaking: [],
    authorities: [],
    tickerCache: {},
    view: "overview",
    prevView: "overview",
    activeTicker: null,
    filter: "all",
    activeSector: null,
    sortKey: "notable_score",
    sortDir: -1,
    breakingCategory: "all",
    authorityAgency: "all",
    networkCenter: "NVDA",
    networkFilter: "all",
    networkHistory: ["NVDA"],
    networkLastEdge: null,
    stockBubbleCenter: null,
    stockBubbleFilter: "all",
    stockBubbleHistory: [],
    stockBubbleLastEdge: null,
    deferredInstallPrompt: null,
    stockTab: "news",
    chartTab: "interactive",
    chartRange: "6M",
    chartOverlays: { sma20: true, sma50: true, sma200: false, sr: true, weekends: false },
    tvChart: null,
    tvResizeObs: null,
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtNum = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d));
  const fmtPct = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(d)}%`);
  const clsPct = (v) => (v == null ? "" : Number(v) > 0 ? "pos" : Number(v) < 0 ? "neg" : "");
  const secHtmlUrl = (url) => {
    if (!url) return "#";
    const m = String(url).match(/^(https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/)(\d{18})\/[^/]+\.xml$/i);
    if (m) {
      const acc = m[2];
      return `${m[1]}${acc}/${acc.slice(0, 10)}-${acc.slice(10, 12)}-${acc.slice(12)}-index.htm`;
    }
    return url;
  };
  const fmtCap = (v) => {
    if (v == null || Number.isNaN(Number(v))) return "—";
    const n = Number(v);
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  };
  const SECTOR_LABELS = {
    semiconductors: "Semiconductors",
    neocloud_ai_infra: "Neocloud & AI Infra",
    datacenter_neocloud: "Neocloud & AI Infra",
    ai_cloud: "AI Cloud & Platforms",
    software: "Enterprise AI Software",
    hardware_infra: "AI Servers & Cooling",
    megacap_platforms: "Megacap Cloud & AI",
    power_utilities: "Power & Nuclear Utilities",
    clean_energy: "Clean & Nuclear Energy",
    energy: "Oil & Natural Gas",
    ev_energy: "EV & Autonomous AI",
    macro_policy: "Macro & Trade Policy",
  };
  const fmtSector = (s) => {
    if (!s) return "Other";
    const key = String(s).toLowerCase();
    if (SECTOR_LABELS[key]) return SECTOR_LABELS[key];
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Simple, clear Binance-style explanations for ? tooltips (exact formulas live on the dedicated "Formulas" tab)
  const GLOSSARY = {
    notable_score:
      "Notable Score (0–100)|Shows how unusually active a stock is today based on price move size, volume spike, news, and SEC filings. Higher score = more market attention today (not a buy/sell rating).",
    rsi14:
      "RSI-14 (Momentum)|0–100 speed gauge over the last 14 days. Below 30 = Oversold (sharp recent drop); Above 70 = Overbought (sharp recent rally); 30–70 = Neutral.",
    sma:
      "SMA 20 / 50 / 200 (Trend Lines)|Average closing price over the last 20 (short-term), 50 (medium-term), and 200 (long-term) trading days. Green = price is above that trend line; Red = below.",
    rs_spy:
      "vs SPY (1-Month Relative Strength)|How much the stock beat (+) or lagged (−) the S&P 500 index over the last 21 trading days.",
    rs_sector:
      "vs Sector ETF (1-Month)|How much the stock beat (+) or lagged (−) its own industry ETF over the last 21 trading days.",
    sr_levels:
      "Support (S1–S3) & Resistance (R1–R3)|Support (S) is a price floor where buyers previously stepped in; Resistance (R) is a price ceiling where sellers capped rallies.",
    sr_strength:
      "Level Strength (0–100)|How reliable a Support or Resistance zone is, based on how many times price bounced there and how much volume traded at that price.",
    scenarios:
      "20-Day Scenarios (Bull / Base / Bear %)|Rule-based probability split for the next 20 trading days based on trend, momentum, and key price levels. Not financial advice.",
    tech_score:
      "Technical Score (-1.00 to +1.00)|Overall technical trend balance from -1.00 (strongly bearish) to +1.00 (strongly bullish).",
    breadth:
      "Market Breadth (Advancers / Decliners)|How many of the 39 watchlist stocks closed green (↑) vs red (↓) today, plus their average 1-day return.",
    vix:
      "VIX Volatility Index|Market's 30-day 'fear gauge' on the S&P 500. Below 15 = calm market; 20–25 = elevated caution; Above 30 = high stress.",
    dgs10:
      "US 10-Year Treasury Yield|Benchmark 10-year US government bond interest rate. Rising yields often pressure growth & tech stock valuations.",
    fomc:
      "Next FOMC Decision|Countdown to the Federal Reserve's next interest-rate decision meeting.",
    vol_ratio:
      "Volume vs 20d Average|Today's trading volume compared to the stock's normal 20-day average. 1.5x or higher signals heavy institutional activity.",
    updown_vol:
      "Up/Down Volume Ratio (20d)|Volume on green days divided by volume on red days over the last 20 sessions. Above 1.2 = Accumulation (buying); Below 0.8 = Distribution (selling).",
    short_float:
      "Short % of Float|Percentage of tradable shares currently borrowed and sold short by bears. High short interest (>10%) can fuel bigger swings.",
    pe:
      "P/E Ratio (Trailing / Forward)|Stock price divided by last 12 months' earnings per share (TTM) vs estimated next 12 months' earnings (Forward).",
    fcf:
      "Free Cash Flow (TTM)|Actual cash generated by the business over the last 12 months after paying for data centers, fabs, and equipment.",
    target_upside:
      "Analyst Target Δ|Percentage difference between the average Wall Street analyst price target and current price.",
    form4:
      "SEC Form 4 (Insider Trades)|Official SEC filing required within 2 business days whenever a company executive or director buys or sells shares.",
    whale_13d:
      "SEC Schedule 13D / 13G|Official SEC filing required when a major fund or whale acquires more than 5% of a company.",
  };
  const tipAttr = (key) => (GLOSSARY[key] ? `data-tip="${esc(GLOSSARY[key])}"` : "");

  // Simple Binance-style per-stock tooltips (tap "Formulas" tab for full math & live step-by-step equations)
  function notableScoreTipAttr(r) {
    const bd = r?.notable_bd || r?.notable?.breakdown;
    if (!bd || !bd.terms) return tipAttr("notable_score");
    const tm = bd.terms;
    const parts = [];
    if (tm.vol_z > 0) parts.push(`Price move (${bd.z_atr}x daily range: +${tm.vol_z})`);
    if (tm.rvol > 0) parts.push(`Volume surge (${bd.rvol_20d}x avg: +${tm.rvol})`);
    if (tm.pattern > 0) parts.push(`Chart breakout/pattern (+${tm.pattern})`);
    if (tm.rsi_extreme > 0) parts.push(`Extreme RSI (+${tm.rsi_extreme})`);
    if (tm.news > 0) parts.push(`News activity (+${tm.news})`);
    if (tm.sec > 0) parts.push(`SEC filing (+${tm.sec})`);
    if ((tm.insider || 0) + (tm.earnings || 0) > 0) parts.push(`Insider/Earnings (+${(tm.insider || 0) + (tm.earnings || 0)})`);
    const summary = parts.length ? `Driven today by: ${parts.join(" · ")}.` : "Normal daily activity today.";
    const text = `Notable Score: ${fmtNum(bd.total, 1)} / 100|Measures how unusually active ${r.symbol} is today. ${summary}`;
    return `data-tip="${esc(text)}"`;
  }

  function levelStrengthTipAttr(x) {
    const text =
      `${x.label} ($${fmtNum(x.price)}) — Strength ${fmtNum(x.strength, 0)}/100|` +
      `Reliability score based on ${x.touches ?? 0} historical price bounces at this zone, trading volume concentration, and how recently it was tested (${x.last_touch || "recent"}).`;
    return `data-tip="${esc(text)}"`;
  }

  function techScenarioTipAttr(score, comps, sc) {
    const text =
      `20-Day Scenario Split (Bull ${sc?.bullish ?? 0}% · Base ${sc?.base ?? 0}% · Bear ${sc?.bearish ?? 0}%)|` +
      `Rule-based outlook combining trend lines (30%), momentum (30%), relative strength vs market (25%), and chart patterns (15%). Technical score: ${fmtNum(score, 2)}.`;
    return `data-tip="${esc(text)}"`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    return res.json();
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.date) params.set("date", state.date);
    if (state.view === "stock" && state.activeTicker) params.set("ticker", state.activeTicker);
    else if (state.view !== "overview") params.set("view", state.view);
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  function setView(view) {
    if (state.view && state.view !== view && state.view !== "stock") {
      state.prevView = state.view;
    }
    if (view !== "stock") {
      destroyInteractiveChart();
    }
    state.view = view;
    for (const v of ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro", "formulas", "stock"]) {
      $(`view-${v}`)?.classList.toggle("hidden", v !== view);
    }
    document.querySelectorAll("#mainNav .nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    const stockTab = $("stockNavTab");
    if (stockTab && state.activeTicker) {
      stockTab.classList.remove("hidden");
      stockTab.innerHTML = `<span>${esc(state.activeTicker)}</span><span class="tab-close-x" data-close-stock-tab="1" title="Close ${esc(state.activeTicker)} tab">✕</span>`;
      const closeX = stockTab.querySelector("[data-close-stock-tab]");
      if (closeX) {
        closeX.onclick = (e) => {
          e.stopPropagation();
          closeStockTab();
        };
      }
      if ($("backToOverview")) {
        $("backToOverview").textContent = `✕ Close ${state.activeTicker}`;
      }
    }
    syncUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeStockTab() {
    destroyInteractiveChart();
    state.activeTicker = null;
    const stockTab = $("stockNavTab");
    if (stockTab) {
      stockTab.classList.add("hidden");
      stockTab.innerHTML = "Stock";
    }
    const target = state.prevView && state.prevView !== "stock" ? state.prevView : "overview";
    setView(target);
  }

  // ---- THEME ----
  function initTheme() {
    const saved = localStorage.getItem("eqr_theme") || "dark";
    applyTheme(saved);
    $("themeToggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("eqr_theme", next);
      applyTheme(next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0e11" : "#ffffff");
    if (state.view === "stock" && state.activeTicker && state.chartTab === "interactive") {
      const t = state.tickerCache[`${state.date}:${state.activeTicker}`];
      if (t) mountInteractiveChart(t);
    }
  }

  // ---- LOAD DATA ----
  async function loadBreaking() {
    try {
      const b = await fetchJson("data/breaking_news.json");
      state.breaking = Array.isArray(b.items) ? b.items : [];
      $("breakingCount").textContent = String(state.breaking.length);
      if (b.updated_at) $("breakingUpdated").textContent = `Updated ${b.updated_at.replace("T", " ").replace("Z", " UTC")} · Auto-checked every hour (24/7)`;
    } catch {
      state.breaking = [];
      $("breakingCount").textContent = "0";
    }
    renderBreaking();
  }

  async function loadAuthorities() {
    try {
      const a = await fetchJson("data/authorities.json");
      state.authorities = Array.isArray(a.items) ? a.items : [];
      if (a.updated_at) $("authoritiesUpdated").textContent = `Official US Regulators · Updated ${a.updated_at.replace("T", " ").replace("Z", " UTC")}`;
    } catch {
      state.authorities = [];
    }
    renderAuthorities();
  }

  function renderAuthorities() {
    const fallback = (state.summary?.feeds?.regulatory || []).map((x) => ({
      agency: x.extra?.agency || x.source || "Federal Register",
      title: x.title,
      url: x.url,
      published: x.published,
      source: x.source,
      summary: x.summary,
      categories: x.categories || [],
    }));
    const items = state.authorities.length ? state.authorities : fallback;
    $("authoritiesCount").textContent = String(items.length);

    const bar = $("authorityAgencyBar");
    const el = $("authoritiesList");
    if (!items.length) {
      bar.innerHTML = "";
      el.innerHTML = `<div class="panel muted">No official authority declarations loaded yet.</div>`;
      return;
    }

    const counts = {};
    for (const it of items) {
      const ag = it.agency || "Official";
      counts[ag] = (counts[ag] || 0) + 1;
    }
    const agencies = ["all", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
    if (!agencies.includes(state.authorityAgency)) state.authorityAgency = "all";

    bar.innerHTML = agencies.map((ag) => {
      const label = ag === "all" ? `All (${items.length})` : `${ag} (${counts[ag]})`;
      return `<button class="chip ${state.authorityAgency === ag ? "active" : ""}" data-ag="${esc(ag)}">${esc(label)}</button>`;
    }).join("");
    bar.querySelectorAll("button").forEach((b) => {
      b.onclick = () => { state.authorityAgency = b.dataset.ag; renderAuthorities(); };
    });

    const filtered = state.authorityAgency === "all" ? items : items.filter((x) => (x.agency || "Official") === state.authorityAgency);
    el.innerHTML = filtered.map((it) => `
      <div class="feed-item">
        <div class="feed-meta">
          <span class="tag amber">${esc(it.agency || it.source || "Official")}</span>
          ${(it.categories || []).slice(0, 2).map((c) => `<span class="tag">${esc(String(c).replace(/_/g, " "))}</span>`).join("")}
          <span>${esc((it.published || "").slice(0, 10))}</span>
        </div>
        <a class="feed-title" href="${esc(it.url || "#")}" target="_blank" rel="noopener">${esc(it.title)}</a>
        ${it.summary ? `<div class="muted" style="margin-top:4px">${esc(it.summary.slice(0, 220))}${it.summary.length > 220 ? "…" : ""}</div>` : ""}
      </div>
    `).join("");
  }

  function closeInfoModal() {
    $("infoModal")?.classList.add("hidden");
  }

  function openSectorModal(sector) {
    if (!sector || !state.summary) return;
    const modal = $("infoModal");
    const box = $("infoModalBody");
    if (!modal || !box) return;

    const allTickers = state.summary.tickers || [];
    const hmSec = (state.summary.heatmap?.sectors || []).find((x) => x.sector === sector) || {};
    const members = allTickers
      .filter((r) => r.sector === sector)
      .sort((a, b) => (b.notable_score || 0) - (a.notable_score || 0));

    const secCounts = {};
    for (const t of allTickers) secCounts[t.sector] = (secCounts[t.sector] || 0) + 1;
    const allSecs = Object.keys(secCounts).sort((a, b) => secCounts[b] - secCounts[a]);

    box.innerHTML = `
      <div class="modal-card-hdr">
        <div>
          <div class="modal-eyebrow">Sector Intelligence Explorer</div>
          <h2 style="font-size:19px;text-transform:capitalize">${esc(fmtSector(sector))}</h2>
          <div class="muted" style="margin-top:2px">
            Benchmark ETF: <strong>${esc(hmSec.etf || members[0]?.sector_etf || "—")}</strong>
            (${fmtPct(hmSec.etf_ret_1d, 2)} 1D) · Sector Equal-Weighted Avg 1D:
            <strong class="${clsPct(hmSec.avg_ret_1d)}">${fmtPct(hmSec.avg_ret_1d, 2)}</strong>
          </div>
        </div>
        <button class="modal-close-inline" id="closeInfoModalBtn" aria-label="Close">✕</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div class="control-group">
          <label for="modalSectorSelect" class="muted">Switch Sector</label>
          <select id="modalSectorSelect" class="select-control compact">
            ${allSecs.map((sec) => `<option value="${esc(sec)}" ${sec === sector ? "selected" : ""}>${esc(fmtSector(sec))}</option>`).join("")}
          </select>
        </div>
        <button class="btn-secondary compact-hdr-btn" id="filterScreenerBySecBtn">Open in Screener Table →</button>
      </div>

      <div class="rel-cards-grid" style="max-height:60vh;overflow-y:auto;padding-right:2px">
        ${members.map((r) => `
          <div class="rel-conn-card" data-sec-open="${esc(r.symbol)}" style="cursor:pointer">
            <div class="rcc-top">
              <div>
                <div class="rcc-sym">
                  <strong class="touch-name-link">${esc(r.symbol)} · ${esc(r.name)} ↗</strong>${r.is_core ? ' <span class="core-star">★</span>' : ""}
                  <span class="tag">${fmtCap(r.market_cap)}</span>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:800;font-size:15px">$${fmtNum(r.close)}</div>
                <span class="price-pill ${clsPct(r.change_1d_pct)}" style="font-size:12px">${fmtPct(r.change_1d_pct)}</span>
              </div>
            </div>
            <div class="rcc-stats">
              <span>21d vs SPY: <strong class="${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</strong></span>
              <span>RSI-14: <strong class="${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</strong></span>
              <span ${notableScoreTipAttr(r)}>Score: <strong>${fmtNum(r.notable_score, 1)}</strong> <span class="tip-badge">?</span></span>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    modal.classList.remove("hidden");
    box.querySelector("#closeInfoModalBtn").onclick = closeInfoModal;
    const msel = box.querySelector("#modalSectorSelect");
    if (msel) msel.onchange = () => openSectorModal(msel.value);
    const fsBtn = box.querySelector("#filterScreenerBySecBtn");
    if (fsBtn) {
      fsBtn.onclick = () => {
        closeInfoModal();
        state.activeSector = sector;
        renderScreener();
        setView("screener");
      };
    }
    box.querySelectorAll("[data-sec-open]").forEach((b) => {
      b.onclick = () => { closeInfoModal(); openStock(b.dataset.secOpen); };
    });
  }

  function openMathGuideModal() {
    const modal = $("infoModal");
    const box = $("infoModalBody");
    if (!modal || !box) return;
    box.innerHTML = `
      <div class="modal-card-hdr">
        <div>
          <div class="modal-eyebrow">Quantitative Equity Research Methodology</div>
          <h2 style="font-size:19px">Mathematical Formulations &amp; Score Architecture</h2>
          <div class="muted">Every score on the dashboard uses deterministic, peer-reviewed quantitative finance equations (zero black-box AI). Hover or tap any score badge on any stock for its live plugged-in numbers.</div>
        </div>
        <button class="modal-close-inline" id="closeInfoModalBtn" aria-label="Close">✕</button>
      </div>

      <div class="math-guide-list">
        <div class="math-box">
          <div class="math-title">1. Multi-Factor Technical Composite (S<sub>tech</sub> ∈ [-1, +1]) &amp; Logistic Scenario Probabilities</div>
          <div class="math-eq">
            S<sub>tech</sub> = 0.30 · V<sub>MA</sub> + 0.30 · V<sub>Mom</sub> + 0.25 · V<sub>RS</sub> + 0.15 · V<sub>Pat</sub>
          </div>
          <div class="math-sub">
            • <strong>Moving-Average Regime Factor (V<sub>MA</sub>, weight 30%)</strong>:
              <code>V_MA = 0.4·sgn(C - SMA_200) + 0.3·sgn(C - SMA_50) + 0.3·sgn(SMA_50 - SMA_200)</code> (Weinstein stage trend structure).<br/>
            • <strong>Momentum Factor (V<sub>Mom</sub>, weight 30%)</strong>:
              <code>V_Mom = (1/3)·[sgn(MACD_12,26) + sgn(Hist_9) + clip((RSI_14 - 50)/25, -1, 1)]</code> (Appel MACD + Wilder RSI-14).<br/>
            • <strong>Cross-Sectional Relative Strength Factor (V<sub>RS</sub>, weight 25%)</strong>:
              <code>V_RS = 0.5·[tanh(α_63d,SPY / 0.15) + tanh(α_63d,Sector / 0.15)]</code> (3-month excess return vs S&amp;P 500 &amp; Sector ETF).<br/>
            • <strong>Structural Pattern Factor (V<sub>Pat</sub>, weight 15%)</strong>:
              Volume-confirmed pivot breakout/breakdown (<code>±1.0</code> if RVOL ≥ 1.3x, <code>±0.5</code> otherwise) &amp; regression channel slope.<br/>
            • <strong>Logistic Sigmoid Scenario Partition (P<sub>bull</sub> + P<sub>base</sub> + P<sub>bear</sub> = 100%)</strong>:<br/>
              <code>P_base = clip(0.45 - 0.20·|S_tech| + 0.10·I_range, 0.20, 0.55)</code><br/>
              <code>P_bull = (1 - P_base) / (1 + e^{-3 · S_tech})</code>, &nbsp; <code>P_bear = 1 - P_base - P_bull</code>
          </div>
        </div>

        <div class="math-box">
          <div class="math-title">2. Fractal Pivot &amp; Volume-at-Price (VAP) S/R Confluence Strength (0–100)</div>
          <div class="math-eq">
            Strength(L) = 100 × [ 0.35·(1 - e<sup>-N<sub>w</sub>/3</sup>) + 0.30·VAP(L ± 0.5·ATR<sub>14</sub>) + 0.20·(0.5<sup>Δt/60</sup>) + 0.10·I<sub>MTF</sub> + 0.05·C<sub>round</sub> ]
          </div>
          <div class="math-sub">
            • <strong>Poisson Touch Saturation (35%)</strong>: <code>C_touch = 1 - exp(-N_w / 3)</code> where daily fractal swing pivots weight <code>1.0</code> and weekly fractal pivots weight <code>1.5</code>.<br/>
            • <strong>Volume-Profile Density (30%)</strong>: Normalized 180-day Volume-at-Price (VAP) mass within <code>±0.5·ATR_14</code> divided by the densest price bin (Point of Control).<br/>
            • <strong>Exponential Time-Decay Recency (20%)</strong>: <code>C_recency = 0.5^(Δt / 60 days)</code> (60-trading-day half-life).<br/>
            • <strong>Multi-Timeframe Alignment (10%)</strong>: <code>I_MTF = 1.0</code> if both Daily and Weekly fractal pivots cluster within <code>0.6·ATR_14</code>.<br/>
            • <strong>Psychological Round Number (5%)</strong>: <code>1.0</code> at major powers of 10 (<code>$100, $200, $1000</code>), <code>0.5</code> at half-steps (<code>$50, $150</code>).
          </div>
        </div>

        <div class="math-box">
          <div class="math-title">3. Daily Notable / Catalyst Attention Score (0–100)</div>
          <div class="math-eq">
            S<sub>notable</sub> = 12·min(|r<sub>1d</sub>|/ATR%, 3)·I<sub>z≥1</sub> + 8·(min(RVOL<sub>20</sub>,3)-1)·I<sub>RVOL&gt;1.3</sub> + S<sub>struct</sub> + 6·I<sub>RSI∉[25,75]</sub> + (0.25·I<sub>max</sub> + 1.5·N<sub>24h</sub>) + 8·I<sub>SEC</sub> + 4·I<sub>Form4</sub> + 10·I<sub>Earn≤7d</sub>
          </div>
          <div class="math-sub">
            • <strong>Wilder ATR-Normalized Volatility Z-Score</strong>: <code>z_ATR = |r_1d| / (ATR_14 / Close)</code> measures daily return in units of the stock's own true range (up to 36 pts at 3σ).<br/>
            • <strong>Abnormal Relative Volume (RVOL<sub>20</sub>)</strong>: <code>V_t / SMA_20(V)</code> adds up to 16 pts when volume exceeds 1.3x the 20-day mean.<br/>
            • <strong>Catalysts</strong>: Structural breakouts (+10–15 pts), RSI tail extremes (+6 pts), verified news importance &amp; velocity (up to 32.5 pts), material SEC 8-K/10-Q/10-K (+8 pts), Form 4 open-market insider flow ≥ $1M (+4 pts), and earnings within 7 days (+10 pts).
          </div>
        </div>

        <div class="math-box">
          <div class="math-title">4. Supply-Chain &amp; Ecosystem Network Quantitative Metrics (60d Pearson r &amp; Sensitivity β)</div>
          <div class="math-eq">
            r<sub>60d</sub>(A,B) = Cov<sub>60d</sub>(r<sub>A</sub>, r<sub>B</sub>) / (σ<sub>A</sub> · σ<sub>B</sub>), &nbsp;&nbsp; β<sub>B|A</sub> = Cov<sub>60d</sub>(r<sub>B</sub>, r<sub>A</sub>) / Var<sub>60d</sub>(r<sub>A</sub>)
          </div>
          <div class="math-sub">
            Every supply-chain, customer, and partner edge combines <strong>Fundamental Financial Scale</strong> (annual COGS/CapEx flow $, % of revenue, or MW/GW contracted power capacity) with <strong>Empirical 60-Trading-Day Return Correlation (r<sub>60d</sub>)</strong> and <strong>Co-Movement Sensitivity (β<sub>B|A</sub>)</strong> computed from daily closing prices.
          </div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    box.querySelector("#closeInfoModalBtn").onclick = closeInfoModal;
  }

  function openAppInstallModal() {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt.userChoice.finally(() => { state.deferredInstallPrompt = null; });
      return;
    }
    const modal = $("infoModal");
    const box = $("infoModalBody");
    if (!modal || !box) return;
    const appUrl = "https://esrasekerci.github.io/equity-dashboard/";
    box.innerHTML = `
      <div class="modal-card-hdr">
        <div>
          <div class="modal-eyebrow">Progressive Web App (PWA) &amp; Live URL</div>
          <h2 style="font-size:19px">Where to Access &amp; Install the Equity Research App</h2>
          <div class="muted">Works as a standalone full-screen application on iPhone, iPad, Android, macOS, and Windows.</div>
        </div>
        <button class="modal-close-inline" id="closeInfoModalBtn" aria-label="Close">✕</button>
      </div>

      <div class="math-guide-list">
        <div class="math-box">
          <div class="math-title">Live Web App URL</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
            <code style="padding:7px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--accent-2);flex:1">${esc(appUrl)}</code>
            <button class="btn-secondary" id="copyAppUrlBtn">Copy Link</button>
          </div>
        </div>
        <div class="math-box">
          <div class="math-title">📱 Install on iPhone / iPad (iOS Safari)</div>
          <div class="math-sub">1. Open <strong>${esc(appUrl)}</strong> in Safari.<br/>2. Tap the <strong>Share</strong> icon (square with upward arrow) at the bottom.<br/>3. Tap <strong>Add to Home Screen</strong> → launches full-screen like a native iOS app with the <strong>ER</strong> icon.</div>
        </div>
        <div class="math-box">
          <div class="math-title">🤖 Install on Android (Chrome) &amp; 💻 Desktop (Chrome / Edge / Brave)</div>
          <div class="math-sub">1. Tap the browser menu (<strong>⋮</strong>) on Android or the <strong>Install App</strong> icon in the desktop address bar.<br/>2. Select <strong>Install App / Add to Home Screen</strong>.</div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    box.querySelector("#closeInfoModalBtn").onclick = closeInfoModal;
    const copyBtn = box.querySelector("#copyAppUrlBtn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(appUrl);
        copyBtn.textContent = "✓ Copied!";
      };
    }
  }

  function wireSectorLinks(root = document) {
    root.querySelectorAll(".sector-link[data-sector]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        openSectorModal(el.dataset.sector);
      };
    });
  }

  async function loadDate(dateStr, openTicker = null) {
    $("loadingState").classList.remove("hidden");
    $("errorState").classList.add("hidden");
    try {
      state.date = dateStr;
      state.summary = await fetchJson(`data/${dateStr}/summary.json`);
      $("dateSelect").value = dateStr;
      const rawTs = state.index?.updated_at || state.summary.generated_at || "";
      let updTxt = dateStr;
      if (rawTs) {
        const dt = new Date(rawTs);
        if (!Number.isNaN(dt.getTime())) {
          const pad = (n) => String(n).padStart(2, "0");
          updTxt = `Updated ${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        } else {
          updTxt = `Updated ${rawTs.replace("T", " ").slice(0, 16)}`;
        }
      }
      $("marketCloseBadge").textContent = updTxt;
      $("navTickerCount").textContent = String(state.summary.n_tickers || 0);
      renderOverview();
      renderScreener();
      renderNetworkView();
      renderSmartMoney();
      renderAuthorities();
      renderMacro();
      renderFormulasView();
      $("loadingState").classList.add("hidden");
      if (openTicker) {
        await openStock(openTicker.toUpperCase());
      } else if (state.view === "stock" && state.activeTicker) {
        await openStock(state.activeTicker);
      } else {
        setView(state.view);
      }
    } catch (err) {
      $("loadingState").classList.add("hidden");
      $("errorState").textContent = `Could not load report for ${dateStr}: ${err.message}`;
      $("errorState").classList.remove("hidden");
    }
  }

  // ---- OVERVIEW ----
  function renderOverview() {
    const s = state.summary;
    const hm = s.heatmap || {};
    const br = s.breadth || {};
    const mp = (s.alerts && s.alerts.macro_pulse) || {};

    // Breaking news banner
    const banner = $("breakingBanner");
    if (state.breaking.length > 0) {
      const latest = state.breaking[0];
      banner.innerHTML = `
        <div class="breaking-banner-body">
          <span class="breaking-tag">Breaking</span>
          <span class="breaking-headline"><strong>${esc(latest.symbol)}</strong> · ${esc(latest.title)}</span>
          <div class="muted" style="margin-top:3px">${esc(latest.source || "")} · ${state.breaking.length} alerts</div>
        </div>
        <span class="breaking-arrow">›</span>
      `;
      banner.classList.remove("hidden");
      banner.onclick = () => setView("breaking");
    } else {
      banner.classList.add("hidden");
    }

    // KPI Strip
    const adv = br.advancers ?? 0;
    const dec = br.decliners ?? 0;
    const tot = Math.max(1, adv + dec);
    const advPct = Math.round((adv / tot) * 100);
    const fomcDays = mp.fomc && mp.fomc.days_to_decision != null ? `${mp.fomc.days_to_decision}d` : "—";
    const fomcNext = mp.fomc && mp.fomc.next_meeting ? mp.fomc.next_meeting[1] : "";

    const kpis = [
      { label: "SPY (1D)", val: fmtPct(hm.spy_ret_1d), cls: clsPct(hm.spy_ret_1d), sub: `21D: ${fmtPct(hm.spy_ret_21d)}` },
      {
        label: "Breadth",
        tip: "breadth",
        val: `${adv}↑ / ${dec}↓`,
        cls: clsPct(br.avg_ret_1d),
        sub: `Avg 1D: ${fmtPct(br.avg_ret_1d)}`,
        extra: `<div class="breadth-bar"><div class="breadth-up" style="width:${advPct}%"></div><div class="breadth-dn" style="width:${100 - advPct}%"></div></div>`,
      },
      { label: "US 10Y", tip: "dgs10", val: mp.dgs10 ? `${fmtNum(mp.dgs10.latest, 2)}%` : "—", cls: "", sub: mp.dgs10 ? `1W: ${fmtNum(mp.dgs10.change_1w, 2)}pp` : "FRED" },
      { label: "VIX", tip: "vix", val: mp.vix ? fmtNum(mp.vix.latest, 1) : "—", cls: mp.vix && mp.vix.latest >= 20 ? "warn" : "", sub: mp.vix ? `1W: ${fmtNum(mp.vix.change_1w, 1)}` : "FRED" },
      { label: "WTI Oil", val: mp.wti ? `$${fmtNum(mp.wti.latest, 1)}` : "—", cls: "", sub: mp.wti ? `1M: ${fmtNum(mp.wti.change_1m, 1)}` : "FRED" },
      { label: "Next FOMC", tip: "fomc", val: fomcDays, cls: "", sub: fomcNext ? fomcNext : "Fed calendar" },
    ];
    $("kpiStrip").innerHTML = kpis.map((k) => `
      <div class="kpi-card">
        <div class="kpi-label" ${k.tip ? tipAttr(k.tip) : ""}>${esc(k.label)}${k.tip ? '<span class="tip-badge">?</span>' : ""}</div>
        <div class="kpi-val ${k.cls}">${esc(k.val)}</div>
        <div class="kpi-sub">${esc(k.sub)}</div>
        ${k.extra || ""}
      </div>
    `).join("");

    // Alerts Radar
    const al = s.alerts || {};
    const patternsAll = [
      ...(al.breakouts || []).map((x) => ({ ...x, dir: "bull" })),
      ...(al.breakdowns || []).map((x) => ({ ...x, dir: "bear" })),
    ];
    const INITIAL_SHOW = 6;
    const alertsHtml = [
      {
        title: "Patterns & Breakouts",
        count: patternsAll.length,
        items: patternsAll.map((p, idx) => `<span class="ticker-pill${idx >= INITIAL_SHOW ? " alert-extra-pill hidden" : ""}" data-sym="${esc(p.symbol)}"><strong>${esc(p.symbol)}</strong><span class="${p.dir === "bull" ? "pos" : "neg"}">${esc(p.kind)}</span></span>`),
        empty: "No active pattern signals",
      },
      {
        title: "Earnings Window (±10d)",
        count: (al.earnings_soon || []).length,
        items: (al.earnings_soon || []).map((e, idx) => {
          const row = (s.tickers || []).find((t) => t.symbol === e.symbol) || {};
          const eUrl = secHtmlUrl(row.earnings_url || `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(e.symbol)}`);
          return `<a class="ticker-pill${idx >= INITIAL_SHOW ? " alert-extra-pill hidden" : ""}" href="${esc(eUrl)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><strong>${esc(e.symbol)}</strong><span class="warn">${e.days >= 0 ? `in ${e.days}d` : `${Math.abs(e.days)}d ago`} ↗</span></a>`;
        }),
        empty: "No watchlist earnings within ±10d",
      },
      {
        title: "Extreme RSI (<30 / >70)",
        count: (al.oversold || []).length + (al.overbought || []).length,
        items: [
          ...(al.oversold || []).map((x) => ({ symbol: x.symbol, rsi14: x.rsi14, cls: "neg" })),
          ...(al.overbought || []).map((x) => ({ symbol: x.symbol, rsi14: x.rsi14, cls: "pos" })),
        ].map((x, idx) => `<span class="ticker-pill${idx >= INITIAL_SHOW ? " alert-extra-pill hidden" : ""}" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong><span class="${x.cls}">${x.rsi14}</span></span>`),
        empty: "All tickers neutral (30–70)",
      },
      {
        title: "Form 4 Insider Buys",
        count: (al.insider_buys || []).length,
        items: (al.insider_buys || []).map((x, idx) => `<span class="ticker-pill${idx >= INITIAL_SHOW ? " alert-extra-pill hidden" : ""}" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong><span class="pos">${x.buys} buy${x.buys > 1 ? "s" : ""}</span></span>`),
        empty: "No open-market Form 4 buys",
      },
    ];
    $("alertsSection").innerHTML = alertsHtml.map((c) => {
      const extra = Math.max(0, c.items.length - INITIAL_SHOW);
      const moreBtn = extra > 0
        ? `<button type="button" class="ticker-pill alert-more-btn" data-more="${extra}" aria-expanded="false">+${extra} more ▾</button>`
        : "";
      return `
      <div class="alert-card${extra > 0 ? " has-more" : ""}">
        <div class="alert-title"${extra > 0 ? ' role="button" tabindex="0" style="cursor:pointer"' : ""}><span>${esc(c.title)}</span><span class="alert-count">${c.count}</span></div>
        <div class="alert-pills">${c.items.length ? c.items.join("") + moreBtn : `<span class="muted">${c.empty}</span>`}</div>
      </div>
    `;
    }).join("");
    const toggleAlertCard = (card) => {
      const btn = card && card.querySelector(".alert-more-btn");
      if (!btn) return;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      card.querySelectorAll(".alert-extra-pill").forEach((p) => {
        p.classList.toggle("hidden", !nextExpanded);
        p.style.display = nextExpanded ? "inline-flex" : "none";
      });
      btn.setAttribute("aria-expanded", String(nextExpanded));
      btn.textContent = nextExpanded ? "Show less ▴" : `+${btn.dataset.more} more ▾`;
    };
    $("alertsSection").onclick = (ev) => {
      const moreBtn = ev.target.closest(".alert-more-btn");
      if (moreBtn) {
        ev.preventDefault();
        toggleAlertCard(moreBtn.closest(".alert-card"));
        return;
      }
      const titleEl = ev.target.closest(".alert-card.has-more .alert-title");
      if (titleEl) {
        toggleAlertCard(titleEl.closest(".alert-card"));
        return;
      }
      const pill = ev.target.closest(".ticker-pill[data-sym]");
      if (pill) {
        openStock(pill.dataset.sym);
      }
    };

    // Earnings Calendar (Upcoming & Recently Reported across all 39 stocks)
    const ecGrid = $("earningsCalendarGrid");
    if (ecGrid) {
      const allT = s.tickers || [];
      const upcoming = allT
        .filter((t) => t.earnings_date && t.earnings_days != null && t.earnings_days >= 0)
        .sort((a, b) => a.earnings_days - b.earnings_days);
      const recent = allT
        .filter((t) => t.earnings_date && t.earnings_days != null && t.earnings_days < 0 && t.earnings_days >= -14)
        .sort((a, b) => b.earnings_days - a.earnings_days);

      const renderEarnRow = (t) => {
        const d = t.earnings_days;
        const badgeTxt = d === 0 ? "TODAY" : d === 1 ? "Tomorrow" : d > 1 ? `in ${d}d` : `${Math.abs(d)}d ago`;
        const badgeCls = d >= 0 && d <= 7 ? "amber" : "";
        const officialUrl = secHtmlUrl(t.earnings_url || `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t.symbol)}`);
        const srcLabel = t.earnings_source || "Official";
        return `
          <a class="level-row" href="${esc(officialUrl)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
            <div>
              <strong>${esc(t.symbol)}</strong>
              <span class="muted" style="margin-left:6px">${esc(t.name)}</span>
              <span class="muted" style="margin-left:6px;font-size:11px;color:var(--accent-2)">${esc(srcLabel)} ↗</span>
            </div>
            <div style="text-align:right">
              <span class="tag ${badgeCls}">${esc(badgeTxt)}</span>
              <span class="muted" style="margin-left:6px;font-variant-numeric:tabular-nums">${esc(t.earnings_date)}</span>
            </div>
          </a>`;
      };

      ecGrid.innerHTML = `
        <div class="panel">
          <h3>Upcoming Quarterly Earnings (${upcoming.length})</h3>
          <div class="level-list">
            ${upcoming.length ? upcoming.slice(0, 10).map(renderEarnRow).join("") : `<div class="muted">No upcoming earnings dates scheduled yet.</div>`}
          </div>
        </div>
        <div class="panel">
          <h3>Recently Reported (Last 14 Days · ${recent.length})</h3>
          <div class="level-list">
            ${recent.length ? recent.slice(0, 10).map(renderEarnRow).join("") : `<div class="muted">No earnings reported in the last 14 days.</div>`}
          </div>
        </div>
      `;
    }

    // Sector Heatmap (clicking any sector opens the clean Sector Explorer modal)
    const sectors = hm.sectors || [];
    $("sectorHeatmap").innerHTML = sectors.map((sec) => {
      const r = sec.avg_ret_1d != null ? sec.avg_ret_1d : sec.etf_ret_1d;
      const intensity = Math.min(0.28, Math.max(0.08, Math.abs(r || 0) / 28));
      const bg = r > 0 ? `rgba(34, 197, 94, ${intensity})` : r < 0 ? `rgba(244, 63, 94, ${intensity})` : "var(--bg-card)";
      return `
        <div class="heat-tile" data-sector="${esc(sec.sector)}" style="background:${bg}">
          <div class="heat-top">
            <span class="heat-name">${esc(fmtSector(sec.sector))}</span>
            <span class="heat-etf">${esc(sec.etf)}</span>
          </div>
          <div class="heat-ret ${clsPct(r)}">${fmtPct(r)}</div>
          <div class="muted">ETF ${fmtPct(sec.etf_ret_1d, 1)}</div>
        </div>
      `;
    }).join("");
    $("sectorHeatmap").querySelectorAll(".heat-tile").forEach((el) => {
      el.onclick = () => openSectorModal(el.dataset.sector);
    });

    // Notable Movers
    const bySym = Object.fromEntries((s.tickers || []).map((t) => [t.symbol, t]));
    $("notableGrid").innerHTML = (s.notable || []).slice(0, 6).map((n) => {
      const row = bySym[n.symbol] || {};
      return `
        <div class="notable-card" data-sym="${esc(n.symbol)}">
          <div class="notable-top">
            <div>
              <div class="notable-sym">${esc(n.symbol)}${row.is_core ? ' <span class="core-star">★</span>' : ""} <span class="tag sector-link" data-sector="${esc(row.sector)}">${esc(fmtSector(row.sector))}</span></div>
              <div class="notable-name">${esc(row.name || "")}</div>
            </div>
            <div style="text-align:right">
              <div class="price-pill ${clsPct(row.change_1d_pct)}">$${fmtNum(row.close)} · ${fmtPct(row.change_1d_pct, 1)}</div>
              <div style="margin-top:4px"><span class="score-badge" ${notableScoreTipAttr(row)}>Score ${fmtNum(n.score, 0)} <span class="tip-badge">?</span></span></div>
            </div>
          </div>
          <ul class="notable-why">${(n.why || []).slice(0, 2).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
        </div>
      `;
    }).join("");
    $("notableGrid").querySelectorAll(".notable-card").forEach((el) => {
      el.onclick = () => openStock(el.dataset.sym);
    });
    wireSectorLinks($("notableGrid"));
  }

  // ---- SCREENER (Desktop Table + Mobile Cards) ----
  function getFilteredRows() {
    const s = state.summary;
    if (!s) return [];
    let rows = [...(s.tickers || [])];

    if (state.activeSector) {
      rows = rows.filter((r) => r.sector === state.activeSector);
      $("clearSectorChip")?.classList.remove("hidden");
      if ($("activeSectorLabel")) $("activeSectorLabel").textContent = fmtSector(state.activeSector);
    } else {
      $("clearSectorChip")?.classList.add("hidden");
    }

    if (state.filter === "core") rows = rows.filter((r) => r.is_core);
    else if (state.filter === "signals") rows = rows.filter((r) => (r.patterns || []).length > 0);
    else if (state.filter === "earnings") rows = rows.filter((r) => r.earnings_days != null && Math.abs(r.earnings_days) <= 10);
    else if (state.filter === "oversold") rows = rows.filter((r) => r.rsi14 != null && r.rsi14 < 30);
    else if (state.filter === "overbought") rows = rows.filter((r) => r.rsi14 != null && r.rsi14 > 70);
    else if (state.filter === "bullish") rows = rows.filter((r) => (r.scenarios?.bullish || 0) >= (r.scenarios?.bearish || 0) + 10);
    else if (state.filter === "bearish") rows = rows.filter((r) => (r.scenarios?.bearish || 0) >= (r.scenarios?.bullish || 0) + 10);

    const k = state.sortKey;
    const dir = state.sortDir;
    rows.sort((a, b) => {
      let va = k === "s1_dist" ? (a.s1?.distance_pct ?? -999) : a[k];
      let vb = k === "s1_dist" ? (b.s1?.distance_pct ?? -999) : b[k];
      if (va == null) va = dir > 0 ? 1e18 : -1e18;
      if (vb == null) vb = dir > 0 ? 1e18 : -1e18;
      if (typeof va === "string") return va.localeCompare(String(vb)) * dir;
      return (va - vb) * dir;
    });
    return rows;
  }

  function renderScreener() {
    const s = state.summary;
    if (!s) return;

    // Populate clean Sector <select> dropdown menu
    const ssel = $("sectorSelect");
    if (ssel) {
      const counts = {};
      for (const t of s.tickers || []) counts[t.sector] = (counts[t.sector] || 0) + 1;
      const secs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      ssel.innerHTML = [
        `<option value="">All Sectors</option>`,
        ...secs.map((sec) => `<option value="${esc(sec)}" ${state.activeSector === sec ? "selected" : ""}>${esc(fmtSector(sec))}</option>`),
      ].join("");
    }

    const rows = getFilteredRows();
    $("screenerCount").textContent = `(${rows.length}/${(s.tickers || []).length})`;

    document.querySelectorAll("#screenerTable th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === state.sortKey);
    });

    // Desktop table rows
    $("screenerBody").innerHTML = rows.map((r) => {
      const sma = [[20, r.above_sma20], [50, r.above_sma50], [200, r.above_sma200]]
        .map(([p, up]) => `<span class="sma-dot ${up ? "up" : "dn"}">${p}</span>`).join("");
      const sc = r.scenarios || { bullish: 0, base: 0, bearish: 0 };
      const s1Txt = r.s1 ? `S ${fmtPct(r.s1.distance_pct, 1)}` : "—";
      const r1Txt = r.r1 ? `R ${fmtPct(r.r1.distance_pct, 1)}` : "—";
      const earnTxt = r.earnings_days == null ? "—" : r.earnings_days >= 0 ? `in ${r.earnings_days}d` : `${Math.abs(r.earnings_days)}d ago`;

      return `
        <tr data-sym="${esc(r.symbol)}">
          <td>
            <strong>${esc(r.symbol)}</strong>${r.is_core ? ' <span class="core-star">★</span>' : ""}
            <div class="muted">${esc(r.name)}</div>
          </td>
          <td><span class="tag sector-link" data-sector="${esc(r.sector)}">${esc(fmtSector(r.sector))}</span></td>
          <td class="num"><strong>$${fmtNum(r.close)}</strong></td>
          <td class="num ${clsPct(r.change_1d_pct)}"><strong>${fmtPct(r.change_1d_pct)}</strong></td>
          <td class="num"><span class="score-badge" ${notableScoreTipAttr(r)}>${fmtNum(r.notable_score, 1)}</span></td>
          <td class="num ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</td>
          <td><div class="sma-dots">${sma}</div></td>
          <td class="num ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</td>
          <td class="num"><span class="muted">${s1Txt} / ${r1Txt}</span></td>
          <td ${techScenarioTipAttr(r.tech_score, r.tech_components, sc)}>
            <div class="prob-bar">
              <div class="prob-bull" style="width:${sc.bullish}%"></div>
              <div class="prob-base" style="width:${sc.base}%"></div>
              <div class="prob-bear" style="width:${sc.bearish}%"></div>
            </div>
            <div class="prob-labels">${sc.bullish}/${sc.base}/${sc.bearish}%</div>
          </td>
          <td class="num"><span class="${r.earnings_days != null && Math.abs(r.earnings_days) <= 7 ? "warn" : "muted"}">${earnTxt}</span></td>
        </tr>
      `;
    }).join("");
    $("screenerBody").querySelectorAll("tr").forEach((tr) => {
      tr.onclick = () => openStock(tr.dataset.sym);
    });
    wireSectorLinks($("screenerBody"));

    // Mobile cards
    $("screenerCards").innerHTML = rows.length ? rows.map((r) => {
      const sma = [[20, r.above_sma20], [50, r.above_sma50], [200, r.above_sma200]]
        .map(([p, up]) => `<span class="sma-dot ${up ? "up" : "dn"}">${p}</span>`).join("");
      const sc = r.scenarios || { bullish: 0, base: 0, bearish: 0 };
      const earnChip = r.earnings_days != null && Math.abs(r.earnings_days) <= 10
        ? `<span class="tag amber">Earn ${r.earnings_days >= 0 ? `in ${r.earnings_days}d` : `${Math.abs(r.earnings_days)}d ago`}</span>` : "";
      const s1r1 = `${r.s1 ? `S1 ${fmtPct(r.s1.distance_pct, 1)}` : ""} ${r.r1 ? `· R1 ${fmtPct(r.r1.distance_pct, 1)}` : ""}`.trim();

      return `
        <div class="stock-card" data-sym="${esc(r.symbol)}">
          <div class="sc-top">
            <div style="min-width:0">
              <div class="sc-sym-row">
                <span class="sc-sym">${esc(r.symbol)}</span>
                ${r.is_core ? '<span class="core-star">★</span>' : ""}
                <span class="tag sector-link" data-sector="${esc(r.sector)}">${esc(fmtSector(r.sector))}</span>
              </div>
              <div class="muted" style="margin-top:2px">${esc(r.name)}</div>
            </div>
            <div class="sc-price-col">
              <div class="sc-price">$${fmtNum(r.close)}</div>
              <span class="price-pill ${clsPct(r.change_1d_pct)}" style="margin-top:3px;font-size:12px">${fmtPct(r.change_1d_pct)}</span>
            </div>
          </div>

          <div class="sc-metrics">
            <div><div class="sc-m-k" ${notableScoreTipAttr(r)}>Score ?</div><div class="sc-m-v">${fmtNum(r.notable_score, 0)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("rsi14")}>RSI-14 ?</div><div class="sc-m-v ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("rs_spy")}>vs SPY ?</div><div class="sc-m-v ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("sma")}>Trend ?</div><div class="sc-m-v"><div class="sma-dots">${sma}</div></div></div>
          </div>

          <div class="sc-bottom">
            <div ${techScenarioTipAttr(r.tech_score, r.tech_components, sc)}>
              <div class="prob-bar">
                <div class="prob-bull" style="width:${sc.bullish}%"></div>
                <div class="prob-base" style="width:${sc.base}%"></div>
                <div class="prob-bear" style="width:${sc.bearish}%"></div>
              </div>
              <div class="prob-labels">Bull ${sc.bullish}% · Base ${sc.base}% · Bear ${sc.bearish}%</div>
            </div>
            <div style="text-align:right">
              ${earnChip || `<span class="muted" ${tipAttr("sr_levels")}>${esc(s1r1)}</span>`}
            </div>
          </div>
        </div>
      `;
    }).join("") : `<div class="panel muted">No stocks match the active filter.</div>`;

    $("screenerCards").querySelectorAll(".stock-card").forEach((card) => {
      card.onclick = () => openStock(card.dataset.sym);
    });
    wireSectorLinks($("screenerCards"));
  }

  // ---- DYNAMIC SUPPLY-CHAIN & VALUE-CHAIN BUBBLE NETWORK (Zoom/Pan + Instant Detail Inspector) ----
  const REL_COLORS = {
    supplier: { stroke: "#22c55e", badge: "bull", label: "Upstream Supplier", short: "Supplier", flow: "in" },
    customer: { stroke: "#3b82f6", badge: "amber", label: "Downstream Customer", short: "Customer", flow: "out" },
    partner: { stroke: "#a855f7", badge: "", label: "Infra / Ecosystem Partner", short: "Partner", flow: "bi" },
    competitor: { stroke: "#f43f5e", badge: "bear", label: "Direct Competitor", short: "Competitor", flow: "none" },
    co_mention: { stroke: "#f59e0b", badge: "amber", label: "News Co-Mention", short: "Co-Mention", flow: "none" },
    peer: { stroke: "#64748b", badge: "", label: "Sector Peer", short: "Peer", flow: "none" },
  };

  function capRadius(mcap) {
    if (!mcap || mcap <= 0) return 29;
    const logB = Math.log10(Math.max(1, mcap / 1e9)); // 0 for $1B, 3.5 for $3.1T
    return Math.round(Math.max(27, Math.min(44, 27 + logB * 4.8)));
  }

  function computeCollisionFreeLayout(items) {
    // Group clockwise by role so Partners sit Top, Customers Right, Competitors Bottom, Suppliers Left,
    // then run 45 iterations of 2D circle-repulsion relaxation so zero bubbles or labels ever overlap.
    const roleOrder = { partner: 0, customer: 1, competitor: 2, co_mention: 3, peer: 4, supplier: 5 };
    const sorted = [...items].sort((a, b) => (roleOrder[a.type] ?? 4) - (roleOrder[b.type] ?? 4));
    const total = Math.max(1, sorted.length);
    const nodes = sorted.map((item, idx) => {
      const r = capRadius(item.market_cap);
      const ring = total <= 7 ? 175 : (idx % 2 === 0 ? 158 : 232);
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      return {
        ...item,
        x: Math.cos(angle) * ring * 1.12,
        y: Math.sin(angle) * ring,
        r,
      };
    });

    const centerR = 54;
    for (let iter = 0; iter < 45; iter++) {
      // 1. Keep minimum distance from center hub (0, 0)
      for (const n of nodes) {
        const dist = Math.hypot(n.x, n.y) || 1;
        const minC = centerR + n.r + 58;
        if (dist < minC) {
          const push = (minC - dist) * 0.65;
          n.x += (n.x / dist) * push;
          n.y += (n.y / dist) * push;
        }
      }
      // 2. Pairwise bubble-to-bubble repulsion (guarantees >= 30px air gap between every pair of bubbles)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.1;
          const minD = a.r + b.r + 30;
          if (dist < minD) {
            const push = ((minD - dist) / 2) * 0.65;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
    }

    return nodes.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y) }));
  }

  function renderBubbleNetwork(container, centerSym, filterKey, onRecenter, opts = {}) {
    if (!container || !state.summary) return;
    const net = state.summary.network || {};
    const linksMap = net.links_by_symbol || {};
    const allTickers = [...(state.summary.tickers || [])].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    const bySym = Object.fromEntries(allTickers.map((t) => [t.symbol, t]));
    const center = bySym[centerSym] || allTickers[0];
    if (!center) return;

    const historyArr = opts.history || [center.symbol];
    const lastEdge = opts.lastEdge || null;

    const allLinks = linksMap[center.symbol] || [];
    const nonPeer = allLinks.filter((x) => x.type !== "peer");
    let shown = filterKey === "all"
      ? (nonPeer.length >= 4 ? [...nonPeer, ...allLinks.filter((x) => x.type === "peer").slice(0, 3)] : allLinks)
      : allLinks.filter((x) => x.type === filterKey);
    shown = shown.slice(0, 14);

    const counts = { all: allLinks.length };
    for (const l of allLinks) counts[l.type] = (counts[l.type] || 0) + 1;
    const filterTabs = [
      ["all", "All Value-Chain"],
      ["supplier", "◄ Suppliers"],
      ["customer", "Customers ►"],
      ["partner", "▲ Partners"],
      ["competitor", "▼ Competitors"],
      ["co_mention", "News Co-Mentions"],
      ["peer", "Sector Peers"],
    ].filter(([k]) => k === "all" || counts[k] > 0);

    const nodesPos = computeCollisionFreeLayout(shown);
    let selectedIdx = 0;
    if (lastEdge) {
      const found = nodesPos.findIndex((x) => x.symbol === lastEdge.from);
      if (found !== -1) selectedIdx = found;
    }

    // Tight world bounding box around (0, 0) + all orbiting bubbles so zero empty black space appears on mobile or desktop
    let minX = -90, maxX = 90, minY = -90, maxY = 90;
    for (const n of nodesPos) {
      minX = Math.min(minX, n.x - n.r - 28);
      maxX = Math.max(maxX, n.x + n.r + 28);
      minY = Math.min(minY, n.y - n.r - 28);
      maxY = Math.max(maxY, n.y + n.r + 28);
    }
    const baseW = Math.max(420, maxX - minX);
    const baseH = Math.max(400, maxY - minY);
    const baseCX = (minX + maxX) / 2;
    const baseCY = (minY + maxY) / 2;

    // Subtle inter-neighbor cross-links
    const posBySym = Object.fromEntries(nodesPos.map((n) => [n.symbol, n]));
    const crossEdgesSvg = [];
    const seenCross = new Set();
    for (const n of nodesPos) {
      for (const l of (linksMap[n.symbol] || [])) {
        if (l.type === "peer" || !posBySym[l.symbol]) continue;
        const pairKey = [n.symbol, l.symbol].sort().join(":");
        if (seenCross.has(pairKey)) continue;
        seenCross.add(pairKey);
        const m = posBySym[l.symbol];
        crossEdgesSvg.push(
          `<path d="M ${n.x} ${n.y} Q 0 0 ${m.x} ${m.y}" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="1.1" stroke-dasharray="3 4" />`
        );
      }
    }

    // Primary edges with compact non-overlapping midpoint badges + animated directional flow particles
    const edgesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const mx = Math.round(n.x * 0.52);
      const my = Math.round(n.y * 0.52);
      const rawScale = n.scale || rc.short;
      const shortScale = rawScale.split("·")[0].trim();
      const pillTxt = shortScale.length > 14 ? shortScale.slice(0, 13) + "…" : shortScale;
      const pillW = Math.max(48, Math.min(104, pillTxt.length * 5.8 + 12));
      const dPath = rc.flow === "in" ? `M ${n.x} ${n.y} L 0 0` : `M 0 0 L ${n.x} ${n.y}`;
      const showParticle = rc.flow === "in" || rc.flow === "out" || rc.flow === "bi";

      return `
        <g class="bubble-edge" data-idx="${i}">
          <path class="edge-line" d="${dPath}" fill="none" stroke="${rc.stroke}" stroke-width="${n.type === "peer" ? 1.5 : 2.6}" stroke-opacity="0.65" ${n.type === "peer" || n.type === "competitor" ? 'stroke-dasharray="5 4"' : ""} />
          ${showParticle ? `
            <circle r="3.4" fill="${rc.stroke}">
              <animateMotion dur="${2.2 + (i % 4) * 0.4}s" repeatCount="indefinite" path="${dPath}" />
            </circle>` : ""}
          <g class="edge-badge" data-idx="${i}" style="cursor:pointer">
            <rect x="${mx - pillW / 2}" y="${my - 8}" width="${pillW}" height="16" rx="6" fill="var(--bg-elev)" stroke="${rc.stroke}" stroke-width="1.2" stroke-opacity="0.85" />
            <text x="${mx}" y="${my + 3}" text-anchor="middle" fill="var(--text)" font-size="8.8" font-weight="800">${esc(pillTxt)}</text>
          </g>
        </g>`;
    }).join("");

    // Orbiting bubbles (sized by Market Cap, printing Symbol + Market Cap + 1D % cleanly inside)
    const nodesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const chg = n.change_1d_pct;
      const fill = chg > 0 ? "rgba(34, 197, 94, 0.25)" : chg < 0 ? "rgba(244, 63, 94, 0.25)" : "rgba(59, 130, 246, 0.22)";
      const capTxt = fmtCap(n.market_cap);
      return `
        <g class="bubble-node orbit-bubble" data-idx="${i}" data-sym="${esc(n.symbol)}">
          <circle class="sel-ring" cx="${n.x}" cy="${n.y}" r="${n.r + 6}" fill="none" stroke="var(--accent-2)" stroke-width="2.5" stroke-dasharray="4 3" opacity="0" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r + 3}" fill="none" stroke="${rc.stroke}" stroke-width="1.4" stroke-opacity="0.38" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="var(--bg-card)" stroke="${rc.stroke}" stroke-width="2.6" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}" />
          <text x="${n.x}" y="${n.y - 7}" text-anchor="middle" fill="var(--text)" font-size="12" font-weight="900">${esc(n.symbol)}</text>
          <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="var(--text-soft)" font-size="9" font-weight="700">${esc(capTxt)}</text>
          <text x="${n.x}" y="${n.y + 15}" text-anchor="middle" fill="${chg >= 0 ? "var(--green)" : "var(--red)"}" font-size="9.5" font-weight="800">${fmtPct(chg, 1)}</text>
        </g>`;
    }).join("");

    const cChg = center.change_1d_pct;
    const centerSvg = `
      <g class="bubble-node center-bubble" data-sym="${esc(center.symbol)}">
        <circle cx="0" cy="0" r="56" fill="rgba(59, 130, 246, 0.18)" stroke="var(--accent)" stroke-width="1.8" stroke-dasharray="5 3" />
        <circle cx="0" cy="0" r="48" fill="var(--bg-elev)" stroke="var(--accent)" stroke-width="3.2" />
        <text x="0" y="-13" text-anchor="middle" fill="var(--text)" font-size="15.5" font-weight="900">${esc(center.symbol)}</text>
        <text x="0" y="1" text-anchor="middle" fill="var(--accent-2)" font-size="9.8" font-weight="800">${esc(fmtCap(center.market_cap))}</text>
        <text x="0" y="13" text-anchor="middle" fill="var(--text-soft)" font-size="10" font-weight="700">$${fmtNum(center.close)}</text>
        <text x="0" y="25" text-anchor="middle" fill="${cChg >= 0 ? "var(--green)" : "var(--red)"}" font-size="10.2" font-weight="800">${fmtPct(cChg, 1)}</text>
      </g>`;

    container.innerHTML = `
      <div class="bubble-card" id="bubbleCardRoot">
        <div class="bubble-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong class="touch-name-link" data-open-stock="${esc(center.symbol)}" style="font-size:16.5px">${esc(center.symbol)} · ${esc(center.name)} (${fmtCap(center.market_cap)}) ↗</strong>
            <span class="tag sector-link" data-sector="${esc(center.sector)}">${esc(fmtSector(center.sector))}</span>
          </div>
          <div class="screener-controls">
            <div class="control-group">
              <label class="muted">Hub</label>
              <select class="select-control compact" id="bubbleHubSelect">
                ${allTickers.map((t) => `<option value="${esc(t.symbol)}" ${t.symbol === center.symbol ? "selected" : ""}>${esc(t.symbol)} (${fmtCap(t.market_cap)})</option>`).join("")}
              </select>
            </div>
          </div>
        </div>

        <div class="bubble-legend" id="bubbleLegendFilter">
          <button type="button" class="legend-chip ${filterKey === "all" ? "active" : ""}" data-rel-filter="all">All</button>
          ${[
            ["supplier", "Supplier", "#22c55e"],
            ["partner", "Partner", "#a855f7"],
            ["customer", "Customer", "#3b82f6"],
            ["competitor", "Competitor", "#f43f5e"],
            ["co_mention", "Co-Mention", "#f59e0b"],
            ["peer", "Peer", "#64748b"],
          ].filter(([k]) => counts[k] > 0).map(([k, lbl, col]) => `
            <button type="button" class="legend-chip ${filterKey === k ? "active" : ""}" data-rel-filter="${k}">
              <i class="legend-dot" style="background:${col}"></i>${lbl}
            </button>`).join("")}
        </div>

        <div class="bubble-stage" id="bubbleStage">
          <div class="bubble-zoom-bar">
            <button type="button" class="zoom-btn" id="bZoomInBtn" title="Zoom In">+</button>
            <button type="button" class="zoom-btn" id="bZoomOutBtn" title="Zoom Out">−</button>
            <button type="button" class="zoom-btn reset" id="bZoomResetBtn" title="Reset Zoom">100%</button>
          </div>
          <svg class="bubble-svg" id="bubbleSvg" viewBox="${baseCX - baseW / 2} ${baseCY - baseH / 2} ${baseW} ${baseH}" preserveAspectRatio="xMidYMid meet">
            ${crossEdgesSvg.join("")}
            ${edgesSvg}
            ${nodesSvg}
            ${centerSvg}
          </svg>
        </div>

        <div class="filter-bar-scroll" style="margin:10px 0 6px;padding:0">
          <div class="filter-bar" id="bubbleQuickSelectBar">
            ${nodesPos.map((item, idx) => {
              const rc = REL_COLORS[item.type] || REL_COLORS.peer;
              return `<button type="button" class="chip" data-qsel="${idx}"><i class="legend-dot" style="background:${rc.stroke}"></i><strong>${esc(item.symbol)}</strong> <span class="muted">${esc((item.scale || rc.short).split("·")[0].trim())}</span></button>`;
            }).join("")}
          </div>
        </div>

        <div class="bubble-inspector" id="bubbleInspectorCard"></div>
      </div>
    `;

    wireSectorLinks(container);
    container.querySelectorAll("[data-open-stock]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (state.networkFullscreen) {
          state.networkFullscreen = false;
          document.body.classList.remove("no-scroll");
        }
        openStock(btn.dataset.openStock);
      };
    });

    const toggleFullBtn = container.querySelector("#toggleFullNetBtn");
    if (toggleFullBtn) {
      toggleFullBtn.onclick = (e) => {
        e.stopPropagation();
        state.networkFullscreen = !state.networkFullscreen;
        document.body.classList.toggle("no-scroll", state.networkFullscreen);
        if (opts.embeddedInStock && state.networkFullscreen) {
          state.networkCenter = center.symbol;
          state.networkFilter = filterKey;
          setView("network");
          renderNetworkView();
        } else {
          onRecenter(center.symbol, filterKey, null);
        }
      };
    }

    const closeNetBtn = container.querySelector("#closeNetViewBtn");
    if (closeNetBtn) {
      closeNetBtn.onclick = (e) => {
        e.stopPropagation();
        state.networkFullscreen = false;
        document.body.classList.remove("no-scroll");
        const target = state.prevView && state.prevView !== "network" ? state.prevView : "overview";
        setView(target);
      };
    }

    const hubSel = container.querySelector("#bubbleHubSelect");
    if (hubSel) {
      hubSel.onchange = () => onRecenter(hubSel.value, "all", null);
    }
    container.querySelectorAll("#bubbleLegendFilter [data-rel-filter]").forEach((btn) => {
      btn.onclick = () => {
        const nextFilter = btn.dataset.relFilter === filterKey ? "all" : btn.dataset.relFilter;
        onRecenter(center.symbol, nextFilter, null);
      };
    });
    container.querySelectorAll("[data-hop-sym]").forEach((b) => {
      b.onclick = () => onRecenter(b.dataset.hopSym, "all", null);
    });

    const recenterOnItem = (item) => {
      if (!item) return;
      onRecenter(item.symbol, "all", {
        from: center.symbol,
        to: item.symbol,
        type: item.type,
        scale: item.scale,
        note: item.note,
        corr_60d: item.corr_60d,
        beta_60d: item.beta_60d,
      });
    };

    // Interactive SVG Zoom & Pan Engine (supports + / - / Reset buttons, 1-finger drag pan, 2-finger pinch zoom & mouse wheel)
    const stage = container.querySelector("#bubbleStage");
    const svg = container.querySelector("#bubbleSvg");
    const resetBtn = container.querySelector("#bZoomResetBtn");
    const viewState = { zoom: window.innerWidth <= 640 ? 1.12 : 1.0, panX: 0, panY: 0 };

    const updateViewBox = () => {
      if (!svg || !stage) return;
      const rect = stage.getBoundingClientRect();
      const stageAR = rect.width > 50 && rect.height > 50 ? rect.width / rect.height : 1.15;
      let fitW = baseW;
      let fitH = baseH;
      if (fitW / fitH > stageAR) {
        fitH = fitW / stageAR;
      } else {
        fitW = fitH * stageAR;
      }
      const vw = fitW / viewState.zoom;
      const vh = fitH / viewState.zoom;
      const vx = baseCX - vw / 2 + viewState.panX;
      const vy = baseCY - vh / 2 + viewState.panY;
      svg.setAttribute("viewBox", `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
      if (resetBtn) resetBtn.textContent = `${Math.round(viewState.zoom * 100)}%`;
    };

    updateViewBox();
    requestAnimationFrame(updateViewBox);

    container.querySelector("#bZoomInBtn").onclick = (e) => {
      e.stopPropagation();
      viewState.zoom = Math.min(3.8, viewState.zoom * 1.3);
      updateViewBox();
    };
    container.querySelector("#bZoomOutBtn").onclick = (e) => {
      e.stopPropagation();
      viewState.zoom = Math.max(0.65, viewState.zoom / 1.3);
      updateViewBox();
    };
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      viewState.zoom = window.innerWidth <= 640 ? 1.12 : 1.0;
      viewState.panX = 0;
      viewState.panY = 0;
      updateViewBox();
    };

    // Mouse / 1-finger drag pan & 2-finger pinch-to-zoom on stage
    let isDragging = false;
    let dragMoved = 0;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let pinchStartDist = null;
    let pinchStartZoom = 1;

    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.14 : 0.88;
      viewState.zoom = Math.max(0.65, Math.min(3.8, viewState.zoom * factor));
      updateViewBox();
    }, { passive: false });

    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".bubble-zoom-bar")) return;
      isDragging = true;
      dragMoved = 0;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = viewState.panX;
      startPanY = viewState.panY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!isDragging || pinchStartDist != null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragMoved = Math.max(dragMoved, Math.hypot(dx, dy));
      if (dragMoved > 4) {
        const rect = stage.getBoundingClientRect();
        const scale = (baseW / viewState.zoom) / Math.max(200, rect.width);
        viewState.panX = startPanX - dx * scale;
        viewState.panY = startPanY - dy * scale;
        updateViewBox();
      }
    });
    window.addEventListener("pointerup", () => { isDragging = false; });

    stage.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        pinchStartZoom = viewState.zoom;
      }
    }, { passive: true });
    stage.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && pinchStartDist > 10) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        viewState.zoom = Math.max(0.65, Math.min(3.8, pinchStartZoom * (dist / pinchStartDist)));
        updateViewBox();
      }
    }, { passive: false });
    stage.addEventListener("touchend", () => { pinchStartDist = null; }, { passive: true });

    // Selected Bubble & Relationship Inspector Drawer (touch names directly to navigate — zero duplicate buttons)
    const inspector = container.querySelector("#bubbleInspectorCard");
    const inspectItem = (idx, panToNode = false) => {
      if (idx < 0 || idx >= nodesPos.length) return;
      selectedIdx = idx;
      const item = nodesPos[idx];
      const pRow = bySym[item.symbol] || {};
      const rc = REL_COLORS[item.type] || REL_COLORS.peer;
      const spread = (item.change_1d_pct ?? 0) - (center.change_1d_pct ?? 0);
      const corrVal = item.corr_60d;
      const betaVal = item.beta_60d;
      const corrStr = corrVal != null ? `r = ${corrVal >= 0 ? "+" : ""}${corrVal.toFixed(2)}` : "—";
      const betaStr = betaVal != null ? `β = ${betaVal.toFixed(2)}x` : "—";
      const corrDesc = corrVal == null
        ? "Insufficient overlap"
        : Math.abs(corrVal) >= 0.55
          ? (corrVal > 0 ? "Strong positive co-movement" : "Strong inverse co-movement")
          : Math.abs(corrVal) >= 0.25
            ? (corrVal > 0 ? "Moderate positive co-movement" : "Moderate inverse co-movement")
            : "Low daily correlation (idiosyncratic)";
      const flowDesc = item.type === "supplier"
        ? `Upstream Supplier → ${center.symbol} (Inputs/COGS/Fab/Power flowing into ${center.symbol})`
        : item.type === "customer"
          ? `${center.symbol} → Downstream Customer (CapEx/Revenue flowing from ${item.symbol} to ${center.symbol})`
          : item.type === "partner"
            ? `Joint Infrastructure & Ecosystem Partner with ${center.symbol}`
            : item.type === "competitor"
              ? `Direct Market & Architecture Competitor to ${center.symbol}`
              : `Sector & Ecosystem Connection with ${center.symbol}`;
      const sc = pRow.scenarios || { bullish: 0, base: 0, bearish: 0 };
      const rsiZone = pRow.rsi14 < 30 ? "Oversold (<30)" : pRow.rsi14 > 70 ? "Overbought (>70)" : "Neutral";
      const s1r1Txt = `${pRow.s1 ? `S1 $${fmtNum(pRow.s1.price)} (${fmtPct(pRow.s1.distance_pct, 1)})` : "—"} · ${pRow.r1 ? `R1 $${fmtNum(pRow.r1.price)} (${fmtPct(pRow.r1.distance_pct, 1)})` : "—"}`;

      // Highlight selected bubble, edge, quick-pill, and card
      container.querySelectorAll(".orbit-bubble").forEach((el) => {
        const match = Number(el.dataset.idx) === idx;
        el.classList.toggle("selected", match);
        const ring = el.querySelector(".sel-ring");
        if (ring) ring.setAttribute("opacity", match ? "1" : "0");
      });
      container.querySelectorAll(".bubble-edge").forEach((el) => {
        const match = Number(el.dataset.idx) === idx;
        const line = el.querySelector(".edge-line");
        if (line) {
          line.setAttribute("stroke-opacity", match ? "1" : "0.32");
          line.setAttribute("stroke-width", match ? "3.6" : "1.8");
        }
      });
      container.querySelectorAll("#bubbleQuickSelectBar button").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.qsel) === idx);
      });
      container.querySelectorAll(".rel-conn-card").forEach((c) => {
        c.classList.toggle("active", Number(c.dataset.cardIdx) === idx);
      });

      if (panToNode && viewState.zoom > 1.25) {
        viewState.panX = item.x * 0.45;
        viewState.panY = item.y * 0.45;
        updateViewBox();
      }

      const arts = Array.isArray(item.articles) ? item.articles : [];
      const topUrl = item.source || arts[0]?.url || null;
      const insScaleHtml = topUrl && item.type === "co_mention"
        ? `<a class="news-edge-link" href="${esc(topUrl)}" target="_blank" rel="noopener">${esc(item.scale || rc.label)} ↗</a>`
        : `<span style="color:var(--accent-2)">${esc(item.scale || rc.label)}</span>`;
      const insArticlesHtml = arts.length
        ? `<div class="rel-articles-wrap" style="margin-top:8px">${arts.map((a) => `
            <a class="rel-article-link" href="${esc(a.url)}" target="_blank" rel="noopener">
              📰 ${esc(a.title)} <span class="muted">(${esc(a.source || "News")}${a.published ? ` · ${esc(a.published)}` : ""}) ↗</span>
            </a>`).join("")}</div>`
        : (topUrl && item.type === "co_mention"
            ? `<div class="rel-articles-wrap" style="margin-top:8px"><a class="rel-article-link" href="${esc(topUrl)}" target="_blank" rel="noopener">📰 ${esc(item.note || "Open co-mentioned article")} ↗</a></div>`
            : "");

      if (inspector) {
        inspector.innerHTML = `
          <div class="inspector-head">
            <div>
              <div class="inspector-title">
                <strong class="touch-name-link" data-open-stock="${esc(center.symbol)}">${esc(center.symbol)} ↗</strong>
                <span class="muted">↔</span>
                <strong class="touch-name-link" data-open-stock="${esc(item.symbol)}">${esc(item.symbol)} · ${esc(item.name)} ↗</strong>
                <span class="tag ${rc.badge}">${esc(rc.label)}</span>
                <span class="tag sector-link" data-sector="${esc(item.sector)}">${esc(fmtSector(item.sector))}</span>
              </div>
              <div class="muted" style="margin-top:3px">${esc(flowDesc)}</div>
            </div>
          </div>

          <div class="inspector-metrics">
            <div class="ins-metric">
              <div class="ins-k">Economic &amp; Contract Scale</div>
              <div class="ins-v">${insScaleHtml}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">${esc(rc.label)}</div>
            </div>
            <div class="ins-metric">
              <div class="ins-k">60-Day Return Correlation &amp; Beta</div>
              <div class="ins-v">${esc(corrStr)} · ${esc(betaStr)}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">${esc(corrDesc)}</div>
            </div>
            <div class="ins-metric">
              <div class="ins-k">${esc(item.symbol)} Price, Cap &amp; 1D Spread</div>
              <div class="ins-v">$${fmtNum(item.close)} <span class="${clsPct(item.change_1d_pct)}">(${fmtPct(item.change_1d_pct, 1)})</span> · ${fmtCap(item.market_cap)}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">1D Spread vs ${esc(center.symbol)}: <strong class="${clsPct(spread)}">${spread >= 0 ? "+" : ""}${spread.toFixed(2)}%</strong></div>
            </div>
            <div class="ins-metric">
              <div class="ins-k">${esc(item.symbol)} Live Quant Profile</div>
              <div class="ins-v">Score ${fmtNum(pRow.notable_score, 0)}/100 · RSI ${fmtNum(pRow.rsi14, 1)} (${rsiZone})</div>
              <div class="muted" style="font-size:11px;margin-top:2px">21d vs SPY: <strong class="${clsPct(pRow.rs_spy_21d)}">${fmtPct(pRow.rs_spy_21d, 1)}</strong> · Bull ${sc.bullish}% / Base ${sc.base}% / Bear ${sc.bearish}%</div>
            </div>
          </div>

          <div class="inspector-note">
            ${item.type !== "co_mention" ? `<strong>Supply-Chain &amp; Fundamental Mechanism:</strong> ${esc(item.note || "Connected in the watchlist ecosystem.")}<br/>` : ""}
            <span class="muted" style="display:inline-block;margin-top:2px"><strong>${esc(item.symbol)} Key Levels:</strong> ${esc(s1r1Txt)} · <strong>20d Vol Ratio:</strong> ${fmtNum(pRow.vol_ratio_20d, 2)}x avg</span>
            ${insArticlesHtml}
          </div>
        `;
        wireSectorLinks(inspector);
        inspector.querySelectorAll("[data-open-stock]").forEach((el) => {
          el.onclick = (e) => {
            e.stopPropagation();
            openStock(el.dataset.openStock);
          };
        });
      }
    };

    if (nodesPos.length > 0) {
      inspectItem(selectedIdx, false);
    } else if (inspector) {
      inspector.innerHTML = `<div class="muted">No connections match the selected filter.</div>`;
    }

    container.querySelectorAll(".orbit-bubble[data-idx], .edge-badge[data-idx]").forEach((nodeEl) => {
      nodeEl.addEventListener("click", (e) => {
        if (dragMoved > 7) return;
        e.stopPropagation();
        const idx = Number(nodeEl.dataset.idx);
        const targetItem = nodesPos[idx];
        if (nodeEl.classList.contains("edge-badge") && targetItem?.type === "co_mention") {
          const url = targetItem.source || targetItem.articles?.[0]?.url;
          if (url) {
            window.open(url, "_blank", "noopener");
            return;
          }
        }
        if (idx === selectedIdx && nodeEl.classList.contains("orbit-bubble")) {
          recenterOnItem(targetItem);
        } else {
          inspectItem(idx, true);
        }
      });
    });

    container.querySelectorAll("#bubbleQuickSelectBar button").forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.dataset.qsel);
        if (idx === selectedIdx) {
          recenterOnItem(nodesPos[idx]);
        } else {
          inspectItem(idx, true);
        }
      };
    });
    container.querySelectorAll(".rel-conn-card").forEach((card) => {
      card.onclick = (e) => {
        if (e.target.closest("[data-open-stock]")) return;
        const idx = Number(card.dataset.cardIdx);
        if (idx === selectedIdx) {
          recenterOnItem(nodesPos[idx]);
        } else {
          inspectItem(idx, true);
          inspector?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      };
    });

    container.querySelector(".center-bubble")?.addEventListener("click", () => {
      if (dragMoved <= 7) {
        if (state.networkFullscreen) {
          state.networkFullscreen = false;
          document.body.classList.remove("no-scroll");
        }
        openStock(center.symbol);
      }
    });
  }

  function renderNetworkView() {
    const s = state.summary;
    if (!s) return;
    const tickers = [...(s.tickers || [])].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    if (!tickers.some((t) => t.symbol === state.networkCenter)) {
      state.networkCenter = tickers[0]?.symbol ?? "NVDA";
    }
    renderBubbleNetwork(
      $("globalNetworkContainer"),
      state.networkCenter,
      state.networkFilter,
      (newCenter, newFilter, edgeInfo) => {
        state.networkCenter = newCenter;
        state.networkFilter = newFilter;
        if (edgeInfo) state.networkLastEdge = edgeInfo;
        const existingIdx = state.networkHistory.indexOf(newCenter);
        if (existingIdx !== -1) {
          state.networkHistory = state.networkHistory.slice(0, existingIdx + 1);
        } else {
          state.networkHistory = [...state.networkHistory.slice(-7), newCenter];
        }
        renderNetworkView();
      },
      { history: state.networkHistory, lastEdge: state.networkLastEdge }
    );
  }

  // ---- SMART MONEY / WHALE FLOW ----
  function renderSmartMoney() {
    const sm = (state.summary && state.summary.smart_money) || {};
    const allTickers = state.summary?.tickers || [];
    const vf = sm.volume_flow || [];
    const si = sm.short_interest || [];
    const insBuys = sm.insider_buys || [];
    const insSells = sm.insider_sells || [];

    const calcMean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const calcMedian = (arr) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    const chartsEl = $("smartMoneyCharts");
    if (chartsEl) {
      // 1. 1-Day Institutional Dollar Flow Split
      let accUsd = 0;
      let distUsd = 0;
      let accCnt = 0;
      let distCnt = 0;
      for (const x of vf) {
        const dv = Number(x.dollar_volume_usd || 0);
        if (x.flow === "Accumulation") { accUsd += dv; accCnt++; }
        else { distUsd += dv; distCnt++; }
      }
      const totFlow = accUsd + distUsd;
      const netFlow = accUsd - distUsd;
      const accPct = totFlow > 0 ? Math.round((accUsd / totFlow) * 100) : 0;
      const distPct = totFlow > 0 ? 100 - accPct : 0;
      const topFlowItem = [...vf].sort((a, b) => (b.dollar_volume_usd || 0) - (a.dollar_volume_usd || 0))[0];
      const topSharePct = topFlowItem && totFlow > 0 ? ((topFlowItem.dollar_volume_usd || 0) / totFlow) * 100 : 0;

      const r = 38;
      const circ = 2 * Math.PI * r;
      const accDash = (accPct / 100) * circ;
      const distDash = (distPct / 100) * circ;
      const centerPctTxt = accPct >= distPct ? `${accPct}%` : `${distPct}%`;
      const centerLblTxt = accPct >= distPct ? "INFLOW" : "OUTFLOW";
      const centerCol = accPct >= distPct ? "var(--green)" : "var(--red)";

      const insBuyUsd = insBuys.reduce((s, x) => s + Number(x.value_usd || 0), 0);
      const insSellUsd = insSells.reduce((s, x) => s + Number(x.value_usd || 0), 0);

      const flowRegimeNote = totFlow === 0
        ? "No abnormal institutional volume surges (≥1.35x 20d avg) recorded in this session."
        : `${accPct >= 60 ? "Institutional Accumulation regime" : distPct >= 60 ? "Heavy Institutional Distribution regime" : "Mixed Two-Way Institutional Flow"}: ${distCnt} of ${vf.length} high-volume stocks closed lower (${distPct}% of surge dollar flow).${topFlowItem ? ` ${topFlowItem.symbol} alone accounts for ${topSharePct.toFixed(1)}% (${fmtCap(topFlowItem.dollar_volume_usd)}) of total unusual flow.` : ""}`;

      // 2. 20-Day Cross-Sectional Up/Down Volume Regime (All 39 Watchlist Stocks)
      const udVals = allTickers.map((t) => t.updown_vol_20d).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
      const udAcc = udVals.filter((v) => v >= 1.2).length;
      const udDist = udVals.filter((v) => v <= 0.8).length;
      const udNeu = Math.max(0, udVals.length - udAcc - udDist);
      const udTot = Math.max(1, udVals.length);
      const udAccPct = Math.round((udAcc / udTot) * 100);
      const udNeuPct = Math.round((udNeu / udTot) * 100);
      const udDistPct = Math.max(0, 100 - udAccPct - udNeuPct);
      const udMed = calcMedian(udVals);
      const udMean = calcMean(udVals);
      const udTakeaway = udMed == null
        ? "Insufficient 20-day volume history."
        : udMed >= 1.15
          ? `Broad 20-day accumulation across the watchlist (median U/D = ${udMed.toFixed(2)} ≥ 1.15; ${udAcc}/${udVals.length} names in active accumulation).`
          : udMed <= 0.85
            ? `Broad 20-day institutional distribution (median U/D = ${udMed.toFixed(2)} ≤ 0.85; ${udDist}/${udVals.length} stocks seeing heavier red-day than green-day volume).`
            : `Balanced 20-day institutional tape (median U/D = ${udMed.toFixed(2)}, mean = ${udMean.toFixed(2)}); positioning is selective rather than one-sided.`;

      // 3. Institutional Volume Surge Ranking (with 1.35x threshold line & median stats)
      const vfRatios = vf.map((x) => Number(x.vol_ratio_20d || 0)).filter((v) => v > 0);
      const vfRets = vf.map((x) => Number(x.change_1d_pct || 0));
      const vfMedR = calcMedian(vfRatios);
      const vfMeanRet = calcMean(vfRets);
      const maxVolR = Math.max(2.2, ...vfRatios);
      const ref135Pct = (1.35 / maxVolR) * 100;
      const volBarsHtml = vf.length
        ? vf.slice(0, 8).map((x) => {
            const val = Number(x.vol_ratio_20d || 0);
            const pct = Math.min(100, (val / maxVolR) * 100);
            const isUp = x.flow === "Accumulation";
            return `
              <div class="sm-bar-row" data-sym="${esc(x.symbol)}">
                <span class="sm-bar-sym">${esc(x.symbol)}</span>
                <div class="sm-bar-track">
                  <div class="sm-bar-ref" style="left:${ref135Pct.toFixed(1)}%" title="1.35x surge threshold"></div>
                  <div class="sm-bar-fill ${isUp ? "up" : "dn"}" style="width:${pct.toFixed(1)}%"></div>
                </div>
                <span class="sm-bar-val ${isUp ? "pos" : "neg"}">${fmtNum(val, 2)}x (${fmtPct(x.change_1d_pct, 1)})</span>
              </div>`;
          }).join("")
        : `<div class="muted">No unusual volume surges (&ge; 1.35x) on this session.</div>`;

      // 4. Short Interest Distribution (% of Float, with 10% & 20% threshold lines)
      const siVals = si.map((x) => Number(x.short_pct_float || 0)).filter((v) => v > 0);
      const siMed = calcMedian(siVals);
      const siGt10 = siVals.filter((v) => v >= 10).length;
      const siGt20 = siVals.filter((v) => v >= 20).length;
      const maxSi = Math.max(25, ...siVals);
      const ref10Pct = (10 / maxSi) * 100;
      const ref20Pct = (20 / maxSi) * 100;
      const siBarsHtml = si.length
        ? si.slice(0, 8).map((x) => {
            const val = Number(x.short_pct_float || 0);
            const pct = Math.min(100, (val / maxSi) * 100);
            return `
              <div class="sm-bar-row" data-sym="${esc(x.symbol)}">
                <span class="sm-bar-sym">${esc(x.symbol)}</span>
                <div class="sm-bar-track">
                  <div class="sm-bar-ref" style="left:${ref10Pct.toFixed(1)}%" title="10% elevated short interest"></div>
                  <div class="sm-bar-ref" style="left:${ref20Pct.toFixed(1)}%" title="20% extreme short crowding"></div>
                  <div class="sm-bar-fill ${val >= 10 ? "dn" : "warn"}" style="width:${pct.toFixed(1)}%"></div>
                </div>
                <span class="sm-bar-val ${val >= 10 ? "neg" : "warn"}">${fmtNum(val, 1)}% (${fmtPct(x.change_1d_pct, 1)})</span>
              </div>`;
          }).join("")
        : `<div class="muted">No short interest data available.</div>`;

      chartsEl.innerHTML = `
        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">1. Session Institutional Dollar Flow</span>
            <span class="muted">n = ${vf.length} / ${allTickers.length} stocks (&ge;1.35x vol)</span>
          </div>
          <div class="sm-donut-wrap">
            <svg class="sm-donut-svg" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--bg-card-2)" stroke-width="11" />
              ${distPct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--red)" stroke-width="11"
                stroke-dasharray="${distDash.toFixed(1)} ${circ.toFixed(1)}"
                stroke-dashoffset="${(-accDash).toFixed(1)}" transform="rotate(-90 50 50)" />` : ""}
              ${accPct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--green)" stroke-width="11"
                stroke-dasharray="${accDash.toFixed(1)} ${circ.toFixed(1)}"
                transform="rotate(-90 50 50)" />` : ""}
              <text x="50" y="48" text-anchor="middle" fill="${centerCol}" font-size="14" font-weight="800">${centerPctTxt}</text>
              <text x="50" y="61" text-anchor="middle" fill="var(--muted)" font-size="8" font-weight="700">${centerLblTxt}</text>
            </svg>
            <div class="sm-donut-legend">
              <div class="sm-dl-row"><span class="pos">● Accumulation (${accCnt})</span><strong>${fmtCap(accUsd)} (${accPct}%)</strong></div>
              <div class="sm-dl-row"><span class="neg">● Distribution (${distCnt})</span><strong>${fmtCap(distUsd)} (${distPct}%)</strong></div>
              <div class="sm-dl-row"><span class="muted">Net Imbalance</span><strong class="${clsPct(netFlow)}">${netFlow >= 0 ? "+" : "-"}${fmtCap(Math.abs(netFlow))}</strong></div>
              <div class="sm-dl-row" style="padding-top:5px;border-top:1px solid var(--border)">
                <span class="muted">90d Form 4 Buys / Sells</span>
                <strong><span class="pos">${fmtCap(insBuyUsd)}</span> / <span class="neg">${fmtCap(insSellUsd)}</span></strong>
              </div>
            </div>
          </div>
          <div class="sm-note-box">${esc(flowRegimeNote)}</div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">2. 20-Day Accumulation vs Distribution Regime</span>
            <span class="muted">All n = ${udVals.length} stocks (O'Neil U/D Ratio)</span>
          </div>
          <div class="sm-stat-strip">
            <div class="sm-stat-cell"><span class="sm-stat-k">Median U/D</span><span class="sm-stat-v ${udMed >= 1.2 ? "pos" : udMed <= 0.8 ? "neg" : ""}">${fmtNum(udMed, 2)}</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">Mean U/D</span><span class="sm-stat-v">${fmtNum(udMean, 2)}</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">Acc / Dist Split</span><span class="sm-stat-v"><span class="pos">${udAcc}</span> / <span class="neg">${udDist}</span></span></div>
          </div>
          <div class="sm-regime-bar" title="Accumulation ≥1.2 · Neutral 0.8–1.2 · Distribution ≤0.8">
            <div style="width:${udAccPct}%;background:var(--green)"></div>
            <div style="width:${udNeuPct}%;background:var(--border-strong)"></div>
            <div style="width:${udDistPct}%;background:var(--red)"></div>
          </div>
          <div class="sm-dl-row" style="font-size:11.5px">
            <span class="pos">● Acc (&ge;1.2): ${udAcc} (${udAccPct}%)</span>
            <span class="muted">● Neutral: ${udNeu} (${udNeuPct}%)</span>
            <span class="neg">● Dist (&le;0.8): ${udDist} (${udDistPct}%)</span>
          </div>
          <div class="sm-note-box">${esc(udTakeaway)}</div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">3. Abnormal Volume Surges (RVOL vs 20d Avg)</span>
            <span class="muted">Top ${Math.min(8, vf.length)} of ${vf.length}</span>
          </div>
          <div class="sm-stat-strip">
            <div class="sm-stat-cell"><span class="sm-stat-k">Median RVOL</span><span class="sm-stat-v">${fmtNum(vfMedR, 2)}x</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">Mean 1D Ret</span><span class="sm-stat-v ${clsPct(vfMeanRet)}">${fmtPct(vfMeanRet, 1)}</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">Total Flow</span><span class="sm-stat-v">${fmtCap(totFlow)}</span></div>
          </div>
          <div class="sm-bar-list">${volBarsHtml}</div>
          <div class="sm-axis-labels"><span>0x</span><span>1.35x threshold</span><span>${fmtNum(maxVolR, 1)}x</span></div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">4. Short Interest Crowding (% of Float)</span>
            <span class="muted">Top ${Math.min(8, si.length)} of ${si.length} tracked</span>
          </div>
          <div class="sm-stat-strip">
            <div class="sm-stat-cell"><span class="sm-stat-k">Median Short</span><span class="sm-stat-v warn">${fmtNum(siMed, 1)}%</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">&ge;10% Float</span><span class="sm-stat-v neg">${siGt10} stocks</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">&ge;20% Extreme</span><span class="sm-stat-v neg">${siGt20} stocks</span></div>
          </div>
          <div class="sm-bar-list">${siBarsHtml}</div>
          <div class="sm-axis-labels"><span>0%</span><span>10%</span><span>20%</span><span>${Math.round(maxSi)}%</span></div>
        </div>
      `;

      chartsEl.querySelectorAll(".sm-bar-row[data-sym]").forEach((row) => {
        row.onclick = () => openStock(row.dataset.sym);
      });

      if ($("vfCountBadge")) $("vfCountBadge").textContent = `(${vf.length} stocks)`;
      if ($("insBuyMeta")) $("insBuyMeta").textContent = `(n = ${insBuys.length} · ${fmtCap(insBuyUsd)})`;
      if ($("insSellMeta")) $("insSellMeta").textContent = `(n = ${insSells.length} · ${fmtCap(insSellUsd)})`;
      if ($("siMeta")) $("siMeta").textContent = `(Median ${fmtNum(siMed, 1)}%)`;
    }

    $("volumeFlowGrid").innerHTML = vf.length ? vf.map((x) => `
      <div class="notable-card" data-sym="${esc(x.symbol)}">
        <div class="notable-top">
          <div>
            <div class="notable-sym">${esc(x.symbol)} <span class="tag ${x.flow === "Accumulation" ? "bull" : "bear"}">${esc(x.flow)}</span></div>
            <div class="notable-name">${esc(x.name || "")}</div>
          </div>
          <div style="text-align:right">
            <div class="price-pill ${clsPct(x.change_1d_pct)}">${fmtPct(x.change_1d_pct, 1)}</div>
            <div style="margin-top:4px"><span class="score-badge">${fmtNum(x.vol_ratio_20d, 2)}x vol</span></div>
          </div>
        </div>
        <div class="muted" style="margin-top:6px">
          Dollar flow: <strong>${fmtCap(x.dollar_volume_usd)}</strong> · 20d Up/Down vol: <strong>${fmtNum(x.updown_vol_20d, 2)}</strong>
        </div>
      </div>
    `).join("") : `<div class="panel muted">No unusual volume surges (&ge; 1.35x) on this session.</div>`;
    $("volumeFlowGrid").querySelectorAll(".notable-card").forEach((el) => {
      el.onclick = () => openStock(el.dataset.sym);
    });

    const renderInsList = (id, items, emptyTxt, badgeCls) => {
      $(id).innerHTML = (items || []).length ? items.slice(0, 12).map((x) => `
        <div class="feed-item">
          <div class="feed-meta">
            <span class="ticker-pill" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong></span>
            ${x.value_usd ? `<span class="tag ${badgeCls}">${fmtCap(x.value_usd)}</span>` : ""}
            <span>${esc((x.published || "").slice(0, 10))}</span>
          </div>
          <a class="feed-title" href="${esc(secHtmlUrl(x.url))}" target="_blank" rel="noopener">${esc(x.title)}</a>
        </div>
      `).join("") : `<div class="muted">${emptyTxt}</div>`;
      $(id).querySelectorAll(".ticker-pill").forEach((p) => { p.onclick = () => openStock(p.dataset.sym); });
    };

    renderInsList("smInsiderBuys", sm.insider_buys, "No open-market Form 4 insider buys in the 90-day window.", "bull");
    renderInsList("smInsiderSells", sm.insider_sells, "No open-market Form 4 insider sells in the 90-day window.", "bear");

    const wf = sm.whale_filings || [];
    $("smWhaleFilings").innerHTML = wf.length ? wf.map((f) => `
      <div class="feed-item">
        <div class="feed-meta">
          <span class="ticker-pill" data-sym="${esc(f.symbol)}"><strong>${esc(f.symbol)}</strong></span>
          <span class="tag amber">${esc(f.form)}</span>
          <span>${esc((f.published || "").slice(0, 10))}</span>
        </div>
        <a class="feed-title" href="${esc(f.url || "#")}" target="_blank" rel="noopener">${esc(f.title)}</a>
      </div>
    `).join("") : `<div class="muted">No recent SC 13D / 13G (&gt;5% stake) filings in the 90-day window.</div>`;
    $("smWhaleFilings").querySelectorAll(".ticker-pill").forEach((p) => { p.onclick = () => openStock(p.dataset.sym); });

    $("smShortInterest").innerHTML = si.length ? si.map((x) => `
      <div class="level-row" data-sym="${esc(x.symbol)}" style="cursor:pointer">
        <div>
          <strong>${esc(x.symbol)}</strong>
          <span class="muted" style="margin-left:6px">${esc(x.name || "")}</span>
        </div>
        <div style="text-align:right">
          <span class="tag ${x.short_pct_float >= 10 ? "bear" : "amber"}">${fmtNum(x.short_pct_float, 1)}% float</span>
          <span class="${clsPct(x.change_1d_pct)}" style="margin-left:6px;font-size:12px;font-weight:700">${fmtPct(x.change_1d_pct, 1)}</span>
        </div>
      </div>
    `).join("") : `<div class="muted">Short interest unavailable.</div>`;
    $("smShortInterest").querySelectorAll(".level-row").forEach((r) => { r.onclick = () => openStock(r.dataset.sym); });
  }

  // ---- BREAKING NEWS ----
  const CAT_LABELS = {
    all: "All",
    policy_geopolitics: "Policy & Geopolitics",
    data_centers_ai: "Data Centers & AI",
    regulatory_legal: "Regulatory & Legal",
    earnings_guidance: "Earnings & Guidance",
    m_and_a: "M&A",
    contract_partnership: "Deals & Partnerships",
    management: "Leadership",
    capital_markets: "Capital Markets",
    capex_expansion: "Capex & Expansion",
    product_tech: "Product & Tech",
    analyst: "Analyst",
    market_move: "Market Move",
    general: "Market",
  };

  function renderBreaking() {
    const el = $("breakingList");
    const bar = $("breakingCategoryBar");
    if (!state.breaking.length) {
      if (bar) bar.innerHTML = "";
      el.innerHTML = `<div class="panel muted">No breaking alerts yet. Important headlines are checked every 2 hours on weekdays and posted here &amp; to Telegram.</div>`;
      return;
    }

    // Build category filter chips dynamically from available categories
    const catCounts = {};
    for (const item of state.breaking) {
      for (const c of (item.categories && item.categories.length ? item.categories : ["general"])) {
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
    }
    const cats = ["all", ...Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a])];
    if (!cats.includes(state.breakingCategory)) state.breakingCategory = "all";
    if (bar) {
      bar.innerHTML = cats.map((c) => {
        const label = CAT_LABELS[c] || c.replace(/_/g, " ");
        const cnt = c === "all" ? state.breaking.length : catCounts[c];
        return `<button class="chip ${state.breakingCategory === c ? "active" : ""}" data-bcat="${esc(c)}">${esc(label)} (${cnt})</button>`;
      }).join("");
      bar.querySelectorAll("button").forEach((b) => {
        b.onclick = () => { state.breakingCategory = b.dataset.bcat; renderBreaking(); };
      });
    }

    const filtered = state.breakingCategory === "all"
      ? state.breaking
      : state.breaking.filter((it) => (it.categories || ["general"]).includes(state.breakingCategory));

    const tickerSet = new Set((state.summary?.tickers || []).map((t) => t.symbol));
    el.innerHTML = filtered.map((item) => {
      const clickable = tickerSet.has(item.symbol);
      const badge = clickable
        ? `<span class="ticker-pill" data-sym="${esc(item.symbol)}"><strong>${esc(item.symbol)}</strong></span>`
        : `<span class="tag amber">${esc(item.symbol)}</span>`;
      return `
      <div class="feed-item">
        <div class="feed-meta">
          ${badge}
          ${(item.categories || []).slice(0, 2).map((c) => `<span class="tag">${esc(CAT_LABELS[c] || c.replace(/_/g, " "))}</span>`).join("")}
          <span>${esc(item.source || "")} · ${esc((item.published || "").replace("T", " ").slice(0, 16))} UTC</span>
        </div>
        <a class="feed-title" href="${esc(item.url || "#")}" target="_blank" rel="noopener">${esc(item.title)}</a>
      </div>`;
    }).join("");
    el.querySelectorAll(".ticker-pill").forEach((p) => {
      p.onclick = () => openStock(p.dataset.sym);
    });
  }

  // ---- MACRO ----
  function renderMacro() {
    const s = state.summary;
    const mc = s.macro || {};
    const fomc = mc.fomc || {};
    $("fomcBadge").textContent = fomc.next_meeting
      ? `Next FOMC: ${fomc.next_meeting[0]} – ${fomc.next_meeting[1]} (${fomc.days_to_decision}d away)`
      : "";

    const series = mc.series || [];
    $("macroBody").innerHTML = series.map((row) => `
      <tr>
        <td><strong>${esc(row.label)}</strong>${row.stale ? ' <span class="tag amber">stale</span>' : ""}</td>
        <td class="muted">${esc(row.id)}</td>
        <td class="num"><strong>${row.available ? fmtNum(row.latest, 2) : "—"}</strong> <span class="muted">${esc(row.unit || "")}</span></td>
        <td class="muted">${esc(row.latest_date || "—")}</td>
        <td class="num">${fmtNum(row.change_1w, 2)}</td>
        <td class="num">${fmtNum(row.change_1m, 2)}</td>
        <td class="num">${fmtNum(row.change_3m, 2)}</td>
      </tr>
    `).join("");

    $("macroCardsMobile").innerHTML = series.map((row) => `
      <div class="macro-card">
        <div class="kpi-label">${esc(row.id)}</div>
        <div style="font-size:12px;font-weight:600;margin-top:2px">${esc(row.label)}</div>
        <div class="macro-val">${row.available ? fmtNum(row.latest, 2) : "—"} <span class="muted">${esc(row.unit || "")}</span></div>
        <div class="muted">1W: ${fmtNum(row.change_1w, 2)} · 1M: ${fmtNum(row.change_1m, 2)}</div>
      </div>
    `).join("");

    const renderFeed = (id, items) => {
      $(id).innerHTML = (items || []).length
        ? items.slice(0, 10).map((it) => `
          <div class="feed-item">
            <div class="feed-meta"><span>${esc(it.source || "")}</span><span>${esc((it.published || "").slice(0, 10))}</span></div>
            <a class="feed-title" href="${esc(it.url || "#")}" target="_blank" rel="noopener">${esc(it.title)}</a>
          </div>`).join("")
        : `<div class="muted">No items available.</div>`;
    };
    renderFeed("fedFeed", s.feeds?.fed);
    renderFeed("worldFeed", s.feeds?.world);
    renderFeed("regFeed", s.feeds?.regulatory);
  }

  // ---- DEDICATED FORMULAS & QUANTITATIVE METHODOLOGY PAGE (Clean Mobile-First Step-by-Step Layout) ----
  function renderFormulasView(focusSym = null) {
    const box = $("formulasPageContainer");
    const s = state.summary;
    if (!box || !s) return;
    const tickers = [...(s.tickers || [])].sort((a, b) => (b.notable_score || 0) - (a.notable_score || 0));
    const activeSym = focusSym || state.formulaTicker || state.activeTicker || tickers[0]?.symbol || "NVDA";
    state.formulaTicker = activeSym;
    const r = tickers.find((x) => x.symbol === activeSym) || tickers[0] || {};
    const bd = r.notable_bd || {};
    const tm = bd.terms || {};
    const jc = r.tech_components || {};
    const sc = r.scenarios || { bullish: 0, base: 0, bearish: 0 };

    box.innerHTML = `
      <div class="section-header screener-head">
        <div>
          <h2>How Every Score &amp; Indicator Is Calculated</h2>
          <p class="section-sub">Clean step-by-step mathematical guide · Touch <strong class="touch-name-link" data-open-stock="${esc(r.symbol)}">${esc(r.symbol)} · ${esc(r.name)} ↗</strong> to open its stock analysis</p>
        </div>
        <div class="screener-controls">
          <div class="control-group">
            <label for="formulaTickerSelect" class="muted">Live Calculator Stock</label>
            <select id="formulaTickerSelect" class="select-control compact">
              ${tickers.map((t) => `<option value="${esc(t.symbol)}" ${t.symbol === r.symbol ? "selected" : ""}>${esc(t.symbol)} — ${esc(t.name)} (Score ${fmtNum(t.notable_score, 0)})</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <div class="formula-cards-stack">
        <!-- MODEL 1: NOTABLE SCORE -->
        <div class="formula-card">
          <div class="formula-card-hdr">
            <div>
              <span class="formula-badge">Model 1 · Attention &amp; Catalyst Ranking</span>
              <h3>Daily Notable Score (0 to 100)</h3>
            </div>
            <div class="formula-live-pill">
              <span class="touch-name-link" data-open-stock="${esc(r.symbol)}">${esc(r.symbol)} ↗</span>:
              <strong>${fmtNum(r.notable_score, 1)} / 100</strong>
            </div>
          </div>

          <p class="formula-plain">
            Measures how unusually active a stock is today compared to its own normal daily behavior by adding points from <strong>5 independent factors</strong>:
          </p>

          <div class="formula-summary-eq">
            <span>Total Score</span> = <span>Price Move</span> + <span>Volume Surge</span> + <span>Chart Breakout</span> + <span>Extreme RSI</span> + <span>News &amp; Filings</span>
          </div>

          <div class="formula-steps">
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">1. Price Move vs Normal Daily Range (ATR Volatility Z-Score)</div>
                <div class="f-step-rule">Formula: <code>Points = 12 × min(3, |1D Return %| ÷ Daily ATR %)</code> (triggers when move &ge; 1.0x ATR, max 36 pts)</div>
                <div class="f-step-calc">Live for ${esc(r.symbol)}: <code>|${fmtPct(r.change_1d_pct, 2)}| ÷ ${bd.atr_pct ?? "—"}% = ${bd.z_atr ?? 0}x normal range</code></div>
              </div>
              <div class="f-step-pts">+${fmtNum(tm.vol_z, 1)} pts</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">2. Unusual Trading Volume Surge (Relative Volume RVOL-20)</div>
                <div class="f-step-rule">Formula: <code>Points = 8 × (min(3, Today Vol ÷ 20d Avg Vol) − 1)</code> (triggers when volume &gt; 1.3x avg, max 16 pts)</div>
                <div class="f-step-calc">Live for ${esc(r.symbol)}: <code>RVOL = ${fmtNum(r.vol_ratio_20d, 2)}x 20-day average volume</code></div>
              </div>
              <div class="f-step-pts">+${fmtNum(tm.rvol, 1)} pts</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">3. Structural Chart Breakout / Breakdown</div>
                <div class="f-step-rule">Formula: <code>+15 pts</code> if breakout/breakdown is volume-confirmed (&ge;1.3x vol), <code>+10 pts</code> unconfirmed, <code>+5 pts</code> failed test</div>
                <div class="f-step-calc">Live for ${esc(r.symbol)}: <code>${(r.patterns || []).length ? r.patterns.join(", ") : "No active breakout pattern today"}</code></div>
              </div>
              <div class="f-step-pts">+${fmtNum(tm.pattern, 1)} pts</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">4. Extreme Momentum Tail (Wilder's RSI-14)</div>
                <div class="f-step-rule">Formula: <code>+6 pts</code> when 14-day RSI is deeply Oversold (<code>&le; 25</code>) or heavily Overbought (<code>&ge; 75</code>)</div>
                <div class="f-step-calc">Live for ${esc(r.symbol)}: <code>RSI-14 = ${fmtNum(r.rsi14, 1)}</code></div>
              </div>
              <div class="f-step-pts">+${fmtNum(tm.rsi_extreme, 1)} pts</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">5. News Velocity, SEC Filings, Insider Trades &amp; Earnings Window</div>
                <div class="f-step-rule">Formula: <code>0.25 × Top News Score + 1.5 × (24h Articles) + 8 (SEC 8-K/10-Q/10-K) + 4 (Form 4 &ge; $1M) + 10 (Earnings &le; 7d)</code></div>
                <div class="f-step-calc">Live for ${esc(r.symbol)}: <code>News +${fmtNum(tm.news, 1)} · SEC +${fmtNum(tm.sec, 1)} · Insider/Earnings +${fmtNum((tm.insider || 0) + (tm.earnings || 0), 1)}</code></div>
              </div>
              <div class="f-step-pts">+${fmtNum((tm.news || 0) + (tm.sec || 0) + (tm.insider || 0) + (tm.earnings || 0), 1)} pts</div>
            </div>
          </div>
        </div>

        <!-- MODEL 2: TECHNICAL SCORE & 20-DAY SCENARIOS -->
        <div class="formula-card">
          <div class="formula-card-hdr">
            <div>
              <span class="formula-badge">Model 2 · Directional Trend &amp; Probability Engine</span>
              <h3>Technical Score (-1.00 to +1.00) &amp; 20-Day Scenarios</h3>
            </div>
            <div class="formula-live-pill">
              Score: <strong>${fmtNum(r.tech_score, 2)}</strong> ·
              <span class="pos">Bull ${sc.bullish}%</span> / <span>Base ${sc.base}%</span> / <span class="neg">Bear ${sc.bearish}%</span>
            </div>
          </div>

          <p class="formula-plain">
            Combines 4 classic technical factors (each scored from <code>-1.0</code> bearish to <code>+1.0</code> bullish) into a weighted balance, then converts that score into <strong>Bull / Base / Bear %</strong> probabilities that always add up to 100%:
          </p>

          <div class="formula-summary-eq">
            <span>Tech Score</span> = <span>30% Trend (SMA)</span> + <span>30% Momentum (RSI/MACD)</span> + <span>25% vs Market (RS)</span> + <span>15% Pattern</span>
          </div>

          <div class="formula-steps">
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">1. Moving-Average Trend Alignment (30% Weight)</div>
                <div class="f-step-rule">Checks if Price &gt; SMA-200 (40%), Price &gt; SMA-50 (30%), and SMA-50 &gt; SMA-200 (30%)</div>
                <div class="f-step-calc">Live Vote for ${esc(r.symbol)}: <code>${fmtNum(jc.ma_trend?.vote, 2)} × 0.30</code></div>
              </div>
              <div class="f-step-pts">${fmtNum((jc.ma_trend?.vote || 0) * 0.30, 3)}</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">2. RSI-14 &amp; MACD Momentum (30% Weight)</div>
                <div class="f-step-rule">Averages 3 signals: MACD line sign (+1/-1), MACD histogram direction (+1/-1), and normalized RSI-14 <code>(RSI − 50) ÷ 25</code></div>
                <div class="f-step-calc">Live Vote for ${esc(r.symbol)}: <code>${fmtNum(jc.momentum?.vote, 2)} × 0.30</code></div>
              </div>
              <div class="f-step-pts">${fmtNum((jc.momentum?.vote || 0) * 0.30, 3)}</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">3. Relative Strength vs S&amp;P 500 &amp; Sector ETF (25% Weight)</div>
                <div class="f-step-rule">Compares the stock's 63-day return against SPY and its Sector ETF using a smooth hyperbolic tangent curve <code>tanh(Excess Return ÷ 15%)</code></div>
                <div class="f-step-calc">Live Vote for ${esc(r.symbol)}: <code>${fmtNum(jc.relative_strength?.vote, 2)} × 0.25</code> (21d vs SPY: ${fmtPct(r.rs_spy_21d, 1)})</div>
              </div>
              <div class="f-step-pts">${fmtNum((jc.relative_strength?.vote || 0) * 0.25, 3)}</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">4. Chart Pattern &amp; Logistic Probability Conversion (15% Weight)</div>
                <div class="f-step-rule"><code>Base % = 45% − 20% × |Score|</code> · Remaining probability splits between Bull and Bear via Sigmoid curve <code>1 ÷ (1 + e^(−3 × Score))</code></div>
                <div class="f-step-calc">Live Result for ${esc(r.symbol)}: <strong class="pos">Bull ${sc.bullish}%</strong> · <strong>Base ${sc.base}%</strong> · <strong class="neg">Bear ${sc.bearish}%</strong></div>
              </div>
              <div class="f-step-pts">${fmtNum((jc.patterns?.vote || 0) * 0.15, 3)}</div>
            </div>
          </div>
        </div>

        <!-- MODEL 3: SUPPORT & RESISTANCE STRENGTH -->
        <div class="formula-card">
          <div class="formula-card-hdr">
            <div>
              <span class="formula-badge">Model 3 · Key Price Floors &amp; Ceilings</span>
              <h3>Support (S1–S3) &amp; Resistance (R1–R3) Strength (0 to 100)</h3>
            </div>
            <div class="formula-live-pill">
              S1: <strong>${r.s1 ? `$${fmtNum(r.s1.price)} (${fmtNum(r.s1.strength, 0)}/100)` : "—"}</strong> ·
              R1: <strong>${r.r1 ? `$${fmtNum(r.r1.price)} (${fmtNum(r.r1.strength, 0)}/100)` : "—"}</strong>
            </div>
          </div>

          <p class="formula-plain">
            Measures how reliable a support floor or resistance ceiling is by scoring 5 factors out of 100 points:
          </p>

          <div class="formula-steps">
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">1. Historical Bounce Count (35 pts max)</div>
                <div class="f-step-rule"><code>35 × (1 − e^(−Weighted Touches ÷ 3))</code> — More historical reversals at this price zone increase reliability.</div>
              </div>
              <div class="f-step-pts">35%</div>
            </div>
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">2. Volume-at-Price Concentration (30 pts max)</div>
                <div class="f-step-rule">Share of 180-day share volume traded within <code>±0.5 × ATR</code> of this price level compared to the highest-volume zone.</div>
              </div>
              <div class="f-step-pts">30%</div>
            </div>
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">3. Recency of Last Test (20 pts max)</div>
                <div class="f-step-rule"><code>20 × 0.5^(Days Since Last Touch ÷ 60)</code> — Levels tested recently carry more weight than old levels.</div>
              </div>
              <div class="f-step-pts">20%</div>
            </div>
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">4. Daily + Weekly Alignment &amp; Round Numbers (15 pts max)</div>
                <div class="f-step-rule"><code>+10 pts</code> if both Daily and Weekly swing highs/lows align; <code>+5 pts</code> at major psychological round prices ($100, $200, $500).</div>
              </div>
              <div class="f-step-pts">15%</div>
            </div>
          </div>
        </div>

        <!-- MODEL 4: STANDARD INDICATORS & NETWORK METRICS -->
        <div class="formula-card">
          <div class="formula-card-hdr">
            <div>
              <span class="formula-badge">Model 4 · Core Indicators &amp; Supply-Chain Metrics</span>
              <h3>Standard Quantitative Indicators</h3>
            </div>
          </div>

          <div class="formula-steps">
            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">Wilder's RSI-14 (14-Day Relative Strength Index)</div>
                <div class="f-step-rule"><code>RSI = 100 − [ 100 ÷ (1 + Avg 14d Up Move ÷ Avg 14d Down Move) ]</code></div>
                <div class="f-step-calc">Below 30 = Oversold · Above 70 = Overbought · Live for ${esc(r.symbol)}: <strong>${fmtNum(r.rsi14, 1)}</strong></div>
              </div>
              <div class="f-step-pts">${fmtNum(r.rsi14, 1)}</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">Wilder's ATR-14 (Average Daily Volatility Range)</div>
                <div class="f-step-rule"><code>True Range = max(High − Low, |High − Prev Close|, |Low − Prev Close|)</code> averaged over 14 days</div>
                <div class="f-step-calc">Shows how many % the stock typically moves in a single day · Live for ${esc(r.symbol)}: <strong>${bd.atr_pct ?? "—"}%</strong></div>
              </div>
              <div class="f-step-pts">${bd.atr_pct ?? "—"}%</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">Institutional Up/Down Volume Ratio (20-Day Accumulation vs Distribution)</div>
                <div class="f-step-rule"><code>Up/Down Ratio = (Total Volume on Green Days) ÷ (Total Volume on Red Days)</code> over the last 20 trading days</div>
                <div class="f-step-calc">Above 1.20 = Institutional Accumulation · Below 0.80 = Distribution · Live for ${esc(r.symbol)}: <strong>${fmtNum(r.updown_vol_20d, 2)}</strong></div>
              </div>
              <div class="f-step-pts">${fmtNum(r.updown_vol_20d, 2)}</div>
            </div>

            <div class="f-step">
              <div class="f-step-main">
                <div class="f-step-title">Supply-Chain 60-Day Return Correlation (r) &amp; Sensitivity Beta (β)</div>
                <div class="f-step-rule"><code>Correlation r = Cov(Stock A, Stock B) ÷ (σ_A × σ_B)</code> from -1.00 to +1.00 · <code>Beta β = Cov(B, A) ÷ Var(A)</code></div>
                <div class="f-step-calc">Shows how closely a supplier or customer moves with the hub stock day-to-day over the past 60 trading days.</div>
              </div>
              <div class="f-step-pts">60d Window</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const sel = box.querySelector("#formulaTickerSelect");
    if (sel) sel.onchange = () => renderFormulasView(sel.value);
    box.querySelectorAll("[data-open-stock]").forEach((el) => {
      el.onclick = () => openStock(el.dataset.openStock);
    });
  }

  // ---- STOCK DEEP DIVE ----
  async function openStock(sym) {
    state.activeTicker = sym;
    setView("stock");
    $("stockContent").innerHTML = `<div class="loading-box"><div class="spinner"></div><p>Loading ${esc(sym)}…</p></div>`;
    const cacheKey = `${state.date}:${sym}`;
    try {
      if (!state.tickerCache[cacheKey]) {
        state.tickerCache[cacheKey] = await fetchJson(`data/${state.date}/tickers/${sym}.json`);
      }
      renderStock(state.tickerCache[cacheKey]);
    } catch (err) {
      $("stockContent").innerHTML = `<div class="error-box">Could not load ${esc(sym)}: ${esc(err.message)}</div>`;
    }
  }

  function renderStock(t) {
    const tech = t.technical || {};
    const facts = tech.facts || {};
    const comp = tech.computed || {};
    const ind = comp.indicators || {};
    const rs = comp.relative_strength || {};
    const lv = comp.levels || {};
    const patterns = comp.patterns || [];
    const judg = tech.judgment || {};
    const val = t.fundamentals?.valuation || {};
    const der = t.fundamentals?.derived || {};
    const cal = t.fundamentals?.calendar || {};
    const ins = t.insiders?.summary || {};
    const charts = t.charts || [];

    const hasSeries = Array.isArray(tech.series) && tech.series.length > 5;
    state.chartTab = "interactive";

    // 52W range bar
    let rangeHtml = "";
    if (val.fifty_two_week_low != null && val.fifty_two_week_high != null && facts.last_close != null && val.fifty_two_week_high > val.fifty_two_week_low) {
      const pct = Math.max(0, Math.min(100, ((facts.last_close - val.fifty_two_week_low) / (val.fifty_two_week_high - val.fifty_two_week_low)) * 100));
      rangeHtml = `
        <div class="range-box">
          <div class="range-labels">
            <span>52W Low $${fmtNum(val.fifty_two_week_low)}</span>
            <span>${pct.toFixed(0)}% of 52W range</span>
            <span>52W High $${fmtNum(val.fifty_two_week_high)}</span>
          </div>
          <div class="range-track"><div class="range-fill"></div><div class="range-dot" style="left:${pct}%"></div></div>
        </div>
      `;
    }

    const scByName = Object.fromEntries((judg.scenarios || []).map((x) => [x.name, x.probability_pct || 0]));
    const resLevels = [...(lv.resistance || [])].reverse();
    const supLevels = lv.support || [];

    const renderLevelRow = (x) => `
      <div class="level-row">
        <div>
          <span class="tag ${x.role === "support" ? "bull" : "bear"}" ${tipAttr("sr_levels")}>${esc(x.label)}</span>
          <strong style="margin-left:6px">$${fmtNum(x.price)}</strong>
          <span class="muted" style="margin-left:5px">($${fmtNum(x.band_low)}–$${fmtNum(x.band_high)})</span>
        </div>
        <div style="text-align:right">
          <span class="${clsPct(x.distance_pct)}" style="font-weight:700;font-size:12.5px">${fmtPct(x.distance_pct, 1)}</span>
          <div class="muted" ${levelStrengthTipAttr(x)}><span class="strength-bar"><span class="strength-fill" style="width:${Math.min(100, x.strength || 0)}%"></span></span>${fmtNum(x.strength, 0)}/100 <span class="tip-badge">?</span></div>
        </div>
      </div>
    `;

    const rsSpy21 = rs.vs_spy?.excess_21d != null ? rs.vs_spy.excess_21d * 100 : rs.vs_spy?.["21d"];
    const rsSec21 = rs.vs_sector?.excess_21d != null ? rs.vs_sector.excess_21d * 100 : rs.vs_sector?.["21d"];

    const quantMathPanelHtml = `
      <div class="panel" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <strong style="font-size:14px">How are ${esc(t.symbol)}'s scores (${fmtNum(t.notable?.score, 1)}/100 Notable · ${fmtNum(judg.score, 2)} Technical) calculated?</strong>
          <div class="muted">Inspect the exact mathematical formulations &amp; live step-by-step numbers for ${esc(t.symbol)} on the dedicated Formulas page.</div>
        </div>
        <button class="btn-secondary compact-hdr-btn" id="openFullMathModalBtn">See ${esc(t.symbol)} Calculation on Formulas Page →</button>
      </div>
    `;

    $("stockContent").innerHTML = `
      <div class="stock-hero">
        <div class="hero-top">
          <div>
            <h1 class="stock-title">
              ${esc(t.symbol)}
              ${t.is_core ? '<span class="tag amber">★ Core</span>' : ""}
              <span class="score-badge" ${notableScoreTipAttr(t)}>Score ${fmtNum(t.notable?.score, 0)} <span class="tip-badge">?</span></span>
            </h1>
            <div class="stock-company">
              ${esc(t.name)} ·
              <span class="tag sector-link" data-sector="${esc(t.sector)}">${esc(fmtSector(t.sector))} (${esc(t.sector_etf || "")}) →</span>
            </div>
          </div>
          <div class="stock-price-box">
            <div class="stock-price">$${fmtNum(facts.last_close)}</div>
            <div style="margin-top:4px"><span class="price-pill ${clsPct(facts.change_1d_pct)}">${fmtPct(facts.change_1d_pct)}</span></div>
            <div class="muted" style="margin-top:4px">Close ${esc(facts.last_bar || "")}</div>
          </div>
        </div>

        <div class="hero-tags">
          ${(t.notable?.why || []).map((w) => `<span class="tag">${esc(w)}</span>`).join("")}
          ${patterns.map((p) => `<span class="tag ${p.direction === "bullish" ? "bull" : "bear"}">${esc(p.label)}</span>`).join("")}
        </div>
        ${rangeHtml}
      </div>

      ${hasSeries ? `
      <div class="chart-card">
        <div id="chartBody"></div>
      </div>` : ""}

      <div id="stockBubbleMount"></div>

      <div class="section-header">
        <div>
          <h2 ${techScenarioTipAttr(judg.score, judg.components, scByName)}>Rule-Based 20-Day Scenarios <span class="tip-badge">?</span></h2>
          <p class="section-sub" ${techScenarioTipAttr(judg.score, judg.components, scByName)}>Heuristic model (not advice) · Technical score ${fmtNum(judg.score, 2)} <span class="tip-badge">?</span></p>
        </div>
      </div>
      <div class="prob-bar wide">
        <div class="prob-bull" style="width:${scByName.bullish || 0}%"></div>
        <div class="prob-base" style="width:${scByName.base || 0}%"></div>
        <div class="prob-bear" style="width:${scByName.bearish || 0}%"></div>
      </div>
      <div class="scenarios-grid">
        ${(judg.scenarios || []).map((sc) => `
          <div class="scenario-card ${esc(sc.name)}">
            <div class="scenario-head">
              <strong style="text-transform:capitalize">${esc(sc.name)} Case</strong>
              <span class="scenario-prob ${sc.name === "bullish" ? "pos" : sc.name === "bearish" ? "neg" : ""}">${sc.probability_pct}%</span>
            </div>
            <div class="scenario-row"><strong>Trigger:</strong> ${esc(sc.trigger?.condition || "—")}</div>
            <div class="scenario-row"><strong>Target:</strong> $${fmtNum(sc.target_zone?.low)} – $${fmtNum(sc.target_zone?.high)}</div>
            <div class="scenario-row"><strong>Invalidation:</strong> ${esc(sc.invalidation?.condition || "—")}</div>
          </div>
        `).join("")}
      </div>

      <div class="two-col">
        <div class="panel">
          <h3 ${tipAttr("sr_levels")}>Support &amp; Resistance Ladder <span class="tip-badge">?</span></h3>
          <div class="level-list">
            ${resLevels.map(renderLevelRow).join("")}
            <div class="level-current">Current Price · $${fmtNum(facts.last_close)}</div>
            ${supLevels.map(renderLevelRow).join("")}
          </div>
        </div>

        <div class="panel">
          <h3>Indicators &amp; Fundamentals</h3>
          <div class="kv-grid">
            <div class="kv" ${tipAttr("rsi14")}><div class="kv-k">RSI (14) ?</div><div class="kv-v">${fmtNum(ind.rsi14, 1)} <span class="muted">${esc(ind.rsi_zone || "")}</span></div></div>
            <div class="kv" ${tipAttr("sma")}><div class="kv-k">SMA 20/50/200 ?</div><div class="kv-v">${fmtNum(ind.sma20, 0)} / ${fmtNum(ind.sma50, 0)} / ${fmtNum(ind.sma200, 0)}</div></div>
            <div class="kv" ${tipAttr("rs_spy")}><div class="kv-k">vs SPY (21d) ?</div><div class="kv-v ${clsPct(rsSpy21)}">${fmtPct(rsSpy21, 1)}</div></div>
            <div class="kv" ${tipAttr("rs_sector")}><div class="kv-k">vs ${esc(t.sector_etf || "Sector")} (21d) ?</div><div class="kv-v ${clsPct(rsSec21)}">${fmtPct(rsSec21, 1)}</div></div>
            <div class="kv"><div class="kv-k">Market Cap</div><div class="kv-v">${fmtCap(val.market_cap)}</div></div>
            <div class="kv" ${tipAttr("pe")}><div class="kv-k">P/E (TTM / Fwd) ?</div><div class="kv-v">${fmtNum(val.trailing_pe, 1)} / ${fmtNum(val.forward_pe, 1)}</div></div>
            <div class="kv" ${tipAttr("fcf")}><div class="kv-k">FCF (TTM) ?</div><div class="kv-v">${fmtCap(der.free_cash_flow_ttm)}</div></div>
            <div class="kv"><div class="kv-k">Cash / Debt</div><div class="kv-v">${fmtCap(der.cash)} / ${fmtCap(der.total_debt)}</div></div>
            <div class="kv" ${tipAttr("target_upside")}><div class="kv-k">Analyst Target Δ ?</div><div class="kv-v ${clsPct(der.target_mean_vs_price_pct)}">${fmtPct(der.target_mean_vs_price_pct, 1)}</div></div>
            <div class="kv" ${tipAttr("vol_ratio")}><div class="kv-k">Vol vs 20d Avg ?</div><div class="kv-v">${fmtNum(ind.vol_ratio_vs_20d, 2)}x <span class="muted">(${fmtCap((facts.last_close || 0) * (facts.last_volume || 0))})</span></div></div>
            <div class="kv" ${tipAttr("updown_vol")}><div class="kv-k">Up/Dn Vol (20d) ?</div><div class="kv-v ${ind.updown_volume_20d != null ? (ind.updown_volume_20d >= 1.2 ? "pos" : ind.updown_volume_20d <= 0.8 ? "neg" : "") : ""}">${fmtNum(ind.updown_volume_20d, 2)}</div></div>
            <div class="kv" ${tipAttr("short_float")}><div class="kv-k">Short % Float ?</div><div class="kv-v">${val.short_pct_float != null ? `${fmtNum(val.short_pct_float * 100, 1)}%` : "—"}</div></div>
            <div class="kv"><div class="kv-k">Earnings</div><div class="kv-v">${esc((cal.earnings_dates || [])[0] || "—")}</div></div>
          </div>
        </div>
      </div>

      ${quantMathPanelHtml}

      <div class="panel">
        <div class="filter-bar-scroll" style="margin:0 -15px 12px;padding:0 15px">
          <div class="filter-bar" id="stockSubTabs">
            <button class="chip ${state.stockTab === "news" ? "active" : ""}" data-stab="news">News (${(t.news || []).length})</button>
            <button class="chip ${state.stockTab === "institutions" ? "active" : ""}" data-stab="institutions">Institutions (${(t.fundamentals?.holders?.institutional || []).length})</button>
            <button class="chip ${state.stockTab === "insiders" ? "active" : ""}" data-stab="insiders">Insiders (${(t.insiders?.items || []).length})</button>
            <button class="chip ${state.stockTab === "filings" ? "active" : ""}" data-stab="filings">SEC Filings (${(t.filings || []).length})</button>
            <button class="chip ${state.stockTab === "regulatory" ? "active" : ""}" data-stab="regulatory">Regulatory (${(t.regulatory?.items || []).length})</button>
            <button class="chip ${state.stockTab === "peers" ? "active" : ""}" data-stab="peers">Peers</button>
          </div>
        </div>
        <div id="stockSubContent"></div>
      </div>
    `;

    const renderChartBody = () => {
      const body = $("chartBody");
      if (!body) return;
      destroyInteractiveChart();
      const ov = state.chartOverlays;
      const is1M = state.chartRange === "1M";
      const hasAll = Array.isArray(tech.series_all) && tech.series_all.length > 5;
      const ranges = hasAll ? ["1M", "3M", "6M", "1Y", "5Y", "ALL"] : ["1M", "3M", "6M", "1Y"];
      const at = tech.all_time_stats || null;
      const athBanner = (state.chartRange === "ALL" || state.chartRange === "5Y") && at
        ? `<div class="muted" style="font-size:11.5px;margin-bottom:6px">Since ${esc(at.ipo_date)} · ATH <strong>$${fmtNum(at.ath)}</strong> (${esc(at.ath_date)}, <span class="${clsPct(at.pct_from_ath)}">${fmtPct(at.pct_from_ath, 1)}</span>) · ATL <strong>$${fmtNum(at.atl)}</strong></div>`
        : "";
      body.innerHTML = `
        <div class="chart-toolbar">
          <div class="chart-tabs" id="rangeBar">
            ${ranges.map((r) => `<button class="chip ${state.chartRange === r ? "active" : ""}" data-range="${r}">${r}</button>`).join("")}
            <button class="chip" id="resetChartFitBtn" title="Reset zoom">⟲ Fit</button>
          </div>
          <div class="chart-tabs" id="overlayBar">
            <button class="chip ${ov.sma20 ? "active" : ""}" data-ov="sma20">SMA20</button>
            <button class="chip ${ov.sma50 ? "active" : ""}" data-ov="sma50">SMA50</button>
            <button class="chip ${ov.sma200 ? "active" : ""}" data-ov="sma200">SMA200</button>
            <button class="chip ${ov.sr ? "active" : ""}" data-ov="sr">S/R</button>
          </div>
        </div>
        ${athBanner}
        <div class="tv-legend" id="tvLegend"></div>
        <div class="tv-chart-wrap ${is1M ? "is-1m" : ""}" id="tvChartWrap">
          <div class="tv-chart-box" id="tvChart"></div>
          <div class="tv-day-overlay ${is1M ? "" : "hidden"}" id="tvDayOverlay"></div>
          <div class="tv-day-axis ${is1M ? "" : "hidden"}" id="tvDayAxis"></div>
        </div>`;
      $("rangeBar").querySelectorAll("button[data-range]").forEach((b) => {
        b.onclick = () => { state.chartRange = b.dataset.range; renderChartBody(); };
      });
      $("overlayBar").querySelectorAll("button").forEach((b) => {
        b.onclick = () => { state.chartOverlays[b.dataset.ov] = !state.chartOverlays[b.dataset.ov]; renderChartBody(); };
      });
      mountInteractiveChart(t);
    };

    if (hasSeries) renderChartBody();

    const renderSubTab = () => {
      const box = $("stockSubContent");
      if (state.stockTab === "news") {
        box.innerHTML = (t.news || []).length
          ? `<div class="feed-list">${t.news.slice(0, 18).map((n) => `
              <div class="feed-item">
                <div class="feed-meta">
                  <span class="tag amber">Imp ${fmtNum(n.importance, 0)}</span>
                  <span>${esc(n.source || "")}</span>
                  <span>${esc((n.published || "").replace("T", " ").slice(0, 16))}</span>
                </div>
                <a class="feed-title" href="${esc(n.url || "#")}" target="_blank" rel="noopener">${esc(n.title)}</a>
              </div>`).join("")}</div>`
          : `<div class="muted">No recent news items.</div>`;
      } else if (state.stockTab === "institutions") {
        const inst = t.fundamentals?.holders?.institutional || [];
        box.innerHTML = inst.length
          ? `<div class="level-list">${inst.slice(0, 12).map((h) => `
              <div class="level-row">
                <div>
                  <strong>${esc(h.holder || "")}</strong>
                  <div class="muted">${h.shares ? Number(h.shares).toLocaleString() + " shares" : ""} ${h.reported ? "· " + esc(h.reported) : ""}</div>
                </div>
                <div style="text-align:right">
                  <strong>${h.pct != null ? `${(Number(h.pct) * 100).toFixed(2)}%` : "—"}</strong>
                  <div class="muted">${fmtCap(h.value)}</div>
                </div>
              </div>`).join("")}</div>`
          : `<div class="muted">Institutional holder breakdown unavailable.</div>`;
      } else if (state.stockTab === "filings") {
        box.innerHTML = (t.filings || []).length
          ? `<div class="feed-list">${t.filings.map((f) => `
              <div class="feed-item">
                <div class="feed-meta"><span class="tag">${esc(f.extra?.form || "")}</span><span>${esc((f.published || "").slice(0, 10))}</span></div>
                <a class="feed-title" href="${esc(f.url || "#")}" target="_blank" rel="noopener">${esc(f.title)}</a>
              </div>`).join("")}</div>`
          : `<div class="muted">No recent SEC filings tracked.</div>`;
      } else if (state.stockTab === "insiders") {
        const hdr = `<div class="muted" style="margin-bottom:10px">90d Form 4: <strong>${ins.open_market_buys ?? 0}</strong> buys (${fmtCap(ins.buy_value_usd)}) · <strong>${ins.open_market_sells ?? 0}</strong> sells (${fmtCap(ins.sell_value_usd)})</div>`;
        box.innerHTML = hdr + ((t.insiders?.items || []).length
          ? `<div class="feed-list">${t.insiders.items.map((x) => `
              <div class="feed-item">
                <div class="feed-meta"><span class="tag ${x.extra?.code === "P" ? "bull" : "bear"}">${esc(x.extra?.code || "")}</span><span>${esc((x.published || "").slice(0, 10))}</span></div>
                <a class="feed-title" href="${esc(secHtmlUrl(x.url))}" target="_blank" rel="noopener">${esc(x.title)}</a>
              </div>`).join("")}</div>`
          : `<div class="muted">No Form 4 insider transactions (foreign issuers do not file Form 4).</div>`);
      } else if (state.stockTab === "regulatory") {
        box.innerHTML = (t.regulatory?.items || []).length
          ? `<div class="feed-list">${t.regulatory.items.slice(0, 15).map((x) => `
              <div class="feed-item">
                <div class="feed-meta"><span>${esc(x.source || "")}</span><span>${esc((x.published || "").slice(0, 10))}</span></div>
                <a class="feed-title" href="${esc(secHtmlUrl(x.url))}" target="_blank" rel="noopener">${esc(x.title)}</a>
              </div>`).join("")}</div>`
          : `<div class="muted">No regulatory or legal items found.</div>`;
      } else if (state.stockTab === "peers") {
        const peers = t.sector_context?.peers || [];
        box.innerHTML = peers.length
          ? `<div class="table-wrap"><table class="data-table">
              <thead><tr><th>Peer</th><th class="num">1D</th><th class="num">21D</th><th class="num">63D</th></tr></thead>
              <tbody>${peers.map((p) => `
                <tr data-sym="${esc(p.symbol)}" style="cursor:pointer">
                  <td><strong>${esc(p.symbol)}</strong></td>
                  <td class="num ${clsPct(p.ret_1d)}">${fmtPct(p.ret_1d, 1)}</td>
                  <td class="num ${clsPct(p.ret_21d)}">${fmtPct(p.ret_21d, 1)}</td>
                  <td class="num ${clsPct(p.ret_63d)}">${fmtPct(p.ret_63d, 1)}</td>
                </tr>`).join("")}</tbody></table></div>`
          : `<div class="muted">No peer comparison data.</div>`;
        box.querySelectorAll("tr[data-sym]").forEach((tr) => {
          tr.onclick = () => openStock(tr.dataset.sym);
        });
      }
    };

    $("stockSubTabs").querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        state.stockTab = b.dataset.stab;
        $("stockSubTabs").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        renderSubTab();
      };
    });
    renderSubTab();
    wireSectorLinks($("stockContent"));
    const mathBtn = $("openFullMathModalBtn");
    if (mathBtn) {
      mathBtn.onclick = () => {
        renderFormulasView(t.symbol);
        setView("formulas");
      };
    }

    // Mount interactive Ecosystem Bubble Network for this stock (supports hopping bubble-to-bubble)
    state.stockBubbleCenter = t.symbol;
    state.stockBubbleFilter = "all";
    state.stockBubbleHistory = [t.symbol];
    state.stockBubbleLastEdge = null;
    const mountStockBubbles = () => {
      renderBubbleNetwork(
        $("stockBubbleMount"),
        state.stockBubbleCenter,
        state.stockBubbleFilter,
        (newCenter, newFilter, edgeInfo) => {
          state.stockBubbleCenter = newCenter;
          state.stockBubbleFilter = newFilter;
          if (edgeInfo) state.stockBubbleLastEdge = edgeInfo;
          const existingIdx = state.stockBubbleHistory.indexOf(newCenter);
          if (existingIdx !== -1) {
            state.stockBubbleHistory = state.stockBubbleHistory.slice(0, existingIdx + 1);
          } else {
            state.stockBubbleHistory = [...state.stockBubbleHistory.slice(-7), newCenter];
          }
          mountStockBubbles();
        },
        { history: state.stockBubbleHistory, lastEdge: state.stockBubbleLastEdge, embeddedInStock: true }
      );
    };
    mountStockBubbles();
  }

  // ---- INTERACTIVE CANDLESTICK CHART (TradingView Lightweight Charts) ----
  function destroyInteractiveChart() {
    if (state.tvResizeObs) { state.tvResizeObs.disconnect(); state.tvResizeObs = null; }
    if (state.tvChart) { try { state.tvChart.remove(); } catch {} state.tvChart = null; }
  }

  function mountInteractiveChart(t) {
    const box = $("tvChart");
    if (!box) return;
    if (!window.LightweightCharts) {
      box.innerHTML = `<div class="loading-box"><div class="spinner"></div><p>Loading chart engine…</p></div>`;
      setTimeout(() => { if ($("tvChart") && window.LightweightCharts) { box.innerHTML = ""; mountInteractiveChart(t); } }, 600);
      return;
    }
    destroyInteractiveChart();
    box.innerHTML = "";

    const isLongRange = state.chartRange === "5Y" || state.chartRange === "ALL";
    const rawAll = isLongRange && Array.isArray(t.technical?.series_all) && t.technical.series_all.length
      ? t.technical.series_all
      : (t.technical?.series || []);
    if (!rawAll.length) { box.innerHTML = `<div class="muted">No price history available.</div>`; return; }

    // Precompute exact Close-to-Previous-Close % change on every bar
    const all = rawAll.map((d, i) => {
      const prevC = i > 0 ? rawAll[i - 1].c : d.o;
      const chg1d = prevC ? ((d.c - prevC) / prevC) * 100 : 0;
      return { ...d, prevC, chg1d };
    });

    const n = state.chartRange === "ALL"
      ? all.length
      : ({ "1M": 22, "3M": 66, "6M": 132, "1Y": 260, "5Y": 260 }[state.chartRange] || 132);
    const data = all.slice(-n);
    const is1M = state.chartRange === "1M";

    const dark = document.documentElement.dataset.theme !== "light";
    const css = getComputedStyle(document.documentElement);
    const textCol = css.getPropertyValue("--muted").trim() || "#8899b4";
    const gridCol = dark ? "rgba(148,163,184,0.11)" : "rgba(15,23,42,0.08)";
    const upCol = css.getPropertyValue("--green").trim() || "#22c55e";
    const dnCol = css.getPropertyValue("--red").trim() || "#f43f5e";
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
    };
    const daysBetween = (isoA, isoB) => {
      const [y1, m1, d1] = isoA.split("-").map(Number);
      const [y2, m2, d2] = isoB.split("-").map(Number);
      return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
    };

    const ov = state.chartOverlays;
    const timelinePoints = data.map((d) => {
      const wd = dayOfWeek(d.t);
      return { ...d, isClosed: false, wd, wdLabel: WEEKDAYS[wd] };
    });

    const LC = window.LightweightCharts;
    const chart = LC.createChart(box, {
      width: box.clientWidth,
      height: box.clientHeight,
      layout: { background: { type: "solid", color: "transparent" }, textColor: textCol, fontSize: 11 },
      grid: {
        vertLines: { color: gridCol, visible: !is1M },
        horzLines: { color: gridCol, visible: true },
      },
      crosshair: { mode: LC.CrosshairMode.Normal },
      rightPriceScale: { borderColor: gridCol, scaleMargins: { top: 0.08, bottom: 0.23 }, autoScale: true },
      timeScale: {
        borderColor: gridCol,
        visible: !is1M,
        timeVisible: false,
        rightOffset: 0,
        minBarSpacing: 0.1,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time) => {
          const s = typeof time === "string" ? time : `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
          const [y, m, d] = s.split("-").map(Number);
          if (state.chartRange === "ALL") {
            return m === 1 ? String(y) : `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}`;
          }
          if (state.chartRange === "5Y") {
            return `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}`;
          }
          if (state.chartRange === "1M" || state.chartRange === "3M") {
            return `${MONTHS[(m || 1) - 1]} ${d}`;
          }
          return d <= 7 ? `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}` : `${MONTHS[(m || 1) - 1]} ${d}`;
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });
    state.tvChart = chart;

    const candles = chart.addCandlestickSeries({
      upColor: upCol,
      downColor: dnCol,
      borderUpColor: upCol,
      borderDownColor: dnCol,
      wickUpColor: upCol,
      wickDownColor: dnCol,
      borderVisible: true,
      wickVisible: true,
    });
    candles.setData(timelinePoints.map((d) => (d.isClosed ? { time: d.t } : { time: d.t, open: d.o, high: d.h, low: d.l, close: d.c })));

    // Volume histogram at bottom — hide right-axis value badge so volume never collides with dollar prices
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(timelinePoints.map((d) => (d.isClosed ? { time: d.t } : { time: d.t, value: d.v, color: d.c >= d.o ? "rgba(34,197,94,0.38)" : "rgba(244,63,94,0.38)" })));
    const lineDefs = [
      ["sma20", "s20", "#f59e0b"],
      ["sma50", "s50", "#3b82f6"],
      ["sma200", "s200", "#a855f7"],
    ];
    for (const [key, field, color] of lineDefs) {
      if (!ov[key]) continue;
      const pts = data.filter((d) => d[field] != null).map((d) => ({ time: d.t, value: d[field] }));
      if (!pts.length) continue;
      const s = chart.addLineSeries({ color, lineWidth: 1.6, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(pts);
    }

    // Only draw S/R price lines within the visible price range (±12%) so distant S2/S3 labels never stack at the bottom of the axis
    if (ov.sr) {
      const visLow = Math.min(...data.map((d) => d.l));
      const visHigh = Math.max(...data.map((d) => d.h));
      const minP = visLow * 0.88;
      const maxP = visHigh * 1.12;
      const lv = t.technical?.computed?.levels || {};
      for (const x of [...(lv.support || []), ...(lv.resistance || [])]) {
        if (x.price == null || x.price < minP || x.price > maxP) continue;
        candles.createPriceLine({
          price: x.price,
          color: x.role === "support" ? upCol : dnCol,
          lineWidth: 1,
          lineStyle: LC.LineStyle.Dashed,
          axisLabelVisible: true,
          title: x.label || "",
        });
      }
    }

    // Day-by-day separation for 1M (Monthly Series): every single trading day has its own vertical column separator,
    // its own bottom date tick centered under its candle, and its own separate daily card in the monthly strip.
    const dayOverlay = $("tvDayOverlay");
    const dayAxis = $("tvDayAxis");
    const dailyStrip = $("tvDailyStrip");

    const sync1MDayColumns = () => {
      if (!is1M || !state.tvChart || !dayOverlay || !dayAxis) return;
      const ts = state.tvChart.timeScale();
      const rightAxisW = state.tvChart.priceScale("right")?.width?.() || 58;
      const plotW = Math.max(100, box.clientWidth - rightAxisW);
      dayOverlay.style.right = `${rightAxisW}px`;
      dayAxis.style.paddingRight = `${rightAxisW}px`;

      const coords = timelinePoints.map((d) => {
        const x = ts.timeToCoordinate(d.t);
        return { d, x: x != null ? Number(x) : null };
      }).filter((item) => item.x != null && item.x >= 0 && item.x <= plotW);

      if (!coords.length) return;

      // Vertical separator line between every single day + collision-free Weekend (Sat–Sun) markers
      const sepLines = [];
      let lastWkndPillX = -999;
      for (let i = 0; i < coords.length; i++) {
        const cur = coords[i];
        if (i > 0) {
          const prev = coords[i - 1];
          const midXNum = (prev.x + cur.x) / 2;
          const midX = midXNum.toFixed(1);
          const gapDays = daysBetween(prev.d.t, cur.d.t);
          if (gapDays >= 2) {
            const showPill = midXNum >= 26 && midXNum <= plotW - 26 && (midXNum - lastWkndPillX) >= 54;
            if (showPill) lastWkndPillX = midXNum;
            sepLines.push(
              `<div class="tv-day-sep wknd-sep" style="left:${midX}px">` +
                (showPill ? `<span class="wknd-pill" title="US Equity Markets Closed (Saturday–Sunday)">Sat–Sun</span>` : "") +
              `</div>`
            );
          } else {
            sepLines.push(`<div class="tv-day-sep" style="left:${midX}px"></div>`);
          }
        }
      }
      dayOverlay.innerHTML = sepLines.join("");

      // Collision-free X-axis ticks: automatically adapts density to screen width & zoom level so labels NEVER overlap or clip
      const minGap = plotW < 440 ? 44 : 38;
      const edgePad = 20;
      const picked = [];
      let lastLabelX = -999;
      let prevMonthSeen = null;

      for (let idx = 0; idx < coords.length; idx++) {
        const { d, x } = coords[idx];
        const [, m, dayNum] = d.t.split("-").map(Number);
        const isMonthStart = prevMonthSeen !== null && m !== prevMonthSeen;
        prevMonthSeen = m;
        const isFirst = idx === 0;
        const isLast = idx === coords.length - 1;
        const clampedX = Math.max(edgePad, Math.min(plotW - edgePad, x));

        if (isFirst) {
          picked.push({ d, x: clampedX, m, dayNum, showMonth: true });
          lastLabelX = clampedX;
        } else if (isLast) {
          if (clampedX - lastLabelX >= minGap) {
            picked.push({ d, x: clampedX, m, dayNum, showMonth: picked[picked.length - 1]?.m !== m });
          } else if (picked.length > 1 && clampedX - picked[picked.length - 2].x >= minGap) {
            // Replace penultimate tick with the final bar's date so the latest trading day is always cleanly visible
            picked[picked.length - 1] = { d, x: clampedX, m, dayNum, showMonth: picked[picked.length - 2]?.m !== m };
          }
        } else if (clampedX - lastLabelX >= minGap) {
          const lastM = picked[picked.length - 1]?.m;
          picked.push({ d, x: clampedX, m, dayNum, showMonth: isMonthStart || lastM !== m });
          lastLabelX = clampedX;
        } else if (isMonthStart && picked.length > 1 && clampedX - picked[picked.length - 2].x >= minGap) {
          // Prefer showing the first trading day of a new month over the immediately preceding tick
          picked[picked.length - 1] = { d, x: clampedX, m, dayNum, showMonth: true };
          lastLabelX = clampedX;
        }
      }

      dayAxis.innerHTML = picked.map(({ d, x, m, dayNum, showMonth }) => {
        const mLabel = MONTHS[(m || 1) - 1];
        const topLabel = showMonth ? `${mLabel} ${dayNum}` : `${dayNum}`;
        const subLabel = d.wdLabel;
        const tip = `${d.t} (${d.wdLabel}): Close $${fmtNum(d.c)} (${fmtPct(d.chg1d, 2)})`;
        return `
          <div class="tv-day-tick" data-day="${esc(d.t)}" style="left:${x.toFixed(1)}px" title="${esc(tip)}">
            <span class="tv-day-num">${esc(topLabel)}</span>
            <span class="tv-day-mon">${esc(subLabel)}</span>
          </div>`;
      }).join("");
    };

    const fitAllBars = () => {
      if (!state.tvChart) return;
      state.tvChart.timeScale().fitContent();
      if (is1M) sync1MDayColumns();
    };

    fitAllBars();
    requestAnimationFrame(fitAllBars);
    setTimeout(fitAllBars, 60);

    const resetBtn = $("resetChartFitBtn");
    if (resetBtn) resetBtn.onclick = fitAllBars;

    if (is1M) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        requestAnimationFrame(sync1MDayColumns);
      });
    }

    const legend = $("tvLegend");
    const highlightDay = (dateStr) => {
      if (!is1M) return;
      dayAxis?.querySelectorAll(".tv-day-tick").forEach((el) => {
        el.classList.toggle("active", el.dataset.day === dateStr);
      });
      dailyStrip?.querySelectorAll(".daily-bar-cell").forEach((el) => {
        el.classList.toggle("active", el.dataset.day === dateStr);
      });
    };

    const setLegend = (d) => {
      if (!legend || !d) return;
      if (d.isClosed) {
        legend.innerHTML = `
          <span><strong>${esc(d.t)} (${esc(d.wdLabel)})</strong></span>
          <span class="tag amber">${esc(d.reason)}</span>`;
        highlightDay(d.t);
        return;
      }
      const chg = d.chg1d ?? 0;
      const wd = d.wdLabel || WEEKDAYS[dayOfWeek(d.t)];
      legend.innerHTML = `
        <span><strong>${esc(d.t)} (${esc(wd)})</strong></span>
        <span>O ${fmtNum(d.o)}</span><span>H ${fmtNum(d.h)}</span><span>L ${fmtNum(d.l)}</span>
        <span>C <strong class="${clsPct(chg)}">${fmtNum(d.c)}</strong></span>
        <span class="${clsPct(chg)}" title="Close vs previous trading day's close (${fmtNum(d.prevC)})"><strong>${fmtPct(chg)}</strong> (1D)</span>
        <span class="muted">Vol ${Number(d.v || 0).toLocaleString()}</span>`;
      highlightDay(d.t);
    };
    const byTime = Object.fromEntries(timelinePoints.map((d) => [d.t, d]));

    setLegend(data[data.length - 1]);
    chart.subscribeCrosshairMove((p) => {
      if (!p || !p.time) { setLegend(data[data.length - 1]); return; }
      const key = typeof p.time === "string" ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, "0")}-${String(p.time.day).padStart(2, "0")}`;
      setLegend(byTime[key] || data[data.length - 1]);
    });

    if (window.ResizeObserver) {
      let lastW = box.clientWidth;
      state.tvResizeObs = new ResizeObserver(() => {
        if (state.tvChart && box.clientWidth) {
          const widthChanged = Math.abs(box.clientWidth - lastW) > 2;
          lastW = box.clientWidth;
          state.tvChart.applyOptions({ width: box.clientWidth, height: box.clientHeight });
          if (widthChanged) {
            state.tvChart.timeScale().fitContent();
          }
          if (is1M) sync1MDayColumns();
        }
      });
      state.tvResizeObs.observe(box);
    }
  }

  // ---- EVENTS ----
  function wireEvents() {
    $("brandHome").onclick = () => setView("overview");
    $("backToOverview").onclick = () => closeStockTab();
    $("viewAllScreenerBtn").onclick = () => setView("screener");

    document.querySelectorAll("#mainNav .nav-tab").forEach((btn) => {
      btn.onclick = () => setView(btn.dataset.view);
    });

    $("dateSelect").onchange = () => loadDate($("dateSelect").value);
    if ($("openMathGuideBtn")) $("openMathGuideBtn").onclick = openMathGuideModal;
    if ($("installAppBtn")) $("installAppBtn").onclick = openAppInstallModal;
    if ($("infoModalCloseBg")) $("infoModalCloseBg").onclick = closeInfoModal;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
    });

    if ($("sectorSelect")) {
      $("sectorSelect").onchange = () => {
        state.activeSector = $("sectorSelect").value || null;
        renderScreener();
      };
    }

    $("filterBar").querySelectorAll(".chip[data-filter]").forEach((chip) => {
      chip.onclick = () => {
        state.filter = chip.dataset.filter;
        $("filterBar").querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.toggle("active", c === chip));
        renderScreener();
      };
    });

    $("clearSectorChip").onclick = () => {
      state.activeSector = null;
      renderScreener();
    };

    $("mobileSortSelect").onchange = () => {
      const [k, d] = $("mobileSortSelect").value.split(":");
      state.sortKey = k;
      state.sortDir = Number(d);
      renderScreener();
    };

    document.querySelectorAll("#screenerTable th[data-sort]").forEach((th) => {
      th.onclick = () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = key === "symbol" || key === "sector" ? 1 : -1; }
        renderScreener();
      };
    });

    const inp = $("quickSearch");
    const dd = $("searchDropdown");
    inp.addEventListener("input", () => {
      const q = inp.value.trim().toLowerCase();
      if (!q || !state.summary) { dd.classList.add("hidden"); return; }
      const hits = (state.summary.tickers || []).filter((t) =>
        t.symbol.toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q)
      ).slice(0, 8);
      if (!hits.length) { dd.classList.add("hidden"); return; }
      dd.innerHTML = hits.map((h) => `
        <div class="search-item" data-sym="${esc(h.symbol)}">
          <span><strong>${esc(h.symbol)}</strong> <span class="muted">${esc(h.name)}</span></span>
          <span class="price-pill ${clsPct(h.change_1d_pct)}" style="font-size:12px">${fmtPct(h.change_1d_pct, 1)}</span>
        </div>
      `).join("");
      dd.classList.remove("hidden");
      dd.querySelectorAll(".search-item").forEach((el) => {
        el.onclick = () => { inp.value = ""; dd.classList.add("hidden"); openStock(el.dataset.sym); };
      });
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = dd.querySelector(".search-item");
        if (first) first.click();
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) dd.classList.add("hidden");
    });

    const stepTicker = (delta) => {
      const list = (state.summary?.tickers || []).map((x) => x.symbol);
      const idx = list.indexOf(state.activeTicker);
      if (idx === -1 || !list.length) return;
      openStock(list[(idx + delta + list.length) % list.length]);
    };
    $("prevTickerBtn").onclick = () => stepTicker(-1);
    $("nextTickerBtn").onclick = () => stepTicker(1);

    const closeModal = () => {
      closeInfoModal();
    };
    if ($("modalCloseBtn")) $("modalCloseBtn").onclick = closeModal;
    if ($("modalCloseBg")) $("modalCloseBg").onclick = closeModal;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  // ---- HOVER & TOUCH TOOLTIPS FOR SCORES & TECHNICAL TERMS (Viewport-Safe on iOS, Android & Desktop) ----
  function initTooltips() {
    let backdropEl = document.querySelector(".tooltip-backdrop");
    if (!backdropEl) {
      backdropEl = document.createElement("div");
      backdropEl.className = "tooltip-backdrop hidden";
      document.body.appendChild(backdropEl);
    }
    let tipEl = document.querySelector(".floating-tooltip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "floating-tooltip hidden";
      document.body.appendChild(tipEl);
    }

    const isMobileScreen = () => window.innerWidth <= 680 || window.matchMedia("(pointer: coarse)").matches;

    const hideTip = () => {
      tipEl.classList.add("hidden");
      tipEl.classList.remove("mobile-sheet");
      backdropEl.classList.add("hidden");
    };

    backdropEl.addEventListener("click", (e) => {
      e.stopPropagation();
      hideTip();
    });

    const showTip = (target, clientX, clientY, fromClick = false) => {
      const raw = target.getAttribute("data-tip");
      if (!raw) return;
      const [title, body] = raw.includes("|") ? raw.split("|", 2) : ["Definition", raw];
      tipEl.innerHTML = `<button type="button" class="tip-close-btn" aria-label="Close">✕</button><strong>${esc(title)}</strong><span>${esc(body)}</span>`;
      const closeBtn = tipEl.querySelector(".tip-close-btn");
      if (closeBtn) {
        closeBtn.onclick = (e) => { e.stopPropagation(); hideTip(); };
      }

      if (isMobileScreen() && fromClick) {
        tipEl.style.left = "";
        tipEl.style.top = "";
        tipEl.classList.add("mobile-sheet");
        tipEl.classList.remove("hidden");
        backdropEl.classList.remove("hidden");
        return;
      }

      tipEl.classList.remove("mobile-sheet");
      backdropEl.classList.add("hidden");
      tipEl.style.left = "12px";
      tipEl.style.top = "12px";
      tipEl.classList.remove("hidden");

      const rect = tipEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.max(12, Math.min(vw - rect.width - 12, clientX - rect.width / 2));
      let top = clientY - rect.height - 14;
      if (top < 12) top = clientY + 18;
      if (top + rect.height > vh - 12) top = Math.max(12, vh - rect.height - 12);
      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
    };

    document.addEventListener("mouseover", (e) => {
      if (isMobileScreen()) return;
      const el = e.target.closest("[data-tip]");
      if (el) {
        const r = el.getBoundingClientRect();
        showTip(el, r.left + r.width / 2, r.top, false);
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (isMobileScreen()) return;
      if (e.target.closest("[data-tip]")) hideTip();
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest(".floating-tooltip")) return;
      const el = e.target.closest("[data-tip]");
      const isDirectTipTrigger =
        el &&
        (e.target.classList.contains("tip-badge") ||
          el.classList.contains("sc-m-k") ||
          el.classList.contains("kv") ||
          el.classList.contains("kpi-label") ||
          el.classList.contains("score-badge") ||
          !el.closest("tr, .stock-card, .notable-card"));
      if (isDirectTipTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const r = el.getBoundingClientRect();
        showTip(el, r.left + r.width / 2, r.top, true);
      } else {
        hideTip();
      }
    }, true);
    window.addEventListener("scroll", () => {
      if (!tipEl.classList.contains("mobile-sheet")) hideTip();
    }, { passive: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
  }

  // ---- AUTOMATIC INSTALL SCREEN POP-UP (Pops up on top of opening page every time until installed) ----
  function initAutoInstallPrompt() {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInApp = /Telegram|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(ua);
    const appUrl = "https://esrasekerci.github.io/equity-dashboard/";

    let overlay = null;
    const closeOverlay = () => {
      if (overlay) { overlay.remove(); overlay = null; }
    };

    const renderOverlay = (hasNativePrompt) => {
      if (overlay) closeOverlay();
      overlay = document.createElement("div");
      overlay.className = "install-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");

      const stepsHtml = hasNativePrompt
        ? `<p class="install-modal-desc">Install <strong>racenter</strong> directly to your device home screen for full-screen native access.</p>`
        : isIOS
          ? `<div class="install-steps">
               <div><strong>1.</strong> If opened inside Telegram, tap the <strong>Safari compass icon</strong> at the bottom-right first (Apple only allows app installs from Safari).</div>
               <div><strong>2.</strong> In Safari, tap the <strong>Share</strong> button (bottom bar) → scroll down → tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.</div>
             </div>`
          : isInApp
            ? `<div class="install-steps">
                 <div><strong>1.</strong> Tap the browser menu (<strong>⋯ / ⋮</strong>) and choose <strong>Open in Chrome</strong>.</div>
                 <div><strong>2.</strong> Tap <strong>Menu ⋮ → Install App</strong>.</div>
               </div>`
            : `<div class="install-steps">
                 <div><strong>1.</strong> Tap your browser menu (<strong>⋮</strong>) or address-bar install icon.</div>
                 <div><strong>2.</strong> Select <strong>Install App / Add to Home Screen</strong>.</div>
               </div>`;

      overlay.innerHTML = `
        <div class="install-overlay-bg" id="installOverlayBg"></div>
        <div class="install-modal-card">
          <div class="install-modal-hdr">
            <div>
              <div class="install-modal-eyebrow">${isIOS ? "iOS App Installation" : "App Installation"}</div>
              <h2 class="install-modal-title">Install racenter</h2>
            </div>
            <button type="button" class="install-dismiss-btn" id="autoInstallDismissBtn" aria-label="Close">✕</button>
          </div>
          ${stepsHtml}
          <div class="install-modal-actions">
            ${hasNativePrompt ? `<button type="button" class="btn-primary-accent install-modal-primary" id="autoInstallNowBtn">Install racenter Now</button>` : ""}
            ${!hasNativePrompt && isIOS ? `<button type="button" class="btn-primary-accent install-modal-primary" id="copyIosLinkBtn">Copy Link to Open in Safari</button>` : ""}
            <button type="button" class="btn-secondary install-modal-secondary" id="autoInstallLaterBtn">Continue in Browser</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector("#installOverlayBg").onclick = closeOverlay;
      overlay.querySelector("#autoInstallDismissBtn").onclick = closeOverlay;
      overlay.querySelector("#autoInstallLaterBtn").onclick = closeOverlay;

      const copyBtn = overlay.querySelector("#copyIosLinkBtn");
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(appUrl).catch(() => {});
          copyBtn.textContent = "✓ Link Copied — Paste in Safari";
        };
      }

      const nowBtn = overlay.querySelector("#autoInstallNowBtn");
      if (nowBtn) {
        nowBtn.onclick = async () => {
          if (!state.deferredInstallPrompt) return;
          state.deferredInstallPrompt.prompt();
          try {
            const choice = await state.deferredInstallPrompt.userChoice;
            if (choice && choice.outcome === "accepted") {
              closeOverlay();
            }
          } catch {}
          state.deferredInstallPrompt = null;
        };
      }
    };

    // Show the install screen immediately on page open when not running as an installed app
    renderOverlay(Boolean(state.deferredInstallPrompt));

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      renderOverlay(true);
    });

    window.addEventListener("appinstalled", () => {
      state.deferredInstallPrompt = null;
      closeOverlay();
    });
  }

  // ---- BOOT ----
  async function boot() {
    initTheme();
    initTooltips();
    wireEvents();
    initAutoInstallPrompt();
    try {
      state.index = await fetchJson("data/index.json");
      const dates = state.index.dates || [];
      $("dateSelect").innerHTML = dates.map((d) =>
        `<option value="${esc(d.date)}">${esc(d.date)}</option>`
      ).join("");

      const params = new URLSearchParams(location.search);
      const wantedDate = params.get("date");
      const targetDate = dates.some((d) => d.date === wantedDate) ? wantedDate : state.index.latest;
      const wantedTicker = params.get("ticker");
      const wantedView = params.get("view");
      if (wantedView && ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro", "formulas"].includes(wantedView)) state.view = wantedView;

      await loadBreaking();
      await loadAuthorities();
      await loadDate(targetDate, wantedTicker);
    } catch (err) {
      $("loadingState").classList.add("hidden");
      $("errorState").textContent = `Failed to load dashboard index: ${err.message}`;
      $("errorState").classList.remove("hidden");
    }
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  boot();
})();
