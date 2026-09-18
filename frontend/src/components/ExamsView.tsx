import React, { useState, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Calendar as CalendarIcon, Clock, MapPin, Armchair } from 'lucide-react';

interface ExamsViewProps {
  examsQuery: UseQueryResult<any[], any>;
}

export const ExamsView: React.FC<ExamsViewProps> = ({ examsQuery }) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const exams: any[] = examsQuery.data || [];

  // Group by exam_type
  const examTypes = useMemo(() => {
    const types = new Set<string>();
    exams.forEach((e) => {
      if (e.exam_type) types.add(e.exam_type);
    });
    return Array.from(types);
  }, [exams]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    if (selectedType === 'all') return exams;
    return exams.filter((e) => e.exam_type === selectedType);
  }, [exams, selectedType]);

  if (examsQuery.isPending && exams.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        <p className="text-xs text-textMuted">Loading examination schedules and seating...</p>
      </div>
    );
  }

  if (examsQuery.isError && exams.length === 0) {
    return (
      <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex gap-2.5 text-xs">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>No exam schedules found or session timed out. Please retry.</span>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-bgCard border border-borderColor rounded-2xl p-8 text-center space-y-2 shadow-xs">
        <CalendarIcon className="h-12 w-12 text-textMuted mx-auto opacity-50" />
        <h4 className="font-bold text-textMain text-sm">No Exams Scheduled</h4>
        <p className="text-xs text-textMuted">There are currently no active exam schedules for this semester.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. FILTER PILLS */}
      {examTypes.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              selectedType === 'all'
                ? 'bg-accentColor text-white border-accentColor shadow-xs'
                : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
            }`}
          >
            All Exams ({exams.length})
          </button>
          {examTypes.map((type) => {
            const count = exams.filter((e) => e.exam_type === type).length;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  selectedType === type
                    ? 'bg-accentColor text-white border-accentColor shadow-xs'
                    : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* 2. EXAM TICKET CARDS (MOBILE-OPTIMIZED) */}
      <div className="space-y-3.5">
        {filteredExams.map((exam: any, idx: number) => (
          <div
            key={idx}
            className="bg-bgCard border border-borderColor rounded-2xl shadow-xs overflow-hidden transition-all hover:border-accentColor/40"
          >
            {/* Ticket Header */}
            <div className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold px-2 py-0.5 rounded-lg uppercase">
                    {exam.course_code}
                  </span>
                  <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                    {exam.course_type}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg bg-bgPrimary border border-borderColor text-textMain">
                  {exam.exam_type}
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-bold text-textMain leading-snug">
                {exam.course_title}
              </h4>

              {/* Date & Time Bar */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-textMuted">
                <div className="flex items-center gap-1.5 font-bold text-textMain">
                  <CalendarIcon className="h-3.5 w-3.5 text-accentColor" />
                  <span>{exam.exam_date}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-textMuted">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{exam.exam_session} ({exam.exam_time})</span>
                </div>
              </div>
            </div>

            {/* Ticket Notch Divider */}
            <div className="relative flex items-center px-4">
              <div className="w-full border-t border-dashed border-borderColor/60" />
            </div>

            {/* Ticket Seating & Venue Footer */}
            <div className="p-3.5 sm:p-4 bg-bgPrimary/40 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accentColor shrink-0" />
                <div>
                  <span className="text-[10px] text-textMuted uppercase font-semibold block leading-none">
                    Venue Room
                  </span>
                  <span className="font-extrabold text-textMain text-xs font-mono mt-0.5 block">
                    {exam.venue || exam.seat_location || 'TBA'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-right">
                <div className="shrink-0">
                  <span className="text-[10px] text-textMuted uppercase font-semibold block leading-none">
                    Seat Number
                  </span>
                  <span className="font-black text-accentColor text-sm font-mono mt-0.5 block">
                    {exam.seat_no || 'TBA'}
                  </span>
                </div>
                <Armchair className="h-4 w-4 text-textMuted shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
