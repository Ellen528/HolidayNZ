# HolidayViz — NZ & AU Public Holiday Calendar

An interactive calendar for New Zealand and Australian public holidays and school terms. Switch between countries, filter by region or state, and see upcoming holidays at a glance.

**Live app:** https://ellen528.github.io/HolidayNZ/

---

## Features

- **NZ & AU** — toggle between countries with region/state selectors
- **All-states default view** — Australian state holidays are visible without selecting a state; state selector focuses on school terms
- **Holiday detail panel** — statutory date, observed date, description, and region/state chips
- **Next public holiday countdown** — updates dynamically based on your selected country/state
- **SVG maps** — click a NZ region or AU state to filter school holidays

---

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build → dist/
npm run preview    # preview the production build
```

---

## Data sources

### New Zealand

| Data | Source | Notes |
|---|---|---|
| Public holidays | [govt.nz — Public holidays and Anniversary Days](https://www.govt.nz/browse/work/public-holidays-and-anniversary-days/public-holidays-and-anniversary-days-in-new-zealand/) | Algorithmic formulas derived from official rules |
| School terms | [education.govt.nz — School terms and holidays](https://www.education.govt.nz/school/running-a-school/school-operations/school-terms-and-holidays/) | 2026 exact dates hardcoded; approximate for other years |

### Australia

| Data | Source | Notes |
|---|---|---|
| Public holidays | [fairwork.gov.au — 2026 public holidays](https://www.fairwork.gov.au/employment-conditions/public-holidays/2026-public-holidays) | **Primary authoritative source** — Fair Work Ombudsman, legal basis under the Fair Work Act 2009 |
| Public holidays (cross-check) | [australia.com — Australian public holidays](https://www.australia.com/en-nz/facts-and-planning/when-to-go/australian-public-holidays.html) | Tourism Australia; covers 2026 and 2027 |
| School terms | State education department websites (see below) | 2026 exact dates hardcoded from these sources |

**Australian school term sources (official):**

| State | URL |
|---|---|
| ACT | https://www.education.act.gov.au/public-school-life/when-to-attend/school-terms-and-holidays |
| NSW | https://education.nsw.gov.au/teaching-and-learning/curriculum/school-terms |
| NT  | https://education.nt.gov.au/schools/school-operations/school-terms |
| QLD | https://qed.qld.gov.au/about-us/calendar |
| SA  | https://www.education.sa.gov.au/students-and-families/learning-options/term-dates |
| TAS | https://www.education.tas.gov.au/parents-carers/school-terms-dates/ |
| VIC | https://www.education.vic.gov.au/about/department/Pages/dateschoolterm.aspx |
| WA  | https://www.education.wa.edu.au/school-term-dates |

> **Note:** The `data.gov.au` machine-readable CSV dataset for Australian public holidays was retired at end-2025 and only covers 2019–2025. For 2026 machine-readable data, a [community-maintained Gist](https://gist.github.com/joshluongo/dc6cd80af01dbcafc087a0272722eb1a) in the same format is used for automated verification only. `fairwork.gov.au` remains the authoritative source.

---

## Automated holiday verification

A GitHub Actions workflow runs **quarterly** (1 Jan, 1 Apr, 1 Jul, 1 Oct) to compare the app's computed public holidays against external data and flag any drift.

### How it works

1. Fetches the community 2026 CSV (mirrors the retired data.gov.au format)
2. Compares against `getAustraliaHolidaysForYear()` output
3. Reports: matched holidays, holidays missing from the app, app-only entries, and sub-state holidays requiring manual review
4. **Opens a GitHub issue automatically** if any standard public holidays are missing
5. Exits with code `1` in CI if mismatches are found

### Run manually

```bash
npm run verify:au           # current year
npm run verify:au 2026      # specific year
```

Override the CSV source URL if needed:
```bash
AU_HOLIDAYS_CSV_URL=https://... npm run verify:au 2026
```

### Manually verify school terms

The verification script prints official education department URLs for each state. School term dates are hardcoded for 2026 and should be updated each year by checking those sources. Sub-state and city-specific holidays (show days, AFL Grand Final Friday, etc.) also require annual manual verification — the script lists their authoritative sources in its output.

### Workflow file

`.github/workflows/verify-holidays.yml` — triggers on schedule and `workflow_dispatch`. On failure during a scheduled run, it creates a GitHub issue labelled `data-accuracy`.

---

## Deployment

Deployed automatically to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

The workflow runs `npm ci → npm run build → uploads dist/` to GitHub Pages. No manual steps required.

---

## Adding a new year

1. Update hardcoded school term dates in `services/australiaHolidayService.ts` (`AU_SCHOOL_2026` block) and `services/holidayService.ts` (NZ school terms)
2. Check local show days and event-specific holidays (AFL Grand Final Friday, NT Show Days, TAS show days) against their official sources
3. Run `npm run verify:au <year>` and resolve any flagged mismatches
4. Run `npm run build` and push
