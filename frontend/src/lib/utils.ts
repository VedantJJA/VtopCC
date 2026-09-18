export interface SubjectColor {
  bg: string;
  text: string;
  border: string;
}

export function getSubjectColor(subjectName: string): SubjectColor {
  const colors: SubjectColor[] = [
    {
      bg: 'bg-red-50 dark:bg-red-950/20',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200/50 dark:border-red-900/20'
    },
    {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200/50 dark:border-blue-900/20'
    },
    {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200/50 dark:border-emerald-900/20'
    },
    {
      bg: 'bg-sky-50 dark:bg-sky-950/20',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200/50 dark:border-sky-900/20'
    },
    {
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200/50 dark:border-purple-900/20'
    },
    {
      bg: 'bg-pink-50 dark:bg-pink-950/20',
      text: 'text-pink-700 dark:text-pink-300',
      border: 'border-pink-200/50 dark:border-pink-900/20'
    },
    {
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200/50 dark:border-indigo-900/20'
    },
    {
      bg: 'bg-teal-50 dark:bg-teal-950/20',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200/50 dark:border-teal-900/20'
    },
    {
      bg: 'bg-slate-100 dark:bg-slate-900/40',
      text: 'text-slate-800 dark:text-slate-200',
      border: 'border-slate-300 dark:border-slate-700'
    },
    {
      bg: 'bg-cyan-50 dark:bg-cyan-950/20',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-200/50 dark:border-cyan-900/20'
    }
  ];

  let hash = 0;
  const str = subjectName || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Formats a 24-hour HH:mm time string to 12-hour (e.g. "14:00" -> "2:00 PM")
 * or keeps it in 24-hour format if timeFormat is '24h'.
 */
export function formatTime(timeStr: string, timeFormat: '12h' | '24h' = '24h'): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  
  if (timeFormat === '24h') {
    // If it has AM/PM, convert to 24h
    const matchAmpm = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (matchAmpm && matchAmpm[4]) {
      let hours = parseInt(matchAmpm[1], 10);
      const mins = matchAmpm[2];
      const meridiem = matchAmpm[4].toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${mins}`;
    }
    return trimmed;
  }

  // timeFormat === '12h'
  if (/AM|PM/i.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const rawHours = parseInt(parts[0], 10);
    const mins = parts[1].slice(0, 2);
    if (!isNaN(rawHours)) {
      const period = rawHours >= 12 ? 'PM' : 'AM';
      let h12 = rawHours % 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${mins} ${period}`;
    }
  }

  return trimmed;
}

/**
 * Formats a time range like "08:00 - 08:50" or "14:00 - 14:50"
 */
export function formatTimeRange(rangeStr: string, timeFormat: '12h' | '24h' = '24h'): string {
  if (!rangeStr) return '';
  if (!rangeStr.includes(' - ')) {
    return formatTime(rangeStr, timeFormat);
  }
  const [start, end] = rangeStr.split(' - ');
  return `${formatTime(start, timeFormat)} - ${formatTime(end, timeFormat)}`;
}
