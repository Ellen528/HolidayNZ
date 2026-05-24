import { Holiday, HolidayType, RegionId } from '../types';

// ─── Date helpers ──────────────────────────────────────────────────────────────

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/** Anonymous Easter algorithm (Gregorian). */
const getEasterSunday = (year: number): Date => {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
};

/** Known/gazetted Matariki public holiday dates (set by Order in Council). */
const getMatariki = (year: number): Date | null => {
  const dates: Record<number, string> = {
    2022: '2022-06-24',
    2023: '2023-07-14',
    2024: '2024-06-28',
    2025: '2025-06-20',
    2026: '2026-07-10',
    2027: '2027-06-25',
    2028: '2028-07-14',
    2029: '2029-07-06',
    2030: '2030-06-21',
  };
  return dates[year] ? new Date(dates[year]) : null;
};

/** Returns the nth occurrence of dayOfWeek (0=Sun…6=Sat) in a given month. */
const getNthDayOfMonth = (year: number, month: number, dayOfWeek: number, n: number): Date => {
  const date = new Date(year, month, 1);
  const add = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(1 + add + (n - 1) * 7);
  return date;
};

/**
 * Mondayisation per NZ Holidays Act 2003 s45A:
 * If the date falls on Saturday → observed the following Monday.
 * If the date falls on Sunday  → observed the following Monday.
 */
const mondayise = (date: Date): Date => {
  const day = date.getDay();
  if (day === 6) return addDays(date, 2); // Saturday → Monday
  if (day === 0) return addDays(date, 1); // Sunday → Monday
  return date;
};

/**
 * "Monday nearest to" rule used for provincial anniversary days
 * (NZ Holidays Act 2003 s44):
 *   Mon  → same day
 *   Tue  → previous Mon  (1 day back)
 *   Wed  → previous Mon  (2 days back)
 *   Thu  → previous Mon  (3 days back)
 *   Fri  → following Mon (3 days forward)
 *   Sat  → following Mon (2 days forward)
 *   Sun  → following Mon (1 day forward)
 */
const nearestMonday = (date: Date): Date => {
  const day = date.getDay();
  if (day === 1) return date;
  const daysBack = day === 0 ? 6 : day - 1;
  const daysForward = day === 0 ? 1 : 8 - day;
  return daysBack <= daysForward ? addDays(date, -daysBack) : addDays(date, daysForward);
};

// ─── Main export ───────────────────────────────────────────────────────────────

export const getHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];

  // ── National Public Holidays ───────────────────────────────────────────────

  // New Year's Day pair — must land on different days
  const ny1Raw = new Date(year, 0, 1);
  const ny2Raw = new Date(year, 0, 2);
  const ny1 = mondayise(ny1Raw);
  let ny2 = mondayise(ny2Raw);
  if (ny2.getTime() === ny1.getTime()) ny2 = addDays(ny2, 1); // push to Tuesday

  holidays.push({
    id: `ny1-${year}`, name: "New Year's Day",
    date: ny1, originalDate: ny1Raw, type: HolidayType.Public,
    description: "The first day of the new calendar year.",
  });
  holidays.push({
    id: `ny2-${year}`, name: "Day after New Year's Day",
    date: ny2, originalDate: ny2Raw, type: HolidayType.Public,
    description: "An additional rest day to extend the New Year celebration, unique to New Zealand.",
  });

  // Waitangi Day — 6 February
  const waitangiRaw = new Date(year, 1, 6);
  holidays.push({
    id: `waitangi-${year}`, name: "Waitangi Day",
    date: mondayise(waitangiRaw), originalDate: waitangiRaw, type: HolidayType.Public,
    description: "New Zealand's national day, commemorating the signing of Te Tiriti o Waitangi (the Treaty of Waitangi) on 6 February 1840 between the British Crown and over 500 Māori rangatira (chiefs).",
  });

  // Easter
  const easterSunday = getEasterSunday(year);
  holidays.push({
    id: `goodfri-${year}`, name: "Good Friday",
    date: addDays(easterSunday, -2), type: HolidayType.Public,
    description: "Christian observance commemorating the crucifixion of Jesus Christ. New Zealand law prohibits most trading on this day.",
  });
  holidays.push({
    id: `eastermon-${year}`, name: "Easter Monday",
    date: addDays(easterSunday, 1), type: HolidayType.Public,
    description: "Celebrates the resurrection of Jesus Christ, observed the day after Easter Sunday.",
  });

  // ANZAC Day — 25 April
  const anzacRaw = new Date(year, 3, 25);
  holidays.push({
    id: `anzac-${year}`, name: "ANZAC Day",
    date: mondayise(anzacRaw), originalDate: anzacRaw, type: HolidayType.Public,
    description: "National day of remembrance for Australians and New Zealanders who served and died in wars. The name commemorates the Australian and New Zealand Army Corps (ANZAC) who landed at Gallipoli on 25 April 1915.",
  });

  // King's Birthday — 1st Monday in June
  holidays.push({
    id: `kings-${year}`, name: "King's Birthday",
    date: getNthDayOfMonth(year, 5, 1, 1), type: HolidayType.Public,
    description: "Celebrates the official birthday of the reigning monarch, King Charles III. The observed date in New Zealand is the first Monday in June.",
  });

  // Matariki — gazetted annually
  const matariki = getMatariki(year);
  if (matariki) {
    holidays.push({
      id: `matariki-${year}`, name: "Matariki",
      date: matariki, type: HolidayType.Public,
      description: "Māori New Year, marked by the first rise of the Matariki star cluster (Pleiades/Kāhui o Matariki). A time of remembrance for those who have passed, gratitude for the present, and celebration for the future. New Zealand was the first country in the world to make Matariki a public holiday (from 2022). The exact date is set annually by Order in Council.",
    });
  }

  // Labour Day — 4th Monday in October
  holidays.push({
    id: `labour-${year}`, name: "Labour Day",
    date: getNthDayOfMonth(year, 9, 1, 4), type: HolidayType.Public,
    description: "Celebrates the campaign for an eight-hour working day. The movement was pioneered in New Zealand in 1840, making it one of the world's first countries to legislate the 8-hour work day.",
  });

  // Christmas / Boxing Day pair — must land on different days
  const xmasRaw = new Date(year, 11, 25);
  const boxingRaw = new Date(year, 11, 26);
  const xmas = mondayise(xmasRaw);
  let boxing = mondayise(boxingRaw);
  if (boxing.getTime() === xmas.getTime()) boxing = addDays(boxing, 1);

  holidays.push({
    id: `xmas-${year}`, name: "Christmas Day",
    date: xmas, originalDate: xmasRaw, type: HolidayType.Public,
    description: "Christian celebration of the birth of Jesus Christ. One of New Zealand's most widely observed public holidays, traditionally a time for family gatherings.",
  });
  holidays.push({
    id: `boxing-${year}`, name: "Boxing Day",
    date: boxing, originalDate: boxingRaw, type: HolidayType.Public,
    description: "The day after Christmas, with origins in the tradition of giving gifts to tradespeople and the less fortunate. Now a popular day for outdoor activities, sport, and summer shopping.",
  });

  // ── Provincial Anniversary Days ────────────────────────────────────────────
  // Dates are governed by the Holidays Act 2003.
  // Rule: "Monday nearest to" the anniversary date, per s44.

  // Wellington — nearest Monday to 22 January
  // Also observed by Manawatū-Whanganui (per MBIE guidance).
  const wellingtonAnchor = new Date(year, 0, 22);
  holidays.push({
    id: `well-ann-${year}`, name: "Wellington Anniversary",
    date: nearestMonday(wellingtonAnchor), originalDate: wellingtonAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.Wellington, RegionId.ManawatuWhanganui],
    description: "Celebrates the anniversary of Wellington Province, founded on 22 January 1840 when the New Zealand Company's first settlers arrived at Port Nicholson (Te Whanganui-a-Tara).",
  });

  // Auckland — nearest Monday to 29 January
  // Northland observes the same day (per MBIE guidance).
  // Note: Waikato, Bay of Plenty, and Gisborne have no official provincial anniversary day.
  const aucklandAnchor = new Date(year, 0, 29);
  holidays.push({
    id: `auck-ann-${year}`, name: "Auckland Anniversary",
    date: nearestMonday(aucklandAnchor), originalDate: aucklandAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.Auckland, RegionId.Northland],
    description: "Marks the founding of Auckland on 29 January 1840 by Governor William Hobson, who declared it the capital of New Zealand. Northland observes the same day. Waikato, Bay of Plenty, and Gisborne have no official provincial anniversary day under the Holidays Act.",
  });

  // Nelson — nearest Monday to 1 February
  // Tasman district observes the same day.
  const nelsonAnchor = new Date(year, 1, 1);
  holidays.push({
    id: `nel-ann-${year}`, name: "Nelson Anniversary",
    date: nearestMonday(nelsonAnchor), originalDate: nelsonAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.Nelson, RegionId.Tasman],
    description: "Celebrates the anniversary of Nelson Province, established on 1 February 1842 when New Zealand Company settlers arrived at Wakatu (Nelson). Tasman district observes the same day.",
  });

  // Taranaki — 2nd Monday in March
  holidays.push({
    id: `tara-ann-${year}`, name: "Taranaki Anniversary",
    date: getNthDayOfMonth(year, 2, 1, 2),
    type: HolidayType.Regional,
    regionIds: [RegionId.Taranaki],
    description: "Celebrates the establishment of Taranaki Province in 1858. It is observed on the second Monday in March — the only provincial anniversary to use this formula rather than a nearest-Monday rule.",
  });

  // Otago — nearest Monday to 23 March
  const otagoAnchor = new Date(year, 2, 23);
  holidays.push({
    id: `otago-ann-${year}`, name: "Otago Anniversary",
    date: nearestMonday(otagoAnchor), originalDate: otagoAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.Otago],
    description: "Celebrates the arrival of the first Scottish settlers at Otago Harbour on 23 March 1848, who founded Dunedin (Ōtepoti). The Free Church of Scotland settlers shaped Otago's strong Presbyterian heritage.",
  });

  // Southland — Easter Tuesday
  holidays.push({
    id: `south-ann-${year}`, name: "Southland Anniversary",
    date: addDays(easterSunday, 2),
    type: HolidayType.Regional,
    regionIds: [RegionId.Southland],
    description: "Celebrates the anniversary of Southland Province (established 1861, though it was absorbed into Otago in 1870). Southland is unique in observing its anniversary on Easter Tuesday, extending the Easter long weekend to five days.",
  });

  // Hawke's Bay — Friday before Labour Day
  const labourDay = getNthDayOfMonth(year, 9, 1, 4);
  holidays.push({
    id: `hb-ann-${year}`, name: "Hawke's Bay Anniversary",
    date: addDays(labourDay, -3),
    type: HolidayType.Regional,
    regionIds: [RegionId.HawkesBay],
    description: "Celebrates the anniversary of Hawke's Bay Province, established in 1858. Observed on the Friday before Labour Day, it creates a four-day long weekend in autumn.",
  });

  // Marlborough — nearest Monday to 1 November
  const marlboroughAnchor = new Date(year, 10, 1);
  holidays.push({
    id: `marl-ann-${year}`, name: "Marlborough Anniversary",
    date: nearestMonday(marlboroughAnchor), originalDate: marlboroughAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.Marlborough],
    description: "Celebrates the anniversary of Marlborough Province, which was separated from Nelson Province on 1 November 1859. Marlborough is renowned for its Sauvignon Blanc vineyards and the Marlborough Sounds.",
  });

  // Canterbury — 2nd Friday after 1st Tuesday in November (Show Day)
  // This is the Canterbury Agricultural & Pastoral (A&P) Show Day.
  const firstNov = new Date(year, 10, 1);
  const firstTueNovOffset = (2 - firstNov.getDay() + 7) % 7;
  const firstTueNov = addDays(firstNov, firstTueNovOffset);
  const showDay = addDays(firstTueNov, 10); // Tue + 10 days = 2nd Friday after
  holidays.push({
    id: `cant-ann-${year}`, name: "Canterbury Anniversary",
    date: showDay,
    type: HolidayType.Regional,
    regionIds: [RegionId.Canterbury],
    description: "Canterbury's provincial anniversary is tied to the Canterbury A&P Show (Canterbury Agricultural & Pastoral Association Show), the Southern Hemisphere's largest agricultural show held in Christchurch. It falls on the 2nd Friday after the first Tuesday in November.",
  });

  // West Coast — nearest Monday to 1 December
  const westCoastAnchor = new Date(year, 11, 1);
  holidays.push({
    id: `west-ann-${year}`, name: "West Coast Anniversary",
    date: nearestMonday(westCoastAnchor), originalDate: westCoastAnchor,
    type: HolidayType.Regional,
    regionIds: [RegionId.WestCoast],
    description: "Celebrates the anniversary of Westland Province, which was separated from Canterbury Province in December 1873. The West Coast is known for its wild landscapes, glaciers, and gold-mining history.",
  });

  // ── School Holidays (Approximate — verify with Ministry of Education) ──────
  // Stored as range objects. Only the start date shows a pill in the calendar;
  // all days within the range get a tinted school-break background.
  const t1Start = addDays(easterSunday, 14);
  const t1End   = addDays(t1Start, 13);
  const t2Start = new Date(year, 6, 6);
  const t2End   = new Date(year, 6, 19);
  const t3Start = new Date(year, 8, 27);
  const t3End   = new Date(year, 9, 11);
  const t4Start = new Date(year, 11, 20);
  const t4End   = new Date(year, 11, 31);

  const schoolBreaks = [
    {
      id: `school-t1-${year}`, name: "School Holidays — Term 1 Break",
      start: t1Start, end: t1End,
      description: "End-of-Term 1 school holidays (approximately two weeks). Exact dates are gazetted annually by the Ministry of Education — check minedu.govt.nz for confirmed dates.",
    },
    {
      id: `school-t2-${year}`, name: "School Holidays — Term 2 Break",
      start: t2Start, end: t2End,
      description: "Mid-year school holidays (approximately two weeks). Exact dates are gazetted annually by the Ministry of Education — check minedu.govt.nz for confirmed dates.",
    },
    {
      id: `school-t3-${year}`, name: "School Holidays — Term 3 Break",
      start: t3Start, end: t3End,
      description: "End-of-Term 3 school holidays (approximately two weeks). Exact dates are gazetted annually by the Ministry of Education — check minedu.govt.nz for confirmed dates.",
    },
    {
      id: `school-t4-${year}`, name: "School Holidays — Summer Break",
      start: t4Start, end: t4End,
      description: "End-of-year / summer school holidays starting mid-December and continuing into late January of the following year. Exact dates are gazetted annually by the Ministry of Education.",
    },
  ];

  schoolBreaks.forEach(b => {
    holidays.push({
      id: b.id, name: b.name,
      date: b.start, rangeEnd: b.end,
      type: HolidayType.School,
      description: b.description,
    });
  });

  return holidays;
};
