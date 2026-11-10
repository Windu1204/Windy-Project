import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key, { global:{fetch:async(input,init)=>{const response=await fetch(input,init);if(response.status===401){void response.clone().json().then(body=>{if(body?.message?.includes('WCI_SESSION_EXPIRED'))window.dispatchEvent(new Event('wci-session-expired'));}).catch(()=>{});}return response;}}, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
