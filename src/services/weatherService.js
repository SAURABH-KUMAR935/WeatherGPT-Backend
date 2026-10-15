import 'dotenv/config';

export const DEFAULT_LOCATION = 'Jamui, Bihar';
export const DEFAULT_LAT = 25.3136;
export const DEFAULT_LON = 86.1805;

export const weatherKeywords = [
  'weather', 'temperature', 'temp', 'forecast', 'rain', 'sunny',
  'cloudy', 'wind', 'humidity', 'hot', 'cold', 'climate'
];

export function isWeatherQuestion(input) {
  const lowerInput = input.toLowerCase();
  return weatherKeywords.some(keyword => lowerInput.includes(keyword));
}

export async function getWeatherData(location = DEFAULT_LOCATION) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=yes`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const data = await response.json();

    return {
      location: data.location.name,
      country: data.location.country,
      temperature: data.current.temp_c,
      feelsLike: data.current.feelslike_c,
      humidity: data.current.humidity,
      windSpeed: data.current.wind_kph,
      condition: data.current.condition.text,
      lastUpdated: data.current.last_updated
    };
  } catch (error) {
    console.error('Error fetching weather:', error.message);
    return null;
  }
}

const PM25_AQI_BREAKPOINTS = [
  { concentrationLow: 0, concentrationHigh: 9, indexLow: 0, indexHigh: 50 },
  { concentrationLow: 9.1, concentrationHigh: 35.4, indexLow: 51, indexHigh: 100 },
  { concentrationLow: 35.5, concentrationHigh: 55.4, indexLow: 101, indexHigh: 150 },
  { concentrationLow: 55.5, concentrationHigh: 125.4, indexLow: 151, indexHigh: 200 },
  { concentrationLow: 125.5, concentrationHigh: 225.4, indexLow: 201, indexHigh: 300 },
  { concentrationLow: 225.5, concentrationHigh: 325.4, indexLow: 301, indexHigh: 500 }
];

export function calculatePm25Aqi(concentration) {
  if (!Number.isFinite(concentration) || concentration < 0) return null;

  const truncatedConcentration = Math.floor((concentration + Number.EPSILON) * 10) / 10;
  if (truncatedConcentration > 325.4) return 500;

  const breakpoint = PM25_AQI_BREAKPOINTS.find(({ concentrationLow, concentrationHigh }) =>
    truncatedConcentration >= concentrationLow && truncatedConcentration <= concentrationHigh
  );
  if (!breakpoint) return null;

  const interpolatedIndex =
    ((breakpoint.indexHigh - breakpoint.indexLow) /
      (breakpoint.concentrationHigh - breakpoint.concentrationLow)) *
      (truncatedConcentration - breakpoint.concentrationLow) +
    breakpoint.indexLow;

  return Math.round(interpolatedIndex);
}

export async function getWeatherByCoordinates(lat, lon) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=yes`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Location not found');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error('Failed to fetch weather data');
    }

    const data = await response.json();

    return {
      location: {
        name: data.location.name,
        region: data.location.region,
        country: data.location.country,
        latitude: data.location.lat,
        longitude: data.location.lon
      },
      temperature: Math.round(data.current.temp_c),
      feelsLike: Math.round(data.current.feelslike_c),
      humidity: data.current.humidity,
      windSpeed: data.current.wind_kph,
      precipitationMm: data.current.precip_mm,
      airQualityIndex: calculatePm25Aqi(data.current.air_quality?.pm2_5),
      pm2_5: Number.isFinite(data.current.air_quality?.pm2_5)
        ? data.current.air_quality.pm2_5
        : null,
      weather: data.current.condition.text
    };
  } catch (error) {
    console.error('Error fetching weather by coordinates:', error.message);
    throw error;
  }
}

export async function searchWeatherLocations(query) {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('Weather service is not configured');
  }

  const url = new URL('https://api.weatherapi.com/v1/search.json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key');
    }
    throw new Error('Failed to search locations');
  }

  const locations = await response.json();
  return locations.map(location => ({
    id: location.id,
    name: location.name,
    region: location.region,
    country: location.country,
    lat: location.lat,
    lon: location.lon
  }));
}

export async function getForecastByCoordinates(lat, lon) {
  const apiKey = process.env.FORECAST_API_KEY;

  if (!apiKey) {
    throw new Error('Weather service is not configured , no api key found');
  }

  const url = new URL('https://api.weatherapi.com/v1/forecast.json?');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', `${lat},${lon}`);
  url.searchParams.set('days', '7');
  url.searchParams.set('aqi', 'no');
  url.searchParams.set('alerts', 'yes');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Location not found');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key');
    }
    throw new Error('Failed to fetch weather forecast');
  }

  const data = await response.json();
  const hourly = data.forecast.forecastday.flatMap(day => day.hour);
  const localTime = data.location.localtime;

  return {
    location: {
      name: data.location.name,
      country: data.location.country,
      localTime
    },
    alerts: (data.alerts?.alert || []).map(alert => ({
      headline: alert.headline,
      event: alert.event,
      severity: alert.severity,
      urgency: alert.urgency,
      description: alert.desc,
      instruction: alert.instruction
    })),
    hourly: hourly
      .filter(hour => hour.time >= localTime)
      .slice(0, 8)
      .map(hour => ({
        time: hour.time,
        temperature: Math.round(hour.temp_c),
        condition: hour.condition.text,
        precipitation: hour.chance_of_rain,
        precipitationMm: Math.round(hour.precip_mm * 10) / 10,
        humidity: Math.round(hour.humidity),
        windSpeed: Math.round(hour.wind_kph)
      })),
    daily: data.forecast.forecastday.map(day => ({
      date: day.date,
      maxTemperature: Math.round(day.day.maxtemp_c),
      minTemperature: Math.round(day.day.mintemp_c),
      condition: day.day.condition.text,
      chanceOfRain: day.day.daily_chance_of_rain,
      precipitationMm: day.day.totalprecip_mm,
      humidity: Math.round(day.day.avghumidity),
      maxWindSpeed: Math.round(day.day.maxwind_kph),
      sunrise: day.astro?.sunrise ?? null,
      sunset: day.astro?.sunset ?? null
    }))
  };
}

export async function getSoilPropertiesByCoordinates(lat, lon) {
  const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query');
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('lat', String(lat));
  ['phh2o', 'soc', 'nitrogen'].forEach(property => {
    url.searchParams.append('property', property);
  });
  ['0-5cm', '5-15cm'].forEach(depth => {
    url.searchParams.append('depth', depth);
  });
  url.searchParams.set('value', 'mean');

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(`SoilGrids request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.properties?.layers)) {
    throw new Error('SoilGrids returned an invalid properties response');
  }

  return {
    coordinates: data.geometry?.coordinates ?? [lon, lat],
    source: 'SoilGrids',
    layers: data.properties.layers.map(layer => {
      const divisor = Number(layer.unit_measure?.d_factor);
      return {
        name: layer.name,
        unit: layer.unit_measure?.target_units ?? '',
        depths: (layer.depths || []).map(depth => {
          const value = depth.values?.mean;
          return {
            label: depth.label,
            value: Number.isFinite(value) && Number.isFinite(divisor) && divisor > 0
              ? value / divisor
              : null
          };
        })
      };
    })
  };
}

export async function getHistoricalWeatherByCoordinates(lat, lon) {
  const apiKey = process.env.FORECAST_API_KEY;
  if (!apiKey) {
    throw new Error('Weather service is not configured');
  }

  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - 7 + index);
    return date.toISOString().slice(0, 10);
  });

  const history = await Promise.all(dates.map(async date => {
    const url = new URL('https://api.weatherapi.com/v1/history.json');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', `${lat},${lon}`);
    url.searchParams.set('dt', date);

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key');
      }
      if (response.status === 400 || response.status === 404) {
        throw new Error('Historical weather is unavailable for this date');
      }
      throw new Error('Failed to fetch historical weather data');
    }

    const data = await response.json();
    const day = data.forecast?.forecastday?.[0]?.day;
    if (!day) {
      throw new Error(`Historical weather data is missing for ${date}`);
    }

    const hourly = data.forecast.forecastday[0].hour || [];
    const averageCloudCover = hourly.length
      ? hourly.reduce((sum, hour) => sum + hour.cloud, 0) / hourly.length
      : null;
    const averageWindSpeed = hourly.length
      ? hourly.reduce((sum, hour) => sum + hour.wind_kph, 0) / hourly.length
      : null;

    return {
      location: {
        name: data.location.name,
        country: data.location.country
      },
      date,
      minTemperature: Math.round(day.mintemp_c * 10) / 10,
      maxTemperature: Math.round(day.maxtemp_c * 10) / 10,
      averageTemperature: Math.round(day.avgtemp_c * 10) / 10,
      precipitationMm: Math.round(day.totalprecip_mm * 10) / 10,
      humidity: Math.round(day.avghumidity),
      cloudCover: averageCloudCover === null ? null : Math.round(averageCloudCover),
      averageWindSpeed: averageWindSpeed === null ? null : Math.round(averageWindSpeed * 10) / 10,
      maxWindSpeed: Math.round(day.maxwind_kph * 10) / 10
    };
  }));

  return {
    location: history[0]?.location || { latitude: lat, longitude: lon },
    days: history.map(({ location, ...day }) => day)
  };
}
