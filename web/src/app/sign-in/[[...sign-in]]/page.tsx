import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { Truck } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-6 w-6" /> SwiftFreight
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">Enterprise Logistics & Fleet Management</h1>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Real-time tracking, AI-optimized dispatch, compliance, and billing — for fleets of every size.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© 2026 SwiftFreight</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <SignIn routing="hash" />
        </Suspense>
      </div>
    </div>
  );
}
