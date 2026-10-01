'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { Role } from '@/types';

/**
 * Derives the active organization id + role for the signed-in user.
 * The role is stored on the Clerk public metadata / unsafe metadata by the
 * backend during the Clerk webhook user sync (see auth.service.upsertFromClerk).
 * First active org id is taken from the private metadata `organizationId`.
 */
export function useOrgRole(): { role: Role | undefined; organizationId: string | null } {
  const { user } = useUser();
  const setOrganizationId = useAppStore((s) => s.setOrganizationId);
  const storedOrgId = useAppStore((s) => s.organizationId);

  const md = (user?.publicMetadata || {}) as Record<string, any>;
  const role = (md.role as Role) || undefined;
  const metaOrgId = (md.organizationId as string) || null;

  useEffect(() => {
    if (metaOrgId && metaOrgId !== storedOrgId) setOrganizationId(metaOrgId);
  }, [metaOrgId, storedOrgId, setOrganizationId]);

  return { role, organizationId: storedOrgId || metaOrgId };
}
