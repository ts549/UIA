import CryptoJS from "crypto-js";

/**
 * Generates a unique fingerprint ID based on file path, line, and column
 */
function generateFingerprintId(filePath: string, line: number, column: number) {
  // Sort keys recursively for deterministic serialization
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj).sort().reduce((result, key) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {} as Record<string, any>);
  };

  const data = {
    filePath,
    line,
    column
  };

  const sorted = sortKeys(data);
  const normalized = JSON.stringify(sorted);
  console.log('Input:', data);
  console.log('Sorted:', sorted);
  console.log('Normalized:', normalized);
  return CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex).slice(0, 12);
}

export default generateFingerprintId;