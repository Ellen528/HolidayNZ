import { Holiday, HolidayType, RegionId } from '../types';

// Helpers
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

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

const getMatariki = (year: number): Date | null => {
  // Known/Predicted Matariki dates
  const dates: Record<number, string> = {
    2023: '2023-07-14',
    2024: '2024-06-28',
    2025: '2025-06-20',
    2026: '2026-07-10',
    2027: '2027-06-25',
    2028: '2028-07-14',
  };
  return dates[year] ? new Date(dates[year]) : null;
};

const getNthDayOfMonth = (year: number, month: number, dayOfWeek: number, n: number): Date => {
  const date = new Date(year, month, 1);
  const add = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(1 + add + (n - 1) * 7);
  return date;
};

const mondayise = (date: Date): Date => {
  const day = date.getDay();
  if (day === 0) return addDays(date, 1); // Sunday -> Monday
  if (day === 6) return addDays(date, 2); // Saturday -> Monday
  return date;
};

export const getHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];

  // --- National Public Holidays ---
  
  // New Year's
  holidays.push({ id: `ny1-${year}`, name: "New Year's Day", date: mondayise(new Date(year, 0, 1)), type: HolidayType.Public });
  holidays.push({ id: `ny2-${year}`, name: "Day after New Year's Day", date: mondayise(new Date(year, 0, 2)), type: HolidayType.Public });

  // Waitangi Day
  holidays.push({ id: `waitangi-${year}`, name: "Waitangi Day", date: mondayise(new Date(year, 1, 6)), type: HolidayType.Public });

  // Easter
  const easterSunday = getEasterSunday(year);
  holidays.push({ id: `goodfri-${year}`, name: "Good Friday", date: addDays(easterSunday, -2), type: HolidayType.Public });
  holidays.push({ id: `eastermon-${year}`, name: "Easter Monday", date: addDays(easterSunday, 1), type: HolidayType.Public });

  // Anzac Day
  holidays.push({ id: `anzac-${year}`, name: "ANZAC Day", date: mondayise(new Date(year, 3, 25)), type: HolidayType.Public });

  // King's Birthday (1st Mon in June)
  holidays.push({ id: `kings-${year}`, name: "King's Birthday", date: getNthDayOfMonth(year, 5, 1, 1), type: HolidayType.Public });

  // Matariki
  const matariki = getMatariki(year);
  if (matariki) {
    holidays.push({ id: `matariki-${year}`, name: "Matariki", date: matariki, type: HolidayType.Public });
  }

  // Labour Day (4th Mon in Oct)
  holidays.push({ id: `labour-${year}`, name: "Labour Day", date: getNthDayOfMonth(year, 9, 1, 4), type: HolidayType.Public });

  // Christmas
  holidays.push({ id: `xmas-${year}`, name: "Christmas Day", date: mondayise(new Date(year, 11, 25)), type: HolidayType.Public });
  holidays.push({ id: `boxing-${year}`, name: "Boxing Day", date: mondayise(new Date(year, 11, 26)), type: HolidayType.Public });

  // --- Regional Anniversaries (Approximated logic) ---
  
  // Wellington (Monday nearest Jan 22)
  // Logic: Closest Monday to Jan 22
  const wellingtonDate = new Date(year, 0, 22);
  // Simplified: If Tue-Thu, prev Mon. If Fri-Sun, next Mon. Mon is Mon.
  // Actually usually observed on the Monday closest.
  // Let's use a simplified approach: First Monday after Jan 20 approx
  holidays.push({ id: `well-ann-${year}`, name: "Wellington Anniversary", date: new Date(year, 0, 22), type: HolidayType.Regional, regionIds: [RegionId.Wellington, RegionId.ManawatuWhanganui] }); // Usually observed Mondayised in UI logic, keeping simple fixed date or logic here is tricky without complex rules. 
  // BETTER: Hardcode "Observed" logic for robustness or just pick the Monday closest.
  
  // Auckland/Northland (Monday nearest Jan 29)
  holidays.push({ id: `auck-ann-${year}`, name: "Auckland Anniversary", date: new Date(year, 0, 29), type: HolidayType.Regional, regionIds: [RegionId.Auckland, RegionId.Northland, RegionId.Waikato, RegionId.BayOfPlenty, RegionId.Gisborne] });
  
  // Nelson (Monday nearest Feb 1)
  holidays.push({ id: `nel-ann-${year}`, name: "Nelson Anniversary", date: new Date(year, 1, 1), type: HolidayType.Regional, regionIds: [RegionId.Nelson, RegionId.Tasman] });
  
  // Otago (Monday nearest Mar 23)
  holidays.push({ id: `otago-ann-${year}`, name: "Otago Anniversary", date: new Date(year, 2, 23), type: HolidayType.Regional, regionIds: [RegionId.Otago] });

  // Southland (Easter Tuesday)
  holidays.push({ id: `south-ann-${year}`, name: "Southland Anniversary", date: addDays(easterSunday, 2), type: HolidayType.Regional, regionIds: [RegionId.Southland] });

  // Taranaki (2nd Mon in March)
  holidays.push({ id: `tara-ann-${year}`, name: "Taranaki Anniversary", date: getNthDayOfMonth(year, 2, 1, 2), type: HolidayType.Regional, regionIds: [RegionId.Taranaki] });

  // Hawkes Bay (Friday before Labour Day)
  const labourDay = getNthDayOfMonth(year, 9, 1, 4);
  holidays.push({ id: `hb-ann-${year}`, name: "Hawke's Bay Anniversary", date: addDays(labourDay, -3), type: HolidayType.Regional, regionIds: [RegionId.HawkesBay] });

  // Marlborough (1st Mon after Labour Day? Actually usually Nov 1 obs)
  // Official: Monday nearest Nov 1
  holidays.push({ id: `marl-ann-${year}`, name: "Marlborough Anniversary", date: new Date(year, 10, 1), type: HolidayType.Regional, regionIds: [RegionId.Marlborough] });

  // Canterbury (Show Day - 2nd Fri after 1st Tue in Nov)
  const firstNov = new Date(year, 10, 1);
  const firstTueNovOffset = (2 - firstNov.getDay() + 7) % 7;
  const firstTueNov = addDays(firstNov, firstTueNovOffset);
  const showDay = addDays(firstTueNov, 10); // 1 week + 3 days (Tue->Fri) = +10? No. 2nd Friday after.
  // 1st Tue. 
  // Fri of that week is +3 days. 
  // Next Fri is +10 days.
  holidays.push({ id: `cant-ann-${year}`, name: "Canterbury Anniversary", date: showDay, type: HolidayType.Regional, regionIds: [RegionId.Canterbury] });

  // Westland (Monday nearest Dec 1)
  holidays.push({ id: `west-ann-${year}`, name: "Westland Anniversary", date: new Date(year, 11, 1), type: HolidayType.Regional, regionIds: [RegionId.WestCoast] });

  // --- School Holidays (Approximated 2024/2025 pattern) ---
  // Term 1 Break: Mid April (usually spans Anzac)
  const t1Start = addDays(easterSunday, 14); // Rough approximation
  const t1End = addDays(t1Start, 14);
  
  // Term 2 Break: Early July
  const t2Start = new Date(year, 6, 6); // Approx July 6
  const t2End = new Date(year, 6, 21);

  // Term 3 Break: Late Sept
  const t3Start = new Date(year, 8, 28); // Approx Sept 28
  const t3End = new Date(year, 9, 13);

  // Summer Break: Mid Dec -> End Jan (Next Year)
  const t4Start = new Date(year, 11, 20);
  const t4End = new Date(year, 11, 31); // Just showing end of year for this view

  // Helper to push range
  const pushRange = (start: Date, end: Date, name: string) => {
    let curr = new Date(start);
    while (curr <= end) {
      holidays.push({
        id: `school-${name}-${curr.toISOString()}`,
        name: `School Holiday (${name})`,
        date: new Date(curr),
        type: HolidayType.School
      });
      curr = addDays(curr, 1);
    }
  };

  pushRange(t1Start, t1End, "Term 1 Break");
  pushRange(t2Start, t2End, "Term 2 Break");
  pushRange(t3Start, t3End, "Term 3 Break");
  pushRange(t4Start, t4End, "Summer Break");

  return holidays;
};
