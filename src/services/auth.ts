import { api } from "./api-client";

export interface Credentials {
  email: string;
  password: string;
}

export const signIn = (credentials: Credentials) => api<{ id: string; name: string; role: string }>("/admin-auth/login", { method: "POST", body: credentials });
export const signOut = () => api("/admin-auth/logout", { method: "POST", body: {} });
