#!/usr/bin/env python3
"""Pull league history from ESPN Fantasy Football and rebuild the site's data.

Usage:
    python scripts/refresh.py            # fetch from ESPN, write data files
    python scripts/refresh.py --build    # only rebuild data/data.js from the JSON files

Settings come from environment variables (or a .env file in the repo root):
    ESPN_S2          your espn_s2 cookie (required for private leagues)
    SWID             your SWID cookie, including the curly braces
    LEAGUE_ID        ESPN league ID (default 62116877)
    START_YEAR       first season of the league (default 2020)
    INCLUDE_RETIRED  "true" to keep managers who aren't in the current season (default false)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{league}"
VIEWS = [("view", "mTeam"), ("view", "mSettings"), ("view", "mMatchupScore")]


def load_env() -> None:
    """Read KEY=value lines from .env without overriding real environment variables."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def current_season(today: dt.date | None = None) -> int:
    today = today or dt.date.today()
    return today.year if today.month >= 8 else today.year - 1


def fetch_season(session, league: str, year: int) -> dict | None:
    resp = session.get(API.format(year=year, league=league), params=VIEWS, timeout=30)
    if resp.status_code == 404:
        return None
    if resp.status_code in (401, 403):
        raise SystemExit(
            f"ESPN refused access to {year} (HTTP {resp.status_code}). "
            "Check that ESPN_S2 and SWID are set and current."
        )
    resp.raise_for_status()
    body = resp.json()
    if isinstance(body, list):  # some ESPN responses wrap the league in a list
        body = body[0] if body else None
    return body


def title_case(word: str | None) -> str:
    word = (word or "").strip()
    return word[:1].upper() + word[1:]


def season_rows(year: int, league: dict) -> tuple[list[dict], dict[str, str]]:
    """Turn one ESPN season response into one row per team."""
    names = {
        m["id"]: f"{title_case(m.get('firstName'))} {title_case(m.get('lastName'))}".strip()
        or m.get("displayName", m["id"])
        for m in league.get("members", [])
    }
    teams = league.get("teams", [])
    schedule = league.get("schedule", [])

    # All-play: compare each team's score with every other team that week (regular season only).
    weeks: dict[int, list[tuple[int, float]]] = {}
    for g in schedule:
        if g.get("playoffTierType", "NONE") != "NONE" or g.get("winner") == "UNDECIDED":
            continue
        for side in ("home", "away"):
            if g.get(side):
                weeks.setdefault(g["matchupPeriodId"], []).append(
                    (g[side]["teamId"], g[side].get("totalPoints", 0))
                )
    all_play = {t["id"]: [0, 0] for t in teams}
    for scores in weeks.values():
        for a, pa in scores:
            for b, pb in scores:
                if a == b:
                    continue
                if pa > pb:
                    all_play[a][0] += 1
                elif pa < pb:
                    all_play[a][1] += 1

    # Championship-bracket playoff results (consolation games are ignored).
    playoff: dict[int, list[int]] = {}
    for g in schedule:
        if g.get("playoffTierType") != "WINNERS_BRACKET":
            continue
        for side, label in (("home", "HOME"), ("away", "AWAY")):
            if not g.get(side):
                continue
            rec = playoff.setdefault(g[side]["teamId"], [0, 0])
            if g.get("winner") == label:
                rec[0] += 1
            elif g.get("winner") not in (None, "UNDECIDED"):
                rec[1] += 1

    in_progress = all(not t.get("rankCalculatedFinal") for t in teams)
    max_pf = max((t["record"]["overall"]["pointsFor"] for t in teams), default=0)

    rows = []
    for t in teams:
        owner = t.get("primaryOwner") or (t.get("owners") or [None])[0]
        manager = names.get(owner, "Unknown")
        rec = t["record"]["overall"]
        name = t.get("name") or f"{t.get('location', '')} {t.get('nickname', '')}"
        po = playoff.get(t["id"])
        rows.append({
            "season": year,
            "team": " ".join(name.split()),
            "w": rec["wins"],
            "l": rec["losses"],
            "t": rec["ties"],
            "pf": round(rec["pointsFor"], 2),
            "pa": round(rec["pointsAgainst"], 2),
            "finish": t.get("rankCalculatedFinal") or 0,
            "seed": t.get("playoffSeed") or 0,
            "apw": all_play[t["id"]][0],
            "apl": all_play[t["id"]][1],
            "playoffs": 1 if po else 0,
            "pow": po[0] if po else 0,
            "pol": po[1] if po else 0,
            "pfTitle": 1 if (not in_progress and rec["pointsFor"] == max_pf) else 0,
            "manager": manager,
            "inProgress": 1 if in_progress else 0,
            "key": f"{year}-{manager}",
        })
    return rows, names


def build_data_js(updated: str | None = None) -> None:
    """Bundle the JSON files into data/data.js so the page also works when opened from disk."""
    bundle = {
        "updated": updated,
        "seasons": json.loads((DATA / "league_seasons.json").read_text()),
        "nfl_coaches": json.loads((DATA / "nfl_coaches.json").read_text()),
        "coach_photos": json.loads((DATA / "coach_photos.json").read_text()),
    }
    meta = DATA / "meta.json"
    if updated:
        meta.write_text(json.dumps({"updated": updated}, indent=2) + "\n")
    elif meta.exists():
        bundle["updated"] = json.loads(meta.read_text()).get("updated")
    (DATA / "data.js").write_text(
        "// Generated by scripts/refresh.py. Do not edit by hand.\n"
        "window.HOF_DATA = " + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--build", action="store_true", help="only rebuild data/data.js from the JSON files")
    args = parser.parse_args()

    if args.build:
        build_data_js()
        print("Rebuilt data/data.js")
        return 0

    load_env()
    import requests  # imported here so --build works without it installed

    league = os.environ.get("LEAGUE_ID", "62116877").strip()
    start = int(os.environ.get("START_YEAR", "2020"))
    include_retired = os.environ.get("INCLUDE_RETIRED", "false").lower() in ("1", "true", "yes")

    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (fantasy-hof refresh script)"
    if os.environ.get("ESPN_S2") and os.environ.get("SWID"):
        session.cookies.set("espn_s2", os.environ["ESPN_S2"], domain=".espn.com")
        session.cookies.set("SWID", os.environ["SWID"], domain=".espn.com")
    else:
        print("ESPN_S2 / SWID not set; this only works if the league is public.", file=sys.stderr)

    rows: list[dict] = []
    latest_managers: set[str] = set()
    for year in range(start, current_season() + 1):
        body = fetch_season(session, league, year)
        if not body or not body.get("teams"):
            print(f"{year}: no data, skipping")
            continue
        season, _ = season_rows(year, body)
        rows.extend(season)
        latest_managers = {r["manager"] for r in season}
        state = "in progress" if season and season[0]["inProgress"] else "final"
        print(f"{year}: {len(season)} teams ({state})")

    if not rows:
        raise SystemExit("No seasons came back from ESPN; nothing written.")

    if not include_retired:
        retired = sorted({r["manager"] for r in rows} - latest_managers)
        rows = [r for r in rows if r["manager"] in latest_managers]
        if retired:
            print("Left out managers not in the current season: " + ", ".join(retired))

    (DATA / "league_seasons.json").write_text(json.dumps(rows, ensure_ascii=False) + "\n")
    build_data_js(dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"))
    print(f"Wrote {len(rows)} rows to data/league_seasons.json and rebuilt data/data.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
