/** Re-created on every navigation, so each admin page slides in gently (see .page-enter in globals.css). */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
