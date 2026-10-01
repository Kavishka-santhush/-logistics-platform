const { Router } = require('express');
const c = require('../controllers/invoice.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const finance = requireRoles('ORG_ADMIN', 'FINANCE_MANAGER');

router.get('/', c.list);
router.get('/kpis', c.kpis);
router.get('/aging', finance, c.agingReport);
router.post('/generate', finance, c.generate);
router.post('/generate-all', finance, c.generateAll);

router.get('/:id', c.get);
router.patch('/:id', finance, c.update);
router.post('/:id/lines', finance, c.addLine);
router.delete('/:id/lines/:lineId', finance, c.removeLine);
router.post('/:id/send', finance, c.send);
router.post('/:id/cancel', finance, c.cancel);
router.post('/:id/pdf', finance, c.renderPdf);
router.post('/:id/payments', finance, c.recordPayment);
router.post('/:id/payment-link', finance, c.createPaymentLink);
router.post('/:id/credit-notes', finance, c.issueCreditNote);
router.post('/payments/:paymentId/refund', finance, c.refundPayment);

module.exports = router;
