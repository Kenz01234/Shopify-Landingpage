import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "approve" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex max-w-full items-center justify-center gap-2 text-center font-semibold transition-[background,color,border-color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-coral-strong text-white shadow-[0_12px_28px_-12px_rgba(213,48,45,0.75)] hover:bg-coral-deep hover:shadow-[0_16px_32px_-12px_rgba(213,48,45,0.8)]",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink/30 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  approve: "bg-ok text-white shadow-[0_10px_24px_-12px_rgba(27,127,69,0.8)] hover:brightness-110",
  danger: "border border-coral/40 bg-surface text-coral-ink hover:bg-coral-soft",
  dark: "bg-ink text-bg hover:opacity-90",
};

// min-h statt fester Höhe: lange Beschriftungen dürfen auf schmalen Bildschirmen umbrechen.
const sizes: Record<Size, string> = {
  sm: "min-h-9 rounded-full px-3.5 py-1.5 text-sm leading-tight",
  md: "min-h-11 rounded-full px-5 py-2 text-[0.95rem] leading-tight",
  lg: "min-h-13 rounded-full px-7 py-2.5 text-base leading-tight",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  shine?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", shine, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], shine && "btn-shine", className)}
      {...props}
    />
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  shine,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  shine?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], shine && "btn-shine", className)} {...rest}>
      {children}
    </Link>
  );
}
