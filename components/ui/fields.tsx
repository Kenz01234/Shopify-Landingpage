import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-3">optional</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-coral-ink" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.82rem] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-3/70 transition focus:outline-none focus:ring-2 focus:ring-coral/30 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputBase, invalid ? "border-coral" : "border-line-strong focus:border-coral/60", className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "min-h-24 leading-relaxed", invalid ? "border-coral" : "border-line-strong focus:border-coral/60", className)}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputBase, "appearance-none bg-[length:16px] bg-[right_0.8rem_center] bg-no-repeat pr-9", invalid ? "border-coral" : "border-line-strong", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23736d66' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="text-[0.82rem] text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50",
          checked ? "border-coral-strong bg-coral-strong" : "border-line-strong bg-surface-3",
        )}
      >
        <span className={cn("absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  text,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-2xl border p-4 transition",
        checked ? "border-coral/60 bg-coral-soft/50 ring-1 ring-coral/30" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 size-4 accent-[var(--coral-strong)]" />
      <span className="flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {text && <span className="mt-0.5 block text-sm text-ink-3">{text}</span>}
        {children}
      </span>
    </label>
  );
}
