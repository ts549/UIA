import CryptoJS from "crypto-js";

/**
 * Creates a deterministic fingerprint string
 * that is consistent between runtime and static index.
 *
 * @param input Unique string (e.g. file path, component name, props)
 * @returns short hash (12 chars)
 */
export function createFingerprint(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex).slice(0, 12);
}