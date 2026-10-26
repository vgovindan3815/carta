export interface Crumb {
  label: string;
  href?: string;
}

export function deriveBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  if (segments[0] === 'programs') {
    const crumbs: Crumb[] = [{ label: 'Programs', href: '/programs' }];
    if (segments[1]) crumbs.push({ label: decodeURIComponent(segments[1]) });
    return crumbs;
  }

  if (segments[0] === 'agents') {
    const crumbs: Crumb[] = [{ label: 'Agents', href: '/agents' }];
    if (segments[1] === 'chat') crumbs.push({ label: 'Chat' });
    else if (segments[1]) crumbs.push({ label: decodeURIComponent(segments[1]) });
    return crumbs;
  }

  const label = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
  return [{ label }];
}

export function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Home';
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'programs' && segments[1]) return decodeURIComponent(segments[1]);
  if (segments[0] === 'agents' && segments[1] === 'chat') return 'Agent Chat';
  return segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
}
