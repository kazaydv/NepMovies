# NepMovies

A dark, buttery-smooth Netflix-style movie discovery site. Free forever — no ads, no redirects.

Live: https://kazaydv.github.io/NepMovies/

## What it does

- **Home** — cinematic auto-rotating hero, rows (Trending, Popular, Top Rated, Hindi, Korean, Nepali, genres), edge-fade horizontal scrollers
- **Detail view** — backdrop, match score, cast, trailer, "More Like This"
- **Player** — full custom cinematic player: seek bar with hover preview, ±10s, speed control, volume, fullscreen, ambient glow, keyboard shortcuts, double-tap zones on mobile
- **Continue Watching** — resumes trailers and your own videos where you left off
- **My List** — save movies for later
- **My Videos** — add your own `.mp4` links or device files; they play in the same premium player
- **Search** — instant debounced search
- **Language filter** — English / Hindi / Nepali / Korean / Spanish / Japanese

## Data

Out of the box NepMovies runs on a built-in curated collection (no setup needed).

To unlock the **full live catalog** (trending now, new releases, complete search):

1. Create a free account at https://www.themoviedb.org/signup
2. Go to https://www.themoviedb.org/settings/api and copy your **API Key (v3 auth)**
3. Open NepMovies → ⚙ Settings → paste the key → Save

The key is stored only in your browser's localStorage. Posters, backdrops and metadata come from TMDB; trailers play via YouTube embeds.

## Tech

Pure static site — HTML + CSS + vanilla JS, zero build step, zero dependencies. Hosted on GitHub Pages.
