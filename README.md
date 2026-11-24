# COA Books

A reader for the Project Aon gamebooks: Lone Wolf 1–29, Dawn of the Darklords, Grey Star 1–4 and Freeway Warrior 1–4.

- Numbered sections become tappable choices; a "Turn to…" box covers code puzzles and noted numbers.
- An Action Chart for each series and era (Kai, Magnakai, Grand Master, New Order, Grey Star, Freeway Warrior), carried from book to book.
- A ten-sided die that has to be dragged and thrown. The number comes from the device's secure random source.
- Combat from the book's own Combat Results Table (Freeway Warrior has its own), with weapon, Discipline and psychic-attack bonuses.
- Several readers can sign in on one device; each keeps their own characters.

Installed like CAzen: open the site in Safari, Share → Add to Home Screen. It runs full screen and works offline.

## Where things live

| What | Where |
| --- | --- |
| App code | This repository, published on GitHub Pages |
| The books | The reader's own copy (Google Drive or Files), unpacked on their device only |
| Characters | Supabase (`characters`, `library_links`), row-level security per account |

Book text is never in this repository or on the Pages site. The Project Aon License limits copies to personal use and bars redistributing the Internet Editions or displaying them on another site.

## Commands

```bash
npm install
npm run dev
npm run build
npm run check-books -- /path/to/en/xhtml   # run the book parser over an unzipped collection
```

Settings that aren't secret (Supabase URL and publishable key, Google client ID, API key and project number) are in `src/config.ts`.
