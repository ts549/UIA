import CryptoJS from "crypto-js";

/**
 * Generates a consistent fingerprint from any object
 */
export function createFingerprint(data: Record<string, any>): string {
  // Sort keys recursively for deterministic serialization
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj).sort().reduce((result: any, key: string) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
  };
  
  const sorted = sortKeys(data);
  const normalized = JSON.stringify(sorted);
  console.log('Input:', data);
  console.log('Sorted:', sorted);
  console.log('Normalized:', normalized);
  return CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex).slice(0, 12);
}
