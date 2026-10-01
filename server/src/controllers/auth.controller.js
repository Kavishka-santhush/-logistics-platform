const svc = require('../services/auth.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const me = h(async (req, res) => res.json(ok(await svc.me({ userId: req.userId }))));

const updateProfile = h(async (req, res) => res.json(ok(await svc.updateProfile({ userId: req.userId, ...req.body }))));

const setPushToken = h(async (req, res) => res.json(ok(await svc.setPushToken({ userId: req.userId, token: req.body.token }))));

const joinOrganization = h(async (req, res) => res.json(ok(await svc.joinOrganization({ userId: req.userId, organizationSlug: req.body.organizationSlug || req.body.slug }))));

const listUsers = h(async (req, res) => res.json(ok(await svc.listOrgUsers(req.organizationId, req.query))));

const inviteUser = h(async (req, res) => res.status(201).json(ok(await svc.inviteUser({ organizationId: req.organizationId, ...req.body }))));

module.exports = { me, updateProfile, setPushToken, joinOrganization, listUsers, inviteUser };
