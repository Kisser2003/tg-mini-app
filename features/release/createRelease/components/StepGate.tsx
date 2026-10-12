"use client";

import { triggerHaptic } from "@/lib/telegram";

export function StepGate({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-control border border-omf-line-strong bg-omf-surface px-4 py-5">
      <h2 className="text-[18px] font-bold tracking-tight text-omf-ink">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-omf-graphite">{description}</p>
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onAction();
        }}
        className="omf-btn-primary mt-4 w-full"
      >
        {actionLabel}
      </button>
    </div>
  );
}
