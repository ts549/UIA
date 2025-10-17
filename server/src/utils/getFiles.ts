import fs from "fs";
import path from "path";

/**
 * Recursively gets all files with specific extensions in a directory
 */
function getFiles(dir: string,
                  extensions: string[] = ['.tsx', '.jsx'],
                  excludeDirs: string[] = ['node_modules', 'dist', 'build', '.git']) {

  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    console.warn(`Directory does not exist: ${dir}`);
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!excludeDirs.includes(item)) {
        files.push(...getFiles(fullPath, extensions, excludeDirs));
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export default getFiles;