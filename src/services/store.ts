/** Browser-side client for the public store API (`/api/store/*`). */
import type { Address, Order, OrderSummary } from "@/types";
import type {
  AddressInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ProfileInput,
  RegisterInput,
  ResetPasswordInput,
  ReviewInput,
} from "@/lib/validation/store";
import type { CartItemInput, CustomerPreferences, CustomerProfile, PaymentOption, PricedCart, StoreProductCard } from "@/types/store";
import { api } from "./api-client";

const post = <T>(path: string, body?: unknown) => api<T>(`/store${path}`, { method: "POST", body: body ?? {} });
const get = <T>(path: string) => api<T>(`/store${path}`);

export const storeApi = {
  me: () => get<{ id: string; name: string } | null>("/auth/me"),
  register: (v: RegisterInput) => post<{ id: string }>("/auth/register", v),
  login: (v: LoginInput) => post<{ id: string }>("/auth/login", v),
  logout: () => post("/auth/logout"),
  forgotPassword: (v: ForgotPasswordInput) => post("/auth/forgot-password", v),
  resetPassword: (v: ResetPasswordInput) => post("/auth/reset-password", v),

  suggestions: (q: string) => get<StoreProductCard[]>(`/search?q=${encodeURIComponent(q)}`),
  validateCart: (items: CartItemInput[], couponCode?: string) => post<PricedCart>("/cart/validate", { items, couponCode }),
  paymentOptions: () => get<PaymentOption[]>("/checkout/options"),
  submitReview: (v: ReviewInput) => post<{ status: "pending" }>("/reviews", v),
  checkout: (body: unknown) =>
    post<{ orderId: string; orderNumber: string; total: number; status: string; paymentStatus: string }>("/checkout", body),

  updateProfile: (v: ProfileInput) => api<CustomerProfile>("/store/account", { method: "PATCH", body: v }),
  changePassword: (v: ChangePasswordInput) => post("/account/password", v),
  updatePreferences: (v: CustomerPreferences) => api<CustomerPreferences>("/store/account/preferences", { method: "PATCH", body: v }),

  addresses: () => get<Address[]>("/addresses"),
  createAddress: (v: AddressInput) => post<Address>("/addresses", v),
  updateAddress: (id: string, v: AddressInput) => api<Address>(`/store/addresses/${id}`, { method: "PUT", body: v }),
  deleteAddress: (id: string) => api(`/store/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id: string) => post(`/addresses/${id}/default`),

  orders: () => get<OrderSummary[]>("/orders"),
  order: (id: string) => get<Order>(`/orders/${id}`),
};
