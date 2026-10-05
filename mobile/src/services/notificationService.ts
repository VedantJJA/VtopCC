export interface LowAttendanceCourseAlert {
  courseCode: string;
  courseTitle: string;
  percentage: number;
  needAttend: number;
  status: 'danger' | 'warning';
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permission', err);
    return false;
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options
    });
    return true;
  } catch (err) {
    console.warn('Failed to dispatch notification', err);
    return false;
  }
}

export function scanLowAttendanceCourses(attendanceList: any[]): LowAttendanceCourseAlert[] {
  if (!Array.isArray(attendanceList)) return [];
  const alerts: LowAttendanceCourseAlert[] = [];

  for (const att of attendanceList) {
    const attended = parseInt(att.attended_classes, 10);
    const total = parseInt(att.total_classes, 10);
    const percentage = parseFloat(att.percentage) || 0;

    if (isNaN(attended) || isNaN(total) || total <= 0) continue;

    const rawMargin = Math.floor((4 * attended - 3 * total) / 3);
    if (rawMargin < 0) {
      const needAttend = Math.max(1, Math.ceil(3 * total - 4 * attended));
      alerts.push({
        courseCode: att.course_code || 'COURSE',
        courseTitle: att.course_title || att.course_code || '',
        percentage,
        needAttend,
        status: 'danger'
      });
    } else if (rawMargin === 0) {
      alerts.push({
        courseCode: att.course_code || 'COURSE',
        courseTitle: att.course_title || att.course_code || '',
        percentage,
        needAttend: 0,
        status: 'warning'
      });
    }
  }

  return alerts;
}
