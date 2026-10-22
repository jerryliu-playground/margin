import { useEffect, useState } from 'react';

export type Route = { name: 'list' } | { name: 'document'; id: string } | { name: 'not-found' };

/** Hash routes: "#/" is the list, "#/documents/<id>" is one document (Phase 1 decision 1). */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { name: 'list' };
  const match = /^\/documents\/([0-9a-f-]{36})$/.exec(path);
  return match?.[1] ? { name: 'document', id: match[1] } : { name: 'not-found' };
}

export const documentHref = (id: string) => `#/documents/${id}`;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
