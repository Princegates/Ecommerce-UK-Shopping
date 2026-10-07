/**
 * Builds the documentation PDFs from the Markdown in docs/.
 *   npm run docs:pdf
 * Writes docs/pdf/SRS.pdf (the Software Requirements Specification) and docs/pdf/Documentation.pdf (every document in one book).
 * Needs pandoc on the PATH and a Chrome or Chromium (set CHROMIUM_PATH, or install Playwright's with `npx playwright-core install chromium`).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const out = path.join(docs, "pdf");
const work = path.join(out, ".build");
fs.mkdirSync(work, { recursive: true });

const SITE = "SHOP UK FROM GH";
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ORDER = [
  "01-overview", "02-admin-guide", "03-customer-guide", "04-catalogue-sources", "05-deployment-and-operations", "06-architecture",
  "07-data-model", "08-security", "09-integrations", "10-testing", "11-faq-and-troubleshooting", "12-change-history", "13-srs",
];
const read = (name) => fs.readFileSync(path.join(docs, `${name}.md`), "utf8");

function pandocHtml(md, id) {
  const src = path.join(work, `${id}.md`);
  fs.writeFileSync(src, md);
  return execFileSync("pandoc", [src, "-f", "gfm+attributes", "-t", "html5", "--wrap=none"], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
}

/** Pandoc gives headings ids; build the contents list ourselves so it is clean and limited to two levels. */
function withIds(html, prefix) {
  const seen = new Map();
  const toc = [];
  const out = html.replace(/<h([1-3])( id="[^"]*")?>([\s\S]*?)<\/h\1>/g, (_m, level, _id, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let slug = `${prefix}-${text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60)}`;
    const n = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, n);
    if (n > 1) slug += `-${n}`;
    if (Number(level) <= 2) toc.push({ level: Number(level), text, slug });
    return `<h${level} id="${slug}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}

function rewriteLinks(html, known) {
  // links to other documents become links inside the book; anchors into them are dropped (they point at the document's start)
  return html.replace(/href="([^"#]*\.md)(#[^"]*)?"/g, (m, file) => {
    const name = path.basename(file, ".md");
    return known.has(name) ? `href="#doc-${name}"` : m;
  });
}

function cover({ title, subtitle, meta }) {
  const rows = meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("");
  return `<section class="cover">
  <div class="band"></div><div class="stripe"></div>
  <div class="brand">${SITE}<small>UK shops, paid in cedis, delivered in Ghana</small></div>
  <div class="doc-title">${esc(title)}</div>
  <div class="doc-sub">${esc(subtitle)}</div>
  <div class="meta"><table>${rows}</table></div>
  <div class="note">Describes the system as built. This is not legal, tax or customs advice. Generated from the Markdown files in the repository's docs folder, so it is only as current as the date above; regenerate it with <code>npm run docs:pdf</code> after documents change.</div>
</section>`;
}

function page(bodyHtml, footerTitle) {
  const running = `@page { @top-left { content: "${SITE}"; font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #7a857f; }
    @top-right { content: "${footerTitle}"; font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #7a857f; }
    @bottom-left { content: "${today}"; font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #7a857f; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt "DejaVu Sans", Arial, sans-serif; color: #7a857f; } }
    @page :first { @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${SITE}</title>
<link rel="stylesheet" href="${pathToFileURL(path.join(root, "scripts", "docs-pdf.css")).href}"><style>${running}</style></head><body>${bodyHtml}</body></html>`;
}

function tocHtml(entries) {
  let html = '<nav id="TOC"><ul>';
  let open = false;
  for (const e of entries) {
    if (e.level === 1) {
      if (open) html += "</ul></li>";
      html += `<li><a href="#${e.slug}">${esc(e.text)}</a><ul>`;
      open = true;
    } else html += `<li><a href="#${e.slug}">${esc(e.text)}</a></li>`;
  }
  if (open) html += "</ul></li>";
  return html + "</ul></nav>";
}

async function render(browser, htmlBody, file, footerTitle) {
  const htmlFile = path.join(work, file.replace(/\.pdf$/, ".html"));
  fs.writeFileSync(htmlFile, page(htmlBody, footerTitle));
  const p = await browser.newPage();
  await p.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
  await p.evaluate(async () => { await document.fonts.ready; });
  // colour the status cells of the requirement tables, and keep ID columns on one line
  await p.evaluate(() => {
    for (const t of document.querySelectorAll("table")) {
      if ((t.querySelector("th")?.textContent || "").trim() === "ID") t.classList.add("idcol");
    }
    for (const td of document.querySelectorAll("td")) {
      const t = (td.textContent || "").trim();
      if (/^Not implemented/.test(t)) td.classList.add("st-no");
      else if (/^(Partial|Target|Operator duty)/.test(t)) td.classList.add("st-part");
      else if (/^Implemented/.test(t)) td.classList.add("st-yes");
      if (/^(Implemented|Not implemented|Partial|Target|Operator duty)$/.test(t)) td.classList.add("nw");
    }
  });
  await p.pdf({
    path: path.join(out, file),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    outline: true,
    tagged: true,
  });
  await p.close();
  console.log("wrote", path.relative(root, path.join(out, file)));
}

const known = new Set(ORDER);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
try {
  // ---- the SRS on its own
  {
    let md = read("13-srs");
    const meta = [...md.matchAll(/^\*\*([^*]+):\*\*\s*(.+)$/gm)].slice(0, 6).map((m) => [m[1], m[2].replace(/\*\*/g, "")]);
    md = md.replace(/^# .*\n/, "").replace(/^\*\*[^*]+:\*\*.*\n/gm, "").replace(/## Contents[\s\S]*?\n---\n/, "");
    const { html, toc } = withIds(rewriteLinks(pandocHtml(md, "srs"), new Set()), "s");
    const entries = toc.filter((t) => t.level === 2).map((t) => ({ ...t, level: 1 }));
    const body = cover({ title: "Software Requirements Specification", subtitle: `${SITE}: UK-to-Ghana shopping platform`, meta: [...meta, ["Generated", esc(today)]] }) + tocHtml(entries) + html;
    await render(browser, body, "SRS.pdf", "Software Requirements Specification");
  }

  // ---- every document in one book
  {
    const parts = [];
    const entries = [];
    for (const name of ORDER) {
      let md = read(name);
      const { html, toc } = withIds(rewriteLinks(pandocHtml(md, name), known), name.slice(0, 2));
      const h1 = toc.find((t) => t.level === 1);
      const title = name === "13-srs" ? "Software Requirements Specification" : h1?.text ?? name;
      entries.push({ level: 1, text: title, slug: `doc-${name}` });
      for (const t of toc.filter((x) => x.level === 2)) entries.push(t);
      // the document's own title stays as its heading, with an id the contents and cross-links can find
      parts.push(`<section class="part" id="doc-${name}">${html.replace(/<h1 id="[^"]*">/, `<h1 id="h-${name}">`)}</section>`);
    }
    const body = cover({
      title: "Complete Documentation",
      subtitle: `${SITE}: overview, guides, operations, architecture, security and the Software Requirements Specification`,
      meta: [["Contents", "13 documents in one book"], ["Audience", "Owner and staff, the developer, and anyone reviewing the system"], ["Generated", esc(today)]],
    }) + tocHtml(entries) + parts.join("\n");
    await render(browser, body, "Documentation.pdf", "Complete documentation");
  }
} finally {
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
