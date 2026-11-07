// Funzione Netlify che legge un calendario tramite link iCal (Google, Apple, Outlook, Proton, Nextcloud…)
// e restituisce SOLO gli intervalli occupati: niente titoli, luoghi o descrizioni.
// Il browser non può leggere quei link direttamente (i siti dei calendari lo bloccano), per questo passa da qui.
const ICAL = require('ical.js');

const MAX_BYTES = 3 * 1024 * 1024;   // calendari fino a 3 MB
const MAX_DAYS = 60;                 // finestra massima richiesta
const LIMIT_PER_HOUR = 60;
const hits = new Map();

const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Accetta solo indirizzi pubblici https (webcal:// diventa https://)
function cleanUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':')) return null;
  return u.toString();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { code: 'method', error: 'Usa POST.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { code: 'bad_request', error: 'Richiesta non valida.' }); }
  const url = cleanUrl(body.url);
  if (!url) return reply(400, { code: 'bad_url', error: 'Il link non è valido: deve iniziare con https:// o webcal://.' });
  const from = new Date(body.from), to = new Date(body.to);
  if (isNaN(from) || isNaN(to) || to <= from || (to - from) > MAX_DAYS * 86400000) return reply(400, { code: 'bad_range', error: 'Intervallo di date non valido.' });

  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || 'anon';
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (recent.length >= LIMIT_PER_HOUR) return reply(429, { code: 'rate_limited', error: 'Troppe richieste.' });
  recent.push(now); hits.set(ip, recent);

  let text;
  try {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Matricola-Calendar/1.0', Accept: 'text/calendar, */*' } });
    clearTimeout(timer);
    if (r.status === 404 || r.status === 401 || r.status === 403) return reply(502, { code: 'not_found', error: 'Il calendario non è accessibile: controlla che il link sia giusto e ancora valido.' });
    if (!r.ok) return reply(502, { code: 'upstream', error: 'Il servizio del calendario ha risposto con un errore.' });
    text = await r.text();
    if (text.length > MAX_BYTES) return reply(413, { code: 'too_big', error: 'Il calendario è troppo grande.' });
  } catch (e) {
    return reply(502, { code: 'upstream', error: 'Non riesco a raggiungere il calendario.' });
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) return reply(422, { code: 'not_ics', error: 'Il link non porta a un calendario iCal (.ics).' });

  try {
    const comp = new ICAL.Component(ICAL.parse(text));
    comp.getAllSubcomponents('vtimezone').forEach(tz => { try { ICAL.TimezoneService.register(tz); } catch {} });
    const vevents = comp.getAllSubcomponents('vevent');
    // Eventi principali per UID, poi collego le eccezioni (singole occorrenze modificate)
    const main = new Map(), exceptions = [];
    vevents.forEach(v => { if (v.hasProperty('recurrence-id')) exceptions.push(v); else main.set(v.getFirstPropertyValue('uid') || Math.random(), new ICAL.Event(v)); });
    exceptions.forEach(v => { const m = main.get(v.getFirstPropertyValue('uid')); if (m) { try { m.relateException(v); } catch {} } else main.set(Math.random(), new ICAL.Event(v)); });

    const busy = [];
    const isFree = c => String(c.getFirstPropertyValue('transp') || '').toUpperCase() === 'TRANSPARENT' || String(c.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED';
    const push = (s, e) => { if (e > from && s < to) busy.push([new Date(Math.max(s, from)).toISOString(), new Date(Math.min(e, to)).toISOString()]); };
    for (const ev of main.values()) {
      if (!ev.startDate || ev.startDate.isDate) continue;          // eventi "tutto il giorno" (compleanni, promemoria): non bloccano
      if (isFree(ev.component)) continue;
      if (ev.isRecurring()) {
        const it = ev.iterator(); let next, n = 0;
        while ((next = it.next()) && n < 5000) {
          n++;
          const occ = ev.getOccurrenceDetails(next);
          const s = occ.startDate.toJSDate(); if (s >= to) break;
          if (occ.item && isFree(occ.item.component)) continue;
          push(s, occ.endDate.toJSDate());
        }
      } else {
        push(ev.startDate.toJSDate(), (ev.endDate || ev.startDate).toJSDate());
      }
    }
    busy.sort((a, b) => a[0] < b[0] ? -1 : 1);
    return reply(200, { busy: busy.slice(0, 3000), events: busy.length });
  } catch (e) {
    console.error('Errore parsing ICS', e && e.message);
    return reply(422, { code: 'parse', error: 'Non riesco a leggere questo calendario.' });
  }
};
