const { Router } = require('express');
const c = require('../controllers/fuel.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER');
const finance = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER');

router.get('/', c.list);
router.get('/cost-report', finance, c.costReport);
router.get('/efficiency', c.efficiencyComparison);
router.get('/anomalies', c.anomalies);
router.get('/budget', finance, c.budgetVsActual);
router.get('/cards', c.listCards);
router.post('/cards', manage, c.createCard);
router.patch('/cards/:id', manage, c.updateCard);
router.post('/bulk', manage, c.bulkImport);

router.get('/:id', c.get);
router.post('/', c.create);
router.delete('/:id', manage, c.remove);

module.exports = router;
