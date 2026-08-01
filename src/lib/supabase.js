import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://pkyeytypgifgyiartgii.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_lchh9HW3bAxH4-zzZERUWg_Fv0MtvGN";
export const SHARED_LOGIN_EMAIL = "rafaelromero.dev@gmail.com";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
