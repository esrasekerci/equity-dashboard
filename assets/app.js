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
    stockBubbleCenter: null,
    stockBubbleFilter: "all",
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

  // Plain-English glossary for scores & technical terms (hover with mouse or tap/hold on phone)
  const GLOSSARY = {
    notable_score: "Notable Score (0–100)|Measures how active or unusual a stock is today (price move vs ATR, volume spike, patterns, RSI extremes, news & SEC filings). High score = big activity today, NOT a buy/sell rating.",
    rsi14: "RSI-14 (Relative Strength Index)|0–100 momentum gauge over 14 days. Below 30 = Oversold (steep recent drop); Above 70 = Overbought (steep recent rally); 30–70 = Neutral.",
    sma: "SMA 20 / 50 / 200 (Moving Averages)|Average closing price over the last 20 (short-term), 50 (medium-term), and 200 (long-term) trading days. Green = price is above that average; Red = below.",
    rs_spy: "vs SPY (21d Relative Strength)|The stock's 21-trading-day (~1 month) return minus the S&P 500 (SPY) return. Positive = outperforming the market; Negative = lagging.",
    rs_sector: "vs Sector ETF (21d)|The stock's 21-day return minus its sector ETF return. Shows if the stock is a leader or laggard within its own industry.",
    sr_levels: "Support (S1–S3) & Resistance (R1–R3)|Support (S) is a historical price floor where buyers stepped in; Resistance (R) is a price ceiling where sellers capped rallies. Dist % shows how far current price is from that level.",
    sr_strength: "Level Strength (0–100)|Confidence score based on number of historical pivot touches (35%), volume traded at that price (30%), recency (20%), daily+weekly confirmation (10%), and round numbers (5%).",
    scenarios: "20-Day Rule-Based Scenarios (Bull / Base / Bear %)|Heuristic probability split for the next 20 trading days computed from MA trend (30%), momentum (30%), relative strength (25%), and patterns (15%). Not a forecast or advice.",
    tech_score: "Technical Composite Score (-1.00 to +1.00)|Weighted technical balance from -1.00 (strongly bearish trend/momentum) to +1.00 (strongly bullish trend/momentum).",
    breadth: "Watchlist Breadth (Advancers / Decliners)|How many of the 39 stocks closed green (↑) vs red (↓) in the latest session, plus their equal-weighted average 1D return.",
    vix: "VIX Volatility Index|Market's 30-day implied volatility ('fear gauge') on the S&P 500. Below 15 = calm; 20–25 = elevated caution; Above 30 = high market stress.",
    dgs10: "US 10Y Treasury Yield|Benchmark 10-year US government bond yield. Rising yields often pressure high-growth tech valuations.",
    fomc: "Next FOMC Decision|Countdown to the Federal Reserve's next interest-rate decision meeting.",
    vol_ratio: "Vol vs 20d Avg (Volume Surge)|Latest daily volume divided by the stock's 20-day average volume. 1.5x+ signals heavy institutional participation.",
    updown_vol: "Up/Down Volume Ratio (20d)|Total volume on green days divided by total volume on red days over the last 20 sessions. >1.2 = Accumulation (buying pressure); <0.8 = Distribution (selling pressure).",
    short_float: "Short % of Float|Percentage of publicly tradable shares currently sold short by bears. High short interest (>10%) increases volatility and short-squeeze potential.",
    pe: "P/E (Trailing vs Forward)|Price-to-Earnings ratio: stock price divided by last 12 months' EPS (TTM) vs wall-street estimated next 12 months' EPS (Forward).",
    fcf: "FCF (Free Cash Flow TTM)|Operating cash flow minus capital expenditures (Capex) over the trailing 12 months — actual cash generated after data-center/fab investments.",
    target_upside: "Analyst Target Δ|Percentage difference between the average Wall Street analyst price target and the current stock price.",
    form4: "SEC Form 4 (Insider Transactions)|Mandatory SEC filing within 2 business days whenever a company officer, director, or >10% owner buys or sells shares in the open market.",
    whale_13d: "SEC Schedule 13D / 13G|Mandatory SEC filing when an institutional fund or whale accumulates more than 5% ownership of a company.",
  };
  const tipAttr = (key) => (GLOSSARY[key] ? `data-tip="${esc(GLOSSARY[key])}"` : "");

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

  function jumpToSector(sector) {
    if (!sector) return;
    state.activeSector = sector;
    renderScreener();
    setView("screener");
  }

  function wireSectorLinks(root = document) {
    root.querySelectorAll(".sector-link[data-sector]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        jumpToSector(el.dataset.sector);
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

    // Sector Heatmap
    const sectors = hm.sectors || [];
    $("sectorHeatmap").innerHTML = sectors.map((sec) => {
      const r = sec.avg_ret_1d != null ? sec.avg_ret_1d : sec.etf_ret_1d;
      const intensity = Math.min(0.28, Math.max(0.08, Math.abs(r || 0) / 28));
      const bg = r > 0 ? `rgba(34, 197, 94, ${intensity})` : r < 0 ? `rgba(244, 63, 94, ${intensity})` : "var(--bg-card)";
      const active = state.activeSector === sec.sector ? "active-sector" : "";
      return `
        <div class="heat-tile ${active}" data-sector="${esc(sec.sector)}" style="background:${bg}">
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
      el.onclick = () => {
        state.activeSector = el.dataset.sector;
        renderScreener();
        setView("screener");
      };
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
              <div style="margin-top:4px"><span class="score-badge" ${tipAttr("notable_score")}>Score ${fmtNum(n.score, 0)}</span></div>
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
      $("clearSectorChip").classList.remove("hidden");
      $("activeSectorLabel").textContent = fmtSector(state.activeSector);
    } else {
      $("clearSectorChip").classList.add("hidden");
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

    // Render 1-tap Sector Filter Strip at top of Screener
    const sbar = $("sectorFilterBar");
    if (sbar) {
      const counts = {};
      for (const t of s.tickers || []) counts[t.sector] = (counts[t.sector] || 0) + 1;
      const secs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      sbar.innerHTML = [
        `<button class="chip ${!state.activeSector ? "active" : ""}" data-sec="">All Sectors (${(s.tickers || []).length})</button>`,
        ...secs.map((sec) => `<button class="chip ${state.activeSector === sec ? "active" : ""}" data-sec="${esc(sec)}">${esc(fmtSector(sec))} (${counts[sec]})</button>`),
      ].join("");
      sbar.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          state.activeSector = b.dataset.sec || null;
          renderScreener();
        };
      });
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
          <td class="num"><span class="score-badge" ${tipAttr("notable_score")}>${fmtNum(r.notable_score, 1)}</span></td>
          <td class="num ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</td>
          <td><div class="sma-dots">${sma}</div></td>
          <td class="num ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</td>
          <td class="num"><span class="muted">${s1Txt} / ${r1Txt}</span></td>
          <td>
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
            <div><div class="sc-m-k" ${tipAttr("notable_score")}>Score ?</div><div class="sc-m-v">${fmtNum(r.notable_score, 0)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("rsi14")}>RSI-14 ?</div><div class="sc-m-v ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("rs_spy")}>vs SPY ?</div><div class="sc-m-v ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</div></div>
            <div><div class="sc-m-k" ${tipAttr("sma")}>Trend ?</div><div class="sc-m-v"><div class="sma-dots">${sma}</div></div></div>
          </div>

          <div class="sc-bottom">
            <div ${tipAttr("scenarios")}>
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

  // ---- INTERACTIVE BUBBLE RELATIONSHIP NETWORK ----
  const REL_COLORS = {
    supplier: { stroke: "#22c55e", badge: "bull", label: "Supplier" },
    customer: { stroke: "#3b82f6", badge: "amber", label: "Customer" },
    partner: { stroke: "#a855f7", badge: "", label: "Partner / Infra" },
    competitor: { stroke: "#f43f5e", badge: "bear", label: "Competitor" },
    co_mention: { stroke: "#f59e0b", badge: "amber", label: "News Co-Mention" },
    peer: { stroke: "#64748b", badge: "", label: "Sector Peer" },
  };

  function renderBubbleNetwork(container, centerSym, filterKey, onRecenter) {
    if (!container || !state.summary) return;
    const net = state.summary.network || {};
    const linksMap = net.links_by_symbol || {};
    const bySym = Object.fromEntries((state.summary.tickers || []).map((t) => [t.symbol, t]));
    const center = bySym[centerSym] || (state.summary.tickers || [])[0];
    if (!center) return;

    const allLinks = linksMap[center.symbol] || [];
    const nonPeer = allLinks.filter((x) => x.type !== "peer");
    let shown = filterKey === "all"
      ? (nonPeer.length >= 4 ? [...nonPeer, ...allLinks.filter((x) => x.type === "peer").slice(0, 4)] : allLinks)
      : allLinks.filter((x) => x.type === filterKey);
    shown = shown.slice(0, 16);

    const counts = { all: allLinks.length };
    for (const l of allLinks) counts[l.type] = (counts[l.type] || 0) + 1;
    const filterTabs = [
      ["all", "All Links"],
      ["supplier", "Suppliers"],
      ["customer", "Customers"],
      ["partner", "Partners"],
      ["competitor", "Competitors"],
      ["co_mention", "News Co-Mentions"],
      ["peer", "Sector Peers"],
    ].filter(([k]) => k === "all" || counts[k] > 0);

    const W = 760, H = 420, cx = W / 2, cy = H / 2;
    const nodesPos = shown.map((item, idx) => {
      const total = Math.max(1, shown.length);
      const ring = total > 9 ? (idx % 2 === 0 ? 128 : 172) : 148;
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const r = Math.max(22, Math.min(34, 20 + (item.notable_score || 40) / 7));
      return {
        ...item,
        x: Math.round(cx + Math.cos(angle) * ring * 1.32),
        y: Math.round(cy + Math.sin(angle) * ring * 0.92),
        r: Math.round(r),
      };
    });

    const edgesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const mx = Math.round((cx + n.x) / 2);
      const my = Math.round((cy + n.y) / 2);
      return `
        <g class="bubble-edge" data-idx="${i}">
          <line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="${rc.stroke}" stroke-width="${n.type === "peer" ? 1.3 : 2.2}" stroke-opacity="0.55" ${n.type === "peer" || n.type === "competitor" ? 'stroke-dasharray="4 3"' : ""} />
          <rect x="${mx - 26}" y="${my - 8}" width="52" height="15" rx="7" fill="var(--bg-elev)" stroke="${rc.stroke}" stroke-opacity="0.45" />
          <text x="${mx}" y="${my + 3}" text-anchor="middle" fill="var(--text-soft)" font-size="8.5" font-weight="700">${esc(rc.label.split(" ")[0])}</text>
        </g>`;
    }).join("");

    const nodesSvg = nodesPos.map((n, i) => {
      const rc = REL_COLORS[n.type] || REL_COLORS.peer;
      const chg = n.change_1d_pct;
      const fill = chg > 0 ? "rgba(34, 197, 94, 0.22)" : chg < 0 ? "rgba(244, 63, 94, 0.22)" : "rgba(59, 130, 246, 0.2)";
      return `
        <g class="bubble-node" data-idx="${i}" data-sym="${esc(n.symbol)}">
          <circle cx="${n.x}" cy="${n.y}" r="${n.r + 3}" fill="none" stroke="${rc.stroke}" stroke-width="1.5" stroke-opacity="0.35" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="var(--bg-card)" stroke="${rc.stroke}" stroke-width="2.4" />
          <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}" />
          <text x="${n.x}" y="${n.y - 2}" text-anchor="middle" fill="var(--text)" font-size="11.5" font-weight="800">${esc(n.symbol)}</text>
          <text x="${n.x}" y="${n.y + 11}" text-anchor="middle" fill="${chg >= 0 ? "var(--green)" : "var(--red)"}" font-size="9.5" font-weight="700">${fmtPct(chg, 1)}</text>
        </g>`;
    }).join("");

    const cChg = center.change_1d_pct;
    const centerSvg = `
      <g class="bubble-node center-bubble" data-sym="${esc(center.symbol)}">
        <circle cx="${cx}" cy="${cy}" r="49" fill="rgba(59, 130, 246, 0.16)" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3" />
        <circle cx="${cx}" cy="${cy}" r="42" fill="var(--bg-elev)" stroke="var(--accent)" stroke-width="3" />
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="900">${esc(center.symbol)}</text>
        <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="var(--text-soft)" font-size="10.5" font-weight="700">$${fmtNum(center.close)}</text>
        <text x="${cx}" y="${cy + 19}" text-anchor="middle" fill="${cChg >= 0 ? "var(--green)" : "var(--red)"}" font-size="10" font-weight="800">${fmtPct(cChg, 1)}</text>
      </g>`;

    container.innerHTML = `
      <div class="bubble-card">
        <div class="bubble-header">
          <div>
            <strong style="font-size:15px">${esc(center.symbol)} (${esc(center.name)}) Ecosystem Bubble Map</strong>
            <span class="tag sector-link" data-sector="${esc(center.sector)}" style="margin-left:6px">${esc(fmtSector(center.sector))}</span>
            <div class="muted">Tap any connected bubble to inspect its relation or hop into its own bubble network</div>
          </div>
          <div class="chart-tabs" id="bubbleFilterBar">
            ${filterTabs.map(([k, lbl]) => `<button class="chip ${filterKey === k ? "active" : ""}" data-bf="${k}">${esc(lbl)} (${counts[k] || 0})</button>`).join("")}
          </div>
        </div>

        <div class="bubble-legend">
          <span><i class="legend-dot" style="background:#22c55e"></i>Supplier</span>
          <span><i class="legend-dot" style="background:#3b82f6"></i>Customer</span>
          <span><i class="legend-dot" style="background:#a855f7"></i>Partner / Infra</span>
          <span><i class="legend-dot" style="background:#f43f5e"></i>Competitor</span>
          <span><i class="legend-dot" style="background:#f59e0b"></i>News Co-Mention</span>
          <span><i class="legend-dot" style="background:#64748b"></i>Sector Peer</span>
        </div>

        <div class="bubble-stage">
          <svg class="bubble-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            ${edgesSvg}
            ${nodesSvg}
            ${centerSvg}
          </svg>
        </div>

        <div class="bubble-detail" id="bubbleDetailBox">
          <div>
            <strong>${esc(center.symbol)}</strong> has <strong>${allLinks.length}</strong> mapped connections across the watchlist.
            <span class="muted">Tap any orbiting bubble above to see how they connect.</span>
          </div>
          <div class="bubble-actions">
            <button class="btn-secondary" data-open-stock="${esc(center.symbol)}">Open ${esc(center.symbol)} Analysis →</button>
          </div>
        </div>
      </div>
    `;

    wireSectorLinks(container);
    container.querySelectorAll("[data-open-stock]").forEach((btn) => {
      btn.onclick = () => openStock(btn.dataset.openStock);
    });
    container.querySelector("#bubbleFilterBar")?.querySelectorAll("button").forEach((b) => {
      b.onclick = () => onRecenter(center.symbol, b.dataset.bf);
    });

    const detailBox = container.querySelector("#bubbleDetailBox");
    container.querySelectorAll(".bubble-node[data-idx]").forEach((nodeEl) => {
      nodeEl.onclick = () => {
        const item = nodesPos[Number(nodeEl.dataset.idx)];
        if (!item) return;
        const rc = REL_COLORS[item.type] || REL_COLORS.peer;
        detailBox.innerHTML = `
          <div style="flex:1;min-width:220px">
            <div>
              <strong>${esc(center.symbol)} ↔ ${esc(item.symbol)}</strong>
              <span class="tag ${rc.badge}" style="margin-left:6px">${esc(rc.label)}</span>
              <span class="tag sector-link" data-sector="${esc(item.sector)}" style="margin-left:4px">${esc(fmtSector(item.sector))}</span>
              <span class="${clsPct(item.change_1d_pct)}" style="margin-left:6px;font-weight:700">$${fmtNum(item.close)} (${fmtPct(item.change_1d_pct, 1)})</span>
            </div>
            <div class="muted" style="margin-top:4px">${esc(item.note || "Connected in the watchlist ecosystem")}${item.mentions ? ` · ${item.mentions} news co-mention(s) today` : ""}</div>
          </div>
          <div class="bubble-actions">
            <button class="btn-secondary" id="recenterBubbleBtn">Discover ${esc(item.symbol)} Bubble ⟲</button>
            <button class="btn-secondary" id="openSelectedBubbleBtn">Open ${esc(item.symbol)} Page →</button>
          </div>
        `;
        wireSectorLinks(detailBox);
        detailBox.querySelector("#recenterBubbleBtn").onclick = () => onRecenter(item.symbol, "all");
        detailBox.querySelector("#openSelectedBubbleBtn").onclick = () => openStock(item.symbol);
      };
    });

    container.querySelector(".center-bubble")?.addEventListener("click", () => openStock(center.symbol));
  }

  function renderNetworkView() {
    const s = state.summary;
    if (!s) return;
    const hubs = ["NVDA", "TSM", "MU", "MSFT", "AMZN", "GOOGL", "CRWV", "AVGO", "AMD", "MRVL", "ORCL", "TSLA", "CEG", "NBIS", "IREN", "XOM"];
    const avail = hubs.filter((h) => (s.tickers || []).some((t) => t.symbol === h));
    if (!avail.includes(state.networkCenter) && !(s.tickers || []).some((t) => t.symbol === state.networkCenter)) {
      state.networkCenter = avail[0] || (s.tickers?.[0]?.symbol ?? "NVDA");
    }
    const bar = $("networkHubBar");
    if (bar) {
      bar.innerHTML = (s.tickers || []).map((t) =>
        `<button class="chip ${t.symbol === state.networkCenter ? "active" : ""}" data-hub="${esc(t.symbol)}">${esc(t.symbol)}</button>`
      ).join("");
      bar.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          state.networkCenter = b.dataset.hub;
          state.networkFilter = "all";
          renderNetworkView();
        };
      });
    }
    renderBubbleNetwork($("globalNetworkContainer"), state.networkCenter, state.networkFilter, (newCenter, newFilter) => {
      state.networkCenter = newCenter;
      state.networkFilter = newFilter;
      renderNetworkView();
    });
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
          <div class="muted" ${tipAttr("sr_strength")}><span class="strength-bar"><span class="strength-fill" style="width:${Math.min(100, x.strength || 0)}%"></span></span>${fmtNum(x.strength, 0)}/100 ?</div>
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
              <span class="score-badge" ${tipAttr("notable_score")}>Score ${fmtNum(t.notable?.score, 0)} <span class="tip-badge">?</span></span>
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
          <h2 ${tipAttr("scenarios")}>Rule-Based 20-Day Scenarios <span class="tip-badge">?</span></h2>
          <p class="section-sub" ${tipAttr("tech_score")}>Heuristic model (not advice) · Technical score ${fmtNum(judg.score, 2)} <span class="tip-badge">?</span></p>
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

    // Mount interactive Ecosystem Bubble Network for this stock (supports hopping bubble-to-bubble)
    state.stockBubbleCenter = t.symbol;
    state.stockBubbleFilter = "all";
    const mountStockBubbles = () => {
      renderBubbleNetwork($("stockBubbleMount"), state.stockBubbleCenter, state.stockBubbleFilter, (newCenter, newFilter) => {
        state.stockBubbleCenter = newCenter;
        state.stockBubbleFilter = newFilter;
        mountStockBubbles();
      });
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

    const closeModal = () => $("imgModal").classList.add("hidden");
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
