import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import config from '../config';

const supabase = createClient(
  config.supabaseUrl || '',
  config.supabaseServiceKey || ''
);

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Token verification error:', error);
    res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
};

export const verifyWebSocketToken = async (token: string): Promise<string | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('[AUTH] WS Token verification error:', error);
    return null;
  }
};
