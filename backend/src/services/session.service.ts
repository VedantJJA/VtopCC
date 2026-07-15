import crypto from 'crypto';
import { CookieJar } from 'tough-cookie';

export interface VtopSession {
  cookieJar: CookieJar;
  csrfToken?: string;
  username?: string;
  authorizedId?: string;
  lastAccessed: number;
  semestersList?: any[];
  calendarCache?: Record<string, string>;
}

class SessionService {
  public sessions = new Map<string, VtopSession>();

  public createSession(): { sessionId: string; jar: CookieJar } {
    const sessionId = crypto.randomUUID();
    const jar = new CookieJar();
    this.sessions.set(sessionId, { cookieJar: jar, lastAccessed: Date.now() });
    return { sessionId, jar };
  }

  public getSession(sessionId: string): VtopSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) session.lastAccessed = Date.now();
    return session;
  }

  public updateSession(sessionId: string, updates: Partial<Omit<VtopSession, 'lastAccessed'>>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.set(sessionId, { ...session, ...updates, lastAccessed: Date.now() });
    return true;
  }

  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
export const sessionService = new SessionService();