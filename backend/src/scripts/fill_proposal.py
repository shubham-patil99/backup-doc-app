#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fill_proposal.py  --  HPE Proposal generator
=============================================

Template: hpe-proposal-template.pptx  (3 slides)
  Slide 0  "Cover 1"           -- {{docTitle}} {{subtitle}} {{date}} {{opeId}}
  Slide 1  "Title and Content" -- {{breadcrumb}} / {{moduleNum}} {{moduleName}} / {{moduleBody}}
  Slide 2  "Thank You"         -- closing slide

Supported layouts in data.json -> slides[]:
  LAYOUT_COVER    -- cover slide
  LAYOUT_CONTENT  -- one slide per module, text body (no table)
  LAYOUT_TABLE    -- one slide per section, table of modules (classic)
  LAYOUT_HTML     -- one slide per module, HTML description parsed:
                     paragraph text -> content placeholder
                     <table> elements -> real PPTX tables stacked below text
  LAYOUT_CLOSING  -- closing slide

Key fix for split runs:
  PowerPoint stores "{{token}}" as three runs: ['{{','token','}}'].
  replace_in_paragraph() merges all runs into run[0] before substituting.
"""

import sys, json, copy, html as html_mod, re
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn
from lxml import etree

try:
    from bs4 import BeautifulSoup, NavigableString
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

PML = "http://schemas.openxmlformats.org/presentationml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

# ── Design constants ──────────────────────────────────────────────────────────
HPE_GREEN   = RGBColor(0x00, 0x60, 0x35)
STRIPE_ODD  = RGBColor(0xF2, 0xF2, 0xF2)
STRIPE_EVN  = RGBColor(0xFF, 0xFF, 0xFF)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_DARK   = RGBColor(0x1A, 0x1A, 0x1A)

SLIDE_W  = Inches(13.33)
SLIDE_H  = Inches(7.50)

# Safe content area (below header, above footer)
CONTENT_LEFT   = Inches(0.42)
CONTENT_TOP    = Inches(1.55)   # start below breadcrumb/title area
CONTENT_WIDTH  = Inches(12.47)
CONTENT_BOTTOM = Inches(6.65)   # leave ~0.85" for footer
CONTENT_HEIGHT = int(CONTENT_BOTTOM) - int(CONTENT_TOP)

# Header/title area used on content slides (module name row)
HEADER_TOP  = Inches(0.65)
HEADER_H    = Inches(0.55)

# Table geometry
TABLE_LEFT    = Inches(0.42)
TABLE_W       = Inches(12.47)
TABLE_ROW_H   = Emu(int(Inches(0.42)))  # each data row height in EMU
TABLE_HDR_H   = Emu(int(Inches(0.42)))  # header row height in EMU

# Font sizes
FONT_BODY   = Pt(11)
FONT_TABLE  = Pt(10)
FONT_HDR    = Pt(10)

# ── Overflow / pagination constants ───────────────────────────────────────────
# Max lines of text that fit in the content area (approx at 11pt)
MAX_LINES_PER_CONTENT = 16
# Max table DATA rows (excluding header) per slide
MAX_TABLE_ROWS_PER_SLIDE = 14

# Line/spacing metrics that MUST match between slide1 placeholder and continuation textboxes
# 11pt font at 1.15 line-spacing = ~0.195"; use 0.20" as a safe round number
TEXT_LINE_H  = Inches(0.20)   # height per rendered line  (used everywhere)
TEXT_GAP     = Inches(0.12)   # gap between stacked blocks


# ─── HTML helpers ─────────────────────────────────────────────────────────────

def _cell_text(td) -> str:
    return " ".join(td.get_text(separator=" ").split())


def html_to_blocks(raw_html: str):
    """
    Parse HTML string into blocks:
      {"type": "text",  "content": "plain text …"}
      {"type": "table", "rows": [["col1","col2",…], …]}
    """
    if not raw_html:
        return []

    if not HAS_BS4:
        text = strip_html_plain(raw_html)
        return [{"type": "text", "content": text}] if text else []

    soup = BeautifulSoup(raw_html, "html.parser")
    blocks = []

    def norm(text):
        return " ".join(str(text).split())

    def flush(buf):
        t = " ".join(buf).strip()
        if t:
            blocks.append({"type": "text", "content": t})
        buf.clear()

    text_buf = []

    def add_text(val):
        t = norm(val)
        if t:
            text_buf.append(html_mod.unescape(t))

    def parse_table(el):
        rows = []
        for tr in el.find_all("tr"):
            cells = [_cell_text(td) for td in tr.find_all(["td", "th"])]
            if any(cells):
                rows.append(cells)
        if rows:
            flush(text_buf)
            blocks.append({"type": "table", "rows": rows})

    def parse_list(el, ordered=False):
        flush(text_buf)
        items = []
        for idx, li in enumerate(el.find_all("li", recursive=False), start=1):
            item_text = norm(li.get_text(separator=" ", strip=True))
            if not item_text:
                continue
            prefix = f"{idx}. " if ordered else "\u2022 "
            items.append(prefix + html_mod.unescape(item_text))
        if items:
            blocks.append({"type": "text", "content": "\n".join(items)})

    for child in soup.contents:
        if isinstance(child, NavigableString):
            add_text(child)
            continue
        tag = getattr(child, "name", None)
        if tag == "table":
            parse_table(child)
        elif tag in ("p", "div", "section", "article", "header", "footer", "blockquote"):
            flush(text_buf)
            text = norm(child.get_text(separator=" ", strip=True))
            if text:
                blocks.append({"type": "text", "content": html_mod.unescape(text)})
        elif tag == "br":
            add_text(" ")
        elif tag == "ul":
            parse_list(child, ordered=False)
        elif tag == "ol":
            parse_list(child, ordered=True)
        else:
            text = norm(child.get_text(separator=" ", strip=True))
            if text:
                text_buf.append(html_mod.unescape(text))

    flush(text_buf)
    return blocks


def strip_html_plain(raw: str) -> str:
    if not raw:
        return ""
    text = re.sub(r"<br\s*/?>",         "\n", raw,  flags=re.I)
    text = re.sub(r"</p\s*>",           "\n", text, flags=re.I)
    text = re.sub(r"</li\s*>",          "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>",         "\u2022 ", text, flags=re.I)
    text = re.sub(r"</?(ul|ol)[^>]*>",  "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>",           "",   text)
    text = html_mod.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─── Slide cloning ────────────────────────────────────────────────────────────

def clone_slide(prs: Presentation, src_slide):
    new_slide = prs.slides.add_slide(src_slide.slide_layout)
    src_sp = src_slide.shapes._spTree
    dst_sp = new_slide.shapes._spTree
    for child in list(dst_sp):
        dst_sp.remove(child)
    for child in src_sp:
        dst_sp.append(copy.deepcopy(child))
    src_bg = src_slide._element.find(f"{{{PML}}}bg")
    if src_bg is not None:
        dst_el = new_slide._element
        old_bg = dst_el.find(f"{{{PML}}}bg")
        if old_bg is not None:
            dst_el.remove(old_bg)
        dst_el.insert(0, copy.deepcopy(src_bg))
    new_slide.name = src_slide.name
    # Enforce consistent slide dimensions on every clone so all slides are identical size
    prs.slide_width  = SLIDE_W
    prs.slide_height = SLIDE_H
    return new_slide


# ─── Body-placeholder normalisation helpers ──────────────────────────────────

def _get_body_placeholder(slide, ph_idx: int = 1):
    """Return the body placeholder shape (idx=1) or None."""
    for shape in slide.shapes:
        try:
            if (shape.has_text_frame and
                    shape.placeholder_format is not None and
                    shape.placeholder_format.idx == ph_idx):
                return shape
        except Exception:
            pass
    return None


def _normalize_placeholder_font(slide, ph_idx: int = 1,
                                  font_size: Pt = FONT_BODY):
    """
    Walk every run inside placeholder ph_idx and enforce a single font size.
    This ensures {{moduleBody}} text looks the same across all generated slides
    regardless of what font size the template or editor embedded.
    """
    shape = _get_body_placeholder(slide, ph_idx)
    if shape is None:
        return
    for para in shape.text_frame.paragraphs:
        for run in para.runs:
            run.font.size = font_size
            # Keep colour consistent too
            if run.font.color.type is None:
                run.font.color.rgb = TEXT_DARK


def _fit_text_in_body_placeholder(slide, ph_idx: int = 1,
                                    min_font: Pt = Pt(8),
                                    target_font: Pt = FONT_BODY):
    """
    After fill_slide() has injected text into placeholder ph_idx:
      1. Set word_wrap = True and enable auto-fit so PowerPoint will not
         clip the text box.
      2. Walk every run and normalise font size to target_font.
      3. If the text is longer than the placeholder can comfortably show at
         target_font, step the font down in 0.5pt increments (floor = min_font)
         until the estimated line count fits within the placeholder height.

    The function uses the placeholder's actual EMU dimensions, so it works
    regardless of where the template placed the text box.
    """
    shape = _get_body_placeholder(slide, ph_idx)
    if shape is None:
        return

    tf = shape.text_frame
    tf.word_wrap = True

    # Enable PowerPoint's built-in "shrink text on overflow" as a safety net
    from pptx.enum.text import PP_ALIGN
    from pptx.oxml.ns import nsmap
    try:
        # spAutoFit — lets the text box grow; normAutoFit shrinks font
        txBody = tf._txBody
        # Remove any existing bodyPr autofit elements and set normAutoFit
        bodyPr = txBody.find(qn("a:bodyPr"))
        if bodyPr is not None:
            for tag in ("a:spAutoFit", "a:normAutoFit", "a:noAutofit"):
                for el in bodyPr.findall(qn(tag)):
                    bodyPr.remove(el)
            # normAutoFit: PowerPoint shrinks font automatically to fit
            etree.SubElement(bodyPr, qn("a:normAutoFit"))
    except Exception:
        pass

    # Get placeholder dimensions in EMU
    ph_height = int(shape.height)  # EMU
    ph_width  = int(shape.width)   # EMU

    # Collect full text to estimate line count
    full_text = "\n".join(
        "".join(r.text for r in para.runs)
        for para in tf.paragraphs
    )

    # Binary-search-style: step down from target_font until it fits
    font_pt = float(target_font.pt)
    min_pt  = float(min_font.pt)

    while font_pt >= min_pt:
        # Estimate chars per line at this font size: width / (font_pt * 0.55 EMU_per_pt)
        # 1 pt = 12700 EMU; average char width ~0.55x font size
        char_w_emu   = font_pt * 12700 * 0.55
        chars_per_ln = max(1, int(ph_width / char_w_emu))
        line_h_emu   = font_pt * 12700 * 1.25  # 1.25 line-height

        total_lines = 0
        for line in full_text.split("\n"):
            total_lines += max(1, (len(line) + chars_per_ln - 1) // chars_per_ln)

        needed_h = total_lines * line_h_emu
        if needed_h <= ph_height or font_pt <= min_pt:
            break
        font_pt -= 0.5

    # Apply the chosen font size to all runs
    chosen = Pt(max(font_pt, min_pt))
    for para in tf.paragraphs:
        for run in para.runs:
            run.font.size = chosen
            if run.font.color.type is None:
                run.font.color.rgb = TEXT_DARK


# ─── Text replacement (handles split runs) ───────────────────────────────────

def replace_in_paragraph(para, fields: dict):
    if not para.runs:
        return
    full = "".join(r.text for r in para.runs)
    replaced = full
    for k, v in fields.items():
        if not k.startswith("__"):
            replaced = replaced.replace(k, str(v) if v is not None else "")
    if replaced == full:
        return
    para.runs[0].text = replaced
    for run in para.runs[1:]:
        run.text = ""


def fill_shape(shape, fields: dict):
    if shape.has_text_frame:
        for para in shape.text_frame.paragraphs:
            replace_in_paragraph(para, fields)
    if shape.has_table:
        for row in shape.table.rows:
            for cell in row.cells:
                for para in cell.text_frame.paragraphs:
                    replace_in_paragraph(para, fields)
    if shape.shape_type == 6:
        try:
            for sub in shape.shapes:
                fill_shape(sub, fields)
        except Exception:
            pass


def fill_slide(slide, fields: dict):
    for shape in slide.shapes:
        fill_shape(shape, fields)


# ─── PPTX table builder ───────────────────────────────────────────────────────

def _set_cell_bg(cell, rgb: RGBColor):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for tag in ("a:solidFill", "a:gradFill", "a:noFill"):
        for old in tcPr.findall(qn(tag)):
            tcPr.remove(old)
    solidFill = etree.SubElement(tcPr, qn("a:solidFill"))
    srgbClr   = etree.SubElement(solidFill, qn("a:srgbClr"))
    srgbClr.set("val", str(rgb).upper())


def _add_pptx_table(slide, rows: list,
                    left=None, top=None, width=None,
                    first_row_is_header=True) -> int:
    """
    Add a table to the slide. Returns the bottom-edge EMU of the table.
    All row heights are set explicitly to prevent PowerPoint from auto-expanding.
    """
    if not rows:
        return int(top) if top is not None else int(CONTENT_TOP)

    n_cols = max(len(r) for r in rows)
    n_rows = len(rows)
    rows   = [list(r) + [""] * (n_cols - len(r)) for r in rows]

    left_emu  = int(left)  if left  is not None else int(TABLE_LEFT)
    top_emu   = int(top)   if top   is not None else int(CONTENT_TOP)
    width_emu = int(width) if width is not None else int(TABLE_W)

    row_h_emu = int(TABLE_ROW_H)
    hdr_h_emu = int(TABLE_HDR_H)

    # Calculate total table height
    if first_row_is_header:
        height_emu = hdr_h_emu + (n_rows - 1) * row_h_emu
    else:
        height_emu = n_rows * row_h_emu

    # Hard clamp: never exceed content area bottom
    max_h = int(CONTENT_BOTTOM) - top_emu
    height_emu = min(height_emu, max(max_h, row_h_emu))

    tbl_shape = slide.shapes.add_table(
        n_rows, n_cols,
        left_emu, top_emu, width_emu, height_emu
    )
    tbl = tbl_shape.table

    # Equal column widths — distribute any rounding remainder to last column
    base_w    = width_emu // n_cols
    remainder = width_emu - base_w * n_cols
    for ci in range(n_cols):
        tbl.columns[ci].width = base_w + (remainder if ci == n_cols - 1 else 0)

    # Populate and style cells
    for ri, row_data in enumerate(rows):
        is_header = (ri == 0 and first_row_is_header)
        bg = HPE_GREEN if is_header else (STRIPE_ODD if ri % 2 == 1 else STRIPE_EVN)
        for ci, val in enumerate(row_data[:n_cols]):
            cell = tbl.cell(ri, ci)
            cell.text = str(val or "")
            cell.text_frame.word_wrap = True
            for para in cell.text_frame.paragraphs:
                for run in para.runs:
                    run.font.size = FONT_HDR if is_header else FONT_TABLE
                    if is_header:
                        run.font.bold = True
                        run.font.color.rgb = WHITE
                    else:
                        run.font.color.rgb = TEXT_DARK
            _set_cell_bg(cell, bg)

    # Explicitly set every row height to prevent corruption / auto-expand
    for ri in range(n_rows):
        if ri == 0 and first_row_is_header:
            tbl.rows[ri].height = hdr_h_emu
        else:
            tbl.rows[ri].height = row_h_emu

    return top_emu + height_emu


# ─── Slide removal ────────────────────────────────────────────────────────────

def remove_slide(prs, idx: int):
    sldIdLst = prs.slides._sldIdLst
    sldId    = sldIdLst[idx]
    rId      = sldId.get(f"{{{REL}}}id")
    sldIdLst.remove(sldId)
    if rId:
        try:
            prs.part.drop_rel(rId)
        except Exception:
            pass


# ─── Placeholder utilities ────────────────────────────────────────────────────

def _remove_placeholder_by_idx(slide, ph_idx: int):
    """Remove a placeholder shape by its placeholder index."""
    try:
        spTree = slide.shapes._spTree
        to_rm  = []
        for shape in slide.shapes:
            try:
                if (shape.placeholder_format is not None and
                        shape.placeholder_format.idx == ph_idx):
                    to_rm.append(shape._element)
            except Exception:
                pass
        for el in to_rm:
            spTree.remove(el)
    except Exception:
        pass


def _set_placeholder_text(slide, ph_idx: int, text: str, font_size=None):
    """Write text into a placeholder identified by idx."""
    for shape in slide.shapes:
        try:
            if (shape.has_text_frame and
                    shape.placeholder_format is not None and
                    shape.placeholder_format.idx == ph_idx):
                tf = shape.text_frame
                tf.clear()
                para = tf.paragraphs[0]
                run  = para.add_run()
                run.text = text
                if font_size:
                    run.font.size = font_size
                return shape
        except Exception:
            pass
    return None


# ─── Content pagination engine ────────────────────────────────────────────────

def _estimate_text_lines(text: str) -> int:
    """
    Estimate rendered line count at FONT_BODY (11pt) across CONTENT_WIDTH.
    Uses the same CHARS_PER_LINE value everywhere so slide1 placeholder and
    continuation text-boxes produce identical visual spacing.
    Average char width at 11pt ~6.2pt; CONTENT_WIDTH 12.47" * 72 / 6.2 ~= 145.
    Real-world wrap is tighter due to padding/margins; 95 is a reliable value.
    """
    if not text:
        return 0
    CHARS_PER_LINE = 95
    total = 0
    for line in text.split("\n"):
        total += max(1, (len(line) + CHARS_PER_LINE - 1) // CHARS_PER_LINE)
    return total


def _text_block_height_emu(text: str) -> int:
    """Estimate EMU height for a text block including one trailing gap."""
    lines = _estimate_text_lines(text)
    return int(lines * int(TEXT_LINE_H)) + int(TEXT_GAP)


def _table_height_emu(data_rows: int, with_header: bool = True) -> int:
    """Estimate EMU height for a table with given number of data rows."""
    hdr = int(TABLE_HDR_H) if with_header else 0
    return hdr + data_rows * int(TABLE_ROW_H)


def _fits(current_y: int, needed_emu: int) -> bool:
    """True if needed_emu fits between current_y and CONTENT_BOTTOM."""
    return (current_y + needed_emu) <= int(CONTENT_BOTTOM)


# ─── Continuation slide factory ───────────────────────────────────────────────

def _new_continuation_slide(prs, content_src, breadcrumb, moduleNum, moduleName):
    """
    Clone a content slide, fill header fields, clear the body placeholder,
    and return (slide, current_y).
    """
    slide = clone_slide(prs, content_src)
    fill_slide(slide, {
        "{{breadcrumb}}":  breadcrumb,
        "{{moduleNum}}":   moduleNum,
        "{{moduleName}}":  moduleName,
        "{{moduleBody}}":  "",        # body placeholder cleared
    })
    # Normalise font on the (now-empty) placeholder to keep formatting consistent
    _normalize_placeholder_font(slide, ph_idx=1, font_size=FONT_BODY)
    # Remove body placeholder so free-form shapes have full room
    _remove_placeholder_by_idx(slide, ph_idx=1)
    return slide, int(CONTENT_TOP)


# ─── Text box writer ─────────────────────────────────────────────────────────

def _add_text_box(slide, text: str, top_emu: int) -> int:
    """
    Add a text box whose line height matches the slide1 body placeholder.
    Returns the new y position (bottom of the text box + TEXT_GAP).
    """
    lines  = _estimate_text_lines(text)
    # Height = lines * TEXT_LINE_H + small padding so the box never clips
    height = int(lines * int(TEXT_LINE_H)) + int(Inches(0.08))

    txBox = slide.shapes.add_textbox(
        int(CONTENT_LEFT), top_emu,
        int(CONTENT_WIDTH), height,
    )
    tf = txBox.text_frame
    tf.word_wrap = True

    # Set line spacing to exactly TEXT_LINE_H via XML so it matches slide1
    # pptx line spacing in hundredths of a point (1pt = 100 units); fixed mode
    try:
        from pptx.oxml.ns import nsmap
        txBody = tf._txBody
        # Apply to the default paragraph-level spacing via bodyPr isn't enough;
        # we set it on each paragraph's pPr instead
    except Exception:
        pass

    lines_list = text.split("\n")
    for i, line in enumerate(lines_list):
        if i == 0:
            para = tf.paragraphs[0]
        else:
            para = tf.add_paragraph()
        run = para.add_run()
        run.text = line
        run.font.size  = FONT_BODY
        run.font.color.rgb = TEXT_DARK
        # Set fixed line spacing to match template placeholder (115% of 11pt)
        try:
            pPr = para._p.get_or_add_pPr()
            lnSpc = etree.SubElement(pPr, qn("a:lnSpc"))
            spcPts = etree.SubElement(lnSpc, qn("a:spcPts"))
            # 115% of 11pt = 12.65pt; in hundredths-of-a-point = 1265
            spcPts.set("val", "1265")
        except Exception:
            pass

    return top_emu + height + int(TEXT_GAP)


# ─── HTML-aware slide builder (fully rewritten) ───────────────────────────────

def build_html_slide(prs, content_src,
                     breadcrumb: str, moduleNum: str, moduleName: str,
                     body_html: str) -> int:
    """
    Build one or more slides from an HTML description.
    
    Strategy
    --------
    1.  Parse HTML → list of {"type":"text"|"table", ...} blocks.
    2.  The FIRST slide uses the template placeholder for the opening text
        paragraph (up to MAX_LINES_PER_CONTENT lines).  This keeps the
        header/breadcrumb styling intact.
    3.  All further blocks are rendered with explicit text boxes / tables
        on continuation slides, paginating automatically.
    4.  A continuation slide is created whenever the next block (or chunk
        of a block) would overflow the current_y position.
    
    Returns the number of slides created.
    """
    blocks = html_to_blocks(body_html)
    log    = lambda *a: print(*a, file=sys.stderr, flush=True)
    log(f"[build_html_slide] '{moduleName}' -> {len(blocks)} blocks")

    # ── Step 1: separate intro text from the rest ────────────────────────────
    # Collect leading text blocks → shown in the body placeholder on slide 1.
    intro_lines = []
    rest_blocks = []
    found_non_text = False

    for blk in blocks:
        if blk["type"] != "text" or found_non_text:
            found_non_text = True
            rest_blocks.append(blk)
        else:
            intro_lines.append(blk["content"])

    # Limit intro to what fits in the body placeholder (≈ MAX_LINES_PER_CONTENT lines)
    intro_text   = "\n".join(intro_lines)
    intro_chunks = _paginate_text(intro_text, MAX_LINES_PER_CONTENT)

    # ── Step 2: first slide ──────────────────────────────────────────────────
    slide1 = clone_slide(prs, content_src)
    fill_slide(slide1, {
        "{{breadcrumb}}":  breadcrumb,
        "{{moduleNum}}":   moduleNum,
        "{{moduleName}}":  moduleName,
        "{{moduleBody}}":  intro_chunks[0] if intro_chunks else "",
    })
    # Normalise font size in body placeholder so it matches all other slides
    _normalize_placeholder_font(slide1, ph_idx=1, font_size=FONT_BODY)
    slides_created = 1

    # Any overflow from the intro text becomes leading text blocks
    overflow_intro = intro_chunks[1:]  # list of string chunks
    extra_text_blocks = [{"type": "text", "content": c} for c in overflow_intro]

    all_rest = extra_text_blocks + rest_blocks

    if not all_rest:
        log(f"[build_html_slide] -> 1 slide (no overflow)")
        return slides_created

    # ── Step 3: render remaining blocks with full pagination ─────────────────
    # cur_slide starts as None — we create a continuation slide ONLY when the
    # first block actually has content, preventing blank slides before tables.
    cur_slide = None
    cur_y     = int(CONTENT_TOP)

    def _ensure_slide():
        """Lazily create a continuation slide the first time content needs one."""
        nonlocal cur_slide, cur_y, slides_created
        if cur_slide is None:
            cur_slide, cur_y = _new_continuation_slide(
                prs, content_src, breadcrumb, moduleNum, moduleName
            )
            slides_created += 1

    def _new_slide():
        """Force a new continuation slide (overflow)."""
        nonlocal cur_slide, cur_y, slides_created
        cur_slide, cur_y = _new_continuation_slide(
            prs, content_src, breadcrumb, moduleNum, moduleName
        )
        slides_created += 1

    for blk in all_rest:
        if blk["type"] == "text":
            chunks = _paginate_text(blk["content"], MAX_LINES_PER_CONTENT)
            for chunk in chunks:
                if not chunk.strip():
                    continue
                needed = _text_block_height_emu(chunk)
                _ensure_slide()
                if not _fits(cur_y, needed):
                    _new_slide()
                    log(f"[build_html_slide] text overflow -> slide {slides_created}")
                cur_y = _add_text_box(cur_slide, chunk, cur_y)

        elif blk["type"] == "table":
            rows = blk["rows"]
            if not rows:
                continue

            header_row = rows[0]
            data_rows  = rows[1:]

            for chunk_data in _paginate_table_rows(data_rows, MAX_TABLE_ROWS_PER_SLIDE):
                chunk_rows = [header_row] + chunk_data
                # Every table chunk gets its own fresh slide so it starts at CONTENT_TOP
                _new_slide()
                log(f"[build_html_slide] table chunk -> slide {slides_created}")

                bottom = _add_pptx_table(
                    cur_slide, chunk_rows,
                    left=int(TABLE_LEFT),
                    top=cur_y,
                    width=int(TABLE_W),
                    first_row_is_header=True,
                )
                cur_y = bottom + int(TEXT_GAP)

    log(f"[build_html_slide] -> {slides_created} slides total")
    return slides_created


def _paginate_text(text: str, max_lines: int) -> list:
    """
    Split text into chunks where each chunk has at most max_lines rendered lines.
    Returns a list of non-empty strings. Returns [''] if text is empty.
    Uses the same CHARS_PER_LINE as _estimate_text_lines so pagination is consistent.
    """
    if not text or not text.strip():
        return [""]

    CHARS_PER_LINE = 95
    logical_lines = text.split("\n")
    chunks  = []
    current = []
    current_line_count = 0

    for line in logical_lines:
        rendered = max(1, (len(line) + CHARS_PER_LINE - 1) // CHARS_PER_LINE)
        if current_line_count + rendered > max_lines and current:
            chunks.append("\n".join(current))
            current = [line]
            current_line_count = rendered
        else:
            current.append(line)
            current_line_count += rendered

    if current:
        chunks.append("\n".join(current))

    return chunks if chunks else [""]


def _paginate_table_rows(data_rows: list, max_rows: int) -> list:
    """Yield lists of at most max_rows data rows."""
    for i in range(0, max(len(data_rows), 1), max_rows):
        chunk = data_rows[i:i + max_rows]
        if chunk:
            yield chunk


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Force UTF-8 on Windows where the default console codec is cp1252
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print("Usage: fill_proposal.py <data.json>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)

    prs        = Presentation(data["template"])
    n_template = len(prs.slides)

    # Identify template slides by layout name
    cover_src = content_src = closing_src = None
    for slide in prs.slides:
        lname = slide.slide_layout.name
        if "Cover"  in lname and cover_src   is None:
            cover_src   = slide
        elif "Thank" in lname and closing_src is None:
            closing_src = slide
        elif content_src is None:
            content_src = slide

    if cover_src   is None: cover_src   = prs.slides[0]
    if content_src is None: content_src = prs.slides[1]
    if closing_src is None: closing_src = prs.slides[min(2, n_template - 1)]

    generated = 0

    for spec in data["slides"]:
        layout = spec["layout"]
        fields = spec.get("fields", {})

        if layout == "LAYOUT_COVER":
            slide = clone_slide(prs, cover_src)
            fill_slide(slide, fields)
            generated += 1

        elif layout == "LAYOUT_CLOSING":
            slide = clone_slide(prs, closing_src)
            fill_slide(slide, fields)
            generated += 1

        elif layout == "LAYOUT_CONTENT":
            slide = clone_slide(prs, content_src)
            fill_slide(slide, fields)
            # Fit body text inside the template placeholder; normalise font size
            _fit_text_in_body_placeholder(slide, ph_idx=1,
                                          min_font=Pt(8), target_font=FONT_BODY)
            generated += 1

        elif layout == "LAYOUT_HTML":
            breadcrumb = fields.get("{{breadcrumb}}", "")
            moduleNum  = fields.get("{{moduleNum}}", "")
            moduleName = fields.get("{{moduleName}}", "")
            body_html  = fields.get("__html__", "")
            n = build_html_slide(
                prs, content_src,
                breadcrumb, moduleNum, moduleName, body_html,
            )
            generated += n

        elif layout == "LAYOUT_TABLE":
            # Classic section table — split into multiple slides if rows overflow
            text_fields = {k: v for k, v in fields.items() if not k.startswith("__")}
            text_fields.setdefault("{{moduleNum}}",  "")
            text_fields.setdefault("{{moduleName}}", "")
            text_fields.setdefault("{{moduleBody}}", "")

            headers  = fields.get("__tableHeader__") or []
            all_rows = fields.get("__tableRows__")    or []

            if not all_rows:
                # No rows → still emit one slide
                slide = clone_slide(prs, content_src)
                fill_slide(slide, text_fields)
                generated += 1
            else:
                # Paginate rows across slides
                for chunk_idx, chunk in enumerate(
                    _paginate_table_rows(all_rows, MAX_TABLE_ROWS_PER_SLIDE)
                ):
                    slide = clone_slide(prs, content_src)
                    # Only show breadcrumb/section header on first chunk
                    chunk_fields = dict(text_fields)
                    if chunk_idx > 0:
                        chunk_fields["{{breadcrumb}}"]  = text_fields.get("{{breadcrumb}}", "") + " (cont.)"
                    fill_slide(slide, chunk_fields)
                    _remove_placeholder_by_idx(slide, ph_idx=1)
                    table_rows = ([headers] + chunk) if headers else chunk
                    _add_pptx_table(
                        slide, table_rows,
                        left=int(TABLE_LEFT),
                        top=int(CONTENT_TOP),
                        width=int(TABLE_W),
                        first_row_is_header=bool(headers),
                    )
                    generated += 1

    # Remove original template slides
    for i in range(n_template - 1, -1, -1):
        remove_slide(prs, i)

    prs.save(data["output"])
    print(f"[SUCCESS] {generated} slides -> {data['output']}")


if __name__ == "__main__":
    main()