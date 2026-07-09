# USL2 Elo

An unofficial, auto-updating Elo power ranking for every club in USL League Two.

**Live site:** enable GitHub Pages (see setup below) and it'll be at
`https://<your-username>.github.io/<repo-name>/`

## How it works

```
scripts/fetch_data.py   -> pulls match results from Sofascore's public API
                            (via the `datafc` package) -> data/matches.csv
scripts/compute_elo.py  -> replays every finished match chronologically,
                            computes Elo per club -> docs/data/ratings.json
                                                      docs/data/history.json
docs/                    -> static site (plain HTML/CSS/JS) that reads
                            those two JSON files and renders the table
.github/workflows/       -> runs the two scripts daily, commits the new
update.yml                  data if it changed, and (re)publishes docs/
                             to GitHub Pages
```

No server, no database, no API keys. Everything lives in the repo.

### Data source

USL League Two doesn't publish a public API. `uslleaguetwo.com` itself
blocks scripted requests, and text-scraping mirror sites is fragile
because club names containing numbers (e.g. "Loudoun United FC 2")
collide with score digits once you flatten a page to text. Sofascore
runs USL2 through the same structured match-events API it uses for
every other league it covers, and the [`datafc`](https://pypi.org/project/datafc/)
package wraps that cleanly, so `fetch_data.py` uses it instead.

This is an unofficial API and could change or rate-limit without
notice — if `fetch_data.py` starts failing, that's the first place to
look (check for a new `datafc` release before rewriting anything by
hand).

### The Elo formula

Standard "World Football Elo" method (same one used by eloratings.net),
not plain chess Elo — soccer needs it because chess Elo has no concept
of a draw scaling or goal margin:

- All clubs start at **1500**.
- Home side gets a **+60** rating bump before the expected-result
  calculation (`HOME_ADVANTAGE` in `compute_elo.py`).
- Rating swings scale with margin of victory: a 3–0 moves the needle
  more than a 1–0, capped by a goal-difference multiplier.
- **K-factor 26** — this controls how fast ratings move. Lower =
  smoother/slower, higher = more reactive to recent form. eloratings.net
  uses 20 for friendlies up to 60 for World Cup finals; 26 is a
  reasonable middle ground for a semi-pro league with rosters that
  shift week to week.

All three constants live at the top of `scripts/compute_elo.py` if you
want to tune them.

## Setup

1. **Create a GitHub repo** and push this folder to it.
2. **Enable Pages**: repo Settings → Pages → Source: **GitHub Actions**.
3. **Run the workflow once manually**: Actions tab → "Update USL2 Elo
   ratings" → Run workflow. This does the first data pull and publishes
   the site. After that it runs automatically every day at 09:15 UTC.

## Running locally

```bash
pip install -r requirements.txt
python scripts/fetch_data.py      # writes data/matches.csv
python scripts/compute_elo.py     # writes docs/data/ratings.json + history.json
python -m http.server 8000 --directory docs   # open http://localhost:8000
```

## Known limitations / next steps

- **No conference/division filter yet.** The site currently ranks all
  158 clubs in one flat table. Sofascore's standings endpoint does
  expose division groupings; adding a filter is a matter of pulling
  `standings_data()` once per division and joining it onto the ratings
  by `team_id`.
- **Round-probing.** `fetch_data.py` walks matchweek numbers 1–30 and
  stops after a few consecutive misses, since USL2's schedule length
  varies slightly by division and Sofascore's "round" numbering isn't
  published anywhere. This is a reasonable way to catch the full
  season without hardcoding a week count, but if a division ever plays
  more than 30 matchweeks (unlikely) or has a big schedule gap early on
  that looks like the end of season, adjust `MAX_ROUND_PROBE` /
  `CONSECUTIVE_MISS_STOP` at the top of the script.
- **First season has no prior-year seed.** Every club starts at 1500
  regardless of previous-season strength, so early-season ratings are
  noisier than they'll be by mid-season. Carrying over end-of-season
  ratings (decayed toward 1500) as next year's starting point is a
  natural follow-up once there's a full season of history.
