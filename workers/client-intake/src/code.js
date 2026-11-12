// Access-code alphabet and normalisation, shared by the worker and scripts/provision.mjs.
// 8 characters from 31 symbols (~8.5e11 combinations). No 0/O, 1/I/L.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export function normalizeCode(input) {
  return typeof input === 'string' ? input.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '') : '';
}
