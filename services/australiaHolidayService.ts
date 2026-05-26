import { Holiday, HolidayType, StateId } from '../types';

// ─── Helpers (mirrors NZ service) ─────────────────────────────────────────────

const addDays = (date: Date, days: number): Date => {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
};

const getEasterSunday = (year: number): Date => {
  const f = Math.floor,
    G = year % 19, C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
};

/** AU mondayisation: Saturday/Sunday → following Monday (same as NZ). */
const mondayise = (date: Date): Date => {
  const d = date.getDay();
  if (d === 6) return addDays(date, 2);
  if (d === 0) return addDays(date, 1);
  return date;
};

const getNthDayOfMonth = (year: number, month: number, dayOfWeek: number, n: number): Date => {
  const date = new Date(year, month, 1);
  const add = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(1 + add + (n - 1) * 7);
  return date;
};

/** Monday on or after a given date (used for ACT Reconciliation Day). */
const mondayOnOrAfter = (date: Date): Date => {
  const d = date.getDay();
  return d === 1 ? date : addDays(date, (8 - d) % 7);
};

// ─── State name map ────────────────────────────────────────────────────────────

export const STATE_NAMES: Record<StateId, string> = {
  [StateId.ACT]: 'Australian Capital Territory',
  [StateId.NSW]: 'New South Wales',
  [StateId.NT]:  'Northern Territory',
  [StateId.QLD]: 'Queensland',
  [StateId.SA]:  'South Australia',
  [StateId.TAS]: 'Tasmania',
  [StateId.VIC]: 'Victoria',
  [StateId.WA]:  'Western Australia',
};

export const getStateName = (id: StateId): string => STATE_NAMES[id] ?? id.toUpperCase();

// ─── Exact 2026 school holiday dates (source: worldstrides.com.au / state depts) ─

interface StateTerm { t1s: string; t1e: string; t2s: string; t2e: string; t3s: string; t3e: string; t4s: string; t4e: string; }

const AU_SCHOOL_2026: Record<StateId, StateTerm> = {
  [StateId.ACT]: { t1s: '2026-04-03', t1e: '2026-04-20', t2s: '2026-07-04', t2e: '2026-07-20', t3s: '2026-09-26', t3e: '2026-10-12', t4s: '2026-12-19', t4e: '2026-12-31' },
  [StateId.NSW]: { t1s: '2026-04-03', t1e: '2026-04-19', t2s: '2026-07-04', t2e: '2026-07-19', t3s: '2026-09-26', t3e: '2026-10-11', t4s: '2026-12-18', t4e: '2026-12-31' },
  [StateId.NT]:  { t1s: '2026-04-03', t1e: '2026-04-12', t2s: '2026-06-20', t2e: '2026-07-13', t3s: '2026-09-19', t3e: '2026-10-04', t4s: '2026-12-12', t4e: '2026-12-31' },
  [StateId.QLD]: { t1s: '2026-04-03', t1e: '2026-04-19', t2s: '2026-06-27', t2e: '2026-07-12', t3s: '2026-09-19', t3e: '2026-10-05', t4s: '2026-12-12', t4e: '2026-12-31' },
  [StateId.SA]:  { t1s: '2026-04-11', t1e: '2026-04-26', t2s: '2026-07-04', t2e: '2026-07-19', t3s: '2026-09-26', t3e: '2026-10-11', t4s: '2026-12-12', t4e: '2026-12-31' },
  [StateId.TAS]: { t1s: '2026-04-18', t1e: '2026-05-03', t2s: '2026-07-11', t2e: '2026-07-26', t3s: '2026-10-03', t3e: '2026-10-18', t4s: '2026-12-19', t4e: '2026-12-31' },
  [StateId.VIC]: { t1s: '2026-04-03', t1e: '2026-04-19', t2s: '2026-06-27', t2e: '2026-07-12', t3s: '2026-09-19', t3e: '2026-10-05', t4s: '2026-12-20', t4e: '2026-12-31' },
  [StateId.WA]:  { t1s: '2026-04-02', t1e: '2026-04-19', t2s: '2026-07-04', t2e: '2026-07-19', t3s: '2026-09-26', t3e: '2026-10-11', t4s: '2026-12-18', t4e: '2026-12-31' },
};

// ─── Main export ───────────────────────────────────────────────────────────────

export const getAustraliaHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];
  const easter = getEasterSunday(year);

  // ── National Public Holidays ──────────────────────────────────────────────

  // New Year's Day
  const ny1Raw = new Date(year, 0, 1);
  holidays.push({
    id: `au-ny1-${year}`, name: "New Year's Day",
    date: mondayise(ny1Raw), originalDate: ny1Raw, type: HolidayType.Public,
    description: "The first day of the new calendar year, observed nationally across all Australian states and territories.",
  });

  // Australia Day — 26 January (mondayised if Sat/Sun)
  const auDayRaw = new Date(year, 0, 26);
  holidays.push({
    id: `au-auday-${year}`, name: "Australia Day",
    date: mondayise(auDayRaw), originalDate: auDayRaw, type: HolidayType.Public,
    description: "Australia's national day, marking the arrival of the First Fleet at Port Jackson on 26 January 1788. It is a day of national celebration and also a time of reflection for First Nations peoples, who often call it Invasion Day or Survival Day.",
  });

  // Good Friday
  holidays.push({
    id: `au-goodfri-${year}`, name: "Good Friday",
    date: addDays(easter, -2), type: HolidayType.Public,
    description: "Christian observance commemorating the crucifixion of Jesus Christ. One of the most restricted trading days in Australia, with most businesses closed.",
  });

  // Easter Saturday
  holidays.push({
    id: `au-eastersat-${year}`, name: "Easter Saturday",
    date: addDays(easter, -1), type: HolidayType.Public,
    description: "The day between Good Friday and Easter Sunday. Observed as a public holiday in most Australian states and territories.",
  });

  // Easter Sunday
  holidays.push({
    id: `au-eastersun-${year}`, name: "Easter Sunday",
    date: easter, type: HolidayType.Public,
    description: "Christian celebration of the resurrection of Jesus Christ. Observed as a public holiday in ACT and NSW.",
  });

  // Easter Monday
  holidays.push({
    id: `au-eastermon-${year}`, name: "Easter Monday",
    date: addDays(easter, 1), type: HolidayType.Public,
    description: "The day after Easter Sunday, marking the end of the Easter long weekend. Observed nationally.",
  });

  // ANZAC Day — 25 April (observed on the actual date; no national substitute for weekends)
  holidays.push({
    id: `au-anzac-${year}`, name: "ANZAC Day",
    date: new Date(year, 3, 25), type: HolidayType.Public,
    description: "Australia's most solemn national day, honouring those who served and died in wars. Named after the Australian and New Zealand Army Corps (ANZAC) who landed at Gallipoli on 25 April 1915. Dawn services are held nationally. ANZAC Day is observed on 25 April regardless of the day of the week.",
  });

  // Christmas Day (mondayised if Sat/Sun)
  const xmasRaw = new Date(year, 11, 25);
  holidays.push({
    id: `au-xmas-${year}`, name: "Christmas Day",
    date: mondayise(xmasRaw), originalDate: xmasRaw, type: HolidayType.Public,
    description: "Christian celebration of the birth of Jesus Christ. A major national holiday when businesses close and families gather.",
  });

  // Boxing Day — 26 December (mondayised, avoid clash with Christmas)
  const boxingRaw = new Date(year, 11, 26);
  const xmasObs = mondayise(xmasRaw);
  let boxingObs = mondayise(boxingRaw);
  if (boxingObs.getTime() === xmasObs.getTime()) boxingObs = addDays(boxingObs, 1);
  holidays.push({
    id: `au-boxing-${year}`, name: "Boxing Day",
    date: boxingObs, originalDate: boxingRaw, type: HolidayType.Public,
    description: "The day after Christmas, known as Proclamation Day in South Australia. Traditionally a day for giving to those less fortunate; now a popular day for summer sport and retail sales.",
  });

  // ── State-specific Public Holidays ────────────────────────────────────────
  // Formula: 2nd Monday in March (used by VIC, TAS, SA, ACT, NT, WA in different months)
  const secondMonMar = getNthDayOfMonth(year, 2, 1, 2); // 2nd Mon March
  const firstMonMar  = getNthDayOfMonth(year, 2, 1, 1); // 1st Mon March
  const firstMonMay  = getNthDayOfMonth(year, 4, 1, 1); // 1st Mon May
  const firstMonJun  = getNthDayOfMonth(year, 5, 1, 1); // 1st Mon June
  const secondMonJun = getNthDayOfMonth(year, 5, 1, 2); // 2nd Mon June
  const firstMonAug  = getNthDayOfMonth(year, 7, 1, 1); // 1st Mon August
  const firstMonOct  = getNthDayOfMonth(year, 9, 1, 1); // 1st Mon October
  const fourthMonSep = getNthDayOfMonth(year, 8, 1, 4); // 4th Mon September (WA KB)
  const firstTueNov  = getNthDayOfMonth(year, 10, 2, 1); // 1st Tue November (Melb Cup)
  const reconDay     = mondayOnOrAfter(new Date(year, 4, 27)); // ACT: Mon on/after 27 May

  // ACT
  holidays.push({ id: `au-act-canberra-${year}`, name: "Canberra Day", date: secondMonMar, type: HolidayType.Regional, stateIds: [StateId.ACT], description: "Celebrates the founding of Australia's capital city, Canberra, established as the national capital on 12 March 1913. Observed on the second Monday in March." });
  holidays.push({ id: `au-act-reconciliation-${year}`, name: "Reconciliation Day", date: reconDay, type: HolidayType.Regional, stateIds: [StateId.ACT], description: "Observed on the Monday on or after 27 May (National Sorry Day), marking a commitment to reconciliation between Aboriginal and Torres Strait Islander peoples and non-Indigenous Australians. ACT was the first jurisdiction to establish this as a public holiday (2018)." });
  holidays.push({ id: `au-act-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.ACT], description: "Celebrates the official birthday of King Charles III. Observed on the second Monday in June in ACT, NSW, SA, TAS, and VIC." });
  holidays.push({ id: `au-act-labour-${year}`, name: "Labour Day", date: firstMonOct, type: HolidayType.Regional, stateIds: [StateId.ACT], description: "Commemorates the eight-hour working day movement. Observed on the first Monday in October in ACT, NSW, and SA." });

  // NSW
  holidays.push({ id: `au-nsw-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.NSW], description: "Celebrates the official birthday of King Charles III. Observed on the second Monday in June." });
  holidays.push({ id: `au-nsw-labour-${year}`, name: "Labour Day", date: firstMonOct, type: HolidayType.Regional, stateIds: [StateId.NSW], description: "Commemorates the workers' rights movement and the eight-hour working day. Observed on the first Monday in October." });
  holidays.push({ id: `au-nsw-bank-${year}`, name: "Bank Holiday", date: firstMonAug, type: HolidayType.Regional, stateIds: [StateId.NSW], description: "A bank and public service holiday observed on the first Monday in August in New South Wales. Most banks and some businesses close." });

  // NT
  holidays.push({ id: `au-nt-labour-${year}`, name: "Labour Day", date: firstMonMay, type: HolidayType.Regional, stateIds: [StateId.NT], description: "Commemorates the workers' rights movement. Observed on the first Monday in May in Queensland and the Northern Territory." });
  holidays.push({ id: `au-nt-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.NT], description: "Celebrates the official birthday of King Charles III. Observed on the second Monday in June." });
  holidays.push({ id: `au-nt-picnic-${year}`, name: "Picnic Day", date: firstMonAug, type: HolidayType.Regional, stateIds: [StateId.NT], description: "A uniquely Northern Territory holiday, celebrated on the first Monday in August. Historically a day for community picnics and outdoor events, now a general public holiday." });
  // NT Show Days (local to specific towns — 2026 exact dates)
  if (year === 2026) {
    holidays.push({ id: `au-nt-alice-show-2026`, name: "Alice Springs Show Day", date: new Date(2026, 6, 3), type: HolidayType.Regional, stateIds: [StateId.NT], description: "The Alice Springs Show Day is a local public holiday for the Alice Springs area, held annually for the Alice Springs Royal Show." });
    holidays.push({ id: `au-nt-tennant-show-2026`, name: "Tennant Creek Show Day", date: new Date(2026, 6, 10), type: HolidayType.Regional, stateIds: [StateId.NT], description: "Local public holiday for the Tennant Creek area for the annual agricultural show." });
    holidays.push({ id: `au-nt-katherine-show-2026`, name: "Katherine Show Day", date: new Date(2026, 6, 17), type: HolidayType.Regional, stateIds: [StateId.NT], description: "Local public holiday for the Katherine area for the Katherine Show." });
    holidays.push({ id: `au-nt-darwin-show-2026`, name: "Darwin Show Day", date: new Date(2026, 6, 24), type: HolidayType.Regional, stateIds: [StateId.NT], description: "Local public holiday for the Darwin area for the Darwin Show, one of the largest annual events in the NT." });
    holidays.push({ id: `au-nt-borroloola-show-2026`, name: "Borroloola Show Day", date: new Date(2026, 7, 21), type: HolidayType.Regional, stateIds: [StateId.NT], description: "Local public holiday for the Borroloola area." });
  }

  // QLD
  holidays.push({ id: `au-qld-labour-${year}`, name: "Labour Day", date: firstMonMay, type: HolidayType.Regional, stateIds: [StateId.QLD], description: "Commemorates the workers' rights movement. Observed on the first Monday in May in Queensland and the Northern Territory." });
  // Royal Queensland Show (Brisbane only) — 2026 exact; approximate for other years
  const brisbaneShow = year === 2026 ? new Date(2026, 7, 12) : getNthDayOfMonth(year, 7, 3, 2); // approx 2nd Wed Aug
  holidays.push({ id: `au-qld-ekka-${year}`, name: "Royal Queensland Show", date: brisbaneShow, type: HolidayType.Regional, stateIds: [StateId.QLD], description: "Popularly known as the 'Ekka', the Royal Queensland Show is Brisbane's largest annual event (an agricultural and amusements show). The show day is a public holiday for Brisbane and surrounding areas only." });
  holidays.push({ id: `au-qld-kingsbd-${year}`, name: "King's Birthday", date: firstMonOct, type: HolidayType.Regional, stateIds: [StateId.QLD], description: "Queensland observes the King's Birthday on the first Monday in October — later than most states, which observe it in June." });

  // SA
  holidays.push({ id: `au-sa-adelaidecup-${year}`, name: "Adelaide Cup Day", date: secondMonMar, type: HolidayType.Regional, stateIds: [StateId.SA], description: "Originally marking the Adelaide Cup horse race, this South Australian public holiday is now held on the second Monday in March. The Cup itself moved to a different date but the holiday remains." });
  holidays.push({ id: `au-sa-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.SA], description: "Celebrates the official birthday of King Charles III. Observed on the second Monday in June." });
  holidays.push({ id: `au-sa-labour-${year}`, name: "Labour Day", date: firstMonOct, type: HolidayType.Regional, stateIds: [StateId.SA], description: "Commemorates the workers' rights movement. Observed on the first Monday in October." });

  // TAS
  holidays.push({ id: `au-tas-eighthrs-${year}`, name: "Eight Hours Day", date: secondMonMar, type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Tasmania's Labour Day equivalent, commemorating the successful campaign for the 8-hour working day. Tasmanian stonemasons were among the first workers in the world to win the 8-hour day (1856)." });
  holidays.push({ id: `au-tas-eastertue-${year}`, name: "Easter Tuesday", date: addDays(easter, 2), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "A Tasmania-specific public holiday observed on the Tuesday after Easter Sunday, extending the Easter break to five days. It is unique to the Tasmanian public service and some industries." });
  holidays.push({ id: `au-tas-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Celebrates the official birthday of King Charles III. Tasmania observes King's Birthday on the second Monday in June, alongside ACT, NSW, SA, and VIC." });
  holidays.push({ id: `au-tas-melbcup-${year}`, name: "Melbourne Cup Day", date: firstTueNov, type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Tasmania observes Melbourne Cup Day as a public holiday, the same day as Victoria. The Melbourne Cup is run on the first Tuesday in November." });
  holidays.push({ id: `au-tas-recday-${year}`, name: "Recreation Day", date: getNthDayOfMonth(year, 10, 1, 1), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Observed on the first Monday in November in northern Tasmania only (Hobart observes the Royal Hobart Show holiday instead). It's a general recreation and leisure day." });
  // TAS local show days (2026 exact only)
  if (year === 2026) {
    holidays.push({ id: `au-tas-devonportcup-2026`, name: "Devonport Cup", date: new Date(2026, 0, 7), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for the Devonport area for the annual Devonport Cup horse race." });
    holidays.push({ id: `au-tas-hobart-regatta-2026`, name: "Royal Hobart Regatta", date: new Date(2026, 1, 1), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Southern Tasmania public holiday for the Royal Hobart Regatta, the largest aquatic carnival in the Southern Hemisphere." });
    holidays.push({ id: `au-tas-launcestoncup-2026`, name: "Launceston Cup", date: new Date(2026, 1, 25), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for the Launceston area for the annual Launceston Cup horse race." });
    holidays.push({ id: `au-tas-agfest-2026`, name: "AGFEST", date: new Date(2026, 4, 8), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "AGFEST is Tasmania's premier agricultural and agribusiness field day. The associated public holiday applies to parts of northern Tasmania." });
    holidays.push({ id: `au-tas-burniesshow-2026`, name: "Burnie Show", date: new Date(2026, 9, 2), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for the Burnie area for the annual agricultural show." });
    holidays.push({ id: `au-tas-launceston-show-2026`, name: "Royal Launceston Show", date: new Date(2026, 9, 8), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for the Launceston area for the Royal Launceston Show." });
    holidays.push({ id: `au-tas-flinders-show-2026`, name: "Flinders Island Show", date: new Date(2026, 9, 16), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for Flinders Island for the annual agricultural show." });
    holidays.push({ id: `au-tas-hobart-show-2026`, name: "Royal Hobart Show", date: new Date(2026, 9, 22), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Public holiday for the greater Hobart area for the Royal Hobart Show, the premier agricultural show in southern Tasmania." });
    holidays.push({ id: `au-tas-devonport-show-2026`, name: "Devonport Show", date: new Date(2026, 10, 27), type: HolidayType.Regional, stateIds: [StateId.TAS], description: "Local holiday for the Devonport area for the annual agricultural show." });
  }

  // VIC
  holidays.push({ id: `au-vic-labour-${year}`, name: "Labour Day", date: secondMonMar, type: HolidayType.Regional, stateIds: [StateId.VIC], description: "Commemorates the fight for the eight-hour working day. The eight-hour day movement started in Melbourne in 1856, making Victoria the birthplace of the 40-hour work week." });
  holidays.push({ id: `au-vic-kingsbd-${year}`, name: "King's Birthday", date: secondMonJun, type: HolidayType.Regional, stateIds: [StateId.VIC], description: "Celebrates the official birthday of King Charles III. Observed on the second Monday in June in Victoria." });
  holidays.push({ id: `au-vic-melbcup-${year}`, name: "Melbourne Cup Day", date: firstTueNov, type: HolidayType.Regional, stateIds: [StateId.VIC], description: "The Melbourne Cup — 'the race that stops a nation' — is run on the first Tuesday in November. The day is a public holiday for metropolitan Melbourne and some regional areas in Victoria." });

  // WA
  holidays.push({ id: `au-wa-labour-${year}`, name: "Labour Day", date: firstMonMar, type: HolidayType.Regional, stateIds: [StateId.WA], description: "Commemorates the workers' rights movement. Western Australia observes Labour Day on the first Monday in March." });
  holidays.push({ id: `au-wa-waday-${year}`, name: "Western Australia Day", date: firstMonJun, type: HolidayType.Regional, stateIds: [StateId.WA], description: "Celebrates the establishment of Western Australia as a British colony on 1 June 1829, when Captain James Stirling proclaimed the Swan River Colony. Observed on the first Monday in June." });
  holidays.push({ id: `au-wa-kingsbd-${year}`, name: "King's Birthday", date: fourthMonSep, type: HolidayType.Regional, stateIds: [StateId.WA], description: "Western Australia observes the King's Birthday on the fourth Monday of September — uniquely later than all other states, which observe it in June." });

  // ── School Holidays ────────────────────────────────────────────────────────
  const allStates = Object.values(StateId);

  if (year === 2026) {
    allStates.forEach(state => {
      const t = AU_SCHOOL_2026[state];
      const sName = getStateName(state);
      const note = `Exact dates sourced from the ${sName} education department for 2026.`;
      holidays.push({ id: `au-t1-${state}-2026`, name: 'School Holidays — Term 1 Break', date: new Date(t.t1s), rangeEnd: new Date(t.t1e), type: HolidayType.School, stateIds: [state], description: `${sName} end-of-Term 1 school holidays. ${note}` });
      holidays.push({ id: `au-t2-${state}-2026`, name: 'School Holidays — Term 2 Break', date: new Date(t.t2s), rangeEnd: new Date(t.t2e), type: HolidayType.School, stateIds: [state], description: `${sName} mid-year school holidays. ${note}` });
      holidays.push({ id: `au-t3-${state}-2026`, name: 'School Holidays — Term 3 Break', date: new Date(t.t3s), rangeEnd: new Date(t.t3e), type: HolidayType.School, stateIds: [state], description: `${sName} end-of-Term 3 school holidays. ${note}` });
      holidays.push({ id: `au-t4-${state}-2026`, name: 'School Holidays — Summer Break', date: new Date(t.t4s), rangeEnd: new Date(t.t4e), type: HolidayType.School, stateIds: [state], description: `${sName} summer school holidays starting mid-December. ${note}` });
    });
  } else {
    // Approximate per-state pattern for non-2026 years
    const goodFri = addDays(easter, -2);
    allStates.forEach(state => {
      const sName = getStateName(state);
      const note = `Approximate dates — verify at the ${sName} education department website.`;
      holidays.push({ id: `au-t1-${state}-${year}`, name: 'School Holidays — Term 1 Break', date: addDays(goodFri, -7), rangeEnd: addDays(goodFri, 6), type: HolidayType.School, stateIds: [state], description: `${sName} approximate Term 1 break (around Easter). ${note}` });
      holidays.push({ id: `au-t2-${state}-${year}`, name: 'School Holidays — Term 2 Break', date: new Date(year, 5, 27), rangeEnd: new Date(year, 6, 12), type: HolidayType.School, stateIds: [state], description: `${sName} approximate mid-year break. ${note}` });
      holidays.push({ id: `au-t3-${state}-${year}`, name: 'School Holidays — Term 3 Break', date: new Date(year, 8, 19), rangeEnd: new Date(year, 9, 4), type: HolidayType.School, stateIds: [state], description: `${sName} approximate Term 3 break. ${note}` });
      holidays.push({ id: `au-t4-${state}-${year}`, name: 'School Holidays — Summer Break', date: new Date(year, 11, 17), rangeEnd: new Date(year, 11, 31), type: HolidayType.School, stateIds: [state], description: `${sName} approximate summer break. ${note}` });
    });
  }

  return holidays;
};
