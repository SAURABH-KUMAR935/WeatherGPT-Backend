import {
  getForecastByCoordinates,
  getHistoricalWeatherByCoordinates,
  getSoilPropertiesByCoordinates,
  getWeatherByCoordinates,
  searchWeatherLocations
} from '../services/weatherService.js';

export async function getCurrentWeather(req, res) {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const weatherData = await getWeatherByCoordinates(lat, lon);
    return res.json(weatherData);
  } catch (error) {
    console.error('Error fetching weather:', error);

    if (error.message === 'Location not found') {
      return res.status(404).json({ error: 'Location not found' });
    }
    if (error.message === 'Invalid API key') {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function searchLocations(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ error: 'Search must be between 2 and 120 characters' });
  }

  try {
    const locations = await searchWeatherLocations(query);
    return res.json(locations);
  } catch (error) {
    console.error('Error searching locations:', error.message);
    return res.status(error.message === 'Invalid API key' ? 401 : 502).json({
      error: error.message === 'Invalid API key'
        ? 'Weather service API key is invalid'
        : 'Unable to search locations right now'
    });
  }
}

export async function getForecast(req, res) {
  const { lat, lon } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (
    lat === undefined || lon === undefined ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  try {
    const forecast = await getForecastByCoordinates(latitude, longitude);
    return res.json(forecast);
  } catch (error) {
    console.error('Error fetching forecast:', error.message);
    const statusCode = error.message === 'Location not found'
      ? 404
      : error.message === 'Invalid API key'
        ? 401
        : 502;
    return res.status(statusCode).json({
      error: statusCode === 404
        ? 'Location not found'
        : statusCode === 401
          ? 'Weather service API key is invalid'
          : 'Unable to load the forecast right now'
    });
  }
}

export async function getSoilProperties(req, res) {
  const { lat, lon } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (
    typeof lat !== 'string' || lat.trim() === '' ||
    typeof lon !== 'string' || lon.trim() === '' ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  try {
    const soilProperties = await getSoilPropertiesByCoordinates(latitude, longitude);
    return res.json(soilProperties);
  } catch (error) {
    console.error('Error fetching SoilGrids properties:', error.message);
    return res.status(502).json({ error: 'Unable to load SoilGrids soil data right now' });
  }
}

export async function getHistoricalWeather(req, res) {
  const { lat, lon } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (
    lat === undefined || lon === undefined ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  try {
    const history = await getHistoricalWeatherByCoordinates(latitude, longitude);
    return res.json(history);
  } catch (error) {
    console.error('Error fetching historical weather:', error.message);
    const statusCode = error.message === 'Invalid API key'
      ? 401
      : error.message === 'Historical weather is unavailable for this date'
        ? 422
        : error.message === 'Weather service is not configured'
          ? 503
          : 502;
    return res.status(statusCode).json({
      error: error.message === 'Invalid API key'
        ? 'Weather service API key is invalid'
        : error.message === 'Weather service is not configured'
          ? 'Weather service is not configured'
          : statusCode === 422
            ? 'Historical weather is unavailable for this date'
            : 'Unable to load historical weather data right now'
    });
  }
}
