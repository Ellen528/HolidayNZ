import React, { useState, useMemo } from 'react';
import Calendar from './components/Calendar';
import NZMap from './components/NZMap';
import AUMap from './components/AUMap';
import { getHolidaysForYear as getNZHolidays } from './services/holidayService';
import { getAustraliaHolidaysForYear as getAUHolidays, getStateName, STATE_NAMES } from './services/australiaHolidayService';
import { CalendarDay, Country, Holiday, HolidayType, RegionId, StateId } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRegionName = (id: RegionId): string =>
  id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const isShifted = (h: Holiday): boolean =>
  !!(h.originalDate && h.originalDate.toDateString() !== h.date.toDateString());

// ─── Component ────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [country, setCountry]             = useState<Country>('nz');
  const [selectedState, setSelectedState] = useState<StateId | null>(null);
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);

  const year = currentDate.getFullYear();

  // All holidays for the current year/country (unfiltered by state)
  const yearHolidays = useMemo(
    () => (country === 'nz' ? getNZHolidays(year) : getAUHolidays(year)),
    [country, year],
  );

  // Holidays shown on the calendar
  // NZ:              all holidays
  // AU + state sel:  national + that state's holidays (incl. school)
  // AU + no state:   national + ALL state holidays, but NO school (too many variants)
  const filteredHolidays = useMemo(() => {
    if (country === 'nz') return yearHolidays;
    if (selectedState) {
      return yearHolidays.filter(h => !h.stateIds || h.stateIds.includes(selectedState));
    }
    return yearHolidays.filter(h => h.type !== HolidayType.School);
  }, [country, yearHolidays, selectedState]);

  // Build CalendarDay grid from filteredHolidays
  const calendarDays = useMemo((): CalendarDay[] => {
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const days: CalendarDay[] = [];

    const schoolRanges = filteredHolidays.filter(h => h.type === HolidayType.School && h.rangeEnd);
    const inSchoolBreak = (d: Date): boolean =>
      schoolRanges.some(h => {
        const s = new Date(h.date.getFullYear(), h.date.getMonth(), h.date.getDate());
        const e = new Date(h.rangeEnd!.getFullYear(), h.rangeEnd!.getMonth(), h.rangeEnd!.getDate());
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return t >= s && t <= e;
      });

    // Prev-month filler
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + 1 + i);
      days.push({ date: d, isCurrentMonth: false, holidays: [], isInSchoolBreak: inSchoolBreak(d) });
    }

    // In AU all-states view, merge same-name holidays on the same day
    // (e.g. King's Birthday is a separate record per state but falls on the same date for 6 states)
    const dedupeDay = (raw: Holiday[]): Holiday[] => {
      if (country !== 'au' || selectedState !== null) return raw;
      const seen = new Map<string, Holiday>();
      const result: Holiday[] = [];
      for (const h of raw) {
        const key = `${h.name}|${h.type}`;
        if (seen.has(key)) {
          const ex = seen.get(key)!;
          if (h.stateIds) ex.stateIds = [...(ex.stateIds ?? []), ...h.stateIds];
        } else {
          const clone = { ...h, stateIds: h.stateIds ? [...h.stateIds] : undefined };
          seen.set(key, clone);
          result.push(clone);
        }
      }
      return result;
    };

    // Current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const raw = filteredHolidays.filter(
        h => h.date.getDate() === d.getDate() && h.date.getMonth() === d.getMonth(),
      );
      days.push({ date: d, isCurrentMonth: true, holidays: dedupeDay(raw), isInSchoolBreak: inSchoolBreak(d) });
    }

    // Next-month filler
    const rem = 42 - days.length;
    for (let i = 1; i <= rem; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, holidays: [], isInSchoolBreak: inSchoolBreak(d) });
    }
    return days;
  }, [currentDate, filteredHolidays]);

  // NZ map: regions that have a regional holiday in the current month
  const nzHighlightedRegions = useMemo((): RegionId[] => {
    if (country !== 'nz') return [];
    const set = new Set<RegionId>();
    yearHolidays
      .filter(h => h.date.getMonth() === currentDate.getMonth() && h.type === HolidayType.Regional)
      .forEach(h => h.regionIds?.forEach(id => set.add(id)));
    return Array.from(set);
  }, [country, yearHolidays, currentDate]);

  const nzFocusedRegions = useMemo((): RegionId[] => {
    if (selectedHoliday?.type === HolidayType.Regional && selectedHoliday.regionIds) {
      return selectedHoliday.regionIds;
    }
    return [];
  }, [selectedHoliday]);

  // AU map: states that have a state-specific holiday in the current month
  const auHighlightedStates = useMemo((): StateId[] => {
    if (country !== 'au') return [];
    const set = new Set<StateId>();
    filteredHolidays
      .filter(h => h.date.getMonth() === currentDate.getMonth() && h.stateIds?.length)
      .forEach(h => h.stateIds?.forEach(id => set.add(id)));
    return Array.from(set);
  }, [country, filteredHolidays, currentDate]);

  const auFocusedStates = useMemo((): StateId[] => {
    if (selectedHoliday?.stateIds?.length) return selectedHoliday.stateIds;
    return [];
  }, [selectedHoliday]);

  // Next public holiday from today (searches current + next year)
  const nextPublicHoliday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();

    const publicFrom = (y: number): Holiday[] => {
      const all = country === 'nz' ? getNZHolidays(y) : getAUHolidays(y);
      return all.filter(h => {
        if (h.type !== HolidayType.Public) return false;
        if (country === 'au' && selectedState && h.stateIds && !h.stateIds.includes(selectedState)) return false;
        return h.date >= today;
      });
    };

    return [...publicFrom(todayYear), ...publicFrom(todayYear + 1)]
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
  }, [country, selectedState]);

  const daysUntilNext = useMemo(() => {
    if (!nextPublicHoliday) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((nextPublicHoliday.date.getTime() - today.getTime()) / 86_400_000);
  }, [nextPublicHoliday]);

  const handleCountryChange = (c: Country) => {
    setCountry(c);
    setSelectedState(null);
    setSelectedHoliday(null);
  };

  const handleHolidayClick = (holiday: Holiday) => {
    setSelectedHoliday(prev => (prev?.id === holiday.id ? null : holiday));
  };

  // ─── Derived display strings ──────────────────────────────────────────────
  const calendarSubtitle = country === 'nz'
    ? `National and regional holidays for ${year}`
    : selectedState
    ? `${STATE_NAMES[selectedState]} holidays for ${year} · incl. school terms`
    : `National + all state holidays for ${year} · select a state for school terms`;

  const mapTitle   = country === 'nz' ? 'Regional Impact'   : 'State Overview';
  const mapSubtext = country === 'nz'
    ? `Regional holidays in ${currentDate.toLocaleDateString('en-AU', { month: 'long' })}`
    : `State holidays in ${currentDate.toLocaleDateString('en-AU', { month: 'long' })}`;

  const sourceHref = country === 'nz'
    ? 'https://www.employment.govt.nz/leave-and-holidays/public-holidays/public-holidays-and-anniversary-dates/'
    : 'https://www.fairwork.gov.au/employment-conditions/public-holidays';

  const sourceLabel = country === 'nz' ? 'employment.govt.nz' : 'fairwork.gov.au';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">

      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-lg">
              {country === 'nz' ? 'NZ' : 'AU'}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Holiday<span className="text-indigo-600">Viz</span>
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {country === 'nz' ? 'New Zealand' : 'Australia'} Holiday Planner
              </p>
            </div>
          </div>

          {/* Country toggle */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => handleCountryChange('nz')}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 ${country === 'nz' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🇳🇿 NZ
              </button>
              <button
                onClick={() => handleCountryChange('au')}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 ${country === 'au' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🇦🇺 AU
              </button>
            </div>

            <a
              href={sourceHref}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-slate-400 hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {sourceLabel}
            </a>
          </div>
        </div>

        {/* AU state selector bar */}
        {country === 'au' && (
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">School terms</span>
              <button
                onClick={() => { setSelectedState(null); setSelectedHoliday(null); }}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all border ${!selectedState ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700'}`}
              >
                All
              </button>
              {(Object.values(StateId) as StateId[]).map(id => (
                <button
                  key={id}
                  onClick={() => { setSelectedState(prev => prev === id ? null : id); setSelectedHoliday(null); }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all border ${selectedState === id ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700'}`}
                  title={STATE_NAMES[id]}
                >
                  {id.toUpperCase()}
                </button>
              ))}
              {selectedState && (
                <span className="text-xs text-slate-400 ml-1">— {STATE_NAMES[selectedState]}</span>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left column — Calendar */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Calendar</h2>
                <p className="text-sm text-slate-500">{calendarSubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Public
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> School
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> {country === 'nz' ? 'Regional' : 'State'}
                </div>
              </div>
            </div>

            <Calendar
              days={calendarDays}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onHolidayClick={handleHolidayClick}
              selectedHolidayId={selectedHoliday?.id ?? null}
              country={country}
              selectedState={selectedState}
            />
          </div>

          {/* Right column — Map + Details */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">

            {/* Map card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">{mapTitle}</h3>
                  <p className="text-xs text-slate-500">{mapSubtext}</p>
                </div>
                {selectedHoliday && (
                  <button
                    onClick={() => setSelectedHoliday(null)}
                    className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1 rounded shadow-sm transition-colors"
                  >
                    Show All
                  </button>
                )}
              </div>
              <div className="p-1 bg-slate-50/30">
                {country === 'nz'
                  ? <NZMap highlightedRegions={nzHighlightedRegions} focusedRegions={nzFocusedRegions} />
                  : <AUMap highlightedStates={auHighlightedStates}   focusedStates={auFocusedStates} />
                }
              </div>
            </div>

            {/* AU: school term nudge */}
            {country === 'au' && !selectedState && !selectedHoliday && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <span className="text-base mt-0.5">📚</span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All national and state holidays are shown above. Select a <span className="font-semibold text-slate-600">state</span> in the bar to also overlay that state's school term dates.
                </p>
              </div>
            )}

            {/* Next public holiday countdown */}
            {!selectedHoliday && nextPublicHoliday && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Next Public Holiday
                </p>
                <h3 className="text-xl font-bold text-slate-800">{nextPublicHoliday.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {nextPublicHoliday.date.toLocaleDateString('en-AU', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
                <div className="mt-4 flex items-end gap-2">
                  <span className={`text-4xl font-extrabold leading-none ${country === 'nz' ? 'text-indigo-600' : 'text-amber-500'}`}>
                    {daysUntilNext}
                  </span>
                  <span className="text-sm text-slate-400 pb-0.5">
                    day{daysUntilNext !== 1 ? 's' : ''} away
                  </span>
                </div>
                {nextPublicHoliday.description && (
                  <p className="mt-3 text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {nextPublicHoliday.description}
                  </p>
                )}
              </div>
            )}

            {/* Holiday detail card */}
            <div
              className={`transition-all duration-500 ease-out transform ${selectedHoliday ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}
            >
              {selectedHoliday && (
                <div className="bg-white rounded-xl shadow-xl border border-indigo-100 overflow-hidden ring-1 ring-black/5">
                  {/* Colour bar */}
                  <div className={`h-2 w-full ${
                    selectedHoliday.type === HolidayType.Public   ? 'bg-emerald-500' :
                    selectedHoliday.type === HolidayType.School   ? 'bg-amber-500'   :
                    'bg-indigo-500'
                  }`} />

                  <div className="p-6 space-y-5">
                    {/* Title + date */}
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-3 ${
                        selectedHoliday.type === HolidayType.Public  ? 'bg-emerald-100 text-emerald-700' :
                        selectedHoliday.type === HolidayType.School  ? 'bg-amber-100  text-amber-700'   :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {selectedHoliday.type} Holiday
                      </span>

                      <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedHoliday.name}</h3>

                      <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {selectedHoliday.rangeEnd ? (
                          <span>
                            {selectedHoliday.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                            {' – '}
                            {selectedHoliday.rangeEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        ) : (
                          <span>
                            {selectedHoliday.date.toLocaleDateString('en-AU', {
                              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mondayisation notice */}
                    {isShifted(selectedHoliday) && (
                      <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-amber-700 leading-relaxed">
                          <span className="font-semibold">Mondayised</span> — statutory date is{' '}
                          <span className="font-medium">
                            {selectedHoliday.originalDate!.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                          , observed on{' '}
                          <span className="font-medium">
                            {selectedHoliday.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>.
                        </p>
                      </div>
                    )}

                    {/* Description */}
                    {selectedHoliday.description && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm text-slate-600 leading-relaxed">{selectedHoliday.description}</p>
                      </div>
                    )}

                    {/* NZ regions */}
                    {selectedHoliday.regionIds && selectedHoliday.regionIds.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observed in</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedHoliday.regionIds.map(r => (
                            <span key={r} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-medium">
                              {formatRegionName(r)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AU states */}
                    {selectedHoliday.stateIds && selectedHoliday.stateIds.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observed in</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedHoliday.stateIds.map(s => (
                            <span key={s} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-medium">
                              {getStateName(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* School holiday link */}
                    {selectedHoliday.type === HolidayType.School && (
                      <div className="border-t border-slate-100 pt-4">
                        <a
                          href={country === 'nz'
                            ? 'https://www.minedu.govt.nz/NZEducation/EducationPolicies/Schools/SchoolOperations/Attendance/SchoolTermDatesAndHolidays.aspx'
                            : 'https://www.australia.com/en/facts-and-planning/when-to-go/school-holidays.html'}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Verify exact dates →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
