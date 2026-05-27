# HolidayViz — NZ & AU Public Holiday Calendar

An interactive calendar for New Zealand and Australian public holidays and school terms. Switch between countries, filter by region or state, and see upcoming holidays at a glance.

**Live app:** https://ellen528.github.io/HolidayNZ/

---

## Features

- **NZ & AU** — toggle between countries with region/state selectors
- **All-states default view** — all Australian state holidays are visible without selecting a state; the state selector focuses on school term dates
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

## How the calendar data works

Holiday data in the app is **not fetched at runtime**. It is computed by hardcoded rules in the service files and loaded when the page opens. No external requests are made by the calendar itself.

| What | File | How |
|---|---|---|
| NZ public holidays | `services/holidayService.ts` | Algorithmic rules (Easter, mondayisation, regional anniversaries) |
| AU public holidays | `services/australiaHolidayService.ts` | Algorithmic rules per state + hardcoded exact dates for 2026 |
| NZ school terms | `services/holidayService.ts` | 2026 exact dates hardcoded |
| AU school terms | `services/australiaHolidayService.ts` | 2026 exact dates hardcoded |

---

## Data sources

### New Zealand

| Data | Source |
|---|---|
| Public holidays | [govt.nz — Public holidays and Anniversary Days](https://www.govt.nz/browse/work/public-holidays-and-anniversary-days/public-holidays-and-anniversary-days-in-new-zealand/) |
| School terms | [education.govt.nz — School terms and holidays](https://www.education.govt.nz/school/running-a-school/school-operations/school-terms-and-holidays/) |

### Australia — public holidays

The app's holiday rules were authored and verified against these sources:

| Role | Source | Notes |
|---|---|---|
| **Authoritative** | [fairwork.gov.au — Public holidays](https://www.fairwork.gov.au/employment-conditions/public-holidays) | Fair Work Ombudsman; legal basis under the Fair Work Act 2009. Lists every state's holidays with substitution rules. |
| **Cross-check** | [australia.com — Australian public holidays](https://www.australia.com/en-nz/facts-and-planning/when-to-go/australian-public-holidays.html) | Tourism Australia (federal government body); covers current and next year. |

### Australia — school terms (official state sources)

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

---

## Automated holiday verification

A GitHub Actions workflow runs **quarterly** (1 Jan, 1 Apr, 1 Jul, 1 Oct) to compare the app's computed public holidays against an external source and flag any drift.

### Source priority

The verification script tries sources in order and uses the first one that succeeds:

| Priority | Source | When used | Coverage |
|---|---|---|---|
| 1 | **fairwork.gov.au** | Always attempted first (with browser User-Agent) | 33 entries — most comprehensive |
| 2 | **australia.com** | Automatic fallback if fairwork times out | 24 entries — covers all standard public holidays |
| 3 | `AU_HOLIDAYS_CSV_URL` env var | Manual override (any CSV in data.gov.au format) | Custom |

> **Why two sources?** fairwork.gov.au is the authoritative source but its CDN blocks known cloud provider IP ranges (Azure, AWS), causing timeouts in GitHub Actions. australia.com allows automated access from any IP and is used as the automatic fallback. Running the script **locally** will always use fairwork (the better source); CI falls back to australia.com.

The output header always tells you which source was actually used:
```
Comparison source    : fairwork.gov.au (Fair Work Ombudsman)
  — or —
Comparison source    : australia.com (Tourism Australia) [fairwork.gov.au was unreachable]
```

### What the script checks

1. Fetches the comparison source for the requested year
2. Compares against `getAustraliaHolidaysForYear()` output (school holidays excluded)
3. Reports:
   - ✅ **Matched** — holiday in both sources (state-level notes shown where they differ)
   - ❌ **Missing from app** — comparison source has it, app does not → update the service file
   - ⚠️ **App-only** — app has it, comparison source does not → may be a sub-state holiday not listed by that source
   - 🔍 **Manual check** — city/show-day holidays whose dates are set annually by local bodies (AFL Grand Final, NT show days, TAS show days, etc.)
4. **Opens a GitHub issue automatically** if any standard public holidays are missing (scheduled runs only)
5. Exits with code `1` in CI if mismatches are found

### Run manually

```bash
npm run verify:au           # current year
npm run verify:au 2026      # specific year
```

Override the comparison source with any CSV in data.gov.au format:
```bash
AU_HOLIDAYS_CSV_URL=https://... npm run verify:au 2026
```

### Manually verify school terms

The verification script prints the official education department URL for each state. School term dates are hardcoded for 2026 and should be updated each year from those sources. Sub-state and city-specific holidays (show days, AFL Grand Final Friday, etc.) also require annual manual verification — the script lists their reference URLs in its output.

### Workflow file

`.github/workflows/verify-holidays.yml` — triggers on schedule and `workflow_dispatch`. On failure during a scheduled run, it creates a GitHub issue labelled `data-accuracy`.

---

## Deployment

Deployed automatically to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`. The workflow runs `npm ci → npm run build → uploads dist/`. No manual steps required.

---

## Adding a new year

1. Update hardcoded school term dates in `services/australiaHolidayService.ts` (the `AU_SCHOOL_2026` block) and `services/holidayService.ts` (NZ school terms) using the official state education department URLs above
2. Check event-specific holidays (AFL Grand Final Friday, NT Show Days, TAS show days) against their annual sources — the verification script lists them
3. Run `npm run verify:au <year>` locally and resolve any ❌ mismatches
4. Run `npm run build` and push
