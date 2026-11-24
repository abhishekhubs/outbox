import { Router } from 'express';
import * as emailController from '../controllers/email.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All email routes require authentication
router.use(authenticate);

router.post('/schedule', emailController.scheduleEmails);
router.get('/scheduled', emailController.getScheduledEmails);
router.get('/sent', emailController.getSentEmails);
router.get('/lookup-recipient', emailController.lookupRecipient);
router.get('/:id/attachments/:index', emailController.downloadAttachment);
router.get('/:id', emailController.getEmailById);
router.post('/:id/cancel', emailController.cancelEmail);

export default router;
