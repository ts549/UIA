import fs from "fs";
import glob from "fast-glob";
import { indexReactFile } from "./reactIndexer.ts";

const projectRoot = process.argv[2] || "../../src";
const files = glob.sync(`${projectRoot}/**/*.{js,jsx,ts,tsx}`);

const index: Record<string, any> = {};

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const nodes = indexReactFile(file, code);

  for (const node of nodes) {
    index[node.fingerprint] = node;
  }
}

fs.writeFileSync("./fingerprint_index.json", JSON.stringify(index, null, 2));
console.log(`✅ Indexed ${Object.keys(index).length} UI elements`);
