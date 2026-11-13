// Public values only. The anon key is safe in the browser because Row Level Security protects the data.
window.ZWB_CONFIG = {
  SUPABASE_URL: 'https://jyfvrmyvyxfuuacsyvyr.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_RFcokdkd2lfqzlIdUi7aQA_hXAXslIv',
  DEFAULT_COUNTRY_CODE: '+91',
  SUPPORT_EMAIL: 'nexaforge83@gmail.com',
  POLICY_VERSION: '2026-11-v3',  // change this to ask every user to accept the policy again
  KG_PER_SERVING: 0.35,       // keep in sync with complete_donation() and the v2 functions in supabase/upgrade.sql
  CO2E_PER_KG: 2.5,           // estimated kg CO2e avoided per kg of food rescued
  SERVICE_FEE_PCT: 0.10       // keep in sync with reserve_donation() in supabase/upgrade.sql
};
