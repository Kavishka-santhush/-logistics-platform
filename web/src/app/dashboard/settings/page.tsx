'use client';

import { Settings as Gear, Building2, Globe } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@clerk/nextjs';
import { useOrgRole } from '@/lib/use-org-role';
import { humanize } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useUser();
  const { role } = useOrgRole();

  const profile = [
    { label: 'Name', value: user?.fullName ?? '—' },
    { label: 'Email', value: user?.primaryEmailAddress?.emailAddress ?? '—' },
    { label: 'Role', value: role ? humanize(role) : '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account and workspace preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {profile.map((p) => (
              <div key={p.label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium">{p.value}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">Manage your password, MFA and connected accounts from your account panel.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> Workspace</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Organization</span><span className="font-medium">{(user?.publicMetadata?.organizationName as string) ?? 'Default'}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Subscription</span><Badge variant="info">Business</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Distance unit</span><span className="font-medium">Kilometers</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Currency</span><span className="font-medium">EUR</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gear className="h-4 w-4" /> Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {['Email me about SLA breaches', 'Push notifications for new dispatches', 'Weekly performance report'].map((pref) => (
            <label key={pref} className="flex items-center justify-between">
              <span>{pref}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-input" />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
