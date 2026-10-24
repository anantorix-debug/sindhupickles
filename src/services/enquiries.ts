import { api } from "./api-client";

export const setEnquiryRead = (id: string, isRead: boolean) => api(`/enquiries/${id}`, { method: "PATCH", body: { isRead } });
export const deleteEnquiry = (id: string) => api(`/enquiries/${id}`, { method: "DELETE" });
