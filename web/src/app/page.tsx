import Link from 'next/link';
import { Truck, Radar, Brain, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Truck className="h-5 w-5 text-primary" /> SwiftFreight
        </div>
        <div className="flex items-center gap-2">
          <Link href="/track">
            <Button variant="ghost" size="sm">Track a shipment</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Run your entire fleet from one command center
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Real-time GPS tracking, AI route optimization, dispatch, compliance, and billing — built for
            modern logistics operators.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg">Get started <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link href="/track">
              <Button size="lg" variant="outline">Track a package</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Radar, title: 'Live Tracking', body: 'Sub-second GPS with geofence & speed alerts.' },
            { icon: Brain, title: 'AI Optimized', body: 'Route, demand & maintenance intelligence.' },
            { icon: Truck, title: 'Fleet & Drivers', body: 'Vehicles, capacity, HOS and performance.' },
            { icon: ShieldCheck, title: 'Compliance', body: 'Documents, expiry alerts and audit-ready reports.' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © 2026 SwiftFreight — Enterprise Logistics Platform
      </footer>
    </div>
  );
}
