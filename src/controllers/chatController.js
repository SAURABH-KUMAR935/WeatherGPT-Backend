import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_LOCATION,
  getWeatherData,
  isWeatherQuestion
} from '../services/weatherService.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function chat(req, res) {
  try {
    const { message, location, weatherData: frontendWeatherData, language } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let weatherData = frontendWeatherData;
    if (!weatherData) {
      weatherData = await getWeatherData(location || DEFAULT_LOCATION);
    }

    let locationContext = '';
    if (weatherData) {
      const weatherInfo = frontendWeatherData
        ? `Current weather information for ${weatherData.location.name}, ${weatherData.location.country}:
- Temperature: ${weatherData.temperature}°C (feels like ${weatherData.feelsLike}°C)
- Condition: ${weatherData.weather}
- Humidity: ${weatherData.humidity}%
- Wind Speed: ${weatherData.windSpeed} km/h`
        : `Current weather information for ${weatherData.location}, ${weatherData.country}:
- Temperature: ${weatherData.temperature}°C (feels like ${weatherData.feelsLike}°C)
- Condition: ${weatherData.condition}
- Humidity: ${weatherData.humidity}%
- Wind Speed: ${weatherData.windSpeed} km/h
- Last Updated: ${weatherData.lastUpdated}`;

      locationContext = `${weatherInfo}\n\n`;
    }

    const responseLanguage = {
      en: 'English',
      hi: 'Hindi using Devanagari script',
      bn: 'Bengali using Bengali script',
      mr: 'Marathi using Devanagari script',
      te: 'Telugu using Telugu script',
      ta: 'Tamil using Tamil script'
    }[language] || 'English';
    const languageInstruction = `Respond in ${responseLanguage}. Keep proper names and units clear, and do not switch to English unless the user explicitly asks.`;
    const enhancedPrompt = `${languageInstruction}

${locationContext}User message: ${message}

${isWeatherQuestion(message)
  ? 'Please answer the user\'s question using the weather data provided above. If the question is about a different location, let me know and I can fetch that location\'s weather.'
  : 'The user is asking a general question. You have the current weather data for their location available. Use this context if relevant to their question.'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: enhancedPrompt
    });

    return res.json({
      response: response.text,
      isWeatherQuery: isWeatherQuestion(message)
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
}
