import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      'playwright-report/**/*',
      'coverage/**/*',
      'dist/**/*',
      'build/**/*',
      '**/*.bundle.js',
      '**/node_modules/**',

      // ✅ ADD THESE - Next.js generated files
      '.next/**/*',
      'next-env.d.ts',
      
      // Optional: Other common generated files
      'out/**/*',
      '.vercel/**/*',
      '.turbo/**/*'
    ],
  },
  {
    files: ["tests/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

/* istanbul ignore next */
export default eslintConfig;
