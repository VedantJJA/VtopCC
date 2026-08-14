import React, { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { BookOpen, User, MapPin, Clock, Award, Loader2, X, Calendar, TrendingUp, GraduationCap, Calculator } from 'lucide-react';
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

  if (timetableQuery.isPending && !timetableQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-textMuted mt-3">Loading registered courses…</p>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="bg-bgCard border border-borderColor rounded-3xl p-12 text-center space-y-3 max-w-lg mx-auto my-12 shadow-sm animate-in fade-in duration-300">
        <BookOpen className="h-12 w-12 text-textMuted mx-auto" />
        <h3 className="font-bold text-textMain text-lg">No Registered Courses</h3>
        <p className="text-xs text-textMuted leading-relaxed">
          No registered course details were found for this semester.
        </p>
      </div>
    );
  }

  const groupedCourses: Record<string, any> = {};
  courses.forEach(course => {
    if (!groupedCourses[course.course_code]) {
      groupedCourses[course.course_code] = {
        course_code: course.course_code,
        course_title: course.course_title,
        total_credits: 0,
        components: []
      };
    }
    groupedCourses[course.course_code].components.push(course);
    groupedCourses[course.course_code].total_credits += parseFloat(course.credits || 0);
  });

  const courseList = Object.values(groupedCourses);
  
  // Calculate Grand Total if a course is currently selected
  const grandTotal = selectedCourse ? calculateGrandTotal(selectedCourse) : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bgCard border border-borderColor rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Registered Courses</h2>
          <p className="text-xs text-textMuted mt-0.5">
            {courseList.length} {courseList.length === 1 ? 'Subject' : 'Subjects'} enrolled this semester
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bgPrimary border border-borderColor px-4 py-2 rounded-xl text-sm font-bold text-textMain self-start sm:self-auto">
          <Award className="h-4 w-4 text-accentColor" />
          <span>Total Credits: <strong className="text-accentColor font-black">{timetableQuery.data?.total_credits || '0'}</strong></span>
        </div>
      </div>

      {/* Grid of Grouped Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courseList.map((course: any, idx: number) => {
          const colorClass = getSubjectColor(course.course_code || `course-${idx}`);
          return (
            <div
              key={idx}
              className="bg-bgCard border border-borderColor rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accentColor/40 transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${colorClass}`}>
                      {course.course_code}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-textMuted font-mono">
                    {course.total_credits.toFixed(1)} {course.total_credits === 1 ? 'Credit' : 'Credits'}
                  </span>
                </div>
                <h3 className="font-bold text-textMain text-base leading-snug line-clamp-2" title={course.course_title}>
                  {course.course_title}
                </h3>
              </div>
              <div className="pt-3 border-t border-borderColor/60">
                <button
                  onClick={() => setSelectedCourse(course)}
                  className="w-full bg-bgPrimary hover:bg-borderColor/50 text-textMain border border-borderColor font-semibold py-2 rounded-xl transition-colors text-xs"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Overlay */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-bgCard border border-borderColor rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-5 flex items-start justify-between border-b border-borderColor/60">
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-textMain mb-1">{selectedCourse.course_title}</h2>
                <div className="flex flex-wrap gap-3 text-xs text-textMuted font-mono items-center">
                  <span className={`px-2 py-0.5 rounded-md border ${getSubjectColor(selectedCourse.course_code)} font-extrabold`}>
                    {selectedCourse.course_code}
                  </span>
                  <span>Total Credits: {selectedCourse.total_credits.toFixed(1)}</span>
                  
                  {/* Extract Grade from Grades Query */}
                  {gradesQuery?.data?.grades?.filter((g: any) => g.code === selectedCourse.course_code).map((g: any, i: number) => (
                    <span key={i} className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md font-bold">
                      <GraduationCap className="h-3 w-3" /> Grade: {g.grade}
                    </span>
                  ))}

                  {/* Grand Total Badge (Rendered if marks exist) */}
                  {grandTotal && (
                    <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-bold">
                      <Calculator className="h-3 w-3" /> Grand Total: {grandTotal}
                    </span>
                  )}
                </div>

                {/* Timetable Days Badges */}
                <div className="flex gap-1.5 pt-1">
                  {getDaysForCourse(selectedCourse.course_code).map(day => (
                    <span key={day} className="text-[10px] bg-bgPrimary border border-borderColor px-1.5 py-0.5 rounded text-textMuted font-bold">
                      {day}
                    </span>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 hover:bg-bgPrimary rounded-lg text-textMuted hover:text-textMain transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-6">
              
              {/* Exams Section */}
              {examsQuery?.data?.filter((e: any) => e.course_code === selectedCourse.course_code).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-textMain flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" /> Exam Schedule
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {examsQuery.data.filter((e: any) => e.course_code === selectedCourse.course_code).map((exam: any, idx: number) => (
                      <div key={idx} className="bg-bgPrimary/40 border border-borderColor/60 rounded-xl p-4 text-xs space-y-2">
                        <div className="flex justify-between font-bold text-textMain border-b border-borderColor/40 pb-2">
                          <span>{exam.exam_type}</span>
                          <span className="text-blue-500">{exam.exam_date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-textMuted pt-1">
                          <div><span className="block text-[9px] uppercase">Session</span> <span className="font-mono text-textMain">{exam.exam_session} ({exam.exam_time})</span></div>
                          <div><span className="block text-[9px] uppercase">Venue</span> <span className="font-mono text-textMain">{exam.venue}</span></div>
                          <div><span className="block text-[9px] uppercase">Seat</span> <span className="font-black text-textMain">{exam.seat_no}</span></div>
                          <div><span className="block text-[9px] uppercase">Location</span> <span className="text-textMain">{exam.seat_location}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Components (Theory/Lab) */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-textMain">Course Components</h4>
                {selectedCourse.components.map((comp: any, idx: number) => {
                  const courseAttendances = attendanceMap[comp.course_code] || [];
                  const attInfo = courseAttendances.find(a => a.type === comp.course_type) || courseAttendances[idx];
                  
                  // Extract specific marks for this component
                  const componentMarks = marksQuery?.data?.courses?.find((c: any) => c.code === comp.course_code && c.type === comp.course_type);
                  const subtotal = componentMarks?.assessments ? getComponentSubtotal(componentMarks.assessments) : 0;

                  return (
                    <div key={idx} className="bg-bgPrimary/40 border border-borderColor/60 rounded-xl p-4 space-y-4">
                      {/* Component Header */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold bg-bgPrimary border border-borderColor text-textMuted px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {comp.course_type || 'Unknown Type'}
                        </span>
                        {comp.credits && (
                          <span className="text-xs text-textMuted font-mono">
                            {comp.credits} {parseFloat(comp.credits) === 1 ? 'Credit' : 'Credits'}
                          </span>
                        )}
                      </div>

                      {/* Component Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                        <div className="bg-bgPrimary border border-borderColor/50 rounded-xl p-3 space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-textMuted">Attendance</span>
                            <span className={`${
                              parseFloat(attInfo.percentage) >= 75 ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {attInfo.percentage}% ({attInfo.attended_classes}/{attInfo.total_classes})
                            </span>
                          </div>
                          <div className="w-full bg-bgCard rounded-full h-2 overflow-hidden border border-borderColor/40">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                parseFloat(attInfo.percentage) >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(parseFloat(attInfo.percentage) || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Marks / Assessments Table */}
                      {componentMarks?.assessments && componentMarks.assessments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-borderColor/40">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            <span className="text-[11px] font-bold text-textMain uppercase tracking-wider">Assessment Scores</span>
                          </div>
                          <div className="overflow-hidden rounded-lg border border-borderColor/40">
                            <table className="w-full text-left text-[10px] border-collapse bg-bgCard">
                              <thead>
                                <tr className="text-textMuted font-bold border-b border-borderColor/40 bg-bgPrimary/50">
                                  <th className="p-2">Title</th>
                                  <th className="p-2 text-center">Max</th>
                                  <th className="p-2 text-center">Scored</th>
                                  <th className="p-2 text-center">Weight (%)</th>
                                  <th className="p-2 text-center">Earned Wt</th>
                                  <th className="p-2 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {componentMarks.assessments.map((a: any, aIdx: number) => (
                                  <tr key={aIdx} className="border-b border-borderColor/20 last:border-0 hover:bg-bgPrimary/40">
                                    <td className="p-2 font-semibold text-textMain">{a.title}</td>
                                    <td className="p-2 text-center text-textMuted">{a.max_mark}</td>
                                    <td className="p-2 text-center font-bold text-textMain">{a.scored || '-'}</td>
                                    <td className="p-2 text-center text-textMuted">{a.weightage_pct}%</td>
                                    <td className="p-2 text-center font-bold text-blue-500">{a.weightage_mark || '-'}</td>
                                    <td className="p-2 text-center">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.status.toLowerCase() === 'present'
                                          ? 'bg-emerald-500/10 text-emerald-500'
                                          : 'bg-bgPrimary text-textMuted'
                                        }`}>{a.status}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {/* Subtotal Footer */}
                              <tfoot>
                                <tr className="bg-bgPrimary/60 border-t border-borderColor/40">
                                  <td colSpan={4} className="p-2 text-right font-bold text-[10px] text-textMuted uppercase">
                                    Subtotal (Earned Weightage)
                                  </td>
                                  <td className="p-2 text-center font-black text-blue-500 text-[11px]">
                                    {subtotal.toFixed(2)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
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