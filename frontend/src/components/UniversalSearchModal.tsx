import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, X, CalendarDays, Activity, Calendar, Calculator, 
  Award, FileText, BookOpen, UserCheck, Home, Sliders, ArrowRight,
  Layers
} from 'lucide-react';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: any) => void;
  courses?: any[];
  timetableData?: any;
  exams?: any[];
}

interface SearchResultItem {
  id: string;
  category: 'Navigation' | 'Course' | 'Exam' | 'Schedule';
  title: string;
  subtitle?: string;
  badge?: string;
  action: () => void;
}

const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard & Overview', icon: Layers, tab: 'dashboard' },
  { id: 'timetable', label: 'Timetable Schedule', icon: CalendarDays, tab: 'timetable' },
  { id: 'attendance', label: 'Attendance Tracker', icon: Activity, tab: 'attendance' },
  { id: 'marks', label: 'Marks & Weightages', icon: Award, tab: 'marks' },
  { id: 'grades', label: 'Grades & Academic History', icon: Award, tab: 'grades' },
  { id: 'exams', label: 'Exam Schedule & Seating', icon: FileText, tab: 'exams' },
  { id: 'calendar', label: 'Academic Calendar', icon: Calendar, tab: 'calendar' },
  { id: 'calculator', label: 'Attendance Calculator', icon: Calculator, tab: 'calculator' },
  { id: 'courses', label: 'Registered Courses', icon: BookOpen, tab: 'courses' },
  { id: 'faculty', label: 'Faculty Directory', icon: UserCheck, tab: 'faculty' },
  { id: 'my-room', label: 'Hostel Room Details', icon: Home, tab: 'my-room' },
  { id: 'leaves', label: 'Leave Requests', icon: FileText, tab: 'leaves' },
  { id: 'settings', label: 'App Settings', icon: Sliders, tab: 'settings' },
];

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  courses = [],
  timetableData,
  exams = []
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo<SearchResultItem[]>(() => {
    const trimmed = query.trim().toLowerCase();

    // If query is empty, show top navigation quick actions
    if (!trimmed) {
      return NAVIGATION_ITEMS.slice(0, 6).map((item) => ({
        id: `nav-${item.id}`,
        category: 'Navigation',
        title: item.label,
        subtitle: 'Quick navigation jump',
        action: () => {
          setActiveTab(item.tab);
          onClose();
        }
      }));
    }

    const items: SearchResultItem[] = [];

    // 1. Match Navigation Tabs
    NAVIGATION_ITEMS.forEach((nav) => {
      if (nav.label.toLowerCase().includes(trimmed) || nav.tab.toLowerCase().includes(trimmed)) {
        items.push({
          id: `nav-${nav.id}`,
          category: 'Navigation',
          title: nav.label,
          subtitle: `Jump directly to ${nav.label}`,
          action: () => {
            setActiveTab(nav.tab);
            onClose();
          }
        });
      }
    });

    // 2. Match Courses
    courses.forEach((c: any) => {
      const code = (c.code || c.course_code || '').toLowerCase();
      const title = (c.title || c.course_title || '').toLowerCase();
      const faculty = (c.faculty || '').toLowerCase();
      const slot = (c.slot || '').toLowerCase();

      if (code.includes(trimmed) || title.includes(trimmed) || faculty.includes(trimmed) || slot.includes(trimmed)) {
        items.push({
          id: `course-${c.code || c.course_code}`,
          category: 'Course',
          title: `${c.code || c.course_code} - ${c.title || c.course_title}`,
          subtitle: `${c.slot ? `Slot: ${c.slot} | ` : ''}${c.faculty || c.course_type || ''}`,
          badge: c.percentage ? `${c.percentage}% Att` : undefined,
          action: () => {
            setActiveTab('attendance');
            onClose();
          }
        });
      }
    });

    // 3. Match Exams
    exams.forEach((ex: any) => {
      const code = (ex.course_code || '').toLowerCase();
      const title = (ex.course_title || '').toLowerCase();
      const venue = (ex.venue || '').toLowerCase();
      const seat = (ex.seat_no || '').toLowerCase();
      const type = (ex.exam_type || '').toLowerCase();

      if (code.includes(trimmed) || title.includes(trimmed) || venue.includes(trimmed) || seat.includes(trimmed) || type.includes(trimmed)) {
        items.push({
          id: `exam-${ex.course_code}-${ex.slot}`,
          category: 'Exam',
          title: `${ex.course_code} ${ex.exam_type || 'Exam'}`,
          subtitle: `${ex.exam_date} | ${ex.exam_time || ''} | Room: ${ex.venue || 'TBA'} (Seat: ${ex.seat_no || 'TBA'})`,
          badge: ex.slot || 'Exam',
          action: () => {
            setActiveTab('exams');
            onClose();
          }
        });
      }
    });

    // 4. Match Timetable Classes
    if (timetableData?.timetable) {
      const days = Object.keys(timetableData.timetable);
      days.forEach((day) => {
        const slots = timetableData.timetable[day];
        Object.keys(slots || {}).forEach((slotKey) => {
          const entry = slots[slotKey];
          if (!entry || typeof entry !== 'object') return;
          const code = (entry.code || '').toLowerCase();
          const title = (entry.title || '').toLowerCase();
          const venue = (entry.venue || '').toLowerCase();

          if (code.includes(trimmed) || title.includes(trimmed) || venue.includes(trimmed)) {
            // Avoid duplicate if already in list
            if (!items.some(i => i.id === `tt-${day}-${slotKey}`)) {
              items.push({
                id: `tt-${day}-${slotKey}`,
                category: 'Schedule',
                title: `${day}: ${entry.code} - ${entry.title}`,
                subtitle: `Slot: ${slotKey} | Room: ${entry.venue || 'TBA'}`,
                badge: day,
                action: () => {
                  setActiveTab('timetable');
                  onClose();
                }
              });
            }
          }
        });
      });
    }

    return items.slice(0, 10);
  }, [query, courses, exams, timetableData, setActiveTab, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-bgCard border-2 border-borderColor/90 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
      >
        {/* Search Header Bar */}
        <div className="p-3.5 border-b border-borderColor flex items-center gap-3 bg-bgPrimary/50">
          <Search className="h-5 w-5 text-accentColor shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search courses, exams, slots, rooms, or pages..."
            className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-textMain placeholder:text-textMuted/60 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-textMuted hover:text-textMain cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-xs font-mono text-textMuted hover:text-textMain border border-borderColor bg-bgCard cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar flex-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-textMuted font-mono space-y-1">
              <p className="font-bold text-textMain">No matching records found</p>
              <p>Try searching for a course code, professor name, exam room, or slot.</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-accentColor/10 border border-accentColor/30 text-textMain' : 'hover:bg-bgPrimary/60 text-textMain border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded border border-borderColor bg-bgPrimary text-textMuted">
                        {item.category}
                      </span>
                      <span className="text-xs sm:text-sm font-bold truncate">
                        {item.title}
                      </span>
                    </div>
                    {item.subtitle && (
                      <p className="text-[11px] text-textMuted truncate font-mono">
                        {item.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bgPrimary border border-borderColor text-accentColor">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className={`h-4 w-4 ${isSelected ? 'text-accentColor translate-x-0.5' : 'text-textMuted'} transition-transform`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Key Hints */}
        <div className="p-2.5 px-4 bg-bgPrimary/70 border-t border-borderColor/60 flex items-center justify-between text-[10px] font-mono text-textMuted">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="px-1 py-0.5 bg-bgCard border border-borderColor rounded">Up</kbd> <kbd className="px-1 py-0.5 bg-bgCard border border-borderColor rounded">Down</kbd> to navigate</span>
            <span><kbd className="px-1 py-0.5 bg-bgCard border border-borderColor rounded">Enter</kbd> to select</span>
          </div>
          <span>Universal Search</span>
        </div>
      </div>
    </div>
  );
};
