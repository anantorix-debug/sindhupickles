/** Re-created on every navigation, so each storefront page slides in gently (see .page-enter in globals.css). */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
