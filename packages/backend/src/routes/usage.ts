import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { UsageService } from '../services/usage-service';

const router = Router();

router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const requestUserId = (req as any).user.id;
    const { userId } = req.params;

    if (requestUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access usage of another user' });
    }

    const month = new Date().toISOString().slice(0, 7);
    const usage = await UsageService.getUserUsage(userId as string, month);
    
    res.json(usage);
  } catch (error) {
    console.error('[USAGE] Error fetching usage:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
