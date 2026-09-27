"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Zugänglicher Dialog auf Basis von <dialog> (Fokusfalle, Escape, Hintergrund inert). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dlg-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl",
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 id="dlg-title" className="font-display text-lg font-semibold tracking-[-0.02em]">
                {title}
              </h2>
              {description && <div className="mt-0.5 text-sm text-ink-3">{description}</div>}
            </div>
            <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Schließen">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
