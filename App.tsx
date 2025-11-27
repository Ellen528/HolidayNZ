import React, { useState, useMemo, useCallback } from 'react';
import Calendar from './components/Calendar';
import NZMap from './components/NZMap';
import { getHolidaysForYear } from './services/holidayService';
import { getHolidayActivities } from './services/geminiService';
import { CalendarDay, Holiday, HolidayType, RegionId } from './types';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Removed selectedRegion state for filtering. 
  // We now use selectedHoliday to drive map focus, or just show all holidays on map.
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Memoize holidays for the current year
  const yearHolidays = useMemo(() => getHolidaysForYear(currentDate.getFullYear()), [currentDate.getFullYear()]);

  // Generate calendar days - SHOW ALL HOLIDAYS
  const calendarDays = useMemo((): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    
    const days: CalendarDay[] = [];
    
    // Previous month filler
    for (let i = 0; i < startingDayOfWeek; i++) {
      const d = new Date(year, month, -startingDayOfWeek + 1 + i);
      days.push({ date: d, isCurrentMonth: false, holidays: [] });
    }
    
    // Current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      
      // Filter holidays for this specific day - Show ALL holidays
      const daysHolidays = yearHolidays.filter(h => 
        h.date.getDate() === d.getDate() && h.date.getMonth() === d.getMonth()
      );

      days.push({ date: d, isCurrentMonth: true, holidays: daysHolidays });
    }
    
    // Next month filler
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, holidays: [] });
    }
    
    return days;
  }, [currentDate, yearHolidays]);

  // 1. Highlighted Regions: All regions that have a Regional Holiday in the current month view
  const highlightedRegions = useMemo(() => {
    const regions = new Set<RegionId>();
    const currentMonthHolidays = yearHolidays.filter(h => h.date.getMonth() === currentDate.getMonth());
    
    currentMonthHolidays.forEach(h => {
      if (h.type === HolidayType.Regional && h.regionIds) {
        h.regionIds.forEach(id => regions.add(id));
      }
    });
    return Array.from(regions);
  }, [yearHolidays, currentDate]);

  // 2. Focused Regions: Specific regions for the currently SELECTED holiday
  const focusedRegions = useMemo(() => {
    if (selectedHoliday && selectedHoliday.type === HolidayType.Regional && selectedHoliday.regionIds) {
      return selectedHoliday.regionIds;
    }
    return [];
  }, [selectedHoliday]);

  const handleHolidayClick = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setAiSuggestion(null); 
  };

  const fetchAiSuggestions = useCallback(async () => {
    if (!selectedHoliday) return;
    
    setLoadingAi(true);
    // Use the first associated region for the prompt, or NZ general
    const regionName = (selectedHoliday.regionIds && selectedHoliday.regionIds.length > 0)
      ? selectedHoliday.regionIds[0].replace(/_/g, ' ') 
      : 'New Zealand';
      
    const result = await getHolidayActivities(selectedHoliday.name, regionName);
    setAiSuggestion(result);
    setLoadingAi(false);
  }, [selectedHoliday]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-lg">
                NZ
             </div>
             <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Holiday<span className="text-indigo-600">Viz</span></h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">New Zealand Holiday Planner</p>
             </div>
          </div>
          <div className="text-xs font-medium text-slate-400 hidden sm:block bg-slate-100 px-3 py-1 rounded-full">
            Data sourced from govt.nz patterns
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Calendar (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
               <div>
                  <h2 className="text-lg font-bold text-slate-800">Calendar</h2>
                  <p className="text-sm text-slate-500">Overview of all national and regional breaks</p>
               </div>
               
               <div className="flex flex-wrap gap-2 justify-end">
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span> Public
                 </div>
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm"></span> School
                 </div>
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm"></span> Regional
                 </div>
               </div>
            </div>

            <Calendar 
              days={calendarDays} 
              currentDate={currentDate} 
              onDateChange={setCurrentDate}
              onHolidayClick={handleHolidayClick}
            />
          </div>

          {/* Right Column: Map & Detail Info (5 cols) */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">
            
            {/* Map Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 backdrop-blur flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Regional Impact</h3>
                  <p className="text-xs text-slate-500">Visualizing holidays in {currentDate.toLocaleDateString('en-NZ', { month: 'long' })}</p>
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
                <NZMap 
                   highlightedRegions={highlightedRegions}
                   focusedRegions={focusedRegions}
                />
              </div>
            </div>

            {/* Selected Holiday Detail Card */}
            <div className={`transition-all duration-500 ease-out transform ${selectedHoliday ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}>
              {selectedHoliday && (
                <div className="bg-white rounded-xl shadow-xl border border-indigo-100 overflow-hidden ring-1 ring-black/5">
                   {/* Header Decoration */}
                   <div className={`h-2 w-full ${
                        selectedHoliday.type === HolidayType.Public ? 'bg-emerald-500' :
                        selectedHoliday.type === HolidayType.School ? 'bg-amber-500' :
                        'bg-indigo-500'
                   }`}></div>

                  <div className="p-6">
                    <div className="mb-6">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-3 ${
                            selectedHoliday.type === HolidayType.Public ? 'bg-emerald-100 text-emerald-700' :
                            selectedHoliday.type === HolidayType.School ? 'bg-amber-100 text-amber-700' :
                            'bg-indigo-100 text-indigo-700'
                         }`}>
                           {selectedHoliday.type} Holiday
                         </span>
                         <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedHoliday.name}</h3>
                         <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {selectedHoliday.date.toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                         </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           </div>
                           <h4 className="font-bold text-slate-800">AI Activity Planner</h4>
                        </div>
                        {!aiSuggestion && (
                           <button 
                             onClick={fetchAiSuggestions}
                             disabled={loadingAi}
                             className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                           >
                             {loadingAi ? (
                               <>
                                 <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                 Planning...
                               </>
                             ) : 'Get Ideas'}
                           </button>
                        )}
                      </div>
                      
                      {/* AI Content Area */}
                      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 min-h-[100px]">
                        {loadingAi && (
                            <div className="space-y-3 animate-pulse">
                            <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                            <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                            </div>
                        )}

                        {aiSuggestion && (
                            <div className="prose prose-sm prose-indigo text-slate-600">
                                <p className="text-xs text-indigo-400 font-semibold uppercase mb-2 tracking-wider">Top Suggestions</p>
                                <div dangerouslySetInnerHTML={{ __html: aiSuggestion }} />
                            </div>
                        )}
                        
                        {!aiSuggestion && !loadingAi && (
                            <div className="text-center py-4 text-slate-400">
                                <p className="text-xs italic">
                                    "What should we do this {selectedHoliday.name}?"
                                </p>
                                <p className="text-[10px] mt-1 text-slate-300">Powered by Google Gemini</p>
                            </div>
                        )}
                      </div>
                    </div>
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