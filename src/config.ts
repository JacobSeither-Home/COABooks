// Public settings. None of these are secrets: the Supabase publishable key only allows what the
// database's row-level security permits, and Google client IDs and browser API keys are meant to be
// served to the browser (the API key is restricted to this site in Google Cloud).
export const SUPABASE_URL = 'https://efojsjojrdopntomtqre.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_XH93uQp0aZRRFAm1Rx_6fA_hc6yWEqr'

export const GOOGLE_CLIENT_ID = '808466946096-1d0ihveg46ed2o8i3voo2qfof04pbstd.apps.googleusercontent.com'
export const GOOGLE_API_KEY = 'AIzaSyDtN93TwzWRKK7AMgKk5Dgk9Z_b9sTpiG8'
/** Google Cloud project number (the Picker's appId). */
export const GOOGLE_APP_ID = '808466946096'

export const driveConfigured = () => !!(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && GOOGLE_APP_ID)
