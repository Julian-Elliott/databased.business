#!/usr/bin/env python3
"""Build the DS-001 first-release files from the seed data fetched on 30 Sep 2026.

Writes public/data/ds001/:
  sample_days.parquet          four day-series: South Wales and GB national, 29 and 30 Sep 2026
  national_daily_means.parquet daily mean intensity, national, Oct 2025 → Sep 2026 (358 days)
  summary.json                 what the datasheet's figures read at build time
  datapackage.json             Frictionless manifest (resources + schema + licence); fetch_neso.py extends it
  checks.log                   row counts, nulls, ranges, gaps

The scheduled pipeline (fetch_neso.py) adds the yearly/monthly partitions; these seed files stay.
Source: NESO Carbon Intensity API, CC BY 4.0.
"""
import csv, json, pathlib, datetime as dt
import pyarrow as pa, pyarrow.parquet as pq

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEED = ROOT / "scripts/seed"
OUT = ROOT / "public/data/ds001"
OUT.mkdir(parents=True, exist_ok=True)
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def iso(day, hhmm):
    return f"{day}T{hhmm}:00Z"

rows = []
for day in ("2026-09-29", "2026-09-30"):
    sw = json.load(open(SEED / f"sw_{day}.json"))
    for r in sw:
        rows.append({"region": "sw", "regionid": 7, "day": day, "time": r["t"], "from": iso(day, r["t"]),
                     "intensity_forecast": r["v"], "intensity_actual": None, "intensity_index": r["i"]})
    with open(SEED / f"gb_{day}.csv") as f:
        for r in csv.DictReader(f):
            rows.append({"region": "gb", "regionid": 0, "day": day, "time": r["time"], "from": iso(day, r["time"]),
                         "intensity_forecast": int(r["forecast"]), "intensity_actual": int(r["actual"]) if r["actual"] else None,
                         "intensity_index": r["index"]})
schema = pa.schema([
    ("region", pa.string()), ("regionid", pa.int16()), ("day", pa.string()), ("time", pa.string()),
    ("from", pa.timestamp("s", tz="UTC")),
    ("intensity_forecast", pa.int32()), ("intensity_actual", pa.int32()), ("intensity_index", pa.string()),
])
table = pa.Table.from_pylist([{**r, "from": dt.datetime.fromisoformat(r["from"].replace("Z", "+00:00"))} for r in rows], schema=schema)
pq.write_table(table, OUT / "sample_days.parquet", compression="zstd")

daily = json.load(open(SEED / "national_daily_means.json"))
dtab = pa.Table.from_pylist([{"date": dt.date.fromisoformat(d["d"]), "mean_gco2_kwh": d["v"]} for d in daily],
                            schema=pa.schema([("date", pa.date32()), ("mean_gco2_kwh", pa.int32())]))
pq.write_table(dtab, OUT / "national_daily_means.parquet", compression="zstd")

# summary for the datasheet's figures
sw29 = [r for r in rows if r["region"] == "sw" and r["day"] == "2026-09-29"]
summary = {
    "built": NOW,
    "daily": daily,
    "days": {
        "sw": {"example": [{"t": r["time"], "v": r["intensity_forecast"], "i": r["intensity_index"]} for r in sw29],
               "live": [{"t": r["time"], "v": r["intensity_forecast"], "i": r["intensity_index"]} for r in rows if r["region"] == "sw" and r["day"] == "2026-09-30"]},
        "gb": {"example": [{"t": r["time"], "v": r["intensity_actual"] if r["intensity_actual"] is not None else r["intensity_forecast"], "i": r["intensity_index"], "f": r["intensity_actual"] is None} for r in rows if r["region"] == "gb" and r["day"] == "2026-09-29"],
               "live": [{"t": r["time"], "v": r["intensity_actual"] if r["intensity_actual"] is not None else r["intensity_forecast"], "i": r["intensity_index"], "f": r["intensity_actual"] is None} for r in rows if r["region"] == "gb" and r["day"] == "2026-09-30"]},
        "exampleDate": "2026-09-29", "liveDate": "2026-09-30", "fetched": "2026-09-30T22:05Z",
    },
}
(OUT / "summary.json").write_text(json.dumps(summary, separators=(",", ":")))

# checks
vals = [d["v"] for d in daily]
gaps = []
for a, b in zip(daily, daily[1:]):
    da, db = dt.date.fromisoformat(a["d"]), dt.date.fromisoformat(b["d"])
    if (db - da).days > 1:
        gaps.append(f"{a['d']}→{b['d']}")
nulls_actual = sum(1 for r in rows if r["region"] == "gb" and r["intensity_actual"] is None)
checks = [
    f"built {NOW}",
    f"sample_days.parquet: {len(rows)} rows, 4 day-series (sw/gb × 2026-09-29/30); forecast range {min(r['intensity_forecast'] for r in rows)}–{max(r['intensity_forecast'] for r in rows)} g/kWh; national actual nulls {nulls_actual} (periods not yet published at fetch time)",
    f"national_daily_means.parquet: {len(daily)} rows {daily[0]['d']}→{daily[-1]['d']}; mean {sum(vals)/len(vals):.1f}, min {min(vals)}, max {max(vals)}; missing days (30-day fetch windows skip month-end 31sts): {', '.join(gaps) if gaps else 'none'}",
    "source: NESO Carbon Intensity API (api.carbonintensity.org.uk), fetched 2026-09-30 22:05 UTC, licence CC BY 4.0",
]
(OUT / "checks.log").write_text("\n".join(checks) + "\n")

dp = {
    "name": "ds-001-gb-electricity-carbon-intensity",
    "title": "DS-001 GB electricity carbon intensity",
    "version": "1.0.0",
    "homepage": "https://databased.business/datasheets/ds-001/",
    "licenses": [{"name": "CC-BY-4.0", "path": "https://creativecommons.org/licenses/by/4.0/", "title": "Creative Commons Attribution 4.0"}],
    "sources": [{"title": "NESO Carbon Intensity API", "path": "https://api.carbonintensity.org.uk"}],
    "contributors": [{"title": "Julian Elliott", "role": "publisher"}],
    "created": NOW,
    "resources": [
        {"name": "sample_days", "path": "sample_days.parquet", "format": "parquet", "bytes": (OUT / "sample_days.parquet").stat().st_size,
         "description": "Four day-series used by the notebook: South Wales (regionid 7, forecast) and GB national (forecast + actual), 29 and 30 September 2026.",
         "schema": {"fields": [
             {"name": "region", "type": "string", "description": "sw = South Wales (regionid 7), gb = national"},
             {"name": "regionid", "type": "integer"}, {"name": "day", "type": "string"}, {"name": "time", "type": "string", "description": "HH:MM UTC, period start"},
             {"name": "from", "type": "datetime", "description": "period start, UTC"},
             {"name": "intensity_forecast", "type": "integer", "unit": "gCO2/kWh"},
             {"name": "intensity_actual", "type": "integer", "unit": "gCO2/kWh", "description": "national only; null where NESO has not published"},
             {"name": "intensity_index", "type": "string", "description": "NESO band"}]}},
        {"name": "national_daily_means", "path": "national_daily_means.parquet", "format": "parquet", "bytes": (OUT / "national_daily_means.parquet").stat().st_size,
         "description": "Daily mean of the national half-hourly intensity, from NESO's stats endpoint, October 2025 to September 2026.",
         "schema": {"fields": [{"name": "date", "type": "date"}, {"name": "mean_gco2_kwh", "type": "integer", "unit": "gCO2/kWh"}]}},
    ],
}
(OUT / "datapackage.json").write_text(json.dumps(dp, indent=2))
for p in sorted(OUT.iterdir()):
    print(f"{p.stat().st_size:>8}  {p.name}")
