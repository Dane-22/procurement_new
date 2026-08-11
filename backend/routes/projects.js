import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getBranches } from '../utils/branchProjects.js';
import { getLockedOrderNumbers } from '../utils/orderNumberLocks.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const branches = await getBranches();
    const lockedOrderNumbers = await getLockedOrderNumbers(
      branches.map((branch) => branch.order_number)
    );
    const enrichedBranches = branches.map((branch) => ({
      ...branch,
      is_locked_order: lockedOrderNumbers.has(String(branch.order_number || '').trim())
    }));
    res.json(enrichedBranches);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to fetch projects'
    });
  }
});

export default router;
