import { useEffect, useState, type ReactNode } from 'react';

/**
 * Render children only on the client. Use to avoid SSR errors in libraries
 * that reach into `window` or `document` during first render.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children() : fallback}</>;
}
