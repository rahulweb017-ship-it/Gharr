import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

/**
 * Flat ESLint config.
 *
 * `next lint` is deprecated in Next 16 and prompts interactively, so the project
 * runs the ESLint CLI directly. FlatCompat bridges eslint-config-next, which is
 * still published in eslintrc form.
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "prisma/migrations/**",
      // The Expo app has its own tsconfig, lint and toolchain.
      "mobile/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Unused arguments prefixed with _ are a deliberate signal, not an oversight.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    /**
     * The portability rule that keeps phase 2 cheap: the service layer and the
     * shared contracts must stay free of Next and React, so they can lift into a
     * package the Expo app imports. Breaking this is what would quietly turn the
     * Android build into a rewrite.
     */
    files: ["src/server/services/**/*.ts", "src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-dom", "@/components/*", "@/lib/*"],
              message:
                "src/server/services and src/shared must stay framework-agnostic so they can be shared with the React Native app.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
