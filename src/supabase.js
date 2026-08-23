import { createClient } from '@supabase/supabase-js';
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
// Keep the existing fallback so the current deployment does not suddenly stop working.
// The setup checker explicitly warns when Vercel environment variables are missing.
const SUPABASE_URL = ENV_SUPABASE_URL || 'https://aihtqibixooyafbivklo.supabase.co';
const SUPABASE_KEY = ENV_SUPABASE_KEY || 'sb_publishable_R8TTr6JAKXiTmwWaNawUKA_XyTYPexp';

export const supabaseConfig = { url: SUPABASE_URL, key: SUPABASE_KEY, envUrlConfigured: Boolean(ENV_SUPABASE_URL), envKeyConfigured: Boolean(ENV_SUPABASE_KEY) };
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 10 } } });

async function request(table, {method='GET', body, query='', prefer='return=representation'}={}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? {'Prefer': prefer} : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function dbList(table, query='?select=*') { return request(table,{query}); }
export async function dbInsert(table, rows) { return request(table,{method:'POST',body:rows}); }
export async function dbUpdate(table, query, patch) { return request(table,{method:'PATCH',query,body:patch,prefer:'return=representation'}); }
export async function dbDelete(table, query) { return request(table,{method:'DELETE',query,prefer:'return=minimal'}); }
export async function dbUpsert(table, rows) { return request(table,{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=representation'}); }


const SETUP_TABLES = [
  { name: 'wid_rooms', purpose: 'Active meeting rooms' },
  { name: 'wid_users', purpose: 'Users who entered the platform' },
  { name: 'wid_attendance', purpose: 'Meeting attendance records' },
  { name: 'wid_settings', purpose: 'Host/User password settings' }
];

function parseSupabaseError(status, text, table) {
  let data = null;
  try { data = JSON.parse(text); } catch {}
  const message = data?.message || text || `HTTP ${status}`;
  const code = data?.code || '';
  if (status === 404 && code === 'PGRST205') {
    return { status: 'missing', code, message, detail: `The table public.${table} is missing from the Supabase schema cache. Run supabase_schema.sql.` };
  }
  if (status === 401 || status === 403) {
    return { status: 'rls', code, message, detail: `Supabase reached public.${table}, but the request was blocked. Check RLS policies for anon/authenticated.` };
  }
  return { status: 'error', code, message, detail: `Supabase returned HTTP ${status} while checking public.${table}.` };
}

async function checkTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const text = await res.text();
    if (res.ok) return { table, status: 'ok', code: '', message: 'Table is reachable with the current publishable key.', detail: `public.${table} exists and can be queried.` };
    return { table, ...parseSupabaseError(res.status, text, table) };
  } catch (error) {
    return { table, status: 'network', code: '', message: error?.message || 'Network request failed.', detail: `Could not reach Supabase while checking public.${table}. Check the project URL, internet connection, and browser/network restrictions.` };
  }
}

export async function checkSupabaseSetup() {
  const env = [
    {
      name: 'VITE_SUPABASE_URL',
      configured: supabaseConfig.envUrlConfigured,
      value: supabaseConfig.envUrlConfigured ? 'Configured' : 'Missing (the app is using its built-in fallback URL)'
    },
    {
      name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      configured: supabaseConfig.envKeyConfigured,
      value: supabaseConfig.envKeyConfigured ? 'Configured' : 'Missing (the app is using its built-in fallback key)'
    }
  ];
  if (!SUPABASE_URL) return { ok: false, env, tables: [], summary: 'Supabase URL is missing.' };
  if (!SUPABASE_KEY) return { ok: false, env, tables: [], summary: 'Supabase publishable key is missing.' };
  const tables = await Promise.all(SETUP_TABLES.map(t => checkTable(t.name)));
  const missing = tables.filter(t => t.status === 'missing');
  const blocked = tables.filter(t => t.status === 'rls');
  const failed = tables.filter(t => !['ok', 'missing', 'rls'].includes(t.status));
  let summary = 'Supabase database setup is healthy.';
  if (missing.length) summary = `Missing table${missing.length > 1 ? 's' : ''}: ${missing.map(t => `public.${t.table}`).join(', ')}.`;
  else if (blocked.length) summary = `RLS is blocking access to: ${blocked.map(t => `public.${t.table}`).join(', ')}.`;
  else if (failed.length) summary = `Supabase checks failed for: ${failed.map(t => `public.${t.table}`).join(', ')}.`;
  return { ok: tables.every(t => t.status === 'ok') && env.every(e => e.configured), env, tables, summary };
}
