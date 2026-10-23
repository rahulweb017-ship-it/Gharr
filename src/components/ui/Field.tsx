import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Labelled form field. Every text input in the app uses these classes so the
 * height, radius and focus colour stay identical across forms.
 */

export const inputClass =
  "h-12 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-[15px] text-ink-900 outline-none " +
  "placeholder:text-ink-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 " +
  "aria-invalid:border-red-500 disabled:bg-ink-50 disabled:text-ink-400";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-400">{hint}</p>
      )}
    </div>
  );
}

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function TextInput({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClass, className)}
      {...props}
    />
  );
});

export function SelectInput({
  className,
  invalid,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(inputClass, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d8fb3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Field-level errors from the API's VALIDATION_FAILED details. */
export function fieldErrors(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) return {};
  const out: Record<string, string> = {};
  for (const item of details) {
    if (item && typeof item === "object" && "field" in item && "message" in item) {
      const field = String((item as { field: unknown }).field);
      if (!out[field]) out[field] = String((item as { message: unknown }).message);
    }
  }
  return out;
}
