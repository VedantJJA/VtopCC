import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { HttpsCookieAgent } from 'http-cookie-agent/http';

const EVENTHUB_BASE_URL = 'https://eventhubcc.vit.ac.in';

export interface EventCard {
  eid: string;
  title: string;
  participantType: string;
  date: string;
  venue: string;
  fees: string;
  isFree: boolean;
  teamSize: string;
  posterUrl: string;
  canView: boolean;
}

export interface EventPreviewDetails {
  eid: string;
  title: string;
  description: string;
  participants: string;
  date: string;
  venue: string;
  time: string;
  conductedBy: string;
  totalFees: string;
  posterUrl: string;
  registerEid?: string;
}

export interface RegisteredEvent {
  sno: string;
  eventName: string;
  orderId: string;
  eventDate: string;
  eventVenue: string;
  eventTime: string;
  paymentStatus: string;
  receiptUrl?: string;
  certificateUrl?: string;
}

export interface EventHubProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  teams: { id: string; name: string; size: string }[];
  registeredEvents: RegisteredEvent[];
}

// In-memory session store by username to avoid relogging in on every click
const sessionCache = new Map<string, { client: AxiosInstance; jar: CookieJar; lastActive: number }>();

export function getOrCreateClient(username: string): { client: AxiosInstance; jar: CookieJar } {
  const cached = sessionCache.get(username);
  const now = Date.now();
  if (cached && (now - cached.lastActive) < 30 * 60 * 1000) {
    cached.lastActive = now;
    return cached;
  }

  const jar = new CookieJar();
  const client = axios.create({
    baseURL: EVENTHUB_BASE_URL,
    httpsAgent: new HttpsCookieAgent({ 
      cookies: { jar }, 
      rejectUnauthorized: false, 
      keepAlive: true, 
      keepAliveMsecs: 60000 
    }),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    withCredentials: true,
    maxRedirects: 5
  });

  const entry = { client, jar, lastActive: now };
  sessionCache.set(username, entry);
  return entry;
}

export async function loginEventHub(username: string, password: string): Promise<{ client: AxiosInstance; html: string }> {
  const { client } = getOrCreateClient(username);

  // 1. Initial GET /EventHub/login to grab cookiesession1
  await client.get('/EventHub/login', {
    headers: { Referer: 'https://eventhubcc.vit.ac.in/' }
  });

  // 2. POST /EventHub/mainDashboard
  const params = new URLSearchParams();
  params.append('validateVitian', '1');
  params.append('username', username);
  params.append('password', password);

  const res = await client.post('/EventHub/mainDashboard', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://eventhubcc.vit.ac.in/EventHub/login'
    }
  });

  return { client, html: res.data };
}

export function parseEventCards(html: string): { events: EventCard[]; categories: { id: string; name: string }[] } {
  if (!html) return { events: [], categories: [] };
  const $ = cheerio.load(html);
  const events: EventCard[] = [];

  $('#events .card').each((_, cardElem) => {
    const card = $(cardElem);
    const title = card.find('.card-title span').text().trim() || card.find('.card-title').text().trim();
    if (!title) return;

    // Participant type (e.g. VITian/Non-VITian)
    let participantType = '';
    const vitianSpan = card.find('i.fa-people-carry-box, i.fa-user-check, i.fa-user-large').parent();
    if (vitianSpan.length) {
      participantType = vitianSpan.text().trim();
    }

    // Details row: date & venue
    let date = '';
    let venue = '';
    const dateIcon = card.find('i.fa-calendar-days');
    if (dateIcon.length) {
      date = dateIcon.parent().text().trim();
    }

    const venueIcon = card.find('i.fa-map-location-dot');
    if (venueIcon.length) {
      venue = venueIcon.parent().text().trim();
    }

    // Details row: fees & team size
    let fees = '';
    const feeIcon = card.find('i.fa-indian-rupee-sign');
    if (feeIcon.length) {
      fees = feeIcon.parent().text().trim();
    }

    let teamSize = '1';
    const teamIcon = card.find('i.fa-users, i.fa-street-view');
    if (teamIcon.length) {
      teamSize = teamIcon.parent().text().trim();
    }

    // View button with EID
    let eid = '';
    const viewBtn = card.find('button[name="eid"]');
    if (viewBtn.length) {
      eid = viewBtn.val() as string || '';
    } else {
      // Look for any input or button with eid or id
      const anyEid = card.find('[name="eid"], [value*="eventPreview"]').first();
      if (anyEid.length) eid = (anyEid.val() as string) || '';
    }

    const isFree = fees.toLowerCase().includes('free') || fees === '0';
    const posterUrl = eid ? `https://eventhubcc.vit.ac.in/EventHub/image/?id=${eid}` : '';

    events.push({
      eid,
      title,
      participantType: participantType || 'VITian',
      date,
      venue,
      fees: fees || (isFree ? 'Free' : 'TBA'),
      isFree,
      teamSize: teamSize || '1',
      posterUrl,
      canView: !!eid
    });
  });

  // Parse Categories from #typeEvent
  const categories: { id: string; name: string }[] = [];
  $('#typeEvent option').each((_, opt) => {
    const val = $(opt).attr('value');
    const text = $(opt).text().trim();
    if (val && val !== '0' && text) {
      categories.push({ id: val, name: text });
    }
  });

  return { events, categories };
}

export async function fetchEventPreview(client: AxiosInstance, eid: string): Promise<EventPreviewDetails | null> {
  const params = new URLSearchParams();
  params.append('typeEvent', '0');
  params.append('categoryType', '');
  params.append('eid', eid);

  const res = await client.post('/EventHub/eventPreview', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://eventhubcc.vit.ac.in/EventHub/mainDashboard'
    }
  });

  const $ = cheerio.load(res.data);
  const details: Record<string, string> = {};

  $('.eventDetails ol li').each((_, li) => {
    const key = $(li).find('.fw-bold').text().trim().toLowerCase();
    const val = $(li).find('div > span').text().trim() || $(li).find('span').last().text().trim();
    if (key) {
      details[key] = val;
    }
  });

  const totalFees = $('#EventFees1').val() as string || details['total fees'] || '';
  const registerBtn = $('button[formaction*="registerEvent"]').first();
  const registerEid = (registerBtn.val() as string) || eid;

  return {
    eid,
    title: details['event name'] || '',
    description: details['event description'] || '',
    participants: details['participants'] || '1',
    date: details['event date'] || '',
    venue: details['event venue'] || '',
    time: details['event time'] || '',
    conductedBy: details['conducted by'] || '',
    totalFees: totalFees || 'Free',
    posterUrl: `https://eventhubcc.vit.ac.in/EventHub/image/?id=${eid}`,
    registerEid
  };
}

export async function fetchEventHubProfile(client: AxiosInstance): Promise<EventHubProfile> {
  const res = await client.get('/EventHub/profile', {
    headers: {
      'Referer': 'https://eventhubcc.vit.ac.in/EventHub/mainDashboard'
    }
  });

  const $ = cheerio.load(res.data);
  const userId = $('#userId').val() as string || '';
  const name = $('#name').val() as string || '';
  const email = $('#email').val() as string || '';
  const phone = $('#phNo').val() as string || '';
  const college = $('#clg').val() as string || '';

  const teams: { id: string; name: string; size: string }[] = [];
  $('#teamTable tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 3) {
      const id = $(tds[0]).text().trim();
      const tName = $(tds[1]).text().trim();
      const size = $(tds[2]).text().trim();
      if (id) {
        teams.push({ id, name: tName, size });
      }
    }
  });

  const registeredEvents: RegisteredEvent[] = [];
  $('#regTable tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 7) {
      const sno = $(tds[0]).text().trim();
      const eventName = $(tds[1]).text().trim();
      const orderId = $(tds[2]).text().trim();
      const eventDate = $(tds[3]).text().trim();
      const eventVenue = $(tds[4]).text().trim();
      const eventTime = $(tds[5]).text().trim();
      const paymentStatus = $(tds[6]).text().trim();
      const receiptA = $(tds[7]).find('a').attr('href');
      const certA = $(tds[8]).find('a').attr('href');

      if (eventName) {
        registeredEvents.push({
          sno,
          eventName,
          orderId,
          eventDate,
          eventVenue,
          eventTime,
          paymentStatus,
          receiptUrl: receiptA ? `https://eventhubcc.vit.ac.in${receiptA}` : undefined,
          certificateUrl: certA ? `https://eventhubcc.vit.ac.in${certA}` : undefined
        });
      }
    }
  });

  return {
    userId,
    name,
    email,
    phone,
    college,
    teams,
    registeredEvents
  };
}

export async function registerFreeEvent(
  client: AxiosInstance,
  eid: string,
  typeOfEvent: string = '1'
): Promise<{ success: boolean; message: string }> {
  const params = new URLSearchParams();
  params.append('id', eid);
  params.append('EventFees1', '0');
  params.append('EventFees2', '0');
  params.append('typeOfEvent', typeOfEvent);

  const res = await client.post('/EventHub/registerEvent', params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://eventhubcc.vit.ac.in/EventHub/eventPreview'
    },
    validateStatus: () => true
  });

  const html = typeof res.data === 'string' ? res.data : '';
  const $ = cheerio.load(html);

  const swalMatch = html.match(/Swal\.fire\(\{[\s\S]*?text:\s*["']([^"']+)["']/i);
  const alertText = $('.alert').text().trim() || $('p.error').text().trim();

  if (swalMatch && swalMatch[1]) {
    const isError = html.includes('icon: "error"') || html.includes("icon: 'error'");
    return {
      success: !isError,
      message: swalMatch[1]
    };
  }

  if (alertText) {
    const isError = alertText.toLowerCase().includes('already') || alertText.toLowerCase().includes('error');
    return {
      success: !isError,
      message: alertText
    };
  }

  if (res.status === 200 || res.status === 302) {
    return {
      success: true,
      message: 'Registration completed successfully!'
    };
  }

  return {
    success: false,
    message: `Registration failed (Status ${res.status})`
  };
}
