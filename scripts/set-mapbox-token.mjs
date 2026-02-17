import fs from "node:fs";
import path from "node:path";

const token = process.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!token) {
  console.error("Missing env var: VITE_MAPBOX_ACCESS_TOKEN");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), ".env.production.local");
const content = `VITE_MAPBOX_ACCESS_TOKEN=${token}\n`;

fs.writeFileSync(envPath, content, "utf8");
console.log(`Wrote ${envPath}`);
