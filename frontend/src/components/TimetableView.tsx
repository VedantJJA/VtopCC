import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import { getSubjectColor } from '../lib/utils';

interface TimetableViewProps {
  timetableQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
}

export const TimetableView: React.FC<TimetableViewProps> = ({ timetableQuery, TIMETABLE_SLOTS }) => {
  // Lookup function to support colSpans and find course detail for slot
  const getClassForSlot = (day: string, slotIndex: number) => {
    const timetable = timetableQuery.data?.timetable?.[day];
    if (!timetable) return null;

    const currentSlot = TIMETABLE_SLOTS[slotIndex];
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

  return (
    <div className="space-y-6">
      {timetableQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : timetableQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to load student timetable. Please select another semester or check connection.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Courses Credit Stat Bar */}
          <div className="p-4 bg-bgCard border border-borderColor rounded-2xl flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-accentColor" />
              <span className="text-sm font-semibold text-textMain">Registered Credits</span>
            </div>
            <div className="text-lg font-black text-accentColor">{timetableQuery.data?.total_credits}</div>
          </div>

          {/* Desktop Timetable grid */}
          <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-auto w-full relative">
              <table className="w-full border-collapse text-left text-xs table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-bgPrimary border-b border-borderColor">
                    <th className="p-4 font-bold w-24 text-center border-r border-borderColor text-textMain">Day</th>
                    {TIMETABLE_SLOTS.map((slot) => (
                      <th key={slot.key} className="p-3 text-center border-r border-borderColor w-32 min-w-[120px]">
                        <div className="font-extrabold text-[11px] text-textMain">{slot.name}</div>
                        <div className="text-[9px] text-textMuted font-mono mt-0.5 leading-tight">
                          {slot.id === 'break' ? (
                            <span>13:25 - 14:00</span>
                          ) : (
                            <>
                              <span>T: {slot.theoryTime.split(' - ')[0]}</span>
                              <br />
                              <span>L: {slot.labTime.split(' - ')[0]}</span>
                            </>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(day => (
                    <tr key={day} className="border-b border-borderColor hover:bg-bgPrimary/50">
                      <td className="p-4 font-bold text-center bg-bgPrimary border-r border-borderColor text-textMain">{day}</td>
                      {TIMETABLE_SLOTS.map((slot, slotIdx) => {
                        if (slot.id === 'break') {
                          return (
                            <td key={slot.key} className="p-2 text-center bg-bgPrimary text-textMuted font-semibold border-r border-borderColor">
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
        </div>
      )}
    </div>
  );
};
