import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn("dotenv warning:", result.error.message);
}
