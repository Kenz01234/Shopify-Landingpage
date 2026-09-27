import { Station } from "@/components/marketing/scroll-thread";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/cn";

export function SectionHeader({
  station,
  eyebrow,
  title,
  text,
  align = "left",
  className,
  id,
}: {
  station?: string;
  eyebrow: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  id?: string;
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <p className={cn("flex items-center gap-3", align === "center" && "justify-center")}>
        {station && <Station n={station} />}
        <span className="eyebrow">{eyebrow}</span>
      </p>
      <h2 id={id} className="mt-4 font-display text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.045em] text-ink">
        {title}
      </h2>
      {text && <p className="mt-4 text-lg text-ink-2">{text}</p>}
    </Reveal>
  );
}
