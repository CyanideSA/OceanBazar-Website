/** Pure helper — keep out of client context modules to avoid webpack chunk ordering issues. */
export function routeKeyFromLocation(pathname: string, search: string) {
  return `${pathname}?${search}`;
}
