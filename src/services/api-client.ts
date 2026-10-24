/**
 * Browser-side client for the REST API. Every mutation in the admin goes
 * through here, so the UI never talks to the database directly.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError("Can't reach the server. Check your connection and try again.", 0);
  }
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { message: string; fields?: Record<string, string> } } | null;
  if (!res.ok) throw new ApiRequestError(json?.error?.message ?? "Request failed", res.status, json?.error?.fields);
  return json?.data as T;
}
