import { Reveal } from "@/components/marketing/reveal";

export function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-6 pt-36 sm:pt-44">
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] -z-10 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--peach),transparent)] opacity-80" aria-hidden />
      <Reveal className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1] tracking-[-0.05em]">{title}</h1>
        {text && <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2">{text}</p>}
      </Reveal>
    </section>
  );
}
