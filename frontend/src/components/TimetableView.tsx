import React, { useState, useRef, useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Calendar, LayoutGrid, CalendarDays, MapPin, Layers, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { getSubjectColor, formatTime, formatTimeRange } from '../lib/utils';
import { TimetableSkeleton } from './Skeleton';
import { getSchedulesForDayOfWeek, type CustomScheduleItem } from '../services/customScheduleService';

interface TimetableViewProps {
  timetableQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
  onOpenCalendar?: () => void;
  showBlankSlots?: boolean;
  timeFormat?: '12h' | '24h';
}

export const TimetableView: React.FC<TimetableViewProps> = ({ 
  timetableQuery, 
  TIMETABLE_SLOTS,
  onOpenCalendar,
  showBlankSlots = false,
  timeFormat = '24h'
}) => {
  // Determine if Saturday has an instructional day / scheduled classes
  const hasSaturday = (() => {
    const satData = timetableQuery.data?.timetable?.['SAT'];
    if (!satData) return false;
    return Object.keys(satData).length > 0;
  })();

  const daysToRender = hasSaturday 
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  const getInitialDay = () => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = days[new Date().getDay()];
    if (today === 'SAT' && hasSaturday) return 'SAT';
    if (['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(today)) return today;
    return 'MON';
  };

  const [selectedDay, setSelectedDay] = useState<string>(getInitialDay);
  const [viewMode, setViewMode] = useState<'day' | 'grid'>('day');

  // Custom schedules subscription
  const [customSchedules, setCustomSchedules] = useState<CustomScheduleItem[]>(() => getSchedulesForDayOfWeek(getInitialDay()));

  useEffect(() => {
    const handleUpdate = () => {
      setCustomSchedules(getSchedulesForDayOfWeek(selectedDay));
    };
    handleUpdate();
    window.addEventListener('vtop_custom_schedules_updated', handleUpdate);
    return () => window.removeEventListener('vtop_custom_schedules_updated', handleUpdate);
  }, [selectedDay]);

  // Grid view scaling states to fit screen width & mobile pinch-to-zoom
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [gridScale, setGridScale] = useState<number>(1);
  const [tableHeight, setTableHeight] = useState<number>(0);
  const [tableWidth, setTableWidth] = useState<number>(1080);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);

  // Mobile pinch-to-zoom states
  const [pinchZoom, setPinchZoom] = useState<number>(1);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialPinchScaleRef.current = pinchZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / initialPinchDistRef.current;
      const newScale = Math.min(Math.max(initialPinchScaleRef.current * ratio, 1.0), 3.5);
      setPinchZoom(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }
  };

  useEffect(() => {
    if (viewMode !== 'grid') return;
    const updateDimensions = () => {
      if (gridContainerRef.current) {
        const containerWidth = gridContainerRef.current.clientWidth;
        const actualWidth = tableRef.current ? Math.max(tableRef.current.offsetWidth, 1000) : 1080;
        setTableWidth(actualWidth);
        if (fitToWidth && containerWidth > 0 && containerWidth < actualWidth) {
          setGridScale(containerWidth / actualWidth);
        } else {
          setGridScale(1);
        }
      }
      if (tableRef.current) {
        setTableHeight(tableRef.current.offsetHeight);
      }
    };

    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    if (gridContainerRef.current) ro.observe(gridContainerRef.current);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener('resize', updateDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [viewMode, fitToWidth]);

  // Lookup function to support colSpans and find course detail for slot
  const getClassForSlot = (day: string, slotIndex: number) => {
    const timetable = timetableQuery.data?.timetable?.[day];
    if (!timetable) return null;

    const currentSlot = TIMETABLE_SLOTS[slotIndex];
    if (!currentSlot) return null;
    if (timetable[currentSlot.key]) {
      return { data: timetable[currentSlot.key], isStart: true };
    }

    // Check previous slots to see if they span into this one
    for (let i = slotIndex - 1; i >= 0; i--) {
      const prevSlot = TIMETABLE_SLOTS[i];
      if (prevSlot.id === 'break') continue;
      const prevData = timetable[prevSlot.key];
      if (prevData && prevData.rowspan) {
        let slotsCovered = 0;
        let checkIdx = i;
        while (slotsCovered < prevData.rowspan && checkIdx < TIMETABLE_SLOTS.length) {
          if (TIMETABLE_SLOTS[checkIdx].id !== 'break') {
            slotsCovered++;
          }
          if (checkIdx === slotIndex) {
            return { data: prevData, isStart: false };
          }
          checkIdx++;
        }
      }
    }

    return null;
  };

  // Compile ordered classes and lunch break for the selected day in Day View
  const getDayScheduleItems = (day: string) => {
    const items: Array<{
      type: 'class' | 'break' | 'free' | 'custom';
      startTime: string;
      endTime: string;
      slotName: string;
      data?: any;
      customData?: CustomScheduleItem;
    }> = [];

    let i = 0;
    while (i < TIMETABLE_SLOTS.length) {
      const slot = TIMETABLE_SLOTS[i];
      if (slot.id === 'break') {
        items.push({
          type: 'break',
          startTime: '13:25',
          endTime: '14:00',
          slotName: 'LUNCH'
        });
        i++;
        continue;
      }

      const slotClass = getClassForSlot(day, i);
      if (slotClass && slotClass.isStart) {
        const cellData = slotClass.data;
        const isLab = cellData && (cellData.type?.includes('L') || cellData.type?.includes('Lab'));
        const activeTime = isLab ? slot.labTime : slot.theoryTime;
        const [startTime] = activeTime.split(' - ');

        // Compute end time based on rowspan
        let endTime = activeTime.split(' - ')[1] || '';
        const rowspan = cellData.rowspan || 1;
        if (rowspan > 1) {
          let covered = 0;
          let endIdx = i;
          while (covered < rowspan && endIdx < TIMETABLE_SLOTS.length) {
            if (TIMETABLE_SLOTS[endIdx].id !== 'break') {
              covered++;
            }
            endIdx++;
          }
          const lastSlot = TIMETABLE_SLOTS[endIdx - 1];
          if (lastSlot) {
            const lastTime = isLab ? lastSlot.labTime : lastSlot.theoryTime;
            endTime = lastTime.split(' - ')[1] || endTime;
          }
        }

        items.push({
          type: 'class',
          startTime,
          endTime,
          slotName: slot.name,
          data: cellData
        });

        // Advance index by rowspan slots
        i += rowspan;
      } else if (!slotClass) {
        if (showBlankSlots) {
          const [startTime, endTime] = (slot.theoryTime || '').split(' - ');
          items.push({
            type: 'free',
            startTime: startTime || '',
            endTime: endTime || '',
            slotName: slot.name
          });
        }
        i++;
      }
    }

    // Merge custom schedules for the day
    for (const cs of customSchedules) {
      items.push({
        type: 'custom' as const,
        startTime: cs.startTime,
        endTime: cs.endTime,
        slotName: 'CUSTOM',
        customData: cs
      });
    }

    // Sort items chronologically by start time
    items.sort((a, b) => {
      const timeA = a.startTime.replace(':', '');
      const timeB = b.startTime.replace(':', '');
      return timeA.localeCompare(timeB);
    });

    return items;
  };

  const dayScheduleItems = getDayScheduleItems(selectedDay);
  const classCountForDay = dayScheduleItems.filter(item => item.type === 'class' || item.type === 'custom').length;

  if (timetableQuery.isPending && !timetableQuery.data) {
    return <TimetableSkeleton />;
  }

  if (timetableQuery.isError && !timetableQuery.data) {
    return (
      <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs">
        <span>Failed to load timetable data. Please try refreshing.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. TOP VIEW CONTROLS & CALENDAR SHORTCUT */}
      <div className="flex items-center justify-between gap-3 bg-bgCard border border-borderColor p-3 sm:p-3.5 rounded-2xl shadow-xs">
        {/* Segmented Day / Grid View Toggle */}
        <div className="flex items-center bg-bgPrimary p-1 rounded-xl border border-borderColor">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'day'
                ? 'bg-accentColor text-white shadow-xs'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Day View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-accentColor text-white shadow-xs'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Weekly Grid</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === 'grid' && (
            <button
              type="button"
              onClick={() => setFitToWidth(!fitToWidth)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-borderColor bg-bgPrimary hover:bg-bgPrimary/70 text-textMuted hover:text-textMain text-xs font-mono font-semibold transition-all cursor-pointer"
              title={fitToWidth ? 'Disable scaling (Scrollable)' : 'Fit grid to screen width'}
            >
              {fitToWidth ? <Minimize2 className="h-3.5 w-3.5 text-accentColor" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{fitToWidth ? 'Fit Width' : 'Full Size'}</span>
            </button>
          )}

          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-borderColor bg-bgPrimary hover:bg-bgPrimary/70 text-textMain text-xs font-bold transition-all cursor-pointer"
              title="Open Academic Calendar"
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MOBILE & DESKTOP CHRONOLOGICAL DAY SCHEDULE VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-3.5">
          {/* Day Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {daysToRender.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()] === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 min-w-[50px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center relative border ${
                    isSelected
                      ? 'bg-accentColor text-white border-accentColor shadow-xs'
                      : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
                  }`}
                >
                  {isToday && (
                    <span 
                      className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-bgCard ${
                        isSelected ? 'bg-white' : 'bg-accentColor'
                      }`} 
                    />
                  )}
                  {day}
                </button>
              );
            })}
          </div>

          {/* Schedule Status Header */}
          <div className="flex justify-between items-center px-1 text-xs text-textMuted font-mono font-medium">
            <span>{selectedDay} Schedule</span>
            <span>{classCountForDay} {classCountForDay === 1 ? 'class' : 'classes'}</span>
          </div>

          {/* Chronological Day Class Cards with Dotted Traces on the Side */}
          {dayScheduleItems.length === 0 || classCountForDay === 0 ? (
            <div className="p-8 bg-bgCard border-2 border-dashed border-borderColor rounded-2xl text-center space-y-2">
              <p className="text-sm font-semibold text-textMain">No classes on {selectedDay}</p>
              <p className="text-xs text-textMuted">Enjoy your free day or work on project milestones.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayScheduleItems.map((item, idx) => {
                if (item.type === 'free') {
                  return (
                    <div 
                      key={`free-${idx}`} 
                      className="relative rounded-2xl bg-bgCard/20 border border-dashed border-borderColor/60 hover:border-borderColor transition-all flex flex-row overflow-hidden shadow-xs"
                    >
                      {/* Left Stub: Time & Slot with Dotted Trace Divider */}
                      <div className="w-24 sm:w-32 shrink-0 p-3 bg-bgPrimary/30 flex flex-col justify-center items-center text-center relative border-r-2 border-dashed border-borderColor/60">
                        {/* Ticket punch cutouts at top and bottom of dotted trace */}
                        <div className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor/80 z-10 pointer-events-none" />
                        <div className="absolute -bottom-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor/80 z-10 pointer-events-none" />

                        <span className="font-mono text-xs font-bold text-textMuted">
                          {formatTime(item.startTime, timeFormat)}
                        </span>
                        <span className="font-mono text-[10px] text-textMuted/70">
                          {formatTime(item.endTime, timeFormat)}
                        </span>
                        <span className="mt-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-bgCard border border-borderColor/60 text-textMuted">
                          {item.slotName}
                        </span>
                      </div>

                      {/* Right Body: Free Period Info */}
                      <div className="flex-1 min-w-0 p-3 sm:p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-bold text-textMuted text-xs">Free Slot</span>
                          <p className="text-[11px] font-mono text-textMuted/70">No class scheduled for this period</p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-textMuted/30" />
                      </div>
                    </div>
                  );
                }

                if (item.type === 'break') {
                  return (
                    <div 
                      key={`break-${idx}`} 
                      className="relative rounded-2xl bg-bgPrimary/40 border border-dashed border-borderColor/70 flex flex-row overflow-hidden shadow-xs"
                    >
                      {/* Left Stub: Time & Break with Dotted Trace Divider */}
                      <div className="w-24 sm:w-32 shrink-0 p-2.5 sm:p-3 bg-bgPrimary/60 flex flex-col justify-center items-center text-center relative border-r-2 border-dashed border-borderColor/70">
                        {/* Ticket punch cutouts at top and bottom of dotted trace */}
                        <div className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor/80 z-10 pointer-events-none" />
                        <div className="absolute -bottom-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor/80 z-10 pointer-events-none" />

                        <span className="font-mono text-xs font-bold text-textMuted">
                          {formatTime(item.startTime, timeFormat)}
                        </span>
                        <span className="font-mono text-[10px] text-textMuted/70">
                          {formatTime(item.endTime, timeFormat)}
                        </span>
                        <span className="mt-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-bgCard border border-borderColor/60 text-textMuted uppercase">
                          BREAK
                        </span>
                      </div>

                      {/* Right Body: Lunch Break Notice */}
                      <div className="flex-1 min-w-0 p-3 sm:p-4 flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-xs font-mono text-textMuted">Lunch Break</span>
                        <span className="text-[11px] font-mono text-textMuted/70">Midday interval</span>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'custom') {
                  const cs = (item as any).customData as CustomScheduleItem;
                  return (
                    <div 
                      key={`custom-${idx}`} 
                      className="group relative rounded-2xl bg-bgCard border border-borderColor hover:border-borderColor/80 transition-all shadow-xs flex flex-row overflow-hidden"
                    >
                      {/* Left Stub: Time with Dotted Trace Divider */}
                      <div className="w-28 sm:w-36 shrink-0 p-3 sm:p-4 bg-bgPrimary/40 flex flex-col justify-center items-center text-center relative border-r-2 border-dashed border-borderColor/80">
                        <div className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor z-10 pointer-events-none" />
                        <div className="absolute -bottom-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor z-10 pointer-events-none" />

                        <div className="font-mono text-xs sm:text-sm font-black text-textMain tracking-tight">
                          {formatTime(cs.startTime, timeFormat)}
                        </div>
                        <div className="font-mono text-[10px] sm:text-[11px] font-semibold text-textMuted">
                          {formatTime(cs.endTime, timeFormat)}
                        </div>

                        <div className="mt-2">
                          <span 
                            style={{ backgroundColor: `${cs.color}20`, borderColor: `${cs.color}60`, color: cs.color }}
                            className="text-[9px] sm:text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border"
                          >
                            CUSTOM
                          </span>
                        </div>
                      </div>

                      {/* Right Body: Custom Event Details */}
                      <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-textMain text-xs sm:text-sm leading-snug">
                            {cs.title}
                          </h4>
                          <span 
                            style={{ backgroundColor: cs.color }}
                            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 shadow-xs" 
                          />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-textMuted font-mono">
                          {cs.venue && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-textMuted/80 shrink-0" />
                              <span className="truncate">{cs.venue}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-textMuted/60">Personal Schedule</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                const cls = item.data;
                const color = getSubjectColor(cls.code);

                return (
                  <div 
                    key={`class-${idx}`} 
                    className="group relative rounded-2xl bg-bgCard border border-borderColor hover:border-accentColor/40 transition-all shadow-xs flex flex-row overflow-hidden"
                  >
                    {/* Left Stub: Time & Slot Stub with Dotted Trace on the Right Edge */}
                    <div className="w-28 sm:w-36 shrink-0 p-3 sm:p-4 bg-bgPrimary/40 flex flex-col justify-center items-center text-center relative border-r-2 border-dashed border-borderColor/80">
                      {/* Ticket punch circular cutouts at top and bottom of dotted trace */}
                      <div className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor z-10 pointer-events-none" />
                      <div className="absolute -bottom-2.5 -right-2 w-4 h-4 rounded-full bg-bgPrimary border border-borderColor z-10 pointer-events-none" />

                      <div className="font-mono text-xs sm:text-sm font-black text-textMain tracking-tight">
                        {formatTime(item.startTime, timeFormat)}
                      </div>
                      <div className="font-mono text-[10px] sm:text-[11px] font-semibold text-textMuted">
                        {formatTime(item.endTime, timeFormat)}
                      </div>

                      <div className="flex items-center gap-1 mt-2 flex-wrap justify-center">
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border border-borderColor bg-bgCard text-textMuted">
                          {item.slotName}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border ${color.border} ${color.bg} ${color.text}`}>
                          {cls.type || 'TH'}
                        </span>
                      </div>
                    </div>

                    {/* Right Body: Course Details */}
                    <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between gap-2.5">
                      <div>
                        <h4 className="font-bold text-textMain text-xs sm:text-sm leading-snug group-hover:text-accentColor transition-colors">
                          {cls.title}
                        </h4>
                        <p className="text-xs font-mono text-textMuted mt-1">
                          {cls.code}
                        </p>
                      </div>

                      {/* Venue & Faculty Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-borderColor/40 text-xs text-textMuted font-mono">
                        <div className="flex items-center gap-1.5 font-semibold text-textMain">
                          <MapPin className="h-3.5 w-3.5 text-accentColor shrink-0" />
                          <span>{cls.venue || 'TBA'}</span>
                        </div>
                        {cls.faculty && (
                          <div className="flex items-center gap-1.5 text-textMuted text-[11px]">
                            <Layers className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{cls.faculty}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. FULL WEEKLY GRID TABLE VIEW (SCALED DOWN WITH MOBILE PINCH-TO-ZOOM) */}
      {viewMode === 'grid' && (
        <div className="bg-bgCard border border-borderColor rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200 w-full max-w-full relative">
          {/* Pinch-to-Zoom Float Indicator & Reset Button */}
          {pinchZoom > 1.05 && (
            <button
              type="button"
              onClick={() => setPinchZoom(1)}
              className="absolute top-2 right-2 z-30 px-2.5 py-1 bg-bgCard/95 backdrop-blur-md border border-accentColor text-accentColor text-[11px] font-mono font-bold rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer hover:bg-bgCard transition-all"
              title="Tap to reset zoom to fit screen"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{pinchZoom.toFixed(1)}x</span>
              <span className="text-[9px] text-textMuted font-sans">(Reset)</span>
            </button>
          )}

          <div 
            ref={gridContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`w-full relative ${
              fitToWidth && pinchZoom <= 1.05 
                ? 'overflow-hidden' 
                : 'overflow-auto custom-scrollbar touch-pan-x touch-pan-y'
            }`}
            style={{ 
              height: fitToWidth && tableHeight > 0 && gridScale < 1 && pinchZoom <= 1.05 
                ? `${Math.ceil(tableHeight * gridScale)}px` 
                : pinchZoom > 1.05 
                  ? '70vh' 
                  : 'auto',
              maxHeight: fitToWidth && tableHeight > 0 && gridScale < 1 && pinchZoom <= 1.05 
                ? `${Math.ceil(tableHeight * gridScale)}px` 
                : undefined,
              overflowY: pinchZoom > 1.05 ? 'auto' : 'hidden'
            }}
          >
            <div
              style={{
                width: `${tableWidth}px`,
                transform: fitToWidth && (gridScale < 1 || pinchZoom > 1) 
                  ? `scale(${gridScale * pinchZoom})` 
                  : undefined,
                transformOrigin: 'top left',
                marginRight: fitToWidth && (gridScale * pinchZoom) < 1 
                  ? `-${Math.round(tableWidth * (1 - gridScale * pinchZoom))}px` 
                  : undefined,
                marginBottom: fitToWidth && (gridScale * pinchZoom) < 1 && tableHeight > 0 
                  ? `-${Math.round(tableHeight * (1 - gridScale * pinchZoom))}px` 
                  : undefined,
              }}
            >
              <table 
                ref={tableRef}
                className="w-full border-collapse text-left text-xs table-fixed"
              >
                <thead>
                  <tr className="bg-bgPrimary border-b border-borderColor">
                    <th className="p-2 font-bold w-16 text-center border-r border-borderColor text-textMain font-mono text-xs">Day</th>
                    {TIMETABLE_SLOTS.map((slot) => (
                      <th key={slot.key} className={`p-2 text-center border-r border-borderColor ${slot.id === 'break' ? 'w-16' : 'w-20'}`}>
                        <div className="font-extrabold text-[11px] text-textMain font-mono">{slot.name}</div>
                        <div className="text-[9px] text-textMuted font-mono mt-0.5 leading-tight">
                          {slot.id === 'break' ? (
                            <span>{formatTimeRange('13:25 - 14:00', timeFormat)}</span>
                          ) : (
                            <>
                              <span>T: {formatTime(slot.theoryTime.split(' - ')[0], timeFormat)}</span>
                              <br />
                              <span>L: {formatTime(slot.labTime.split(' - ')[0], timeFormat)}</span>
                            </>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysToRender.map(day => (
                    <tr key={day} className="border-b border-borderColor hover:bg-bgPrimary/50">
                      <td className="p-3 font-bold text-center bg-bgPrimary border-r border-borderColor text-textMain font-mono text-xs">{day}</td>
                      {TIMETABLE_SLOTS.map((slot, slotIdx) => {
                        if (slot.id === 'break') {
                          return (
                            <td key={slot.key} className="p-2 text-center bg-neutral-100 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-extrabold border-r border-borderColor font-mono text-[10px]">
                              LUNCH
                            </td>
                          );
                        }

                        const slotClass = getClassForSlot(day, slotIdx);

                        // Skip duplicate td rendering for spanned slots
                        if (slotClass && !slotClass.isStart) {
                          return null;
                        }

                        const cellData = slotClass?.data;
                        const isLab = cellData && (cellData.type?.includes('L') || cellData.type?.includes('Lab'));
                        const activeTime = cellData ? (isLab ? slot.labTime : slot.theoryTime) : '';

                        return (
                          <td 
                            key={slot.key} 
                            colSpan={cellData?.rowspan || 1}
                            className="p-1.5 border-r border-borderColor text-center align-middle"
                          >
                            {cellData ? (
                              (() => {
                                const color = getSubjectColor(cellData.code);
                                return (
                                  <div className={`${color.bg} border ${color.border} p-1.5 rounded-lg space-y-0.5 text-left`}>
                                    <div className={`font-extrabold text-[10px] font-mono ${color.text}`}>{cellData.code}</div>
                                    <div className="text-[9px] text-textMain font-bold truncate leading-tight" title={cellData.title}>{cellData.title}</div>
                                    <div className="text-[9px] text-textMuted font-mono truncate">{cellData.venue}</div>
                                    <div className="text-[8px] text-textMuted font-mono mt-0.5 bg-bgCard/60 dark:bg-bgCard/20 px-1 py-0.2 rounded inline-block">
                                      {formatTimeRange(activeTime, timeFormat)}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-textMuted/40 font-mono text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
