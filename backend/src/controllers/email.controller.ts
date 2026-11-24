import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as emailService from '../services/email.service';
import type { AuthRequest } from '../middleware/auth';
import type { EmailStatus } from '@prisma/client';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required').max(10000),
  recipientParams: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        content: z.string(), // base64
        contentType: z.string().optional(),
      })
    )
    .optional(),
  senderId: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start time format',
  }),
  delayBetweenEmails: z.coerce.number().int().min(500).max(60000).default(2000),
  hourlyLimit: z.coerce.number().int().min(1).max(2000).default(200),
  idempotencyKey: z.string().optional(),
});

export async function scheduleEmails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const validated = scheduleEmailSchema.parse(req.body);

    const result = await emailService.scheduleEmails({
      ...validated,
      userId,
    });

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.emailCount} emails`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getScheduledEmails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { status, campaignId, search, page, limit } = req.query;

    const filters = {
      status: status ? (String(status) as EmailStatus) : undefined,
      campaignId: campaignId ? String(campaignId) : undefined,
      search: search ? String(search) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    };

    const result = await emailService.getScheduledEmails(userId, filters);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getSentEmails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { campaignId, search, page, limit } = req.query;

    const filters = {
      campaignId: campaignId ? String(campaignId) : undefined,
      search: search ? String(search) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    };

    const result = await emailService.getSentEmails(userId, filters);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function lookupRecipient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) {
      res.json({ success: true, data: { email: '', name: null, avatar: null } });
      return;
    }
    const result = await emailService.lookupRecipientName(email);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id, index } = req.params;
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0) {
      res.status(400).json({ success: false, message: 'Invalid attachment index' });
      return;
    }

    const attachment = await emailService.getEmailAttachment(id, userId, idx);
    if (!attachment || !attachment.content) {
      res.status(404).json({
        success: false,
        message: 'Attachment content is not available for this email',
      });
      return;
    }

    const buffer = Buffer.from(attachment.content, 'base64');
    const isPreview = req.query.preview === '1';
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isPreview ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.filename)}"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function getEmailById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const email = await emailService.getEmailById(id, userId);
    res.json({ success: true, data: email });
  } catch (error) {
    next(error);
  }
}

export async function cancelEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const cancelled = await emailService.cancelEmail(id, userId);
    res.json({ success: true, message: 'Email cancelled successfully', data: cancelled });
  } catch (error) {
    next(error);
  }
}
