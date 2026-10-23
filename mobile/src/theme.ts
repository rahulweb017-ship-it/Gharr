/**
 * Design tokens, mirroring src/app/globals.css in the web app: construction
 * orange (`brand`) for primary actions, navy (`ink`) for structure and text,
 * green (`trust`) reserved for verification and success.
 */
export const colors = {
  brand50: "#fff5ed",
  brand100: "#ffe8d5",
  brand500: "#f76a1c",
  brand600: "#dc5210",
  brand700: "#b73e0d",

  ink50: "#f5f7fb",
  ink100: "#eaeef6",
  ink200: "#d3dbea",
  ink300: "#aab8d3",
  ink400: "#7d8fb3",
  ink500: "#5b6d94",
  ink600: "#465779",
  ink700: "#364463",
  ink900: "#0c2657",

  trust50: "#ecfdf3",
  trust600: "#16884a",

  danger50: "#fef2f2",
  danger600: "#dc2626",

  white: "#ffffff",
  background: "#f5f7fb",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;
