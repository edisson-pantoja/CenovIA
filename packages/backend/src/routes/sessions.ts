import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { UsageService } from '../services/usage-service';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const hasMinutes = await UsageService.hasMinutesRemaining(userId);

    if (!hasMinutes) {
      return res.status(403).json({ error: 'No free tier minutes remaining for this month' });
    }

    const sessionId = uuidv4();
    
    const month = new Date().toISOString().slice(0, 7);
    const usage = await UsageService.getUserUsage(userId, month);

    res.json({
      sessionId,
      usage
    });
  } catch (error) {
    console.error('[SESSIONS] Error creating session:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
