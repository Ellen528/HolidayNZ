/**
 * verify-au-holidays.ts
 *
 * Scrapes australia.com (Tourism Australia, a federal government body) and
 * compares the listed public holidays against australiaHolidayService.ts.
 *
 * Usage:  npx tsx scripts/verify-au-holidays.ts [year]
 * CI:     exits 0 = all matched, exits 1 = mismatches found
 *
 * Why australia.com and not fairwork.gov.au?
 *   fairwork.gov.au is the legal authoritative source but returns HTTP 403 for
 *   automated requests.  australia.com is an official government body (Tourism
 *   Australia), allows programmatic access, and matches fairwork.gov.au in content.
 *
 * Fallback — supply a CSV URL via env var (data.gov.au format):
 *   AU_HOLIDAYS_CSV_URL=https://... npx tsx scripts/verify-au-holidays.ts
 */

import { getAustraliaHolidaysForYear } from '../services/australiaHolidayService';
import { HolidayType } from '../types';

const YEAR = parseInt(process.argv[2] ?? '') || new Date().getFullYear();

// ── Source URLs ────────────────────────────────────────────────────────────────
const FAIRWORK_URL   = 'https://www.fairwork.gov.au/employment-conditions/public-holidays';
const AUSTRALIA_COM  = 'https://www.australia.com/en-nz/facts-and-planning/when-to-go/australian-public-holidays.html';

// ── Holidays not listed on australia.com — flagged for manual check ────────────
// australia.com is a tourist guide; it omits city-specific shows, part-day
// holidays, and state-specific ANZAC substitute days.
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
  'Bank Holiday',                   // NSW only; tourist sites omit it
  'Melbourne Cup Day',              // metro VIC/TAS — inconsistently listed
  'Easter Tuesday',                 // TAS restricted PH
  'Recreation Day',                 // TAS (northern only)
  'King Island Show',               // TAS regional
  'Christmas Eve (part-day)',       // part-day hospitality holiday — not on tourist sites
  "New Year's Eve (part-day)",      // part-day — not on tourist sites
  'ANZAC Day (additional holiday)', // only in years when Apr 25 is a weekend; not on australia.com
]);

// ── Name aliases: australia.com name → our app's canonical name ───────────────
const ALIASES: Record<string, string> = {
  "holy saturday":               "easter saturday",
  "queen's birthday":            "king's birthday",
  "christmas":                   "christmas day",
  "boxing day observed":         "boxing day",   // australia.com calls the substitute this
  "boxing day/proclamation day": "boxing day",
  "proclamation day":            "boxing day",
  "family & community day":      "canberra day",
  "melbourne cup":               "melbourne cup day",
};

// ── HTML → holiday-entry parsing ───────────────────────────────────────────────

const MONTHS_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};
const DAYS_PAT   = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTHS_PAT = Object.keys(MONTHS_MAP).join('|');

/**
 * Split a text blob into individual "DayName, D Month[*]: Name" strings.
 * Uses a lookahead so each day-name becomes the start of its own entry.
 */
function splitEntries(text: string): string[] {
  return text
    .split(new RegExp(`(?=(?:${DAYS_PAT}),\\s+\\d+\\s+(?:${MONTHS_PAT})(?:\\*+)?:)`))
    .map(s => s.trim())
    .filter(s => new RegExp(`^(?:${DAYS_PAT}),`).test(s));
}

/** Parse "DayName, D Month[*]: Holiday Name[**]" → { dateStr, name } | null */
function parseEntry(entry: string, year: number): { dateStr: string; name: string } | null {
  const re = new RegExp(
    `^(?:${DAYS_PAT}),\\s+(\\d+)\\s+(${MONTHS_PAT})(?:\\*+)?:\\s+(.+?)(?:\\*+)?\\s*$`
  );
  const m = entry.match(re);
  if (!m) return null;
  const day   = parseInt(m[1]);
  const month = MONTHS_MAP[m[2]];
  const name  = m[3]
    // Strip footnotes: everything from the first * onwards
    // e.g. "King's Birthday *Regional areas in WA..." → "King's Birthday"
    .replace(/\s*\*.*$/s, '')
    // Strip scheduling placeholders like "Friday before AFL Grand Final: Subject to AFL schedule"
    // Matches a day name followed by before/after/subject/tbc at a word boundary
    .replace(new RegExp(`\\s+(?:${DAYS_PAT})\\s+(?:before|after|subject|tbc|date)\\b.*$`, 'si'), '')
    .trim();
  if (!name) return null;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, name };
}

// australia.com section headings → jurisdiction code.
// 'skip' entries act as boundary markers to terminate the previous chunk cleanly
// without adding their own entries (e.g. "Other public holidays declared…" sits
// between the national list and the state list and would bleed into Boxing Day).
const SECTION_JURIS: [string, string][] = [
  ['national public holidays', 'nat'],
  ['other public holidays declared', 'skip'], // terminates the national chunk
  ['australian capital territory', 'act'],
  ['new south wales', 'nsw'],
  ['northern territory', 'nt'],
  ['queensland', 'qld'],
  ['south australia', 'sa'],
  ['tasmania', 'tas'],
  ['victoria', 'vic'],
  ['western australia', 'wa'],
  // 'external territories' intentionally omitted — no entries in our app
];

// ── Shared helpers ─────────────────────────────────────────────────────────────

function normName(n: string): string {
  const lower = n.trim().toLowerCase()
    // Normalise all apostrophe/quote variants to a plain straight apostrophe
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035'']/g, "'")
    .replace(/\s+/g, ' ');
  return ALIASES[lower] ?? lower;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Fetch from australia.com ───────────────────────────────────────────────────

async function fetchFromAustraliaCom(year: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();

  let html: string;
  try {
    const res = await fetch(AUSTRALIA_COM, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    html = await res.text();
  } catch (err) {
    console.log(`\n⚠️  Could not fetch australia.com: ${err}`);
    console.log(`   URL: ${AUSTRALIA_COM}`);
    console.log(`   Verify manually at: ${FAIRWORK_URL}/${year}-public-holidays`);
    console.log(`   Override: AU_HOLIDAYS_CSV_URL=<csv-url> npx tsx scripts/verify-au-holidays.ts\n`);
    return map;
  }

  // Strip HTML tags and decode common entities.
  // Numeric entities (decimal and hex) are decoded generically so that apostrophes
  // encoded as &#x2019; or &#8217; produce the same character regardless of section.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

  // Isolate this year's section (ends at next year's section or end of text)
  const lc          = text.toLowerCase();
  const yearMarker  = `australian public holidays ${year}`;
  const startIdx    = lc.indexOf(yearMarker);
  if (startIdx === -1) {
    console.log(`\n⚠️  "${year}" section not found on australia.com — page structure may have changed\n`);
    return map;
  }
  const nextYearIdx = lc.indexOf(`australian public holidays ${year + 1}`, startIdx + yearMarker.length);
  const section     = text.slice(startIdx, nextYearIdx === -1 ? undefined : nextYearIdx);
  const secLc       = section.toLowerCase();

  // Find the FIRST occurrence of each state heading (avoids false positives from footnotes)
  const boundaries: { pos: number; juris: string }[] = [];
  for (const [heading, juris] of SECTION_JURIS) {
    const pos = secLc.indexOf(heading);
    if (pos !== -1) boundaries.push({ pos, juris });
  }
  boundaries.sort((a, b) => a.pos - b.pos);

  if (boundaries.length === 0) {
    console.log(`\n⚠️  No state sections found in ${year} section — page structure may have changed\n`);
    return map;
  }

  // Parse each jurisdiction's chunk
  for (let i = 0; i < boundaries.length; i++) {
    const { pos, juris } = boundaries[i];
    if (juris === 'skip') continue; // boundary-only marker, not a real jurisdiction
    const nextPos = i + 1 < boundaries.length ? boundaries[i + 1].pos : section.length;
    const chunk   = section.slice(pos, nextPos);

    for (const entry of splitEntries(chunk)) {
      const parsed = parseEntry(entry, year);
      if (!parsed) continue;
      const key = `${parsed.dateStr}|${normName(parsed.name)}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(juris);
    }
  }

  return map;
}

// ── CSV fallback (AU_HOLIDAYS_CSV_URL override) ────────────────────────────────

function parseCsvDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const p = s.split('/');
  if (p.length === 3 && p[2].length === 4)
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  return '';
}

async function fetchFromCsv(csvUrl: string, year: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const res = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text    = await res.text();
  const lines   = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return map;
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const yearStr = String(year);
  for (const line of lines.slice(1)) {
    const cells    = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim().replace(/^"|"$/g, ''); });
    const rawDate  = row['Date'] ?? row['date'] ?? '';
    const name     = row['Holiday Name'] ?? row['holiday_name'] ?? row['Name'] ?? '';
    const jurisRaw = row['Jurisdiction'] ?? row['jurisdiction'] ?? row['Applicable To'] ?? '';
    const dateStr  = parseCsvDate(rawDate);
    if (!dateStr.startsWith(yearStr) || !name) continue;
    const key = `${dateStr}|${normName(name)}`;
    if (!map.has(key)) map.set(key, new Set());
    jurisRaw.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
      .forEach(code => map.get(key)!.add(code));
  }
  return map;
}

// ── Dispatch to correct source ─────────────────────────────────────────────────

async function fetchOfficial(year: number): Promise<{ map: Map<string, Set<string>>; label: string }> {
  const csvOverride = process.env.AU_HOLIDAYS_CSV_URL;
  if (csvOverride) {
    console.log(`   CSV override: ${csvOverride}`);
    try {
      const map = await fetchFromCsv(csvOverride, year);
      return { map, label: `CSV override (${csvOverride})` };
    } catch (err) {
      console.log(`\n⚠️  CSV override fetch failed: ${err}\n`);
      return { map: new Map(), label: 'CSV override (failed)' };
    }
  }
  const map = await fetchFromAustraliaCom(year);
  return { map, label: 'australia.com (Tourism Australia)' };
}

// ── Build app holiday map ──────────────────────────────────────────────────────

function buildAppMap(year: number): Map<string, Set<string>> {
  const map      = new Map<string, Set<string>>();
  const holidays = getAustraliaHolidaysForYear(year).filter(h => h.type !== HolidayType.School);
  for (const h of holidays) {
    const dateStr = localIso(h.date);
    const key     = `${dateStr}|${normName(h.name)}`;
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

function printSchoolSources() {
  console.log('\n📚 SCHOOL TERMS — verify annually at official state education department sites:');
  SCHOOL_SOURCES.forEach(([state, url]) => console.log(`  ${state.padEnd(4)} ${url}`));
  console.log('  (2026 school term dates in this app were sourced from worldstrides.com.au — not official govt sites.)');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const runDate = new Date().toISOString().slice(0, 10);
  const bar     = '='.repeat(62);

  console.log(`\n${bar}`);
  console.log(` AU HOLIDAY VERIFICATION — ${YEAR}`);
  console.log(` Run: ${runDate}`);
  console.log(` Authoritative source : ${FAIRWORK_URL}/${YEAR}-public-holidays`);

  const { map: officialMap, label } = await fetchOfficial(YEAR);

  console.log(` Comparison source    : ${label}`);
  console.log(`${bar}\n`);

  if (officialMap.size === 0) {
    console.log('⚠️  No comparison data retrieved — skipping automated comparison.');
    console.log(`   Verify manually at: ${FAIRWORK_URL}/${YEAR}-public-holidays\n`);
    printSchoolSources();
    process.exit(0);
  }

  const appMap = buildAppMap(YEAR);
  console.log(`Comparison entries : ${officialMap.size}`);
  console.log(`App entries        : ${appMap.size}\n`);

  const allKeys      = new Set([...officialMap.keys(), ...appMap.keys()]);
  const matched:     string[] = [];
  const missing:     string[] = [];
  const appOnly:     string[] = [];
  const manualCheck: string[] = [];

  for (const key of allKeys) {
    const [dateStr, name] = key.split('|');

    if ([...MANUAL_VERIFY].some(m => normName(m) === name)) {
      const states = appMap.get(key) ? [...appMap.get(key)!].join(',') : 'not in app';
      manualCheck.push(`  ${dateStr}  ${name}  [${states}]`);
      continue;
    }

    const inOfficial = officialMap.has(key);
    const inApp      = appMap.has(key);

    if (inOfficial && inApp) {
      const offStates = [...officialMap.get(key)!].sort().join(',');
      const appStates = [...appMap.get(key)!].sort().join(',');
      const stateNote = offStates !== appStates
        ? `  ⚠ states: comparison=[${offStates}] app=[${appStates}]` : '';
      matched.push(`  ✅  ${dateStr}  ${name}${stateNote}`);
    } else if (!inOfficial && inApp) {
      appOnly.push(`  ⚠️   ${dateStr}  ${name}  [app:${[...appMap.get(key)!].sort().join(',')}]`);
    } else {
      missing.push(`  ❌  ${dateStr}  ${name}  [comparison:${[...officialMap.get(key)!].sort().join(',')}]`);
    }
  }

  [matched, missing, appOnly, manualCheck].forEach(a => a.sort((x, y) => x.localeCompare(y)));

  console.log(`MATCHED (${matched.length})`);
  matched.forEach(l => console.log(l));

  if (missing.length > 0) {
    console.log(`\n❌ MISSING FROM APP (${missing.length}) — comparison source has these, app does not:`);
    missing.forEach(l => console.log(l));
    console.log('  → Update services/australiaHolidayService.ts');
    console.log(`  → Cross-check at: ${FAIRWORK_URL}/${YEAR}-public-holidays`);
  }

  if (appOnly.length > 0) {
    console.log(`\n⚠️  APP-ONLY (${appOnly.length}) — app has these, comparison source does not:`);
    appOnly.forEach(l => console.log(l));
    console.log('  → australia.com is a tourist guide and may omit some sub-state/restricted holidays.');
    console.log(`  → Verify individually at: ${FAIRWORK_URL}/${YEAR}-public-holidays`);
  }

  if (manualCheck.length > 0) {
    console.log(`\n🔍 MANUAL CHECK REQUIRED (${manualCheck.length}) — not tracked by australia.com:`);
    manualCheck.forEach(l => console.log(l));
    console.log('  → Verify dates annually:');
    console.log('      VIC AFL Grand Final   : https://www.afl.com.au');
    console.log('      SA Royal Adelaide Show: https://www.theshow.com.au');
    console.log('      QLD Royal QLD Show    : https://www.ekka.com.au');
    console.log('      NT Show Days          : https://nt.gov.au/employ/rights-at-work/leave/public-holidays');
    console.log('      TAS Show Days         : https://worksafe.tas.gov.au/topics/laws-and-regulations/public-holidays');
    console.log('      NT/SA/QLD Christmas Eve & New Year\'s Eve:');
    console.log(`                              ${FAIRWORK_URL}/${YEAR}-public-holidays`);
  }

  printSchoolSources();

  if (missing.length > 0) {
    console.log(`\n🔴 RESULT: ${missing.length} holiday(s) missing from app — action required.\n`);
    process.exit(1);
  } else {
    console.log(`\n🟢 RESULT: All standard public holidays matched — no action needed.\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.log('\n💥 Script error:', err);
  process.exit(1);
});
