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
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "public/**/*.js",
      "lib/training/trainer_venv/**",
      "lib/training/llama.cpp/**",
      "lib/llmops-widget/dist/**",
      "scripts/**",
      "**/venv/**",
      ".venv/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "*.js",
      "!app/**/*.js",
      "!components/**/*.js",
      "!lib/**/*.js",
      "!hooks/**/*.js",
      "!contexts/**/*.js",
    ],
  },
];

export default eslintConfig;
