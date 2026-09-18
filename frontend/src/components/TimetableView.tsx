import React, { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { BookOpen, Calendar, LayoutGrid, CalendarDays, Clock, MapPin, Layers } from 'lucide-react';
import { getSubjectColor, formatTime, formatTimeRange } from '../lib/utils';
import { TimetableSkeleton } from './Skeleton';

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
      type: 'class' | 'break' | 'free';
      startTime: string;
      endTime: string;
      slotName: string;
      data?: any;
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
      } else {
        i++;
      }
    }

    return items;
  };

  if (timetableQuery.isPending && !timetableQuery.data) {
    return <TimetableSkeleton />;
  }

  if (!timetableQuery.data || !timetableQuery.data.timetable) {
    return (
      <div className="p-8 bg-bgCard border border-borderColor rounded-xl text-center space-y-2 shadow-sm">
        <BookOpen className="h-12 w-12 text-textMuted mx-auto" />
        <h4 className="font-bold text-textMain">Timetable Not Available</h4>
        <p className="text-xs text-textMuted">No timetable data could be found for this semester.</p>
      </div>
    );
  }

  const dayScheduleItems = getDayScheduleItems(selectedDay);
  const classCountForDay = dayScheduleItems.filter(item => item.type === 'class').length;

  return (
    <div className="space-y-4">
      {/* Action & View Switcher Bar */}
      <div className="p-3 sm:p-4 bg-bgCard border border-borderColor rounded-xl flex flex-wrap gap-3 justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-textMuted">Total Credits:</span>
          <span className="text-sm font-black text-accentColor">{timetableQuery.data?.total_credits || 0}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Day View vs Grid View */}
          <div className="flex items-center p-1 bg-bgPrimary border border-borderColor rounded-xl">
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-bgCard text-textMain shadow-xs border border-borderColor/60'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Day View</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-bgCard text-textMain shadow-xs border border-borderColor/60'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid View</span>
            </button>
          </div>

          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accentColor/10 hover:bg-accentColor/20 text-accentColor border border-accentColor/20 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Switch to Calendar Schedule"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* MOBILE-FIRST DAY SCHEDULE VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day Selector Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {daysToRender.map((day) => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 min-w-[58px] py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer text-center border ${
                    isSelected
                      ? 'bg-accentColor text-white border-accentColor shadow-sm'
                      : 'bg-bgCard text-textMuted border-borderColor hover:bg-bgPrimary hover:text-textMain'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Schedule Status Header */}
          <div className="flex justify-between items-center px-1 text-xs text-textMuted font-medium">
            <span>{selectedDay} Schedule</span>
            <span>{classCountForDay} {classCountForDay === 1 ? 'class' : 'classes'} scheduled</span>
          </div>

          {/* Chronological Day Class Cards */}
          {dayScheduleItems.length === 0 || classCountForDay === 0 ? (
            <div className="p-8 bg-bgCard border border-dashed border-borderColor rounded-xl text-center space-y-2">
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
                      className="p-3.5 sm:p-4 rounded-xl border-2 border-dotted border-borderColor/80 bg-bgCard/30 flex items-center justify-between text-xs transition-all hover:bg-bgCard/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-2 rounded-full border border-borderColor bg-textMuted/40" />
                        <div>
                          <span className="font-bold text-textMuted text-xs">Free Slot</span>
                          <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-borderColor/60 bg-bgPrimary/60 text-textMuted">
                            {item.slotName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-textMuted">
                        <Clock className="h-3 w-3 text-textMuted shrink-0" />
                        <span>{formatTimeRange(`${item.startTime} - ${item.endTime}`, timeFormat)}</span>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'break') {
                  return (
                    <div 
                      key={`break-${idx}`}
                      className="py-2.5 px-4 rounded-xl border border-dashed border-borderColor/60 bg-bgPrimary/40 flex items-center justify-between text-xs text-textMuted"
                    >
                      <span className="font-bold uppercase tracking-wider text-[11px]">Lunch Break</span>
                      <span className="font-mono text-[11px]">{formatTimeRange(`${item.startTime} - ${item.endTime}`, timeFormat)}</span>
                    </div>
                  );
                }

                const cls = item.data;
                const color = getSubjectColor(cls.code);

                return (
                  <div
                    key={`class-${idx}`}
                    className="p-4 rounded-xl bg-bgCard border border-borderColor shadow-xs hover:border-borderColor/80 transition-all space-y-3"
                  >
                    {/* Header Row: Time Slot & Course Type Badge */}
                    <div className="flex items-center justify-between gap-2 border-b border-borderColor/50 pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatTimeRange(`${item.startTime} - ${item.endTime}`, timeFormat)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-borderColor bg-bgPrimary text-textMuted">
                          {item.slotName}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${color.border} ${color.bg} ${color.text}`}>
                          {cls.type || 'TH'}
                        </span>
                      </div>
                    </div>

                    {/* Course Title & Code */}
                    <div>
                      <h4 className="font-bold text-textMain text-sm leading-snug">
                        {cls.title}
                      </h4>
                      <p className="text-xs font-mono text-textMuted mt-0.5">
                        {cls.code}
                      </p>
                    </div>

                    {/* Venue & Metadata Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-textMuted">
                      <div className="flex items-center gap-1.5 font-semibold text-textMain">
                        <MapPin className="h-3.5 w-3.5 text-accentColor shrink-0" />
                        <span>{cls.venue || 'TBA'}</span>
                      </div>
                      {cls.faculty && (
                        <div className="flex items-center gap-1.5 text-textMuted text-[11px]">
                          <Layers className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{cls.faculty}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FULL WEEKLY GRID TABLE VIEW */}
      {viewMode === 'grid' && (
        <div className="bg-bgCard border border-borderColor rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200">
          <div className="overflow-auto w-full relative custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs table-fixed min-w-[1200px]">
              <thead>
                <tr className="bg-bgPrimary border-b border-borderColor">
                  <th className="p-4 font-bold w-24 text-center border-r border-borderColor text-textMain">Day</th>
                  {TIMETABLE_SLOTS.map((slot) => (
                    <th key={slot.key} className="p-3 text-center border-r border-borderColor w-32 min-w-[120px]">
                      <div className="font-extrabold text-[11px] text-textMain">{slot.name}</div>
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
                    <td className="p-4 font-bold text-center bg-bgPrimary border-r border-borderColor text-textMain">{day}</td>
                    {TIMETABLE_SLOTS.map((slot, slotIdx) => {
                      if (slot.id === 'break') {
                        return (
                          <td key={slot.key} className="p-2 text-center bg-neutral-100 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-extrabold border-r border-borderColor">
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
                          className="p-2 border-r border-borderColor text-center align-middle"
                        >
                          {cellData ? (
                            (() => {
                              const color = getSubjectColor(cellData.code);
                              return (
                                <div className={`${color.bg} border ${color.border} p-2 rounded-xl space-y-1`}>
                                  <div className={`font-extrabold text-[10px] ${color.text}`}>{cellData.code}</div>
                                  <div className="text-[9px] text-textMain font-bold truncate" title={cellData.title}>{cellData.title}</div>
                                  <div className="text-[9px] text-textMuted font-mono">{cellData.venue}</div>
                                  <div className="text-[8px] text-textMuted font-mono mt-0.5 bg-bgCard/60 dark:bg-bgCard/20 px-1 py-0.5 rounded inline-block">{activeTime}</div>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-textMuted font-bold">-</span>
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
      )}
    </div>
  );
};
