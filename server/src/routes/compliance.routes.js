const { Router } = require('express');
const c = require('../controllers/compliance.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const review = requireRoles('ORG_ADMIN', 'COMPLIANCE_OFFICER');

router.get('/dashboard', c.dashboard);
router.get('/audit-readiness', review, c.auditReadiness);

router.get('/documents', c.listDocs);
router.post('/documents', c.addDocument);
router.post('/documents/:id/review', review, c.review);
router.delete('/documents/:id', review, c.removeDoc);

router.get('/inspections', c.listInspections);
router.post('/inspections', c.submitInspection);

router.get('/incidents', c.listIncidents);
router.post('/incidents', c.reportIncident);
router.post('/incidents/:id/resolve', review, c.resolveIncident);

module.exports = router;
