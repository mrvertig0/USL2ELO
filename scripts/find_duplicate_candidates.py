"""
Scan data/matches_<key>.csv for clubs that are likely the same team under
different Sofascore team_ids (a rebrand, or a name Sofascore recorded
slightly differently across seasons) -- so you don't have to eyeball a
240+ name list by hand.

How it decides what's worth flagging:
  1. Groups teams by a normalized name (lowercased, punctuation stripped,
     common reserve-side suffixes like "II"/"B"/"Reserves" removed).
  2. Within each name group with more than one team_id, checks whether
     their active date ranges overlap.
     - NO overlap (one stopped playing right around when the other
       started) -> flagged as "likely rename", since a real first-team +
       reserve-side pair almost always plays SIMULTANEOUSLY, not back-to-back.
     - Overlap exists -> flagged as "possible reserve side", shown for
       your judgment call rather than assumed to be a duplicate.

This is a starting point for YOUR review, not an automatic merge -- it
only prints candidates. Confirmed merges go in scripts/team_aliases.json
(see that file's comments / README for the format), which compute_elo.py
reads and applies before computing ratings.

Usage:
    python scripts/find_duplicate_candidates.py                # all leagues
    python scripts/find_duplicate_candidates.py --league usl2
"""
import argparse
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

from leagues import LEAGUES

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

SUFFIX_WORDS = r"\b(ii|iii|iv|2|3|b|reserves?|res|dev|development|academy)\b"


def normalize(name: str) -> str:
    n = str(name).lower()
    n = re.sub(r"[^a-z0-9\s]+", " ", n)
    n = re.sub(SUFFIX_WORDS, " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def team_stats(df: pd.DataFrame) -> dict:
    """team_id -> {name, first_ts, last_ts, games}, using the most recent
    name seen for that id (in case Sofascore's own name for it drifted)."""
    stats = {}
    rows = []
    for _, r in df.iterrows():
        rows.append((r["home_team_id"], r["home_team"], r["start_timestamp"]))
        rows.append((r["away_team_id"], r["away_team"], r["start_timestamp"]))

    rows.sort(key=lambda x: (x[2] if pd.notna(x[2]) else 0))
    for tid, name, ts in rows:
        if pd.isna(tid):
            continue
        tid = int(tid)
        if tid not in stats:
            stats[tid] = {"name": name, "first_ts": ts, "last_ts": ts, "games": 0}
        stats[tid]["name"] = name  # always overwrite -> ends up as most recent
        stats[tid]["last_ts"] = ts
        if pd.isna(stats[tid]["first_ts"]) or (pd.notna(ts) and ts < stats[tid]["first_ts"]):
            stats[tid]["first_ts"] = ts
        stats[tid]["games"] += 1
    return stats


def fmt_ts(ts):
    if pd.isna(ts):
        return "?"
    return pd.to_datetime(ts, unit="s").strftime("%Y-%m")


def scan_league(key: str, cfg: dict):
    path = DATA_DIR / f"matches_{key}.csv"
    if not path.exists():
        print(f"Skipping {cfg['label']}: {path} not found -- run fetch_data.py first.")
        return

    df = pd.read_csv(path)
    df = df[df["status"] == "Ended"].copy()
    df["start_timestamp"] = pd.to_numeric(df["start_timestamp"], errors="coerce")

    stats = team_stats(df)

    groups = defaultdict(list)
    for tid, s in stats.items():
        groups[normalize(s["name"])].append(tid)

    candidates = {norm: ids for norm, ids in groups.items() if len(ids) > 1 and norm}

    print(f"\n=== {cfg['label']} ({key}) === {len(candidates)} name group(s) with multiple team_ids\n")
    if not candidates:
        print("Nothing found -- no name collisions detected.")
        return

    for norm, ids in sorted(candidates.items()):
        entries = [(tid, stats[tid]) for tid in ids]
        entries.sort(key=lambda e: (e[1]["first_ts"] if pd.notna(e[1]["first_ts"]) else 0))

        # overlap check: does any pair's [first,last] range overlap?
        overlap = False
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                a, b = entries[i][1], entries[j][1]
                if pd.isna(a["first_ts"]) or pd.isna(b["first_ts"]):
                    continue
                if a["first_ts"] <= b["last_ts"] and b["first_ts"] <= a["last_ts"]:
                    overlap = True

        verdict = "possible reserve side (active at the same time -- probably NOT a merge)" if overlap \
            else "likely rename (no overlap -- probably IS a merge)"
        print(f"-- {norm!r} -- {verdict}")
        for tid, s in entries:
            print(f"   team_id={tid:<10} {s['name']!r:35} {fmt_ts(s['first_ts'])} to {fmt_ts(s['last_ts'])}  ({s['games']} games)")
        print(f"   team_ids for alias entry: {[tid for tid, _ in entries]}")
        print()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", choices=list(LEAGUES.keys()), default=None)
    args = parser.parse_args()
    keys = [args.league] if args.league else list(LEAGUES.keys())
    for key in keys:
        scan_league(key, LEAGUES[key])


if __name__ == "__main__":
    main()
