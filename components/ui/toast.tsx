"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type Toast = { id: number; tone: "ok" | "error" | "info"; title: string; text?: string };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Rückmeldungen erscheinen erst nach bestätigter Serverantwort – keine vorgetäuschten Erfolge. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.tone === "error" ? 9000 : 5500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="card-float pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3.5"
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.tone === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok-ink" />
              ) : t.tone === "error" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral" />
              ) : (
                <Info className="mt-0.5 size-5 shrink-0 text-info" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.text && <p className="mt-0.5 text-sm text-ink-3">{t.text}</p>}
              </div>
              <button className="text-ink-3 hover:text-ink" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))} aria-label="Hinweis schließen">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
