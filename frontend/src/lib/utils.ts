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
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200/50 dark:border-amber-900/20'
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
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200/50 dark:border-orange-900/20'
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
