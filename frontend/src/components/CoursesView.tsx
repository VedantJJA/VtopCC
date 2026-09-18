import React, { useState, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { BookOpen, User, MapPin, Clock, Award, Loader2, X, Calendar, TrendingUp, GraduationCap, Calculator, Search } from 'lucide-react';
import { getSubjectColor } from '../lib/utils';

interface CoursesViewProps {
  timetableQuery: UseQueryResult<any, any>;
  attendanceQuery?: UseQueryResult<any[], any>;
  marksQuery?: UseQueryResult<any, any>;
  gradesQuery?: UseQueryResult<any, any>;
  examsQuery?: UseQueryResult<any[], any>;
}

export const CoursesView: React.FC<CoursesViewProps> = ({ 
  timetableQuery, 
  attendanceQuery, 
  marksQuery, 
  gradesQuery, 
  examsQuery 
}) => {
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const courses: any[] = timetableQuery.data?.courses || [];

  // Group attendance records by course code
  const attendanceMap: Record<string, any[]> = {};
  if (attendanceQuery?.data && Array.isArray(attendanceQuery.data)) {
    for (const item of attendanceQuery.data) {
      if (item.course_code) {
        if (!attendanceMap[item.course_code]) {
          attendanceMap[item.course_code] = [];
        }
        attendanceMap[item.course_code].push(item);
      }
    }
  }

  // Helper to find the days a course is scheduled
  const getDaysForCourse = (courseCode: string) => {
    const daysFound = new Set<string>();
    const timetable = timetableQuery.data?.timetable;
    if (timetable) {
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      for (const day of days) {
        const dayData = timetable[day];
        if (dayData) {
          Object.values(dayData).forEach((cell: any) => {
            if (cell.code === courseCode) {
              daysFound.add(day);
            }
          });
        }
      }
    }
    return Array.from(daysFound);
  };

  // Helper to calculate the subtotal of earned weightage for a specific component
  const getComponentSubtotal = (assessments: any[]) => {
    if (!assessments || assessments.length === 0) return 0;
    return assessments.reduce((sum, a) => {
      const val = parseFloat(a.weightage_mark);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  };

  // Helper to calculate the weighted grand total for the selected course
  const calculateGrandTotal = (course: any) => {
    let weightedMarksSum = 0;
    let hasMarks = false;

    course.components.forEach((comp: any) => {
      const compMarks = marksQuery?.data?.courses?.find((c: any) => c.code === comp.course_code && c.type === comp.course_type);
      if (compMarks?.assessments && compMarks.assessments.length > 0) {
        hasMarks = true;
        const subtotal = getComponentSubtotal(compMarks.assessments);
        const credits = parseFloat(comp.credits || 0);
        weightedMarksSum += (subtotal * credits);
      }
    });

    if (!hasMarks) return null;
    const totalCredits = parseFloat(course.total_credits || 0);
    return totalCredits > 0 ? (weightedMarksSum / totalCredits).toFixed(2) : '0.00';
  };

  const groupedCourses: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    courses.forEach(course => {
      if (!map[course.course_code]) {
        map[course.course_code] = {
          course_code: course.course_code,
          course_title: course.course_title,
          total_credits: 0,
          components: []
        };
      }
      map[course.course_code].components.push(course);
      map[course.course_code].total_credits += parseFloat(course.credits || 0);
    });
    return map;
  }, [courses]);

  const courseList = useMemo(() => {
    const list = Object.values(groupedCourses);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(c => 
      c.course_code.toLowerCase().includes(q) || 
      c.course_title.toLowerCase().includes(q)
    );
  }, [groupedCourses, searchQuery]);

  if (timetableQuery.isPending && !timetableQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 text-accentColor animate-spin" />
        <p className="text-sm text-textMuted mt-3">Loading registered courses...</p>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="bg-bgCard border border-borderColor rounded-xl p-12 text-center space-y-3 max-w-lg mx-auto my-12 shadow-sm animate-in fade-in duration-300">
        <BookOpen className="h-12 w-12 text-textMuted mx-auto opacity-50" />
        <h3 className="font-bold text-textMain text-lg">No Registered Courses</h3>
        <p className="text-xs text-textMuted leading-relaxed">
          No registered course details were found for this semester.
        </p>
      </div>
    );
  }

  // Calculate Grand Total if a course is currently selected
  const grandTotal = selectedCourse ? calculateGrandTotal(selectedCourse) : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bgCard border border-borderColor rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-textMain">Registered Courses</h2>
          <p className="text-xs text-textMuted mt-0.5">
            {Object.keys(groupedCourses).length} courses enrolled this semester
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bgPrimary border border-borderColor px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-textMain self-start sm:self-auto">
          <Award className="h-4 w-4 text-accentColor" />
          <span>Total Credits: <strong className="text-accentColor font-black">{timetableQuery.data?.total_credits || '0'}</strong></span>
        </div>
      </div>

      {/* Search Filter Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-textMuted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search course code or title..."
          className="w-full pl-10 pr-10 py-2.5 bg-bgCard border border-borderColor rounded-xl text-xs font-semibold text-textMain placeholder:text-textMuted focus:ring-2 focus:ring-accentColor outline-none transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-textMuted hover:text-textMain"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courseList.map((course: any, idx: number) => {
          const colorClass = getSubjectColor(course.course_code || `course-${idx}`);
          const courseAttendances = attendanceMap[course.course_code] || [];
          const primaryAttendance = courseAttendances[0];

          return (
            <div
              key={idx}
              className="bg-bgCard border border-borderColor rounded-2xl p-4 sm:p-5 shadow-sm hover:border-accentColor/40 transition-all duration-200 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md border ${colorClass}`}>
                    {course.course_code}
                  </span>
                  <span className="text-[11px] font-bold text-textMuted font-mono">
                    {course.total_credits.toFixed(1)} {course.total_credits === 1 ? 'Credit' : 'Credits'}
                  </span>
                </div>

                <h3 className="font-bold text-textMain text-sm sm:text-base leading-snug line-clamp-2" title={course.course_title}>
                  {course.course_title}
                </h3>

                {/* Component Slots Preview */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {course.components.map((comp: any, cIdx: number) => (
                    <span
                      key={cIdx}
                      className="text-[10px] font-mono font-bold bg-bgPrimary border border-borderColor/70 px-2 py-0.5 rounded text-textMuted"
                    >
                      {comp.course_type?.substring(0, 3).toUpperCase()}: {comp.slot || 'N/A'}
                    </span>
                  ))}
                  {primaryAttendance && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      parseFloat(primaryAttendance.percentage) >= 75
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {primaryAttendance.percentage}%
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-borderColor/60">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(course)}
                  className="w-full bg-bgPrimary hover:bg-borderColor/50 text-textMain border border-borderColor font-bold py-2 rounded-xl transition-colors text-xs active:scale-98"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {courseList.length === 0 && (
        <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center text-textMuted text-xs shadow-sm">
          No courses matching &quot;{searchQuery}&quot;
        </div>
      )}

      {/* Mobile Drawer / Sheet Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-bgCard border border-borderColor rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative animate-in slide-in-from-bottom-8 duration-300">
            
            {/* Grab Handle for Mobile */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1 bg-borderColor rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="p-4 sm:p-5 flex items-start justify-between border-b border-borderColor/60">
              <div className="space-y-1.5 pr-2">
                <h2 className="text-lg sm:text-xl font-black text-textMain leading-snug">
                  {selectedCourse.course_title}
                </h2>
                <div className="flex flex-wrap gap-2 text-xs text-textMuted items-center">
                  <span className={`px-2 py-0.5 rounded-md border ${getSubjectColor(selectedCourse.course_code)} font-black text-[11px]`}>
                    {selectedCourse.course_code}
                  </span>
                  <span className="font-mono">{selectedCourse.total_credits.toFixed(1)} Credits</span>

                  {/* Extract Grade from Grades Query */}
                  {gradesQuery?.data?.grades?.filter((g: any) => g.code === selectedCourse.course_code).map((g: any, i: number) => (
                    <span key={i} className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md font-bold text-[11px]">
                      <GraduationCap className="h-3 w-3" /> Grade: {g.grade}
                    </span>
                  ))}

                  {/* Grand Total Badge */}
                  {grandTotal && (
                    <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-bold text-[11px]">
                      <Calculator className="h-3 w-3" /> Total: {grandTotal}
                    </span>
                  )}
                </div>

                {/* Timetable Days Badges */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {getDaysForCourse(selectedCourse.course_code).map(day => (
                    <span key={day} className="text-[10px] bg-bgPrimary border border-borderColor px-1.5 py-0.5 rounded text-textMuted font-bold">
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 hover:bg-bgPrimary rounded-lg text-textMuted hover:text-textMain transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sheet Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
              
              {/* Exam Schedule */}
              {(examsQuery?.data?.filter((e: any) => e.course_code === selectedCourse?.course_code).length ?? 0) > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-accentColor" /> Exam Schedule
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {examsQuery?.data?.filter((e: any) => e.course_code === selectedCourse?.course_code).map((exam: any, idx: number) => (
                      <div key={idx} className="bg-bgPrimary/50 border border-borderColor/60 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex justify-between font-bold text-textMain border-b border-borderColor/40 pb-1.5">
                          <span>{exam.exam_type}</span>
                          <span className="text-accentColor">{exam.exam_date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-textMuted text-[11px]">
                          <div><span className="block text-[9px] uppercase">Session</span> <span className="font-mono text-textMain">{exam.exam_session} ({exam.exam_time})</span></div>
                          <div><span className="block text-[9px] uppercase">Venue</span> <span className="font-mono text-textMain">{exam.venue}</span></div>
                          <div><span className="block text-[9px] uppercase">Seat</span> <span className="font-bold text-textMain">{exam.seat_no}</span></div>
                          <div><span className="block text-[9px] uppercase">Location</span> <span className="text-textMain">{exam.seat_location}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Components */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-textMain uppercase tracking-wider">
                  Course Components
                </h4>
                {selectedCourse.components.map((comp: any, idx: number) => {
                  const courseAttendances = attendanceMap[comp.course_code] || [];
                  const attInfo = courseAttendances.find(a => a.type === comp.course_type) || courseAttendances[idx];
                  const componentMarks = marksQuery?.data?.courses?.find((c: any) => c.code === comp.course_code && c.type === comp.course_type);
                  const subtotal = componentMarks?.assessments ? getComponentSubtotal(componentMarks.assessments) : 0;

                  return (
                    <div key={idx} className="bg-bgPrimary/40 border border-borderColor/60 rounded-xl p-4 space-y-3">
                      {/* Component Header */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold bg-bgPrimary border border-borderColor text-textMuted px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {comp.course_type || 'Component'}
                        </span>
                        {comp.credits && (
                          <span className="text-xs text-textMuted font-mono">
                            {comp.credits} {parseFloat(comp.credits) === 1 ? 'Credit' : 'Credits'}
                          </span>
                        )}
                      </div>

                      {/* Component Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {comp.faculty && (
                          <div className="flex items-center gap-2 text-textMuted">
                            <User className="h-3.5 w-3.5 text-accentColor shrink-0" />
                            <span className="font-medium truncate" title={comp.faculty}>{comp.faculty}</span>
                          </div>
                        )}
                        {comp.slot && (
                          <div className="flex items-center gap-2 text-textMuted">
                            <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-textMain font-mono">{comp.slot}</span>
                          </div>
                        )}
                        {comp.venue && (
                          <div className="flex items-center gap-2 text-textMuted sm:col-span-2">
                            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="font-semibold text-textMain">{comp.venue}</span>
                          </div>
                        )}
                      </div>

                      {/* Attendance Bar */}
                      {attInfo && (
                        <div className="bg-bgCard border border-borderColor/50 rounded-xl p-3 space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-textMuted">Attendance</span>
                            <span className={parseFloat(attInfo.percentage) >= 75 ? 'text-emerald-500' : 'text-rose-500'}>
                              {attInfo.percentage}% ({attInfo.attended_classes}/{attInfo.total_classes} hrs)
                            </span>
                          </div>
                          <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                parseFloat(attInfo.percentage) >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(parseFloat(attInfo.percentage) || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Assessment Scores Mobile Cards */}
                      {componentMarks?.assessments && componentMarks.assessments.length > 0 && (
                        <div className="space-y-2.5 pt-2 border-t border-borderColor/40">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-accentColor" />
                              <span className="text-[11px] font-bold text-textMain uppercase tracking-wider">Assessments</span>
                            </div>
                            <span className="text-[11px] font-bold text-accentColor font-mono">
                              Subtotal: {subtotal.toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {componentMarks.assessments.map((a: any, aIdx: number) => (
                              <div
                                key={aIdx}
                                className="bg-bgCard border border-borderColor/60 rounded-lg p-2.5 space-y-1.5 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-textMain">{a.title}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    a.status?.toLowerCase() === 'present'
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : 'bg-bgPrimary text-textMuted border-borderColor'
                                  }`}>
                                    {a.status || 'Done'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-textMuted font-mono">
                                  <span>Score: <strong className="text-textMain">{a.scored || '-'}</strong> / {a.max_mark}</span>
                                  <span>Weight: <strong className="text-accentColor">{a.weightage_mark || '-'}</strong> ({a.weightage_pct}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};