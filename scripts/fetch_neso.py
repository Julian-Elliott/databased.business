#!/usr/bin/env python3
"""DS-001 pipeline: fetch NESO carbon intensity (national + 17 regions with generation mix) and write
Parquet partitions, a Frictionless datapackage.json, a checks log and the summary the datasheet reads.

  Backfill (first run, ~880 API calls, 7-day windows):   python3 scripts/fetch_neso.py --out public/data/ds001
  Daily (refetch the last 3 days, rewrite this month):     python3 scripts/fetch_neso.py --out public/data/ds001 --daily

Partitions (small files, git-friendly, DuckDB-WASM friendly):
  national/YYYY.parquet     past years              regional/YYYY.parquet
  national/YYYY-MM.parquet  months of this year     regional/YYYY-MM.parquet
The seed files written by build_sample.py (sample_days.parquet, national_daily_means.parquet) are kept.

Source: NESO Carbon Intensity API, https://api.carbonintensity.org.uk, licence CC BY 4.0 (attribute NESO).
Raw responses are never stored; only the flattened rows.
"""
import argparse, datetime as dt, json, pathlib, subprocess, sys, time, urllib.request
import pyarrow as pa, pyarrow.parquet as pq

API = "https://api.carbonintensity.org.uk"
FUELS = ["biomass", "coal", "imports", "gas", "nuclear", "other", "hydro", "solar", "wind"]
WINDOW = dt.timedelta(days=7)  # the regional endpoint rejects 14-day windows; 7 works for both
FIRST_DAY = dt.date(2018, 5, 11)  # earliest period the API serves

NATIONAL_SCHEMA = pa.schema([
    ("from", pa.timestamp("s", tz="UTC")), ("to", pa.timestamp("s", tz="UTC")),
    ("intensity_forecast", pa.int32()), ("intensity_actual", pa.int32()), ("intensity_index", pa.string()),
])
REGIONAL_SCHEMA = pa.schema([
    ("from", pa.timestamp("s", tz="UTC")), ("to", pa.timestamp("s", tz="UTC")),
    ("regionid", pa.int16()), ("shortname", pa.string()), ("dnoregion", pa.string()),
    ("intensity_forecast", pa.int32()), ("intensity_index", pa.string()),
] + [(f"mix_{f}", pa.float32()) for f in FUELS])


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "databased.business DS-001 pipeline"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            wait = 2 ** i
            log(f"  retry {i + 1}/{tries} after {wait}s: {url} ({e})")
            time.sleep(wait)
    raise RuntimeError(f"gave up on {url}")


def ts(s):
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%MZ").replace(tzinfo=dt.timezone.utc)


def fetch_window(a, b):
    """Return (national_rows, regional_rows) for [a, b)."""
    fa, fb = f"{a.isoformat()}T00:00Z", f"{b.isoformat()}T00:00Z"
    nat = get(f"{API}/intensity/{fa}/{fb}").get("data", [])
    time.sleep(0.4)
    reg = get(f"{API}/regional/intensity/{fa}/{fb}").get("data", [])
    time.sleep(0.4)
    nrows, rrows = [], []
    for p in nat:
        i = p.get("intensity", {})
        nrows.append({"from": ts(p["from"]), "to": ts(p["to"]), "intensity_forecast": i.get("forecast"),
                      "intensity_actual": i.get("actual"), "intensity_index": i.get("index")})
    for p in reg:
        f, t = ts(p["from"]), ts(p["to"])
        for r in p.get("regions", []):
            mix = {f"mix_{m['fuel']}": float(m["perc"]) for m in r.get("generationmix", []) if m.get("fuel") in FUELS}
            rrows.append({"from": f, "to": t, "regionid": r["regionid"], "shortname": r.get("shortname"), "dnoregion": r.get("dnoregion"),
                          "intensity_forecast": r.get("intensity", {}).get("forecast"), "intensity_index": r.get("intensity", {}).get("index"),
                          **{f"mix_{x}": mix.get(f"mix_{x}") for x in FUELS}})
    return nrows, rrows


def partition_key(d, today):
    return d.strftime("%Y-%m") if d.year == today.year else d.strftime("%Y")


def write_partition(out, kind, key, rows, schema):
    rows = sorted({(r["from"], r.get("regionid", 0)): r for r in rows}.values(), key=lambda r: (r["from"], r.get("regionid", 0)))
    path = out / kind / f"{key}.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pylist(rows, schema=schema), path, compression="zstd")
    return path, len(rows)


def read_partition(out, kind, key):
    path = out / kind / f"{key}.parquet"
    if not path.exists():
        return []
    return pq.read_table(path).to_pylist()


def checks_for(out, kind):
    """Row counts, gaps and nulls across every partition of a kind."""
    files = sorted((out / kind).glob("*.parquet")) if (out / kind).exists() else []
    total, nulls, first, last, gaps = 0, 0, None, None, 0
    prev = None
    for f in files:
        t = pq.read_table(f, columns=["from", "intensity_forecast"])
        total += t.num_rows
        nulls += t.column("intensity_forecast").null_count
        froms = sorted(set(t.column("from").to_pylist()))
        if froms:
            first = froms[0] if first is None else min(first, froms[0])
            last = froms[-1] if last is None else max(last, froms[-1])
            for x in froms:
                if prev is not None and (x - prev) > dt.timedelta(minutes=30):
                    gaps += 1
                prev = x
    return {"files": len(files), "rows": total, "forecast_nulls": nulls, "first": first.isoformat() if first else None,
            "last": last.isoformat() if last else None, "period_gaps": gaps}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/data/ds001")
    ap.add_argument("--since", default=FIRST_DAY.isoformat())
    ap.add_argument("--until", default=None, help="exclusive; default: today UTC (so yesterday is the last full day)")
    ap.add_argument("--daily", action="store_true", help="refetch only the last 3 days into the current partition")
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    today = dt.datetime.now(dt.timezone.utc).date()
    until = dt.date.fromisoformat(args.until) if args.until else today
    since = max(FIRST_DAY, until - dt.timedelta(days=3)) if args.daily else dt.date.fromisoformat(args.since)
    if not args.daily and (out / "national").exists() and any((out / "national").glob("*.parquet")):
        # partitions exist: resume from the last month we hold, rather than refetching eight years
        keys = sorted(p.stem for p in (out / "national").glob("*.parquet"))
        last = keys[-1]
        since = dt.date(int(last[:4]), int(last[5:7]) if len(last) > 4 else 1, 1)
        log(f"resuming from {since} (last partition {last})")

    log(f"DS-001 fetch {since} → {until} ({'daily' if args.daily else 'backfill'})")
    nat_buf, reg_buf, cur_key = [], [], None
    written = []
    a = since
    # seed the current partition with what we already hold so daily runs merge instead of replace
    def flush(key):
        nonlocal nat_buf, reg_buf
        if key is None:
            return
        n_old = read_partition(out, "national", key)
        r_old = read_partition(out, "regional", key)
        p1, c1 = write_partition(out, "national", key, n_old + nat_buf, NATIONAL_SCHEMA)
        p2, c2 = write_partition(out, "regional", key, r_old + reg_buf, REGIONAL_SCHEMA)
        written.append((key, c1, c2))
        log(f"  wrote {p1.name}: {c1} national rows, {c2} regional rows")
        nat_buf, reg_buf = [], []

    try:
        while a < until:
            b = min(a + WINDOW, until)
            key = partition_key(a, today)
            if cur_key is not None and key != cur_key:
                flush(cur_key)
            cur_key = key
            nrows, rrows = fetch_window(a, b)
            # the API includes the period containing `from`, so a window can hold a row from the previous
            # partition; route rows by their own timestamp (write_partition de-duplicates on merge)
            for r in nrows:
                k = partition_key(r["from"].date(), today)
                if k != cur_key:
                    flush(cur_key); cur_key = k
                nat_buf.append(r)
            for r in rrows:
                k = partition_key(r["from"].date(), today)
                if k != cur_key:
                    flush(cur_key); cur_key = k
                reg_buf.append(r)
            log(f"{a} → {b}: {len(nrows)} national, {len(rrows)} regional rows")
            a = b
    finally:
        flush(cur_key)  # keep partial progress on failure; the next run resumes from the last partition

    # ---- checks, summary, manifest ----
    nat = checks_for(out, "national")
    reg = checks_for(out, "regional")
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip() or "n/a"
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [f"run {now} · commit {commit} · {'daily' if args.daily else 'backfill'} {since}→{until}",
             f"national: {nat}", f"regional: {reg}"]
    prev = (out / "checks.log").read_text() if (out / "checks.log").exists() else ""
    (out / "checks.log").write_text("\n".join(lines) + "\n" + ("---\n" + prev if prev else ""))

    # summary.json: last 365 daily means (national, actual where present else forecast) + latest full day for region 7 and national
    summ_path = out / "summary.json"
    summary = json.loads(summ_path.read_text()) if summ_path.exists() else {}
    files = sorted((out / "national").glob("*.parquet"))
    daily = {}
    for f in files[-3:]:  # the last three partitions cover well over a year
        for r in pq.read_table(f).to_pylist():
            d = r["from"].date().isoformat()
            v = r["intensity_actual"] if r["intensity_actual"] is not None else r["intensity_forecast"]
            if v is not None:
                daily.setdefault(d, []).append(v)
    days = sorted(daily)[-365:]
    summary["daily"] = [{"d": d, "v": round(sum(daily[d]) / len(daily[d]))} for d in days if len(daily[d]) >= 40]
    summary["built"] = now
    summ_path.write_text(json.dumps(summary, separators=(",", ":")))

    dp_path = out / "datapackage.json"
    dp = json.loads(dp_path.read_text()) if dp_path.exists() else {"name": "ds-001-gb-electricity-carbon-intensity", "resources": []}
    keep = [r for r in dp.get("resources", []) if not r["path"].startswith(("national/", "regional/"))]
    part_res = []
    for kind, schema, desc in (("national", NATIONAL_SCHEMA, "National half-hourly intensity: forecast, actual (where published) and index."),
                               ("regional", REGIONAL_SCHEMA, "Regional half-hourly forecast intensity and generation mix for 17 DNO regions.")):
        for f in sorted((out / kind).glob("*.parquet")):
            part_res.append({"name": f"{kind}_{f.stem}", "path": f"{kind}/{f.name}", "format": "parquet", "bytes": f.stat().st_size,
                             "description": desc, "partition": f.stem,
                             "schema": {"fields": [{"name": n, "type": str(schema.field(n).type)} for n in schema.names]}})
    dp["resources"] = keep + part_res
    dp["updated"] = now
    dp["checks"] = {"national": nat, "regional": reg, "commit": commit}
    dp_path.write_text(json.dumps(dp, indent=2, default=str))
    log(f"done: {len(part_res)} partitions listed; {nat['rows']} national rows, {reg['rows']} regional rows")


if __name__ == "__main__":
    main()
