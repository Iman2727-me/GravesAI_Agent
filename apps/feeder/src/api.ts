const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const FETCH_TIMEOUT_MS = 60_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? res.statusText);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Thomas took too long — try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  createSession(idea: string, uploadIds: string[]) {
    return request<import("@thomas/shared").Session>("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea, uploadIds }),
    });
  },
  getSession(id: string) {
    return request<import("@thomas/shared").Session>(`/sessions/${id}`);
  },
  answer(
    id: string,
    answers: { questionId: string; answer: string; overrideRecommendation?: boolean }[],
  ) {
    return request<import("@thomas/shared").Session>(`/sessions/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
  },
  advance(id: string) {
    return request<import("@thomas/shared").Session>(`/sessions/${id}/advance`, {
      method: "POST",
    });
  },
  async upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}/uploads`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json() as Promise<{ id: string; filename: string }>;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("Upload took too long — try again.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};
