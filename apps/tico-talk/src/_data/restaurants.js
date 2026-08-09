import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global data: reads every venue JSON file in _data/menus/ (one file per
// venue, matching the menus/{venueId} Firestore doc shape this'll move to
// once the real DB is wired up) and exposes them as `menus` in templates.
export default function () {
  const dir = path.join(__dirname, "menus");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
}
