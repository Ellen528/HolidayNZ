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

export enum HolidayType {
  Public = 'public',
  Regional = 'regional',
  School = 'school'
}

export interface Holiday {
  id: string;
  name: string;
  date: Date; // The specific date of the holiday
  type: HolidayType;
  regionIds?: RegionId[]; // If undefined, applies to all
  description?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  holidays: Holiday[];
}

export interface ActivitySuggestion {
  title: string;
  description: string;
}
