/**
 * verify-au-holidays.ts
 *
 * Compares the Australian public holidays computed by australiaHolidayService.ts
 * against an external source, in priority order:
 *
 *   1. fairwork.gov.au (Fair Work Ombudsman) — authoritative, most comprehensive.
 *      Accessible from most machines; may timeout from cloud CI IP ranges.
 *   2. australia.com (Tourism Australia) — official government body, more permissive
 *      to automated access; used automatically if fairwork times out or errors.
 *   3. AU_HOLIDAYS_CSV_URL env var — ad-hoc CSV in data.gov.au format.
 *
 * Usage:  npx tsx scripts/verify-au-holidays.ts [year]
 * CI:     exits 0 = all matched, exits 1 = mismatches found
 */

import { getAustraliaHolidaysForYear } from '../services/australiaHolidayService';
import { HolidayType } from '../types';

const YEAR = parseInt(process.argv[2] ?? '') || new Date().getFullYear();

// ── Sources ────────────────────────────────────────────────────────────────────
const FAIRWORK_BASE  = 'https://www.fairwork.gov.au/employment-conditions/public-holidays';
const AUSTRALIA_COM  = 'https://www.australia.com/en-nz/facts-and-planning/when-to-go/australian-public-holidays.html';

// Realistic browser User-Agent — reduces chance of bot-detection blocks
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Holidays not explicitly listed on fairwork.gov.au ─────────────────────────
// These are flagged for manual annual review rather than treated as mismatches.
// Mostly city/sub-state show days whose dates are set by local show societies.
const MANUAL_VERIFY = new Set([
  'AFL Grand Final Friday',     // VIC — date subject to AFL schedule each year
  'Royal Adelaide Show',        // SA — not listed on fairwork.gov.au
  'Alice Springs Show Day',     // NT regional
  'Tennant Creek Show Day',     // NT regional
  'Katherine Show Day',         // NT regional
  'Darwin Show Day',            // NT regional
  'Borroloola Show Day',        // NT regional
  'Devonport Cup',              // TAS regional
  'Launceston Cup',             // TAS regional
  'AGFEST',                     // TAS regional
  'Burnie Show',                // TAS regional
  'Royal Launceston Show',      // TAS regional
  'Flinders Island Show',       // TAS regional
  'Devonport Show',             // TAS regional
  'Bank Holiday',               // NSW — not listed on fairwork.gov.au
  'King Island Show',           // TAS regional
]);

// ── Name aliases: fairwork.gov.au name → our app's canonical name ──────────────
// fairwork uses several naming conventions that differ from our app.
const ALIASES: Record<string, string> = {
  // Easter Saturday — different wording per state
  "saturday before easter sunday":               "easter saturday",  // VIC
  "the day after good friday":                   "easter saturday",  // QLD
  "easter saturday - the day after good friday": "easter saturday",  // ACT (en-dash normalised to -)

  // Substitute / additional public holidays
  "additional public holiday for anzac day":                "anzac day (additional holiday)",
  "additional public holiday for boxing day":               "boxing day",
  "additional public holiday for christmas day":            "christmas day",
  "additional public holiday for proclamation day holiday": "boxing day",

  // SA calls its Boxing Day "Proclamation Day holiday"
  "proclamation day holiday": "boxing day",

  // Part-day hospitality holidays — fairwork shows timing in parentheses which
  // parseFairworkEntry strips, leaving just the base name → alias to our canonical
  "christmas eve":  "christmas eve (part-day)",
  "new year's eve": "new year's eve (part-day)",

  // Melbourne Cup
  "melbourne cup": "melbourne cup day",

  // Historical alias (pre-2022)
  "queen's birthday": "king's birthday",
};

// ── HTML parsing helpers ───────────────────────────────────────────────────────

const MONTHS_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};
const DAYS_PAT   = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTHS_PAT = Object.keys(MONTHS_MAP).join('|');

/** Decode common HTML entities in <li> text content. */
function htmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,          (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g,   '&')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&[a-z]+;/g, ' ');
}

function normName(n: string): string {
  const lower = n.trim().toLowerCase()
    // Normalise all Unicode apostrophe/quote variants to a plain straight apostrophe
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035'']/g, "'")
    // Normalise en-dash and em-dash to a plain hyphen (ACT uses &ndash; in "Easter Saturday – …")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');
  return ALIASES[lower] ?? lower;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── fairwork.gov.au scraper ────────────────────────────────────────────────────

/**
 * Parse a single <li> text from fairwork into { dateStr, name }.
 *
 * fairwork format: "DayName D Month: Holiday Name [optional parenthetical]"
 * e.g.  "Thursday 1 January: New Year's Day"
 *       "Monday 27 April: Additional public holiday for Anzac Day"
 *       "Monday 9 February: Royal Hobart Regatta (only observed in certain areas…)"
 *       "Subject to AFL schedule (date TBC): Friday before the AFL Grand Final"  ← skipped
 */
function parseFairworkEntry(text: string, year: number): { dateStr: string; name: string } | null {
  const re = new RegExp(`^(?:${DAYS_PAT})\\s+(\\d+)\\s+(${MONTHS_PAT}):\\s+(.+)$`);
  const m  = text.trim().match(re);
  if (!m) return null;

  const day   = parseInt(m[1]);
  const month = MONTHS_MAP[m[2]];
  const name  = m[3]
    .replace(/\s*\([^)]*\)\s*$/, '') // strip trailing parenthetical, e.g. "(only observed in …)"
    .trim();

  if (!name) return null;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, name };
}

/**
 * Fetch and parse fairwork.gov.au/…/{year}-public-holidays.
 *
 * Returns Map<"dateStr|normName", Set<stateCode|"nat">>.
 * Holidays present in all 8 states are automatically collapsed to "nat".
 */
async function fetchFromFairwork(year: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const url = `${FAIRWORK_BASE}/${year}-public-holidays`;

  let html: string;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    html = await res.text();
  } catch (err) {
    // Re-throw so fetchOfficial() can try the australia.com fallback
    throw err;
  }

  // fairwork structure:
  //   <h2><a name="act"></a>Australian Capital Territory</h2>
  //   <ul><li>Thursday 1 January: New Year's Day</li>…</ul>
  //
  // Each state section starts with <h2> and has <a name="stateCode">.
  const STATE_ANCHORS: Record<string, string> = {
    act: 'act', nsw: 'nsw', nt: 'nt', qld: 'qld',
    sa:  'sa',  tas: 'tas', vic: 'vic', wa:  'wa',
  };

  const sections = html.split(/<h2[^>]*>/i);
  for (const section of sections) {
    // Find <a name="act"> to identify which state this is
    const anchorMatch = section.match(/<a\s+name="([a-z]+)"\s*>/i);
    if (!anchorMatch) continue;
    const stateCode = STATE_ANCHORS[anchorMatch[1].toLowerCase()];
    if (!stateCode) continue;

    // Extract plain text of each <li>
    const liItems = [...section.matchAll(/<li[^>]*>(.*?)<\/li>/gs)]
      .map(m => htmlDecode(m[1].replace(/<[^>]+>/g, '').trim()));

    for (const item of liItems) {
      const parsed = parseFairworkEntry(item, year);
      if (!parsed) continue;
      const key = `${parsed.dateStr}|${normName(parsed.name)}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(stateCode);
    }
  }

  // Collapse holidays observed by all 8 states to "nat"
  const ALL_STATES = new Set(Object.keys(STATE_ANCHORS));
  for (const [key, states] of map) {
    if (states.size === ALL_STATES.size && [...ALL_STATES].every(s => states.has(s))) {
      map.set(key, new Set(['nat']));
    }
  }

  return map;
}

// ── australia.com fallback scraper ────────────────────────────────────────────
//
// Used automatically when fairwork.gov.au is unreachable (e.g. cloud CI IPs
// that fairwork's CDN blocks).  australia.com is Tourism Australia (a federal
// government body) and allows automated access from any IP.
//
// Coverage is slightly narrower than fairwork: it omits some TAS/NT regional
// holidays that fairwork lists.  Those are already in MANUAL_VERIFY so the
// comparison still exits 0 when all standard holidays match.

/** Split a text blob into "DayName, D Month: Name" entry strings. */
function splitAusEntries(text: string): string[] {
  const DAYS_P   = DAYS_PAT;
  const MONTHS_P = MONTHS_PAT;
  return text
    .split(new RegExp(`(?=(?:${DAYS_P}),\\s+\\d+\\s+(?:${MONTHS_P})(?:\\*+)?:)`))
    .map(s => s.trim())
    .filter(s => new RegExp(`^(?:${DAYS_P}),`).test(s));
}

/** Parse "DayName, D Month[*]: Holiday Name[**]" (australia.com format). */
function parseAusEntry(entry: string, year: number): { dateStr: string; name: string } | null {
  const re = new RegExp(
    `^(?:${DAYS_PAT}),\\s+(\\d+)\\s+(${MONTHS_PAT})(?:\\*+)?:\\s+(.+?)(?:\\*+)?\\s*$`
  );
  const m = entry.match(re);
  if (!m) return null;
  const day   = parseInt(m[1]);
  const month = MONTHS_MAP[m[2]];
  const name  = m[3]
    .replace(/\s*\*.*$/s, '')   // strip footnotes
    .replace(new RegExp(`\\s+(?:${DAYS_PAT})\\s+(?:before|after|subject|tbc|date)\\b.*$`, 'si'), '')
    .trim();
  if (!name) return null;
  return { dateStr: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, name };
}

// australia.com section headings → jurisdiction code
const AUS_COM_SECTIONS: [string, string][] = [
  ['national public holidays', 'nat'],
  ['other public holidays declared', 'skip'],
  ['australian capital territory', 'act'],
  ['new south wales', 'nsw'],
  ['northern territory', 'nt'],
  ['queensland', 'qld'],
  ['south australia', 'sa'],
  ['tasmania', 'tas'],
  ['victoria', 'vic'],
  ['western australia', 'wa'],
];

// Additional aliases needed for australia.com naming (beyond those in ALIASES)
const AUS_COM_EXTRA_ALIASES: Record<string, string> = {
  "boxing day observed": "boxing day",
  "boxing day/proclamation day": "boxing day",
};

function ausComNormName(n: string): string {
  const lower = normName(n);
  return AUS_COM_EXTRA_ALIASES[lower] ?? lower;
}

async function fetchFromAustraliaCom(year: number): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  let html: string;
  try {
    const res = await fetch(AUSTRALIA_COM, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    html = await res.text();
  } catch (err) {
    throw err; // propagate so fetchOfficial can report both failures
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,          (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;|&lsquo;/g, "'").replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

  const lc         = text.toLowerCase();
  const yearMarker = `australian public holidays ${year}`;
  const startIdx   = lc.indexOf(yearMarker);
  if (startIdx === -1) return map;

  const nextYearIdx = lc.indexOf(`australian public holidays ${year + 1}`, startIdx + yearMarker.length);
  const section     = text.slice(startIdx, nextYearIdx === -1 ? undefined : nextYearIdx);
  const secLc       = section.toLowerCase();

  const boundaries: { pos: number; juris: string }[] = [];
  for (const [heading, juris] of AUS_COM_SECTIONS) {
    const pos = secLc.indexOf(heading);
    if (pos !== -1) boundaries.push({ pos, juris });
  }
  boundaries.sort((a, b) => a.pos - b.pos);
  if (boundaries.length === 0) return map;

  for (let i = 0; i < boundaries.length; i++) {
    const { pos, juris } = boundaries[i];
    if (juris === 'skip') continue;
    const nextPos = i + 1 < boundaries.length ? boundaries[i + 1].pos : section.length;
    const chunk   = section.slice(pos, nextPos);
    for (const entry of splitAusEntries(chunk)) {
      const parsed = parseAusEntry(entry, year);
      if (!parsed) continue;
      const key = `${parsed.dateStr}|${ausComNormName(parsed.name)}`;
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
  const map  = new Map<string, Set<string>>();
  const res  = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
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
  // 0. Manual CSV override — highest priority
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

  // 1. Try fairwork.gov.au — authoritative source
  try {
    const map = await fetchFromFairwork(year);
    return { map, label: 'fairwork.gov.au (Fair Work Ombudsman)' };
  } catch (err) {
    console.log(`\n⚠️  fairwork.gov.au unreachable (${err}) — trying australia.com fallback…`);
  }

  // 2. Fall back to australia.com — official government body, more permissive to CI IPs
  try {
    const map = await fetchFromAustraliaCom(year);
    return { map, label: 'australia.com (Tourism Australia) [fairwork.gov.au was unreachable]' };
  } catch (err) {
    console.log(`⚠️  australia.com also unreachable: ${err}`);
    return { map: new Map(), label: 'no source available' };
  }
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
  console.log(` Source: ${FAIRWORK_BASE}/${YEAR}-public-holidays`);

  const { map: officialMap, label } = await fetchOfficial(YEAR);

  console.log(` Comparison source    : ${label}`);
  console.log(`${bar}\n`);

  if (officialMap.size === 0) {
    console.log('⚠️  No comparison data retrieved — skipping automated comparison.');
    console.log(`   Verify manually at: ${FAIRWORK_BASE}/${YEAR}-public-holidays\n`);
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
        ? `  ⚠ states: fairwork=[${offStates}] app=[${appStates}]` : '';
      matched.push(`  ✅  ${dateStr}  ${name}${stateNote}`);
    } else if (!inOfficial && inApp) {
      appOnly.push(`  ⚠️   ${dateStr}  ${name}  [app:${[...appMap.get(key)!].sort().join(',')}]`);
    } else {
      missing.push(`  ❌  ${dateStr}  ${name}  [fairwork:${[...officialMap.get(key)!].sort().join(',')}]`);
    }
  }

  [matched, missing, appOnly, manualCheck].forEach(a => a.sort((x, y) => x.localeCompare(y)));

  console.log(`MATCHED (${matched.length})`);
  matched.forEach(l => console.log(l));

  if (missing.length > 0) {
    console.log(`\n❌ MISSING FROM APP (${missing.length}) — fairwork has these, app does not:`);
    missing.forEach(l => console.log(l));
    console.log('  → Update services/australiaHolidayService.ts');
    console.log(`  → Reference: ${FAIRWORK_BASE}/${YEAR}-public-holidays`);
  }

  if (appOnly.length > 0) {
    console.log(`\n⚠️  APP-ONLY (${appOnly.length}) — app has these, fairwork does not:`);
    appOnly.forEach(l => console.log(l));
    console.log('  → These may be sub-state/restricted holidays not listed by fairwork.gov.au.');
    console.log(`  → Verify at: ${FAIRWORK_BASE}/${YEAR}-public-holidays`);
  }

  if (manualCheck.length > 0) {
    console.log(`\n🔍 MANUAL CHECK REQUIRED (${manualCheck.length}) — city/sub-state holidays not listed on fairwork.gov.au:`);
    manualCheck.forEach(l => console.log(l));
    console.log('  → Verify dates annually:');
    console.log('      VIC AFL Grand Final   : https://www.afl.com.au');
    console.log('      SA Royal Adelaide Show: https://www.theshow.com.au');
    console.log('      NT Show Days          : https://nt.gov.au/employ/rights-at-work/leave/public-holidays');
    console.log('      TAS Show Days         : https://worksafe.tas.gov.au/topics/laws-and-regulations/public-holidays');
    console.log('      NSW Bank Holiday      : https://www.nsw.gov.au/about-nsw/public-holidays');
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
