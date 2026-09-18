export interface CustomScheduleItem {
  id: string;
  title: string;
  isRecurring: boolean;
  dayOfWeek?: string; // 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
  date?: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM' (24-hour format)
  endTime: string; // 'HH:MM'
  venue?: string;
  color: string; // Hex color code
  createdAt: number;
}

export const PRESET_SCHEDULE_COLORS = [
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Pink', hex: '#ec4899' },
];

const STORAGE_KEY = 'vtop_custom_schedules';

export function getCustomSchedules(): CustomScheduleItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSchedules(items: CustomScheduleItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('vtop_custom_schedules_updated'));
  } catch (err) {
    console.warn('Failed to save custom schedules to localStorage', err);
  }
}

export function addCustomSchedule(item: Omit<CustomScheduleItem, 'id' | 'createdAt'>): CustomScheduleItem {
  const current = getCustomSchedules();
  const newItem: CustomScheduleItem = {
    ...item,
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: Date.now()
  };
  current.push(newItem);
  saveCustomSchedules(current);
  return newItem;
}

export function deleteCustomSchedule(id: string): void {
  const current = getCustomSchedules();
  const filtered = current.filter(item => item.id !== id);
  saveCustomSchedules(filtered);
}

export function updateCustomSchedule(id: string, updates: Partial<CustomScheduleItem>): void {
  const current = getCustomSchedules();
  const index = current.findIndex(item => item.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    saveCustomSchedules(current);
  }
}

export function getSchedulesForDate(dateStr: string): CustomScheduleItem[] {
  // dateStr format: 'YYYY-MM-DD'
  const items = getCustomSchedules();
  const targetDate = new Date(dateStr);
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[targetDate.getDay()];

  return items.filter(item => {
    if (item.isRecurring) {
      return item.dayOfWeek?.toUpperCase() === dayName;
    }
    return item.date === dateStr;
  });
}

export function getSchedulesForDayOfWeek(dayName: string): CustomScheduleItem[] {
  // dayName format: 'MON', 'TUE', etc.
  const items = getCustomSchedules();
  return items.filter(item => item.isRecurring && item.dayOfWeek?.toUpperCase() === dayName.toUpperCase());
}
