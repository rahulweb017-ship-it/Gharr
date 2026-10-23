import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities beating earlier ones.
 * Lets a component expose a `className` prop that can genuinely override its
 * defaults instead of fighting them on specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
