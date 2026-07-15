import crypto from 'crypto';
import { CookieJar } from 'tough-cookie';

export interface VtopSession {
  cookieJar: CookieJar;
  csrfToken?: string;
  username?: string;
  authorizedId?: string;
  lastAccessed: number;
}

class SessionService {
  public sessions = new Map<string, VtopSession>();

  /**
   * Creates a new session ID and registers a new session object.
   */
  public createSession(): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      cookieJar: new CookieJar(),
      lastAccessed: Date.now(),
    });
    return sessionId;
  }

  /**
   * Retrieves a session by its ID.
   */
  public getSession(sessionId: string): VtopSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = Date.now();
    }
    return session;
  }

  /**
   * Updates fields on an existing session.
   */
  public updateSession(sessionId: string, updates: Partial<Omit<VtopSession, 'lastAccessed'>>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.set(sessionId, {
      ...session,
      ...updates,
      lastAccessed: Date.now()
    });
    return true;
  }

  /**
   * Deletes a session by its ID.
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Cleanup expired sessions (e.g. older than 30 minutes of inactivity).
   */
  public cleanExpiredSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionService = new SessionService();
