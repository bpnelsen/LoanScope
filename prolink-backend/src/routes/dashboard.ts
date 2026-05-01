import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { requireAuth, requireContractor } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireContractor);

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await dashboardService.getSummary(req.user!.contractor_id!);
    res.json({ data: summary });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch summary' });
  }
});

router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const revenue = await dashboardService.getRevenue(req.user!.contractor_id!, year);
    res.json({ data: revenue });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch revenue' });
  }
});

router.get('/leads', async (req: Request, res: Response) => {
  try {
    const leads = await dashboardService.getLeads(req.user!.contractor_id!);
    res.json({ data: leads });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch lead stats' });
  }
});

export default router;
