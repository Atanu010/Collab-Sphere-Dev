import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API_BASE = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, "")}/api` : "/api";

const TOKEN_KEY = "cs_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function wsUrl() {
  const t = getToken();
  let base;
  if (BACKEND_URL) {
    base = BACKEND_URL.replace(/\/$/, "").replace(/^http/, "ws");
  } else if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    base = `${protocol}//${window.location.host}`;
  } else {
    base = "ws://localhost:8000";
  }
  return `${base}/api/ws?token=${encodeURIComponent(t || "")}`;
}

export function fileDownloadUrl(fileId) {
  return `${API_BASE}/files/${fileId}/download?token=${encodeURIComponent(getToken() || "")}`;
}

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
