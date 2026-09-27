"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RadioCard } from "@/components/ui/fields";
import { NewJobDialog } from "@/components/app/system-actions";

export function NewJobButton({ systems, demo }: { systems: { id: string; name: string; longformEnabled: boolean; shortsEnabled: boolean }[]; demo: boolean }) {
  const [pick, setPick] = useState(false);
  const [systemId, setSystemId] = useState<string | null>(systems.length === 1 ? systems[0].id : null);
  const [open, setOpen] = useState(false);
  const chosen = systems.find((s) => s.id === systemId);
  if (!systems.length) return null;
  return (
    <>
      <Button onClick={() => (systems.length === 1 ? setOpen(true) : setPick(true))}>
        <Plus className="size-4" aria-hidden /> Auftrag anlegen
      </Button>
      <Dialog
        open={pick}
        onClose={() => setPick(false)}
        title="Für welches System?"
        size="sm"
        footer={
          <Button
            disabled={!systemId}
            onClick={() => {
              setPick(false);
              setOpen(true);
            }}
          >
            Weiter
          </Button>
        }
      >
        <div className="space-y-2">
          {systems.map((s) => (
            <RadioCard key={s.id} name="sys" value={s.id} checked={systemId === s.id} onChange={setSystemId} title={s.name} />
          ))}
        </div>
      </Dialog>
      {chosen && (
        <NewJobDialog open={open} onClose={() => setOpen(false)} systemId={chosen.id} longformEnabled={chosen.longformEnabled} shortsEnabled={chosen.shortsEnabled} demo={demo} />
      )}
    </>
  );
}
