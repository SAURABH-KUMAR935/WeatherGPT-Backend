import { Router } from 'express';
import {
  farmerGPT,
  generateIrrigationAdvice,
  generateCropDiseaseRisk,
  generateRainWeatherAdvice,
  generateSowingHarvestingPlan
} from '../controllers/farmerGPTController.js';

const router = Router();

router.post('/', farmerGPT);
router.post('/irrigation-advice', generateIrrigationAdvice);
router.post('/crop-disease-risk', generateCropDiseaseRisk);
router.post('/rain-weather-advice', generateRainWeatherAdvice);
router.post('/sowing-harvesting-plan', generateSowingHarvestingPlan);

export default router;
