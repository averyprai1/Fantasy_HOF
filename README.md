# Manager Hall of Fame

A static dashboard tracking every manager in our ESPN fantasy football league on the road to the Manager Hall of Fame, with an NFL head coach comparison for each manager.

It's plain HTML, CSS and JavaScript with no build step, served by GitHub Pages. League data comes from ESPN's fantasy API and refreshes weekly through a GitHub Action.

## Hall of Fame rules

A manager is inducted when all four are true:

| Requirement | Bar |
|---|---|
| League championships | 2 or more |
| Top-3 finishes | 5 or more |
| Playoff appearances | 65% of completed seasons |
| Career win % (regular season + championship-bracket playoffs) | .575 or higher |

**HOF points** rank everyone who isn't in yet:
- +4 per title
- +1 per runner-up finish
- +1 per playoff appearance
- +1 per season leading the league in points for
- −3 per last-place finish

To change any of this, edit the `careers` calculation at the top of `assets/app.js`.

## Publish the site (one time)

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute the site is live at `https://averyprai1.github.io/Fantasy_HOF/`. Share that link with the league; viewers don't need an account.

## Turn on the weekly refresh (one time)

The league is private, so the refresh needs two ESPN login cookies. They act like your ESPN password: store them only as GitHub secrets, never in a file you commit.

1. Sign in to [espn.com](https://www.espn.com) in Chrome, open **Developer Tools → Application → Cookies → https://www.espn.com**, and copy the values of `espn_s2` and `SWID` (keep the curly braces on SWID).
2. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `ESPN_S2`: the espn_s2 value
   - `SWID`: the SWID value
3. Go to **Actions → Refresh league data → Run workflow** to test it.

The workflow then runs every Tuesday morning after Monday Night Football and commits new data only when something changed. Pages republishes automatically.

Optional repository variables (same settings page, **Variables** tab):

| Variable | Default | Purpose |
|---|---|---|
| `LEAGUE_ID` | `62116877` | ESPN league ID |
| `START_YEAR` | `2020` | First season to pull |
| `INCLUDE_RETIRED` | `false` | Keep managers who aren't in the current season |

If the refresh starts failing with an access error, your ESPN cookies have expired. Copy fresh ones into the secrets.

## Run it on your own computer

**Just view it.** Open `index.html` in a browser; double-clicking works, no server needed.

**Refresh the data yourself.** Needs Python 3.9 or newer:

```bash
pip install -r scripts/requirements.txt
cp .env.example .env        # then paste your espn_s2 and SWID into .env
python scripts/refresh.py
```

`.env` is in `.gitignore`, so it won't be committed.

## How it's put together

```
index.html            page markup
assets/theme.css      colors, type and spacing (light and dark)
assets/app.css        dashboard layout
assets/app.js         calculations (careers, champions, NFL comps) and drawing
assets/dash.js        small data runtime that feeds app.js
data/league_seasons.json   one row per manager per season (from ESPN)
data/nfl_coaches.json      NFL head coach career records (Pro Football Reference)
data/coach_photos.json     coach headshots (Wikimedia Commons, credited on the page)
data/data.js               all of the above bundled for the page (generated)
scripts/refresh.py         pulls ESPN data and rebuilds data/data.js
```

If you edit a JSON file in `data/` by hand, run `python scripts/refresh.py --build` to rebuild `data/data.js`.

### NFL coach comps

Each manager is matched to the NFL head coach (3+ seasons) with the closest career profile. Both groups are ranked within themselves on six measures:
- titles
- titles per season
- finals trips per season
- playoff rate
- win %
- playoff win %

Titles and win % weigh most, and each coach is used once. The page can switch between coaches active in the last 25 years and all-time.

Headshots are stored only for the coaches currently matched. If a future refresh matches someone new, that card shows the coach's name without a photo until one is added to `data/coach_photos.json`.

Coach records are a snapshot and don't refresh automatically.
