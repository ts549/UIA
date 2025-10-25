import fs from "fs";
import path from "path";
import prettier from "prettier";
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Change {
  old: string;
  new: string;
}

interface PlanStep {
  file: string;
  action: string;
  reason?: string;
  target_range?: {
    start: number;
    end: number;
  };
  changes: Change[];
}

interface Plan {
  plan: PlanStep[];
  confidence?: number;
  explanation?: string;
}

/**
 * Normalize code by removing extra whitespace for comparison
 */
function normalizeCode(code: string): string {
  return code
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .trim();
}

/**
 * Find and replace code
 */
function replace(code: string, oldCode: string, newCode: string): { success: boolean; result: string } {
  // Try exact match first
  if (code.includes(oldCode)) {
    return { success: true, result: code.replace(oldCode, newCode) };
  }

  return { success: false, result: code };
}

/**
 * Applies code changes from the AI-generated plan to actual files
 * @param planResponse - The full response object from promptAgent containing the plan
 */
export async function applyChange(planResponse: Plan): Promise<void> {
  const { plan } = planResponse;

  if (!plan || !Array.isArray(plan)) {
    throw new Error("Invalid plan: 'plan' array is missing or invalid");
  }

  console.log(`\n🔧 Applying ${plan.length} modification(s)...\n`);

  for (const step of plan) {
    try {
      // Resolve file path relative to the project root (my-app directory)
      // Go up from server/src/utils/agent to the root, then into my-app
      const projectRoot = path.resolve(__dirname, '../../../../my-app');
      const filePath = path.resolve(projectRoot, step.file);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${step.file}`);
        console.error(`   Looked in: ${filePath}`);
        continue;
      }

      console.log(`📝 Modifying ${step.file}`);
      console.log(`   Reason: ${step.reason || 'N/A'}`);

      // Read the original file
      let code = fs.readFileSync(filePath, "utf-8");

      // Apply each change
      for (const change of step.changes) {
        if (!change.old || !change.new) {
          console.warn(`   ⚠️  Skipping invalid change (missing 'old' or 'new')`);
          continue;
        }

        // Try fuzzy replacement
        const result = replace(code, change.old, change.new);
        
        if (!result.success) {
          console.warn(`   ⚠️  Could not find code to replace:`);
          console.warn(`      Old: "${change.old.substring(0, 80)}..."`);
          console.warn(`      Normalized old: "${normalizeCode(change.old).substring(0, 80)}..."`);
          
          // Show a snippet of the actual file for debugging
          const normalizedFile = normalizeCode(code);
          const snippet = normalizedFile.substring(0, 200);
          console.warn(`      File starts with: "${snippet}..."`);
          continue;
        }

        code = result.result;
        console.log(`   ✓ Applied change`);
      }

      // Format the code using prettier
      try {
        // Determine parser based on file extension
        const fileExt = path.extname(filePath);
        let parser: string;

        switch (fileExt) {
          case '.ts':
          case '.tsx':
            parser = 'typescript';
            break;
          case '.js':
          case '.jsx':
            parser = 'babel';
            break;
          case '.css':
            parser = 'css';
            break;
          case '.json':
            parser = 'json';
            break;
          case '.html':
            parser = 'html';
            break;
          default:
            parser = 'typescript'; // default fallback
        }

        const formatted = await prettier.format(code, { parser });
        fs.writeFileSync(filePath, formatted, "utf-8");
        console.log(`   ✅ Successfully modified and formatted ${step.file}\n`);
      } catch (formatError) {
        // If formatting fails, write the unformatted code
        console.warn(`   ⚠️  Prettier formatting failed, writing unformatted code`);
        fs.writeFileSync(filePath, code, "utf-8");
        console.log(`   ✅ Successfully modified ${step.file} (unformatted)\n`);
      }
    } catch (error) {
      console.error(`❌ Error modifying ${step.file}:`, error);
      // Continue with next step instead of throwing
    }
  }

  console.log("🎉 All modifications complete!\n");
}

/**
 * Applies changes with a dry-run option to preview what would be changed
 * @param planResponse - The full response object from promptAgent
 * @param dryRun - If true, only logs what would be changed without modifying files
 */
export async function applyChangeWithPreview(
  planResponse: Plan,
  dryRun: boolean = false
): Promise<void> {
  const { plan } = planResponse;

  if (!plan || !Array.isArray(plan)) {
    throw new Error("Invalid plan: 'plan' array is missing or invalid");
  }

  if (dryRun) {
    console.log("\n🔍 DRY RUN - Preview of changes:\n");
    for (const step of plan) {
      console.log(`📝 Would modify: ${step.file}`);
      console.log(`   Action: ${step.action}`);
      console.log(`   Reason: ${step.reason || 'N/A'}`);
      console.log(`   Changes: ${step.changes.length} replacement(s)\n`);
    }
    console.log("✓ Dry run complete. No files were modified.\n");
  } else {
    await applyChange(planResponse);
  }
}
