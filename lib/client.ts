export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(options?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

export function refreshWorkspaceCounts(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sway:refresh-counts'));
  }
}

export function refreshNotifications(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sway:refresh-notifications'));
  }
}
