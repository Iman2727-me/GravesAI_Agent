const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getWhiteboard(id: string) {
    return request<import("@thomas/shared").ProcessWhiteboard>(
      `/processes/whiteboard/${id}`,
    );
  },
  patchWhiteboard(
    id: string,
    body: Partial<import("@thomas/shared").ProcessWhiteboard>,
  ) {
    return request<import("@thomas/shared").ProcessWhiteboard>(
      `/processes/whiteboard/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },
  reviseWhiteboard(id: string, body?: object) {
    return request<import("@thomas/shared").Session>(
      `/processes/whiteboard/${id}/revise`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
  },
  getDesign(id: string) {
    return request<import("@thomas/shared").SolutionDesignMap>(
      `/processes/design/${id}`,
    );
  },
  patchDesign(id: string, body: object) {
    return request<import("@thomas/shared").SolutionDesignMap>(
      `/processes/design/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },
  reviseDesign(id: string, body?: object) {
    return request<import("@thomas/shared").Session>(
      `/processes/design/${id}/revise`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
  },
};
