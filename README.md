# Lead CSV Cleaner

**Cleans, dedupes and scores lead CSVs entirely in your browser. Free, and your data is never uploaded.**

Drop in a messy export from any lead source and get back:

- every field trimmed and normalised (emails lowercased, names Title Cased)
- duplicates removed: exact email match first, then fuzzy (same name and same domain)
- invalid, disposable and free-provider emails flagged
- a 0 to 100 quality score and a Hot / Warm / Cold / Disqualified bucket per lead
- downloads: cleaned CSV, cleaned JSON, and a "flagged rows" CSV with the reason for every flag
- CSV exports are safe to open in Excel/Sheets: any field starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` so it can never execute as a formula (CSV-injection protection)

**Live demo:** https://lead-csv-cleaner.pages.dev

## Privacy is the whole point

Everything runs in your browser tab with plain JavaScript (`FileReader` + vanilla ES modules). This tool:

- **never uploads your file.** There is no server, no API call, no form post.
- **never tracks you.** No analytics, no cookies, no fingerprinting.
- **never calls a paid API.** The disposable-domain and free-provider lists are bundled as static files.

You can verify all of that in a few hundred lines of dependency-free source code, or just watch the network tab: zero requests with your data.

## How scoring works

The rules are deliberately simple. The exact weights live in [`js/qualify.js`](js/qualify.js):

| Signal | Points |
|---|---|
| Corporate (non-free) email domain | +40 |
| Valid email syntax | +20 |
| Has a name | +15 |
| Has a company | +15 |
| Has a phone number | +10 |
| Disposable email domain | score set to 0, **Disqualified** |

Buckets: **Hot** is 70 and above, **Warm** is 40 to 69, **Cold** is below 40. A disposable email lands in **Disqualified** regardless.

Nothing is ever silently dropped: malformed rows, invalid emails and disposable domains all land in the flagged-rows export with a written reason, and the summary panel reports every count (rows in, cleaned, duplicates removed, flagged).

## Quickstart

Browsers block ES module imports on `file://`, so serve the folder with any static server:

```
npx serve
# or
python -m http.server
```

then open the printed local URL. That's it. No build step, no dependencies. Click **Load sample data** to try it with the bundled synthetic sample.

To verify the pipeline headlessly (Node 18+):

```
node scripts/verify.mjs
```

It runs the same parse → clean → validate → qualify modules the browser uses against the sample file and asserts the planted duplicates, malformed row and disposable emails are all caught.

## Input format

Header-flexible and case-insensitive. The tool looks for columns like `name` (or `first name` + `last name`), `email`, `company`, `domain`/`website` and `phone`, in any order, with common aliases. Every unrecognised column is carried through to the exports untouched. Quoted fields, embedded commas and newlines are handled properly (RFC 4180 style).

## Project structure

```
lead-csv-cleaner/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── parse-csv.js        CSV parsing + header mapping
│   ├── clean.js            normalise, strip empty rows, dedupe
│   ├── validate.js         email syntax, disposable + free-provider flags
│   ├── qualify.js          score weights and buckets
│   ├── export.js           summary + CSV/JSON output building
│   ├── ui.js               all DOM rendering
│   └── main.js             wiring + pipeline
├── data/
│   ├── disposable-domains.js   bundled blocklist (see attribution in file)
│   └── free-providers.js
├── samples/
│   └── leads-sample.csv    25 synthetic rows, see below
├── scripts/
│   └── verify.mjs          headless real-run check
├── package.json            "type": "module" only, zero dependencies
├── LICENSE
└── README.md
```

`data/disposable-domains.js` bundles a ~200-entry subset of the public [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) blocklist (CC0).

## Sample data

`samples/leads-sample.csv` is **entirely synthetic**: fake people at fake companies like "Acme Widgets Sdn Bhd" and "Vandelay Imports (Synthetic)" on reserved `.example` domains. It deliberately includes dirty casing, stray whitespace, an exact duplicate, a fuzzy duplicate, two disposable emails, two broken emails, an empty row and one malformed row, so you can see every feature fire at once.

## Want this wired into your CRM automatically?

That is the sort of thing I build for clients: cleaning, enrichment and scoring pipelines that run on their own instead of in a browser tab. Hire me:

- Fiverr: *link pending*
- Upwork: *link pending*
- Contra: *link pending*

## License

[MIT](LICENSE) © 2026 Razeow
