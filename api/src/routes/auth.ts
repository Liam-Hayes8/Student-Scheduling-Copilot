import { Router, Request, Response, NextFunction } from 'express';
import { createError } from '@/middleware/error';

const router = Router();

router.post('/validate-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw createError('Missing token', 400);
    }

    res.json({
      success: true,
      data: {
        valid: true,
        userId: 'temp-user-id',
        permissions: ['calendar.events']
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError('Missing refresh token', 400);
    }

    res.json({
      success: true,
      data: {
        accessToken: 'new-access-token',
        expiresIn: 3600
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;