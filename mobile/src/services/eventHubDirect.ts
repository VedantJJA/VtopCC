import { CapacitorHttp } from '@capacitor/core';
import * as cheerio from 'cheerio';
import { safeStorageGet } from '../lib/cache';

const EVENTHUB_BASE_URL = 'https://eventhubcc.vit.ac.in';

let eventHubCookies: Record<string, string> = {};

function updateCookies(headers: Record<string, string> | undefined) {
  if (!headers) return;
  const reserved = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly', 'priority']);

  for (const [key, rawVal] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie' && rawVal) {
      const values = Array.isArray(rawVal) ? rawVal : [String(rawVal)];
      for (const value of values) {
        const tokens = value.split(';');
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i].trim();
          if (token.includes(',')) {
            const parts = token.split(',');
            token = parts[parts.length - 1].trim();
          }
          const eqIdx = token.indexOf('=');
          if (eqIdx > 0) {
            const k = token.substring(0, eqIdx).trim();
            const v = token.substring(eqIdx + 1).trim();
            if (!reserved.has(k.toLowerCase()) && !/^\d{2}/.test(k)) {
              eventHubCookies[k] = v;
            }
          }
        }
      }
    }
  }
}

function getCookieHeader(): string {
  return Object.entries(eventHubCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function getSavedCreds(creds?: { username?: string; password?: string }): { username?: string; password?: string } {
  if (creds?.username && creds?.password) return creds;
  try {
    const saved = safeStorageGet('vtop_direct_saved_creds');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.username && parsed.password) return parsed;
    }
  } catch (_e) {}
  return {};
}

async function loginEventHub(creds?: { username?: string; password?: string }): Promise<string> {
  const resolved = getSavedCreds(creds);
  if (!resolved.username || !resolved.password) {
    throw new Error('No credentials provided for EventHub');
  }

  // 1. Initial GET to set cookies
  const initRes = await CapacitorHttp.get({
    url: `${EVENTHUB_BASE_URL}/EventHub/login`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Referer': `${EVENTHUB_BASE_URL}/`
    }
  });
  updateCookies(initRes.headers);

  // 2. POST login form
  const params = new URLSearchParams();
  params.append('validateVitian', '1');
  params.append('username', resolved.username.trim().toUpperCase());
  params.append('password', resolved.password);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': `${EVENTHUB_BASE_URL}/EventHub/login`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  };
  const cookieStr = getCookieHeader();
  if (cookieStr) headers['Cookie'] = cookieStr;

  const loginRes = await CapacitorHttp.post({
    url: `${EVENTHUB_BASE_URL}/EventHub/mainDashboard`,
    data: params.toString(),
    headers
  });
  updateCookies(loginRes.headers);

  return typeof loginRes.data === 'string' ? loginRes.data : '';
}

export async function directGetEventHubEvents(creds?: { username?: string; password?: string }): Promise<any> {
  let html = await loginEventHub(creds);
  if (!html.includes('id="events"')) {
    // Retry login once
    html = await loginEventHub(creds);
  }

  const $ = cheerio.load(html || '');
  const events: any[] = [];

  $('#events .card').each((_, cardElem) => {
    const card = $(cardElem);
    const title = card.find('.card-title span').text().trim() || card.find('.card-title').text().trim();
    if (!title) return;

    let participantType = '';
    const vitianSpan = card.find('i.fa-people-carry-box, i.fa-user-check, i.fa-user-large').parent();
    if (vitianSpan.length) participantType = vitianSpan.text().trim();

    let date = '';
    const dateIcon = card.find('i.fa-calendar-days');
    if (dateIcon.length) date = dateIcon.parent().text().trim();

    let venue = '';
    const venueIcon = card.find('i.fa-map-location-dot');
    if (venueIcon.length) venue = venueIcon.parent().text().trim();

    let fees = '';
    const feeIcon = card.find('i.fa-indian-rupee-sign');
    if (feeIcon.length) fees = feeIcon.parent().text().trim();

    let teamSize = '1';
    const teamIcon = card.find('i.fa-users, i.fa-street-view');
    if (teamIcon.length) teamSize = teamIcon.parent().text().trim();

    let eid = '';
    const viewBtn = card.find('button[name="eid"]');
    if (viewBtn.length) {
      eid = (viewBtn.val() as string) || '';
    } else {
      const anyEid = card.find('[name="eid"], [value*="eventPreview"]').first();
      if (anyEid.length) eid = (anyEid.val() as string) || '';
    }

    const isFree = fees.toLowerCase().includes('free') || fees === '0';
    const posterUrl = eid ? `${EVENTHUB_BASE_URL}/EventHub/image/?id=${eid}` : '';

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

  const categories: { id: string; name: string }[] = [];
  $('#typeEvent option').each((_, opt) => {
    const val = $(opt).attr('value');
    const text = $(opt).text().trim();
    if (val && val !== '0' && text) {
      categories.push({ id: val, name: text });
    }
  });

  return { status: 'success', events, categories, message: '' };
}

export async function directGetEventHubPreview(eid: string, creds?: { username?: string; password?: string }): Promise<any> {
  await loginEventHub(creds);

  const params = new URLSearchParams();
  params.append('typeEvent', '0');
  params.append('categoryType', '');
  params.append('eid', eid);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': `${EVENTHUB_BASE_URL}/EventHub/mainDashboard`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  };
  const cookieStr = getCookieHeader();
  if (cookieStr) headers['Cookie'] = cookieStr;

  const res = await CapacitorHttp.post({
    url: `${EVENTHUB_BASE_URL}/EventHub/eventPreview`,
    data: params.toString(),
    headers
  });
  updateCookies(res.headers);

  const html = typeof res.data === 'string' ? res.data : '';
  const $ = cheerio.load(html);
  const details: Record<string, string> = {};

  $('.eventDetails ol li').each((_, li) => {
    const key = $(li).find('.fw-bold').text().trim().toLowerCase();
    const val = $(li).find('div > span').text().trim() || $(li).find('span').last().text().trim();
    if (key) details[key] = val;
  });

  const totalFees = ($('#EventFees1').val() as string) || details['total fees'] || '';
  const registerBtn = $('button[formaction*="registerEvent"]').first();
  const registerEid = (registerBtn.val() as string) || eid;

  const preview = {
    eid,
    title: details['event name'] || '',
    description: details['event description'] || '',
    participants: details['participants'] || '1',
    date: details['event date'] || '',
    venue: details['event venue'] || '',
    time: details['event time'] || '',
    conductedBy: details['conducted by'] || '',
    totalFees: totalFees || 'Free',
    posterUrl: `${EVENTHUB_BASE_URL}/EventHub/image/?id=${eid}`,
    registerEid
  };

  return { status: 'success', details, preview };
}

export async function directGetEventHubProfile(creds?: { username?: string; password?: string }): Promise<any> {
  await loginEventHub(creds);

  const headers: Record<string, string> = {
    'Referer': `${EVENTHUB_BASE_URL}/EventHub/mainDashboard`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  };
  const cookieStr = getCookieHeader();
  if (cookieStr) headers['Cookie'] = cookieStr;

  const res = await CapacitorHttp.get({
    url: `${EVENTHUB_BASE_URL}/EventHub/profile`,
    headers
  });
  updateCookies(res.headers);

  const html = typeof res.data === 'string' ? res.data : '';
  const $ = cheerio.load(html);

  const userId = ($('#userId').val() as string) || '';
  const name = ($('#name').val() as string) || '';
  const email = ($('#email').val() as string) || '';
  const phone = ($('#phNo').val() as string) || '';
  const college = ($('#clg').val() as string) || '';

  const teams: { id: string; name: string; size: string }[] = [];
  $('#teamTable tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 3) {
      const id = $(tds[0]).text().trim();
      const tName = $(tds[1]).text().trim();
      const size = $(tds[2]).text().trim();
      if (id) teams.push({ id, name: tName, size });
    }
  });

  const registeredEvents: any[] = [];
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
          receiptUrl: receiptA ? `${EVENTHUB_BASE_URL}${receiptA}` : undefined,
          certificateUrl: certA ? `${EVENTHUB_BASE_URL}${certA}` : undefined
        });
      }
    }
  });

  return {
    status: 'success',
    profile: {
      userId,
      name,
      email,
      phone,
      college,
      teams,
      registeredEvents
    }
  };
}

export async function directRegisterEventHubFree(
  eid: string,
  typeOfEvent: string = '1',
  creds?: { username?: string; password?: string }
): Promise<any> {
  await loginEventHub(creds);

  const params = new URLSearchParams();
  params.append('id', eid);
  params.append('EventFees1', '0');
  params.append('EventFees2', '0');
  params.append('typeOfEvent', typeOfEvent);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': `${EVENTHUB_BASE_URL}/EventHub/eventPreview`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  };
  const cookieStr = getCookieHeader();
  if (cookieStr) headers['Cookie'] = cookieStr;

  const res = await CapacitorHttp.post({
    url: `${EVENTHUB_BASE_URL}/EventHub/registerEvent`,
    data: params.toString(),
    headers
  });
  updateCookies(res.headers);

  const html = typeof res.data === 'string' ? res.data : '';
  const $ = cheerio.load(html);
  const swalMatch = html.match(/Swal\.fire\(\{[\s\S]*?text:\s*["']([^"']+)["']/i);
  const alertText = $('.alert').text().trim() || $('p.error').text().trim();

  if (swalMatch && swalMatch[1]) {
    const isError = html.includes('icon: "error"') || html.includes("icon: 'error'");
    return {
      status: isError ? 'error' : 'success',
      message: swalMatch[1]
    };
  }

  if (alertText) {
    const isError = alertText.toLowerCase().includes('already') || alertText.toLowerCase().includes('error');
    return {
      status: isError ? 'error' : 'success',
      message: alertText
    };
  }

  return { status: 'success', message: 'Registration submitted successfully!' };
}
