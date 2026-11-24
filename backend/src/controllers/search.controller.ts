import { Response, NextFunction } from 'express';
import { searchEmailsInES } from '../services/elasticsearch.service';
import type { AuthRequest } from '../middleware/auth';

export async function searchEmails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { q, status, campaignId, senderId, fromDate, toDate, page, limit } = req.query;

    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 20;

    const filters = {
      status: typeof status === 'string' ? (status as any) : undefined,
      campaignId: typeof campaignId === 'string' ? campaignId : undefined,
      senderId: typeof senderId === 'string' ? senderId : undefined,
      fromDate: typeof fromDate === 'string' ? new Date(fromDate) : undefined,
      toDate: typeof toDate === 'string' ? new Date(toDate) : undefined,
    };

    const result = await searchEmailsInES(
      userId,
      typeof q === 'string' ? q : '',
      filters,
      pageNum,
      limitNum
    );

    res.json({ success: true, data: result.hits, ...result });
  } catch (error) {
    next(error);
  }
}
