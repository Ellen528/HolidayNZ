// ── Australian states / territories ───────────────────────────────────────────
export enum StateId {
  ACT = 'act',
  NSW = 'nsw',
  NT  = 'nt',
  QLD = 'qld',
  SA  = 'sa',
  TAS = 'tas',
  VIC = 'vic',
  WA  = 'wa',
}

// ── New Zealand regions ────────────────────────────────────────────────────────
export enum RegionId {
  Northland = 'northland',
  Auckland = 'auckland',
  Waikato = 'waikato',
  BayOfPlenty = 'bop',
  Gisborne = 'gisborne',
  HawkesBay = 'hawkes_bay',
  Taranaki = 'taranaki',
  ManawatuWhanganui = 'manawatu',
  Wellington = 'wellington',
  Tasman = 'tasman',
  Nelson = 'nelson',
  Marlborough = 'marlborough',
  WestCoast = 'west_coast',
  Canterbury = 'canterbury',
  Otago = 'otago',
  Southland = 'southland',
  ChathamIslands = 'chatham' // Usually off map, but handled in logic
}

export type Country = 'nz' | 'au';

export enum HolidayType {
  Public = 'public',
  Regional = 'regional',
  School = 'school'
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;            // Observed date (after mondayisation/shift)
  originalDate?: Date;   // Statutory/anchor date when observance is shifted
  rangeEnd?: Date;       // End date for multi-day spans (school holidays)
  type: HolidayType;
  regionIds?: RegionId[]; // NZ regions
  stateIds?: StateId[];   // AU states
  description?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  holidays: Holiday[];
  isInSchoolBreak: boolean; // True if this day falls within any school holiday range
}

export interface ActivitySuggestion {
  title: string;
  description: string;
}
