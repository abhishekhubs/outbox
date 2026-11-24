import { Router } from 'express';
import * as campaignController from '../controllers/campaign.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);

export default router;
