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
  const fmtCap = (v) => {
    if (v == null || Number.isNaN(Number(v))) return "—";
    const n = Number(v);
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  };
  const fmtSector = (s) => (s || "other").replace(/_/g, " ");

  // Mathematical formulations & quantitative finance definitions for tooltips (hover with mouse or tap on mobile)
  const GLOSSARY = {
    notable_score:
      "Notable / Catalyst Score (0–100) — Mathematical Formulation|" +
      "Formula: S = 12·min(|r_1d|/ATR%, 3)·I(z≥1) + 8·(min(RVOL_20,3)-1)·I(RVOL>1.3) + S_struct + 6·I(RSI∉[25,75]) + (0.25·I_max + 1.5·min(N_24h,5))·I(I≥40) + 8·I(SEC) + 4·I(|Form4|≥$1M) + 10·I(Earn≤7d). Combines Wilder ATR-normalized return Z-score, relative volume, structural breakouts, RSI tail extremes, news & SEC filings.",
    rsi14:
      "Wilder's RSI-14 (J. Welles Wilder, 1978)|" +
      "Formula: RSI_14 = 100 - [100 / (1 + RS)], where RS = EMA_{α=1/14}(ΔP⁺) / EMA_{α=1/14}(ΔP⁻) using Wilder's smoothing α = 1/14. <30 = Oversold (>2σ downside exhaustion); >70 = Overbought.",
    sma:
      "Simple Moving Averages (SMA 20 / 50 / 200)|" +
      "Formula: SMA_k(t) = (1/k)·∑_{i=0..k-1} C_{t-i}. Weinstein Regime: Bullish when C > SMA_50 > SMA_200; Bearish when C < SMA_50 < SMA_200.",
    rs_spy:
      "Benchmark Excess Return (α_21d vs SPY)|" +
      "Formula: α_{21d} = (C_t/C_{t-21} - 1) - (SPY_t/SPY_{t-21} - 1). Measures 1-month cross-sectional relative strength against the S&P 500.",
    rs_sector:
      "Industry Excess Return (α_21d vs Sector ETF)|" +
      "Formula: α_{sector,21d} = R_{stock,21d} - R_{ETF,21d}. Positive values indicate intra-sector leadership.",
    sr_levels:
      "Fractal Pivot & Volume-at-Price (VAP) S/R Zones|" +
      "Detected via 5-bar daily & 3-bar weekly fractal swing extrema clustered within tolerance δ = 0.6·ATR_14, merged with High-Volume Nodes (HVNs) from the 180-day Volume Profile.",
    sr_strength:
      "Support/Resistance Confluence Strength (0–100)|" +
      "Formula: Strength = 100 × [0.35·(1 - e^{-N_w/3}) + 0.30·VAP_density + 0.20·0.5^{Δt/60} + 0.10·I_MTF + 0.05·C_round], where N_w is weighted pivot touches (weekly=1.5x), VAP_density is volume concentration within ±0.5·ATR_14, and τ_{1/2}=60d.",
    scenarios:
      "Multi-Factor Logistic Scenario Model (Bull / Base / Bear %)|" +
      "Formula: S_tech = 0.30·V_MA + 0.30·V_Mom + 0.25·V_RS + 0.15·V_Pat ∈ [-1,+1]. P_base = clip(0.45 - 0.20·|S_tech| + 0.10·I_range, 0.20, 0.55); P_bull = (1 - P_base) / (1 + e^{-3·S_tech}); P_bear = 1 - P_base - P_bull.",
    tech_score:
      "Multi-Factor Technical Composite Score S_tech ∈ [-1.00, +1.00]|" +
      "Formula: S_tech = 0.30·V_MA(SMA50/200 regime) + 0.30·V_Mom(MACD_12,26,9 + RSI_14) + 0.25·V_RS(tanh(α_63d/0.15)) + 0.15·V_Pat(volume-confirmed breakout/channel).",
    breadth:
      "Market Breadth & Advance/Decline Ratio|" +
      "Formula: %Adv = N_up / (N_up + N_down); Equal-Weighted Index Return R_EW = (1/N)·∑ r_{i,1d} across all 39 watchlist stocks.",
    vix:
      "CBOE VIX Implied Volatility Index|" +
      "30-day model-free annualized implied standard deviation from S&P 500 option prices. Daily expected 1σ move ≈ VIX / √252.",
    dgs10:
      "US 10-Year Treasury Constant Maturity Yield (DGS10)|" +
      "Risk-free discount rate r_f in DCF equity valuation: V_0 = ∑ FCF_t / (1 + r_f + ERP)^t.",
    fomc:
      "Next FOMC Policy Rate Decision|" +
      "Trading/calendar days until the Federal Open Market Committee target federal funds rate announcement.",
    vol_ratio:
      "Relative Volume (RVOL_20)|" +
      "Formula: RVOL_{20} = V_t / [(1/20)·∑_{i=1..20} V_{t-i}]. RVOL ≥ 1.5x indicates statistically significant institutional participation.",
    updown_vol:
      "20-Day Institutional Up/Down Volume Ratio|" +
      "Formula: U/D_20 = [∑_{t∈Up_20} V_t] / [∑_{t∈Down_20} V_t]. >1.20 = Institutional Accumulation; <0.80 = Institutional Distribution.",
    short_float:
      "Short Interest % of Free Float|" +
      "Formula: SI% = Shares_Short / Shares_Float. Elevated short interest (>10%) increases short-covering gamma/squeeze elasticity.",
    pe:
      "Price-to-Earnings Valuation Multiple (TTM / Forward)|" +
      "Formula: P/E_TTM = Price / EPS_{trailing 12m}; Forward P/E = Price / E[EPS_{NTM}].",
    fcf:
      "Free Cash Flow (FCF TTM)|" +
      "Formula: FCF = Operating Cash Flow (CFO) - Capital Expenditures (CapEx) over the trailing 4 quarters.",
    target_upside:
      "Wall Street Consensus Target Spread (Δ%)|" +
      "Formula: Δ% = (P_{target,mean} - P_{current}) / P_{current} × 100%.",
    form4:
      "SEC Form 4 Open-Market Insider Flow|" +
      "Formula: Net_Insider = ∑(Code 'P' Open-Market Purchases $) - ∑(Code 'S' Open-Market Sales $) over trailing 90 days.",
    whale_13d:
      "SEC Schedule 13D / 13G Beneficial Ownership|" +
      "Required within 5–10 business days when an institutional investor crosses ≥ 5.0% voting ownership of a public issuer.",
  };
  const tipAttr = (key) => (GLOSSARY[key] ? `data-tip="${esc(GLOSSARY[key])}"` : "");

  // Dynamic per-stock mathematical tooltips with live plugged-in numbers
  function notableScoreTipAttr(r) {
    const bd = r?.notable_bd || r?.notable?.breakdown;
    if (!bd || !bd.terms) return tipAttr("notable_score");
    const tm = bd.terms;
    const text =
      `Notable Score = ${fmtNum(bd.total, 1)} / 100 (Live Mathematical Calculation)|` +
      `Formula: S = 12·z_ATR + 8·(RVOL-1) + S_struct + S_RSI + S_news + S_SEC + S_Form4 + S_Earn. ` +
      `Plugged-in values for ${r.symbol}: ` +
      `• ATR Move Z-Score: z = |${fmtPct(r.change_1d_pct, 2)}| / ${bd.atr_pct ?? "—"}% = ${bd.z_atr}σ → +${tm.vol_z} pts ` +
      `• Relative Vol: RVOL_20 = ${bd.rvol_20d ?? "—"}x → +${tm.rvol} pts ` +
      `• Structure/Breakout → +${tm.pattern} pts ` +
      `• Wilder RSI-14 Extreme → +${tm.rsi_extreme} pts ` +
      `• News Velocity (Max Imp ${bd.top_news_imp}/100, ${bd.fresh_news_24h} in 24h) → +${tm.news} pts ` +
      `• Material SEC 8-K/10-Q (${bd.major_sec_count}) → +${tm.sec} pts ` +
      `• Insider Form 4 / Earnings → +${(tm.insider || 0) + (tm.earnings || 0)} pts = ${fmtNum(bd.total, 1)} pts`;
    return `data-tip="${esc(text)}"`;
  }

  function levelStrengthTipAttr(x) {
    const c = x?.components;
    if (!c) return tipAttr("sr_strength");
    const text =
      `${x.label} ($${fmtNum(x.price)}) Strength = ${fmtNum(x.strength, 1)}/100 (Confluence Formula)|` +
      `Formula: 100 × [0.35·C_touch + 0.30·C_vol + 0.20·C_recency + 0.10·C_MTF + 0.05·C_round]. ` +
      `Live components at $${fmtNum(x.price)}: ` +
      `• Fractal Touches (${x.touches} touches, 1-e^{-N_w/3}): C_touch = ${fmtNum(c.touches, 2)} (×35%) ` +
      `• Volume-at-Price Profile Density: C_vol = ${fmtNum(c.volume, 2)} (×30%) ` +
      `• Exponential Recency (0.5^{Δt/60d}, last ${x.last_touch || "—"}): C_rec = ${fmtNum(c.recency, 2)} (×20%) ` +
      `• Multi-Timeframe Daily+Weekly: C_MTF = ${fmtNum(c.mtf, 2)} (×10%) ` +
      `• Round-Number Anchor: C_round = ${fmtNum(c.round, 2)} (×5%) → Total = ${fmtNum(x.strength, 1)}/100`;
    return `data-tip="${esc(text)}"`;
  }

  function techScenarioTipAttr(score, comps, sc) {
    if (score == null || !comps) return tipAttr("scenarios");
    const ma = comps.ma_trend?.vote ?? 0;
    const mom = comps.momentum?.vote ?? 0;
    const rs = comps.relative_strength?.vote ?? 0;
    const pat = comps.patterns?.vote ?? 0;
    const text =
      `Multi-Factor Technical & Logistic Scenario Model (S_tech = ${fmtNum(score, 3)})|` +
      `1) Composite Factor Equation: S_tech = 0.30·V_MA(${fmtNum(ma, 2)}) + 0.30·V_Mom(${fmtNum(mom, 2)}) + 0.25·V_RS(${fmtNum(rs, 2)}) + 0.15·V_Pat(${fmtNum(pat, 2)}) = ${fmtNum(score, 3)} ∈ [-1,+1]. ` +
      `2) Logistic Sigmoid Partition: P_base = clip(0.45 - 0.20·|${fmtNum(score, 2)}| + 0.10·I_range, 0.20, 0.55) → ${sc.base || 0}%; ` +
      `P_bull = (1 - P_base) / (1 + e^{-3 × ${fmtNum(score, 2)}}) → ${sc.bullish || 0}%; ` +
      `P_bear = 1 - P_base - P_bull → ${sc.bearish || 0}%.`;
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
    if (view !== "stock") { state.prevView = view; destroyInteractiveChart(); }
    state.view = view;
    for (const v of ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro", "stock"]) {
      $(`view-${v}`).classList.toggle("hidden", v !== view);
    }
    document.querySelectorAll("#mainNav .nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    if (view === "stock" && state.activeTicker) {
      $("stockNavTab").classList.remove("hidden");
      $("stockNavTab").textContent = state.activeTicker;
    }
    syncUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (meta) meta.setAttribute("content", theme === "dark" ? "#080d17" : "#ffffff");
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
          <h2 style="font-size:19px;text-transform:capitalize">${esc(fmtSector(sector))} (${members.length} Stocks)</h2>
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
            ${allSecs.map((sec) => `<option value="${esc(sec)}" ${sec === sector ? "selected" : ""}>${esc(fmtSector(sec))} (${secCounts[sec]})</option>`).join("")}
          </select>
        </div>
        <button class="btn-secondary compact-hdr-btn" id="filterScreenerBySecBtn">Open in Screener Table →</button>
      </div>

      <div class="table-wrap" style="max-height:58vh;overflow-y:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th class="num">Mkt Cap</th>
              <th class="num">Close</th>
              <th class="num">1D %</th>
              <th class="num">vs SPY 21d</th>
              <th class="num">RSI-14</th>
              <th class="num">Score</th>
              <th class="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((r) => `
              <tr>
                <td>
                  <strong>${esc(r.symbol)}</strong>${r.is_core ? ' <span class="core-star">★</span>' : ""}
                  <div class="muted">${esc(r.name)}</div>
                </td>
                <td class="num">${fmtCap(r.market_cap)}</td>
                <td class="num"><strong>$${fmtNum(r.close)}</strong></td>
                <td class="num ${clsPct(r.change_1d_pct)}"><strong>${fmtPct(r.change_1d_pct)}</strong></td>
                <td class="num ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</td>
                <td class="num ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</td>
                <td class="num"><span class="score-badge" ${notableScoreTipAttr(r)}>${fmtNum(r.notable_score, 1)}</span></td>
                <td class="num" style="white-space:nowrap">
                  <button class="btn-secondary compact-hdr-btn" data-sec-open="${esc(r.symbol)}">Analysis →</button>
                  <button class="btn-secondary compact-hdr-btn" data-sec-net="${esc(r.symbol)}" title="Explore Supply-Chain Bubble Network">Network ⟲</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
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
    box.querySelectorAll("[data-sec-net]").forEach((b) => {
      b.onclick = () => {
        closeInfoModal();
        state.networkCenter = b.dataset.secNet;
        state.networkFilter = "all";
        state.networkHistory = [b.dataset.secNet];
        state.networkLastEdge = null;
        renderNetworkView();
        setView("network");
      };
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
      const lb = state.summary.last_bar ? `Close ${state.summary.last_bar}` : dateStr;
      $("marketCloseBadge").textContent = `${lb} · ${state.summary.n_tickers} US stocks`;
      $("navTickerCount").textContent = String(state.summary.n_tickers || 0);
      renderOverview();
      renderScreener();
      renderNetworkView();
      renderSmartMoney();
      renderAuthorities();
      renderMacro();
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
    const alertsHtml = [
      {
        title: "Patterns & Breakouts",
        count: patternsAll.length,
        items: patternsAll.slice(0, 8).map((p) => `<span class="ticker-pill" data-sym="${esc(p.symbol)}"><strong>${esc(p.symbol)}</strong><span class="${p.dir === "bull" ? "pos" : "neg"}">${esc(p.kind)}</span></span>`),
        empty: "No active pattern signals",
      },
      {
        title: "Earnings Window (±10d)",
        count: (al.earnings_soon || []).length,
        items: (al.earnings_soon || []).slice(0, 8).map((e) => `<span class="ticker-pill" data-sym="${esc(e.symbol)}"><strong>${esc(e.symbol)}</strong><span class="warn">${e.days >= 0 ? `in ${e.days}d` : `${Math.abs(e.days)}d ago`}</span></span>`),
        empty: "No watchlist earnings within ±10d",
      },
      {
        title: "Extreme RSI (<30 / >70)",
        count: (al.oversold || []).length + (al.overbought || []).length,
        items: [
          ...(al.oversold || []).slice(0, 5).map((x) => `<span class="ticker-pill" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong><span class="neg">${x.rsi14}</span></span>`),
          ...(al.overbought || []).slice(0, 5).map((x) => `<span class="ticker-pill" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong><span class="pos">${x.rsi14}</span></span>`),
        ],
        empty: "All tickers neutral (30–70)",
      },
      {
        title: "Form 4 Insider Buys",
        count: (al.insider_buys || []).length,
        items: (al.insider_buys || []).slice(0, 8).map((x) => `<span class="ticker-pill" data-sym="${esc(x.symbol)}"><strong>${esc(x.symbol)}</strong><span class="pos">${x.buys} buy${x.buys > 1 ? "s" : ""}</span></span>`),
        empty: "No open-market Form 4 buys",
      },
    ];
    $("alertsSection").innerHTML = alertsHtml.map((c) => `
      <div class="alert-card">
        <div class="alert-title"><span>${esc(c.title)}</span><span class="alert-count">${c.count}</span></div>
        <div class="alert-pills">${c.items.length ? c.items.join("") : `<span class="muted">${c.empty}</span>`}</div>
      </div>
    `).join("");
    $("alertsSection").querySelectorAll(".ticker-pill").forEach((el) => {
      el.onclick = () => openStock(el.dataset.sym);
    });

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
          <div class="muted">${(sec.members || []).length} stocks · ETF ${fmtPct(sec.etf_ret_1d, 1)}</div>
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
              <div style="margin-top:4px"><span class="score-badge" ${notableScoreTipAttr(row)}>Score ${fmtNum(n.score, 0)} <span class="tip-badge">∑</span></span></div>
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
        `<option value="">All Sectors (${(s.tickers || []).length})</option>`,
        ...secs.map((sec) => `<option value="${esc(sec)}" ${state.activeSector === sec ? "selected" : ""}>${esc(fmtSector(sec))} (${counts[sec]})</option>`),
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
            <div><div class="sc-m-k" ${notableScoreTipAttr(r)}>Score ∑</div><div class="sc-m-v">${fmtNum(r.notable_score, 0)}</div></div>
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

  // ---- DYNAMIC SUPPLY-CHAIN & VALUE-CHAIN BUBBLE NETWORK (Bloomberg SPLC Style) ----
  const REL_COLORS = {
    supplier: { stroke: "#22c55e", badge: "bull", label: "Upstream Supplier", flow: "in" },
    customer: { stroke: "#3b82f6", badge: "amber", label: "Downstream Customer", flow: "out" },
    partner: { stroke: "#a855f7", badge: "", label: "Infra / Ecosystem Partner", flow: "bi" },
    competitor: { stroke: "#f43f5e", badge: "bear", label: "Direct Competitor", flow: "none" },
    co_mention: { stroke: "#f59e0b", badge: "amber", label: "News Co-Mention", flow: "none" },
    peer: { stroke: "#64748b", badge: "", label: "Sector Peer", flow: "none" },
  };

  function capRadius(mcap) {
    // Logarithmic market-cap scaling ($1B -> 24px, $50B -> 29px, $500B -> 35px, $3T -> 41px)
    if (!mcap || mcap <= 0) return 26;
    const logB = Math.log10(Math.max(1, mcap / 1e9)); // 0 for $1B, 3.5 for $3.1T
    return Math.round(Math.max(24, Math.min(41, 24 + logB * 4.8)));
  }

  function renderBubbleNetwork(container, centerSym, filterKey, onRecenter, opts = {}) {
    if (!container || !state.summary) return;
    const net = state.summary.network || {};
    const linksMap = net.links_by_symbol || {};
    const bySym = Object.fromEntries((state.summary.tickers || []).map((t) => [t.symbol, t]));
    const center = bySym[centerSym] || (state.summary.tickers || [])[0];
    if (!center) return;

    const historyArr = opts.history || [center.symbol];
    const lastEdge = opts.lastEdge || null;

    const allLinks = linksMap[center.symbol] || [];
    const nonPeer = allLinks.filter((x) => x.type !== "peer");
    let shown = filterKey === "all"
      ? (nonPeer.length >= 4 ? [...nonPeer, ...allLinks.filter((x) => x.type === "peer").slice(0, 3)] : allLinks)
      : allLinks.filter((x) => x.type === filterKey);
    shown = shown.slice(0, 16);

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

    const W = 880, H = 470, cx = W / 2, cy = H / 2;

    // Structured Value-Chain Zone positioning when viewing "all", or radial ring when viewing a single category
    const nodesPos = [];
    if (filterKey === "all") {
      const suppliers = shown.filter((x) => x.type === "supplier");
      const customers = shown.filter((x) => x.type === "customer");
      const partners = shown.filter((x) => x.type === "partner");
      const bottomGroup = shown.filter((x) => x.type === "competitor" || x.type === "co_mention" || x.type === "peer");

      // Left Zone: Upstream Suppliers (x ~ 110..240)
      suppliers.forEach((item, i) => {
        const tot = suppliers.length;
        const ySpan = Math.min(320, tot * 76);
        const y0 = cy - ySpan / 2;
        const y = tot === 1 ? cy : y0 + (i / (tot - 1)) * ySpan;
        const x = (i % 2 === 0 ? 135 : 225);
        nodesPos.push({ ...item, x: Math.round(x), y: Math.round(y), r: capRadius(item.market_cap) });
      });

      // Right Zone: Downstream Customers (x ~ 655..755)
      customers.forEach((item, i) => {
        const tot = customers.length;
        const ySpan = Math.min(350, tot * 64);
        const y0 = cy - ySpan / 2;
        const y = tot === 1 ? cy : y0 + (i / (tot - 1)) * ySpan;
        const x = (i % 2 === 0 ? 745 : 650);
        nodesPos.push({ ...item, x: Math.round(x), y: Math.round(y), r: capRadius(item.market_cap) });
      });

      // Top Arc: Infrastructure & Ecosystem Partners (y ~ 62..105)
      partners.forEach((item, i) => {
        const tot = partners.length;
        const xSpan = Math.min(360, tot * 88);
        const x0 = cx - xSpan / 2;
        const x = tot === 1 ? cx : x0 + (i / (tot - 1)) * xSpan;
        const y = (i % 2 === 0 ? 64 : 104);
        nodesPos.push({ ...item, x: Math.round(x), y: Math.round(y), r: capRadius(item.market_cap) });
      });

      // Bottom Arc: Direct Competitors, News Co-Mentions & Peers (y ~ 368..410)
      bottomGroup.forEach((item, i) => {
        const tot = bottomGroup.length;
        const xSpan = Math.min(380, tot * 88);
        const x0 = cx - xSpan / 2;
        const x = tot === 1 ? cx : x0 + (i / (tot - 1)) * xSpan;
        const y = (i % 2 === 0 ? 404 : 366);
        nodesPos.push({ ...item, x: Math.round(x), y: Math.round(y), r: capRadius(item.market_cap) });
      });
    } else {
      shown.forEach((item, idx) => {
        const total = Math.max(1, shown.length);
        const ring = total > 8 ? (idx % 2 === 0 ? 150 : 195) : 172;
        const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
        nodesPos.push({
          ...item,
          x: Math.round(cx + Math.cos(angle) * ring * 1.45),
          y: Math.round(cy + Math.sin(angle) * ring * 0.92),
          r: capRadius(item.market_cap),
        });
      });
    }

    // Subtle inter-neighbor cross-links (showing how orbiting bubbles also connect to each other!)
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
          `<path d="M ${n.x} ${n.y} Q ${cx} ${cy} ${m.x} ${m.y}" fill="none" stroke="rgba(148,163,184,0.16)" stroke-width="1.1" stroke-dasharray="2 4" />`
        );
      }
    }

    // Primary edges with quantified Scale badge + 60d Correlation + animated directional flow particles
    const edgesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const mx = Math.round(cx * 0.44 + n.x * 0.56);
      const my = Math.round(cy * 0.44 + n.y * 0.56);
      const scaleTxt = n.scale || rc.label.split(" ")[0];
      const corrTxt = n.corr_60d != null ? `r=${n.corr_60d >= 0 ? "+" : ""}${n.corr_60d.toFixed(2)}` : "";
      const pillTxt = scaleTxt.length > 22 ? scaleTxt.slice(0, 21) + "…" : scaleTxt;
      const pillW = Math.max(66, Math.min(142, pillTxt.length * 5.4 + 14));
      const pathId = `edgePath_${center.symbol}_${n.symbol}_${i}`;
      const dPath = rc.flow === "in"
        ? `M ${n.x} ${n.y} L ${cx} ${cy}`
        : `M ${cx} ${cy} L ${n.x} ${n.y}`;
      const showParticle = rc.flow === "in" || rc.flow === "out" || rc.flow === "bi";

      return `
        <g class="bubble-edge" data-idx="${i}">
          <path id="${pathId}" d="${dPath}" fill="none" stroke="${rc.stroke}" stroke-width="${n.type === "peer" ? 1.4 : 2.4}" stroke-opacity="0.62" ${n.type === "peer" || n.type === "competitor" ? 'stroke-dasharray="5 4"' : ""} />
          ${showParticle ? `
            <circle r="3.2" fill="${rc.stroke}">
              <animateMotion dur="${2.2 + (i % 4) * 0.4}s" repeatCount="indefinite" path="${dPath}" />
            </circle>` : ""}
          <g class="edge-badge" data-idx="${i}" style="cursor:pointer">
            <rect x="${mx - pillW / 2}" y="${my - 11}" width="${pillW}" height="${corrTxt ? 22 : 16}" rx="6" fill="var(--bg-elev)" stroke="${rc.stroke}" stroke-opacity="0.7" />
            <text x="${mx}" y="${my - (corrTxt ? 1 : -2)}" text-anchor="middle" fill="var(--text)" font-size="8.5" font-weight="700">${esc(pillTxt)}</text>
            ${corrTxt ? `<text x="${mx}" y="${my + 8}" text-anchor="middle" fill="var(--muted)" font-size="7.8" font-weight="700">${esc(rc.label.split(" ").pop())} · 60d ${esc(corrTxt)}</text>` : ""}
          </g>
        </g>`;
    }).join("");

    // Orbiting bubbles (sized by Market Cap, displaying Symbol + Market Cap + 1D %)
    const nodesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const chg = n.change_1d_pct;
      const fill = chg > 0 ? "rgba(34, 197, 94, 0.24)" : chg < 0 ? "rgba(244, 63, 94, 0.24)" : "rgba(59, 130, 246, 0.2)";
      const capTxt = fmtCap(n.market_cap);
      return `
        <g class="bubble-node orbit-bubble" data-idx="${i}" data-sym="${esc(n.symbol)}">
          <title>${esc(n.symbol)} (${esc(n.name)}) — ${esc(rc.label)}: ${esc(n.scale || "")} | ${esc(n.note || "")} | Click to select &amp; re-center on ${esc(n.symbol)}</title>
          <circle cx="${n.x}" cy="${n.y}" r="${n.r + 4}" fill="none" stroke="${rc.stroke}" stroke-width="1.5" stroke-opacity="0.38" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="var(--bg-card)" stroke="${rc.stroke}" stroke-width="2.6" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}" />
          <text x="${n.x}" y="${n.y - 7}" text-anchor="middle" fill="var(--text)" font-size="11.5" font-weight="900">${esc(n.symbol)}</text>
          <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="var(--text-soft)" font-size="8.8" font-weight="700">${esc(capTxt)}</text>
          <text x="${n.x}" y="${n.y + 15}" text-anchor="middle" fill="${chg >= 0 ? "var(--green)" : "var(--red)"}" font-size="9.2" font-weight="800">${fmtPct(chg, 1)}</text>
        </g>`;
    }).join("");

    const cChg = center.change_1d_pct;
    const centerSvg = `
      <g class="bubble-node center-bubble" data-sym="${esc(center.symbol)}">
        <circle cx="${cx}" cy="${cy}" r="56" fill="rgba(59, 130, 246, 0.16)" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="5 3" />
        <circle cx="${cx}" cy="${cy}" r="48" fill="var(--bg-elev)" stroke="var(--accent)" stroke-width="3.2" />
        <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="var(--text)" font-size="15" font-weight="900">${esc(center.symbol)}</text>
        <text x="${cx}" y="${cy}" text-anchor="middle" fill="var(--accent-2)" font-size="9.5" font-weight="800">${esc(fmtCap(center.market_cap))}</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="var(--text-soft)" font-size="10" font-weight="700">$${fmtNum(center.close)}</text>
        <text x="${cx}" y="${cy + 26}" text-anchor="middle" fill="${cChg >= 0 ? "var(--green)" : "var(--red)"}" font-size="10" font-weight="800">${fmtPct(cChg, 1)}</text>
      </g>`;

    const zoneHeadersSvg = filterKey === "all" ? `
      <text x="145" y="24" text-anchor="middle" fill="#22c55e" font-size="10.5" font-weight="800" letter-spacing="0.06em">◄ UPSTREAM SUPPLIERS (COGS / FAB / HBM)</text>
      <text x="${cx}" y="24" text-anchor="middle" fill="#a855f7" font-size="10.5" font-weight="800" letter-spacing="0.06em">▲ INFRASTRUCTURE &amp; ECOSYSTEM PARTNERS</text>
      <text x="735" y="24" text-anchor="middle" fill="#3b82f6" font-size="10.5" font-weight="800" letter-spacing="0.06em">DOWNSTREAM CUSTOMERS (CAPEX / REVENUE) ►</text>
      <text x="${cx}" y="${H - 10}" text-anchor="middle" fill="#f43f5e" font-size="10" font-weight="800" letter-spacing="0.06em">▼ DIRECT COMPETITORS · SAME-DAY NEWS CO-MENTIONS · PEERS</text>
    ` : "";

    const breadcrumbHtml = historyArr.length > 1 ? `
      <div class="bubble-breadcrumbs">
        <span class="muted">Discovery Path:</span>
        ${historyArr.map((sym, idx) => `
          <button class="chip ${sym === center.symbol ? "active" : ""}" data-hop-sym="${esc(sym)}" style="padding:3px 9px;font-size:11.5px">${esc(sym)}</button>
          ${idx < historyArr.length - 1 ? '<span class="muted">➔</span>' : ""}
        `).join("")}
      </div>` : "";

    const lastEdgeBanner = lastEdge ? `
      <div class="bubble-hop-banner">
        <div>
          <span class="tag ${(REL_COLORS[lastEdge.type] || REL_COLORS.peer).badge}">${esc((REL_COLORS[lastEdge.type] || REL_COLORS.peer).label)}</span>
          <strong style="margin-left:6px">${esc(lastEdge.from)} ➔ ${esc(center.symbol)}</strong>
          ${lastEdge.scale ? `<span class="tag amber" style="margin-left:6px">${esc(lastEdge.scale)}</span>` : ""}
          ${lastEdge.corr_60d != null ? `<span class="tag" style="margin-left:4px">60d Corr r = ${lastEdge.corr_60d >= 0 ? "+" : ""}${lastEdge.corr_60d.toFixed(2)}${lastEdge.beta_60d != null ? ` · β = ${lastEdge.beta_60d.toFixed(2)}x` : ""}</span>` : ""}
          <div class="muted" style="margin-top:3px">${esc(lastEdge.note || "")}</div>
        </div>
        <button class="btn-secondary" data-open-stock="${esc(center.symbol)}">Open ${esc(center.symbol)} Stock Page →</button>
      </div>` : "";

    container.innerHTML = `
      <div class="bubble-card">
        <div class="bubble-header">
          <div>
            <strong style="font-size:15.5px">${esc(center.symbol)} (${esc(center.name)} · ${fmtCap(center.market_cap)}) Supply-Chain &amp; Value Network</strong>
            <span class="tag sector-link" data-sector="${esc(center.sector)}" style="margin-left:6px">${esc(fmtSector(center.sector))}</span>
            <div class="muted">Bubble size = Market Cap ($) · Edge badge = Annual Spend / Revenue % / Contract MW &amp; 60d Return Correlation (r) · <strong>Click any bubble to select &amp; center it</strong></div>
          </div>
          <div class="control-group">
            <label class="muted">Relation</label>
            <select class="select-control compact" id="bubbleFilterSelect">
              ${filterTabs.map(([k, lbl]) => `<option value="${k}" ${filterKey === k ? "selected" : ""}>${esc(lbl)} (${counts[k] || 0})</option>`).join("")}
            </select>
          </div>
        </div>

        ${breadcrumbHtml}
        ${lastEdgeBanner}

        <div class="bubble-legend">
          <span><i class="legend-dot" style="background:#22c55e"></i>Upstream Supplier (flows into ${esc(center.symbol)})</span>
          <span><i class="legend-dot" style="background:#3b82f6"></i>Downstream Customer (buys from ${esc(center.symbol)})</span>
          <span><i class="legend-dot" style="background:#a855f7"></i>Infra / Ecosystem Partner</span>
          <span><i class="legend-dot" style="background:#f43f5e"></i>Direct Competitor</span>
          <span><i class="legend-dot" style="background:#f59e0b"></i>News Co-Mention</span>
          <span><i class="legend-dot" style="background:#64748b"></i>Sector Peer</span>
        </div>

        <div class="bubble-stage">
          <svg class="bubble-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            ${zoneHeadersSvg}
            ${crossEdgesSvg.join("")}
            ${edgesSvg}
            ${nodesSvg}
            ${centerSvg}
          </svg>
        </div>

        <div class="bubble-table-wrap">
          <div class="daily-strip-hdr" style="margin-bottom:6px">
            <strong>${esc(center.symbol)} Quantified Value-Chain &amp; 60-Day Correlation Matrix (${shown.length} Connections Shown)</strong>
            <div style="display:flex;gap:6px">
              <button class="btn-secondary compact-hdr-btn" data-open-stock="${esc(center.symbol)}">Open ${esc(center.symbol)} Full Analysis →</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th class="num">Mkt Cap</th>
                  <th>Quantified Deal Size / Revenue Exposure</th>
                  <th class="num" data-tip="60-Trading-Day Empirical Return Correlation (r) &amp; Beta (β)|Computed from the last 60 trading days of daily closing prices: r = Cov(r_A, r_B)/(σ_A·σ_B). Beta β measures how many % this stock moves per 1% move in ${esc(center.symbol)}.">60d Corr / β <span class="tip-badge">?</span></th>
                  <th class="num">1D Move (Spread)</th>
                  <th>Relationship Breakdown</th>
                  <th class="num">Select</th>
                </tr>
              </thead>
              <tbody>
                ${shown.map((item, idx) => {
                  const rc = REL_COLORS[item.type] || REL_COLORS.peer;
                  const spread = (item.change_1d_pct ?? 0) - (center.change_1d_pct ?? 0);
                  const corrStr = item.corr_60d != null ? `r=${item.corr_60d >= 0 ? "+" : ""}${item.corr_60d.toFixed(2)}` : "—";
                  const betaStr = item.beta_60d != null ? `β=${item.beta_60d.toFixed(2)}x` : "";
                  return `
                    <tr data-row-idx="${idx}" style="cursor:pointer">
                      <td>
                        <strong>${esc(item.symbol)}</strong>
                        <div class="muted">${esc(item.name)}</div>
                      </td>
                      <td><span class="tag ${rc.badge}">${esc(rc.label)}</span></td>
                      <td class="num"><strong>${fmtCap(item.market_cap)}</strong></td>
                      <td><strong style="color:var(--accent-2)">${esc(item.scale || rc.label)}</strong></td>
                      <td class="num"><strong>${esc(corrStr)}</strong> <span class="muted">${esc(betaStr)}</span></td>
                      <td class="num">
                        <span class="${clsPct(item.change_1d_pct)}"><strong>${fmtPct(item.change_1d_pct, 1)}</strong></span>
                        <div class="muted">(${spread >= 0 ? "+" : ""}${spread.toFixed(1)}% vs ${esc(center.symbol)})</div>
                      </td>
                      <td class="muted" style="max-width:300px;font-size:12px">${esc(item.note || "")}</td>
                      <td class="num" style="white-space:nowrap">
                        <button class="btn-secondary compact-hdr-btn" data-hop-idx="${idx}">Select Bubble ⟲</button>
                        <button class="btn-secondary compact-hdr-btn" data-open-stock="${esc(item.symbol)}">Page →</button>
                      </td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    wireSectorLinks(container);
    container.querySelectorAll("[data-open-stock]").forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); openStock(btn.dataset.openStock); };
    });
    const bfs = container.querySelector("#bubbleFilterSelect");
    if (bfs) {
      bfs.onchange = () => onRecenter(center.symbol, bfs.value, null);
    }
    container.querySelectorAll("[data-hop-sym]").forEach((b) => {
      b.onclick = () => onRecenter(b.dataset.hopSym, "all", null);
    });

    const selectOrbitItem = (item) => {
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

    // 1-Click on ANY orbiting bubble or edge badge immediately selects & centers that bubble!
    container.querySelectorAll(".bubble-node[data-idx], .edge-badge[data-idx]").forEach((nodeEl) => {
      nodeEl.onclick = (e) => {
        e.stopPropagation();
        selectOrbitItem(nodesPos[Number(nodeEl.dataset.idx)]);
      };
    });
    container.querySelectorAll("[data-hop-idx], tr[data-row-idx]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(el.dataset.hopIdx ?? el.dataset.rowIdx);
        selectOrbitItem(shown[idx]);
      };
    });

    container.querySelector(".center-bubble")?.addEventListener("click", () => openStock(center.symbol));
  }

  function renderNetworkView() {
    const s = state.summary;
    if (!s) return;
    const tickers = [...(s.tickers || [])].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    if (!tickers.some((t) => t.symbol === state.networkCenter)) {
      state.networkCenter = tickers[0]?.symbol ?? "NVDA";
    }
    const sel = $("networkHubSelect");
    if (sel) {
      sel.innerHTML = tickers.map((t) =>
        `<option value="${esc(t.symbol)}" ${t.symbol === state.networkCenter ? "selected" : ""}>${esc(t.symbol)} — ${esc(t.name)} (${fmtCap(t.market_cap)})</option>`
      ).join("");
      sel.onchange = () => {
        state.networkCenter = sel.value;
        state.networkFilter = "all";
        if (!state.networkHistory.includes(sel.value)) state.networkHistory.push(sel.value);
        state.networkLastEdge = null;
        renderNetworkView();
      };
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
    const vf = sm.volume_flow || [];
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
          <a class="feed-title" href="${esc(x.url || "#")}" target="_blank" rel="noopener">${esc(x.title)}</a>
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

    const si = sm.short_interest || [];
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
    const chartTabsAll = [...(hasSeries ? ["interactive"] : []), ...charts];
    if (!chartTabsAll.includes(state.chartTab) && chartTabsAll.length) state.chartTab = chartTabsAll[0];
    const chartUrl = (kind) => `data/${state.date}/charts/${t.symbol}_${kind}.png`;
    const chartLabel = (c) => (c === "interactive" ? "Interactive" : c === "daily" ? "Daily + S/R" : c === "momentum" ? "RSI / MACD" : "Weekly");

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
          <div class="muted" ${levelStrengthTipAttr(x)}><span class="strength-bar"><span class="strength-fill" style="width:${Math.min(100, x.strength || 0)}%"></span></span>${fmtNum(x.strength, 0)}/100 <span class="tip-badge">∑</span></div>
        </div>
      </div>
    `;

    const bd = t.notable?.breakdown || {};
    const tm = bd.terms || {};
    const jc = judg.components || {};
    const allLevels = [...resLevels, ...supLevels];

    const quantMathPanelHtml = `
      <div class="panel" style="margin-bottom:16px">
        <div class="daily-strip-hdr" style="margin-bottom:10px">
          <div>
            <h3 style="margin:0">∑ Quantitative Score Formulations &amp; Live Mathematical Calculation (${esc(t.symbol)})</h3>
            <div class="muted">Exact deterministic equations and plugged-in values used to compute ${esc(t.symbol)}'s scores today</div>
          </div>
          <button class="btn-secondary compact-hdr-btn" id="openFullMathModalBtn">Full Methodology Reference →</button>
        </div>

        <div class="math-guide-list">
          <div class="math-box">
            <div class="math-title">1. Multi-Factor Technical Composite (S<sub>tech</sub> = ${fmtNum(judg.score, 3)}) &amp; Logistic Sigmoid Scenario Probabilities</div>
            <div class="math-eq">
              S<sub>tech</sub> = 0.30·V<sub>MA</sub>(${fmtNum(jc.ma_trend?.vote, 2)}) + 0.30·V<sub>Mom</sub>(${fmtNum(jc.momentum?.vote, 2)}) + 0.25·V<sub>RS</sub>(${fmtNum(jc.relative_strength?.vote, 2)}) + 0.15·V<sub>Pat</sub>(${fmtNum(jc.patterns?.vote, 2)}) = <strong>${fmtNum(judg.score, 3)}</strong>
            </div>
            <div class="math-sub">
              • <strong>MA Regime (30%)</strong>: <code>0.4·sgn(C-SMA200) + 0.3·sgn(C-SMA50) + 0.3·sgn(SMA50-SMA200)</code> → Vote = <strong>${fmtNum(jc.ma_trend?.vote, 3)}</strong> (Contrib: ${fmtNum((jc.ma_trend?.vote || 0) * 0.3, 3)})<br/>
              • <strong>Momentum (30%)</strong>: <code>(1/3)·[sgn(MACD=${fmtNum(ind.macd, 2)}) + sgn(Hist=${fmtNum(ind.macd_hist, 2)}) + clip((RSI_14(${fmtNum(ind.rsi14, 1)})-50)/25, -1, 1)]</code> → Vote = <strong>${fmtNum(jc.momentum?.vote, 3)}</strong> (Contrib: ${fmtNum((jc.momentum?.vote || 0) * 0.3, 3)})<br/>
              • <strong>Relative Strength (25%)</strong>: <code>0.5·[tanh(α_63d,SPY/0.15) + tanh(α_63d,Sector/0.15)]</code> → Vote = <strong>${fmtNum(jc.relative_strength?.vote, 3)}</strong> (Contrib: ${fmtNum((jc.relative_strength?.vote || 0) * 0.25, 3)})<br/>
              • <strong>Patterns (15%)</strong>: Volume-confirmed breakout/channel vote = <strong>${fmtNum(jc.patterns?.vote, 3)}</strong> (Contrib: ${fmtNum((jc.patterns?.vote || 0) * 0.15, 3)})<br/>
              • <strong>Logistic Sigmoid Partition</strong>:
                <code>P_base = clip(0.45 - 0.20·|${fmtNum(judg.score, 2)}| + 0.10·I_range, 0.20, 0.55)</code> → <strong>${scByName.base || 0}%</strong>;
                <code>P_bull = (1 - P_base) / (1 + e^{-3 × ${fmtNum(judg.score, 2)}})</code> → <strong>${scByName.bullish || 0}%</strong>;
                <code>P_bear = 1 - P_base - P_bull</code> → <strong>${scByName.bearish || 0}%</strong>
            </div>
          </div>

          <div class="math-box">
            <div class="math-title">2. Daily Notable / Catalyst Score (S<sub>notable</sub> = ${fmtNum(t.notable?.score, 1)} / 100)</div>
            <div class="math-eq">
              S<sub>notable</sub> = 12·z<sub>ATR</sub>·I<sub>z≥1</sub> (${fmtNum(tm.vol_z, 1)}) + 8·(RVOL<sub>20</sub>-1)·I<sub>&gt;1.3</sub> (${fmtNum(tm.rvol, 1)}) + S<sub>struct</sub> (${fmtNum(tm.pattern, 1)}) + S<sub>RSI</sub> (${fmtNum(tm.rsi_extreme, 1)}) + S<sub>news</sub> (${fmtNum(tm.news, 1)}) + S<sub>SEC</sub> (${fmtNum(tm.sec, 1)}) + S<sub>Event</sub> (${fmtNum((tm.insider || 0) + (tm.earnings || 0), 1)}) = <strong>${fmtNum(t.notable?.score, 1)}</strong>
            </div>
            <div class="math-sub">
              • <strong>ATR-Normalized Return Z-Score</strong>: <code>z_ATR = min(|${fmtPct(facts.change_1d_pct, 2)}| / ${bd.atr_pct ?? fmtNum((ind.atr_pct || 0) * 100, 2)}%, 3.0) = ${bd.z_atr ?? 0}σ</code> → <strong>+${fmtNum(tm.vol_z, 1)} pts</strong><br/>
              • <strong>Abnormal Relative Volume</strong>: <code>RVOL_20 = V_t / SMA_20(V) = ${fmtNum(ind.vol_ratio_vs_20d, 2)}x</code> → <strong>+${fmtNum(tm.rvol, 1)} pts</strong><br/>
              • <strong>Breakout / Pattern &amp; Wilder RSI-14 Tail</strong>: Structure = <strong>+${fmtNum(tm.pattern, 1)} pts</strong> · RSI (${fmtNum(ind.rsi14, 1)}) extreme = <strong>+${fmtNum(tm.rsi_extreme, 1)} pts</strong><br/>
              • <strong>News Velocity &amp; SEC EDGAR Filings</strong>: Top News Imp (${bd.top_news_imp ?? 0}/100, ${bd.fresh_news_24h ?? 0} in 24h) = <strong>+${fmtNum(tm.news, 1)} pts</strong> · Material SEC 8-K/10-Q (${bd.major_sec_count ?? 0}) = <strong>+${fmtNum(tm.sec, 1)} pts</strong> · Form 4 / Earnings = <strong>+${fmtNum((tm.insider || 0) + (tm.earnings || 0), 1)} pts</strong>
            </div>
          </div>

          ${allLevels.length ? `
          <div class="math-box">
            <div class="math-title">3. Support &amp; Resistance Confluence Strength Breakdown (100 × ∑ w<sub>i</sub>·C<sub>i</sub>)</div>
            <div class="math-eq">
              Strength(L) = 100 × [ 0.35·C<sub>touch</sub>(1 - e<sup>-N<sub>w</sub>/3</sup>) + 0.30·C<sub>vol</sub>(VAP) + 0.20·C<sub>rec</sub>(0.5<sup>Δt/60</sup>) + 0.10·C<sub>MTF</sub> + 0.05·C<sub>round</sub> ]
            </div>
            <div class="table-wrap" style="margin-top:6px">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th class="num">Price</th>
                    <th class="num">Touches (N)</th>
                    <th class="num">C<sub>touch</sub> (35%)</th>
                    <th class="num">C<sub>vol</sub> VAP (30%)</th>
                    <th class="num">C<sub>recency</sub> (20%)</th>
                    <th class="num">C<sub>MTF</sub> (10%)</th>
                    <th class="num">C<sub>round</sub> (5%)</th>
                    <th class="num">Total Strength</th>
                  </tr>
                </thead>
                <tbody>
                  ${allLevels.map((lvItem) => {
                    const c = lvItem.components || {};
                    return `
                      <tr>
                        <td><span class="tag ${lvItem.role === "support" ? "bull" : "bear"}">${esc(lvItem.label)}</span></td>
                        <td class="num"><strong>$${fmtNum(lvItem.price)}</strong></td>
                        <td class="num">${lvItem.touches ?? 0}</td>
                        <td class="num">${fmtNum(c.touches, 2)}</td>
                        <td class="num">${fmtNum(c.volume, 2)}</td>
                        <td class="num">${fmtNum(c.recency, 2)}</td>
                        <td class="num">${fmtNum(c.mtf, 2)}</td>
                        <td class="num">${fmtNum(c.round, 2)}</td>
                        <td class="num"><strong>${fmtNum(lvItem.strength, 1)} / 100</strong></td>
                      </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>` : ""}
        </div>
      </div>
    `;

    $("stockContent").innerHTML = `
      <div class="stock-hero">
        <div class="hero-top">
          <div>
            <h1 class="stock-title">
              ${esc(t.symbol)}
              ${t.is_core ? '<span class="tag amber">★ Core</span>' : ""}
              <span class="score-badge" ${notableScoreTipAttr(t)}>Score ${fmtNum(t.notable?.score, 0)} <span class="tip-badge">∑</span></span>
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

      ${chartTabsAll.length ? `
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-tabs" id="chartTabs">
            ${chartTabsAll.map((c) => `<button class="chip ${c === state.chartTab ? "active" : ""}" data-chart="${c}">${chartLabel(c)}</button>`).join("")}
          </div>
          <span class="muted" id="chartHint">${state.chartTab === "interactive" ? "Drag · pinch to zoom · tap for prices" : "Tap chart to zoom"}</span>
        </div>
        <div id="chartBody"></div>
      </div>` : ""}

      <div id="stockBubbleMount"></div>

      <div class="section-header">
        <div>
          <h2 ${techScenarioTipAttr(judg.score, judg.components, scByName)}>Rule-Based 20-Day Scenarios <span class="tip-badge">∑</span></h2>
          <p class="section-sub" ${techScenarioTipAttr(judg.score, judg.components, scByName)}>Multi-factor logistic model (not advice) · Technical score S<sub>tech</sub> = ${fmtNum(judg.score, 2)} <span class="tip-badge">∑</span></p>
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
            <div class="kv" ${tipAttr("rs_spy")}><div class="kv-k">vs SPY (21d) ?</div><div class="kv-v ${clsPct(rs.vs_spy?.["21d"])}">${fmtPct(rs.vs_spy?.["21d"], 1)}</div></div>
            <div class="kv" ${tipAttr("rs_sector")}><div class="kv-k">vs ${esc(t.sector_etf || "Sector")} (21d) ?</div><div class="kv-v ${clsPct(rs.vs_sector?.["21d"])}">${fmtPct(rs.vs_sector?.["21d"], 1)}</div></div>
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
      $("chartHint").textContent = state.chartTab === "interactive" ? "Drag · pinch to zoom · tap any day for exact OHLCV" : "Tap chart to zoom";
      if (state.chartTab === "interactive") {
        const ov = state.chartOverlays;
        const is1M = state.chartRange === "1M";
        body.innerHTML = `
          <div class="chart-toolbar">
            <div class="chart-tabs" id="rangeBar">
              ${["1M", "3M", "6M", "1Y"].map((r) => `<button class="chip ${state.chartRange === r ? "active" : ""}" data-range="${r}">${r}</button>`).join("")}
              <button class="chip" id="resetChartFitBtn" title="Reset zoom to fit full range">⟲ Fit</button>
            </div>
            <div class="chart-tabs" id="overlayBar">
              <button class="chip ${ov.sma20 ? "active" : ""}" data-ov="sma20">SMA20</button>
              <button class="chip ${ov.sma50 ? "active" : ""}" data-ov="sma50">SMA50</button>
              <button class="chip ${ov.sma200 ? "active" : ""}" data-ov="sma200">SMA200</button>
              <button class="chip ${ov.sr ? "active" : ""}" data-ov="sr">S/R</button>
              <button class="chip ${ov.weekends ? "active" : ""}" data-ov="weekends" title="Toggle Saturday/Sunday calendar slots (US markets are closed on weekends)">Weekends</button>
            </div>
          </div>
          <div class="tv-legend" id="tvLegend"></div>
          <div class="tv-chart-wrap ${is1M ? "is-1m" : ""}" id="tvChartWrap">
            <div class="tv-chart-box" id="tvChart"></div>
            <div class="tv-day-overlay ${is1M ? "" : "hidden"}" id="tvDayOverlay"></div>
            <div class="tv-day-axis ${is1M ? "" : "hidden"}" id="tvDayAxis"></div>
          </div>
          <div class="tv-daily-strip ${is1M ? "" : "hidden"}" id="tvDailyStrip"></div>`;
        $("rangeBar").querySelectorAll("button[data-range]").forEach((b) => {
          b.onclick = () => { state.chartRange = b.dataset.range; renderChartBody(); };
        });
        $("overlayBar").querySelectorAll("button").forEach((b) => {
          b.onclick = () => { state.chartOverlays[b.dataset.ov] = !state.chartOverlays[b.dataset.ov]; renderChartBody(); };
        });
        mountInteractiveChart(t);
      } else {
        body.innerHTML = `<img id="activeChartImg" class="chart-img" src="${chartUrl(state.chartTab)}" alt="${esc(t.symbol)} chart" />`;
        $("activeChartImg").onclick = () => {
          $("modalImg").src = $("activeChartImg").src;
          $("imgModal").classList.remove("hidden");
        };
      }
    };

    const tabsEl = $("chartTabs");
    if (tabsEl) {
      tabsEl.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          state.chartTab = b.dataset.chart;
          tabsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
          renderChartBody();
        };
      });
      renderChartBody();
    }

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
                <a class="feed-title" href="${esc(x.url || "#")}" target="_blank" rel="noopener">${esc(x.title)}</a>
              </div>`).join("")}</div>`
          : `<div class="muted">No Form 4 insider transactions (foreign issuers do not file Form 4).</div>`);
      } else if (state.stockTab === "regulatory") {
        box.innerHTML = (t.regulatory?.items || []).length
          ? `<div class="feed-list">${t.regulatory.items.slice(0, 15).map((x) => `
              <div class="feed-item">
                <div class="feed-meta"><span>${esc(x.source || "")}</span><span>${esc((x.published || "").slice(0, 10))}</span></div>
                <a class="feed-title" href="${esc(x.url || "#")}" target="_blank" rel="noopener">${esc(x.title)}</a>
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
    if (mathBtn) mathBtn.onclick = openMathGuideModal;

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
        { history: state.stockBubbleHistory, lastEdge: state.stockBubbleLastEdge }
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

    const rawAll = t.technical?.series || [];
    if (!rawAll.length) { box.innerHTML = `<div class="muted">No price history available.</div>`; return; }

    // Precompute exact Close-to-Previous-Close 1D % change on every daily bar so it matches the stock header 100%
    const all = rawAll.map((d, i) => {
      const prevC = i > 0 ? rawAll[i - 1].c : d.o;
      const chg1d = prevC ? ((d.c - prevC) / prevC) * 100 : 0;
      return { ...d, prevC, chg1d };
    });

    const n = { "1M": 22, "3M": 66, "6M": 132, "1Y": 260 }[state.chartRange] || 132;
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
    // Build timeline points (optionally inserting Saturday/Sunday closed-market whitespace slots when Weekends toggle is ON)
    const timelinePoints = [];
    for (let i = 0; i < data.length; i++) {
      if (ov.weekends && i > 0) {
        const [y1, m1, d1] = data[i - 1].t.split("-").map(Number);
        let curMs = Date.UTC(y1, m1 - 1, d1) + 86400000;
        const [y2, m2, d2] = data[i].t.split("-").map(Number);
        const endMs = Date.UTC(y2, m2 - 1, d2);
        while (curMs < endMs) {
          const dt = new Date(curMs);
          const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
          const wd = dt.getUTCDay();
          timelinePoints.push({
            t: iso,
            isClosed: true,
            wd,
            wdLabel: WEEKDAYS[wd],
            reason: wd === 0 || wd === 6 ? "Weekend — US Markets Closed (NYSE / NASDAQ)" : "US Market Holiday — Exchange Closed",
          });
          curMs += 86400000;
        }
      }
      const wd = dayOfWeek(data[i].t);
      timelinePoints.push({ ...data[i], isClosed: false, wd, wdLabel: WEEKDAYS[wd] });
    }

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

      // Vertical separator line between every single day + highlighted Weekend (Sat–Sun) boundary or shaded column
      const sepLines = [];
      for (let i = 0; i < coords.length; i++) {
        const cur = coords[i];
        if (cur.d.isClosed) {
          const leftEdge = i > 0 ? (coords[i - 1].x + cur.x) / 2 : cur.x - 10;
          const rightEdge = i + 1 < coords.length ? (cur.x + coords[i + 1].x) / 2 : cur.x + 10;
          const colW = Math.max(4, rightEdge - leftEdge);
          sepLines.push(`<div class="tv-wknd-band" style="left:${leftEdge.toFixed(1)}px;width:${colW.toFixed(1)}px" title="${esc(cur.d.t)} (${esc(cur.d.wdLabel)}) — ${esc(cur.d.reason)}"></div>`);
        }
        if (i > 0) {
          const prev = coords[i - 1];
          const midX = ((prev.x + cur.x) / 2).toFixed(1);
          const gapDays = daysBetween(prev.d.t, cur.d.t);
          if (!ov.weekends && gapDays >= 2) {
            sepLines.push(
              `<div class="tv-day-sep wknd-sep" style="left:${midX}px">` +
                `<span class="wknd-pill" title="US Equity Markets Closed (Saturday–Sunday)">Sat–Sun</span>` +
              `</div>`
            );
          } else {
            sepLines.push(`<div class="tv-day-sep" style="left:${midX}px"></div>`);
          }
        }
      }
      dayOverlay.innerHTML = sepLines.join("");

      // Individual date + weekday tick directly under every single day's slot
      let prevMonth = null;
      dayAxis.innerHTML = coords.map(({ d, x }, idx) => {
        const [, m, dayNum] = d.t.split("-").map(Number);
        const mLabel = MONTHS[(m || 1) - 1];
        const showMonth = idx === 0 || m !== prevMonth;
        prevMonth = m;
        const subLabel = showMonth ? `${mLabel} ${d.wdLabel.slice(0, 2)}` : d.wdLabel;
        const tip = d.isClosed
          ? `${d.t} (${d.wdLabel}): ${d.reason}`
          : `${d.t} (${d.wdLabel}): Close $${fmtNum(d.c)} (${fmtPct(d.chg1d, 2)})`;
        return `
          <div class="tv-day-tick ${d.isClosed ? "is-closed" : ""}" data-day="${esc(d.t)}" style="left:${x.toFixed(1)}px" title="${esc(tip)}">
            <span class="tv-day-num">${dayNum}</span>
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

    if (is1M && dailyStrip) {
      dailyStrip.innerHTML = `
        <div class="daily-strip-hdr">
          <strong>1M Day-by-Day Series (${data.length} Trading Days · NYSE/NASDAQ Closed Sat–Sun)</strong>
          <span class="muted">Tap any day for exact OHLCV · toggle "Weekends" above to expand Sat–Sun slots on chart</span>
        </div>
        <div class="daily-strip-grid">
          ${data.map((d, i) => {
            const [, m, dayNum] = d.t.split("-").map(Number);
            const mLabel = MONTHS[(m || 1) - 1];
            const wd = WEEKDAYS[dayOfWeek(d.t)];
            const chg = d.chg1d ?? 0;
            const afterWknd = i > 0 && daysBetween(data[i - 1].t, d.t) >= 2;
            return `
              <div class="daily-bar-cell ${chg >= 0 ? "up" : "dn"} ${afterWknd ? "after-wknd" : ""}" data-day="${esc(d.t)}">
                <div class="dbc-date">${wd} ${mLabel} ${dayNum}</div>
                <div class="dbc-close">$${fmtNum(d.c)}</div>
                <div class="dbc-chg ${clsPct(chg)}">${fmtPct(chg, 1)}</div>
              </div>`;
          }).join("")}
        </div>`;
      dailyStrip.querySelectorAll(".daily-bar-cell").forEach((cell) => {
        const selectDay = () => {
          const item = byTime[cell.dataset.day];
          if (item) setLegend(item);
        };
        cell.addEventListener("mouseenter", selectDay);
        cell.addEventListener("click", selectDay);
      });
    }

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
    $("backToOverview").onclick = () => setView(state.prevView || "overview");
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
      $("imgModal").classList.add("hidden");
      closeInfoModal();
    };
    $("modalCloseBtn").onclick = closeModal;
    $("modalCloseBg").onclick = closeModal;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  // ---- HOVER & TOUCH TOOLTIPS FOR SCORES & TECHNICAL TERMS ----
  function initTooltips() {
    let tipEl = document.querySelector(".floating-tooltip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "floating-tooltip hidden";
      document.body.appendChild(tipEl);
    }

    const showTip = (target, clientX, clientY) => {
      const raw = target.getAttribute("data-tip");
      if (!raw) return;
      const [title, body] = raw.includes("|") ? raw.split("|", 2) : ["Definition", raw];
      tipEl.innerHTML = `<strong>${esc(title)}</strong><span>${esc(body)}</span>`;
      tipEl.classList.remove("hidden");
      const rect = tipEl.getBoundingClientRect();
      let left = Math.min(window.innerWidth - rect.width - 12, Math.max(12, clientX - rect.width / 2));
      let top = clientY - rect.height - 14;
      if (top < 12) top = clientY + 18;
      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
    };

    const hideTip = () => tipEl.classList.add("hidden");

    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el) {
        const r = el.getBoundingClientRect();
        showTip(el, r.left + r.width / 2, r.top);
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("[data-tip]")) hideTip();
    });
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el && (e.target.classList.contains("tip-badge") || !el.closest("tr, .stock-card, .notable-card"))) {
        e.stopPropagation();
        const r = el.getBoundingClientRect();
        showTip(el, r.left + r.width / 2, r.top);
      } else {
        hideTip();
      }
    });
    window.addEventListener("scroll", hideTip, { passive: true });
  }

  // ---- BOOT ----
  async function boot() {
    initTheme();
    initTooltips();
    wireEvents();
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
      if (wantedView && ["overview", "screener", "network", "smartmoney", "breaking", "authorities", "macro"].includes(wantedView)) state.view = wantedView;

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
