export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data as T;
}
