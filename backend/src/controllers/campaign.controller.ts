import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import type { AuthRequest } from '../middleware/auth';

export async function getCampaigns(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { scheduledEmails: true },
        },
      },
    });

    res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { scheduledEmails: true },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' },
      });
      return;
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
}
