/**
 * API scope catalog (shared between server and client).
 *
 * Kept in a non-`.server.ts` module so the admin UI can render scope
 * checkboxes without dragging the bcrypt-using key generator into the
 * browser bundle.
 */
export type ApiScope =
  | 'orders:read'
  | 'orders:write'
  | 'submissions:read'
  | 'submissions:write'
  | 'returns:read'
  | 'returns:write'
  | 'broadcasts:write'
  | 'analytics:read';

export const ALL_SCOPES: ApiScope[] = [
  'orders:read',
  'orders:write',
  'submissions:read',
  'submissions:write',
  'returns:read',
  'returns:write',
  'broadcasts:write',
  'analytics:read',
];
