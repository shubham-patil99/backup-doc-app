const API_BASE = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined in .env.local");
}

interface ExtendedRequestInit extends RequestInit {
  responseType?: 'json' | 'blob';
}

export async function apiFetch(endpoint: string, options: ExtendedRequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const isBlob = options.responseType === "blob";

  // ✅ Serialize JSON body if it's a plain object
  const payload =
    options.body && !isFormData && typeof options.body === "object"
      ? JSON.stringify(options.body)
      : options.body;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
    body: payload, // 👈 Use the serialized version
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  return isBlob ? res.blob() : res.json();
}



