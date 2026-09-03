import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  geminiApiKey: process.env.GEMINI_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  freeTierMinutesPerMonth: parseInt(process.env.FREE_TIER_MINUTES_PER_MONTH || '30', 10) || 30,
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required.');
}

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.warn('[CONFIG] Supabase credentials not fully configured. Auth might fail.');
}

export default config;
