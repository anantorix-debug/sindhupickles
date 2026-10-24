import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_BASE = "/admin";

export const adminNav: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: `${ADMIN_BASE}/dashboard`, icon: LayoutDashboard }],
  },
  {
    label: "Store",
    items: [
      { title: "Products", href: `${ADMIN_BASE}/products`, icon: Package },
      { title: "Categories", href: `${ADMIN_BASE}/categories`, icon: Tags },
      { title: "Orders", href: `${ADMIN_BASE}/orders`, icon: ShoppingBag },
      { title: "Customers", href: `${ADMIN_BASE}/customers`, icon: Users },
      { title: "Inventory", href: `${ADMIN_BASE}/inventory`, icon: Warehouse },
    ],
  },
  {
    label: "Engagement",
    items: [
      { title: "Reviews", href: `${ADMIN_BASE}/reviews`, icon: Star },
      { title: "Blog", href: `${ADMIN_BASE}/blog`, icon: FileText },
      { title: "Enquiries", href: `${ADMIN_BASE}/enquiries`, icon: Mail },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Payments", href: `${ADMIN_BASE}/payments`, icon: CreditCard },
      { title: "Reports", href: `${ADMIN_BASE}/reports`, icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: `${ADMIN_BASE}/settings`, icon: Settings }],
  },
];

const flat = adminNav.flatMap((g) => g.items);

export const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Title of the nav section the current path belongs to (used by the header). */
export const titleForPath = (pathname: string) => flat.find((i) => isActivePath(pathname, i.href))?.title ?? "Admin";
