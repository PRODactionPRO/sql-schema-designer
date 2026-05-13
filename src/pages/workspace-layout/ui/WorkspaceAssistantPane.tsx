import type { ReactNode } from 'react';
import { ArrowUp, Blocks, Mic, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/shared/ui/utils';
import { ASSISTANT_CHECKS } from '../model/workspace-mock-data';

export function AiAssistantPane() {
  return (
    <div className="flex h-full flex-col bg-[#f8f8f9]">
      <div className="min-h-0 flex-1 p-6">
        <div className="grid gap-3">
          {ASSISTANT_CHECKS.map((item, index) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Sparkles className="size-3.5 text-[#5d3df5]" />
                {item}
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#5d3df5]" style={{ width: `${70 - index * 15}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 pb-3">
        <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-[0_2px_15px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.05)]">
          <div className="inline-flex rounded-full border border-white bg-[#fcfcfc] px-3 py-1 text-xs text-slate-600">
            live-db-schema.json
          </div>
          <div className="flex h-14 items-start pt-3 text-sm text-[#bdc3ce]">Enter your query text</div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <RoundButton label="Attach">
                <Plus className="size-4" />
              </RoundButton>
              <RoundButton label="Blocks">
                <Blocks className="size-4" />
              </RoundButton>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="flex h-9 items-center gap-1.5 rounded-full bg-[#eeeff0] px-3 text-xs font-medium text-[#828293]">
                GPT-4o
              </button>
              <RoundButton label="Voice" muted>
                <Mic className="size-4" />
              </RoundButton>
              <RoundButton label="Send" strong>
                <ArrowUp className="size-4" />
              </RoundButton>
            </div>
          </div>
        </div>
        <div className="py-2 text-center text-[11px] text-[#8f98a8]">The AI assistant sometimes makes mistakes. Check its results.</div>
      </div>
    </div>
  );
}

function RoundButton({ label, children, muted, strong }: { label: string; children: ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        strong ? 'bg-[#cacad2] text-white' : muted ? 'bg-[#eeeff0] text-slate-500' : 'text-slate-500 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}
