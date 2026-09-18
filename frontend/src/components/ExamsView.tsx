import React, { useState, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Clock, MapPin, Armchair, AlertTriangle, Layers } from 'lucide-react';
import { formatTimeRange } from '../lib/utils';

interface ExamsViewProps {
  examsQuery: UseQueryResult<any[], any>;
  timeFormat?: '12h' | '24h';
}

function parseExamDate(dateStr: string) {
  if (!dateStr) return { day: '--', month: 'TBA', year: '', raw: 'Date TBA' };
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = months[monthNum - 1] || parts[1];
      const day = parts[2];
      return { day, month, year, raw: dateStr };
    } else {
      // DD-Mon-YYYY
      const day = parts[0];
      const month = parts[1].toUpperCase();
      const year = parts[2];
      return { day, month, year, raw: dateStr };
    }
  }
  return { day: dateStr.slice(0, 2), month: dateStr.slice(3, 6).toUpperCase(), year: '', raw: dateStr };
}

export const ExamsView: React.FC<ExamsViewProps> = ({ examsQuery, timeFormat = '24h' }) => {
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
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="h-12 bg-bgCard border border-borderColor rounded-2xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-bgCard border border-borderColor rounded-2xl p-4 flex gap-4 animate-pulse">
              <div className="w-20 bg-bgPrimary rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="w-1/3 h-4 bg-bgPrimary rounded" />
                <div className="w-3/4 h-5 bg-bgPrimary rounded" />
                <div className="w-1/2 h-4 bg-bgPrimary rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (examsQuery.isError && exams.length === 0) {
    return (
      <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs font-mono">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>No examination records retrieved or session timed out. Please retry via refresh.</span>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-bgCard border-2 border-dashed border-rose-500/30 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
          <CalendarIcon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-sans font-black text-textMain text-base uppercase tracking-tight">No Exams Scheduled</h4>
          <p className="text-xs text-textMuted font-mono">There are currently no examination schedules released for this semester.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. COMPACT CONTROL HEADER WITH FILTER PILLS & STATUS BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
              selectedType === 'all'
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain hover:border-rose-500/40'
            }`}
          >
            All Exams ({exams.length})
          </button>
          {examTypes.map((type) => {
            const count = exams.filter((e) => e.exam_type === type).length;
            return (
              <button
                type="button"
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  selectedType === type
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                    : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain hover:border-rose-500/40'
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>

        {/* Count Badge */}
        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
          <span className="px-3 py-1 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>{filteredExams.length} Scheduled</span>
          </span>
        </div>
      </div>

      {/* 2. EXAM TICKET CARDS: CRIMSON ACCENT & HIGH READABILITY */}
      <div className="space-y-3">
        {filteredExams.map((exam: any, idx: number) => {
          const dateMeta = parseExamDate(exam.exam_date);
          const hasVenue = Boolean(exam.venue && exam.venue !== 'TBA');
          const hasSeat = Boolean(exam.seat_no && exam.seat_no !== 'TBA');
          const displayTime = formatTimeRange(exam.exam_time, timeFormat);

          return (
            <div
              key={idx}
              className="bg-bgCard border border-borderColor rounded-2xl shadow-xs overflow-hidden transition-all hover:border-rose-500/50 group"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left Date Block */}
                <div className="bg-bgPrimary/70 border-b md:border-b-0 md:border-r border-borderColor p-3.5 sm:p-4 flex md:flex-col items-center justify-between md:justify-center md:w-24 shrink-0 text-center gap-1 relative">
                  <div className="hidden md:block w-1.5 h-full absolute left-0 top-0 bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-500 block">
                      {dateMeta.month}
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-textMain leading-none block my-0.5">
                      {dateMeta.day}
                    </span>
                    {dateMeta.year && (
                      <span className="text-[10px] font-mono text-textMuted block">
                        {dateMeta.year}
                      </span>
                    )}
                  </div>
                  {exam.exam_session && (
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500 border border-rose-500/30 uppercase">
                      {exam.exam_session}
                    </span>
                  )}
                </div>

                {/* Center Content Column */}
                <div className="p-4 sm:p-5 flex-1 space-y-2 min-w-0">
                  {/* Badges bar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/30 uppercase">
                      {exam.course_code}
                    </span>
                    {exam.slot && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-bgPrimary border border-borderColor text-textMain">
                        Slot: {exam.slot}
                      </span>
                    )}
                    {exam.course_type && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-bgPrimary border border-borderColor text-textMuted">
                        {exam.course_type}
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-md bg-bgPrimary border border-borderColor text-textMain ml-auto">
                      {exam.exam_type || 'Exam'}
                    </span>
                  </div>

                  {/* Course Title */}
                  <h4 className="text-base sm:text-lg font-sans font-black text-textMain leading-snug tracking-tight">
                    {exam.course_title}
                  </h4>

                  {/* Date & Time line */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-textMuted pt-0.5">
                    <div className="flex items-center gap-1.5 text-textMain font-semibold">
                      <Clock className="h-3.5 w-3.5 text-rose-500" />
                      <span>{displayTime || exam.exam_time || 'Time TBA'}</span>
                    </div>
                    {exam.exam_session && (
                      <span className="text-[11px] text-textMuted">
                        Session: {exam.exam_session}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Seating & Venue Box */}
                <div className="border-t md:border-t-0 md:border-l border-borderColor bg-bgPrimary/40 p-3.5 sm:p-4 md:w-52 shrink-0 flex md:flex-col items-center md:items-stretch justify-between gap-3">
                  {/* Venue Block */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-mono font-black text-textMuted uppercase tracking-wider block leading-none">
                        Venue Hall
                      </span>
                      <span className={`text-xs sm:text-sm font-mono font-black block mt-0.5 truncate ${hasVenue ? 'text-textMain' : 'text-textMuted italic'}`}>
                        {exam.venue || exam.seat_location || 'Room TBA'}
                      </span>
                      {exam.seat_location && exam.venue && (
                        <span className="text-[9px] font-mono text-textMuted block truncate leading-none mt-0.5">
                          {exam.seat_location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Seat Number Block */}
                  <div className="flex items-center md:justify-between gap-2.5 bg-bgCard border border-rose-500/30 rounded-xl px-3 py-1.5 md:py-2 shadow-xs">
                    <div>
                      <span className="text-[9px] font-mono font-black text-rose-500 uppercase tracking-wider block leading-none">
                        Seat No
                      </span>
                      <span className={`text-base sm:text-lg font-mono font-black block leading-none mt-0.5 ${hasSeat ? 'text-rose-500' : 'text-textMuted text-xs'}`}>
                        {exam.seat_no || 'TBA'}
                      </span>
                    </div>
                    <Armchair className="h-4 w-4 text-rose-500/70 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
