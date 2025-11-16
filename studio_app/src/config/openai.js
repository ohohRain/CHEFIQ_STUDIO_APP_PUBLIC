import OpenAI from 'openai';

// Load OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
  console.error('[OpenAI Config] API key not configured!');
  console.error('[OpenAI Config] Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
  console.error('[OpenAI Config] See CLAUDE.md for setup instructions');
}

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Check if API key is configured
export const isConfigured = () => {
  return OPENAI_API_KEY && OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY';
};

export default openai;
