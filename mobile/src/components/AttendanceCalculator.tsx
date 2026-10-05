import React, { useState, useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ArrowRight, Calendar, Calculator, Plus, Minus, RotateCcw } from 'lucide-react';

interface AttendanceCalculatorProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
}

export const AttendanceCalculator: React.FC<AttendanceCalculatorProps> = ({ 
  attendanceQuery,
  timetableQuery
}) => {
  const [activeTab, setActiveTab] = useState<'subject' | 'days'>('subject');

  // Tab 1: Subject Wise States
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<string>('');
  const [attendNext, setAttendNext] = useState<number>(0);
  const [missNext, setMissNext] = useState<number>(0);

  // Tab 2: Days / Dates States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dayStatus, setDayStatus] = useState<'present' | 'absent'>('present');
  const [daysPrediction, setDaysPrediction] = useState<any[]>([]);
  const [hasCalculatedDays, setHasCalculatedDays] = useState<boolean>(false);

  const courses = attendanceQuery.data || [];

  // Initialize selected course index
  useEffect(() => {
    if (courses.length > 0 && selectedCourseIdx === '') {
      setSelectedCourseIdx('0');
    }
  }, [courses, selectedCourseIdx]);

  // Reset calculator states when tab changes
  useEffect(() => {
    setAttendNext(0);
    setMissNext(0);
  }, [activeTab]);

  // Subject Wise Calculations
  const getSubjectPrediction = () => {
    const idx = parseInt(selectedCourseIdx, 10);
    const course = courses[idx];
    if (!course) return null;

    let multiplier = 1;
    const isLab = course.course_type?.toUpperCase().includes('LAB');
    if (isLab) {
      multiplier = 2;
    }

    const attend = attendNext * multiplier;
    const miss = missNext * multiplier;

    const currentAttended = parseInt(course.attended_classes, 10) || 0;
    const currentTotal = parseInt(course.total_classes, 10) || 0;

    const newAttended = currentAttended + attend;
    const newTotal = currentTotal + attend + miss;
    const newPerc = newTotal > 0 ? (Math.floor((newAttended / newTotal * 100) * 100) / 100).toFixed(2) : '0.00';
    const isSafe = parseFloat(newPerc) >= 75;

    // Margin calculations
    let margin = 0;
    if (currentTotal > 0) {
      const curPerc = (currentAttended / currentTotal) * 100;
      if (curPerc >= 75) {
        margin = Math.floor((currentAttended - 0.75 * currentTotal) / 0.75);
      } else {
        margin = Math.ceil((0.75 * currentTotal - currentAttended) / 0.25);
      }
    }

    return {
      course,
      isLab,
      multiplier,
      currentAttended,
      currentTotal,
      currentPerc: course.percentage,
      newAttended,
      newTotal,
      newPerc,
      isSafe,
      margin
    };
  };

  const subjectPrediction = getSubjectPrediction();

  // Days/Dates calculations
  const calculateDaysPrediction = () => {
    if (!startDate || !endDate) {
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return;
    }

    const timetable = timetableQuery.data?.timetable || {};
    const tempAttendance = JSON.parse(JSON.stringify(courses));
    const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayName = dayMap[d.getDay()];
      const daySchedule = timetable[dayName];
      if (daySchedule) {
        const coursesInDay = new Set<string>();
        Object.values(daySchedule).forEach((slot: any) => {
          if (slot.code) coursesInDay.add(slot.code);
        });

        coursesInDay.forEach(code => {
          const courseIdx = tempAttendance.findIndex((c: any) => c.course_code === code);
          if (courseIdx !== -1) {
            let classesInDay = 0;
            Object.values(daySchedule).forEach((s: any) => {
              if (s.code === code) classesInDay++;
            });

            const isLab = tempAttendance[courseIdx].course_type?.toUpperCase().includes('LAB');
            if (isLab && classesInDay < 2) {
              classesInDay = 2;
            }

            tempAttendance[courseIdx].total_classes = (parseInt(tempAttendance[courseIdx].total_classes, 10) || 0) + classesInDay;
            if (dayStatus === 'present') {
              tempAttendance[courseIdx].attended_classes = (parseInt(tempAttendance[courseIdx].attended_classes, 10) || 0) + classesInDay;
            }
          }
        });
      }
    }

    const list: any[] = [];
    tempAttendance.forEach((course: any) => {
      const original = courses.find(c => c.course_code === course.course_code);
      if (original && parseInt(original.total_classes, 10) !== parseInt(course.total_classes, 10)) {
        const total = parseInt(course.total_classes, 10);
        const newPerc = total > 0 ? (Math.floor((course.attended_classes / total * 100) * 100) / 100).toFixed(2) : '0.00';
        
        list.push({
          courseCode: course.course_code,
          courseTitle: course.course_title,
          originalPerc: original.percentage,
          originalRatio: `${original.attended_classes}/${original.total_classes}`,
          newPerc,
          newRatio: `${course.attended_classes}/${course.total_classes}`
        });
      }
    });

    setDaysPrediction(list);
    setHasCalculatedDays(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-textMain">Attendance Calculator</h2>
        <p className="text-xs sm:text-sm text-textMuted mt-1">Simulate attending or missing upcoming sessions to plan your buffer.</p>
      </div>

      {/* Segmented Pill Tabs */}
      <div className="flex bg-bgCard border border-borderColor p-1 rounded-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('subject')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'subject'
              ? 'bg-textMain text-bgCard shadow-xs'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>Subject Wise</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('days')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'days'
              ? 'bg-textMain text-bgCard shadow-xs'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Days & Dates</span>
        </button>
      </div>

      {/* Tab 1: Subject Wise View */}
      {activeTab === 'subject' && (
        <div className="space-y-4">
          {courses.length === 0 ? (
            <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center text-textMuted italic shadow-sm">
              No course attendance records loaded.
            </div>
          ) : (
            <>
              {/* Course Selector Dropdown Card */}
              <div className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-2">
                <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider">Select Course</label>
                <select
                  value={selectedCourseIdx}
                  onChange={(e) => {
                    setSelectedCourseIdx(e.target.value);
                    setAttendNext(0);
                    setMissNext(0);
                  }}
                  className="w-full p-3 rounded-xl border border-borderColor bg-bgPrimary text-textMain font-semibold text-xs focus:ring-2 focus:ring-accentColor focus:border-transparent outline-none cursor-pointer"
                >
                  {courses.map((c, idx) => (
                    <option key={c.course_code + idx} value={idx}>
                      {c.course_code} - {c.course_title} ({c.percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Touch Steppers for Attend / Miss */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Attend Next Stepper */}
                <div className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Attend Next</span>
                    {subjectPrediction?.isLab && (
                      <span className="text-[10px] font-mono font-bold text-textMuted bg-bgPrimary border border-borderColor px-1.5 py-0.5 rounded">
                        2 hrs/slot
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-bgPrimary/50 border border-borderColor/60 rounded-xl p-2">
                    <button
                      type="button"
                      onClick={() => setAttendNext(prev => Math.max(0, prev - 1))}
                      disabled={attendNext <= 0}
                      className="w-11 h-11 rounded-lg bg-bgCard hover:bg-borderColor/60 disabled:opacity-40 border border-borderColor flex items-center justify-center text-textMain transition-all active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="font-mono text-xl font-black text-textMain">{attendNext}</span>

                    <button
                      type="button"
                      onClick={() => setAttendNext(prev => prev + 1)}
                      className="w-11 h-11 rounded-lg bg-bgCard hover:bg-borderColor/60 border border-borderColor flex items-center justify-center text-textMain transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAttendNext(prev => prev + n)}
                        className="flex-1 py-1 rounded-md bg-bgPrimary border border-borderColor/60 text-[11px] font-bold text-textMuted hover:text-textMain hover:border-accentColor/40 transition-colors"
                      >
                        +{n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAttendNext(0)}
                      className="p-1 rounded-md bg-bgPrimary border border-borderColor/60 text-textMuted hover:text-textMain transition-colors"
                      title="Reset"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Miss Next Stepper */}
                <div className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Miss Next</span>
                    {subjectPrediction?.isLab && (
                      <span className="text-[10px] font-mono font-bold text-textMuted bg-bgPrimary border border-borderColor px-1.5 py-0.5 rounded">
                        2 hrs/slot
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-bgPrimary/50 border border-borderColor/60 rounded-xl p-2">
                    <button
                      type="button"
                      onClick={() => setMissNext(prev => Math.max(0, prev - 1))}
                      disabled={missNext <= 0}
                      className="w-11 h-11 rounded-lg bg-bgCard hover:bg-borderColor/60 disabled:opacity-40 border border-borderColor flex items-center justify-center text-textMain transition-all active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="font-mono text-xl font-black text-textMain">{missNext}</span>

                    <button
                      type="button"
                      onClick={() => setMissNext(prev => prev + 1)}
                      className="w-11 h-11 rounded-lg bg-bgCard hover:bg-borderColor/60 border border-borderColor flex items-center justify-center text-textMain transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMissNext(prev => prev + n)}
                        className="flex-1 py-1 rounded-md bg-bgPrimary border border-borderColor/60 text-[11px] font-bold text-textMuted hover:text-textMain hover:border-accentColor/40 transition-colors"
                      >
                        +{n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMissNext(0)}
                      className="p-1 rounded-md bg-bgPrimary border border-borderColor/60 text-textMuted hover:text-textMain transition-colors"
                      title="Reset"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Prediction Result Banner */}
              {subjectPrediction && (
                <div className="bg-bgCard border border-borderColor rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderColor/60 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Current Attendance</span>
                      <div className="text-base font-bold text-textMain mt-0.5">
                        {subjectPrediction.currentPerc}% <span className="text-xs text-textMuted font-mono font-normal">({subjectPrediction.currentAttended}/{subjectPrediction.currentTotal} hrs)</span>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Predicted Attendance</span>
                      <div className={`text-xl font-black ${subjectPrediction.isSafe ? 'text-emerald-500' : 'text-rose-500'} mt-0.5`}>
                        {subjectPrediction.newPerc}% <span className="text-xs text-textMuted font-mono font-normal">({subjectPrediction.newAttended}/{subjectPrediction.newTotal} hrs)</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress comparison bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-textMuted font-mono">
                      <span>Requirement: 75%</span>
                      <span>{subjectPrediction.isSafe ? 'Above Target' : 'Below Target'}</span>
                    </div>
                    <div className="w-full bg-bgPrimary rounded-full h-2.5 overflow-hidden border border-borderColor/50 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          subjectPrediction.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(parseFloat(subjectPrediction.newPerc) || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Box */}
                  <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    subjectPrediction.isSafe
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}>
                    {subjectPrediction.isSafe ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div className="font-semibold leading-relaxed">
                      {subjectPrediction.isSafe
                        ? `Attendance is SAFE at ${subjectPrediction.newPerc}%, satisfying the mandatory 75% requirement.`
                        : `ATTENTION: Predicted attendance of ${subjectPrediction.newPerc}% falls below the 75% threshold.`
                      }
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Days / Dates View */}
      {activeTab === 'days' && (
        <div className="bg-bgCard border border-borderColor rounded-xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-borderColor bg-bgPrimary text-textMain text-xs font-semibold focus:ring-2 focus:ring-accentColor outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-borderColor bg-bgPrimary text-textMain text-xs font-semibold focus:ring-2 focus:ring-accentColor outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">Day Status</label>
              <select
                value={dayStatus}
                onChange={(e) => setDayStatus(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-borderColor bg-bgPrimary text-textMain text-xs font-semibold focus:ring-2 focus:ring-accentColor outline-none cursor-pointer"
              >
                <option value="present">Attend All Classes</option>
                <option value="absent">Miss All Classes</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={calculateDaysPrediction}
            disabled={!startDate || !endDate}
            className="w-full py-3 bg-accentColor hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Calculator className="h-4 w-4" />
            <span>Calculate Prediction</span>
          </button>

          {hasCalculatedDays && (
            <div className="pt-3 border-t border-borderColor space-y-3">
              <h4 className="text-xs font-bold text-textMain uppercase tracking-wider">
                Predicted Impact on Registered Courses
              </h4>
              {daysPrediction.length === 0 ? (
                <p className="text-xs text-textMuted italic text-center py-6">
                  No classes scheduled in timetable for the selected date range.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {daysPrediction.map((p, idx) => {
                    const isSafe = parseFloat(p.newPerc) >= 75;
                    return (
                      <div
                        key={idx}
                        className="bg-bgPrimary/50 border border-borderColor/60 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="overflow-hidden">
                          <p className="font-bold text-xs text-textMain truncate">
                            {p.courseCode} - {p.courseTitle}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-textMuted mt-1">
                            <span>{p.originalPerc}%</span>
                            <ArrowRight className="w-3 h-3" />
                            <span className={`font-bold ${isSafe ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {p.newPerc}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs font-mono shrink-0">
                          <span className="block font-bold text-textMain">{p.newRatio}</span>
                          <span className="block text-[10px] text-textMuted mt-0.5">was {p.originalRatio}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
