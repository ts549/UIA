// Local declaration for `crypto-js` to silence TypeScript when no @types package is installed.
// This provides a minimal `any`-based surface. Replace with a proper .d.ts or install
// `@types/crypto-js` for more accurate typings if desired.

declare module 'crypto-js' {
  const CryptoJS: any;
  export default CryptoJS;
  export const AES: any;
  export const MD5: any;
  export const enc: any;
  export const lib: any;
}
