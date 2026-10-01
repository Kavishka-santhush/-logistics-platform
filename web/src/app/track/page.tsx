'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageSearch, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TrackLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Truck className="h-6 w-6 text-primary" /> SwiftFreight Tracking
      </div>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Track your shipment</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Enter your tracking number or scan the QR code on your label.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`);
          }}
          className="flex gap-2"
        >
          <Input placeholder="TRK000001" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <Button type="submit">Track</Button>
        </form>
      </div>
    </div>
  );
}
