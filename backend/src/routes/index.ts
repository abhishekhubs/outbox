import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import campaignRoutes from './campaign.routes';
import slackRoutes from './slack.routes';
import searchRoutes from './search.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/slack', slackRoutes);
router.use('/search', searchRoutes);
router.use('/health', healthRoutes);

export default router;
