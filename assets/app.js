/* Daily Equity Research Dynamic Dashboard (Desktop + Mobile-First) */
(() => {
  const state = {
    index: null,
    date: null,
    summary: null,
    breaking: [],
    tickerCache: {},
    view: "overview",
    prevView: "overview",
    activeTicker: null,
    filter: "all",
    activeSector: null,
    sortKey: "notable_score",
    sortDir: -1,
    stockTab: "news",
    chartTab: "daily",
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
    if (view !== "stock") state.prevView = view;
    state.view = view;
    for (const v of ["overview", "screener", "smartmoney", "breaking", "macro", "stock"]) {
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
  }

  // ---- LOAD DATA ----
  async function loadBreaking() {
    try {
      const b = await fetchJson("data/breaking_news.json");
      state.breaking = Array.isArray(b.items) ? b.items : [];
      $("breakingCount").textContent = String(state.breaking.length);
      if (b.updated_at) $("breakingUpdated").textContent = `Updated ${b.updated_at.replace("T", " ").replace("Z", " UTC")} · Auto-checked every 2h Mon–Fri`;
    } catch {
      state.breaking = [];
      $("breakingCount").textContent = "0";
    }
    renderBreaking();
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
      renderSmartMoney();
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
        val: `${adv}↑ / ${dec}↓`,
        cls: clsPct(br.avg_ret_1d),
        sub: `Avg 1D: ${fmtPct(br.avg_ret_1d)}`,
        extra: `<div class="breadth-bar"><div class="breadth-up" style="width:${advPct}%"></div><div class="breadth-dn" style="width:${100 - advPct}%"></div></div>`,
      },
      { label: "US 10Y", val: mp.dgs10 ? `${fmtNum(mp.dgs10.latest, 2)}%` : "—", cls: "", sub: mp.dgs10 ? `1W: ${fmtNum(mp.dgs10.change_1w, 2)}pp` : "FRED" },
      { label: "VIX", val: mp.vix ? fmtNum(mp.vix.latest, 1) : "—", cls: mp.vix && mp.vix.latest >= 20 ? "warn" : "", sub: mp.vix ? `1W: ${fmtNum(mp.vix.change_1w, 1)}` : "FRED" },
      { label: "WTI Oil", val: mp.wti ? `$${fmtNum(mp.wti.latest, 1)}` : "—", cls: "", sub: mp.wti ? `1M: ${fmtNum(mp.wti.change_1m, 1)}` : "FRED" },
      { label: "Next FOMC", val: fomcDays, cls: "", sub: fomcNext ? fomcNext : "Fed calendar" },
    ];
    $("kpiStrip").innerHTML = kpis.map((k) => `
      <div class="kpi-card">
        <div class="kpi-label">${esc(k.label)}</div>
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
              <div class="notable-sym">${esc(n.symbol)}${row.is_core ? ' <span class="core-star">★</span>' : ""}</div>
              <div class="notable-name">${esc(row.name || "")}</div>
            </div>
            <div style="text-align:right">
              <div class="price-pill ${clsPct(row.change_1d_pct)}">$${fmtNum(row.close)} · ${fmtPct(row.change_1d_pct, 1)}</div>
              <div style="margin-top:4px"><span class="score-badge">Score ${fmtNum(n.score, 0)}</span></div>
            </div>
          </div>
          <ul class="notable-why">${(n.why || []).slice(0, 2).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
        </div>
      `;
    }).join("");
    $("notableGrid").querySelectorAll(".notable-card").forEach((el) => {
      el.onclick = () => openStock(el.dataset.sym);
    });
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
          <td><span class="tag">${esc(fmtSector(r.sector))}</span></td>
          <td class="num"><strong>$${fmtNum(r.close)}</strong></td>
          <td class="num ${clsPct(r.change_1d_pct)}"><strong>${fmtPct(r.change_1d_pct)}</strong></td>
          <td class="num"><span class="score-badge">${fmtNum(r.notable_score, 1)}</span></td>
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
                <span class="tag">${esc(fmtSector(r.sector))}</span>
              </div>
              <div class="muted" style="margin-top:2px">${esc(r.name)}</div>
            </div>
            <div class="sc-price-col">
              <div class="sc-price">$${fmtNum(r.close)}</div>
              <span class="price-pill ${clsPct(r.change_1d_pct)}" style="margin-top:3px;font-size:12px">${fmtPct(r.change_1d_pct)}</span>
            </div>
          </div>

          <div class="sc-metrics">
            <div><div class="sc-m-k">Score</div><div class="sc-m-v">${fmtNum(r.notable_score, 0)}</div></div>
            <div><div class="sc-m-k">RSI-14</div><div class="sc-m-v ${r.rsi14 < 30 ? "neg" : r.rsi14 > 70 ? "pos" : ""}">${fmtNum(r.rsi14, 1)}</div></div>
            <div><div class="sc-m-k">vs SPY</div><div class="sc-m-v ${clsPct(r.rs_spy_21d)}">${fmtPct(r.rs_spy_21d, 1)}</div></div>
            <div><div class="sc-m-k">Trend</div><div class="sc-m-v"><div class="sma-dots">${sma}</div></div></div>
          </div>

          <div class="sc-bottom">
            <div>
              <div class="prob-bar">
                <div class="prob-bull" style="width:${sc.bullish}%"></div>
                <div class="prob-base" style="width:${sc.base}%"></div>
                <div class="prob-bear" style="width:${sc.bearish}%"></div>
              </div>
              <div class="prob-labels">Bull ${sc.bullish}% · Base ${sc.base}% · Bear ${sc.bearish}%</div>
            </div>
            <div style="text-align:right">
              ${earnChip || `<span class="muted">${esc(s1r1)}</span>`}
            </div>
          </div>
        </div>
      `;
    }).join("") : `<div class="panel muted">No stocks match the active filter.</div>`;

    $("screenerCards").querySelectorAll(".stock-card").forEach((card) => {
      card.onclick = () => openStock(card.dataset.sym);
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
  function renderBreaking() {
    const el = $("breakingList");
    if (!state.breaking.length) {
      el.innerHTML = `<div class="panel muted">No breaking alerts yet. Important headlines are checked every 2 hours on weekdays and posted here &amp; to Telegram.</div>`;
      return;
    }
    el.innerHTML = state.breaking.map((item) => `
      <div class="feed-item">
        <div class="feed-meta">
          <span class="ticker-pill" data-sym="${esc(item.symbol)}"><strong>${esc(item.symbol)}</strong></span>
          <span class="tag amber">Score ${fmtNum(item.importance, 0)}</span>
          ${(item.categories || []).slice(0, 2).map((c) => `<span class="tag">${esc(c.replace(/_/g, " "))}</span>`).join("")}
          <span>${esc(item.source || "")} · ${esc((item.published || "").replace("T", " ").slice(0, 16))}</span>
        </div>
        <a class="feed-title" href="${esc(item.url || "#")}" target="_blank" rel="noopener">${esc(item.title)}</a>
      </div>
    `).join("");
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

    if (!charts.includes(state.chartTab) && charts.length) state.chartTab = charts[0];
    const chartUrl = (kind) => `data/${state.date}/charts/${t.symbol}_${kind}.png`;

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
          <span class="tag ${x.role === "support" ? "bull" : "bear"}">${esc(x.label)}</span>
          <strong style="margin-left:6px">$${fmtNum(x.price)}</strong>
          <span class="muted" style="margin-left:5px">($${fmtNum(x.band_low)}–$${fmtNum(x.band_high)})</span>
        </div>
        <div style="text-align:right">
          <span class="${clsPct(x.distance_pct)}" style="font-weight:700;font-size:12.5px">${fmtPct(x.distance_pct, 1)}</span>
          <div class="muted"><span class="strength-bar"><span class="strength-fill" style="width:${Math.min(100, x.strength || 0)}%"></span></span>${fmtNum(x.strength, 0)}/100</div>
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
              <span class="score-badge">Score ${fmtNum(t.notable?.score, 0)}</span>
            </h1>
            <div class="stock-company">${esc(t.name)} · ${esc(fmtSector(t.sector))} (${esc(t.sector_etf || "")})</div>
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

      ${charts.length ? `
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-tabs" id="chartTabs">
            ${charts.map((c) => `<button class="chip ${c === state.chartTab ? "active" : ""}" data-chart="${c}">${c === "daily" ? "Daily + S/R" : c === "momentum" ? "RSI / MACD" : "Weekly"}</button>`).join("")}
          </div>
          <span class="muted">Tap chart to zoom</span>
        </div>
        <img id="activeChartImg" class="chart-img" src="${chartUrl(state.chartTab)}" alt="${esc(t.symbol)} chart" />
      </div>` : ""}

      <div class="section-header">
        <div>
          <h2>Rule-Based 20-Day Scenarios</h2>
          <p class="section-sub">Heuristic model (not advice) · Technical score ${fmtNum(judg.score, 2)}</p>
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
          <h3>Support &amp; Resistance Ladder</h3>
          <div class="level-list">
            ${resLevels.map(renderLevelRow).join("")}
            <div class="level-current">Current Price · $${fmtNum(facts.last_close)}</div>
            ${supLevels.map(renderLevelRow).join("")}
          </div>
        </div>

        <div class="panel">
          <h3>Indicators &amp; Fundamentals</h3>
          <div class="kv-grid">
            <div class="kv"><div class="kv-k">RSI (14)</div><div class="kv-v">${fmtNum(ind.rsi14, 1)} <span class="muted">${esc(ind.rsi_zone || "")}</span></div></div>
            <div class="kv"><div class="kv-k">SMA 20/50/200</div><div class="kv-v">${fmtNum(ind.sma20, 0)} / ${fmtNum(ind.sma50, 0)} / ${fmtNum(ind.sma200, 0)}</div></div>
            <div class="kv"><div class="kv-k">vs SPY (21d)</div><div class="kv-v ${clsPct(rs.vs_spy?.["21d"])}">${fmtPct(rs.vs_spy?.["21d"], 1)}</div></div>
            <div class="kv"><div class="kv-k">vs ${esc(t.sector_etf || "Sector")} (21d)</div><div class="kv-v ${clsPct(rs.vs_sector?.["21d"])}">${fmtPct(rs.vs_sector?.["21d"], 1)}</div></div>
            <div class="kv"><div class="kv-k">Market Cap</div><div class="kv-v">${fmtCap(val.market_cap)}</div></div>
            <div class="kv"><div class="kv-k">P/E (TTM / Fwd)</div><div class="kv-v">${fmtNum(val.trailing_pe, 1)} / ${fmtNum(val.forward_pe, 1)}</div></div>
            <div class="kv"><div class="kv-k">FCF (TTM)</div><div class="kv-v">${fmtCap(der.free_cash_flow_ttm)}</div></div>
            <div class="kv"><div class="kv-k">Cash / Debt</div><div class="kv-v">${fmtCap(der.cash)} / ${fmtCap(der.total_debt)}</div></div>
            <div class="kv"><div class="kv-k">Analyst Target Δ</div><div class="kv-v ${clsPct(der.target_mean_vs_price_pct)}">${fmtPct(der.target_mean_vs_price_pct, 1)}</div></div>
            <div class="kv"><div class="kv-k">Vol vs 20d Avg</div><div class="kv-v">${fmtNum(ind.vol_ratio_vs_20d, 2)}x <span class="muted">(${fmtCap((facts.last_close || 0) * (facts.last_volume || 0))})</span></div></div>
            <div class="kv"><div class="kv-k">Up/Dn Vol (20d)</div><div class="kv-v ${ind.updown_volume_20d != null ? (ind.updown_volume_20d >= 1.2 ? "pos" : ind.updown_volume_20d <= 0.8 ? "neg" : "") : ""}">${fmtNum(ind.updown_volume_20d, 2)}</div></div>
            <div class="kv"><div class="kv-k">Short % Float</div><div class="kv-v">${val.short_pct_float != null ? `${fmtNum(val.short_pct_float * 100, 1)}%` : "—"}</div></div>
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

    const tabsEl = $("chartTabs");
    if (tabsEl) {
      tabsEl.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          state.chartTab = b.dataset.chart;
          tabsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
          $("activeChartImg").src = chartUrl(state.chartTab);
        };
      });
      $("activeChartImg").onclick = () => {
        $("modalImg").src = $("activeChartImg").src;
        $("imgModal").classList.remove("hidden");
      };
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

  // ---- BOOT ----
  async function boot() {
    initTheme();
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
      if (wantedView && ["overview", "screener", "smartmoney", "breaking", "macro"].includes(wantedView)) state.view = wantedView;

      await loadBreaking();
      await loadDate(targetDate, wantedTicker);
    } catch (err) {
      $("loadingState").classList.add("hidden");
      $("errorState").textContent = `Failed to load dashboard index: ${err.message}`;
      $("errorState").classList.remove("hidden");
    }
  }

  boot();
})();
