import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // JSX text is always auto-escaped by React regardless of literal vs. entity, so
  // this rule was never about injection safety — scope it to '>' and '}', which
  // still catch a real legibility class of mistake (stray characters read as JSX).
  { rules: { "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
