#!/usr/bin/env python3
"""5-minute real-time market quote, wire news, SEC 8-K & significance-tiered Telegram dispatcher."""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DASHBOARD_URL = "https://esrasekerci.github.io/equity-dashboard/"

LOW_QUALITY = (
    "tikr", "24/7 wall st", "247wallst", "motley fool", "fool.com", "simply wall st",
    "marketbeat", "pluang", "gurufocus", "stocktwits", "insider monkey", "investorplace", "zacks",
)
OPINION_RE = re.compile(
    r"(should you buy|should you sell|better buy|stocks to buy|stock to buy|price prediction|"
    r"millionaire|no-brainer|screaming buy|buy now|top stocks|best stocks|is it time to|here's why)",
    re.IGNORECASE,
)
CRITICAL_RE = re.compile(
    r"\b(8-k|earnings|quarterly results|guidance|outlook|raises forecast|cuts forecast|beats|misses|"
    r"acquire|acquisition|merger|buyout|tariff|tariffs|export control|sanction|sanctions|antitrust|"
    r"subpoena|doj|ftc|sec |federal reserve|fomc|powell|rate cut|rate hike|executive order|halt|recall|breach)\b",
    re.IGNORECASE,
)
HIGH_RE = re.compile(
    r"\b(upgrade|downgrade|price target|initiates coverage|overweight|underweight|outperform|"
    r"morgan stanley|goldman sachs|jpmorgan|citigroup|barclays|ubs |bernstein|jefferies|bofa|wedbush|"
    r"contract|partnership|agreement|supply deal|multi-year|data center|blackwell|rubin|cowos|hbm|"
    r"tsmc|capex|gigawatt|nuclear|buyback|repurchase|dividend|offering|ceo|cfo|appoints|resigns)\b",
    re.IGNORECASE,
)

WIRES = [
    ("CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"),
    ("CNBC Earnings", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135"),
    ("CNBC Tech", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910"),
    ("CNBC Investing", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069"),
    ("CNBC Economy", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]

ALIASES = {
    "NVDA": ["nvidia", "blackwell", "geforce"], "AAPL": ["apple", "iphone"], "MSFT": ["microsoft", "azure"],
    "GOOGL": ["google", "alphabet", "waymo", "deepmind"], "AMZN": ["amazon", "aws"],
    "META": ["meta platforms", "facebook", "instagram", "llama"], "TSLA": ["tesla", "cybertruck", "optimus"],
    "TSM": ["tsmc", "taiwan semiconductor"], "AVGO": ["broadcom"], "AMD": ["amd", "advanced micro"],
    "INTC": ["intel"], "MU": ["micron"], "ASML": ["asml"], "AMAT": ["applied materials"],
    "LRCX": ["lam research"], "KLAC": ["kla corp"], "ARM": ["arm holdings"], "MRVL": ["marvell"],
    "QCOM": ["qualcomm"], "ORCL": ["oracle"], "PLTR": ["palantir"], "CRWV": ["coreweave"],
    "NBIS": ["nebius"], "SMCI": ["super micro", "supermicro"], "DELL": ["dell technologies"],
    "VRT": ["vertiv"], "ANET": ["arista"], "CRWD": ["crowdstrike"], "PANW": ["palo alto networks"],
    "SNOW": ["snowflake"], "NOW": ["servicenow"], "CRM": ["salesforce"], "NFLX": ["netflix"],
    "UBER": ["uber"], "SHOP": ["shopify"], "SPOT": ["spotify"], "COIN": ["coinbase"],
    "JPM": ["jpmorgan", "jp morgan"], "GS": ["goldman sachs"], "MS": ["morgan stanley"],
    "BAC": ["bank of america"], "BRK-B": ["berkshire hathaway", "berkshire"], "BLK": ["blackrock"],
    "LLY": ["eli lilly", "zepbound", "mounjaro"], "UNH": ["unitedhealth"], "BA": ["boeing"],
    "LMT": ["lockheed martin"], "RTX": ["raytheon"], "GEV": ["ge vernova"], "CEG": ["constellation energy"],
    "VST": ["vistra"], "OKLO": ["oklo"], "XOM": ["exxon", "exxonmobil"], "CVX": ["chevron"],
    "GLD": ["gold price", "spot gold", "gold bullion"], "SLV": ["silver price", "spot silver"],
    "FCX": ["freeport-mcmoran"], "SCCO": ["southern copper"],
}


def story_key(title: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
    core = " ".join(clean.split()[:9])
    return hashlib.sha1(core.encode("utf-8")).hexdigest()[:16]


def parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = raw.strip()
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def clean_num(v: Any) -> float | None:
    if v is None:
        return None
    s = str(v).replace(",", "").replace("%", "").replace("+", "").strip()
    if not s or s == "--":
        return None
    if s == "UNCH":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def session_label(now_utc: datetime) -> str:
    et = now_utc.astimezone(ZoneInfo("America/New_York"))
    if et.weekday() >= 5:
        return "WEEKEND / OFF-MARKET"
    m = et.hour * 60 + et.minute
    if 240 <= m < 570:
        return "PRE-MARKET"
    if 570 <= m < 960:
        return "MARKET OPEN"
    if 960 <= m < 1200:
        return "AFTER-HOURS"
    return "OVERNIGHT / OFF-MARKET"


def matches_ticker(title: str, sym: str, name: str) -> bool:
    tl = title.lower()
    for a in ALIASES.get(sym, []):
        if re.search(rf"(?<![a-z]){re.escape(a)}(?![a-z])", tl):
            return True
    first = (name or "").split()[0].lower().strip(",.") if name else ""
    if len(first) >= 5 and first not in {"applied", "advanced", "first", "general", "united", "american", "global", "southern", "constellation"}:
        if re.search(rf"(?<![a-z]){re.escape(first)}(?![a-z])", tl):
            return True
    if len(sym) >= 3 and sym not in {"NOW", "ARM", "APP", "CAT", "MOD", "ALL"}:
        if re.search(rf"(?<![A-Za-z]){re.escape(sym)}(?![A-Za-z])", title):
            return True
    return False


def classify_item(title: str, source: str, matched_sym: str | None) -> tuple[float, str, str]:
    cat = "general"
    imp = 48.0 if matched_sym else 38.0
    if any(t in source.lower() for t in ("reuters", "bloomberg", "wsj", "cnbc", "sec", "financial times", "barron", "ap ")):
        imp += 10.0
    elif any(t in source.lower() for t in ("marketwatch", "yahoo", "techcrunch", "investing")):
        imp += 5.0

    if CRITICAL_RE.search(title):
        imp += 26.0
        if re.search(r"\b(tariff|fomc|powell|federal reserve|sanction|export control|executive order)\b", title, re.I):
            cat = "policy_geopolitics"
        elif re.search(r"\b(doj|ftc|sec |subpoena|antitrust|halt)\b", title, re.I):
            cat = "regulatory_legal"
        elif re.search(r"\b(acquire|acquisition|merger|buyout)\b", title, re.I):
            cat = "m_and_a"
        else:
            cat = "earnings_guidance"
    elif HIGH_RE.search(title):
        imp += 15.0
        if re.search(r"\b(upgrade|downgrade|price target|initiates|overweight|underweight|outperform|morgan stanley|goldman|jpmorgan|bofa|citi|barclays|ubs|bernstein|wedbush)\b", title, re.I):
            cat = "analyst"
        elif re.search(r"\b(data center|blackwell|rubin|cowos|hbm|tsmc|capex|gigawatt|nuclear)\b", title, re.I):
            cat = "data_centers_ai"
        else:
            cat = "contract_partnership"

    imp = min(98.0, round(imp, 1))
    sig = "CRITICAL" if imp >= 76.0 else ("HIGH" if imp >= 56.0 else "NOTABLE")
    return imp, sig, cat


def fmt_age(age_h: float) -> str:
    mins = max(1, int(round(age_h * 60)))
    return f"{mins}m ago" if mins < 60 else f"{age_h:.1f}h ago"


def send_tg_message(token: str, chat_id: str, header: str, items: list[dict]) -> bool:
    lines = [f"<b>{header}</b>"]
    for it in items:
        sym = html.escape(str(it["symbol"]))
        title = html.escape(str(it["title"]))
        src = html.escape(str(it.get("source") or "Wire"))
        url = (it.get("url") or "").strip()
        age = fmt_age(float(it.get("age_hours") or 0.05))
        src_html = f'<a href="{html.escape(url, quote=True)}">{src}</a>' if url else src
        lines.append(f"- <b>{sym}</b>: {title} ({src_html}, {age})")
    lines.append(f'\n<a href="{DASHBOARD_URL}">Open Live App</a>')
    payload = {
        "chat_id": chat_id,
        "text": "\n".join(lines)[:4000],
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": json.dumps({"inline_keyboard": [[{"text": "Open Live App", "url": DASHBOARD_URL}]]}),
    }
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", data=payload, timeout=20)
    return r.status_code == 200


def main() -> None:
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat(timespec="seconds")
    today_tag = now_iso[:10]
    sess_lbl = session_label(now_dt)

    idx_path = DATA_DIR / "index.json"
    if not idx_path.exists():
        return
    latest_date = json.loads(idx_path.read_text(encoding="utf-8")).get("latest")
    if not latest_date:
        return
    sum_path = DATA_DIR / latest_date / "summary.json"
    if not sum_path.exists():
        return
    summary = json.loads(sum_path.read_text(encoding="utf-8"))
    tickers_list = summary.get("tickers") or []
    ticker_names = {t["symbol"]: t.get("name", t["symbol"]) for t in tickers_list if t.get("symbol")}
    etfs = [s.get("etf") for s in (summary.get("heatmap", {}).get("sectors") or []) if s.get("etf")]

    seen_path = DATA_DIR / "seen_news.json"
    breaking_path = DATA_DIR / "breaking_news.json"
    seen: dict[str, str] = json.loads(seen_path.read_text(encoding="utf-8")) if seen_path.exists() else {}
    existing = (json.loads(breaking_path.read_text(encoding="utf-8")).get("items") or []) if breaking_path.exists() else []

    # 1. Real-time zero-delay CNBC batch quote + macro refresh
    all_syms = sorted(set(list(ticker_names.keys()) + etfs + ["SPY", "QQQ"]))
    cnbc_syms = [s.replace("-", ".") for s in all_syms] + [".VIX", "US10Y", "@CL.1"]
    quotes: dict[str, dict[str, Any]] = {}
    vix_quote = None
    try:
        rq = requests.get(
            "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol",
            params={"symbols": "|".join(cnbc_syms), "requestMethod": "itv", "noform": "1", "partnerId": "2", "fund": "0", "exthrs": "1", "output": "json"},
            headers={"Origin": "https://esrasekerci.github.io", "User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        if rq.ok:
            fq = (rq.json().get("FormattedQuoteResult") or {}).get("FormattedQuote") or []
            if isinstance(fq, dict):
                fq = [fq]
            for it in fq:
                rs = it.get("symbol")
                rc = clean_num(it.get("last"))
                if not rs or rc is None or rc <= 0:
                    continue
                if rs in (".VIX", "US10Y", "@CL.1"):
                    if rs == ".VIX":
                        vix_quote = {"close": rc, "pct": clean_num(it.get("change_pct")) or 0.0}
                    continue
                sym = str(rs).replace(".", "-").upper()
                chg_u = clean_num(it.get("change")) or 0.0
                chg_p = clean_num(it.get("change_pct")) or 0.0
                mkt_st = str(it.get("curmktstatus") or "").upper()
                vol = int(clean_num(it.get("volume")) or 0)
                lt_s = str(it.get("last_time") or "")
                reg_bar = lt_s[:10] if len(lt_s) >= 10 and lt_s[4:5] == "-" else None
                ext_p = ext_u = ext_c = ext_l = None
                ext_obj = it.get("ExtendedMktQuote")
                if mkt_st != "REG_MKT" and isinstance(ext_obj, dict):
                    ep = clean_num(ext_obj.get("last"))
                    if ep and ep > 0:
                        ext_p = round(ep, 2)
                        ext_u = round(clean_num(ext_obj.get("change")) or (ep - rc), 2)
                        ext_c = round(clean_num(ext_obj.get("change_pct")) or (((ep - rc) / rc) * 100.0), 2)
                        ext_l = "Pre-Market" if "PRE" in str(ext_obj.get("type") or mkt_st).upper() else "After-Hours"
                quotes[sym] = {
                    "close": round(rc, 2),
                    "change_1d_usd": round(chg_u, 2),
                    "change_1d_pct": round(chg_p, 2),
                    "ext_price": ext_p,
                    "ext_change_usd": ext_u,
                    "ext_change_pct": ext_c,
                    "ext_label": ext_l,
                    "last_bar": reg_bar,
                    "session": sess_lbl,
                    "volume": vol,
                    "dollar_volume_usd": round(rc * vol, 0),
                }
    except Exception:
        pass

    new_alerts: list[dict] = []
    mega_core = {"NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "TSM", "BRK-B", "LLY", "JPM"}

    if quotes:
        (DATA_DIR / "live_quotes.json").write_text(
            json.dumps({"updated_at": now_iso, "session": sess_lbl, "spy": quotes.get("SPY"), "quotes": quotes}, separators=(",", ":")),
            encoding="utf-8",
        )
        adv = dec = 0
        rets = []
        sec_rets: dict[str, list[float]] = {}
        for row in tickers_list:
            s = row.get("symbol", "")
            q = quotes.get(s)
            if q:
                row["close"] = q["close"]
                row["change_1d_usd"] = q["change_1d_usd"]
                row["change_1d_pct"] = q["change_1d_pct"]
                row["ext_price"] = q["ext_price"]
                row["ext_change_usd"] = q["ext_change_usd"]
                row["ext_change_pct"] = q["ext_change_pct"]
                row["ext_label"] = q["ext_label"]
            c1d = row.get("change_1d_pct")
            if c1d is not None:
                cv = float(c1d)
                rets.append(cv)
                if cv > 0:
                    adv += 1
                elif cv < 0:
                    dec += 1
                sec_rets.setdefault(row.get("sector") or "other", []).append(cv)
        if rets and "breadth" in summary:
            summary["breadth"]["advancers"] = adv
            summary["breadth"]["decliners"] = dec
            summary["breadth"]["unchanged"] = max(0, len(tickers_list) - adv - dec)
            summary["breadth"]["avg_ret_1d"] = round(sum(rets) / len(rets), 2)
        hm = summary.get("heatmap") or {}
        if "SPY" in quotes:
            hm["spy_ret_1d"] = quotes["SPY"]["change_1d_pct"]
        for st in hm.get("sectors") or []:
            ek = st.get("etf")
            sk = st.get("sector")
            if ek in quotes:
                st["etf_ret_1d"] = quotes[ek]["change_1d_pct"]
            if sk in sec_rets and sec_rets[sk]:
                st["avg_ret_1d"] = round(sum(sec_rets[sk]) / len(sec_rets[sk]), 2)
        sum_path.write_text(json.dumps(summary, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

        # Multi-tier price & benchmark shock checks
        for sym, q in quotes.items():
            chg = q["change_1d_pct"] if sess_lbl == "MARKET OPEN" else (q.get("ext_change_pct") or 0.0)
            prc = q["close"] if sess_lbl == "MARKET OPEN" else (q.get("ext_price") or q["close"])
            ac = abs(chg)
            tlvl, imp = 0, 0.0
            if sym in {"SPY", "QQQ", "GLD", "SLV"}:
                if ac >= 2.25:
                    tlvl, imp = 2, 88.0
                elif ac >= 1.25:
                    tlvl, imp = 1, 70.0
            elif sym in mega_core:
                if ac >= 6.5:
                    tlvl, imp = 3, 94.0
                elif ac >= 4.0:
                    tlvl, imp = 2, 84.0
                elif ac >= (2.2 if sess_lbl == "MARKET OPEN" else 2.0):
                    tlvl, imp = 1, 66.0
            elif sym in ticker_names:
                if ac >= 8.0:
                    tlvl, imp = 3, 95.0
                elif ac >= 5.0:
                    tlvl, imp = 2, 85.0
                elif ac >= (3.0 if sess_lbl == "MARKET OPEN" else 2.6):
                    tlvl, imp = 1, 64.0
            if tlvl > 0:
                d_str = "surge" if chg > 0 else "drop"
                s_key = "reg" if sess_lbl == "MARKET OPEN" else (q.get("ext_label") or "ext").lower()
                k = f"shock_{sym}_{today_tag}_{s_key}_{d_str}_t{tlvl}"
                if k not in seen:
                    nm = ticker_names.get(sym, sym)
                    stag = f" ({q['ext_label']})" if sess_lbl != "MARKET OPEN" and q.get("ext_label") else ""
                    new_alerts.append({
                        "key": k,
                        "symbol": sym,
                        "name": nm,
                        "title": f"{nm} ({sym}) {('gains' if chg > 0 else 'drops')} {chg:+.2f}% to ${prc:.2f}{stag}",
                        "url": f"https://finance.yahoo.com/quote/{sym}",
                        "source": f"Live Market Tape{stag}",
                        "source_tier": 1,
                        "published": now_iso,
                        "importance": imp,
                        "significance": "CRITICAL" if imp >= 76.0 else "HIGH",
                        "categories": ["market_move"],
                        "age_hours": 0.02,
                        "detected_at": now_iso,
                    })
        if vix_quote and vix_quote["close"] >= 26.0 and abs(vix_quote["pct"]) >= 12.0:
            vk = f"shock_VIX_{today_tag}_{'up' if vix_quote['pct'] > 0 else 'dn'}"
            if vk not in seen:
                new_alerts.append({
                    "key": vk,
                    "symbol": "VIX",
                    "name": "CBOE Volatility Index",
                    "title": f"CBOE Volatility Index (VIX) {('surges' if vix_quote['pct'] > 0 else 'drops')} {vix_quote['pct']:+.2f}% to {vix_quote['close']:.2f}",
                    "url": "https://www.cnbc.com/quotes/.VIX",
                    "source": "CBOE Live Index",
                    "source_tier": 1,
                    "published": now_iso,
                    "importance": 90.0,
                    "significance": "CRITICAL",
                    "categories": ["market_move"],
                    "age_hours": 0.02,
                    "detected_at": now_iso,
                })

    # 2. Scan real-time wires + rotating Google News ticker queries + SEC live 8-K Atom feed
    all_t_keys = list(ticker_names.keys())
    slot = ((now_dt.hour * 12 + now_dt.minute // 5) * 18) % max(1, len(all_t_keys))
    rot_syms = list(dict.fromkeys(list(mega_core) + all_t_keys[slot:slot + 18]))
    gnews_feeds = [
        (sym, f"https://news.google.com/rss/search?q={quote_plus(ticker_names[sym] + ' ' + sym + ' stock when:2h')}&hl=en-US&gl=US&ceid=US:en")
        for sym in rot_syms if sym in ticker_names
    ]

    def fetch_rss_feed(spec: tuple[str, str, str | None]) -> list[dict]:
        default_src, url, forced_sym = spec
        hits = []
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6)
            if not r.ok:
                return []
            root = ET.fromstring(r.text)
        except Exception:
            return []
        for el in list(root.iter()):
            if el.tag.split("}")[-1] != "item":
                continue
            vals = {ch.tag.split("}")[-1]: (ch.text or "").strip() for ch in el}
            raw_t = vals.get("title", "")
            src = vals.get("source") or default_src
            if forced_sym and " - " in raw_t:
                parts = raw_t.rsplit(" - ", 1)
                raw_t, src = parts[0].strip(), parts[1].strip() or src
            link = vals.get("link", "")
            pub = parse_dt(vals.get("pubDate") or vals.get("published"))
            if not raw_t or not link or pub is None or raw_t.endswith("?") or OPINION_RE.search(raw_t):
                continue
            if any(b in src.lower() for b in LOW_QUALITY):
                continue
            age_h = (now_dt - pub).total_seconds() / 3600.0
            if age_h < -0.5 or age_h > 4.0:
                continue
            k = story_key(raw_t)
            if k in seen:
                continue

            m_sym = None
            if forced_sym:
                if matches_ticker(raw_t, forced_sym, ticker_names.get(forced_sym, forced_sym)):
                    m_sym = forced_sym
                else:
                    continue
            else:
                for s_cand, s_nm in ticker_names.items():
                    if matches_ticker(raw_t, s_cand, s_nm):
                        m_sym = s_cand
                        break

            imp, sig, cat = classify_item(raw_t, src, m_sym)
            if not m_sym and imp < 64.0:
                continue
            if imp < 42.0:
                continue
            tag = m_sym or ("POLICY" if cat in ("policy_geopolitics", "regulatory_legal") else "MACRO")
            hits.append({
                "key": k,
                "symbol": tag,
                "name": ticker_names.get(tag, tag),
                "title": raw_t,
                "url": link,
                "source": src,
                "source_tier": 1 if imp >= 68 else 2,
                "published": pub.astimezone(timezone.utc).isoformat(timespec="seconds"),
                "importance": imp,
                "significance": sig,
                "categories": [cat],
                "age_hours": round(max(0.0, age_h), 2),
                "detected_at": now_iso,
            })
        return hits

    tasks = [(s, u, None) for s, u in WIRES] + [("Google News", u, sym) for sym, u in gnews_feeds]
    raw_candidates: list[dict] = []
    with ThreadPoolExecutor(max_workers=14) as ex:
        for res_list in ex.map(fetch_rss_feed, tasks):
            raw_candidates.extend(res_list)

    # Also check SEC EDGAR live 8-K Atom stream (1 single fast request covers all US public companies)
    ua = os.environ.get("SEC_USER_AGENT") or "EquityIntelligence research@example.com"
    try:
        rs = requests.get(
            "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&owner=include&count=40&output=atom",
            headers={"User-Agent": ua},
            timeout=6,
        )
        if rs.ok:
            aroot = ET.fromstring(rs.text)
            for ent in aroot.iter():
                if ent.tag.split("}")[-1] != "entry":
                    continue
                etitle = ""
                elink = ""
                eupd = None
                esum = ""
                for ch in ent:
                    tn = ch.tag.split("}")[-1]
                    if tn == "title":
                        etitle = (ch.text or "").strip()
                    elif tn == "link" and ch.get("href"):
                        elink = ch.get("href", "").strip()
                    elif tn == "updated":
                        eupd = parse_dt(ch.text)
                    elif tn == "summary":
                        esum = re.sub(r"<[^>]+>", " ", ch.text or "").strip()
                if not etitle or not elink:
                    continue
                for s_cand, s_nm in ticker_names.items():
                    if matches_ticker(etitle, s_cand, s_nm):
                        k = story_key(f"{s_cand} 8K {etitle} {elink[-20:]}")
                        if k not in seen:
                            item_note = f" ({esum[:90].strip()})" if esum else ""
                            raw_candidates.append({
                                "key": k,
                                "symbol": s_cand,
                                "name": s_nm,
                                "title": f"SEC Form 8-K Material Current Report filed by {s_nm}{item_note}",
                                "url": elink,
                                "source": "SEC EDGAR 8-K",
                                "source_tier": 1,
                                "published": (eupd or now_dt).astimezone(timezone.utc).isoformat(timespec="seconds"),
                                "importance": 90.0,
                                "significance": "CRITICAL",
                                "categories": ["sec_8k"],
                                "age_hours": 0.05,
                                "detected_at": now_iso,
                            })
                        break
    except Exception:
        pass

    # Deduplicate and cap at top 20 new items per 5-minute cycle
    all_new = new_alerts + raw_candidates
    all_new.sort(key=lambda x: (-float(x["importance"]), float(x.get("age_hours") or 0)))
    deduped: list[dict] = []
    batch_k: set[str] = set()
    for c in all_new:
        if c["key"] in batch_k or c["key"] in seen:
            continue
        batch_k.add(c["key"])
        deduped.append(c)
        if len(deduped) >= 20:
            break

    if not deduped:
        return

    for it in deduped:
        seen[it["key"]] = now_iso
    if len(seen) > 1200:
        seen = dict(sorted(seen.items(), key=lambda kv: kv[1], reverse=True)[:1200])

    # Keep up to 120 items in breaking_news.json sorted strictly newest-to-oldest while capping synthetic market_move shocks at 12
    def _pub_sort_key(item: dict) -> tuple[float, float]:
        dt = parse_pub(item.get("published"))
        ts = dt.timestamp() if dt is not None else 0.0
        return (ts, float(item.get("importance") or 0.0))

    combined = sorted(deduped + existing, key=_pub_sort_key, reverse=True)
    editorial_items = [x for x in combined if "market_move" not in (x.get("categories") or [])]
    tape_items = [x for x in combined if "market_move" in (x.get("categories") or [])][:12]
    merged = sorted((editorial_items[:108] + tape_items)[:120], key=_pub_sort_key, reverse=True)
    breaking_path.write_text(
        json.dumps({"updated_at": now_iso, "min_importance": 42, "max_age_hours": 4, "items": merged}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    seen_path.write_text(json.dumps(seen, indent=2, ensure_ascii=False), encoding="utf-8")

    # Patch fresh editorial ticker news & live quotes directly into data/<latest_date>/tickers/<SYM>.json
    tickers_dir = DATA_DIR / latest_date / "tickers"
    if tickers_dir.exists():
        new_ed_by_sym: dict[str, list[dict]] = {}
        for it in deduped:
            if "market_move" not in (it.get("categories") or []) and it.get("symbol") in ticker_names:
                new_ed_by_sym.setdefault(it["symbol"], []).append(it)
        for sym in set(list(new_ed_by_sym.keys()) + list(quotes.keys())):
            tp = tickers_dir / f"{sym}.json"
            if not tp.exists():
                continue
            try:
                td = json.loads(tp.read_text(encoding="utf-8"))
                q = quotes.get(sym)
                if q:
                    tech = td.setdefault("technical", {})
                    facts = tech.setdefault("facts", {})
                    facts["last_close"] = q["close"]
                    facts["change_1d_usd"] = q["change_1d_usd"]
                    facts["change_1d_pct"] = q["change_1d_pct"]
                    facts["ext_price"] = q["ext_price"]
                    facts["ext_change_usd"] = q["ext_change_usd"]
                    facts["ext_change_pct"] = q["ext_change_pct"]
                    facts["ext_label"] = q["ext_label"]
                    lv = (tech.get("computed") or {}).get("levels") or {}
                    for side in ("support", "resistance"):
                        for lv_it in lv.get(side) or []:
                            if lv_it and lv_it.get("price"):
                                lv_it["distance_pct"] = round(((float(lv_it["price"]) - q["close"]) / q["close"]) * 100.0, 2)
                if sym in new_ed_by_sym:
                    cur_news = td.get("news") or []
                    cur_keys = {story_key(n.get("title", "")) for n in cur_news}
                    add_n = [
                        {
                            "id": "LIVE",
                            "kind": "news",
                            "title": x["title"],
                            "url": x["url"],
                            "published": x["published"],
                            "source": x["source"],
                            "importance": x["importance"],
                            "categories": x["categories"],
                        }
                        for x in new_ed_by_sym[sym]
                        if x["key"] not in cur_keys
                    ]
                    if add_n:
                        td["news"] = (add_n + cur_news)[:35]
                tp.write_text(json.dumps(td, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
            except Exception:
                continue

    # Dispatch separate Telegram messages according to significance tier (CRITICAL -> HIGH -> NOTABLE)
    tg_tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
    if tg_tok and tg_chat:
        crit = [x for x in deduped if x.get("significance") == "CRITICAL"]
        high = [x for x in deduped if x.get("significance") == "HIGH"]
        notable = [x for x in deduped if x.get("significance") == "NOTABLE"]
        for i in range(0, len(crit), 4):
            ch = crit[i:i + 4]
            send_tg_message(tg_tok, tg_chat, f"Breaking News · CRITICAL SIGNIFICANCE ({len(ch)})", ch)
        if high:
            send_tg_message(tg_tok, tg_chat, f"Breaking News · HIGH SIGNIFICANCE ({len(high)})", high)
        if notable:
            send_tg_message(tg_tok, tg_chat, f"Breaking News · MARKET RADAR ({len(notable)})", notable)


if __name__ == "__main__":
    main()
