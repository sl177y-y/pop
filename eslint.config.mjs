import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from 'typescript-eslint'; // Added for TypeScript rules

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"), // Removed "next/typescript" as tseslint.configs.recommended will cover it
  ...tseslint.configs.recommended, // Add recommended TypeScript rules
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      // You might need to adjust other rules from next/core-web-vitals if they conflict
    },
  },
  // If you have specific files for Next.js pages/app router, you might want to scope next/core-web-vitals
  // For example:
  // {
  //   files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/pages/**/*.ts', 'src/pages/**/*.tsx'],
  //   ...compat.extends("next/core-web-vitals")[0] // Assuming it's an array with one config
  // }
];

export default eslintConfig;