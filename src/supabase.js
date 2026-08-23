const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://aihtqibixooyafbivklo.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_R8TTr6JAKXiTmwWaNawUKA_XyTYPexp';

export const supabaseConfig = { url: SUPABASE_URL, key: SUPABASE_KEY };

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
