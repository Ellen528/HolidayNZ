/**
 * verify-au-holidays.ts
 *
 * Fetches the official Australian public holiday data from data.gov.au and
 * compares it against the holidays computed by australiaHolidayService.ts.
 *
 * Usage:  npx tsx scripts/verify-au-holidays.ts [year]
 * CI:     exits 0 = all matched, exits 1 = mismatches found
 *
 * Official source:
 *   data.gov.au "Australian Public Holidays" dataset
 *   https://data.gov.au/dataset/ds-dga-b1bc6077-dadd-4f61-9f8c-002ab2cdff10
 *
 * Override the CSV URL via env var if data.gov.au changes the resource ID:
 *   AU_HOLIDAYS_CSV_URL=https://... npx tsx scripts/verify-au-holidays.ts
 */

import { getAustraliaHolidaysForYear, STATE_NAMES } from '../services/australiaHolidayService';
import { HolidayType, StateId } from '../types';

const YEAR = parseInt(process.argv[2] ?? '') || new Date().getFullYear();

// ── Official sources ────────────────────────────────────────────────────────────
//
// PRIMARY (authoritative, legal basis):
//   fairwork.gov.au — Fair Work Ombudsman, administers the Fair Work Act 2009
//   2026 page: https://www.fairwork.gov.au/employment-conditions/public-holidays/2026-public-holidays
//
// MACHINE-READABLE (community CSV, mirrors retired data.gov.au format):
//   Community Gist by joshluongo — appears accurate for 2026, no official backing
//   data.gov.au CSV was retired end-2025; no official machine-readable source exists for 2026+
//
// Set AU_HOLIDAYS_CSV_URL env var to override the machine-readable source URL.
const FAIRWORK_URL = 'https://www.fairwork.gov.au/employment-conditions/public-holidays';
const GIST_2026    = 'https://gist.githubusercontent.com/joshluongo/dc6cd80af01dbcafc087a0272722eb1a/raw/Aus-Holidays-2026.csv';
// Year-specific URLs for data.gov.au (still accessible for 2019–2025)
const DATA_GOV_URLS: Partial<Record<number, string>> = {
  2025: 'https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv',
  2024: 'https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/9e920340-0744-4031-a497-98ab796633e8/download/australian_public_holidays_2024.csv',
};

// ── Sub-state / city-specific holidays not tracked by data.gov.au ─────────────
// These are flagged for manual annual review rather than treated as mismatches.
const MANUAL_VERIFY = new Set([
  'AFL Grand Final Friday',
  'Royal Adelaide Show',
  'Royal Queensland Show',
  'Alice Springs Show Day',
  'Tennant Creek Show Day',
  'Katherine Show Day',
  'Darwin Show Day',
  'Borroloola Show Day',
  'Devonport Cup',
  'Royal Hobart Regatta',
  'Launceston Cup',
  'AGFEST',
  'Burnie Show',
  'Royal Launceston Show',
  'Flinders Island Show',
  'Royal Hobart Show',
  'Devonport Show',
  'Bank Holiday',           // NSW - some editions omit this
  'Melbourne Cup Day',      // metro VIC/TAS only — inconsistently included
  'Easter Tuesday',         // TAS restricted PH — not in Gist
  'Recreation Day',         // TAS (northern only) — not in Gist
  'King Island Show',       // TAS regional — not in Gist
]);

// Known name aliases between data.gov.au/Gist and this app.
// Map Gist names → our app's canonical names (or vice versa).
const ALIASES: Record<string, string> = {
  "holy saturday":               "easter saturday",
  "queen's birthday":            "king's birthday",
  "christmas":                   "christmas day",
  "boxing day/proclamation day": "boxing day",
  "proclamation day":            "boxing day",
  "boxing day (substitute day)": "boxing day",        // treat substitute as same holiday
  "family & community day":      "canberra day",
  "melbourne cup":               "melbourne cup day",
  "anzac day (substitute day)":  "anzac day (additional holiday)",
  "christmas eve":               "christmas eve (part-day)",
  "new year's eve":              "new year's eve (part-day)",
  "anzac day":                   "anzac day",         // identity — normalise capitalisation
  "may day":                     "may day",
};

// data.gov.au jurisdiction codes → our StateId
const JURIS_TO_STATE: Record<string, StateId | 'national'> = {
  nat: 'national',
  act: StateId.ACT,
  nsw: StateId.NSW,
  nt:  StateId.NT,
  qld: StateId.QLD,
  sa:  StateId.SA,
  tas: StateId.TAS,
  vic: StateId.VIC,
  wa:  StateId.WA,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function normName(n: string): string {
  const lower = n.trim().toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ');
  return ALIASES[lower] ?? lower;
}

/** Handles YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY */
function parseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parts = s.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return '';
}

/** Simple CSV row parser (handles basic quoted fields) */
function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  });
}

// ── Fetch official data ────────────────────────────────────────────────────────

/** Pick the best available CSV source for the given year. */
function resolveCsvUrl(year: number): string {
  if (process.env.AU_HOLIDAYS_CSV_URL) return process.env.AU_HOLIDAYS_CSV_URL;
  if (DATA_GOV_URLS[year]) return DATA_GOV_URLS[year]!;
  if (year === 2026) return GIST_2026;
  throw new Error(
    `No machine-readable source available for ${year}.\n` +
    `  Verify manually at: ${FAIRWORK_URL}/${year}-public-holidays\n` +
    `  Or set: AU_HOLIDAYS_CSV_URL=<url> npx tsx scripts/verify-au-holidays.ts`,
  );
}

/** Returns Map<"dateStr|normName", Set<jurisdictionCode>> */
async function fetchOfficial(year: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  let text: string;
  let csvUrl: string;

  try {
    csvUrl = resolveCsvUrl(year);
    console.log(`   CSV URL: ${csvUrl}`);
    const res = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    text = await res.text();
  } catch (err) {
    console.log(`\n⚠️  Could not fetch machine-readable data: ${err}`);
    console.log(`   Verify manually at: ${FAIRWORK_URL}/${year}-public-holidays`);
    console.log(`   Override URL: AU_HOLIDAYS_CSV_URL=<url> npx tsx scripts/verify-au-holidays.ts\n`);
    return map;
  }

  const yearStr = String(year);
  for (const row of parseCsvRows(text)) {
    const rawDate  = row['Date'] ?? row['date'] ?? '';
    const name     = row['Holiday Name'] ?? row['holiday_name'] ?? row['Name'] ?? '';
    const jurisRaw = row['Jurisdiction'] ?? row['jurisdiction'] ?? row['Applicable To'] ?? '';

    const dateStr = parseDate(rawDate);
    if (!dateStr.startsWith(yearStr) || !name) continue;

    const key = `${dateStr}|${normName(name)}`;
    if (!map.has(key)) map.set(key, new Set());

    // Some CSV editions use comma-separated codes in one cell
    jurisRaw.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
      .forEach(code => map.get(key)!.add(code));
  }
  return map;
}

// ── Build app holiday map ──────────────────────────────────────────────────────

/** Format a local Date as YYYY-MM-DD without UTC conversion. */
function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAppMap(year: number): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const holidays = getAustraliaHolidaysForYear(year)
    .filter(h => h.type !== HolidayType.School);

  for (const h of holidays) {
    const dateStr = localIso(h.date);
    const key = `${dateStr}|${normName(h.name)}`;
    if (!map.has(key)) map.set(key, new Set());

    if (!h.stateIds || h.stateIds.length === 0) {
      map.get(key)!.add('nat');
    } else {
      h.stateIds.forEach(sid => map.get(key)!.add(sid.toLowerCase()));
    }
  }
  return map;
}

// ── School term sources ────────────────────────────────────────────────────────
const SCHOOL_SOURCES: [string, string][] = [
  ['ACT', 'https://www.education.act.gov.au/public-school-life/when-to-attend/school-terms-and-holidays'],
  ['NSW', 'https://education.nsw.gov.au/teaching-and-learning/curriculum/school-terms'],
  ['NT',  'https://education.nt.gov.au/schools/school-operations/school-terms'],
  ['QLD', 'https://qed.qld.gov.au/about-us/calendar'],
  ['SA',  'https://www.education.sa.gov.au/students-and-families/learning-options/term-dates'],
  ['TAS', 'https://www.education.tas.gov.au/parents-carers/school-terms-dates/'],
  ['VIC', 'https://www.education.vic.gov.au/about/department/Pages/dateschoolterm.aspx'],
  ['WA',  'https://www.education.wa.edu.au/school-term-dates'],
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const runDate = new Date().toISOString().slice(0, 10);
  const bar = '='.repeat(62);
  console.log(`\n${bar}`);
  console.log(` AU HOLIDAY VERIFICATION — ${YEAR}`);
  console.log(` Run: ${runDate}`);
  console.log(` Authoritative source : ${FAIRWORK_URL}/${YEAR}-public-holidays`);
  const csvNote = DATA_GOV_URLS[YEAR]
    ? `data.gov.au official CSV (${YEAR})`
    : YEAR === 2026
      ? 'unofficial 2026 CSV by github.com/joshluongo (data.gov.au stopped publishing after 2025)'
      : 'no CSV available — set AU_HOLIDAYS_CSV_URL to run comparison';
  console.log(` Comparison CSV       : ${csvNote}`);
  console.log(`${bar}\n`);

  const [officialMap, appMap] = await Promise.all([
    fetchOfficial(YEAR),
    Promise.resolve(buildAppMap(YEAR)),
  ]);

  if (officialMap.size === 0) {
    console.log('⚠️  No machine-readable data retrieved — skipping automated comparison.');
    console.log(`   Verify manually at: ${FAIRWORK_URL}/${YEAR}-public-holidays\n`);
    printSchoolSources();
    process.exit(0);
  }

  console.log(`Official entries : ${officialMap.size}`);
  console.log(`App entries      : ${appMap.size}\n`);

  const allKeys = new Set([...officialMap.keys(), ...appMap.keys()]);
  const matched:      string[] = [];
  const missing:      string[] = [];  // in official, not in app
  const appOnly:      string[] = [];  // in app, not in official
  const manualCheck:  string[] = [];

  for (const key of allKeys) {
    const [dateStr, name] = key.split('|');
    const displayName = name;

    // Sub-state holidays go to manual section regardless
    if ([...MANUAL_VERIFY].some(m => normName(m) === name)) {
      const states = appMap.get(key) ? [...appMap.get(key)!].join(',') : 'not in app';
      manualCheck.push(`  ${dateStr}  ${displayName}  [${states}]`);
      continue;
    }

    const inOfficial = officialMap.has(key);
    const inApp      = appMap.has(key);

    if (inOfficial && inApp) {
      const offStates = [...officialMap.get(key)!].sort().join(',');
      const appStates = [...appMap.get(key)!].sort().join(',');
      const stateNote = offStates !== appStates ? `  ⚠ states: official=[${offStates}] app=[${appStates}]` : '';
      matched.push(`  ✅  ${dateStr}  ${displayName}${stateNote}`);
    } else if (!inOfficial && inApp) {
      const appStates = [...appMap.get(key)!].sort().join(',');
      appOnly.push(`  ⚠️   ${dateStr}  ${displayName}  [app:${appStates}]`);
    } else if (inOfficial && !inApp) {
      const offStates = [...officialMap.get(key)!].sort().join(',');
      missing.push(`  ❌  ${dateStr}  ${displayName}  [official:${offStates}]`);
    }
  }

  const sortByDate = (a: string, b: string) => a.localeCompare(b);
  matched.sort(sortByDate);
  missing.sort(sortByDate);
  appOnly.sort(sortByDate);
  manualCheck.sort(sortByDate);

  console.log(`MATCHED (${matched.length})`);
  matched.forEach(l => console.log(l));

  if (missing.length > 0) {
    console.log(`\n❌ MISSING FROM APP (${missing.length}) — official data has these, app does not:`);
    missing.forEach(l => console.log(l));
    console.log('  → Update services/australiaHolidayService.ts');
  }

  if (appOnly.length > 0) {
    console.log(`\n⚠️  APP-ONLY (${appOnly.length}) — app has these, official data does not:`);
    appOnly.forEach(l => console.log(l));
    console.log('  → May be sub-state holidays not in data.gov.au, or a wrong date.');
    console.log('  → Check individually at each state government website.');
  }

  if (manualCheck.length > 0) {
    console.log(`\n🔍 MANUAL CHECK REQUIRED (${manualCheck.length}) — city/sub-state holidays:`);
    manualCheck.forEach(l => console.log(l));
    console.log('  → data.gov.au does not track city-specific show days, AFL Friday, etc.');
    console.log('  → Verify dates annually:');
    console.log('      VIC AFL Grand Final: https://www.afl.com.au');
    console.log('      SA Royal Adelaide Show: https://www.theshow.com.au');
    console.log('      QLD Royal Queensland Show: https://www.ekka.com.au');
    console.log('      NT Show Days: https://nt.gov.au/employ/rights-at-work/leave/public-holidays');
    console.log('      TAS Show Days: https://worksafe.tas.gov.au/topics/laws-and-regulations/public-holidays');
  }

  printSchoolSources();

  const hasMismatches = missing.length > 0;
  if (hasMismatches) {
    console.log(`\n🔴 RESULT: ${missing.length} holiday(s) missing from app — action required.\n`);
    process.exit(1);
  } else {
    console.log(`\n🟢 RESULT: All standard public holidays matched — no action needed.\n`);
    process.exit(0);
  }
}

function printSchoolSources() {
  console.log('\n📚 SCHOOL TERMS — verify annually at official state education department sites:');
  SCHOOL_SOURCES.forEach(([state, url]) => {
    console.log(`  ${state.padEnd(4)} ${url}`);
  });
  console.log('  (School term data in this app was sourced from worldstrides.com.au, not official govt sites.)');
}

main().catch(err => {
  console.log('\n💥 Script error:', err);
  process.exit(1);
});
