import { Router } from 'express';
import * as slackController from '../controllers/slack.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Connect initiates OAuth, requires auth to associate state with user
router.get('/connect', authenticate, slackController.connectSlack);
// Callback is called by Slack OAuth redirect, public endpoint that validates state
router.get('/callback', slackController.slackCallback);
router.get('/status', authenticate, slackController.getSlackStatus);
router.post('/disconnect', authenticate, slackController.disconnectSlack);

export default router;
