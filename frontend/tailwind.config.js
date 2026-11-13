/** @type {import('tailwindcss').Config} */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  darkMode: "class",
  content: [
    path.resolve(__dirname, "./index.html"),
    path.resolve(__dirname, "./src/**/*.{ts,tsx,js,jsx}"),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
