import { Hero } from "@/components/marketing/hero";
import { ScrollThread } from "@/components/marketing/scroll-thread";
import { LoopSection } from "@/components/marketing/sections/loop-section";
import { SplitSection } from "@/components/marketing/sections/split-section";
import { NicheCinema } from "@/components/marketing/sections/niche-cinema";
import { ApprovalDemo } from "@/components/marketing/sections/approval-demo";
import { Configurator } from "@/components/marketing/sections/configurator";
import { Pricing } from "@/components/marketing/sections/pricing";
import { FaqSection } from "@/components/marketing/sections/faq";
import { FinalCta } from "@/components/marketing/sections/final-cta";
import { StickyCta } from "@/components/marketing/sticky-cta";

export default function HomePage() {
  return (
    <div id="thread-root" className="relative">
      <ScrollThread containerId="thread-root" />
      <div className="relative z-[1]">
        <Hero />
        <LoopSection />
        <SplitSection />
        <NicheCinema />
        <ApprovalDemo />
        <Configurator />
        <Pricing />
        <FaqSection />
        <FinalCta />
      </div>
      <StickyCta />
    </div>
  );
}
