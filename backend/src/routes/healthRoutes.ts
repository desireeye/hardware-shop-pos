import { Router } from 'express';

import { successResponse } from '../utils/apiResponse.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json(successResponse('Hardware Shop API is running'));
});

export default router;
