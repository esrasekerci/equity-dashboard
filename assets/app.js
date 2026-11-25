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
    chartRange: "1D",
    chartInterval: "auto",
    chartFullscreen: false,
    chartOverlays: { sma20: true, sma50: true, sma200: false, sr: true, weekends: false },
    tvChart: null,
    tvCandles: null,
    tvVol: null,
    tvUpdateLegend: null,
    tvRenderBody: null,
    tvControls: null,
    tvIsIntraday: false,
    tvEffInterval: "1D",
    tvBarCount: 0,
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
    gk_vol:
      "Garman-Klass Realized Volatility (20d / 60d)|OHLC range-based annualized volatility estimator (Garman & Klass, 1980) — 7.4x more statistically efficient than close-to-close standard deviation.",
    capm_beta:
      "CAPM Market Beta & Jensen's Alpha (60d)|OLS regression of daily log-returns against SPY over 60 trading days. Beta measures systematic market sensitivity; Alpha is annualized risk-adjusted excess return.",
    sharpe_sortino:
      "Sharpe & Sortino Ratio (1Y)|Annualized excess return (over 4.2% risk-free rate) divided by total volatility (Sharpe) or downside semi-deviation only (Sortino).",
    var_cvar:
      "Max Drawdown (1Y) & 1D Expected Shortfall / CVaR (95%)|Peak-to-trough 1-year drawdown and Basel III tail-risk Expected Shortfall (average daily loss across the worst 5% of sessions).",
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
    // Cache-bust every data request so iOS/Android PWAs, GitHub Pages CDN (max-age=600) and the service worker never serve yesterday's files
    const bust = url.startsWith("data/") && !/[?&]t=/.test(url) ? `${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "";
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    return res.json();
  }

  // If a newer daily report is published while the app stays open (or resumes from background), switch to it automatically
  let lastFreshCheck = 0;
  async function checkForNewerReport(force = false) {
    if (!state.index || state.reportCheckBusy) return;
    if (!force && Date.now() - lastFreshCheck < 120000) return;
    lastFreshCheck = Date.now();
    state.reportCheckBusy = true;
    try {
      const idx = await fetchJson("data/index.json");
      if (idx && idx.latest && idx.latest !== state.date) {
        state.index = idx;
        const dates = idx.dates || [];
        $("dateSelect").innerHTML = dates.map((d) => `<option value="${esc(d.date)}">${esc(d.date)}</option>`).join("");
        state.tickerCache = {};
        const sy = window.scrollY;
        await loadDate(idx.latest, state.view === "stock" ? state.activeTicker : null);
        await loadBreaking();
        await loadAuthorities();
        if (state.view !== "stock") window.scrollTo({ top: sy, behavior: "instant" });
      }
    } catch {} finally {
      state.reportCheckBusy = false;
    }
  }

  function currentHistoryState() {
    return {
      view: state.view,
      ticker: state.view === "stock" ? state.activeTicker : null,
      date: state.date,
    };
  }

  function syncUrl(push = true) {
    const params = new URLSearchParams();
    if (state.view === "stock" && state.activeTicker) params.set("ticker", state.activeTicker);
    else if (state.view !== "overview") params.set("view", state.view);
    const qs = params.toString();
    const nextUrl = qs ? `${location.pathname}?${qs}` : location.pathname;
    const curUrl = `${location.pathname}${location.search}`;
    const hState = currentHistoryState();
    try {
      if (push && !state.isPopping && nextUrl !== curUrl) {
        history.pushState(hState, "", nextUrl);
      } else {
        history.replaceState(hState, "", nextUrl);
      }
    } catch {}
  }

  function setView(view, opts = {}) {
    const fromHistory = Boolean(opts.fromHistory);
    const replace = Boolean(opts.replace);
    if (state.view && state.view !== view && state.view !== "stock") {
      state.prevView = state.view;
    }
    if (view !== "stock") {
      if (state.chartFullscreen) setChartFullscreen(false);
      destroyInteractiveChart();
    }
    state.view = view;
    for (const v of ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro", "formulas", "stock"]) {
      $(`view-${v}`)?.classList.toggle("hidden", v !== view);
    }
    document.querySelectorAll("#mainNav .nav-tab").forEach((btn) => {
      const isAct = btn.dataset.view === view;
      btn.classList.toggle("active", isAct);
      if (isAct && btn.scrollIntoView) {
        try { btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch {}
      }
    });
    const moreViews = new Set(["breaking", "authorities", "macro", "formulas"]);
    document.querySelectorAll("#mobileBottomNav .mnav-btn").forEach((btn) => {
      if (btn.dataset.moreTrigger) {
        btn.classList.toggle("active", moreViews.has(view));
      } else {
        btn.classList.toggle("active", btn.dataset.view === view);
      }
    });
    document.querySelectorAll("#mobileMoreSheet .more-sheet-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    $("mobileMoreSheet")?.classList.add("hidden");
    const stockTab = $("stockNavTab");
    if (stockTab && state.activeTicker) {
      stockTab.classList.remove("hidden");
      stockTab.innerHTML = `<span>${esc(state.activeTicker)}</span>`;
      if ($("backToOverview")) {
        $("backToOverview").textContent = "← Back";
      }
    }
    if (!fromHistory) {
      syncUrl(!replace);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeStockTab() {
    if (state.chartFullscreen) setChartFullscreen(false);
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

  // ---- THEME (Dark-Only Minimalist Obsidian) ----
  function initTheme() {
    document.documentElement.dataset.theme = "dark";
    try { localStorage.removeItem("eqr_theme"); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#050608");
  }

  // ---- LOAD DATA ----
  async function loadBreaking() {
    try {
      const b = await fetchJson("data/breaking_news.json");
      state.breaking = Array.isArray(b.items) ? b.items : [];
      $("breakingCount").textContent = String(state.breaking.length);
      if ($("moreBreakingCount")) $("moreBreakingCount").textContent = String(state.breaking.length);

    } catch {
      state.breaking = [];
      $("breakingCount").textContent = "0";
      if ($("moreBreakingCount")) $("moreBreakingCount").textContent = "0";
    }
    renderBreaking();
  }

  async function loadAuthorities() {
    try {
      const a = await fetchJson("data/authorities.json");
      state.authorities = Array.isArray(a.items) ? a.items : [];

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
    if ($("moreAuthoritiesCount")) $("moreAuthoritiesCount").textContent = String(items.length);

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
        <button class="modal-close-inline hidden" id="closeInfoModalBtn" aria-label="Close"></button>
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
        <button class="modal-close-inline hidden" id="closeInfoModalBtn" aria-label="Close"></button>
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
        <button class="modal-close-inline hidden" id="closeInfoModalBtn" aria-label="Close"></button>
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
      $("navTickerCount").textContent = String(state.summary.n_tickers || 0);
      if ($("viewAllScreenerBtn")) $("viewAllScreenerBtn").textContent = `View all ${state.summary.n_tickers || 0} →`;
      renderOverview();
      renderScreener();
      renderNetworkView();
      renderSmartMoney();
      renderAuthorities();
      renderMacro();
      renderFormulasView();
      $("loadingState").classList.add("hidden");
      if (openTicker) {
        await openStock(openTicker.toUpperCase(), { replace: true });
      } else if (state.view === "stock" && state.activeTicker) {
        await openStock(state.activeTicker, { replace: true });
      } else {
        setView(state.view, { replace: true });
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

    // Pinned Top Banner when any stock reports Earnings TODAY
    const todayEarnEl = $("todayEarningsBanner");
    if (todayEarnEl) {
      const nowIsoDate = new Date().toISOString().slice(0, 10);
      const earnToday = (s.tickers || []).filter(
        (t) => t.earnings_date && (t.earnings_days === 0 || t.earnings_date === nowIsoDate)
      );
      if (earnToday.length > 0) {
        todayEarnEl.innerHTML = `
          <div class="te-head">
            <span class="te-tag">Earnings Today</span>
          </div>
          <div class="te-pills">
            ${earnToday.map((t) => {
              const officialUrl = secHtmlUrl(t.earnings_url || `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t.symbol)}`);
              return `<a class="ticker-pill te-pill" href="${esc(officialUrl)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><strong>${esc(t.symbol)}</strong><span class="muted">${esc(t.name)}</span><span class="warn">${esc(t.earnings_source || "Official")} ↗</span></a>`;
            }).join("")}
          </div>
        `;
        todayEarnEl.classList.remove("hidden");
      } else {
        todayEarnEl.classList.add("hidden");
      }
    }

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
      return `
      <div class="alert-card${extra > 0 ? " has-more" : ""}" data-expanded="false">
        <div class="alert-title"><span>${esc(c.title)}</span><span class="alert-count">${c.count}</span></div>
        <div class="alert-pills">${c.items.length ? c.items.join("") : `<span class="muted">${c.empty}</span>`}</div>
      </div>
    `;
    }).join("");
    const toggleAlertCard = (card) => {
      if (!card || !card.classList.contains("has-more")) return;
      const nextExpanded = card.dataset.expanded !== "true";
      card.dataset.expanded = String(nextExpanded);
      card.querySelectorAll(".alert-extra-pill").forEach((p) => {
        p.classList.toggle("hidden", !nextExpanded);
        p.style.display = nextExpanded ? "inline-flex" : "none";
      });
    };
    $("alertsSection").onclick = (ev) => {
      if (ev.target.closest("a.ticker-pill")) return;
      const pill = ev.target.closest(".ticker-pill[data-sym]");
      if (pill) {
        openStock(pill.dataset.sym);
        return;
      }
      const card = ev.target.closest(".alert-card.has-more");
      if (card) {
        toggleAlertCard(card);
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

      const EARN_SHOW = 6;
      const renderEarnRow = (t, idx) => {
        const d = t.earnings_days;
        const badgeTxt = d === 0 ? "TODAY" : d === 1 ? "Tomorrow" : d > 1 ? `in ${d}d` : `${Math.abs(d)}d ago`;
        const badgeCls = d >= 0 && d <= 7 ? "amber" : "";
        const officialUrl = secHtmlUrl(t.earnings_url || `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t.symbol)}`);
        const srcLabel = t.earnings_source || "Official";
        const extraCls = idx >= EARN_SHOW ? " earn-extra-row hidden" : "";
        return `
          <a class="level-row${extraCls}" href="${esc(officialUrl)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
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
        <div class="panel earn-panel${upcoming.length > EARN_SHOW ? " has-more" : ""}" data-expanded="false">
          <div class="alert-title" style="margin-bottom:10px"><span>Upcoming Quarterly Earnings</span><span class="alert-count">${upcoming.length}</span></div>
          <div class="level-list">
            ${upcoming.length ? upcoming.map(renderEarnRow).join("") : `<div class="muted">No upcoming earnings dates scheduled yet.</div>`}
          </div>
        </div>
        <div class="panel earn-panel${recent.length > EARN_SHOW ? " has-more" : ""}" data-expanded="false">
          <div class="alert-title" style="margin-bottom:10px"><span>Recently Reported (Last 14 Days)</span><span class="alert-count">${recent.length}</span></div>
          <div class="level-list">
            ${recent.length ? recent.map(renderEarnRow).join("") : `<div class="muted">No earnings reported in the last 14 days.</div>`}
          </div>
        </div>
      `;
      ecGrid.onclick = (ev) => {
        if (ev.target.closest("a.level-row")) return;
        const panel = ev.target.closest(".earn-panel.has-more");
        if (!panel) return;
        const nextExpanded = panel.dataset.expanded !== "true";
        panel.dataset.expanded = String(nextExpanded);
        panel.querySelectorAll(".earn-extra-row").forEach((r) => {
          r.classList.toggle("hidden", !nextExpanded);
          r.style.display = nextExpanded ? "flex" : "none";
        });
      };
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
              ${renderExtMiniHtml(row)}
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
    $("screenerCount").textContent = `${rows.length}`;
    if ($("screenerCohortMeta")) {
      const upCnt = rows.filter((r) => (r.change_1d_pct ?? 0) > 0).length;
      const dnCnt = rows.filter((r) => (r.change_1d_pct ?? 0) < 0).length;
      const rets = rows.map((r) => r.change_1d_pct).filter((v) => v != null && Number.isFinite(Number(v)));
      const avgRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
      $("screenerCohortMeta").innerHTML = rows.length
        ? `<span class="pos">${upCnt} adv</span> · <span class="neg">${dnCnt} dec</span>${avgRet != null ? ` · Avg <strong class="${clsPct(avgRet)}">${fmtPct(avgRet, 2)}</strong>` : ""}`
        : "No matches";
    }

    document.querySelectorAll("#screenerTable th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === state.sortKey);
    });

    // Desktop table rows
    const renderExtMini = (r) => {
      if (r.ext_price == null || !r.ext_label) return "";
      const tag = r.ext_label === "Pre-Market" ? "PM" : "AH";
      return `<div class="ext-mini-line"><span class="muted">${tag} $${fmtNum(r.ext_price)}</span> <span class="${clsPct(r.ext_change_pct)}">${fmtPct(r.ext_change_pct, 2)}</span></div>`;
    };
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
            <strong>${esc(r.symbol)}</strong>
            <div class="muted">${esc(r.name)}</div>
          </td>
          <td><span class="tag sector-link" data-sector="${esc(r.sector)}">${esc(fmtSector(r.sector))}</span></td>
          <td class="num"><strong>$${fmtNum(r.close)}</strong>${renderExtMini(r)}</td>
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
        <div class="stock-card scr-card-pro" data-sym="${esc(r.symbol)}">
          <div class="scr-top">
            <div style="min-width:0">
              <div class="scr-sym-line">
                <span class="scr-sym">${esc(r.symbol)}</span>
                <span class="scr-name">${esc(r.name)}</span>
              </div>
              <div class="scr-sub-line">
                <span class="scr-sector sector-link" data-sector="${esc(r.sector)}">${esc(fmtSector(r.sector))}</span>
                ${earnChip ? `<span>·</span>${earnChip}` : (s1r1 ? `<span class="muted">· ${esc(s1r1)}</span>` : "")}
              </div>
            </div>
            <div class="scr-price-col">
              <div class="scr-price">$${fmtNum(r.close)}</div>
              <span class="price-pill ${clsPct(r.change_1d_pct)}" style="font-size:11.5px;padding:2px 6px">${fmtPct(r.change_1d_pct)}</span>
              ${renderExtMini(r)}
            </div>
          </div>

          <div class="scr-metrics-row">
            <div class="scr-m"><span class="scr-mk" ${notableScoreTipAttr(r)}>Score</span><span class="scr-mv">${fmtNum(r.notable_score, 0)}</span></div>
            <div class="scr-m"><span class="scr-mk" ${tipAttr("rsi14")}>RSI</span><span class="scr-mv ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</span></div>
            <div class="scr-m"><span class="scr-mk" ${tipAttr("rs_spy")}>vs SPY</span><span class="scr-mv ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</span></div>
            <div class="scr-m"><span class="scr-mk" ${tipAttr("sma")}>SMA</span><span class="scr-mv"><div class="sma-dots">${sma}</div></span></div>
          </div>

          <div class="scr-prob-edge" ${techScenarioTipAttr(r.tech_score, r.tech_components, sc)} title="Bull ${sc.bullish}% · Base ${sc.base}% · Bear ${sc.bearish}%">
            <div class="prob-bull" style="width:${sc.bullish}%"></div>
            <div class="prob-base" style="width:${sc.base}%"></div>
            <div class="prob-bear" style="width:${sc.bearish}%"></div>
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
      const maxPanX = fitW * 0.55;
      const maxPanY = fitH * 0.55;
      viewState.panX = Math.max(-maxPanX, Math.min(maxPanX, viewState.panX));
      viewState.panY = Math.max(-maxPanY, Math.min(maxPanY, viewState.panY));
      const vw = fitW / viewState.zoom;
      const vh = fitH / viewState.zoom;
      const vx = baseCX - vw / 2 + viewState.panX;
      const vy = baseCY - vh / 2 + viewState.panY;
      svg.setAttribute("viewBox", `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
      if (resetBtn) resetBtn.textContent = `${Math.round(viewState.zoom * 100)}%`;
      const isZoomed = viewState.zoom > 1.18;
      stage.classList.toggle("is-zoomed", isZoomed);
      stage.style.touchAction = isZoomed ? "none" : "pan-y";
      return { fitW, fitH, vw, vh, vx, vy, rect };
    };

    const MIN_Z = 0.6;
    const MAX_Z = 4.0;
    const defaultZoom = () => (window.innerWidth <= 640 ? 1.12 : 1.0);
    let animFrame = null;
    const cancelAnim = () => { if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; } };

    const animateTo = (targetZoom, targetPanX, targetPanY, ms = 180) => {
      cancelAnim();
      const tz = Math.max(MIN_Z, Math.min(MAX_Z, targetZoom));
      const sz = viewState.zoom, sx = viewState.panX, sy = viewState.panY;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const ease = 1 - Math.pow(1 - p, 3);
        viewState.zoom = sz + (tz - sz) * ease;
        viewState.panX = sx + (targetPanX - sx) * ease;
        viewState.panY = sy + (targetPanY - sy) * ease;
        updateViewBox();
        if (p < 1) animFrame = requestAnimationFrame(step);
        else animFrame = null;
      };
      animFrame = requestAnimationFrame(step);
    };

    // Focal-point zoom: keeps the SVG point under (clientX, clientY) anchored
    const zoomAt = (clientX, clientY, targetZoom, animate = false) => {
      const box = updateViewBox();
      if (!box || box.rect.width < 20) return;
      const newZ = Math.max(MIN_Z, Math.min(MAX_Z, targetZoom));
      const relX = (clientX - box.rect.left) / box.rect.width;
      const relY = (clientY - box.rect.top) / box.rect.height;
      const worldX = box.vx + relX * box.vw;
      const worldY = box.vy + relY * box.vh;
      const newVW = box.fitW / newZ;
      const newVH = box.fitH / newZ;
      const nextPanX = (worldX - relX * newVW) - (baseCX - newVW / 2);
      const nextPanY = (worldY - relY * newVH) - (baseCY - newVH / 2);
      if (animate) {
        animateTo(newZ, nextPanX, nextPanY);
      } else {
        cancelAnim();
        viewState.zoom = newZ;
        viewState.panX = nextPanX;
        viewState.panY = nextPanY;
        updateViewBox();
      }
    };

    updateViewBox();
    requestAnimationFrame(updateViewBox);

    container.querySelector("#bZoomInBtn").onclick = (e) => {
      e.stopPropagation();
      animateTo(viewState.zoom * 1.32, viewState.panX, viewState.panY);
    };
    container.querySelector("#bZoomOutBtn").onclick = (e) => {
      e.stopPropagation();
      animateTo(viewState.zoom / 1.32, viewState.panX, viewState.panY);
    };
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      animateTo(defaultZoom(), 0, 0, 220);
    };

    // Smooth focal wheel/trackpad zoom, pointer-capture pan, double-click zoom, & 2-finger pinch+pan
    let isDragging = false;
    let activePointerId = null;
    let dragMoved = 0;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let pinchState = null;

    stage.style.cursor = "grab";

    stage.addEventListener("wheel", (e) => {
      // Allow normal page vertical scrolling unless pinching (ctrlKey) or already zoomed in
      if (!e.ctrlKey && !e.metaKey && viewState.zoom <= 1.05) return;
      e.preventDefault();
      const sens = e.ctrlKey ? 0.011 : 0.0024;
      const clampedDelta = Math.max(-140, Math.min(140, e.deltaY));
      const factor = Math.exp(-clampedDelta * sens);
      zoomAt(e.clientX, e.clientY, viewState.zoom * factor, false);
    }, { passive: false });

    stage.addEventListener("dblclick", (e) => {
      if (e.target.closest(".bubble-zoom-bar, .orbit-bubble, .center-bubble, .edge-badge")) return;
      e.preventDefault();
      if (viewState.zoom >= 1.9) {
        animateTo(defaultZoom(), 0, 0, 220);
      } else {
        zoomAt(e.clientX, e.clientY, viewState.zoom * 1.65, true);
      }
    });

    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".bubble-zoom-bar")) return;
      // On touchscreens at default zoom, let 1-finger swipe scroll the page cleanly instead of dragging the graph
      if (e.pointerType === "touch" && (pinchState || viewState.zoom <= 1.18)) return;
      cancelAnim();
      isDragging = true;
      activePointerId = e.pointerId;
      dragMoved = 0;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = viewState.panX;
      startPanY = viewState.panY;
      stage.style.cursor = "grabbing";
      try { stage.setPointerCapture(e.pointerId); } catch {}
    });
    stage.addEventListener("pointermove", (e) => {
      if (!isDragging || e.pointerId !== activePointerId || pinchState) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragMoved = Math.max(dragMoved, Math.hypot(dx, dy));
      if (dragMoved > 3) {
        const box = updateViewBox();
        if (!box) return;
        const scaleX = box.vw / Math.max(120, box.rect.width);
        const scaleY = box.vh / Math.max(120, box.rect.height);
        viewState.panX = startPanX - dx * scaleX;
        viewState.panY = startPanY - dy * scaleY;
        updateViewBox();
      }
    });
    const endDrag = (e) => {
      if (e.pointerId !== activePointerId) return;
      isDragging = false;
      activePointerId = null;
      stage.style.cursor = "grab";
      try { stage.releasePointerCapture(e.pointerId); } catch {}
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    stage.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        cancelAnim();
        isDragging = false;
        const t0 = e.touches[0], t1 = e.touches[1];
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const box = updateViewBox();
        if (!box || dist < 10) return;
        const relX = (midX - box.rect.left) / box.rect.width;
        const relY = (midY - box.rect.top) / box.rect.height;
        pinchState = {
          startDist: dist,
          startZoom: viewState.zoom,
          worldX: box.vx + relX * box.vw,
          worldY: box.vy + relY * box.vh,
          fitW: box.fitW,
          fitH: box.fitH,
          rect: box.rect,
        };
      }
    }, { passive: true });
    stage.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && pinchState) {
        e.preventDefault();
        const t0 = e.touches[0], t1 = e.touches[1];
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const newZ = Math.max(MIN_Z, Math.min(MAX_Z, pinchState.startZoom * (dist / pinchState.startDist)));
        const relX = (midX - pinchState.rect.left) / pinchState.rect.width;
        const relY = (midY - pinchState.rect.top) / pinchState.rect.height;
        const newVW = pinchState.fitW / newZ;
        const newVH = pinchState.fitH / newZ;
        viewState.zoom = newZ;
        viewState.panX = (pinchState.worldX - relX * newVW) - (baseCX - newVW / 2);
        viewState.panY = (pinchState.worldY - relY * newVH) - (baseCY - newVH / 2);
        updateViewBox();
      }
    }, { passive: false });
    stage.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchState = null;
    }, { passive: true });

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

      const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u.trim());
      const arts = (Array.isArray(item.articles) ? item.articles : []).filter((a) => a && isHttpUrl(a.url));
      const fallbackNewsUrl = item.type === "co_mention"
        ? `https://news.google.com/search?q=${encodeURIComponent(`${center.symbol} ${item.symbol} stock`)}`
        : null;
      const topUrl = (arts[0] && arts[0].url) || (isHttpUrl(item.source) ? item.source.trim() : null) || fallbackNewsUrl;
      const shownCount = arts.length;
      const totalMentions = Math.max(Number(item.mentions || 0), shownCount);
      const insScaleLabel = item.type === "co_mention" && totalMentions
        ? `${totalMentions} News Co-Mention${totalMentions === 1 ? "" : "s"}`
        : (item.scale || rc.label);
      const insScaleHtml = topUrl && item.type === "co_mention"
        ? `<a class="news-edge-link" href="${esc(shownCount > 1 ? fallbackNewsUrl : topUrl)}" target="_blank" rel="noopener">${esc(insScaleLabel)} ↗</a>`
        : `<span style="color:var(--accent-2)">${esc(insScaleLabel)}</span>`;
      const moreNewsLink = item.type === "co_mention" && fallbackNewsUrl && totalMentions > shownCount
        ? `<a class="rel-article-link" href="${esc(fallbackNewsUrl)}" target="_blank" rel="noopener">Browse all ${esc(center.symbol)} &amp; ${esc(item.symbol)} co-mentioned news <span class="muted">(Google News ↗)</span></a>`
        : "";
      const insArticlesHtml = arts.length
        ? `<div class="rel-articles-wrap" style="margin-top:8px">${arts.map((a) => `
            <a class="rel-article-link" href="${esc(a.url)}" target="_blank" rel="noopener">
              ${esc(a.title)} <span class="muted">(${esc(a.source || "News")}${a.published ? ` · ${esc(a.published)}` : ""}) ↗</span>
            </a>`).join("")}${moreNewsLink}</div>`
        : (topUrl && item.type === "co_mention"
            ? `<div class="rel-articles-wrap" style="margin-top:8px"><a class="rel-article-link" href="${esc(topUrl)}" target="_blank" rel="noopener">${esc(item.note || `Co-mentioned news: ${center.symbol} & ${item.symbol}`)} <span class="muted">(Open News ↗)</span></a></div>`
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
          inspectItem(idx, false);
          inspector?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
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

      // 5. Sector Capital Rotation (All 39 stocks: Signed Dollar Flow & Avg 20d U/D)
      const secMap = new Map();
      for (const t of allTickers) {
        const sec = t.sector || "other";
        if (!secMap.has(sec)) secMap.set(sec, { sector: sec, signedUsd: 0, totalUsd: 0, udList: [], upCnt: 0, dnCnt: 0 });
        const b = secMap.get(sec);
        const dv = Number(t.dollar_volume_usd || 0);
        const chg = Number(t.change_1d_pct || 0);
        b.totalUsd += dv;
        b.signedUsd += chg >= 0 ? dv : -dv;
        if (chg >= 0) b.upCnt++; else b.dnCnt++;
        if (t.updown_vol_20d != null && Number.isFinite(Number(t.updown_vol_20d))) {
          b.udList.push(Number(t.updown_vol_20d));
        }
      }
      const secFlows = [...secMap.values()]
        .map((b) => ({ ...b, avgUd: calcMean(b.udList) }))
        .sort((a, b) => b.signedUsd - a.signedUsd);
      const maxSecAbs = Math.max(1, ...secFlows.map((x) => Math.abs(x.signedUsd)));
      const secLeader = secFlows[0];
      const secLaggard = secFlows[secFlows.length - 1];
      const secBarsHtml = secFlows.map((x) => {
        const isPos = x.signedUsd >= 0;
        const pct = Math.min(100, (Math.abs(x.signedUsd) / maxSecAbs) * 100);
        return `
          <div class="sm-bar-row sec-row" data-sector-open="${esc(x.sector)}">
            <span class="sm-bar-sym sec-sym">${esc(fmtSector(x.sector))}</span>
            <div class="sm-bar-track">
              <div class="sm-bar-fill ${isPos ? "up" : "dn"}" style="width:${pct.toFixed(1)}%"></div>
            </div>
            <span class="sm-bar-val ${isPos ? "pos" : "neg"}">${isPos ? "+" : "-"}${fmtCap(Math.abs(x.signedUsd))}</span>
          </div>`;
      }).join("");

      // 6. 20-Day Quiet Accumulation vs Silent Distribution Leaders (All 39 stocks)
      const withUd = allTickers
        .filter((t) => t.updown_vol_20d != null && Number.isFinite(Number(t.updown_vol_20d)))
        .sort((a, b) => Number(b.updown_vol_20d) - Number(a.updown_vol_20d));
      const topAcc20 = withUd.slice(0, 5);
      const topDist20 = [...withUd].reverse().slice(0, 5);
      const renderUdMini = (list, cls) => list.map((t) => `
        <div class="flow-mini-row" data-sym="${esc(t.symbol)}">
          <span><strong>${esc(t.symbol)}</strong> <span class="muted">${fmtPct(t.change_1d_pct, 1)}</span></span>
          <span class="${cls}" style="font-weight:700;font-variant-numeric:tabular-nums">${fmtNum(t.updown_vol_20d, 2)}x</span>
        </div>`).join("");

      // Executive Flow KPI Strip (4 high-signal cards)
      const kpiEl = $("flowKpiStrip");
      if (kpiEl) {
        const topBuyer = insBuys[0];
        const regimeWord = udMed == null ? "Neutral" : udMed >= 1.15 ? "Accumulation" : udMed <= 0.85 ? "Distribution" : "Balanced";
        const regimeCls = udMed == null ? "" : udMed >= 1.15 ? "pos" : udMed <= 0.85 ? "neg" : "warn";
        kpiEl.innerHTML = `
          <div class="kpi-card">
            <div class="kpi-label">Session Net Surge Flow</div>
            <div class="kpi-val ${clsPct(netFlow)}">${netFlow >= 0 ? "+" : "-"}${fmtCap(Math.abs(netFlow))}</div>
            <div class="kpi-sub">${accPct}% inflow / ${distPct}% outflow (${vf.length} surges)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">20d Tape Regime</div>
            <div class="kpi-val ${regimeCls}">${regimeWord}</div>
            <div class="kpi-sub">Median U/D ${fmtNum(udMed, 2)} · ${udAcc} acc / ${udDist} dist</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Sector Capital Rotation</div>
            <div class="kpi-val" style="font-size:15px;line-height:1.35">
              ${secLeader ? `<span class="pos">${esc(fmtSector(secLeader.sector))}</span>` : "—"}
              <span class="muted"> / </span>
              ${secLaggard ? `<span class="neg">${esc(fmtSector(secLaggard.sector))}</span>` : "—"}
            </div>
            <div class="kpi-sub">Strongest inflow vs heaviest outflow</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">90d Form 4 Insiders</div>
            <div class="kpi-val" style="font-size:16px"><span class="pos">${fmtCap(insBuyUsd)}</span> <span class="muted">/</span> <span class="neg">${fmtCap(insSellUsd)}</span></div>
            <div class="kpi-sub">${insBuys.length} buys vs ${insSells.length} sells${topBuyer ? ` · Top buy: ${esc(topBuyer.symbol)}` : ""}</div>
          </div>
        `;
      }

      chartsEl.innerHTML = `
        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">1. Session Institutional Dollar Flow</span>
            <span class="muted">n = ${vf.length} / ${allTickers.length} (&ge;1.35x vol)</span>
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
              <div class="sm-dl-row"><span class="pos">Accumulation (${accCnt})</span><strong>${fmtCap(accUsd)} (${accPct}%)</strong></div>
              <div class="sm-dl-row"><span class="neg">Distribution (${distCnt})</span><strong>${fmtCap(distUsd)} (${distPct}%)</strong></div>
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
            <span class="muted">All n = ${udVals.length} (O'Neil U/D)</span>
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
            <span class="pos">Acc (&ge;1.2): ${udAcc} (${udAccPct}%)</span>
            <span class="muted">Neutral: ${udNeu} (${udNeuPct}%)</span>
            <span class="neg">Dist (&le;0.8): ${udDist} (${udDistPct}%)</span>
          </div>
          <div class="sm-note-box">${esc(udTakeaway)}</div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">3. Sector Capital Rotation (Session Dollar Flow)</span>
            <span class="muted">Signed turnover across all sectors</span>
          </div>
          <div class="sm-bar-list">${secBarsHtml}</div>
          <div class="sm-note-box">Green bars indicate net inflow (advancing turnover); red bars indicate net outflow. Tap any sector to inspect its constituents.</div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">4. 20-Day Quiet Accumulation vs Distribution Leaders</span>
            <span class="muted">Persistent multi-week tape pressure</span>
          </div>
          <div class="flow-dual-grid">
            <div>
              <div class="flow-dual-hdr pos">Top Accumulation (U/D)</div>
              ${renderUdMini(topAcc20, "pos")}
            </div>
            <div>
              <div class="flow-dual-hdr neg">Top Distribution (U/D)</div>
              ${renderUdMini(topDist20, "neg")}
            </div>
          </div>
          <div class="sm-note-box">Catches stealth institutional buying (&ge;1.2x) and silent distribution (&le;0.8x) over the past 20 trading days even without a 1-day spike.</div>
        </div>

        <div class="sm-chart-card">
          <div class="sm-chart-hdr">
            <span class="sm-chart-title">5. Abnormal Volume Surges (RVOL vs 20d Avg)</span>
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
            <span class="sm-chart-title">6. Short Interest Crowding (% of Float)</span>
            <span class="muted">Top ${Math.min(8, si.length)} of ${si.length} tracked</span>
          </div>
          <div class="sm-stat-strip">
            <div class="sm-stat-cell"><span class="sm-stat-k">Median Short</span><span class="sm-stat-v warn">${fmtNum(siMed, 1)}%</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">&ge;10% Float</span><span class="sm-stat-v neg">${siGt10}</span></div>
            <div class="sm-stat-cell"><span class="sm-stat-k">&ge;20% Extreme</span><span class="sm-stat-v neg">${siGt20}</span></div>
          </div>
          <div class="sm-bar-list">${siBarsHtml}</div>
          <div class="sm-axis-labels"><span>0%</span><span>10%</span><span>20%</span><span>${Math.round(maxSi)}%</span></div>
        </div>
      `;

      chartsEl.querySelectorAll(".sm-bar-row[data-sym], .flow-mini-row[data-sym]").forEach((row) => {
        row.onclick = () => openStock(row.dataset.sym);
      });
      chartsEl.querySelectorAll(".sm-bar-row[data-sector-open]").forEach((row) => {
        row.onclick = () => openSectorModal(row.dataset.sectorOpen);
      });

      if ($("vfCountBadge")) $("vfCountBadge").textContent = `(${vf.length})`;
      if ($("insBuyMeta")) $("insBuyMeta").textContent = `(n = ${insBuys.length} · ${fmtCap(insBuyUsd)})`;
      if ($("insSellMeta")) $("insSellMeta").textContent = `(n = ${insSells.length} · ${fmtCap(insSellUsd)})`;
      if ($("siMeta")) $("siMeta").textContent = `(Median ${fmtNum(siMed, 1)}%)`;
    }

    const renderSurgeCards = (filterVal) => {
      const list = filterVal === "all" ? vf : vf.filter((x) => x.flow === filterVal);
      $("volumeFlowGrid").innerHTML = list.length ? list.map((x) => {
        const isAcc = x.flow === "Accumulation";
        const ud = Number(x.updown_vol_20d || 0);
        const rvol = Number(x.vol_ratio_20d || 0);
        const signal = isAcc
          ? (ud >= 1.2 && rvol >= 1.8 ? "High-Conviction Accumulation" : ud >= 1.1 ? "Confirming Inflow" : "Counter-Trend Bounce")
          : (ud <= 0.8 && rvol >= 1.8 ? "Climax Distribution" : ud <= 0.9 ? "Confirming Outflow" : "Profit-Taking Spike");
        return `
        <div class="notable-card" data-sym="${esc(x.symbol)}">
          <div class="notable-top">
            <div>
              <div class="notable-sym">${esc(x.symbol)} <span class="tag ${isAcc ? "bull" : "bear"}">${esc(x.flow)}</span></div>
              <div class="notable-name">${esc(x.name || "")}</div>
            </div>
            <div style="text-align:right">
              <div class="price-pill ${clsPct(x.change_1d_pct)}">${fmtPct(x.change_1d_pct, 1)}</div>
              <div style="margin-top:4px"><span class="score-badge">${fmtNum(rvol, 2)}x vol</span></div>
            </div>
          </div>
          <div class="muted" style="margin-top:6px">
            Turnover: <strong>${fmtCap(x.dollar_volume_usd)}</strong> · 20d U/D: <strong class="${ud >= 1.2 ? "pos" : ud <= 0.8 ? "neg" : ""}">${fmtNum(ud, 2)}x</strong>
          </div>
          <div class="muted" style="margin-top:3px;font-size:11.5px">${esc(signal)}</div>
        </div>
      `;
      }).join("") : `<div class="panel muted">No ${filterVal === "all" ? "" : filterVal.toLowerCase() + " "}volume surges (&ge; 1.35x) on this session.</div>`;
      $("volumeFlowGrid").querySelectorAll(".notable-card").forEach((el) => {
        el.onclick = () => openStock(el.dataset.sym);
      });
    };

    let activeFlowFilter = "all";
    renderSurgeCards(activeFlowFilter);
    document.querySelectorAll("#flowSurgeFilters [data-flow-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.flowFilter === activeFlowFilter);
      btn.onclick = () => {
        activeFlowFilter = btn.dataset.flowFilter;
        document.querySelectorAll("#flowSurgeFilters [data-flow-filter]").forEach((b) => {
          b.classList.toggle("active", b.dataset.flowFilter === activeFlowFilter);
        });
        renderSurgeCards(activeFlowFilter);
      };
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
    if ($("smWhalePanel")) {
      $("smWhalePanel").classList.toggle("hidden", wf.length === 0);
    }
    $("smWhaleFilings").innerHTML = wf.length ? wf.map((f) => `
      <div class="feed-item">
        <div class="feed-meta">
          <span class="ticker-pill" data-sym="${esc(f.symbol)}"><strong>${esc(f.symbol)}</strong></span>
          <span class="tag amber">${esc(f.form)}</span>
          <span>${esc((f.published || "").slice(0, 10))}</span>
        </div>
        <a class="feed-title" href="${esc(secHtmlUrl(f.url || "#"))}" target="_blank" rel="noopener">${esc(f.title)}</a>
      </div>
    `).join("") : "";
    $("smWhaleFilings").querySelectorAll(".ticker-pill").forEach((p) => { p.onclick = () => openStock(p.dataset.sym); });

    $("smShortInterest").innerHTML = si.length ? si.map((x) => {
      const squeezeTag = x.short_pct_float >= 10 && Number(x.change_1d_pct || 0) >= 2
        ? `<span class="tag bull" style="margin-left:5px">Squeeze</span>`
        : x.short_pct_float >= 20
          ? `<span class="tag bear" style="margin-left:5px">Extreme</span>`
          : "";
      return `
      <div class="level-row" data-sym="${esc(x.symbol)}" style="cursor:pointer">
        <div>
          <strong>${esc(x.symbol)}</strong>
          <span class="muted" style="margin-left:6px">${esc(x.name || "")}</span>${squeezeTag}
        </div>
        <div style="text-align:right">
          <span class="tag ${x.short_pct_float >= 10 ? "bear" : "amber"}">${fmtNum(x.short_pct_float, 1)}% float</span>
          <span class="${clsPct(x.change_1d_pct)}" style="margin-left:6px;font-size:12px;font-weight:700">${fmtPct(x.change_1d_pct, 1)}</span>
        </div>
      </div>
    `;
    }).join("") : `<div class="muted">Short interest unavailable.</div>`;
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

  function fmtSignedDelta(v) {
    if (v == null || !Number.isFinite(Number(v))) return "";
    const n = Number(v);
    return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
  }

  function renderDualStockQuoteHtml(facts) {
    const regClose = Number(facts?.last_close || 0);
    const regPct = facts?.change_1d_pct;
    let regUsd = facts?.change_1d_usd;
    if ((regUsd == null || !Number.isFinite(Number(regUsd))) && regClose > 0 && regPct != null && Number.isFinite(Number(regPct))) {
      const p = Number(regPct);
      const prev = Math.abs(100 + p) > 1e-6 ? regClose / (1 + p / 100) : regClose;
      regUsd = regClose - prev;
    }
    const hasExt = facts?.ext_price != null && Number(facts.ext_price) > 0 && facts?.ext_label;
    const isRegOpen = Boolean(facts?.is_reg_open) || (!hasExt && usMarketSessionLabel() === "MARKET OPEN");
    const regSessTag = isRegOpen
      ? `<span class="quote-sess-tag live"><span class="sess-dot"></span>Market Open</span>`
      : `<span class="quote-sess-tag">At Close</span>`;
    const regUsdHtml = regUsd != null ? `${fmtSignedDelta(regUsd)} ` : "";

    let extBlockHtml = "";
    if (hasExt) {
      const extP = Number(facts.ext_price);
      const extPct = facts.ext_change_pct;
      const extUsd = facts.ext_change_usd != null && Number.isFinite(Number(facts.ext_change_usd))
        ? Number(facts.ext_change_usd)
        : (regClose > 0 ? extP - regClose : null);
      const isPm = String(facts.ext_label).includes("Pre");
      const extUsdHtml = extUsd != null ? `${fmtSignedDelta(extUsd)} ` : "";
      extBlockHtml = `
        <div class="quote-col ext-col">
          <div class="quote-price-row">
            <span class="stock-price ext-price">$${fmtNum(extP)}</span>
            <span class="quote-ccy">USD</span>
          </div>
          <div class="quote-sub-row">
            <span class="quote-delta ${clsPct(extPct)}">${extUsdHtml}${fmtPct(extPct)}</span>
            <span class="quote-sess-tag ${isPm ? "pm" : "ah"}"><span class="sess-dot"></span>${esc(facts.ext_label)}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="stock-price-dual ${hasExt ? "has-ext" : ""}">
        <div class="quote-col reg-col">
          <div class="quote-price-row">
            <span class="stock-price">$${fmtNum(regClose)}</span>
            <span class="quote-ccy">USD</span>
          </div>
          <div class="quote-sub-row">
            <span class="quote-delta ${clsPct(regPct)}">${regUsdHtml}${fmtPct(regPct)}</span>
            ${regSessTag}
          </div>
        </div>
        ${extBlockHtml}
      </div>
    `;
  }

  function syncTickerBundleWithLiveRow(t) {
    if (!t || !state.summary) return t;
    const liveRow = (state.summary.tickers || []).find((x) => x.symbol === t.symbol);
    if (!liveRow || liveRow.close == null) return t;
    const liveClose = Number(liveRow.close);
    const liveChg = liveRow.change_1d_pct != null ? Number(liveRow.change_1d_pct) : null;
    if (!Number.isFinite(liveClose) || liveClose <= 0) return t;

    const tech = (t.technical ||= {});
    const facts = (tech.facts ||= {});
    facts.last_close = liveClose;
    if (liveRow.change_1d_usd != null && Number.isFinite(Number(liveRow.change_1d_usd))) {
      facts.change_1d_usd = Number(liveRow.change_1d_usd);
    }
    if (liveChg != null && Number.isFinite(liveChg)) {
      facts.change_1d_pct = liveChg;
    }
    facts.ext_price = liveRow.ext_price ?? null;
    facts.ext_change_usd = liveRow.ext_change_usd ?? null;
    facts.ext_change_pct = liveRow.ext_change_pct ?? null;
    facts.ext_label = liveRow.ext_label ?? null;
    facts.is_reg_open = Boolean(liveRow.is_reg_open);
    if (liveRow.last_bar) {
      facts.last_bar = liveRow.last_bar;
    }

    // Keep interactive chart's latest daily candle synchronized with the Regular Hero price (never overnight wicks)
    if (Array.isArray(tech.series) && tech.series.length > 0) {
      const lastBar = tech.series[tech.series.length - 1];
      if (liveRow.last_bar && liveRow.last_bar > String(lastBar.t || "")) {
        tech.series.push({
          t: liveRow.last_bar,
          o: liveRow.open || liveClose,
          h: Math.max(liveRow.high || liveClose, liveClose),
          l: Math.min(liveRow.low || liveClose, liveClose),
          c: liveClose,
          v: liveRow.volume || lastBar.v || 0,
          s20: lastBar.s20,
          s50: lastBar.s50,
          s200: lastBar.s200,
        });
      } else {
        lastBar.c = liveClose;
        if (liveRow.high && liveRow.high > (lastBar.h || 0)) lastBar.h = liveRow.high;
        if (liveRow.low && (lastBar.l == null || liveRow.low < lastBar.l)) lastBar.l = liveRow.low;
        if (lastBar.h == null || liveClose > lastBar.h) lastBar.h = liveClose;
        if (lastBar.l == null || liveClose < lastBar.l) lastBar.l = liveClose;
      }
    }
    if (Array.isArray(tech.series_all) && tech.series_all.length > 0) {
      const lastAll = tech.series_all[tech.series_all.length - 1];
      lastAll.c = liveClose;
      if (lastAll.h == null || liveClose > lastAll.h) lastAll.h = liveClose;
      if (lastAll.l == null || liveClose < lastAll.l) lastAll.l = liveClose;
    }
    // For 1D intraday series (which includes Pre-Market & After-Hours), tick with active extended price when off-hours!
    const activeTick = (liveRow.ext_price != null && liveRow.ext_price > 0) ? Number(liveRow.ext_price) : liveClose;
    if (Array.isArray(tech.series_1d) && tech.series_1d.length > 0) {
      const last1d = tech.series_1d[tech.series_1d.length - 1];
      last1d.c = activeTick;
      if (last1d.h == null || activeTick > last1d.h) last1d.h = activeTick;
      if (last1d.l == null || activeTick < last1d.l) last1d.l = activeTick;
    }

    // Recompute Support & Resistance % distance from the synchronized live price
    const lv = tech.computed?.levels;
    if (lv) {
      for (const side of [lv.support || [], lv.resistance || []]) {
        for (const item of side) {
          if (item && item.price > 0) {
            item.distance_pct = Number((((item.price - liveClose) / liveClose) * 100).toFixed(2));
          }
        }
      }
    }
    return t;
  }

  // ---- STOCK DEEP DIVE ----
  async function openStock(sym, opts = {}) {
    state.activeTicker = sym;
    setView("stock", opts);
    $("stockContent").innerHTML = `<div class="loading-box"><div class="spinner"></div><p>Loading ${esc(sym)}…</p></div>`;
    const cacheKey = `${state.date}:${sym}`;
    try {
      if (!state.tickerCache[cacheKey]) {
        state.tickerCache[cacheKey] = await fetchJson(`data/${state.date}/tickers/${sym}.json`);
      }
      syncTickerBundleWithLiveRow(state.tickerCache[cacheKey]);
      renderStock(state.tickerCache[cacheKey]);
      refreshSingleStockRealtime(sym);
    } catch (err) {
      $("stockContent").innerHTML = `<div class="error-box">Could not load ${esc(sym)}: ${esc(err.message)}</div>`;
    }
  }

  function renderStock(t) {
    const tech = t.technical || {};
    const facts = tech.facts || {};
    const comp = tech.computed || {};
    const ind = comp.indicators || {};
    const risk = comp.risk || {};
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
    const dollarVol = (facts.last_close || 0) * (facts.last_volume || 0);
    const activeSignals = [...patterns.map((p) => ({ text: p.label, cls: p.direction === "bullish" ? "bull" : "bear" }))];

    // Single direct link to latest official financial statement (10-Q / 10-K / 20-F bilanço)
    const filingsArr = Array.isArray(t.filings) ? t.filings : [];
    const insArr = Array.isArray(t.insiders?.items) ? t.insiders.items : [];
    const cikMatch = [...filingsArr, ...insArr]
      .map((x) => String(x?.url || "").match(/\/edgar\/data\/(\d+)\//i))
      .find(Boolean);
    const cik = cikMatch ? cikMatch[1] : null;
    const secBrowseUrl = cik
      ? `https://www.sec.gov/edgar/browse/?CIK=${cik.padStart(10, "0")}`
      : `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t.symbol)}`;
    const findFiling = (re) => filingsArr.find((f) => re.test(`${f.form || ""} ${f.extra?.form || ""} ${f.title || ""}`));
    const latestReport = findFiling(/\b(10-Q|10-K|20-F|40-F)\b/i) || findFiling(/\b(8-K|6-K)\b/i);
    const reportForm = latestReport
      ? ((`${latestReport.form || ""} ${latestReport.extra?.form || ""} ${latestReport.title || ""}`).match(/\b(10-Q|10-K|20-F|40-F|8-K|6-K)\b/i)?.[1]?.toUpperCase() || "Filing")
      : null;
    const reportDate = latestReport?.published ? String(latestReport.published).slice(0, 10) : "";
    const balanceUrl = latestReport?.url ? secHtmlUrl(latestReport.url) : secBrowseUrl;
    const balanceLabel = reportDate
      ? `Latest Announcement · ${reportDate}`
      : "Latest Announcement";
    const legalBarHtml = `<div class="pro-legal-bar"><a class="pro-legal-chip" href="${esc(balanceUrl)}" target="_blank" rel="noopener">${esc(balanceLabel)} ↗</a></div>`;

    $("stockContent").innerHTML = `
      <div class="stock-hero pro-hero">
        <div class="hero-top">
          <div style="min-width:0">
            <div class="pro-hero-kicker">
              <span class="pro-sector-link sector-link" data-sector="${esc(t.sector)}">${esc(fmtSector(t.sector))}</span>
              ${t.sector_etf ? `<span class="muted">· ${esc(t.sector_etf)}</span>` : ""}
              ${cal.earnings_dates?.[0] ? `<span class="muted">· Earnings ${esc(cal.earnings_dates[0])}</span>` : ""}
            </div>
            <div class="pro-title-row">
              <h1 class="stock-title">${esc(t.symbol)}</h1>
              <span class="pro-company-name">${esc(t.name)}</span>
            </div>
          </div>
          <div class="stock-price-box" id="stockPriceBox">
            ${renderDualStockQuoteHtml(facts)}
          </div>
        </div>

        <div class="pro-stat-strip">
          <div class="pro-stat">
            <span class="pro-stat-k">Mkt Cap</span>
            <span class="pro-stat-v">${fmtCap(val.market_cap)}</span>
          </div>
          <div class="pro-stat" ${tipAttr("rsi14")}>
            <span class="pro-stat-k">RSI 14 <span class="tip-badge">?</span></span>
            <span class="pro-stat-v ${ind.rsi14 < 30 ? "neg" : ind.rsi14 > 70 ? "pos" : ""}">${fmtNum(ind.rsi14, 1)}</span>
          </div>
          <div class="pro-stat" ${tipAttr("vol_ratio")}>
            <span class="pro-stat-k">Rel Vol <span class="tip-badge">?</span></span>
            <span class="pro-stat-v">${fmtNum(ind.vol_ratio_vs_20d, 2)}x</span>
          </div>
          <div class="pro-stat" ${tipAttr("rs_spy")}>
            <span class="pro-stat-k">vs SPY <span class="tip-badge">?</span></span>
            <span class="pro-stat-v ${clsPct(rsSpy21)}">${fmtPct(rsSpy21, 1)}</span>
          </div>
          <div class="pro-stat" ${tipAttr("updown_vol")}>
            <span class="pro-stat-k">20d U/D <span class="tip-badge">?</span></span>
            <span class="pro-stat-v ${ind.updown_volume_20d != null ? (ind.updown_volume_20d >= 1.2 ? "pos" : ind.updown_volume_20d <= 0.8 ? "neg" : "") : ""}">${fmtNum(ind.updown_volume_20d, 2)}x</span>
          </div>
          <div class="pro-stat" ${notableScoreTipAttr(t)}>
            <span class="pro-stat-k">Score <span class="tip-badge">?</span></span>
            <span class="pro-stat-v">${fmtNum(t.notable?.score, 0)}<span class="muted">/100</span></span>
          </div>
        </div>

        ${activeSignals.length ? `
        <div class="hero-tags" style="margin-top:10px">
          ${activeSignals.map((s) => `<span class="tag ${s.cls}">${esc(s.text)}</span>`).join("")}
        </div>` : ""}
        ${legalBarHtml}
        ${rangeHtml}
      </div>

      <div class="quick-jump-bar" id="stockJumpBar" aria-label="Jump to stock section">
        <button type="button" class="jump-pill" data-jump="stk-chart">Chart</button>
        <button type="button" class="jump-pill" data-jump="stk-scenarios">Scenarios</button>
        <button type="button" class="jump-pill" data-jump="stk-tearsheet">Levels &amp; Metrics</button>
        <button type="button" class="jump-pill" data-jump="stk-network">Network</button>
        <button type="button" class="jump-pill" data-jump="stk-intel">News &amp; Filings</button>
      </div>

      ${hasSeries ? `
      <div class="chart-card pro-card" id="stk-chart">
        <div id="chartBody"></div>
      </div>` : ""}

      <div class="section-header" id="stk-scenarios">
        <div>
          <h2 ${techScenarioTipAttr(judg.score, judg.components, scByName)}>20-Day Scenario Matrix <span class="tip-badge">?</span></h2>
          <p class="section-sub">Technical composite ${fmtNum(judg.score, 2)}</p>
        </div>
        <button class="link-btn" id="openFullMathModalBtn">Methodology →</button>
      </div>
      <div class="prob-bar wide">
        <div class="prob-bull" style="width:${scByName.bullish || 0}%"></div>
        <div class="prob-base" style="width:${scByName.base || 0}%"></div>
        <div class="prob-bear" style="width:${scByName.bearish || 0}%"></div>
      </div>
      <div class="scenarios-grid">
        ${(judg.scenarios || []).map((sc) => `
          <div class="scenario-card pro-scenario ${esc(sc.name)}">
            <div class="scenario-head">
              <strong style="text-transform:capitalize">${esc(sc.name)}</strong>
              <span class="scenario-prob ${sc.name === "bullish" ? "pos" : sc.name === "bearish" ? "neg" : ""}">${sc.probability_pct}%</span>
            </div>
            <div class="scenario-row"><span class="muted">Trigger</span><div>${esc(sc.trigger?.condition || "—")}</div></div>
            <div class="scenario-row"><span class="muted">Target Zone</span><div><strong>$${fmtNum(sc.target_zone?.low)} – $${fmtNum(sc.target_zone?.high)}</strong></div></div>
            <div class="scenario-row"><span class="muted">Invalidation</span><div>${esc(sc.invalidation?.condition || "—")}</div></div>
          </div>
        `).join("")}
      </div>

      <div class="two-col" id="stk-tearsheet">
        <div class="panel pro-panel">
          <h3 ${tipAttr("sr_levels")}>Support &amp; Resistance Ladder <span class="tip-badge">?</span></h3>
          <div class="level-list">
            ${resLevels.map(renderLevelRow).join("")}
            <div class="level-current">Current · $${fmtNum(facts.last_close)}</div>
            ${supLevels.map(renderLevelRow).join("")}
          </div>
        </div>

        <div class="panel pro-panel">
          <h3>Key Metrics &amp; Fundamentals</h3>
          <div class="pro-kv-table">
            <div class="pro-kv-row" ${tipAttr("sma")}><span class="pro-kv-k">SMA 20 / 50 / 200 <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtNum(ind.sma20, 0)} / ${fmtNum(ind.sma50, 0)} / ${fmtNum(ind.sma200, 0)}</span></div>
            <div class="pro-kv-row" ${tipAttr("rs_sector")}><span class="pro-kv-k">21d vs ${esc(t.sector_etf || "Sector")} <span class="tip-badge">?</span></span><span class="pro-kv-v ${clsPct(rsSec21)}">${fmtPct(rsSec21, 1)}</span></div>
            <div class="pro-kv-row" ${tipAttr("pe")}><span class="pro-kv-k">P/E (TTM / Fwd) <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtNum(val.trailing_pe, 1)} / ${fmtNum(val.forward_pe, 1)}</span></div>
            <div class="pro-kv-row" ${tipAttr("fcf")}><span class="pro-kv-k">Free Cash Flow (TTM) <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtCap(der.free_cash_flow_ttm)}</span></div>
            <div class="pro-kv-row"><span class="pro-kv-k">Cash / Total Debt</span><span class="pro-kv-v">${fmtCap(der.cash)} / ${fmtCap(der.total_debt)}</span></div>
            <div class="pro-kv-row" ${tipAttr("target_upside")}><span class="pro-kv-k">Analyst Target Implied <span class="tip-badge">?</span></span><span class="pro-kv-v ${clsPct(der.target_mean_vs_price_pct)}">${fmtPct(der.target_mean_vs_price_pct, 1)}</span></div>
            <div class="pro-kv-row" ${tipAttr("vol_ratio")}><span class="pro-kv-k">Session Dollar Turnover <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtCap(dollarVol)}</span></div>
            <div class="pro-kv-row" ${tipAttr("updown_vol")}><span class="pro-kv-k">20d Up/Down Volume <span class="tip-badge">?</span></span><span class="pro-kv-v ${ind.updown_volume_20d != null ? (ind.updown_volume_20d >= 1.2 ? "pos" : ind.updown_volume_20d <= 0.8 ? "neg" : "") : ""}">${fmtNum(ind.updown_volume_20d, 2)}x</span></div>
            <div class="pro-kv-row" ${tipAttr("short_float")}><span class="pro-kv-k">Short Interest (% Float) <span class="tip-badge">?</span></span><span class="pro-kv-v">${val.short_pct_float != null ? `${fmtNum(val.short_pct_float * 100, 1)}%` : "—"}</span></div>
            ${risk.realized_vol_20d_pct != null ? `<div class="pro-kv-row" ${tipAttr("gk_vol")}><span class="pro-kv-k">Realized Vol (20d / 60d GK) <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtNum(risk.realized_vol_20d_pct, 1)}% / ${fmtNum(risk.realized_vol_60d_pct, 1)}%</span></div>` : ""}
            ${risk.capm_beta_60d != null ? `<div class="pro-kv-row" ${tipAttr("capm_beta")}><span class="pro-kv-k">CAPM Beta / Alpha (60d) <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtNum(risk.capm_beta_60d, 2)}x <span class="${clsPct(risk.jensen_alpha_60d_pct)}">(${fmtPct(risk.jensen_alpha_60d_pct, 1)})</span></span></div>` : ""}
            ${risk.sharpe_1y != null ? `<div class="pro-kv-row" ${tipAttr("sharpe_sortino")}><span class="pro-kv-k">Sharpe / Sortino (1Y) <span class="tip-badge">?</span></span><span class="pro-kv-v">${fmtNum(risk.sharpe_1y, 2)} / ${fmtNum(risk.sortino_1y, 2)}</span></div>` : ""}
            ${risk.max_drawdown_1y_pct != null ? `<div class="pro-kv-row" ${tipAttr("var_cvar")}><span class="pro-kv-k">Max DD (1Y) / 1D CVaR 95% <span class="tip-badge">?</span></span><span class="pro-kv-v neg">${fmtNum(risk.max_drawdown_1y_pct, 1)}% / ${fmtNum(risk.cvar_95_1d_pct, 2)}%</span></div>` : ""}
            <div class="pro-kv-row"><span class="pro-kv-k">Next Earnings</span><span class="pro-kv-v">${esc((cal.earnings_dates || [])[0] || "—")}</span></div>
          </div>
        </div>
      </div>

      <div id="stk-network">
        <div id="stockBubbleMount"></div>
      </div>

      <div class="panel pro-panel" id="stk-intel" style="margin-top:16px">
        <div class="pro-subtabs" id="stockSubTabs">
          <button type="button" class="pro-subtab ${state.stockTab === "news" ? "active" : ""}" data-stab="news">News <span class="muted">${(t.news || []).length}</span></button>
          <button type="button" class="pro-subtab ${state.stockTab === "institutions" ? "active" : ""}" data-stab="institutions">Institutions <span class="muted">${(t.fundamentals?.holders?.institutional || []).length}</span></button>
          <button type="button" class="pro-subtab ${state.stockTab === "insiders" ? "active" : ""}" data-stab="insiders">Insiders <span class="muted">${(t.insiders?.items || []).length}</span></button>
          <button type="button" class="pro-subtab ${state.stockTab === "filings" ? "active" : ""}" data-stab="filings">SEC Filings <span class="muted">${(t.filings || []).length}</span></button>
          <button type="button" class="pro-subtab ${state.stockTab === "regulatory" ? "active" : ""}" data-stab="regulatory">Regulatory <span class="muted">${(t.regulatory?.items || []).length}</span></button>
          <button type="button" class="pro-subtab ${state.stockTab === "peers" ? "active" : ""}" data-stab="peers">Peers</button>
        </div>
        <div id="stockSubContent"></div>
      </div>
    `;

    $("stockJumpBar")?.querySelectorAll(".jump-pill[data-jump]").forEach((btn) => {
      btn.onclick = () => {
        const el = $(btn.dataset.jump);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });

    const renderChartBody = () => {
      const body = $("chartBody");
      if (!body) return;
      destroyInteractiveChart();
      const card = $("stk-chart");
      if (card) card.classList.toggle("is-fullscreen", state.chartFullscreen);
      const ov = state.chartOverlays;
      const hasAll = Array.isArray(tech.series_all) && tech.series_all.length > 5;
      const ranges = hasAll
        ? ["1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "ALL"]
        : ["1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y"];
      if (!ranges.includes(state.chartRange)) state.chartRange = "3M";
      const effIv = resolveEffectiveInterval(state.chartRange, state.chartInterval, hasAll);
      state.tvEffInterval = effIv;
      const intervals = hasAll
        ? [
            { id: "1m", label: "1m" },
            { id: "5m", label: "5m" },
            { id: "15m", label: "15m" },
            { id: "1H", label: "1H" },
            { id: "1D", label: "1D" },
            { id: "1W", label: "1W" },
            { id: "1Mo", label: "1Mo" },
          ]
        : [
            { id: "1m", label: "1m" },
            { id: "5m", label: "5m" },
            { id: "15m", label: "15m" },
            { id: "1H", label: "1H" },
            { id: "1D", label: "1D" },
          ];
      const is1M = !state.chartFullscreen && state.chartRange === "1M" && effIv === "1D";
      const at = tech.all_time_stats || null;
      const athBanner = (state.chartRange === "ALL" || state.chartRange === "5Y" || state.chartRange === "3Y") && at
        ? `<div class="muted tv-ath-banner" style="font-size:11.5px;margin-bottom:5px">Since ${esc(at.ipo_date)} · ATH <strong>$${fmtNum(at.ath)}</strong> (${esc(at.ath_date)}, <span class="${clsPct(at.pct_from_ath)}">${fmtPct(at.pct_from_ath, 1)}</span>) · ATL <strong>$${fmtNum(at.atl)}</strong></div>`
        : "";
      body.innerHTML = `
        <div class="chart-fs-bar">
          <div class="chart-fs-title">
            <strong>${esc(t.symbol)}</strong>
            <span class="muted">${esc(t.name)}</span>
          </div>
          <div class="chart-fs-quote">
            <strong id="chartFsPrice">$${fmtNum(facts.last_close)}</strong>
            <span class="price-pill ${clsPct(facts.change_1d_pct)}" id="chartFsPill">${fmtPct(facts.change_1d_pct)}</span>
            <span class="ext-fs-inline ${facts.ext_price != null ? "" : "hidden"}" id="chartFsExt">${facts.ext_price != null ? `${esc(facts.ext_label === "Pre-Market" ? "PM" : "AH")} $${fmtNum(facts.ext_price)} (${fmtPct(facts.ext_change_pct)})` : ""}</span>
            <button type="button" class="chart-fs-exit-btn" id="exitChartFsTopBtn" aria-label="Exit full screen">⤡ Exit</button>
          </div>
        </div>
        <div class="tv-toolbar-pro">
          <div class="tv-range-row">
            <div class="tv-range-strip" id="rangeBar" role="tablist" aria-label="Timeframe range">
              ${ranges.map((r) => `<button type="button" class="tv-rbtn ${state.chartRange === r && state.chartInterval === "auto" ? "active" : (state.chartRange === r ? "sub-active" : "")}" data-range="${r}">${r}</button>`).join("")}
            </div>
            <div class="tv-quick-actions">
              <button type="button" class="tv-act-btn" id="chartZoomOutTopBtn" title="Zoom out (−)" aria-label="Zoom out">−</button>
              <button type="button" class="tv-act-btn" id="chartZoomInTopBtn" title="Zoom in (+)" aria-label="Zoom in">+</button>
              <button type="button" class="tv-act-btn" id="resetChartFitBtn" title="Reset view" aria-label="Reset view">⟲</button>
              <button type="button" class="tv-act-btn tv-fs-trigger ${state.chartFullscreen ? "active" : ""}" id="toggleChartFsBtn" title="${state.chartFullscreen ? "Exit full screen (Esc)" : "Full screen chart"}" aria-label="Toggle full screen">${state.chartFullscreen ? "⤡" : "⛶"}</button>
            </div>
          </div>
          <div class="tv-subbar-row">
            <div class="tv-iv-strip" id="intervalBar" aria-label="Candle interval">
              <span class="tv-iv-lbl">Candle</span>
              ${intervals.map((iv) => `<button type="button" class="tv-ivbtn ${effIv === iv.id ? "active" : ""}" data-iv="${iv.id}">${iv.label}</button>`).join("")}
            </div>
            <div class="tv-ind-strip" id="overlayBar">
              <span class="chart-live-tag"><span class="live-dot"></span>LIVE</span>
              <button type="button" class="tv-ibtn ${ov.sma20 ? "active" : ""}" data-ov="sma20">MA20</button>
              <button type="button" class="tv-ibtn ${ov.sma50 ? "active" : ""}" data-ov="sma50">MA50</button>
              <button type="button" class="tv-ibtn ${ov.sma200 ? "active" : ""}" data-ov="sma200">MA200</button>
              <button type="button" class="tv-ibtn ${ov.sr ? "active" : ""}" data-ov="sr">S/R</button>
            </div>
          </div>
        </div>
        ${athBanner}
        <div class="tv-legend" id="tvLegend"></div>
        <div class="tv-chart-wrap ${is1M ? "is-1m" : ""}" id="tvChartWrap">
          <div class="tv-chart-box" id="tvChart"></div>
          <div class="tv-day-overlay ${is1M ? "" : "hidden"}" id="tvDayOverlay"></div>
          <div class="tv-day-axis ${is1M ? "" : "hidden"}" id="tvDayAxis"></div>
        </div>
        <div class="tv-nav-dock" id="chartNavDock">
          <div class="tv-dock-scrubber-row">
            <span class="tv-span-badge" id="chartVisibleSpan">—</span>
            <input type="range" class="tv-scrubber" id="chartTimeScrubber" min="0" max="1000" value="1000" aria-label="Scroll through historical dates" />
            <label class="tv-date-jump-lbl" title="Jump to specific date">
              <span>Date</span>
              <input type="date" id="chartDateJump" class="tv-date-input" aria-label="Jump to date" />
            </label>
          </div>
          <div class="tv-dock-btns-row">
            <div class="tv-dock-group">
              <button type="button" class="tv-dock-btn" id="chartPanLeftBtn" title="Earlier dates">◀ Earlier</button>
              <button type="button" class="tv-dock-btn" id="chartPanRightBtn" title="Later dates">Later ▶</button>
              <button type="button" class="tv-dock-btn" id="chartJumpLatestBtn" title="Jump to latest real-time candle">Latest ▶|</button>
            </div>
            <div class="tv-dock-group">
              <button type="button" class="tv-dock-btn" id="chartZoomOutBtn" title="Zoom out">− Zoom Out</button>
              <button type="button" class="tv-dock-btn" id="chartZoomInBtn" title="Zoom in">+ Zoom In</button>
              <button type="button" class="tv-dock-btn" id="chartResetDockBtn" title="Fit range">⟲ Fit</button>
            </div>
          </div>
        </div>`;
      $("rangeBar").querySelectorAll("button[data-range]").forEach((b) => {
        b.onclick = () => {
          state.chartRange = b.dataset.range;
          state.chartInterval = "auto";
          renderChartBody();
        };
      });
      $("intervalBar").querySelectorAll("button[data-iv]").forEach((b) => {
        b.onclick = () => {
          state.chartInterval = b.dataset.iv;
          renderChartBody();
        };
      });
      $("overlayBar").querySelectorAll("button[data-ov]").forEach((b) => {
        b.onclick = () => { state.chartOverlays[b.dataset.ov] = !state.chartOverlays[b.dataset.ov]; renderChartBody(); };
      });
      const fsBtn = $("toggleChartFsBtn");
      if (fsBtn) {
        fsBtn.onclick = () => setChartFullscreen(!state.chartFullscreen);
      }
      const exitFsTopBtn = $("exitChartFsTopBtn");
      if (exitFsTopBtn) {
        exitFsTopBtn.onclick = () => setChartFullscreen(false);
      }
      // Auto-scroll active range button into center of strip on narrow screens
      const actR = $("rangeBar")?.querySelector(".tv-rbtn.active, .tv-rbtn.sub-active");
      if (actR?.scrollIntoView) {
        try { actR.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" }); } catch {}
      }
      mountInteractiveChart(t);
    };
    state.tvRenderBody = renderChartBody;

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
  function resolveEffectiveInterval(range, manualIv, hasAll = true) {
    if (manualIv && manualIv !== "auto") return manualIv;
    if (range === "1D") return "5m";
    if (range === "5D") return "15m";
    if (range === "3Y" || range === "5Y") return hasAll ? "1W" : "1D";
    if (range === "ALL") return hasAll ? "1W" : "1D";
    return "1D";
  }

  function setChartFullscreen(on) {
    const next = Boolean(on);
    const prev = state.chartFullscreen;
    state.chartFullscreen = next;
    const card = $("stk-chart");
    if (card) card.classList.toggle("is-fullscreen", next);
    document.body.classList.toggle("no-scroll", next);
    document.body.classList.toggle("chart-fs-open", next);
    if (next && !prev && !state.isPopping) {
      try { history.pushState({ ...currentHistoryState(), overlay: "chart-fs" }, "", location.href); } catch {}
    }
    const fsBtn = $("toggleChartFsBtn");
    if (fsBtn) {
      fsBtn.classList.toggle("active", next);
      fsBtn.textContent = next ? "⤡" : "⛶";
      fsBtn.title = next ? "Exit full screen (Esc)" : "Full screen chart";
    }
    if (state.tvRenderBody && $("chartBody")) {
      requestAnimationFrame(() => {
        if ($("chartBody")) state.tvRenderBody();
      });
    }
  }

  function withRollingSma(bars) {
    if (!Array.isArray(bars) || !bars.length) return [];
    let sum20 = 0, sum50 = 0, sum200 = 0;
    return bars.map((d, i) => {
      const c = Number(d.c || 0);
      sum20 += c;
      sum50 += c;
      sum200 += c;
      if (i >= 20) sum20 -= Number(bars[i - 20].c || 0);
      if (i >= 50) sum50 -= Number(bars[i - 50].c || 0);
      if (i >= 200) sum200 -= Number(bars[i - 200].c || 0);
      const s20 = d.s20 != null ? d.s20 : Number((sum20 / Math.min(20, i + 1)).toFixed(2));
      const s50 = d.s50 != null ? d.s50 : (i >= 9 ? Number((sum50 / Math.min(50, i + 1)).toFixed(2)) : null);
      const s200 = d.s200 != null ? d.s200 : (i >= 39 ? Number((sum200 / Math.min(200, i + 1)).toFixed(2)) : null);
      const prevC = d.prevC != null ? d.prevC : (i > 0 ? bars[i - 1].c : d.o);
      const chg1d = prevC ? ((c - prevC) / prevC) * 100 : 0;
      return { ...d, s20, s50, s200, prevC, chg1d };
    });
  }

  function aggregateMonthlyBars(bars) {
    if (!Array.isArray(bars) || !bars.length) return [];
    const byMonth = new Map();
    for (const b of bars) {
      const iso = typeof b.t === "string" ? b.t : new Date(Number(b.t) * 1000).toISOString().slice(0, 10);
      const ym = iso.slice(0, 7);
      const cur = byMonth.get(ym);
      if (!cur) {
        byMonth.set(ym, {
          t: iso,
          o: b.o,
          h: b.h,
          l: b.l,
          c: b.c,
          v: Number(b.v || 0),
        });
      } else {
        cur.t = iso;
        if (b.h > cur.h) cur.h = b.h;
        if (b.l < cur.l) cur.l = b.l;
        cur.c = b.c;
        cur.v += Number(b.v || 0);
      }
    }
    return withRollingSma([...byMonth.values()]);
  }

  const _etPartsFmt = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return null;
    }
  })();

  function barEtInfo(barT, extHint) {
    if (typeof barT === "string") {
      return { iso: barT.slice(0, 10), mins: 570, isExt: false };
    }
    const tsSec = Number(barT);
    if (!Number.isFinite(tsSec)) return { iso: "", mins: 570, isExt: Boolean(extHint) };
    if (_etPartsFmt) {
      try {
        const parts = _etPartsFmt.formatToParts(new Date(tsSec * 1000));
        const m = {};
        for (const p of parts) m[p.type] = p.value;
        const hh = Number(m.hour || 0) % 24;
        const mm = Number(m.minute || 0);
        const mins = hh * 60 + mm;
        const isExt = extHint != null ? Boolean(extHint) : (mins < 570 || mins >= 960);
        return { iso: `${m.year}-${m.month}-${m.day}`, mins, isExt };
      } catch {}
    }
    const iso = new Date(tsSec * 1000).toISOString().slice(0, 10);
    return { iso, mins: 570, isExt: Boolean(extHint) };
  }

  function cnbcTimeWindowStrings(daysBack) {
    const pad2 = (n) => String(n).padStart(2, "0");
    const fmt = (dt) => `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}000000`;
    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 86400000);
    const end = new Date(now.getTime() + 2 * 86400000);
    return { startStr: fmt(start), endStr: fmt(end) };
  }

  async function fetchCnbcIntradayBars(sym, ivKey) {
    const cnbcSym = sym.replace("-", ".");
    const cfg = ivKey === "1m"
      ? { apiIv: "1M", days: 7, aggSec: 0 }
      : ivKey === "5m"
      ? { apiIv: "5M", days: 14, aggSec: 0 }
      : ivKey === "15m"
      ? { apiIv: "5M", days: 30, aggSec: 900 }
      : ivKey === "1H"
      ? { apiIv: "1H", days: 120, aggSec: 0 }
      : null;
    if (!cfg) return null;
    const { startStr, endStr } = cnbcTimeWindowStrings(cfg.days);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5500);
    try {
      const url = `https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(cnbcSym)}/${cfg.apiIv}/${startStr}/${endStr}/adjusted/EST5EDT.json`;
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      const rawBars = json?.barData?.priceBars || [];
      if (!Array.isArray(rawBars) || rawBars.length < 2) return null;
      const parsed = [];
      const seen = new Set();
      for (const b of rawBars) {
        const tsSec = Math.floor(Number(b.tradeTimeinMills || 0) / 1000);
        const c = Number(b.close);
        if (!Number.isFinite(tsSec) || tsSec <= 0 || seen.has(tsSec) || !Number.isFinite(c) || c <= 0) continue;
        seen.add(tsSec);
        const o = Number.isFinite(Number(b.open)) && Number(b.open) > 0 ? Number(b.open) : c;
        const h = Number.isFinite(Number(b.high)) && Number(b.high) > 0 ? Number(b.high) : c;
        const l = Number.isFinite(Number(b.low)) && Number(b.low) > 0 ? Number(b.low) : c;
        const v = Number.isFinite(Number(b.volume)) ? Math.max(0, Math.round(Number(b.volume))) : 0;
        const tt = String(b.tradeTime || "");
        const hhmm = tt.length >= 12 ? Number(tt.slice(8, 12)) : null;
        const isExt = hhmm != null ? (hhmm < 930 || hhmm >= 1600 ? 1 : 0) : (barEtInfo(tsSec).isExt ? 1 : 0);
        parsed.push({
          t: tsSec,
          o: Number(o.toFixed(2)),
          h: Number(h.toFixed(2)),
          l: Number(l.toFixed(2)),
          c: Number(c.toFixed(2)),
          v,
          ext: isExt,
        });
      }
      parsed.sort((a, b) => a.t - b.t);
      if (cfg.aggSec > 0) {
        const byBucket = new Map();
        for (const b of parsed) {
          const bkt = Math.floor(b.t / cfg.aggSec) * cfg.aggSec;
          const cur = byBucket.get(bkt);
          if (!cur) {
            byBucket.set(bkt, { ...b, t: bkt });
          } else {
            if (b.h > cur.h) cur.h = b.h;
            if (b.l < cur.l) cur.l = b.l;
            cur.c = b.c;
            cur.v += b.v;
          }
        }
        return [...byBucket.values()];
      }
      return parsed;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  const _ivFetchBusy = {};
  async function fetchLiveIntradaySeries(t, ivKey) {
    const sym = t?.symbol;
    if (!sym) return;
    const tech = (t.technical ||= {});
    const cache = (tech._ivCache ||= {});
    const busyKey = `${sym}:${ivKey}`;
    if (_ivFetchBusy[busyKey]) return;
    if (cache[ivKey] && (Date.now() - (cache[ivKey].ts || 0)) < 25000) return;

    const specMap = {
      "1m": { range: "5d", interval: "1m" },
      "5m": { range: "5d", interval: "5m" },
      "15m": { range: "1mo", interval: "15m" },
      "1H": { range: "6mo", interval: "60m" },
    };
    const spec = specMap[ivKey];
    if (!spec) return;

    _ivFetchBusy[busyKey] = true;
    try {
      // 1. Primary direct CORS-native CNBC consolidated bar feed (zero proxy, up-to-the-second Pre-Market/After-Hours + Regular)
      let bars = await fetchCnbcIntradayBars(sym, ivKey);
      let prevClose = Number(tech.prev_close_1d || 0);

      // 2. Fallback to Yahoo Finance via CORS gateway only if direct feed returned empty
      if (!bars || bars.length < 2) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${spec.range}&interval=${spec.interval}&includePrePost=true`;
        const raw = await fetchViaCors(url, 5500);
        if (raw) {
          const parsed = JSON.parse(raw);
          const res0 = parsed?.chart?.result?.[0];
          const tsArr = res0?.timestamp || [];
          const q0 = res0?.indicators?.quote?.[0] || {};
          const meta = res0?.meta || {};
          prevClose = Number(meta.chartPreviousClose || meta.previousClose || prevClose || 0);
          const seen = new Set();
          bars = [];
          for (let i = 0; i < tsArr.length; i++) {
            const tsSec = Number(tsArr[i]);
            const c = Number(q0.close?.[i]);
            if (!Number.isFinite(tsSec) || seen.has(tsSec) || !Number.isFinite(c) || c <= 0) continue;
            seen.add(tsSec);
            const o = Number.isFinite(Number(q0.open?.[i])) && Number(q0.open[i]) > 0 ? Number(q0.open[i]) : c;
            const h = Number.isFinite(Number(q0.high?.[i])) && Number(q0.high[i]) > 0 ? Number(q0.high[i]) : c;
            const l = Number.isFinite(Number(q0.low?.[i])) && Number(q0.low[i]) > 0 ? Number(q0.low[i]) : c;
            const v = Number.isFinite(Number(q0.volume?.[i])) ? Math.max(0, Math.round(Number(q0.volume[i]))) : 0;
            const et = barEtInfo(tsSec);
            bars.push({
              t: tsSec,
              o: Number(o.toFixed(2)),
              h: Number(h.toFixed(2)),
              l: Number(l.toFixed(2)),
              c: Number(c.toFixed(2)),
              v,
              ext: et.isExt ? 1 : 0,
            });
          }
        }
      }

      if (bars && bars.length >= 2) {
        bars.sort((a, b) => a.t - b.t);
        cache[ivKey] = { ts: Date.now(), bars, prevClose };
        if (ivKey === "5m") {
          tech.series_1d = bars.slice(-260);
        }
        if (state.view === "stock" && state.activeTicker === sym && state.tvEffInterval === ivKey && $("tvChart")) {
          mountInteractiveChart(t);
        }
      }
    } catch {} finally {
      _ivFetchBusy[busyKey] = false;
    }
  }

  function destroyInteractiveChart() {
    if (state.tvResizeObs) { state.tvResizeObs.disconnect(); state.tvResizeObs = null; }
    if (state.tvChart) { try { state.tvChart.remove(); } catch {} state.tvChart = null; }
    state.tvCandles = null;
    state.tvVol = null;
    state.tvUpdateLegend = null;
    state.tvControls = null;
  }

  function formatEtIntradayTime(tsSec, withDate = false) {
    try {
      const dt = new Date(Number(tsSec) * 1000);
      if (withDate) {
        return dt.toLocaleString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " ET";
      }
      return dt.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return String(tsSec);
    }
  }

  function barToIsoDate(barT) {
    if (typeof barT === "string") return barT.slice(0, 10);
    return barEtInfo(barT).iso;
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

    const tech = t.technical || {};
    const hasAll = Array.isArray(tech.series_all) && tech.series_all.length > 5;
    const effIv = resolveEffectiveInterval(state.chartRange, state.chartInterval, hasAll);
    state.tvEffInterval = effIv;
    const isIntradayIv = effIv === "1m" || effIv === "5m" || effIv === "15m" || effIv === "1H";

    let data = [];
    let basePrevC = null;
    let useIntraday = false;

    if (isIntradayIv) {
      const ivEntry = tech._ivCache?.[effIv];
      const fallback1d = (effIv === "5m" || effIv === "1m" || effIv === "15m") && Array.isArray(tech.series_1d) && tech.series_1d.length >= 2
        ? tech.series_1d
        : null;
      const rawIntra = ivEntry?.bars?.length >= 2 ? ivEntry.bars : fallback1d;
      // Kick off background fetch for multi-day intraday bars if not yet cached
      if (!ivEntry?.bars?.length) {
        fetchLiveIntradaySeries(t, effIv);
      }
      if (rawIntra && rawIntra.length >= 2) {
        useIntraday = true;
        const seenTs = new Set();
        const clean = [];
        for (const b of rawIntra) {
          const tsNum = Number(b.t);
          if (!Number.isFinite(tsNum) || seenTs.has(tsNum) || !b.c || b.c <= 0) continue;
          seenTs.add(tsNum);
          clean.push({ ...b, t: tsNum });
        }
        clean.sort((a, b) => a.t - b.t);
        const withEt = clean.map((b) => {
          const et = barEtInfo(b.t, b.ext);
          return { ...b, etIso: et.iso, isExt: et.isExt };
        });
        // Find the latest Regular US session date (09:30–16:00 ET) and the prior day's Regular Close
        let latestRegIso = "";
        for (let i = withEt.length - 1; i >= 0; i--) {
          if (!withEt[i].isExt && withEt[i].etIso) {
            latestRegIso = withEt[i].etIso;
            break;
          }
        }
        let priorRegClose = 0;
        if (latestRegIso) {
          for (let i = withEt.length - 1; i >= 0; i--) {
            if (!withEt[i].isExt && withEt[i].etIso && withEt[i].etIso < latestRegIso) {
              priorRegClose = withEt[i].c;
              break;
            }
          }
        }
        const dailySer = tech.series || [];
        const factsRegClose = Number(tech.facts?.last_close || 0);
        const factsRegPct = Number(tech.facts?.change_1d_pct || 0);
        const derivedPrev = factsRegClose > 0 && Math.abs(100 + factsRegPct) > 1e-6
          ? Number((factsRegClose / (1 + factsRegPct / 100)).toFixed(2))
          : 0;
        basePrevC = priorRegClose || derivedPrev || Number(ivEntry?.prevClose || tech.prev_close_1d) || (dailySer.length >= 2 ? dailySer[dailySer.length - 2].c : (withEt[0]?.o || withEt[0]?.c || 0));
        data = withRollingSma(withEt).map((d, i) => {
          const prevC = state.chartRange === "1D" && basePrevC ? basePrevC : (i > 0 ? withEt[i - 1].c : d.o);
          const chg1d = prevC ? ((d.c - prevC) / prevC) * 100 : 0;
          return { ...d, prevC, chg1d, isIntraday: true, latestRegIso };
        });
      }
    }

    if (!data.length) {
      // Build full-history daily, weekly, or monthly series (never truncated so user can pan/zoom across all dates!)
      useIntraday = false;
      const dailyRaw = Array.isArray(tech.series) ? tech.series : [];
      const weeklyRaw = Array.isArray(tech.series_all) ? tech.series_all : [];
      let rawFull = [];
      if (effIv === "1Mo" && weeklyRaw.length) {
        rawFull = aggregateMonthlyBars(weeklyRaw);
      } else if (effIv === "1W" && weeklyRaw.length) {
        rawFull = withRollingSma(weeklyRaw);
      } else if (dailyRaw.length && weeklyRaw.length) {
        // Prepend historical bars older than dailyRaw[0] so scrolling left on 1D candles seamlessly reaches IPO!
        const firstDailyIso = String(dailyRaw[0].t || "");
        const older = weeklyRaw.filter((b) => String(b.t || "") < firstDailyIso);
        rawFull = withRollingSma([...older, ...dailyRaw]);
      } else {
        rawFull = withRollingSma(dailyRaw.length ? dailyRaw : weeklyRaw);
      }
      // Deduplicate and sort ascending by YYYY-MM-DD
      const byIso = new Map();
      for (const b of rawFull) {
        if (b && b.t && b.c > 0) byIso.set(String(b.t).slice(0, 10), { ...b, t: String(b.t).slice(0, 10), isIntraday: false });
      }
      data = [...byIso.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      if (!data.length) {
        box.innerHTML = `<div class="muted">No price history available.</div>`;
        return;
      }
    }

    state.tvIsIntraday = useIntraday;
    state.tvBarCount = data.length;
    const is1M = !state.chartFullscreen && state.chartRange === "1M" && effIv === "1D";

    const dark = document.documentElement.dataset.theme !== "light";
    const css = getComputedStyle(document.documentElement);
    const textCol = css.getPropertyValue("--muted").trim() || "#8899b4";
    const gridCol = dark ? "rgba(148,163,184,0.11)" : "rgba(15,23,42,0.08)";
    const upCol = css.getPropertyValue("--green").trim() || "#22c55e";
    const dnCol = css.getPropertyValue("--red").trim() || "#f43f5e";
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = (iso) => {
      if (typeof iso !== "string") return new Date(Number(iso) * 1000).getUTCDay();
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
    };
    const daysBetween = (isoA, isoB) => {
      const [y1, m1, d1] = String(isoA).split("-").map(Number);
      const [y2, m2, d2] = String(isoB).split("-").map(Number);
      return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
    };

    const ov = state.chartOverlays;
    const timelinePoints = data.map((d) => {
      const wd = dayOfWeek(d.t);
      return { ...d, isClosed: false, wd, wdLabel: WEEKDAYS[wd] };
    });

    const LC = window.LightweightCharts;
    const initW = Math.max(220, box.clientWidth || 320);
    const initH = Math.max(180, box.clientHeight || 300);
    const chart = LC.createChart(box, {
      width: initW,
      height: initH,
      layout: { background: { type: "solid", color: "transparent" }, textColor: textCol, fontSize: 11 },
      grid: {
        vertLines: { color: gridCol, visible: !is1M },
        horzLines: { color: gridCol, visible: true },
      },
      crosshair: { mode: LC.CrosshairMode.Normal },
      kineticScroll: { touch: true, mouse: true },
      rightPriceScale: { borderColor: gridCol, scaleMargins: { top: 0.08, bottom: 0.22 }, autoScale: true },
      timeScale: {
        borderColor: gridCol,
        visible: !is1M,
        timeVisible: useIntraday,
        secondsVisible: false,
        rightOffset: 2,
        minBarSpacing: 0.03,
        fixLeftEdge: true,
        fixRightEdge: false,
        tickMarkFormatter: (time) => {
          if (typeof time === "number") {
            if (effIv === "15m" || effIv === "1H" || state.chartRange === "5D") {
              try {
                return new Date(time * 1000).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
              } catch {}
            }
            return formatEtIntradayTime(time, false);
          }
          const s = typeof time === "string" ? time : `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
          const [y, m, d] = s.split("-").map(Number);
          if (effIv === "1Mo" || (state.chartRange === "ALL" && m === 1)) {
            return m === 1 ? String(y) : `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}`;
          }
          if (d <= 7 && (effIv === "1W" || state.chartRange === "5Y" || state.chartRange === "3Y")) {
            return `${MONTHS[(m || 1) - 1]} '${String(y).slice(2)}`;
          }
          return `${MONTHS[(m || 1) - 1]} ${d} '${String(y).slice(2)}`;
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });
    state.tvChart = chart;

    const extUpCol = "#94a3b8";
    const extDnCol = "#64748b";
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
    candles.setData(timelinePoints.map((d) => {
      if (useIntraday && d.isExt) {
        const ec = d.c >= d.o ? extUpCol : extDnCol;
        return { time: d.t, open: d.o, high: d.h, low: d.l, close: d.c, color: ec, borderColor: ec, wickColor: ec };
      }
      return { time: d.t, open: d.o, high: d.h, low: d.l, close: d.c };
    }));
    state.tvCandles = candles;

    // Volume histogram at bottom — hide right-axis value badge so volume never collides with dollar prices
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(timelinePoints.map((d) => ({
      time: d.t,
      value: d.v,
      color: (useIntraday && d.isExt)
        ? "rgba(148,163,184,0.28)"
        : (d.c >= d.o ? "rgba(34,197,94,0.38)" : "rgba(244,63,94,0.38)"),
    })));
    state.tvVol = vol;

    if (useIntraday && state.chartRange === "1D" && basePrevC && basePrevC > 0) {
      candles.createPriceLine({
        price: basePrevC,
        color: "rgba(148, 163, 184, 0.55)",
        lineWidth: 1,
        lineStyle: LC.LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Prev Close",
      });
    }
    if (useIntraday && state.chartRange === "1D" && tech.facts?.ext_price != null && tech.facts?.last_close > 0) {
      candles.createPriceLine({
        price: Number(tech.facts.last_close),
        color: "rgba(96, 165, 250, 0.5)",
        lineWidth: 1,
        lineStyle: LC.LineStyle.Dotted,
        axisLabelVisible: true,
        title: "At Close",
      });
    }
    const lineDefs = [
      ["sma20", "s20", "#f59e0b"],
      ["sma50", "s50", "#3b82f6"],
      ["sma200", "s200", "#a855f7"],
    ];
    for (const [key, field, color] of lineDefs) {
      if (!ov[key]) continue;
      const pts = timelinePoints.filter((d) => d[field] != null).map((d) => ({ time: d.t, value: d[field] }));
      if (!pts.length) continue;
      const s = chart.addLineSeries({ color, lineWidth: 1.6, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(pts);
    }

    // Draw S/R levels around current price (±22%) so levels are visible as you navigate recent action
    if (ov.sr) {
      const refPrice = Number(tech.facts?.last_close || timelinePoints[timelinePoints.length - 1]?.c || 0);
      const minP = refPrice * 0.76;
      const maxP = refPrice * 1.24;
      const lv = tech.computed?.levels || {};
      for (const x of [...(lv.support || []), ...(lv.resistance || [])]) {
        if (x.price == null || (refPrice > 0 && (x.price < minP || x.price > maxP))) continue;
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

    const dayOverlay = $("tvDayOverlay");
    const dayAxis = $("tvDayAxis");
    const dailyStrip = $("tvDailyStrip");

    const sync1MDayColumns = () => {
      if (!is1M || !state.tvChart || !dayOverlay || !dayAxis) return;
      const ts = state.tvChart.timeScale();
      const rightAxisW = state.tvChart.priceScale("right")?.width?.() || 58;
      const plotW = Math.max(100, box.clientWidth - rightAxisW);
      dayOverlay.style.right = `${rightAxisW}px`;
      dayOverlay.style.height = `${box.clientHeight}px`;
      dayAxis.style.paddingRight = `${rightAxisW}px`;

      const lr = ts.getVisibleLogicalRange();
      const i0 = Math.max(0, Math.floor((lr?.from ?? 0) - 1));
      const i1 = Math.min(timelinePoints.length - 1, Math.ceil((lr?.to ?? timelinePoints.length - 1) + 1));
      const visSlice = timelinePoints.slice(i0, i1 + 1);
      const coords = visSlice.map((d) => {
        const x = ts.timeToCoordinate(d.t);
        return { d, x: x != null ? Number(x) : null };
      }).filter((item) => item.x != null && item.x >= 0 && item.x <= plotW);

      if (!coords.length) return;

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

      const minGap = plotW < 440 ? 44 : 38;
      const edgePad = 20;
      const picked = [];
      let lastLabelX = -999;
      let prevMonthSeen = null;

      for (let idx = 0; idx < coords.length; idx++) {
        const { d, x } = coords[idx];
        const [, m, dayNum] = String(d.t).split("-").map(Number);
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
            picked[picked.length - 1] = { d, x: clampedX, m, dayNum, showMonth: picked[picked.length - 2]?.m !== m };
          }
        } else if (clampedX - lastLabelX >= minGap) {
          const lastM = picked[picked.length - 1]?.m;
          picked.push({ d, x: clampedX, m, dayNum, showMonth: isMonthStart || lastM !== m });
          lastLabelX = clampedX;
        } else if (isMonthStart && picked.length > 1 && clampedX - picked[picked.length - 2].x >= minGap) {
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

    // Compute initial logical window for the selected timeframe while keeping 100% of history scrollable!
    const totalBars = timelinePoints.length;
    const computeInitialWindow = () => {
      if (totalBars <= 2) return { from: -0.5, to: totalBars - 0.2 };
      const rng = state.chartRange;
      if (rng === "ALL") return { from: -0.5, to: totalBars + 1 };

      if (useIntraday) {
        const lastTs = Number(timelinePoints[totalBars - 1].t);
        if (rng === "1D") {
          const targetRegIso = timelinePoints[totalBars - 1]?.latestRegIso || barToIsoDate(lastTs);
          const regOpenIdx = timelinePoints.findIndex((b) => !b.isExt && b.etIso === targetRegIso);
          if (regOpenIdx >= 0 && (totalBars - regOpenIdx) >= 4) {
            return { from: Math.max(-0.5, regOpenIdx - 0.5), to: totalBars + 2 };
          }
          const sameDayIdx = timelinePoints.findIndex((b) => barToIsoDate(b.t) === targetRegIso);
          if (sameDayIdx >= 0 && (totalBars - sameDayIdx) >= 6) {
            return { from: Math.max(-0.5, sameDayIdx - 0.5), to: totalBars + 2 };
          }
          const fb = effIv === "1m" ? 390 : effIv === "5m" ? 105 : effIv === "15m" ? 40 : 18;
          return { from: Math.max(-0.5, totalBars - fb), to: totalBars + 2 };
        }
        const dayMap = { "5D": 5, "1W": 7, "1M": 31, "3M": 92, "6M": 183, "YTD": 300, "1Y": 365 };
        const cutoffSec = lastTs - (dayMap[rng] || 5) * 86400;
        const idx = timelinePoints.findIndex((b) => Number(b.t) >= cutoffSec);
        return { from: Math.max(-0.5, (idx >= 0 ? idx : 0) - 0.5), to: totalBars + 1.5 };
      }

      const lastIso = barToIsoDate(timelinePoints[totalBars - 1].t);
      const [ly, lm, ld] = lastIso.split("-").map(Number);
      const lastUtc = Date.UTC(ly || 2026, (lm || 1) - 1, ld || 1);
      let cutoffIso = "";
      if (rng === "YTD") {
        cutoffIso = `${ly}-01-01`;
      } else {
        const calDays = {
          "1D": 5,
          "5D": 8,
          "1W": 9,
          "1M": 32,
          "3M": 93,
          "6M": 185,
          "1Y": 366,
          "3Y": 1096,
          "5Y": 1827,
        }[rng] || 93;
        cutoffIso = new Date(lastUtc - calDays * 86400000).toISOString().slice(0, 10);
      }
      let firstIdx = timelinePoints.findIndex((b) => barToIsoDate(b.t) >= cutoffIso);
      if (firstIdx < 0) firstIdx = Math.max(0, totalBars - 22);
      if (totalBars - firstIdx < 5) firstIdx = Math.max(0, totalBars - Math.min(totalBars, 12));
      return { from: Math.max(-0.5, firstIdx - 0.5), to: totalBars + 1.2 };
    };

    const scrubberEl = $("chartTimeScrubber");
    const spanBadgeEl = $("chartVisibleSpan");
    const dateJumpEl = $("chartDateJump");
    if (dateJumpEl && timelinePoints.length) {
      dateJumpEl.min = barToIsoDate(timelinePoints[0].t);
      dateJumpEl.max = barToIsoDate(timelinePoints[totalBars - 1].t);
      dateJumpEl.value = barToIsoDate(timelinePoints[totalBars - 1].t);
    }

    let syncingScrubber = false;
    const syncNavDock = () => {
      if (!state.tvChart || !timelinePoints.length) return;
      const lr = state.tvChart.timeScale().getVisibleLogicalRange();
      if (!lr) return;
      const iStart = Math.max(0, Math.min(totalBars - 1, Math.round(lr.from)));
      const iEnd = Math.max(0, Math.min(totalBars - 1, Math.round(lr.to)));
      const bStart = timelinePoints[iStart];
      const bEnd = timelinePoints[iEnd];
      if (spanBadgeEl && bStart && bEnd) {
        const lblA = useIntraday ? formatEtIntradayTime(bStart.t, true).replace(" ET", "") : bStart.t;
        const lblB = useIntraday ? formatEtIntradayTime(bEnd.t, true) : bEnd.t;
        spanBadgeEl.textContent = `${lblA} → ${lblB}`;
      }
      if (scrubberEl && !syncingScrubber) {
        const span = Math.max(5, lr.to - lr.from);
        const maxFrom = Math.max(0.01, totalBars - span * 0.6);
        const ratio = Math.max(0, Math.min(1, (lr.from + 0.5) / maxFrom));
        scrubberEl.value = String(Math.round(ratio * 1000));
      }
      // Automatically toggle crisp candle borders off when zoomed out past 150 visible bars so wide views stay sharp
      const visCount = lr.to - lr.from;
      candles.applyOptions({ borderVisible: visCount <= 145 });
      if (is1M) sync1MDayColumns();
    };

    const applyRangeWindow = () => {
      if (!state.tvChart) return;
      if (box.clientWidth && box.clientHeight) {
        state.tvChart.applyOptions({ width: box.clientWidth, height: box.clientHeight });
      }
      state.tvChart.priceScale("right").applyOptions({ autoScale: true });
      const win = computeInitialWindow();
      try {
        state.tvChart.timeScale().setVisibleLogicalRange(win);
      } catch {
        state.tvChart.timeScale().fitContent();
      }
      syncNavDock();
    };

    const zoomByFactor = (factor) => {
      if (!state.tvChart || totalBars < 3) return;
      const ts = state.tvChart.timeScale();
      const lr = ts.getVisibleLogicalRange() || computeInitialWindow();
      const curSpan = Math.max(4, lr.to - lr.from);
      const nextSpan = Math.max(6, Math.min(totalBars + 4, curSpan * factor));
      // Anchor zoom near right-center of current viewport
      const anchor = lr.from + curSpan * 0.72;
      let nextFrom = anchor - nextSpan * 0.72;
      let nextTo = nextFrom + nextSpan;
      if (nextTo > totalBars + 3) {
        nextTo = totalBars + 3;
        nextFrom = nextTo - nextSpan;
      }
      if (nextFrom < -0.5) {
        nextFrom = -0.5;
        nextTo = Math.min(totalBars + 3, nextFrom + nextSpan);
      }
      try { ts.setVisibleLogicalRange({ from: nextFrom, to: nextTo }); } catch {}
    };

    const panByFraction = (frac) => {
      if (!state.tvChart || totalBars < 3) return;
      const ts = state.tvChart.timeScale();
      const lr = ts.getVisibleLogicalRange() || computeInitialWindow();
      const span = Math.max(5, lr.to - lr.from);
      const delta = span * frac;
      let nextFrom = lr.from + delta;
      let nextTo = lr.to + delta;
      if (nextFrom < -0.5) {
        nextFrom = -0.5;
        nextTo = nextFrom + span;
      }
      if (nextTo > totalBars + 3) {
        nextTo = totalBars + 3;
        nextFrom = Math.max(-0.5, nextTo - span);
      }
      try { ts.setVisibleLogicalRange({ from: nextFrom, to: nextTo }); } catch {}
    };

    const jumpToLatest = () => {
      if (!state.tvChart || totalBars < 2) return;
      const ts = state.tvChart.timeScale();
      const lr = ts.getVisibleLogicalRange() || computeInitialWindow();
      const span = Math.max(8, Math.min(totalBars, lr.to - lr.from));
      state.tvChart.priceScale("right").applyOptions({ autoScale: true });
      try { ts.setVisibleLogicalRange({ from: Math.max(-0.5, totalBars - span + 1.2), to: totalBars + 1.2 }); } catch {}
    };

    const jumpToDate = (isoStr) => {
      if (!state.tvChart || !isoStr || !timelinePoints.length) return;
      let targetIdx = timelinePoints.findIndex((b) => barToIsoDate(b.t) >= isoStr);
      if (targetIdx < 0) targetIdx = totalBars - 1;
      const ts = state.tvChart.timeScale();
      const lr = ts.getVisibleLogicalRange() || computeInitialWindow();
      const span = Math.max(12, Math.min(totalBars, lr.to - lr.from));
      let nextFrom = targetIdx - span * 0.5;
      let nextTo = targetIdx + span * 0.5;
      if (nextFrom < -0.5) { nextFrom = -0.5; nextTo = nextFrom + span; }
      if (nextTo > totalBars + 2) { nextTo = totalBars + 2; nextFrom = Math.max(-0.5, nextTo - span); }
      state.tvChart.priceScale("right").applyOptions({ autoScale: true });
      try { ts.setVisibleLogicalRange({ from: nextFrom, to: nextTo }); } catch {}
      setLegend(timelinePoints[targetIdx]);
    };

    state.tvControls = { zoomByFactor, panByFraction, jumpToLatest, jumpToDate, reset: applyRangeWindow };

    applyRangeWindow();
    requestAnimationFrame(applyRangeWindow);
    setTimeout(applyRangeWindow, 65);

    if ($("resetChartFitBtn")) $("resetChartFitBtn").onclick = applyRangeWindow;
    if ($("chartResetDockBtn")) $("chartResetDockBtn").onclick = applyRangeWindow;
    if ($("chartZoomInTopBtn")) $("chartZoomInTopBtn").onclick = () => zoomByFactor(0.68);
    if ($("chartZoomOutTopBtn")) $("chartZoomOutTopBtn").onclick = () => zoomByFactor(1.45);
    if ($("chartZoomInBtn")) $("chartZoomInBtn").onclick = () => zoomByFactor(0.68);
    if ($("chartZoomOutBtn")) $("chartZoomOutBtn").onclick = () => zoomByFactor(1.45);
    if ($("chartPanLeftBtn")) $("chartPanLeftBtn").onclick = () => panByFraction(-0.42);
    if ($("chartPanRightBtn")) $("chartPanRightBtn").onclick = () => panByFraction(0.42);
    if ($("chartJumpLatestBtn")) $("chartJumpLatestBtn").onclick = jumpToLatest;
    if (scrubberEl) {
      scrubberEl.oninput = () => {
        if (!state.tvChart || totalBars < 3) return;
        syncingScrubber = true;
        try {
          const ts = state.tvChart.timeScale();
          const lr = ts.getVisibleLogicalRange() || computeInitialWindow();
          const span = Math.max(6, Math.min(totalBars, lr.to - lr.from));
          const maxFrom = Math.max(0, totalBars - span * 0.6);
          const ratio = Number(scrubberEl.value) / 1000;
          const nextFrom = -0.5 + ratio * maxFrom;
          ts.setVisibleLogicalRange({ from: nextFrom, to: nextFrom + span });
        } catch {} finally {
          syncingScrubber = false;
        }
      };
    }
    if (dateJumpEl) {
      dateJumpEl.onchange = () => {
        if (dateJumpEl.value) jumpToDate(dateJumpEl.value);
      };
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(syncNavDock);
    });

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
      const timeLabel = typeof d.t === "number"
        ? formatEtIntradayTime(d.t, true)
        : `${d.t} (${d.wdLabel || WEEKDAYS[dayOfWeek(d.t)]})`;
      legend.innerHTML = `
        <span><strong>${esc(timeLabel)}</strong></span>
        <span>O ${fmtNum(d.o)}</span><span>H ${fmtNum(d.h)}</span><span>L ${fmtNum(d.l)}</span>
        <span>C <strong class="${clsPct(chg)}">${fmtNum(d.c)}</strong></span>
        <span class="${clsPct(chg)}"><strong>${fmtPct(chg)}</strong></span>
        <span class="muted">Vol ${Number(d.v || 0).toLocaleString()}</span>`;
      if (typeof d.t === "string") highlightDay(d.t);
    };
    state.tvUpdateLegend = setLegend;
    const byTime = Object.fromEntries(timelinePoints.map((d) => [d.t, d]));

    setLegend(timelinePoints[totalBars - 1]);
    chart.subscribeCrosshairMove((p) => {
      if (!p || !p.time) { setLegend(timelinePoints[totalBars - 1]); return; }
      const key = typeof p.time === "number" || typeof p.time === "string"
        ? p.time
        : `${p.time.year}-${String(p.time.month).padStart(2, "0")}-${String(p.time.day).padStart(2, "0")}`;
      setLegend(byTime[key] || timelinePoints[totalBars - 1]);
    });

    if (window.ResizeObserver) {
      let lastW = box.clientWidth;
      let lastH = box.clientHeight;
      state.tvResizeObs = new ResizeObserver(() => {
        if (state.tvChart && box.clientWidth && box.clientHeight) {
          const sizeChanged = Math.abs(box.clientWidth - lastW) > 3 || Math.abs(box.clientHeight - lastH) > 3;
          if (!sizeChanged) return;
          const prevRange = state.tvChart.timeScale().getVisibleLogicalRange();
          lastW = box.clientWidth;
          lastH = box.clientHeight;
          state.tvChart.applyOptions({ width: box.clientWidth, height: box.clientHeight });
          if (prevRange) {
            try { state.tvChart.timeScale().setVisibleLogicalRange(prevRange); } catch {}
          }
          syncNavDock();
        }
      });
      state.tvResizeObs.observe(box);
    }
  }

  // ---- EVENTS ----
  function wireEvents() {
    $("brandHome").onclick = () => setView("overview");
    if ($("backToOverview")) $("backToOverview").onclick = () => closeStockTab();
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
    const searchOverlay = $("searchOverlay");
    const openSearchBtn = $("openSearchBtn");
    const searchBackdrop = $("searchOverlayBackdrop");
    let searchActiveIdx = -1;

    const closeSearchOverlay = () => {
      if (!searchOverlay) return;
      searchOverlay.classList.add("hidden");
      inp.value = "";
      inp.blur();
    };

    const renderSearchHits = (q) => {
      if (!state.summary) { dd.innerHTML = ""; return; }
      const tickers = state.summary.tickers || [];
      let hits;
      let header = "";
      if (!q) {
        hits = [...tickers].sort((a, b) => (b.notable_score || 0) - (a.notable_score || 0)).slice(0, 7);
        header = `<div class="search-dd-hdr">Top Active Movers</div>`;
      } else {
        hits = tickers.filter((t) =>
          t.symbol.toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q)
        ).slice(0, 10);
      }
      if (!hits.length) {
        dd.innerHTML = `<div class="muted" style="padding:14px">No matching tickers.</div>`;
        return;
      }
      searchActiveIdx = -1;
      dd.innerHTML = header + hits.map((h) => `
        <div class="search-item" data-sym="${esc(h.symbol)}">
          <span><strong>${esc(h.symbol)}</strong> <span class="muted">${esc(h.name)}</span></span>
          <span class="price-pill ${clsPct(h.change_1d_pct)}" style="font-size:12px">${fmtPct(h.change_1d_pct, 1)}</span>
        </div>
      `).join("");
      dd.querySelectorAll(".search-item").forEach((el) => {
        el.onclick = () => { closeSearchOverlay(); openStock(el.dataset.sym); };
      });
    };

    const openSearchOverlay = () => {
      if (!searchOverlay) return;
      searchOverlay.classList.remove("hidden");
      inp.value = "";
      renderSearchHits("");
      // Focus synchronously inside user gesture so iOS Safari opens the keyboard immediately
      inp.focus();
      try { history.pushState({ ...currentHistoryState(), overlay: "search" }, "", location.href); } catch {}
    };

    openSearchBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openSearchOverlay();
    });
    searchBackdrop?.addEventListener("click", closeSearchOverlay);

    inp.addEventListener("input", () => renderSearchHits(inp.value.trim().toLowerCase()));
    inp.addEventListener("keydown", (e) => {
      const items = [...dd.querySelectorAll(".search-item")];
      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault();
        searchActiveIdx = (searchActiveIdx + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle("active", i === searchActiveIdx));
        items[searchActiveIdx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp" && items.length) {
        e.preventDefault();
        searchActiveIdx = (searchActiveIdx - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle("active", i === searchActiveIdx));
        items[searchActiveIdx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const pick = (searchActiveIdx >= 0 ? items[searchActiveIdx] : items[0]);
        if (pick) { e.preventDefault(); pick.click(); }
      } else if (e.key === "Escape") {
        closeSearchOverlay();
      }
    });

    // Mobile Bottom Navigation & Swipe-Down Slide-Up More Sheet
    const moreSheet = $("mobileMoreSheet");
    const morePanel = $("mobileMorePanel") || moreSheet?.querySelector(".more-sheet-panel");
    const moreBackdrop = $("mobileMoreBackdrop");
    const openMoreSheet = () => {
      if (!moreSheet || !moreSheet.classList.contains("hidden")) return;
      if (morePanel) {
        morePanel.style.transition = "none";
        morePanel.style.transform = "translateY(100%)";
      }
      if (moreBackdrop) moreBackdrop.style.opacity = "0";
      moreSheet.classList.remove("hidden");
      requestAnimationFrame(() => {
        if (morePanel) {
          morePanel.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)";
          morePanel.style.transform = "translateY(0)";
        }
        if (moreBackdrop) {
          moreBackdrop.style.transition = "opacity 0.2s ease";
          moreBackdrop.style.opacity = "1";
        }
      });
      try { history.pushState({ ...currentHistoryState(), overlay: "more" }, "", location.href); } catch {}
    };
    const closeMoreSheet = (immediate = false) => {
      if (!moreSheet || moreSheet.classList.contains("hidden")) return;
      if (immediate || !morePanel) {
        moreSheet.classList.add("hidden");
        if (morePanel) morePanel.style.transform = "";
        if (moreBackdrop) moreBackdrop.style.opacity = "";
        return;
      }
      morePanel.style.transition = "transform 0.18s ease-in";
      morePanel.style.transform = "translateY(100%)";
      if (moreBackdrop) {
        moreBackdrop.style.transition = "opacity 0.18s ease";
        moreBackdrop.style.opacity = "0";
      }
      setTimeout(() => {
        moreSheet.classList.add("hidden");
        morePanel.style.transform = "";
        if (moreBackdrop) moreBackdrop.style.opacity = "";
      }, 185);
    };

    // Native swipe-down-to-dismiss gesture on More sheet (touch & pointer)
    if (morePanel) {
      let sheetStartY = 0;
      let sheetStartT = 0;
      let sheetDy = 0;
      let sheetDragging = false;

      const onDragStart = (y) => {
        sheetDragging = true;
        sheetStartY = y;
        sheetStartT = performance.now();
        sheetDy = 0;
        morePanel.style.transition = "none";
        if (moreBackdrop) moreBackdrop.style.transition = "none";
      };
      const onDragMove = (y) => {
        if (!sheetDragging) return;
        const dy = Math.max(0, y - sheetStartY);
        sheetDy = dy;
        morePanel.style.transform = `translateY(${dy}px)`;
        if (moreBackdrop) moreBackdrop.style.opacity = String(Math.max(0.15, 1 - dy / 300));
      };
      const onDragEnd = () => {
        if (!sheetDragging) return;
        sheetDragging = false;
        const dt = Math.max(1, performance.now() - sheetStartT);
        const velocity = sheetDy / dt;
        if (sheetDy > 60 || (sheetDy > 24 && velocity > 0.42)) {
          closeMoreSheet(false);
        } else {
          morePanel.style.transition = "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)";
          morePanel.style.transform = "translateY(0)";
          if (moreBackdrop) {
            moreBackdrop.style.transition = "opacity 0.2s ease";
            moreBackdrop.style.opacity = "1";
          }
        }
      };

      morePanel.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) onDragStart(e.touches[0].clientY);
      }, { passive: true });
      morePanel.addEventListener("touchmove", (e) => {
        if (sheetDragging && e.touches.length === 1) {
          const dy = e.touches[0].clientY - sheetStartY;
          if (dy > 4) e.preventDefault();
          onDragMove(e.touches[0].clientY);
        }
      }, { passive: false });
      morePanel.addEventListener("touchend", onDragEnd, { passive: true });
      morePanel.addEventListener("touchcancel", onDragEnd, { passive: true });

      morePanel.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        if (e.target.closest(".more-sheet-item")) return;
        onDragStart(e.clientY);
        try { morePanel.setPointerCapture(e.pointerId); } catch {}
      });
      morePanel.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch" || !sheetDragging) return;
        onDragMove(e.clientY);
      });
      morePanel.addEventListener("pointerup", (e) => {
        if (e.pointerType === "touch") return;
        onDragEnd();
      });
    }

    // Escape key & Full-Screen Chart keyboard navigation (+, -, ArrowLeft, ArrowRight, 0)
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (state.chartFullscreen) {
          setChartFullscreen(false);
          return;
        }
        if (searchOverlay && !searchOverlay.classList.contains("hidden")) {
          closeSearchOverlay();
          return;
        }
        if ($("infoModal") && !$("infoModal").classList.contains("hidden")) {
          closeInfoModal();
        }
        return;
      }
      if (state.chartFullscreen && state.tvControls && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        if (ev.key === "+" || ev.key === "=") { ev.preventDefault(); state.tvControls.zoomByFactor(0.68); }
        else if (ev.key === "-" || ev.key === "_") { ev.preventDefault(); state.tvControls.zoomByFactor(1.45); }
        else if (ev.key === "ArrowLeft") { ev.preventDefault(); state.tvControls.panByFraction(-0.35); }
        else if (ev.key === "ArrowRight") { ev.preventDefault(); state.tvControls.panByFraction(0.35); }
        else if (ev.key === "0") { ev.preventDefault(); state.tvControls.reset(); }
        else if (ev.key === "End") { ev.preventDefault(); state.tvControls.jumpToLatest(); }
      }
    });

    // Native Phone Back Button & Browser Back/Forward Support
    window.addEventListener("popstate", (ev) => {
      state.isPopping = true;
      try {
        // Close open overlays first
        if (state.chartFullscreen) {
          setChartFullscreen(false);
          return;
        }
        if (searchOverlay && !searchOverlay.classList.contains("hidden")) {
          closeSearchOverlay();
        }
        if (moreSheet && !moreSheet.classList.contains("hidden")) {
          moreSheet.classList.add("hidden");
        }
        if ($("infoModal") && !$("infoModal").classList.contains("hidden")) {
          closeInfoModal();
        }
        const st = ev.state;
        const params = new URLSearchParams(location.search);
        const ticker = (st && st.ticker) || params.get("ticker");
        const view = (st && st.view) || params.get("view") || (ticker ? "stock" : "overview");
        if (view === "stock" && ticker) {
          openStock(String(ticker).toUpperCase(), { fromHistory: true });
        } else {
          setView(view, { fromHistory: true });
        }
      } finally {
        state.isPopping = false;
      }
    });
    document.querySelectorAll("#mobileBottomNav .mnav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.moreTrigger) {
          if (moreSheet?.classList.contains("hidden")) openMoreSheet();
          else closeMoreSheet();
        } else if (btn.dataset.view) {
          setView(btn.dataset.view);
        }
      });
    });
    $("mobileMoreBackdrop")?.addEventListener("click", closeMoreSheet);
    $("mobileMoreClose")?.addEventListener("click", closeMoreSheet);
    document.querySelectorAll("#mobileMoreSheet .more-sheet-item[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeMoreSheet();
        setView(btn.dataset.view);
      });
    });

    // Quick-Jump Section Bars (Overview & Flow)
    document.querySelectorAll(".quick-jump-bar .jump-pill[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = $(btn.dataset.jump);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // Floating Back-to-Top Button
    const scrollTopBtn = $("scrollTopBtn");
    if (scrollTopBtn) {
      let ticking = false;
      window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          scrollTopBtn.classList.toggle("hidden", window.scrollY < 360);
          ticking = false;
        });
      }, { passive: true });
      scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    // Slide-down-to-close on Stock Detail View (pull down from top of page or drag handle)
    const stockViewEl = $("view-stock");
    const stockDragZone = $("stockDragZone");
    if (stockViewEl) {
      let sStartX = 0, sStartY = 0, sStartT = 0, sDy = 0, sDragging = false, sLocked = false;
      const beginSlide = (x, y) => {
        sDragging = true;
        sLocked = false;
        sStartX = x;
        sStartY = y;
        sStartT = performance.now();
        sDy = 0;
        stockViewEl.style.transition = "none";
      };
      const moveSlide = (y) => {
        if (!sDragging) return;
        const dy = Math.max(0, y - sStartY);
        sDy = dy;
        stockViewEl.style.transform = `translateY(${dy}px)`;
        stockViewEl.style.opacity = String(Math.max(0.25, 1 - dy / 380));
      };
      const endSlide = () => {
        if (!sDragging) return;
        sDragging = false;
        sLocked = false;
        const dt = Math.max(1, performance.now() - sStartT);
        const vel = sDy / dt;
        if (sDy > 72 || (sDy > 28 && vel > 0.48)) {
          stockViewEl.style.transition = "transform 0.18s ease-in, opacity 0.18s ease";
          stockViewEl.style.transform = "translateY(120px)";
          stockViewEl.style.opacity = "0";
          setTimeout(() => {
            stockViewEl.style.transition = "";
            stockViewEl.style.transform = "";
            stockViewEl.style.opacity = "";
            closeStockTab();
          }, 175);
        } else {
          stockViewEl.style.transition = "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease";
          stockViewEl.style.transform = "";
          stockViewEl.style.opacity = "";
        }
      };

      stockViewEl.addEventListener("touchstart", (e) => {
        if (state.chartFullscreen || e.touches.length !== 1) return;
        const t = e.touches[0];
        // Preserve iOS left-edge swipe-back & horizontal pill/chart/network gestures
        if (t.clientX < 24) return;
        if (e.target.closest("#tvChart, .bubble-stage, .cselect-menu, .quick-jump-bar, .pro-subtabs, .filter-bar-scroll")) return;
        const onHandle = Boolean(e.target.closest("#stockDragZone, .pro-hero"));
        if (window.scrollY <= 4 || onHandle) {
          beginSlide(t.clientX, t.clientY);
        }
      }, { passive: true });
      stockViewEl.addEventListener("touchmove", (e) => {
        if (!sDragging || e.touches.length !== 1) return;
        const rawDx = e.touches[0].clientX - sStartX;
        const rawDy = e.touches[0].clientY - sStartY;
        if (!sLocked) {
          if (Math.abs(rawDx) > Math.abs(rawDy) && Math.abs(rawDx) > 8) {
            sDragging = false;
            return;
          }
          if (rawDy <= 0) {
            sDragging = false;
            return;
          }
          if (rawDy > 8) sLocked = true;
        }
        if (sLocked) {
          e.preventDefault();
          moveSlide(e.touches[0].clientY);
        }
      }, { passive: false });
      stockViewEl.addEventListener("touchend", endSlide, { passive: true });
      stockViewEl.addEventListener("touchcancel", endSlide, { passive: true });

      if (stockDragZone) {
        stockDragZone.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "touch") return;
          beginSlide(e.clientX, e.clientY);
          try { stockDragZone.setPointerCapture(e.pointerId); } catch {}
        });
        stockDragZone.addEventListener("pointermove", (e) => {
          if (e.pointerType === "touch" || !sDragging) return;
          moveSlide(e.clientY);
        });
        stockDragZone.addEventListener("pointerup", (e) => {
          if (e.pointerType === "touch") return;
          endSlide();
        });
      }
    }

    const closeModal = () => {
      closeInfoModal();
    };
    if ($("modalCloseBtn")) $("modalCloseBtn").onclick = closeModal;
    if ($("modalCloseBg")) $("modalCloseBg").onclick = closeModal;
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || tag === "select";
      if (e.key === "/" && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openSearchOverlay();
        return;
      }
      if (e.key === "Escape") {
        if (searchOverlay && !searchOverlay.classList.contains("hidden")) {
          closeSearchOverlay();
        } else if (moreSheet && !moreSheet.classList.contains("hidden")) {
          closeMoreSheet();
        } else if ($("infoModal") && !$("infoModal").classList.contains("hidden")) {
          closeModal();
        } else if (state.view === "stock") {
          closeStockTab();
        }
      }
    });
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
    tipEl.addEventListener("click", (e) => {
      e.stopPropagation();
      hideTip();
    });

    const showTip = (target, clientX, clientY, fromClick = false) => {
      const raw = target.getAttribute("data-tip");
      if (!raw) return;
      const [title, body] = raw.includes("|") ? raw.split("|", 2) : ["Definition", raw];
      tipEl.innerHTML = `<strong>${esc(title)}</strong><span>${esc(body)}</span>`;

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
      if (e.target.closest(".floating-tooltip")) { hideTip(); return; }
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
        ? `<p class="install-modal-desc">Install the app directly to your device home screen for full-screen native access.</p>`
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
              <h2 class="install-modal-title">Install the App</h2>
            </div>
            <button type="button" class="install-dismiss-btn hidden" id="autoInstallDismissBtn" aria-label="Close"></button>
          </div>
          ${stepsHtml}
          <div class="install-modal-actions">
            ${hasNativePrompt ? `<button type="button" class="btn-primary-accent install-modal-primary" id="autoInstallNowBtn">Install Now</button>` : ""}
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
  // ---- CUSTOM MINIMALIST DARK INLINE DROPDOWNS (Replaces OS Pop-Out <select>) ----
  function initCustomSelects() {
    let openWrap = null;
    let openMenu = null;

    const closeAll = () => {
      if (openWrap) openWrap.classList.remove("open");
      if (openMenu) openMenu.remove();
      openWrap = null;
      openMenu = null;
    };

    const syncLabel = (sel, btn) => {
      const lbl = btn.querySelector(".cselect-label");
      const opt = sel.options[sel.selectedIndex] || sel.options[0];
      if (lbl) lbl.textContent = opt ? opt.textContent : "Select";
      btn.parentElement.classList.toggle("hidden", sel.classList.contains("hidden"));
    };

    const enhanceOne = (sel) => {
      if (!sel || sel.dataset.cselectInit === "1") return;
      sel.dataset.cselectInit = "1";
      const wrap = document.createElement("div");
      wrap.className = "cselect-wrap" + (sel.classList.contains("hidden") ? " hidden" : "");
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      sel.classList.add("cselect-native");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cselect-trigger";
      btn.innerHTML = `<span class="cselect-label"></span><svg class="cselect-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      wrap.appendChild(btn);

      const refresh = () => syncLabel(sel, btn);
      refresh();

      sel.addEventListener("change", refresh);
      const optObs = new MutationObserver(refresh);
      optObs.observe(sel, { childList: true, attributes: true, attributeFilter: ["class"] });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (openWrap === wrap) {
          closeAll();
          return;
        }
        closeAll();
        openWrap = wrap;
        wrap.classList.add("open");

        const menu = document.createElement("div");
        menu.className = "cselect-menu";
        const curVal = sel.value;
        menu.innerHTML = [...sel.options].map((o) => {
          const isSel = o.value === curVal;
          return `<button type="button" class="cselect-opt${isSel ? " selected" : ""}" data-val="${esc(o.value)}"><span>${esc(o.textContent)}</span>${isSel ? '<span class="cselect-check">✓</span>' : ""}</button>`;
        }).join("");
        document.body.appendChild(menu);
        openMenu = menu;

        const r = btn.getBoundingClientRect();
        const mw = Math.max(r.width, 180);
        menu.style.minWidth = `${Math.min(mw, window.innerWidth - 24)}px`;
        const mr = menu.getBoundingClientRect();
        let left = r.left;
        if (left + mr.width > window.innerWidth - 12) {
          left = Math.max(12, window.innerWidth - mr.width - 12);
        }
        let top = r.bottom + 6;
        if (top + mr.height > window.innerHeight - 16 && r.top - mr.height - 6 > 12) {
          top = r.top - mr.height - 6;
        }
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        const selBtn = menu.querySelector(".cselect-opt.selected");
        if (selBtn) selBtn.scrollIntoView({ block: "nearest" });

        menu.querySelectorAll(".cselect-opt").forEach((ob) => {
          ob.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const v = ob.dataset.val;
            closeAll();
            if (sel.value !== v) {
              sel.value = v;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
            }
            refresh();
          });
        });
      });
    };

    const scanAll = () => {
      document.querySelectorAll("select.select-control").forEach(enhanceOne);
    };
    scanAll();

    const bodyObs = new MutationObserver(() => scanAll());
    bodyObs.observe(document.body, { childList: true, subtree: true });

    const onOutsideClose = (e) => {
      if (openMenu && !e.target.closest(".cselect-menu") && !e.target.closest(".cselect-wrap")) {
        closeAll();
      }
    };
    document.addEventListener("pointerdown", onOutsideClose, { passive: true });
    document.addEventListener("click", onOutsideClose);
    window.addEventListener("scroll", () => { if (openMenu) closeAll(); }, { passive: true });
    window.addEventListener("resize", () => { if (openMenu) closeAll(); }, { passive: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openMenu) closeAll(); });
  }

  // ---- REAL-TIME PRICE & NEWS ENGINE (Dual-Layer: Cloud Snapshot + Browser Direct Stream) ----
  const CORS_GATEWAYS = [
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  async function fetchViaCors(targetUrl, timeoutMs = 5500) {
    for (const buildUrl of CORS_GATEWAYS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(buildUrl(targetUrl), { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(timer);
        if (res.ok) return await res.text();
      } catch {
        clearTimeout(timer);
      }
    }
    return null;
  }

  function usMarketSessionLabel() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(new Date());
      const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      if (map.weekday === "Sat" || map.weekday === "Sun") return "OFF-MARKET";
      const h = Number(map.hour || 0) % 24;
      const m = Number(map.minute || 0);
      const mins = h * 60 + m;
      if (mins >= 240 && mins < 570) return "PRE-MARKET";
      if (mins >= 570 && mins < 960) return "MARKET OPEN";
      if (mins >= 960 && mins < 1200) return "AFTER-HOURS";
      return "OVERNIGHT";
    } catch {
      return "LIVE";
    }
  }

  function lastValidNum(arr) {
    if (!Array.isArray(arr)) return null;
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = Number(arr[i]);
      if (arr[i] != null && Number.isFinite(v) && v > 0) return v;
    }
    return null;
  }

  // ---- CLIENT-SIDE REAL-TIME DATABASE (IndexedDB: MarketRealtimeDB) ----
  const MarketRealtimeDB = (() => {
    let dbPromise = null;
    function open() {
      if (dbPromise) return dbPromise;
      if (typeof indexedDB === "undefined") return Promise.resolve(null);
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open("MarketRealtimeDB", 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
            if (!db.objectStoreNames.contains("ticks")) db.createObjectStore("ticks");
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      return dbPromise;
    }
    async function saveSnapshot(quotes) {
      const db = await open();
      if (!db) return;
      try {
        const tx = db.transaction("snapshots", "readwrite");
        tx.objectStore("snapshots").put({ ts: Date.now(), quotes }, "latest");
      } catch {}
    }
    async function loadSnapshot() {
      const db = await open();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction("snapshots", "readonly");
          const req = tx.objectStore("snapshots").get("latest");
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return { saveSnapshot, loadSnapshot };
  })();

  // Exact primary exchange mapping for instant 1-request 115-symbol real-time batch streaming
  const TV_EXCHANGE_MAP = {
    AAPL: "NASDAQ:AAPL", ABBV: "NYSE:ABBV", ADBE: "NASDAQ:ADBE", ADI: "NASDAQ:ADI", AEM: "NYSE:AEM",
    AG: "NYSE:AG", AIQ: "NASDAQ:AIQ", AMAT: "NASDAQ:AMAT", AMD: "NASDAQ:AMD", AMZN: "NASDAQ:AMZN",
    ANET: "NYSE:ANET", APLD: "NASDAQ:APLD", APP: "NASDAQ:APP", ARM: "NASDAQ:ARM", ASML: "NASDAQ:ASML",
    AVGO: "NASDAQ:AVGO", AXP: "NYSE:AXP", AXTI: "NASDAQ:AXTI", BA: "NYSE:BA", BAC: "NYSE:BAC",
    BE: "NYSE:BE", BLK: "NYSE:BLK", "BRK-B": "NYSE:BRK.B", CAT: "NYSE:CAT", CCJ: "NYSE:CCJ",
    CEG: "NASDAQ:CEG", CIFR: "NASDAQ:CIFR", COIN: "NASDAQ:COIN", CORZ: "NASDAQ:CORZ", COST: "NASDAQ:COST",
    CRM: "NYSE:CRM", CRWD: "NASDAQ:CRWD", CRWV: "NASDAQ:CRWV", CVX: "NYSE:CVX", DDOG: "NASDAQ:DDOG",
    DELL: "NYSE:DELL", ETN: "NYSE:ETN", FCX: "NYSE:FCX", FNV: "NYSE:FNV", FSLR: "NASDAQ:FSLR",
    GD: "NYSE:GD", GDX: "AMEX:GDX", GEV: "NYSE:GEV", GLD: "AMEX:GLD", GOOGL: "NASDAQ:GOOGL",
    GS: "NYSE:GS", HD: "NYSE:HD", HON: "NASDAQ:HON", ICLN: "NASDAQ:ICLN", IGV: "CBOE:IGV",
    INTC: "NASDAQ:INTC", INTU: "NASDAQ:INTU", IREN: "NASDAQ:IREN", ISRG: "NASDAQ:ISRG", ITA: "CBOE:ITA",
    JNJ: "NYSE:JNJ", JPM: "NYSE:JPM", KLAC: "NASDAQ:KLAC", KO: "NYSE:KO", LLY: "NYSE:LLY",
    LMT: "NYSE:LMT", LRCX: "NASDAQ:LRCX", MA: "NYSE:MA", MCD: "NYSE:MCD", META: "NASDAQ:META",
    MOD: "NYSE:MOD", MRK: "NYSE:MRK", MRVL: "NASDAQ:MRVL", MS: "NYSE:MS", MSFT: "NASDAQ:MSFT",
    MU: "NASDAQ:MU", NBIS: "NASDAQ:NBIS", NEE: "NYSE:NEE", NEM: "NYSE:NEM", NFLX: "NASDAQ:NFLX",
    NOC: "NYSE:NOC", NOW: "NYSE:NOW", NRG: "NYSE:NRG", NVDA: "NASDAQ:NVDA", NXPI: "NASDAQ:NXPI",
    OKLO: "NYSE:OKLO", ORCL: "NYSE:ORCL", OXY: "NYSE:OXY", PAAS: "NYSE:PAAS", PANW: "NASDAQ:PANW",
    PG: "NYSE:PG", PLTR: "NASDAQ:PLTR", QCOM: "NASDAQ:QCOM", QQQ: "NASDAQ:QQQ", RTX: "NYSE:RTX",
    SCCO: "NYSE:SCCO", SHOP: "NASDAQ:SHOP", SLB: "NYSE:SLB", SLV: "AMEX:SLV", SMCI: "NASDAQ:SMCI",
    SMH: "NASDAQ:SMH", SMR: "NYSE:SMR", SNOW: "NYSE:SNOW", SNPS: "NASDAQ:SNPS", SPOT: "NYSE:SPOT",
    SPY: "AMEX:SPY", TSLA: "NASDAQ:TSLA", TSM: "NYSE:TSM", TXN: "NASDAQ:TXN", UBER: "NYSE:UBER",
    UNH: "NYSE:UNH", V: "NYSE:V", VRT: "NYSE:VRT", VST: "NYSE:VST", WMT: "NASDAQ:WMT",
    WPM: "NYSE:WPM", WULF: "NASDAQ:WULF", XLE: "AMEX:XLE", XLF: "AMEX:XLF", XLK: "AMEX:XLK",
    XLP: "AMEX:XLP", XLU: "AMEX:XLU", XLV: "AMEX:XLV", XLY: "AMEX:XLY", XOM: "NYSE:XOM",
  };

  function renderExtMiniHtml(r) {
    if (!r || r.ext_price == null || !r.ext_label) return "";
    const tag = r.ext_label === "Pre-Market" ? "PM" : "AH";
    return `<div class="ext-mini-line"><span class="muted">${tag} $${fmtNum(r.ext_price)}</span> <span class="${clsPct(r.ext_change_pct)}">${fmtPct(r.ext_change_pct, 2)}</span></div>`;
  }

  function applyLiveQuotesMap(quotes) {
    if (!quotes || !state.summary) return;
    const tList = state.summary.tickers || [];
    let changed = false;
    let adv = 0, dec = 0;
    const rets = [];
    const secRets = {};

    for (const row of tList) {
      const q = quotes[row.symbol];
      if (q && q.close != null && Number.isFinite(Number(q.close)) && Number(q.close) > 0) {
        const newClose = Number(Number(q.close).toFixed(2));
        const newChgUsd = q.change_1d_usd != null && Number.isFinite(Number(q.change_1d_usd))
          ? Number(Number(q.change_1d_usd).toFixed(2))
          : row.change_1d_usd;
        const newChg = q.change_1d_pct != null && Number.isFinite(Number(q.change_1d_pct))
          ? Number(Number(q.change_1d_pct).toFixed(2))
          : row.change_1d_pct;
        const newExtP = q.ext_price != null && Number.isFinite(Number(q.ext_price)) && Number(q.ext_price) > 0
          ? Number(Number(q.ext_price).toFixed(2))
          : null;
        const newExtUsd = newExtP != null && q.ext_change_usd != null && Number.isFinite(Number(q.ext_change_usd))
          ? Number(Number(q.ext_change_usd).toFixed(2))
          : (newExtP != null ? Number((newExtP - newClose).toFixed(2)) : null);
        const newExtC = q.ext_change_pct != null && Number.isFinite(Number(q.ext_change_pct))
          ? Number(Number(q.ext_change_pct).toFixed(2))
          : null;
        const newExtL = newExtP != null ? (q.ext_label || null) : null;

        if (row.close !== newClose || row.change_1d_pct !== newChg || row.ext_price !== newExtP || row.ext_change_pct !== newExtC) {
          changed = true;
        }
        row.close = newClose;
        row.change_1d_usd = newChgUsd;
        row.change_1d_pct = newChg;
        row.ext_price = newExtP;
        row.ext_change_usd = newExtUsd;
        row.ext_change_pct = newExtC;
        row.ext_label = newExtL;
        row.is_reg_open = Boolean(q.is_reg_open);
        if (q.last_bar) row.last_bar = q.last_bar;
        if (q.open) row.open = Number(q.open);
        if (q.high) row.high = Number(q.high);
        if (q.low) row.low = Number(q.low);
        if (q.volume) row.volume = Number(q.volume);
        if (q.dollar_volume_usd && Number(q.dollar_volume_usd) > 0) {
          row.dollar_volume_usd = Number(q.dollar_volume_usd);
        }
        const cached = state.tickerCache[`${state.date}:${row.symbol}`];
        if (cached) {
          syncTickerBundleWithLiveRow(cached);
        }
      }
      if (row.change_1d_pct != null) {
        const c = Number(row.change_1d_pct);
        rets.push(c);
        if (c > 0) adv++;
        else if (c < 0) dec++;
        (secRets[row.sector || "other"] ||= []).push(c);
      }
    }

    // Keep Network nodes/links and Smart Money flow items 100% synchronized with live ticker prices
    const bySymLive = Object.fromEntries(tList.map((r) => [r.symbol, r]));
    for (const n of state.summary.network?.nodes || []) {
      const lr = bySymLive[n.symbol];
      if (lr) { n.close = lr.close; n.change_1d_pct = lr.change_1d_pct; }
    }
    const lbs = state.summary.network?.links_by_symbol || {};
    for (const lst of Object.values(lbs)) {
      for (const link of lst || []) {
        const lr = bySymLive[link.symbol];
        if (lr) { link.close = lr.close; link.change_1d_pct = lr.change_1d_pct; }
      }
    }
    for (const vfItem of state.summary.smart_money?.volume_flow || []) {
      const lr = bySymLive[vfItem.symbol];
      if (lr) { vfItem.close = lr.close; vfItem.change_1d_pct = lr.change_1d_pct; }
    }
    for (const siItem of state.summary.smart_money?.short_interest || []) {
      const lr = bySymLive[siItem.symbol];
      if (lr) { siItem.change_1d_pct = lr.change_1d_pct; }
    }

    if (rets.length && state.summary.breadth) {
      state.summary.breadth.advancers = adv;
      state.summary.breadth.decliners = dec;
      state.summary.breadth.unchanged = Math.max(0, tList.length - adv - dec);
      state.summary.breadth.avg_ret_1d = Number((rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2));
    }

    const hm = state.summary.heatmap || {};
    if (quotes.SPY && quotes.SPY.change_1d_pct != null) {
      const spyNext = Number(Number(quotes.SPY.change_1d_pct).toFixed(2));
      if (hm.spy_ret_1d !== spyNext) changed = true;
      hm.spy_ret_1d = spyNext;
    }
    for (const tile of hm.sectors || []) {
      if (tile.etf && quotes[tile.etf] && quotes[tile.etf].change_1d_pct != null) {
        const etfNext = Number(Number(quotes[tile.etf].change_1d_pct).toFixed(2));
        if (tile.etf_ret_1d !== etfNext) changed = true;
        tile.etf_ret_1d = etfNext;
      }
      const sr = secRets[tile.sector];
      if (sr && sr.length) {
        tile.avg_ret_1d = Number((sr.reduce((a, b) => a + b, 0) / sr.length).toFixed(2));
      }
    }

    if (!changed) return;

    // 1. Patch Overview KPI cards (SPY 1D & Breadth) and Sector Heatmap tiles in place
    const kpiCards = document.querySelectorAll("#kpiStrip .kpi-card");
    if (kpiCards.length >= 2) {
      const spyValEl = kpiCards[0].querySelector(".kpi-val");
      if (spyValEl && hm.spy_ret_1d != null) {
        spyValEl.className = `kpi-val ${clsPct(hm.spy_ret_1d)}`;
        spyValEl.textContent = fmtPct(hm.spy_ret_1d);
      }
      const br = state.summary.breadth || {};
      const brValEl = kpiCards[1].querySelector(".kpi-val");
      const brSubEl = kpiCards[1].querySelector(".kpi-sub");
      const brUpEl = kpiCards[1].querySelector(".breadth-up");
      const brDnEl = kpiCards[1].querySelector(".breadth-dn");
      if (brValEl) {
        brValEl.className = `kpi-val ${clsPct(br.avg_ret_1d)}`;
        brValEl.textContent = `${br.advancers ?? 0}↑ / ${br.decliners ?? 0}↓`;
      }
      if (brSubEl) brSubEl.textContent = `Avg 1D: ${fmtPct(br.avg_ret_1d)}`;
      if (brUpEl && brDnEl) {
        const tot = Math.max(1, (br.advancers ?? 0) + (br.decliners ?? 0));
        const pct = Math.round(((br.advancers ?? 0) / tot) * 100);
        brUpEl.style.width = `${pct}%`;
        brDnEl.style.width = `${100 - pct}%`;
      }
    }
    document.querySelectorAll("#sectorHeatmap .heat-tile[data-sector]").forEach((el) => {
      const sec = (hm.sectors || []).find((s) => s.sector === el.dataset.sector);
      if (!sec) return;
      const r = sec.avg_ret_1d != null ? sec.avg_ret_1d : sec.etf_ret_1d;
      const intensity = Math.min(0.28, Math.max(0.08, Math.abs(r || 0) / 28));
      el.style.background = r > 0 ? `rgba(34, 197, 94, ${intensity})` : r < 0 ? `rgba(244, 63, 94, ${intensity})` : "var(--bg-card)";
      const retEl = el.querySelector(".heat-ret");
      const etfEl = el.querySelector(".muted");
      if (retEl) {
        retEl.className = `heat-ret ${clsPct(r)}`;
        retEl.textContent = fmtPct(r);
      }
      if (etfEl && sec.etf_ret_1d != null) {
        etfEl.textContent = `ETF ${fmtPct(sec.etf_ret_1d, 1)}`;
      }
    });

    // 2. Patch Screener table, mobile cards & cohort meta in place
    if ($("screenerCohortMeta")) {
      const fRows = getFilteredRows();
      const upCnt = fRows.filter((r) => (r.change_1d_pct ?? 0) > 0).length;
      const dnCnt = fRows.filter((r) => (r.change_1d_pct ?? 0) < 0).length;
      const fRets = fRows.map((r) => r.change_1d_pct).filter((v) => v != null && Number.isFinite(Number(v)));
      const avgRet = fRets.length ? fRets.reduce((a, b) => a + b, 0) / fRets.length : null;
      $("screenerCohortMeta").innerHTML = fRows.length
        ? `<span class="pos">${upCnt} adv</span> · <span class="neg">${dnCnt} dec</span>${avgRet != null ? ` · Avg <strong class="${clsPct(avgRet)}">${fmtPct(avgRet, 2)}</strong>` : ""}`
        : "No matches";
    }
    document.querySelectorAll("#screenerBody tr[data-sym]").forEach((tr) => {
      const r = bySymLive[tr.dataset.sym];
      if (!r) return;
      const cells = tr.querySelectorAll("td");
      if (cells[2]) cells[2].innerHTML = `<strong>$${fmtNum(r.close)}</strong>${renderExtMiniHtml(r)}`;
      if (cells[3]) {
        cells[3].className = `num ${clsPct(r.change_1d_pct)}`;
        cells[3].innerHTML = `<strong>${fmtPct(r.change_1d_pct)}</strong>`;
      }
    });
    document.querySelectorAll("#screenerCards .stock-card[data-sym]").forEach((card) => {
      const r = bySymLive[card.dataset.sym];
      if (!r) return;
      const pCol = card.querySelector(".scr-price-col");
      if (pCol) {
        pCol.innerHTML = `
          <div class="scr-price">$${fmtNum(r.close)}</div>
          <span class="price-pill ${clsPct(r.change_1d_pct)}" style="font-size:11.5px;padding:2px 6px">${fmtPct(r.change_1d_pct)}</span>
          ${renderExtMiniHtml(r)}
        `;
      }
    });
    document.querySelectorAll("#notableGrid .notable-card[data-sym]").forEach((card) => {
      const r = bySymLive[card.dataset.sym];
      if (!r) return;
      const pill = card.querySelector(".price-pill");
      if (pill) {
        pill.className = `price-pill ${clsPct(r.change_1d_pct)}`;
        pill.textContent = `$${fmtNum(r.close)} · ${fmtPct(r.change_1d_pct, 1)}`;
      }
      const existingExt = card.querySelector(".ext-mini-line");
      if (r.ext_price != null && r.ext_label) {
        const html = renderExtMiniHtml(r);
        if (existingExt) existingExt.outerHTML = html;
        else if (pill) pill.insertAdjacentHTML("afterend", html);
      } else if (existingExt) {
        existingExt.remove();
      }
    });

    // 3. Patch active Stock page (Side-by-Side Dual Hero Price, S/R current badge, Full-Screen chart bar & live candle)
    if (state.view === "stock" && state.activeTicker) {
      const r = bySymLive[state.activeTicker];
      if (r) {
        const pBox = $("stockPriceBox");
        const lc = document.querySelector("#stockContent .level-current");
        const fsp = $("chartFsPrice");
        const fspill = $("chartFsPill");
        const fsExt = $("chartFsExt");
        if (pBox) {
          pBox.innerHTML = renderDualStockQuoteHtml({
            last_close: r.close,
            change_1d_usd: r.change_1d_usd,
            change_1d_pct: r.change_1d_pct,
            ext_price: r.ext_price,
            ext_change_usd: r.ext_change_usd,
            ext_change_pct: r.ext_change_pct,
            ext_label: r.ext_label,
            is_reg_open: r.is_reg_open,
          });
        }
        if (lc) lc.textContent = `Current · $${fmtNum(r.close)}`;
        if (fsp) fsp.textContent = `$${fmtNum(r.close)}`;
        if (fspill) {
          fspill.className = `price-pill ${clsPct(r.change_1d_pct)}`;
          fspill.textContent = fmtPct(r.change_1d_pct);
        }
        if (fsExt) {
          if (r.ext_price != null && r.ext_label) {
            fsExt.classList.remove("hidden");
            fsExt.textContent = `${r.ext_label === "Pre-Market" ? "PM" : "AH"} $${fmtNum(r.ext_price)} (${fmtPct(r.ext_change_pct)})`;
          } else {
            fsExt.classList.add("hidden");
          }
        }
        streamLiveChartTick(state.activeTicker);
      }
    }
    document.querySelectorAll("#volumeFlowGrid .notable-card[data-sym]").forEach((card) => {
      const r = bySymLive[card.dataset.sym];
      if (!r) return;
      const pill = card.querySelector(".price-pill");
      if (pill) {
        pill.className = `price-pill ${clsPct(r.change_1d_pct)}`;
        pill.textContent = fmtPct(r.change_1d_pct, 1);
      }
    });
  }

  function streamLiveChartTick(sym) {
    if (state.view !== "stock" || state.activeTicker !== sym) return;
    const cached = state.tickerCache[`${state.date}:${sym}`];
    if (!cached || !state.tvCandles) return;
    const tech = cached.technical || {};

    if (state.tvIsIntraday) {
      const ivEntry = tech._ivCache?.[state.tvEffInterval];
      const ser1d = ivEntry?.bars?.length ? ivEntry.bars : tech.series_1d;
      if (Array.isArray(ser1d) && ser1d.length >= 2) {
        const last = ser1d[ser1d.length - 1];
        const facts = tech.facts || {};
        const activeP = (facts.ext_price != null && facts.ext_price > 0) ? Number(facts.ext_price) : Number(facts.last_close || last.c);
        const updC = activeP > 0 ? activeP : last.c;
        const updH = Math.max(last.h, updC);
        const updL = Math.min(last.l, updC);
        const prevC = Number(tech.prev_close_1d) || last.o;
        const chg1d = prevC ? ((updC - prevC) / prevC) * 100 : 0;
        const isExtBar = Boolean(last.ext) || (facts.ext_price != null && facts.ext_price > 0);
        try {
          if (isExtBar) {
            const ec = updC >= last.o ? "#94a3b8" : "#64748b";
            state.tvCandles.update({ time: Number(last.t), open: last.o, high: updH, low: updL, close: updC, color: ec, borderColor: ec, wickColor: ec });
          } else {
            state.tvCandles.update({ time: Number(last.t), open: last.o, high: updH, low: updL, close: updC });
          }
          if (state.tvVol && last.v != null) {
            state.tvVol.update({
              time: Number(last.t),
              value: last.v,
              color: isExtBar ? "rgba(148,163,184,0.28)" : (updC >= last.o ? "rgba(34,197,94,0.38)" : "rgba(244,63,94,0.38)"),
            });
          }
          if (state.tvUpdateLegend) {
            state.tvUpdateLegend({ ...last, t: Number(last.t), h: updH, l: updL, c: updC, prevC, chg1d });
          }
        } catch {}
      }
      return;
    }

    if (state.tvEffInterval === "1Mo") return;
    const isWeekly = state.tvEffInterval === "1W";
    const ser = isWeekly && Array.isArray(tech.series_all) && tech.series_all.length ? tech.series_all : (tech.series || []);
    if (!ser.length) return;
    const last = ser[ser.length - 1];
    const prevC = ser.length >= 2 ? ser[ser.length - 2].c : last.o;
    const chg1d = prevC ? ((last.c - prevC) / prevC) * 100 : 0;
    try {
      state.tvCandles.update({ time: String(last.t).slice(0, 10), open: last.o, high: last.h, low: last.l, close: last.c });
      if (state.tvVol && last.v != null) {
        state.tvVol.update({
          time: String(last.t).slice(0, 10),
          value: last.v,
          color: last.c >= last.o ? "rgba(34,197,94,0.38)" : "rgba(244,63,94,0.38)",
        });
      }
      if (state.tvUpdateLegend) {
        state.tvUpdateLegend({ ...last, t: String(last.t).slice(0, 10), prevC, chg1d });
      }
    } catch {}
  }

  function parseCleanNum(val) {
    if (val == null) return null;
    const s = String(val).replace(/[,%+]/g, "").trim();
    if (!s || s === "--") return null;
    if (s === "UNCH") return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function appendLiveTickToCachedSeries(sym, liveTickPrice, tickEpoch, isRegOpen) {
    const cached = state.tickerCache[`${state.date}:${sym}`];
    if (!cached?.technical || !(liveTickPrice > 0) || !(tickEpoch > 0)) return;
    const extFlag = isRegOpen ? 0 : 1;
    const updateBars = (arr, bucketSec) => {
      if (!Array.isArray(arr) || !arr.length) return;
      const bkt = Math.floor(tickEpoch / bucketSec) * bucketSec;
      const last = arr[arr.length - 1];
      if (bkt > Number(last.t)) {
        arr.push({ t: bkt, o: liveTickPrice, h: liveTickPrice, l: liveTickPrice, c: liveTickPrice, v: 0, ext: extFlag });
      } else if (bkt === Number(last.t)) {
        last.c = liveTickPrice;
        if (liveTickPrice > last.h) last.h = liveTickPrice;
        if (liveTickPrice < last.l) last.l = liveTickPrice;
      }
    };
    updateBars(cached.technical.series_1d, 300);
    const ivc = cached.technical._ivCache || {};
    if (ivc["1m"]?.bars) updateBars(ivc["1m"].bars, 60);
    if (ivc["5m"]?.bars) updateBars(ivc["5m"].bars, 300);
    if (ivc["15m"]?.bars) updateBars(ivc["15m"].bars, 900);
    if (ivc["1H"]?.bars) updateBars(ivc["1H"].bars, 3600);
  }

  // Primary zero-delay 115-symbol real-time stream (CNBC Last NASDAQ LS / CTA, Access-Control-Allow-Origin: *, every 5s)
  let tvPollBusy = false;
  async function pollTradingViewDirect() {
    if (tvPollBusy || document.hidden || !state.summary) return;
    tvPollBusy = true;
    try {
      const allSyms = new Set(["SPY", ...(state.summary.tickers || []).map((t) => t.symbol)]);
      for (const s of state.summary.heatmap?.sectors || []) {
        if (s.etf) allSyms.add(s.etf);
      }

      // 1. Primary: CNBC real-time consolidated quote batch (zero Pre-Market/After-Hours delay, native CORS)
      try {
        const cnbcList = [...allSyms].map((s) => s.replace("-", "."));
        const ctrlC = new AbortController();
        const tC = setTimeout(() => ctrlC.abort(), 4500);
        const cnbcUrl = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(cnbcList.join("|"))}&requestMethod=itv&noform=1&partnerId=2&fund=0&exthrs=1&output=json`;
        const resC = await fetch(cnbcUrl, { signal: ctrlC.signal, cache: "no-store" });
        clearTimeout(tC);
        if (resC.ok) {
          const jsonC = await resC.json();
          let fq = jsonC?.FormattedQuoteResult?.FormattedQuote || [];
          if (!Array.isArray(fq)) fq = fq ? [fq] : [];
          const mapC = {};
          for (const item of fq) {
            const rawSym = item?.symbol;
            const regClose = parseCleanNum(item?.last);
            if (!rawSym || regClose == null || regClose <= 0) continue;
            const sym = String(rawSym).replace(".", "-").toUpperCase();
            const regChgUsd = parseCleanNum(item?.change) ?? 0;
            const regChgPct = parseCleanNum(item?.change_pct) ?? 0;
            const oV = parseCleanNum(item?.open);
            const hV = parseCleanNum(item?.high);
            const lV = parseCleanNum(item?.low);
            const regOpen = oV && oV > 0 ? oV : regClose;
            const regHigh = hV && hV > 0 ? hV : regClose;
            const regLow = lV && lV > 0 ? lV : regClose;
            const vol = Math.max(0, Math.round(parseCleanNum(item?.volume) || 0));
            const mktStatus = String(item?.curmktstatus || "").toUpperCase();
            const isRegOpen = mktStatus === "REG_MKT";
            const ltStr = String(item?.last_time || "");
            const regBarIso = ltStr.length >= 10 && ltStr[4] === "-" ? ltStr.slice(0, 10) : null;

            let extPrice = null, extChgUsd = null, extChgPct = null, extLabel = null, extEpoch = 0;
            const extObj = item?.ExtendedMktQuote;
            if (!isRegOpen && extObj && typeof extObj === "object") {
              const ep = parseCleanNum(extObj.last);
              if (ep != null && ep > 0) {
                extPrice = Number(ep.toFixed(2));
                const ecu = parseCleanNum(extObj.change);
                const ecp = parseCleanNum(extObj.change_pct);
                extChgUsd = Number((ecu != null ? ecu : (ep - regClose)).toFixed(2));
                extChgPct = Number((ecp != null ? ecp : (((ep - regClose) / regClose) * 100)).toFixed(2));
                const extType = String(extObj.type || mktStatus).toUpperCase();
                extLabel = extType.includes("PRE") ? "Pre-Market" : "After-Hours";
                const parsedMs = extObj.last_time ? Date.parse(extObj.last_time) : NaN;
                extEpoch = Number.isFinite(parsedMs) ? Math.floor(parsedMs / 1000) : Math.floor(Date.now() / 1000);
              }
            }

            const liveTickPrice = extPrice != null && extPrice > 0 ? extPrice : Number(regClose.toFixed(2));
            const tickEpoch = isRegOpen ? Math.floor(Date.now() / 1000) : extEpoch;
            appendLiveTickToCachedSeries(sym, liveTickPrice, tickEpoch, isRegOpen);

            mapC[sym] = {
              close: regClose,
              open: regOpen,
              high: regHigh,
              low: regLow,
              last_bar: regBarIso,
              change_1d_usd: Number(regChgUsd.toFixed(2)),
              change_1d_pct: Number(regChgPct.toFixed(2)),
              ext_price: extPrice,
              ext_change_usd: extChgUsd,
              ext_change_pct: extChgPct,
              ext_label: extLabel,
              is_reg_open: isRegOpen,
              volume: vol,
              dollar_volume_usd: regClose * vol,
            };
          }
          if (Object.keys(mapC).length >= 50) {
            applyLiveQuotesMap(mapC);
            MarketRealtimeDB.saveSnapshot(mapC);
            return;
          }
        }
      } catch {}

      // 2. Automatic Fallback: TradingView America Scanner API
      const sessLbl = usMarketSessionLabel();
      const tvTickers = [];
      for (const sym of allSyms) {
        if (TV_EXCHANGE_MAP[sym]) {
          tvTickers.push(TV_EXCHANGE_MAP[sym]);
        } else {
          const clean = sym.replace("-", ".");
          tvTickers.push(`NASDAQ:${clean}`, `NYSE:${clean}`, `AMEX:${clean}`);
        }
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch("https://scanner.tradingview.com/america/scan", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          symbols: { tickers: tvTickers, query: { types: [] } },
          columns: [
            "name", "open", "high", "low", "close", "change", "volume",
            "premarket_close", "premarket_change", "premarket_time",
            "postmarket_close", "postmarket_change", "postmarket_time",
          ],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return;
      const json = await res.json();
      const rows = json?.data || [];
      const map = {};
      const isRegOpen = sessLbl === "MARKET OPEN";
      const regTodayIso = isRegOpen
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
        : null;

      for (const item of rows) {
        const d = item?.d;
        if (!Array.isArray(d) || d[4] == null) continue;
        const sym = String(d[0]).replace(".", "-").toUpperCase();
        const regClose = Number(d[4]);
        if (!Number.isFinite(regClose) || regClose <= 0) continue;
        const regChg = Number(d[5] || 0);
        const prevC = Math.abs(100 + regChg) > 1e-6 ? regClose / (1 + regChg / 100) : regClose;
        const regChgUsd = regClose - prevC;
        const regOpen = d[1] != null ? Number(d[1]) : regClose;
        const regHigh = d[2] != null ? Number(d[2]) : regClose;
        const regLow = d[3] != null ? Number(d[3]) : regClose;
        const vol = Math.max(0, Math.round(Number(d[6] || 0)));

        const pmP = d[7], pmChg = d[8], pmTs = Number(d[9] || 0);
        const ahP = d[10], ahChg = d[11], ahTs = Number(d[12] || 0);
        let extPrice = null, extChg = null, extChgUsd = null, extLabel = null, extTs = 0;

        if (!isRegOpen) {
          if (sessLbl === "PRE-MARKET" && pmP != null && pmTs >= ahTs) {
            extPrice = Number(pmP);
            extChg = Number(pmChg || 0);
            extChgUsd = extPrice - regClose;
            extLabel = "Pre-Market";
            extTs = pmTs;
          } else if (ahP != null && ahTs >= pmTs) {
            extPrice = Number(ahP);
            extChg = Number(ahChg || 0);
            extChgUsd = extPrice - regClose;
            extLabel = "After-Hours";
            extTs = ahTs;
          } else if (pmP != null) {
            extPrice = Number(pmP);
            extChg = Number(pmChg || 0);
            extChgUsd = extPrice - regClose;
            extLabel = "Pre-Market";
            extTs = pmTs;
          }
        }

        const liveTickPrice = extPrice != null && extPrice > 0 ? Number(extPrice.toFixed(2)) : Number(regClose.toFixed(2));
        const tickEpoch = isRegOpen ? Math.floor(Date.now() / 1000) : (extTs || 0);
        appendLiveTickToCachedSeries(sym, liveTickPrice, tickEpoch, isRegOpen);

        map[sym] = {
          close: regClose,
          open: regOpen,
          high: regHigh,
          low: regLow,
          last_bar: regTodayIso,
          change_1d_usd: Number(regChgUsd.toFixed(2)),
          change_1d_pct: regChg,
          ext_price: extPrice,
          ext_change_usd: extChgUsd != null ? Number(extChgUsd.toFixed(2)) : null,
          ext_change_pct: extChg,
          ext_label: extLabel,
          is_reg_open: isRegOpen,
          volume: vol,
          dollar_volume_usd: regClose * vol,
        };
      }

      if (Object.keys(map).length) {
        applyLiveQuotesMap(map);
        MarketRealtimeDB.saveSnapshot(map);
      }
    } catch {} finally {
      tvPollBusy = false;
    }
  }

  async function refreshSingleStockRealtime(sym) {
    if (!sym) return;
    // 1. Trigger instant zero-delay quote tick
    pollTradingViewDirect();
    try {
      const cacheKey = `${state.date}:${sym}`;
      const cached = state.tickerCache[cacheKey];
      // 2. Pull direct CORS-native 5-minute candles (Regular + After-Hours + Pre-Market) with zero proxy lag
      const cnbcBars = await fetchCnbcIntradayBars(sym, "5m");
      if (cached && cnbcBars && cnbcBars.length >= 2) {
        const tech = (cached.technical ||= {});
        const had1d = Array.isArray(tech.series_1d) && tech.series_1d.length >= 2;
        tech.series_1d = cnbcBars.slice(-260);
        tech._ivCache = tech._ivCache || {};
        tech._ivCache["5m"] = { ts: Date.now(), bars: cnbcBars, prevClose: tech.prev_close_1d || 0 };
        if (state.view === "stock" && state.activeTicker === sym && $("tvChart")) {
          if (!had1d || state.chartRange === "1D" || state.tvEffInterval === "5m") {
            mountInteractiveChart(cached);
          } else {
            streamLiveChartTick(sym);
          }
        }
      }
    } catch {}

    // Also pull live Google News RSS for the active stock so brand-new headlines appear immediately
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(sym + " stock when:1d")}&hl=en-US&gl=US&ceid=US:en`;
      const xmlTxt = await fetchViaCors(rssUrl, 5000);
      if (!xmlTxt || !xmlTxt.includes("<item>")) return;
      const doc = new DOMParser().parseFromString(xmlTxt, "text/xml");
      const items = [...doc.querySelectorAll("item")].slice(0, 6);
      const cacheKey = `${state.date}:${sym}`;
      const cached = state.tickerCache[cacheKey];
      if (!cached) return;
      const curNews = cached.news || [];
      const seenTitles = new Set(curNews.map((n) => (n.title || "").toLowerCase().slice(0, 45)));
      const fresh = [];
      for (const it of items) {
        const rawTitle = (it.querySelector("title")?.textContent || "").trim();
        const link = (it.querySelector("link")?.textContent || "").trim();
        const pub = (it.querySelector("pubDate")?.textContent || "").trim();
        const src = (it.querySelector("source")?.textContent || "Live News").trim();
        const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, "").trim() || rawTitle;
        const key = cleanTitle.toLowerCase().slice(0, 45);
        if (!cleanTitle || !link || seenTitles.has(key)) continue;
        seenTitles.add(key);
        const pubIso = pub ? new Date(pub).toISOString() : new Date().toISOString();
        fresh.push({
          id: "LIVE",
          kind: "news",
          title: cleanTitle,
          url: link,
          published: pubIso,
          source: src,
          categories: ["general"],
        });
      }
      if (fresh.length) {
        cached.news = [...fresh, ...curNews];
        if (state.view === "stock" && state.activeTicker === sym && state.stockTab === "news") {
          const tabBtn = document.querySelector('#stockSubTabs button[data-stab="news"]');
          if (tabBtn) tabBtn.click();
        }
      }
    } catch {}
  }

  async function pollBackgroundFeeds() {
    if (document.hidden || !state.summary) return;
    await checkForNewerReport();
    try {
      await loadBreaking();
    } catch {}
  }

  function initRealtimeEngine() {
    // 1. Immediate real-time 115-symbol institutional tick stream every 5 seconds
    pollTradingViewDirect();
    setInterval(pollTradingViewDirect, 5000);
    // 2. Background breaking-news & daily-report rollover check every 30 seconds
    setInterval(pollBackgroundFeeds, 30000);

    document.addEventListener("visibilitychange", async () => {
      if (!document.hidden) {
        pollTradingViewDirect();
        await checkForNewerReport(true);
        pollBackgroundFeeds();
      }
    });
    window.addEventListener("pageshow", (ev) => {
      if (ev.persisted) {
        pollTradingViewDirect();
        checkForNewerReport(true);
      }
    });
  }

  async function boot() {
    initTheme();
    initTooltips();
    initCustomSelects();
    wireEvents();
    initAutoInstallPrompt();
    try {
      const [idx, idbSnap] = await Promise.all([
        fetchJson("data/index.json"),
        MarketRealtimeDB.loadSnapshot(),
      ]);
      state.index = idx;
      const dates = state.index.dates || [];
      $("dateSelect").innerHTML = dates.map((d) =>
        `<option value="${esc(d.date)}">${esc(d.date)}</option>`
      ).join("");

      const params = new URLSearchParams(location.search);
      const targetDate = state.index.latest;
      const wantedTicker = params.get("ticker");
      const wantedView = params.get("view");
      if (wantedView && ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro", "formulas"].includes(wantedView)) state.view = wantedView;

      await loadBreaking();
      await loadAuthorities();
      await loadDate(targetDate, wantedTicker);
      // Hydrate recent IndexedDB real-time snapshot (< 10 min old) in < 5ms while live 5s stream fires immediately
      if (idbSnap?.quotes && (Date.now() - (idbSnap.ts || 0)) < 600000) {
        applyLiveQuotesMap(idbSnap.quotes);
      }
      initRealtimeEngine();
    } catch (err) {
      $("loadingState").classList.add("hidden");
      $("errorState").textContent = `Failed to load dashboard index: ${err.message}`;
      $("errorState").classList.remove("hidden");
    }
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    });
    let swReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swReloaded) return;
      swReloaded = true;
      location.reload();
    });
  }

  boot();
})();
