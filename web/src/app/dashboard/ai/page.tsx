'use client';

import { useState } from 'react';
import { Sparkles, Send, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAskFleetAssistant, useDemandForecast } from '@/lib/queries';
import { formatNumber } from '@/lib/utils';

export default function AIPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const chat = useAskFleetAssistant();
  const { data: forecast, isLoading } = useDemandForecast();

  const series: any[] = (forecast as any)?.series ?? (forecast as any)?.data ?? (Array.isArray(forecast) ? forecast : []);

  function ask() {
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    chat.mutate({ question: q }, {
      onSuccess: (res: any) => {
        const answer = res?.answer ?? res?.response ?? res?.data?.answer ?? JSON.stringify(res);
        setMessages((m) => [...m, { role: 'ai', text: String(answer) }]);
      },
      onError: () => setMessages((m) => [...m, { role: 'ai', text: 'Sorry, the assistant is unavailable right now.' }]),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="Fleet assistant and demand forecasting." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Fleet Assistant</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-3">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Ask about delays, utilisation, cost drivers, or anything across your operation.</p>}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                  <span className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.text}</span>
                </div>
              ))}
              {chat.isPending && <p className="text-xs text-muted-foreground">Thinking…</p>}
            </div>
            <div className="flex gap-2">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="e.g. Which routes are most at risk of delay this week?" />
              <Button onClick={ask} disabled={chat.isPending}><Send className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Demand Forecast</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading forecast…</p>
            ) : series.length === 0 ? (
              <p className="text-sm text-muted-foreground">No forecast available yet.</p>
            ) : (
              <div className="space-y-2">
                {series.slice(0, 12).map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="text-muted-foreground">{p.label ?? p.period ?? p.date}</span>
                    <span className="font-medium">{formatNumber(p.value ?? p.forecast ?? 0)} orders</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
