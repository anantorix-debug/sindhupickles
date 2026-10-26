/** Public site navigation and footer links. Only pages that exist are listed. */
export const mainNav = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

/** Phone menu: the main links plus pages with no room in the desktop header. */
export const mobileNav = [...mainNav.slice(0, 4), { label: "Blog", href: "/blog" }, mainNav[4]] as const;

export const footerQuickLinks = [
  { label: "Our Story", href: "/about" },
  { label: "Shop Collection", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "Blog", href: "/blog" },
  { label: "My Orders", href: "/account/orders" },
  { label: "Contact Us", href: "/contact" },
] as const;

export const footerPolicies = [
  { label: "Shipping, Return & Refund", href: "/policies/shipping-return-refund" },
  { label: "Privacy Policy", href: "/policies/privacy" },
  { label: "Terms & Conditions", href: "/policies/terms" },
] as const;

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "Name: A–Z" },
] as const;
