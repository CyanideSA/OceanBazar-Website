const VISITOR_KEY = 'ob_visitor_id';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const probe = '__ob_vid_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Stable guest identity shared by /chat and the floating widget. */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  const store = safeStorage();
  let id = store?.getItem(VISITOR_KEY) || '';
  if (!id) {
    id = `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      store?.setItem(VISITOR_KEY, id);
    } catch {
      /* private mode / quota — keep in-memory id for this tab */
    }
  }
  return id;
}
