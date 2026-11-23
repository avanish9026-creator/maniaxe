import { auth } from "../firebase";

// Trakey Admin API: the Cloudflare Worker (trakey-admin-api). It lists every real sign-in account and sends
// notifications to everyone or to one person. It needs no Cloud Functions, so it works on the Spark plan.
export const ADMIN_API_URL = "https://trakey-admin-api.trakey-ai.workers.dev";

export async function adminApi(path, body) {
  const me = auth.currentUser;
  if (!me) throw new Error("Sign in again.");
  const token = await me.getIdToken();
  let res;
  try {
    res = await fetch(ADMIN_API_URL + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the Trakey Admin API (" + ADMIN_API_URL + "). Check that the Worker is deployed and this address is correct.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Request failed (" + res.status + ").");
    err.code = data?.error?.code || String(res.status);
    throw err;
  }
  return data;
}
