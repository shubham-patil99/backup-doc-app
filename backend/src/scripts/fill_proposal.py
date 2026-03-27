#!/usr/bin/env python3
"""
fill_proposal.py

Fully fixed:
- Handles split text runs
- Supports tables
- Supports grouped shapes
- Safe ASCII logging
"""

import sys, json, copy
from pptx import Presentation

PML = "http://schemas.openxmlformats.org/presentationml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


# ─────────────────────────────────────────────────────────────────────────────
# Clone slide (keeps full formatting)
# ─────────────────────────────────────────────────────────────────────────────
def clone_slide(prs, src_slide):
    new_slide = prs.slides.add_slide(src_slide.slide_layout)

    src_sp = src_slide.shapes._spTree
    dst_sp = new_slide.shapes._spTree

    for child in list(dst_sp):
        dst_sp.remove(child)

    for child in src_sp:
        dst_sp.append(copy.deepcopy(child))

    # Copy background
    src_bg = src_slide._element.find(f"{{{PML}}}bg")
    if src_bg is not None:
        dst_el = new_slide._element
        old_bg = dst_el.find(f"{{{PML}}}bg")
        if old_bg is not None:
            dst_el.remove(old_bg)
        dst_el.insert(0, copy.deepcopy(src_bg))

    new_slide.name = src_slide.name
    return new_slide


# ─────────────────────────────────────────────────────────────────────────────
# TEXT REPLACEMENT (CORE FIX)
# ─────────────────────────────────────────────────────────────────────────────
def replace_in_paragraph(para, fields):
    # Merge all runs
    full_text = "".join(run.text for run in para.runs)

    replaced = full_text
    for k, v in fields.items():
        replaced = replaced.replace(k, str(v) if v else "")

    # Only update if something changed
    if replaced != full_text:
        para.text = replaced


def fill_shape(shape, fields):
    # Normal text
    if shape.has_text_frame:
        for para in shape.text_frame.paragraphs:
            replace_in_paragraph(para, fields)

    # TABLE SUPPORT (CRITICAL)
    if shape.has_table:
        for row in shape.table.rows:
            for cell in row.cells:
                for para in cell.text_frame.paragraphs:
                    replace_in_paragraph(para, fields)

    # GROUPED SHAPES
    if shape.shape_type == 6:
        for sub_shape in shape.shapes:
            fill_shape(sub_shape, fields)


def fill_slide(slide, fields):
    for shape in slide.shapes:
        fill_shape(shape, fields)


# ─────────────────────────────────────────────────────────────────────────────
# Remove slide
# ─────────────────────────────────────────────────────────────────────────────
def remove_slide(prs, idx):
    sldIdLst = prs.slides._sldIdLst
    sldId = sldIdLst[idx]
    rId = sldId.get(f"{{{REL}}}id")
    sldIdLst.remove(sldId)

    if rId:
        try:
            prs.part.drop_rel(rId)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print("Usage: fill_proposal.py <data.json>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)

    prs = Presentation(data["template"])

    # Map slides
    tmap = {s.name: i for i, s in enumerate(prs.slides)}
    n_template = len(prs.slides)

    cover_idx   = tmap.get("LAYOUT_COVER", 0)
    content_idx = tmap.get("LAYOUT_CONTENT_BODY", 1)
    closing_idx = tmap.get("LAYOUT_CLOSING", 2)

    cover_src   = prs.slides[cover_idx]
    content_src = prs.slides[content_idx]
    closing_src = prs.slides[closing_idx]

    # Generate slides
    for spec in data["slides"]:
        layout = spec["layout"]
        fields = spec.get("fields", {})

        if layout == "LAYOUT_COVER":
            src = cover_src
        elif layout == "LAYOUT_CLOSING":
            src = closing_src
        else:
            src = content_src

        new_slide = clone_slide(prs, src)
        fill_slide(new_slide, fields)

    # Remove template slides
    for i in range(n_template - 1, -1, -1):
        remove_slide(prs, i)

    prs.save(data["output"])

    # ASCII-safe print
    print(f"[SUCCESS] {len(prs.slides)} slides generated -> {data['output']}")


if __name__ == "__main__":
    main()