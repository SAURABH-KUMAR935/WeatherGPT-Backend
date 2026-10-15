import { Router } from 'express';
import { getChatHistory, saveChatMessages } from '../controllers/chatHistoryController.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);
router.get('/:channel', getChatHistory);
router.post('/:channel', saveChatMessages);

export default router;
