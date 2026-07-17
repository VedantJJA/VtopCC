import type { UseQueryResult } from '@tanstack/react-query';
import { Activity, CalendarDays, Loader2 } from 'lucide-react';

interface DashboardViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
  odSnapshotQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  attendanceQuery,
  timetableQuery,
  odSnapshotQuery
}) => {
  // Calculate overall attendance and on-duty counts
  const getAttendanceSummary = () => {
    if (!attendanceQuery.data || !Array.isArray(attendanceQuery.data)) {
      return { percentage: 0, loading: attendanceQuery.isPending };
    }
    let totalAttended = 0;
    let totalConducted = 0;
    for (const course of attendanceQuery.data) {
      const attended = parseInt(course.attended_classes, 10);
      const total = parseInt(course.total_classes, 10);
      if (!isNaN(attended) && !isNaN(total)) {
        totalAttended += attended;
        totalConducted += total;
      }
    }
    const percentage = totalConducted > 0 ? Math.floor((totalAttended / totalConducted) * 100) : 0;
    return { percentage, loading: false };
  };

  // Compute classes scheduled for today
  const getTodayClassesList = () => {
    if (!timetableQuery.data || !timetableQuery.data.timetable) {
      return { list: [], loading: timetableQuery.isPending };
    }
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayName = daysOfWeek[new Date().getDay()];
    const todaySchedule = timetableQuery.data.timetable[todayName] || {};
    
    const time_slot_keys = [
      "08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35",
      "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50",
      "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30",
      "18:35 - 19:25"
    ];

    const list = [];
    for (let i = 0; i < time_slot_keys.length; i++) {
      const slotKey = time_slot_keys[i];
      if (todaySchedule[slotKey] && todaySchedule[slotKey].rowspan) {
        const course = todaySchedule[slotKey];
        const endTime = (time_slot_keys[i + course.rowspan - 1] || "N/A").split(' - ')[1];
        list.push({
          startTime: slotKey.split(' - ')[0],
          endTime,
          title: course.title,
          code: course.code,
          type: course.type,
          venue: course.venue
        });
      }
    }
    return { list, loading: false };
  };

  const attSum = getAttendanceSummary();
  const todayClasses = getTodayClassesList();
  const odCount = odSnapshotQuery.data?.total_od_count ?? 0;
  const isOdLoading = odSnapshotQuery.isPending;

  return (
    <div className="space-y-6">
      {/* Dashboard stats cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Snapshot Card */}
        <div className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-textMain text-base mb-6 flex items-center gap-2 border-b border-borderColor pb-3">
              <Activity className="h-5 w-5 text-indigo-500" /> Snapshot
            </h3>
            
            {attSum.loading ? (
              <div className="h-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-textMuted">Attendance</span>
                    <span className="text-textMain font-bold">{attSum.percentage}%</span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-yellow-500"
                      style={{ width: `${attSum.percentage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-textMuted">On Duty</span>
                    <span className="text-textMain font-bold">
                      {isOdLoading ? '...' : odCount} / 40
                    </span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-purple-500"
                      style={{ width: `${Math.min((odCount / 40) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Schedule Card */}
        <div className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6 border-b border-borderColor pb-3">
              <h3 className="font-bold text-textMain text-base flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" /> Today's Schedule
              </h3>
              <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-900/30">
                Live
              </span>
            </div>

            {todayClasses.loading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : todayClasses.list.length === 0 ? (
              <p className="text-sm text-textMuted italic py-8 text-center bg-bgPrimary/30 rounded-xl border border-dashed border-borderColor">
                No classes scheduled for today.
              </p>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {todayClasses.list.map((cls, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center p-3 rounded-lg bg-bgPrimary/60 hover:bg-bgPrimary transition-colors border border-borderColor/40"
                  >
                    <div className="w-16 text-center border-r border-borderColor pr-3 shrink-0">
                      <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm leading-tight">
                        {cls.startTime}
                      </p>
                      <p className="text-[10px] text-textMuted mt-0.5 leading-none">
                        {cls.endTime}
                      </p>
                    </div>
                    <div className="ml-4 flex-grow overflow-hidden">
                      <p className="font-semibold text-textMain text-sm truncate" title={cls.title}>
                        {cls.title}
                      </p>
                      <p className="text-xs text-textMuted mt-0.5 truncate">
                        {cls.code} ({cls.type})
                      </p>
                    </div>
                    <span className="text-sm font-medium text-textMain shrink-0 pl-3">
                      {cls.venue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
