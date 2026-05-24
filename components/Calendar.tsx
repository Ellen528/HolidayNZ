import React from 'react';
import { CalendarDay, Country, Holiday, HolidayType, StateId } from '../types';

interface CalendarProps {
  days: CalendarDay[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onHolidayClick: (holiday: Holiday) => void;
  selectedHolidayId: string | null;
  country: Country;
  selectedState: StateId | null;
}

const Calendar: React.FC<CalendarProps> = ({
  days,
  currentDate,
  onDateChange,
  onHolidayClick,
  selectedHolidayId,
  country,
  selectedState,
}) => {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i);

  const goToToday = () => onDateChange(new Date());
  const handlePrevMonth = () =>
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () =>
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onDateChange(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1));
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onDateChange(new Date(parseInt(e.target.value), currentDate.getMonth(), 1));

  const holidayPillClass = (type: HolidayType, isSelected: boolean): string => {
    if (isSelected) {
      return 'bg-slate-800 text-white border-slate-700 ring-1 ring-slate-500';
    }
    switch (type) {
      case HolidayType.Public:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case HolidayType.School:
        return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
      case HolidayType.Regional:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Build the pill label text, adding state tags for AU all-states view
  const getPillLabel = (h: Holiday, c: Country, state: StateId | null): string => {
    if (h.rangeEnd) return `🎒 ${h.name.replace('School Holidays — ', '')}`;
    // AU all-states view: tag 1–3 states so user can tell states apart at a glance
    if (c === 'au' && state === null && h.stateIds && h.stateIds.length >= 1 && h.stateIds.length <= 3) {
      return `${h.name} · ${h.stateIds.map(s => s.toUpperCase()).join(' ')}`;
    }
    return h.name;
  };

  const isViewingCurrentMonth =
    currentDate.getFullYear() === new Date().getFullYear() &&
    currentDate.getMonth() === new Date().getMonth();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500 hover:text-indigo-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          <div className="relative">
            <select
              value={currentDate.getMonth()}
              onChange={handleMonthChange}
              className="appearance-none bg-transparent font-bold text-slate-800 text-lg hover:bg-slate-200/80 rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-2 pr-6 py-1 transition-colors"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Year selector */}
          <div className="relative">
            <select
              value={currentDate.getFullYear()}
              onChange={handleYearChange}
              className="appearance-none bg-transparent font-bold text-slate-800 text-lg hover:bg-slate-200/80 rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-2 pr-6 py-1 transition-colors"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Today button — only shown when not viewing current month */}
          {!isViewingCurrentMonth && (
            <button
              onClick={goToToday}
              className="ml-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500 hover:text-indigo-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {weekDays.map(day => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-slate-50/30">
        {days.map((day, idx) => {
          const isToday = day.date.toDateString() === new Date().toDateString();

          // School break band: tint the cell amber if it's in a school break,
          // but only when it's NOT also the start of a school holiday (avoids double-tinting)
          const hasSchoolPill = day.holidays.some(h => h.type === HolidayType.School);
          const showBreakBand = day.isInSchoolBreak && !hasSchoolPill;

          return (
            <div
              key={idx}
              className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 transition-colors
                ${!day.isCurrentMonth ? 'bg-slate-50/70' : showBreakBand ? 'bg-amber-50/40' : 'bg-white'}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}
                  `}
                >
                  {day.date.getDate()}
                </span>
                {/* Subtle school-break dot when in range but not the start day */}
                {showBreakBand && day.isCurrentMonth && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-1 mr-0.5 flex-shrink-0" />
                )}
              </div>

              <div className="space-y-0.5">
                {day.holidays.map(holiday => {
                  const isSelected = holiday.id === selectedHolidayId;
                  return (
                  <button
                    key={holiday.id}
                    onClick={e => { e.stopPropagation(); onHolidayClick(holiday); }}
                    className={`w-full text-left text-[10px] sm:text-xs px-1.5 py-0.5 rounded border leading-tight truncate transition-all ${holidayPillClass(holiday.type, isSelected)}`}
                    title={holiday.stateIds ? `${holiday.name} — ${holiday.stateIds.map(s => s.toUpperCase()).join(', ')}` : holiday.name}
                  >
                    {getPillLabel(holiday, country, selectedState)}
                  </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
