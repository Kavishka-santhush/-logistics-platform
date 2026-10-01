const prisma = require('./prisma');

/**
 * Generic organization-scoped CRUD factory built on the Prisma client.
 * Keeps domain services DRY for the 90% case (list / get / create / update / delete).
 *
 *   const vehicleCrud = crud('vehicle');
 *   vehicleCrud.list(orgId, { where, page, pageSize, orderBy, include })
 */
function crud(model, { scopeKey = 'organizationId' } = {}) {
  const delegate = () => prisma[model];

  return {
    async list(orgId, { where = {}, page = 1, pageSize = 25, orderBy = { createdAt: 'desc' }, include, select } = {}) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      const [data, total] = await Promise.all([
        delegate().findMany({
          where: { ...scope, ...where },
          orderBy,
          include,
          select,
          skip: (page - 1) * pageSize,
          take: Math.min(pageSize, 200),
        }),
        delegate().count({ where: { ...scope, ...where } }),
      ]);
      return { data, total, page, pageSize };
    },

    async byId(orgId, id, { include, select } = {}) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      return delegate().findFirst({ where: { id, ...scope }, include, select });
    },

    async create(orgId, data) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      return delegate().create({ data: { ...scope, ...data } });
    },

    async update(orgId, id, data) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      // ensure exists & belongs to org first
      await delegate().update({ where: { id }, data });
      return delegate().findUnique({ where: { id } });
    },

    async remove(orgId, id) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      return delegate().delete({ where: { id } });
    },

    async count(orgId, where = {}) {
      const scope = scopeKey ? { [scopeKey]: orgId } : {};
      return delegate().count({ where: { ...scope, ...where } });
    },
  };
}

module.exports = { crud };
