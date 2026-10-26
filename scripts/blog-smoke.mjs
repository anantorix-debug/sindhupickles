// Blog: Admin -> Blog (create / publish / edit / unpublish / delete) and the public /blog pages.
// Throwaway admin + post, removed afterwards.   BASE=http://localhost:3113 node scripts/blog-smoke.mjs
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const req = async (method, path, body, cookie = "") => {
  const res = await fetch(BASE + path, { method, headers: { Origin: BASE, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const page = async (path) => {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return { status: res.status, html: await res.text() };
};

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const admin = await createTestAdmin(db, BASE);
const stamp = Date.now();
const slug = `zz-blog-test-${stamp}`;
const post = {
  title: `Zz Blog Test ${stamp}`,
  slug,
  category: "Zz Test Recipes",
  authorName: "Zz Kitchen",
  excerpt: "A throwaway post for the automated blog test.",
  content: [
    "First paragraph with **bold words** and a [shop link](/shop).",
    "## Zz Heading Two",
    "- first bullet\n- second bullet",
    "<script>alert('zz-xss')</script> stays as plain text.",
  ].join("\n\n"),
  featuredImage: "",
  tags: "zz-tag-one, zz-tag-two",
  status: "draft",
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
};
let id = null;
try {
  const created = await req("POST", "/api/blog", post, admin.cookie);
  id = created.json?.data?.id;
  check("admin creates a draft post", created.status === 201 || created.status === 200, `status ${created.status}`);
  check("admin list includes it", (await req("GET", "/api/blog", null, admin.cookie)).json?.data?.some((p) => p.id === id));
  check("signed-out visitor can't create posts (401)", (await req("POST", "/api/blog", post)).status === 401);

  check("draft is hidden: /blog/<slug> -> 404", (await page(`/blog/${slug}`)).status === 404);
  check("draft is not listed on /blog", !(await page("/blog")).html.includes(post.title));

  const pub = await req("PUT", `/api/blog/${id}`, { ...post, status: "published" }, admin.cookie);
  check("admin publishes it", pub.status === 200 && pub.json?.data?.publishedAt);

  const list = await page("/blog");
  check("/blog lists the published post", list.status === 200 && list.html.includes(post.title) && list.html.includes(`/blog/${slug}`));
  check("/blog shows the category filter chip", list.html.includes("Zz Test Recipes"));
  const filtered = await page(`/blog?category=${encodeURIComponent("Zz Test Recipes")}`);
  check("category filter shows it and is noindex", filtered.html.includes(post.title) && /noindex/.test(filtered.html));

  const one = await page(`/blog/${slug}`);
  check("post page opens (200)", one.status === 200);
  check("post title is the page heading", new RegExp(`<h1[^>]*>${post.title}</h1>`).test(one.html));
  check("**bold** becomes bold", /<strong[^>]*>bold words<\/strong>/.test(one.html));
  check("[link](/shop) becomes a link", /<a[^>]*href="\/shop"[^>]*>shop link<\/a>/.test(one.html));
  check("## becomes a heading", /<h2[^>]*>Zz Heading Two<\/h2>/.test(one.html));
  check("- lines become a bullet list", /<li>first bullet<\/li><li>second bullet<\/li>/.test(one.html));
  check("HTML in the body is shown as text, never run", !one.html.includes("<script>alert('zz-xss')") && one.html.includes("&lt;script&gt;alert("));
  check("tags shown", one.html.includes("#zz-tag-one") && one.html.includes("#zz-tag-two"));
  check("canonical + BlogPosting structured data", one.html.includes(`/blog/${slug}"`) && one.html.includes('"@type":"BlogPosting"'));
  check("sitemap lists the post", (await page("/sitemap.xml")).html.includes(`/blog/${slug}<`));

  await new Promise((r) => setTimeout(r, 500));
  const [[row]] = await db.query("SELECT view_count FROM blog_posts WHERE id = ?", [id]);
  check("reading the post counts a view", row.view_count >= 1, `views ${row.view_count}`);

  const edited = await req("PUT", `/api/blog/${id}`, { ...post, status: "published", title: `${post.title} edited` }, admin.cookie);
  check("admin edits it; the change shows on the site", edited.status === 200 && (await page(`/blog/${slug}`)).html.includes(`${post.title} edited`));

  check("admin switches it back to draft", (await req("PUT", `/api/blog/${id}`, { ...post, status: "draft" }, admin.cookie)).status === 200);
  check("back to draft: hidden again (404)", (await page(`/blog/${slug}`)).status === 404);

  check("admin deletes it", (await req("DELETE", `/api/blog/${id}`, null, admin.cookie)).status === 200);
  id = null;
  check("deleted: 404", (await page(`/blog/${slug}`)).status === 404);
  check("/blog still works with this post gone", (await page("/blog")).status === 200);
} finally {
  if (id) await db.query("DELETE FROM blog_posts WHERE id = ?", [id]);
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
