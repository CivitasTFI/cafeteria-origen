import { Router } from 'express';

import { entregarCsrfToken } from '../middleware/csrf';

const router = Router();

router.get('/csrf-token', entregarCsrfToken);

export default router;