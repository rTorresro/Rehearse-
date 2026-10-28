import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "web/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["server/**/*.ts", "shared/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  // next's rules only make sense inside the web app
  ...nextVitals.map((config) => ({ ...config, files: ["web/**/*.{ts,tsx,js,jsx}"] })),
  {
    files: ["web/**/*.{ts,tsx,js,jsx}"],
    settings: { next: { rootDir: "web/" } },
  },
  // keep this last so prettier owns formatting
  prettier,
);
