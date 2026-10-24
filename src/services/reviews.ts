import { api } from "./api-client";

export const setReviewVisibility = (id: string, visible: boolean) => api(`/reviews/${id}`, { method: "PATCH", body: { visible } });
export const deleteReview = (id: string) => api(`/reviews/${id}`, { method: "DELETE" });
