import { Router } from 'express';
import curriculumData from '../data/curriculum.json';

const router = Router();

router.get('/', (req, res) => {
  try {
    res.json(curriculumData);
  } catch (error) {
    console.error('[CURRICULUM] Error serving curriculum data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
