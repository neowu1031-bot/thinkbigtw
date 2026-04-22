#!/usr/bin/env python3
"""每日台股資料更新腳本 - 用 yfinance 抓取資料存入 Supabase"""
import os, requests
from datetime import datetime, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://sirhskxufayklqrlxeep.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

TW_SYMBOLS = [
    "2330","2317","2454","2382","2308","2303","2881","2882","2886","2891",
    "2884","2885","2892","2883","2880","2887","2888","1301","1303","2002",
    "2412","3008","2395","2357","2376","4938","2474","3034","2379","6505",
    "1216","2912","2207","2603","2609","2610","2618","2301","2324","2352",
    "2353","2356","3045","4904","2409","3481","6669","2408","3711","2327",
    "2360","5274","6415","2049","1590","6239","2615","1326","2105",
    "0050","0056","00878","00919","00929","00940","00713","006208","00881",
    "0051","0052","0053","0055","00850","00900","00905","00907","00915",
    "00918","00919","00922","00923","00927","00929","00930","00935",
    "00936","00946","00947","00948","00951",
]

def upsert_batch(rows):
    if not rows: return 0
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/daily_prices",
        headers=HEADERS, json=rows, timeout=30
    )
    if r.status_code not in (200, 201):
        print(f"  ⚠️  Upsert error {r.status_code}: {r.text[:100]}")
    return len(rows)

def fetch_tw_prices(symbols, date_str):
    """用 yfinance 批次抓多檔台股收盤價"""
    import yfinance as yf
    rows = []
    yf_syms = [f"{s}.TW" for s in symbols]
    try:
        data = yf.download(
            yf_syms,
            start=date_str,
            end=(datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
            threads=True
        )
        if data.empty:
            return rows
        
        for sym, yf_sym in zip(symbols, yf_syms):
            try:
                close = float(data["Close"][yf_sym].dropna().iloc[-1]) if len(yf_syms) > 1 else float(data["Close"].dropna().iloc[-1])
                open_ = float(data["Open"][yf_sym].dropna().iloc[-1]) if len(yf_syms) > 1 else float(data["Open"].dropna().iloc[-1])
                high = float(data["High"][yf_sym].dropna().iloc[-1]) if len(yf_syms) > 1 else float(data["High"].dropna().iloc[-1])
                low = float(data["Low"][yf_sym].dropna().iloc[-1]) if len(yf_syms) > 1 else float(data["Low"].dropna().iloc[-1])
                vol = int(data["Volume"][yf_sym].dropna().iloc[-1]) if len(yf_syms) > 1 else int(data["Volume"].dropna().iloc[-1])
                rows.append({
                    "symbol": sym, "date": date_str,
                    "open_price": round(open_, 2), "close_price": round(close, 2),
                    "high_price": round(high, 2), "low_price": round(low, 2),
                    "volume": vol, "change_percent": 0,
                })
            except Exception as e:
                pass
    except Exception as e:
        print(f"  yfinance batch error: {e}")
    return rows

def update_institutional(date_str):
    """更新三大法人資料 (T86 API)"""
    try:
        url = f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_str.replace('-','')}&selectType=ALL&response=json"
        r = requests.get(url, timeout=15, headers={"User-Agent":"Mozilla/5.0"})
        d = r.json()
        if d.get("stat") != "OK": return
        rows = []
        for item in d.get("data", [])[:100]:
            try:
                sym = item[0].strip()
                foreign = int(item[4].replace(",","").replace("+","")) if item[4].strip() not in ["-",""] else 0
                trust = int(item[7].replace(",","").replace("+","")) if item[7].strip() not in ["-",""] else 0
                dealer = int(item[10].replace(",","").replace("+","")) if item[10].strip() not in ["-",""] else 0
                total = foreign + trust + dealer
                rows.append({
                    "symbol": sym, "date": date_str,
                    "foreign_buy": foreign, "investment_trust_buy": trust,
                    "dealer_buy": dealer, "total_buy": total
                })
            except: pass
        if rows:
            r2 = requests.post(f"{SUPABASE_URL}/rest/v1/institutional_investors",
                headers=HEADERS, json=rows, timeout=30)
            print(f"  三大法人: {len(rows)} 筆 ({r2.status_code})")
    except Exception as e:
        print(f"  三大法人更新失敗: {e}")

def main():
    today = datetime.now()
    date_str = today.strftime("%Y-%m-%d")
    
    # 週末跳過
    if today.weekday() >= 5:
        print(f"週末 {date_str}，跳過")
        return

    print(f"=== 開始更新 {date_str} 台股資料 ===")
    
    # 分批抓股價 (每批20檔)
    total = 0
    batch_size = 20
    for i in range(0, len(TW_SYMBOLS), batch_size):
        batch = TW_SYMBOLS[i:i+batch_size]
        rows = fetch_tw_prices(batch, date_str)
        if rows:
            total += upsert_batch(rows)
        print(f"  進度 {min(i+batch_size, len(TW_SYMBOLS))}/{len(TW_SYMBOLS)}: +{len(rows)} 筆")
    
    print(f"  股價合計: {total} 筆")
    
    # 更新三大法人
    update_institutional(date_str)
    
    print(f"=== ✅ 完成 {date_str} ===")

if __name__ == "__main__":
    main()
