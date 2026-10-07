#!/usr/bin/env python3
"""Build docs/pdf/SRS-Anknovate.docx (+ .pdf) from docs/13-srs.md in the Anknovate house format.
(--source/--name build other documents the same way, e.g. the business-friendly SRS.)

The format comes from docs/template/anknovate-srs-template.docx: its styles, header (logo +
title), footer (page x of y), cover page, table of contents and closing "About Anknovate" pages
are reused; only the body text and the cover details change.

    python3 scripts/build-srs-docx.py [--client "Client name"] [--version 1.0]

Needs pandoc and LibreOffice (soffice) on the PATH; pdftotext is used to fill in the contents page.
"""
import argparse, html, os, re, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, "docs/template/anknovate-srs-template.docx")
OUT = os.path.join(ROOT, "docs/pdf")

ap = argparse.ArgumentParser()
ap.add_argument("--client", default="The owner of SHOP UK FROM GH")
ap.add_argument("--version", default="1.0")
ap.add_argument("--date", default=None)
ap.add_argument("--source", default="docs/13-srs.md", help="Markdown file with '## ' section headings")
ap.add_argument("--name", default="SRS-Anknovate", help="output file name, without extension")
ap.add_argument("--subtitle", default="SHOP UK FROM GH: UK shopping, shipping and delivery for Ghana")
ap.add_argument("--business-model", default="Online shop and purchasing agent: UK goods paid for once in cedis, shipped to Ghana and delivered to the door")
ap.add_argument("--doctype", default=None, help="show a 'Document Type' row on the cover instead of dropping the Status row")
ap.add_argument("--about-letter", default=None, help="appendix letter for the About Anknovate pages")
ap.add_argument("--keep-status", action="store_true", help="keep the implementation-status columns and appendix (internal edition)")
args = ap.parse_args()

def run(*cmd, **kw):
    subprocess.run(cmd, check=True, **kw)

def text_of(x):
    return html.unescape(re.sub(r"<[^>]+>", "", x))

def cover_row(xml, label, value):
    """Replace the value cell of the cover-table row whose first cell reads `label`."""
    pat = re.compile(r"(<w:t(?: [^>]*)?>" + re.escape(label) + r"</w:t>.*?</w:tc><w:tc>.*?<w:t(?: [^>]*)?>)(.*?)(</w:t>)", re.S)
    new, n = pat.subn(lambda m: m.group(1) + html.escape(value) + m.group(3), xml, count=1)
    if n != 1:
        sys.exit("cover row not found: " + label)
    return new

# ---- 1. markdown -> body docx, using the template's styles -------------------------------
SOURCE = os.path.join(ROOT, args.source)
md = open(SOURCE, encoding="utf-8").read().split("\n")
date = args.date
if not date:
    for l in md[:12]:
        m = re.match(r"\*\*Date:\*\*\s*(.+)", l)
        if m: date = m.group(1).strip()
date = date or "7 October 2026"

def split_row(line):
    """Cells of a pipe-table row, ignoring pipes inside code spans or escaped."""
    cells, cur, tick, i = [], "", False, 0
    line = line.strip()
    if line.startswith("|"): line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"): line = line[:-1]
    while i < len(line):
        c = line[i]
        if c == "\\" and i + 1 < len(line): cur += line[i:i + 2]; i += 2; continue
        if c == "`": tick = not tick
        if c == "|" and not tick: cells.append(cur.strip()); cur = ""
        else: cur += c
        i += 1
    cells.append(cur.strip())
    return cells

def client_edition(lines):
    """Remove the as-built implementation status: Status columns, status summary appendix and wording."""
    out, i = [], 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("## Appendix A: Requirement status summary"):
            while not lines[i].startswith("## Appendix B"): i += 1
            continue
        if l.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()) and any(c in ("Status", "**Status**") for c in split_row(l)):
            col = [c for c in split_row(l)].index("Status")
            while i < len(lines) and lines[i].startswith("|"):
                cells = split_row(lines[i]); del cells[col]
                out.append("| " + " | ".join(cells) + " |"); i += 1
            continue
        out.append(l); i += 1
    t = "\n".join(out)
    t = re.sub(r"^> \*\*How to read this document\.\*\*.*$", "> **How to read this document.** It states what the system *shall* do. Requirements are numbered so they can be traced to tests ([section 5](#5-verification-and-traceability)). Other documents in the documentation set explain *how* to use, run and build the system; this one defines *what* it must do.", t, flags=re.M)
    t = t.replace("its priority (M/S/C), its status, and how it is verified", "its priority (M/S/C) and how it is verified")
    t = re.sub(r"\nStatus for these is \*\*Implemented\*\*.*\n", "\n", t)
    t = t.replace("## Appendix B: Gaps and future work", "## Appendix A: Future work and planned enhancements")
    t = re.sub(r"Items below are \*\*not implemented\*\* or only \*\*partial\*\*\..*", "Items below are enhancements and refinements planned for later releases, with a suggested priority.", t)
    t = t.replace("## Appendix C: Glossary", "## Appendix B: Glossary").replace("## Appendix D: Revision history", "## Appendix C: Revision history")
    t = t.replace("[Appendix C](#appendix-c-glossary)", "[Appendix B](#appendix-b-glossary)").replace("[Appendix B](#appendix-b-gaps-and-future-work)", "[Appendix A](#appendix-a-future-work-and-planned-enhancements)")
    t = t.replace("Appendix B", "Appendix A") if False else t
    t = t.replace("First complete, as-built SRS written from the finished system, with every requirement given a status and a means of verification.", "First complete issue of the SRS, with every requirement numbered, prioritised and given a means of verification.")
    t = re.sub(r"\nTo keep this document true, update the status.*\n?", "\nTo keep this document current, add new requirements with the next free number in their area.\n", t)
    return t.split("\n")

if not args.keep_status and args.source.endswith("13-srs.md"):
    md = client_edition(md)

# drop title block, meta lines, reading note's blockquote stays; drop the doc's own Contents list
start = next(i for i, l in enumerate(md) if l.startswith("> **How to read") or l.startswith("## "))
body = md[start:]
out, skip = [], False
for l in body:
    if l.startswith("## Contents"):
        skip = True; continue
    if skip:
        if l.strip() == "---": skip = False
        continue
    if l.strip() == "---": continue          # headings already carry a rule
    out.append(re.sub(r"^## (.*)$", lambda m: "## " + m.group(1).upper(), l))
text = "\n".join(out)
ABOUT = args.about_letter or ("E" if args.keep_status else "D")

tmp = tempfile.mkdtemp()
body_md = os.path.join(tmp, "body.md"); open(body_md, "w", encoding="utf-8").write(text)
body_docx = os.path.join(tmp, "body.docx")
run("pandoc", body_md, "-f", "gfm+pipe_tables", "-o", body_docx, "--reference-doc", TEMPLATE,
    "--shift-heading-level-by=-1", "--highlight-style=tango")

def read(z, name): return zipfile.ZipFile(z).read(name).decode("utf-8")
tpl = read(TEMPLATE, "word/document.xml")
bod = read(body_docx, "word/document.xml")

# ---- 2. pieces of the template -----------------------------------------------------------
b0 = tpl.index("<w:body>") + len("<w:body>")
toc_head = tpl.index("TABLE OF CONTENTS")
toc_head_p = tpl.rfind("<w:p>", 0, toc_head)
cover = tpl[b0:toc_head_p]                       # logo, title, details table, notice, page break
toc_head_end = tpl.index("</w:p>", toc_head) + 6
toc_heading = tpl[toc_head_p:toc_head_end]
about_t = tpl.rindex("APPENDIX A: ABOUT ANKNOVATE")
about_p = tpl.rfind("<w:p>", 0, about_t)
about_p = max(about_p, tpl.rfind("<w:p ", 0, about_t))
about = tpl[about_p:tpl.index("<w:sectPr", about_p)]
about = about.replace("APPENDIX A: ABOUT ANKNOVATE", "APPENDIX %s: ABOUT ANKNOVATE" % ABOUT)
sect = tpl[tpl.index("<w:sectPr", about_p):tpl.index("</w:body>")]
head_xml = tpl[:b0]

cover = cover_row(cover, "Document Version", args.version)
if args.doctype:
    cover = cover.replace(">Status</w:t>", ">Document Type</w:t>", 1)
    cover = cover_row(cover, "Document Type", args.doctype)
elif args.keep_status:
    cover = cover_row(cover, "Status", "As-built system specification")
else:
    cover, n = re.subn(r"<w:tr>(?:(?!</w:tr>).)*?<w:t(?: [^>]*)?>Status</w:t>.*?</w:tr>", "", cover, count=1, flags=re.S)
    if n != 1: sys.exit("cover Status row not found")
cover = cover_row(cover, "Business Model", args.business_model)
cover = cover_row(cover, "Prepared for", args.client)
cover = cover_row(cover, "Date", date)
cover = cover.replace("UK-to-Ghana Unified Shopping, Shipping &amp; Door-to-Door Delivery Platform", html.escape(args.subtitle))

# body: strip pandoc's sectPr, page break before the closing About pages
bb = bod[bod.index("<w:body>") + 8:bod.index("</w:body>")]
bb = re.sub(r"<w:sectPr.*?</w:sectPr>", "", bb, flags=re.S)
heads = [text_of(m.group(0)) for m in re.finditer(r'<w:p>(?:(?!</w:p>).)*?<w:pStyle w:val="Heading1"\s*/>.*?</w:p>', bb, re.S)]
heads = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", h)) for h in heads]

def fit_tables(x):
    """Give every table the full text width, with columns sized to their content."""
    TW = 9360
    def one(m):
        t = m.group(0)
        rows = re.findall(r"<w:tr[ >].*?</w:tr>", t, re.S)
        cells = [re.findall(r"<w:tc>.*?</w:tc>", r, re.S) for r in rows]
        n = max(len(r) for r in cells)
        mean, mn = [], []
        for j in range(n):
            txt = [text_of(" ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", r[j]))) for r in cells if j < len(r)]
            mean.append(max(6, min(60, sum(len(a) for a in txt) / max(1, len(txt)))))
            words = [len(w) for a in txt for w in a.split()]
            mn.append(min(1900, (max(words) if words else 4) * 115 + 260))
        tot = sum(mean)
        w = [TW * v / tot for v in mean]
        pinned = set()
        for _ in range(n):                       # lift narrow columns to their minimum, shrink the rest
            low = [j for j in range(n) if j not in pinned and w[j] < mn[j]]
            if not low: break
            pinned.update(low)
            rest = [j for j in range(n) if j not in pinned]
            rt = sum(mean[j] for j in rest) or 1
            for j in pinned: w[j] = mn[j]
            for j in rest: w[j] = (TW - sum(mn[k] for k in pinned)) * mean[j] / rt
        w = [int(v) for v in w]; w[-1] += TW - sum(w)
        t = re.sub(r'<w:tblW [^>]*/>', '<w:tblW w:type="dxa" w:w="%d"/><w:tblLayout w:type="fixed"/>' % TW, t, count=1)
        t = re.sub(r"<w:tblGrid>.*?</w:tblGrid>", "<w:tblGrid>" + "".join('<w:gridCol w:w="%d"/>' % v for v in w) + "</w:tblGrid>", t, count=1, flags=re.S)
        def rowfix(rm):
            k = [0]
            def cellfix(cm):
                j = k[0]; k[0] += 1
                return cm.group(0).replace("<w:tcPr />", '<w:tcPr><w:tcW w:w="%d" w:type="dxa"/></w:tcPr>' % w[min(j, n - 1)], 1)
            r = re.sub(r"<w:tc>.*?</w:tc>", cellfix, rm.group(0), flags=re.S)
            return r.replace("<w:tr>", "<w:tr><w:trPr><w:cantSplit/></w:trPr>", 1) if r.startswith("<w:tr>") else r
        t = re.sub(r"<w:tr[ >].*?</w:tr>", rowfix, t, flags=re.S)
        return re.sub(r'(<w:rStyle w:val="VerbatimChar"\s*/>)', r'\1<w:sz w:val="16"/><w:szCs w:val="16"/>', t)
    return re.sub(r"<w:tbl>.*?</w:tbl>", one, x, flags=re.S)

def fit_code(x):
    """Shrink code blocks whose longest line would not fit the text width."""
    def one(m):
        p = m.group(0)
        lines = re.sub(r"<w:br\s*/>", "\n", p)
        lines = text_of(re.sub(r"</w:p>", "", lines)).split("\n")
        longest = max(len(l) for l in lines)
        if longest <= 84: return p
        sz = max(11, int(2 * 468 / (0.6 * longest)))
        return re.sub(r'(<w:rStyle w:val="VerbatimChar"\s*/>)', r'\1<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (sz, sz), p)
    return re.sub(r'<w:p>(?:(?!</w:p>).)*?<w:pStyle w:val="SourceCode"\s*/>.*?</w:p>', one, x, flags=re.S)

bb = fit_code(fit_tables(bb))
bb = re.sub(r'(<w:p>(?:(?!</w:p>).)*?<w:pStyle w:val="Heading1"\s*/>)((?:(?!</w:p>).)*?APPENDIX A:)', r'\1<w:pageBreakBefore/>\2', bb, count=1, flags=re.S)
heads.append("APPENDIX %s: ABOUT ANKNOVATE IT CONSULTANCY SERVICES" % ABOUT)
PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def toc(pages):
    rows = []
    for i, h in enumerate(heads):
        pg = str(pages.get(h, "")) 
        pre = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' if i == 0 else "")
        post = '<w:r><w:fldChar w:fldCharType="end"/></w:r>' if i == len(heads) - 1 else ""
        rows.append('<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9360"/></w:tabs></w:pPr>' + pre +
                    '<w:r><w:t xml:space="preserve">' + html.escape(h) + '</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>' + pg + '</w:t></w:r>' + post + '</w:p>')
    return "".join(rows)

def assemble(pages, path):
    doc = head_xml + cover + toc_heading + toc(pages) + PB + bb + PB + about + sect + "</w:body></w:document>"
    zin = zipfile.ZipFile(TEMPLATE)
    # numbering/styles come from the template; the body's list definitions come from pandoc's output
    zb = zipfile.ZipFile(body_docx)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for it in zin.infolist():
            data = zin.read(it.filename)
            if it.filename == "word/document.xml": data = doc.encode("utf-8")
            elif it.filename == "word/numbering.xml": data = zb.read("word/numbering.xml")
            elif it.filename == "word/styles.xml": data = zb.read("word/styles.xml") if False else data
            z.writestr(it, data)

def pdf_pages(docx_path):
    run("soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, docx_path, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pdf = os.path.join(tmp, os.path.splitext(os.path.basename(docx_path))[0] + ".pdf")
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
    return pdf, n

draft = os.path.join(tmp, "draft.docx")
assemble({}, draft)
pdf, n = pdf_pages(draft)
pages = {}
for p in range(1, n + 1):
    t = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), "-layout", pdf, "-"], capture_output=True, text=True).stdout
    lines = [re.sub(r"\s+", " ", l).strip() for l in t.splitlines()]
    if p <= 3 and any(".." in l for l in lines):  # contents pages
        continue
    for h in heads:
        if h not in pages and h in lines:
            pages[h] = p
missing = [h for h in heads if h not in pages]
if missing: print("warning: headings not located:", missing[:5], file=sys.stderr)

os.makedirs(OUT, exist_ok=True)
final = os.path.join(OUT, args.name + ".docx")
assemble(pages, final)
pdf2, n2 = pdf_pages(final)
shutil.copy(pdf2, os.path.join(OUT, args.name + ".pdf"))
if not os.environ.get("KEEP"): shutil.rmtree(tmp, ignore_errors=True)
print(f"wrote {final} and {args.name}.pdf ({n2} pages)")
