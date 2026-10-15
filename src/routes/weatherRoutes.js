import { Router } from 'express';
import {
  getCurrentWeather,
  getForecast,
  getHistoricalWeather,
  getSoilProperties,
  searchLocations
} from '../controllers/weatherController.js';

const router = Router();

router.get('/', getCurrentWeather);
router.get('/locations', searchLocations);
router.get('/forecast', getForecast);
router.get('/history', getHistoricalWeather);
router.get('/soil', getSoilProperties);

export default router;
