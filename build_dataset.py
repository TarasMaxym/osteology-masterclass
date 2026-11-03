#!/usr/bin/env python3
"""
Builds the standalone dataset and media bundle for the JUMC Osteology & Pins Masterclass.
Reads the official 2026 Pin PPTX decks, DOCX answer keys, and gap-filler Hand/Foot/Ligament
occlusion cards, outputting static/data/dataset.json and optimized images in static/media/.
"""

import json
import math
import os
import re
import shutil
import sqlite3
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
import zlib

from knowledge_base import (
    BONE_META,
    LANDMARK_INTEL,
    SKULL_SLIDE_META,
    SPECIFIC_PIN_FIXES,
    SYLLABUS_GAP_DRILLS,
)
from bone_id_kb import BONE_ID_CATEGORIES, BONE_ID_ITEMS

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}

VIEW_W = 1600.0
VIEW_H = 900.0
MEDIA_CACHE_VERSION = "v2"


def normalize_jpeg_exif_orientation_to_1(data):
    """
    PowerPoint applies EXIF orientation as an explicit OpenXML `<a:xfrm rot="...">` transform
    on `<p:pic>`, whereas web browsers ALSO auto-apply EXIF Orientation (`image-orientation: from-image`),
    causing a double-rotation when EXIF Orientation != 1 (e.g. SKULL image16.jpeg with EXIF=6 + rot=90).
    This helper patches JPEG EXIF tag 0x0112 (Orientation) in-place to 1 before saving/resizing.
    Returns (patched_bytes, was_patched, width, height).
    """
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", data[16:24])
            return data, False, w, h
        return data, False, 1800, 1800

    buf = bytearray(data)
    patched = False
    w = h = 1800
    i = 2
    n = len(buf)
    while i < n - 1:
        if buf[i] != 0xFF:
            i += 1
            continue
        while i < n and buf[i] == 0xFF:
            i += 1
        if i >= n:
            break
        marker = buf[i]
        i += 1
        if marker in (0xD8, 0xD9) or (0xD0 <= marker <= 0xD7):
            continue
        if marker == 0xDA:  # Start of Scan (image bitstream follows)
            break
        if i + 2 > n:
            break
        seg_len = struct.unpack(">H", buf[i : i + 2])[0]
        seg_start = i + 2
        seg_end = i + seg_len
        if seg_end > n:
            break
        if marker in (0xC0, 0xC1, 0xC2) and seg_len >= 7:
            h, w = struct.unpack(">HH", buf[seg_start + 1 : seg_start + 5])
        elif marker == 0xE1 and buf[seg_start : seg_start + 6] == b"Exif\x00\x00":
            tiff_start = seg_start + 6
            if tiff_start + 8 <= seg_end:
                endian_bytes = bytes(buf[tiff_start : tiff_start + 2])
                if endian_bytes in (b"II", b"MM"):
                    endian = "<" if endian_bytes == b"II" else ">"
                    ifd_off = struct.unpack(endian + "I", buf[tiff_start + 4 : tiff_start + 8])[0]
                    ifd_pos = tiff_start + ifd_off
                    if ifd_pos + 2 <= seg_end:
                        cnt = struct.unpack(endian + "H", buf[ifd_pos : ifd_pos + 2])[0]
                        for k in range(cnt):
                            ent_pos = ifd_pos + 2 + k * 12
                            if ent_pos + 12 > seg_end:
                                break
                            tag, typ, num = struct.unpack(endian + "HHI", buf[ent_pos : ent_pos + 8])
                            if tag == 0x0112 and typ == 3 and num >= 1:
                                cur_val = struct.unpack(endian + "H", buf[ent_pos + 8 : ent_pos + 10])[0]
                                if cur_val != 1:
                                    buf[ent_pos + 8 : ent_pos + 10] = struct.pack(endian + "H", 1)
                                    patched = True
        i += seg_len

    return bytes(buf), patched, w, h


def decode_png_opaque_points(data):
    """Decodes non-transparent pixel centers (x+0.5, y+0.5) of an 8-bit non-interlaced PNG."""
    pos = 8
    w = h = color_type = None
    idat = bytearray()
    trns = None
    while pos < len(data):
        ln, ctype = struct.unpack(">I4s", data[pos : pos + 8])
        chunk = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if ctype == b"IHDR":
            w, h, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or interlace != 0:
                return None, None, []
        elif ctype == b"tRNS":
            trns = chunk
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(bytes(idat))
    bpp = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color_type]
    stride = w * bpp
    prev = bytearray(stride)
    pts = []
    idx = 0
    for y in range(h):
        ftype = raw[idx]
        idx += 1
        cur = bytearray(raw[idx : idx + stride])
        idx += stride
        if ftype == 1:
            for j in range(bpp, stride):
                cur[j] = (cur[j] + cur[j - bpp]) & 0xFF
        elif ftype == 2:
            for j in range(stride):
                cur[j] = (cur[j] + prev[j]) & 0xFF
        elif ftype == 3:
            for j in range(stride):
                a = cur[j - bpp] if j >= bpp else 0
                cur[j] = (cur[j] + ((a + prev[j]) >> 1)) & 0xFF
        elif ftype == 4:
            for j in range(stride):
                a = cur[j - bpp] if j >= bpp else 0
                b = prev[j]
                c = prev[j - bpp] if j >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                cur[j] = (cur[j] + pr) & 0xFF
        prev = cur
        for x in range(w):
            if color_type == 6:
                alpha = cur[x * 4 + 3]
            elif color_type == 4:
                alpha = cur[x * 2 + 1]
            elif color_type == 3:
                pidx = cur[x]
                alpha = trns[pidx] if (trns and pidx < len(trns)) else 255
            else:
                r, g, b = cur[x * 3], cur[x * 3 + 1], cur[x * 3 + 2]
                alpha = 0 if (r > 248 and g > 248 and b > 248) else 255
            if alpha > 64:
                pts.append((x + 0.5, y + 0.5))
    return w, h, pts


def analyze_png_arrow_endpoints(data):
    """Finds exact sub-pixel normalized ((tail_u, tail_v), (tip_u, tip_v)) of a PNG arrow sticker."""
    w, h, pts = decode_png_opaque_points(data)
    if not pts:
        return None
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - cx) ** 2 for p in pts) / n
    syy = sum((p[1] - cy) ** 2 for p in pts) / n
    sxy = sum((p[0] - cx) * (p[1] - cy) for p in pts) / n
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    dx, dy = math.cos(theta), math.sin(theta)
    proj = [((p[0] - cx) * dx + (p[1] - cy) * dy, -(p[0] - cx) * dy + (p[1] - cy) * dx, p[0], p[1]) for p in pts]
    tmin = min(p[0] for p in proj)
    tmax = max(p[0] for p in proj)
    span = max(1e-6, tmax - tmin)
    pos_w = max(abs(p[1]) for p in proj if p[0] > tmin + 0.55 * span)
    neg_w = max(abs(p[1]) for p in proj if p[0] < tmin + 0.45 * span)
    if pos_w >= neg_w:
        tip_pts = [p for p in proj if p[0] >= tmax - 1.5]
        tail_pts = [p for p in proj if p[0] <= tmin + 2.5]
    else:
        tip_pts = [p for p in proj if p[0] <= tmin + 1.5]
        tail_pts = [p for p in proj if p[0] >= tmax - 2.5]
    tip_u = (sum(p[2] for p in tip_pts) / len(tip_pts)) / w
    tip_v = (sum(p[3] for p in tip_pts) / len(tip_pts)) / h
    tail_u = (sum(p[2] for p in tail_pts) / len(tail_pts)) / w
    tail_v = (sum(p[3] for p in tail_pts) / len(tail_pts)) / h
    return (tail_u, tail_v), (tip_u, tip_v)


def find_anatomy_root():
    base = "/Users/maxymtaras/Library/CloudStorage"
    for d in sorted(os.listdir(base)):
        if d.startswith("OneDrive-Uniwersytet"):
            cand = os.path.join(base, d, "Classes", "Anatomy")
            if os.path.isdir(cand):
                return cand
    raise FileNotFoundError("Could not locate Classes/Anatomy in OneDrive.")


def transform_pt(u, v, x, y, cx, cy, rot_deg, flip_h, flip_v):
    lx = (u - 0.5) * cx * (-1.0 if flip_h else 1.0)
    ly = (v - 0.5) * cy * (-1.0 if flip_v else 1.0)
    rad = math.radians(rot_deg)
    rx = lx * math.cos(rad) - ly * math.sin(rad)
    ry = lx * math.sin(rad) + ly * math.cos(rad)
    return (x + cx * 0.5 + rx, y + cy * 0.5 + ry)


def solve_min_assignment(cost_matrix):
    """Exact minimum-cost bipartite matching (DP over bitmask) for N <= 20."""
    n = len(cost_matrix)
    m = len(cost_matrix[0]) if n else 0
    if n == 0 or m < n:
        return {}
    memo = {}

    def dp(i, mask):
        if i == n:
            return (0.0, ())
        if (i, mask) in memo:
            return memo[(i, mask)]
        best_cost = 1e30
        best_choice = ()
        row = cost_matrix[i]
        for j in range(m):
            if not (mask & (1 << j)):
                sub_cost, sub_choice = dp(i + 1, mask | (1 << j))
                tot = row[j] + sub_cost
                if tot < best_cost:
                    best_cost = tot
                    best_choice = (j,) + sub_choice
        memo[(i, mask)] = (best_cost, best_choice)
        return memo[(i, mask)]

    _, assignment = dp(0, 0)
    return {i: assignment[i] for i in range(n)}


def clean_title_case(s):
    s = re.sub(r"\s+", " ", s.strip())
    # Preserve Roman numerals or acronyms if any, otherwise smart sentence/anatomical case
    lower = s.lower()
    if not lower:
        return s
    return lower[0].upper() + lower[1:]


def generate_synonyms(canonical, raw_answer, extra_syns):
    syns = set()
    for base_str in [canonical, raw_answer] + list(extra_syns):
        b = re.sub(r"\s+", " ", base_str.strip().lower())
        if not b:
            continue
        syns.add(b)
        # Handle parenthetical forms: e.g. "anterior (pelvic) sacral foramen"
        # -> "anterior sacral foramen", "pelvic sacral foramen", and inner/outer parts
        m = re.search(r"^(.*?)\(([^)]+)\)(.*)$", b)
        if m:
            pre, inner, post = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            without_paren = re.sub(r"\s+", " ", f"{pre} {post}").strip()
            if without_paren:
                syns.add(without_paren)
            if inner:
                # If pre is single adjective like "anterior", "posterior", "round", swap it
                pre_words = pre.split()
                if len(pre_words) == 1 and post:
                    syns.add(re.sub(r"\s+", " ", f"{inner} {post}").strip())
                elif not post and len(inner.split()) >= 2:
                    # e.g. "posterior surface (sulcus of radial nerve)" -> accept inner!
                    syns.add(inner)
                elif pre and not post and len(inner.split()) == 1:
                    # e.g. "proximal end (head)" -> accept "head" & "proximal end"
                    syns.add(inner)

    # Expand common anatomical equivalences across all collected synonyms
    expanded = set(syns)
    swaps = [
        ("sulcus of ", "groove for "),
        ("sulcus for ", "groove for "),
        ("sulcus of ", "sulcus for "),
        ("groove of ", "groove for "),
        ("sulcus", "groove"),
        ("margin", "border"),
        ("incisure", "notch"),
        ("incissure", "notch"),
        ("porus", "meatus"),
        ("porus", "opening"),
        ("maxillary bone", "maxilla"),
        ("sphenoid bone", "sphenoid"),
        ("frontal bone", "frontal"),
        ("temporal bone", "temporal"),
        ("zygomatic bone", "zygomatic"),
        ("palatine bone", "palatine"),
        ("supraepicondylar crest", "supracondylar ridge"),
        ("supraepicondylar crest", "supraepicondylar ridge"),
        ("supracondylar line", "supracondylar ridge"),
        ("articular facet", "articular surface"),
        ("talar sulcus", "sulcus tali"),
        ("coronary suture", "coronal suture"),
        ("tuberosity", "tubercle"),
    ]
    for s in list(syns):
        for a, b in swaps:
            if a in s:
                expanded.add(re.sub(r"\s+", " ", s.replace(a, b)).strip())
            if b in s:
                expanded.add(re.sub(r"\s+", " ", s.replace(b, a)).strip())
        # Foramen word order: "oval foramen" <-> "foramen ovale", "spinous foramen" <-> "foramen spinosum"
        if s == "oval foramen":
            expanded.add("foramen ovale")
        elif s == "spinous foramen":
            expanded.add("foramen spinosum")
        elif s in ("round foramen", "foramen rotundum"):
            expanded.update(["round foramen", "foramen rotundum"])
        elif s == "fovea of head":
            expanded.update(["fovea capitis", "fovea of head of femur", "fovea of head of radius"])

        # "articular facet of superior/inferior articular process" -> "superior/inferior articular facet"
        m_ap = re.match(r"^articular (?:facet|surface) of (superior|inferior) articular process$", s)
        if m_ap:
            dir_word = m_ap.group(1)
            expanded.add(f"{dir_word} articular facet")
            expanded.add(f"{dir_word} articular surface")

        # "posterior/middle/anterior articular talar/calcaneal facet" -> "posterior talar articular facet"
        m_tc = re.match(r"^(anterior|middle|posterior) articular (talar|calcaneal) (facet|surface)$", s)
        if m_tc:
            expanded.add(f"{m_tc.group(1)} {m_tc.group(2)} articular {m_tc.group(3)}")
            expanded.add(f"{m_tc.group(1)} {m_tc.group(2)} {m_tc.group(3)}")

    # Remove canonical lowercase from alternate display list later if needed, keep full set for grading
    return sorted(x for x in expanded if x)


def infer_category_and_intel(canonical, raw_answer, bone_name):
    low = canonical.lower()
    raw_low = raw_answer.lower()
    matched = None
    # Match longest key in LANDMARK_INTEL
    best_len = 0
    for k, val in LANDMARK_INTEL.items():
        if (k in low or k in raw_low) and len(k) > best_len:
            matched = val
            best_len = len(k)

    if matched:
        return (
            matched["category"],
            matched.get("hook", ""),
            matched.get("cue", ""),
            matched.get("synonyms", []),
        )

    # Heuristic fallback classification for remaining structures so filters are comprehensive
    cat = "bone"
    hook = ""
    cue = ""
    if any(w in low for w in ["tendon", "tuberosity", "muscular", "mylohyoid", "masseter", "pterygoid", "digastric", "soleal", "deltoid", "scalene", "supinator", "trochanter", "buccinator", "temporal line", "nuchal line"]):
        cat = "tendon_muscle"
    elif any(w in low for w in ["ligament", "conoid", "trapezoid", "intercondylar area"]):
        cat = "ligament"
    elif any(w in low for w in ["foramen", "canal", "meatus", "porus", "fissure", "sinus", "artery", "arterial", "vein", "nerve", "hiatus"]):
        cat = "neurovascular"

    # Useful concise cues for common structural patterns
    if "articular facet" in low or "articular surface" in low or "articular circumference" in low:
        hook = f"Smooth hyaline-cartilage-covered joint surface on {bone_name}."
    elif "styloid process" in low and "radius" in bone_name.lower():
        cat = "tendon_muscle"
        hook = "Insertion of brachioradialis tendon & attachment of radial collateral ligament of wrist (extends ~1 cm further distally than ulnar styloid!)."
    elif "styloid process" in low and "ulna" in bone_name.lower():
        cat = "ligament"
        hook = "Attachment of ulnar collateral ligament of wrist & apex of triangular fibrocartilage articular disc."
    elif "styloid process" in low:
        cat = "tendon_muscle"
        hook = "Riolan's bouquet (3 muscles + 2 ligaments): stylohyoid, styloglossus, stylopharyngeus + stylohyoid & stylomandibular ligaments."
    elif "medial epicondyle" in low and "humerus" in bone_name.lower():
        cat = "tendon_muscle"
        hook = "Common FLEXOR-PRONATOR tendon origin + ulnar collateral ligament (ulnar nerve grooves posteriorly)."
    elif "lateral epicondyle" in low and "humerus" in bone_name.lower():
        cat = "tendon_muscle"
        hook = "Common EXTENSOR-SUPINATOR tendon origin + radial collateral ligament (tennis elbow / lateral epicondylitis site)."
    elif "medial malleolus" in low:
        cat = "ligament"
        hook = "Attachment of medial (deltoid) ligament of ankle; tibialis posterior & FDL tendons groove posteriorly."
    elif "lateral malleolus" in low:
        cat = "ligament"
        hook = "Extends further distally & posteriorly than medial malleolus; attaches anterior/posterior talofibular & calcaneofibular ligaments."
    elif "trochlea" in low and "humerus" in bone_name.lower():
        hook = "Pulley-shaped medial condylar surface articulating with trochlear notch of ulna."
    elif "capitulum" in low and "humerus" in bone_name.lower():
        hook = "Rounded lateral condylar surface articulating with fovea of head of radius."
    elif "iliac crest" in low:
        cat = "tendon_muscle"
        hook = "Attachment of external oblique, internal oblique, transversus abdominis, latissimus dorsi, quadratus lumborum, tensor fasciae latae & gluteus medius."
    elif "pecten pubis" in low:
        cat = "tendon_muscle"
        hook = "Pectineal line of pubis: origin of pectineus muscle & attachment of pectineal (Cooper's) + lacunar ligaments."
    elif "auricular surface" in low:
        hook = "Ear-shaped sacroiliac joint surface (synovial anteriorly, reinforced posteriorly by strong interosseous sacroiliac ligaments at tuberosity)."
    elif "promontory" in low:
        hook = "Anterosuperior projecting lip of S1 body forming posterior margin of pelvic inlet (conjugate diameter landmark)."
    elif "sulcus for superior sagittal sinus" in low:
        hook = "Midline dural venous sinus groove along internal cranial vault; falx cerebri attaches to its margins."
    elif "sulcus for transverse sinus" in low:
        hook = "Horizontal dural venous sinus groove running laterally from internal occipital protuberance (tentorium cerebelli attaches along margins)."
    elif "sulcus for sigmoid sinus" in low:
        hook = "S-shaped venous groove curving down posterior petrous/mastoid temporal into jugular foramen to become internal jugular vein."
    elif "sulcus for middle meningeal artery" in low or "arterial sulcus" in low:
        hook = "Branching vascular grooves from middle meningeal artery (entering via foramen spinosum) — epidural hematoma risk at pterion!"
    elif "granular foveola" in low:
        hook = "Pits lateral to superior sagittal sinus indented by arachnoid granulations (CSF reabsorption into venous blood)."
    elif "crista galli" in low:
        cat = "ligament"
        hook = "Upward midline ethmoid crest in anterior cranial fossa: anterior attachment of FALX CEREBRI."
    elif "anterior clinoid process" in low:
        cat = "ligament"
        hook = "Medial projection of lesser wing of sphenoid: attachment of free border of tentorium cerebelli."
    elif "trigeminal impression" in low:
        cat = "neurovascular"
        hook = "Shallow depression near anterior apex of petrous temporal bone lodging TRIGEMINAL GANGLION (CN V) in Meckel's cave."
    elif "arcuate eminence" in low:
        hook = "Rounded dome on anterior surface of petrous temporal bone raised by underlying ANTERIOR (SUPERIOR) SEMICIRCULAR CANAL."
    elif "mandibular fossa" in low or "articular tubercle" in low or "head of mandible" in low:
        hook = "Temporomandibular joint (TMJ) articular surface covered by fibrocartilage; divided into upper & lower compartments by articular disc."

    return cat, hook, cue, []


def parse_docx_answers(docx_path, is_skull=False):
    ans = {}
    with zipfile.ZipFile(docx_path) as z:
        wtree = ET.fromstring(z.read("word/document.xml"))
        for tbl in wtree.findall(".//w:tbl", NS):
            for r_idx, row in enumerate(tbl.findall("w:tr", NS)):
                cells = []
                for tc in row.findall("w:tc", NS):
                    paras = [
                        "".join((t.text or "") for t in p.findall(".//w:t", NS)).strip()
                        for p in tc.findall(".//w:p", NS)
                    ]
                    cells.append([p for p in paras if p])
                if r_idx > 0 and len(cells) >= 2 and cells[0]:
                    if is_skull:
                        m = re.match(r"^(\d+)\.?\s*(.*)$", cells[0][0])
                    else:
                        m = re.match(r"^(\d+)\s*;?\s*(.*)$", cells[0][0])
                    if m:
                        snum = int(m.group(1))
                        bname = m.group(2).strip()
                        items = [re.sub(r"^\d+\.\s*", "", x).strip() for x in cells[1]]
                        ans[snum] = {"raw_bone": bname, "items": items}
    return ans


def export_media_file(raw_bytes, ext, dest_path, optimize_large=True):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    clean_bytes, patched_exif, w, h = normalize_jpeg_exif_orientation_to_1(raw_bytes)
    if patched_exif:
        print(f"  [EXIF-FIX] Normalized EXIF Orientation -> 1 for {dest_path} ({w}x{h})")
    if patched_exif or not os.path.isfile(dest_path):
        with open(dest_path, "wb") as f:
            f.write(clean_bytes)
        if optimize_large and max(w, h) > 1800 and ext.lower() in (".jpg", ".jpeg"):
            subprocess.check_call(
                ["sips", "-Z", "1800", "-s", "formatOptions", "84", dest_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    return w, h


def process_pptx_deck(deck_id, pptx_path, ans_dict, media_subdir, out_static_dir):
    slides_out = []
    pins_out = []

    with zipfile.ZipFile(pptx_path) as z:
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        sld_sz = pres.find("p:sldSz", NS)
        slide_cx = float(sld_sz.attrib["cx"])
        slide_cy = float(sld_sz.attrib["cy"])

        def sx(val):
            return round((float(val) / slide_cx) * VIEW_W, 2)

        def sy(val):
            return round((float(val) / slide_cy) * VIEW_H, 2)

        # Export all media first, record original dimensions, and pre-decode PNG arrow endpoints
        mdims = {}
        murl = {}
        png_arrow_uv = {}
        for f in sorted(z.namelist()):
            if not f.startswith("ppt/media/"):
                continue
            bname = os.path.basename(f)
            ext = os.path.splitext(bname)[1]
            rel_fs_path = f"media/{media_subdir}/{bname}"
            dest = os.path.join(out_static_dir, rel_fs_path)
            raw_b = z.read(f)
            w, h = export_media_file(raw_b, ext, dest, optimize_large=True)
            mdims[f] = (w, h)
            murl[f] = f"{rel_fs_path}?{MEDIA_CACHE_VERSION}"
            if ext.lower() == ".png" and max(w, h) < 300 and not (deck_id == "BONES" and bname == "image42.png"):
                uv_endpoints = analyze_png_arrow_endpoints(raw_b)
                if uv_endpoints:
                    png_arrow_uv[f] = uv_endpoints

        pres_rels = ET.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
        rid_to_target = {rel.attrib["Id"]: rel.attrib["Target"] for rel in pres_rels}

        for slide_num, sld_id in enumerate(pres.find("p:sldIdLst", NS), 1):
            rid = sld_id.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            sfile = "ppt/" + rid_to_target[rid].lstrip("/")
            srels = ET.fromstring(z.read(f"ppt/slides/_rels/{os.path.basename(sfile)}.rels"))
            rmap = {
                r.attrib["Id"]: "ppt/media/" + os.path.basename(r.attrib["Target"])
                for r in srels
                if "media" in r.attrib["Target"]
            }
            tree = ET.fromstring(z.read(sfile))

            ans_entry = ans_dict[slide_num]
            raw_bone = ans_entry["raw_bone"]
            raw_items = ans_entry["items"]

            if deck_id == "BONES":
                bmeta = BONE_META[raw_bone]
            else:
                bmeta = SKULL_SLIDE_META[slide_num]

            canonical_bone = bmeta["canonical_bone"]
            lab_num = bmeta["lab"]
            region = bmeta["region"]
            base_weight = bmeta["weight"]

            photos = []
            arrows = []
            aux_shapes = []
            num_boxes = []
            slide_titles = []

            for el in tree.find("p:cSld/p:spTree", NS):
                tag = el.tag.split("}")[-1]
                xfrm = el.find(".//a:xfrm", NS)
                if xfrm is None or xfrm.find("a:off", NS) is None or xfrm.find("a:ext", NS) is None:
                    continue
                off = xfrm.find("a:off", NS).attrib
                ext = xfrm.find("a:ext", NS).attrib
                x_emu, y_emu = float(off["x"]), float(off["y"])
                cx_emu, cy_emu = float(ext["cx"]), float(ext["cy"])
                rot_deg = round(float(xfrm.attrib.get("rot", 0)) / 60000.0, 2)
                flip_h = xfrm.attrib.get("flipH") == "1"
                flip_v = xfrm.attrib.get("flipV") == "1"

                geom = {
                    "x": sx(x_emu),
                    "y": sy(y_emu),
                    "w": sx(cx_emu),
                    "h": sy(cy_emu),
                    "rot": rot_deg,
                    "flipH": flip_h,
                    "flipV": flip_v,
                }

                if tag == "pic":
                    blip = el.find(".//a:blip", NS)
                    mfile = rmap[blip.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"]]
                    pw, ph = mdims[mfile]
                    sr = el.find(".//a:srcRect", NS)
                    crop = {}
                    if sr is not None and sr.attrib:
                        for k in ("l", "t", "r", "b"):
                            if k in sr.attrib:
                                crop[k] = round(float(sr.attrib[k]) / 100000.0, 5)

                    is_sticker = mfile.endswith(".png") and max(pw, ph) < 300
                    # Special case: image42.png on BONES slide 31 is a curly brace sticker
                    if deck_id == "BONES" and slide_num == 31 and mfile.endswith("image42.png"):
                        aux_shapes.append({
                            "kind": "pngBrace",
                            "src": murl[mfile],
                            **geom,
                            "center_emu": (x_emu + cx_emu * 0.5, y_emu + cy_emu * 0.5),
                        })
                    elif is_sticker:
                        if mfile in png_arrow_uv:
                            (tu, tv), (pu, pv) = png_arrow_uv[mfile]
                            tail_pt = transform_pt(tu, tv, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            tip_pt = transform_pt(pu, pv, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            arrows.append({
                                "kind": "pngArrow",
                                "src": murl[mfile],
                                **geom,
                                "_tail": tail_pt,
                                "_tip": tip_pt,
                            })
                        else:
                            uv_pairs = [
                                (0.5, 0.0), (0.5, 1.0), (0.0, 0.5), (1.0, 0.5),
                                (0.0, 0.0), (1.0, 1.0), (0.0, 1.0), (1.0, 0.0),
                            ]
                            cands = [
                                (
                                    uv,
                                    transform_pt(uv[0], uv[1], x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v),
                                    transform_pt(1.0 - uv[0], 1.0 - uv[1], x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v),
                                )
                                for uv in uv_pairs
                            ]
                            arrows.append({
                                "kind": "pngArrow",
                                "src": murl[mfile],
                                **geom,
                                "_cands": cands,
                            })
                    else:
                        photos.append({
                            "src": murl[mfile],
                            "origW": pw,
                            "origH": ph,
                            "crop": crop,
                            **geom,
                        })

                elif tag == "sp":
                    prst_el = el.find(".//a:prstGeom", NS)
                    pname = prst_el.attrib.get("prst") if prst_el is not None else None
                    txt = "".join((t.text or "") for t in el.findall(".//a:t", NS)).strip()
                    if txt.isdigit():
                        # Skip stray duplicate "1" on BONES slide 81
                        if deck_id == "BONES" and slide_num == 81 and txt == "1" and y_emu > 2000000:
                            continue
                        num_boxes.append({
                            "num": int(txt),
                            **geom,
                            "_center": (x_emu + cx_emu * 0.5, y_emu + cy_emu * 0.5),
                        })
                    elif txt:
                        slide_titles.append({
                            "text": txt,
                            **geom,
                        })
                    elif pname in ("downArrow", "rightArrow", "line"):
                        if pname == "downArrow":
                            tail = transform_pt(0.5, 0.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            tip = transform_pt(0.5, 1.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            arrows.append({"kind": pname, **geom, "_tail": tail, "_tip": tip})
                        elif pname == "rightArrow":
                            tail = transform_pt(0.0, 0.5, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            tip = transform_pt(1.0, 0.5, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            arrows.append({"kind": pname, **geom, "_tail": tail, "_tip": tip})
                        elif pname == "line":
                            p1 = transform_pt(0.0, 0.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            p2 = transform_pt(1.0, 1.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                            arrows.append({
                                "kind": "line",
                                **geom,
                                "_cands": [((0, 0), p1, p2), ((1, 1), p2, p1)],
                            })
                    elif pname == "rightBrace":
                        aux_shapes.append({
                            "kind": "rightBrace",
                            **geom,
                            "center_emu": (x_emu + cx_emu * 0.5, y_emu + cy_emu * 0.5),
                        })

                elif tag == "cxnSp":
                    p1 = transform_pt(0.0, 0.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                    p2 = transform_pt(1.0, 1.0, x_emu, y_emu, cx_emu, cy_emu, rot_deg, flip_h, flip_v)
                    aux_shapes.append({
                        "kind": "guideLine",
                        "x1": sx(p1[0]),
                        "y1": sy(p1[1]),
                        "x2": sx(p2[0]),
                        "y2": sy(p2[1]),
                        "center_emu": ((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5),
                    })

            num_boxes.sort(key=lambda b: b["num"])
            assert len(num_boxes) == len(raw_items), f"{deck_id} slide {slide_num} mismatch"

            # Solve exact min-cost arrow assignment
            pin_to_arrow = {}
            if len(arrows) == len(num_boxes) and len(arrows) > 0:
                cost_mat = []
                cand_choice = {}
                for i, nb in enumerate(num_boxes):
                    nx, ny = nb["_center"]
                    row_costs = []
                    for j, ar in enumerate(arrows):
                        if "_tail" in ar:
                            tx, ty = ar["_tail"]
                            row_costs.append(math.hypot(nx - tx, ny - ty))
                        else:
                            best_d = 1e30
                            best_pair = None
                            for _, tail_pt, tip_pt in ar["_cands"]:
                                d = math.hypot(nx - tail_pt[0], ny - tail_pt[1])
                                if d < best_d:
                                    best_d = d
                                    best_pair = (tail_pt, tip_pt)
                            row_costs.append(best_d)
                            cand_choice[(i, j)] = best_pair
                    cost_mat.append(row_costs)

                assignment = solve_min_assignment(cost_mat)
                for i, j in assignment.items():
                    ar = dict(arrows[j])
                    if "_tail" in ar:
                        tail_pt, tip_pt = ar.pop("_tail"), ar.pop("_tip")
                    else:
                        ar.pop("_cands", None)
                        tail_pt, tip_pt = cand_choice[(i, j)]
                    ar["tailX"] = sx(tail_pt[0])
                    ar["tailY"] = sy(tail_pt[1])
                    ar["tipX"] = sx(tip_pt[0])
                    ar["tipY"] = sy(tip_pt[1])
                    pin_to_arrow[i] = ar

            # Link auxiliary braces / neck lines to whichever pin arrow tip is closest
            pin_aux = {i: [] for i in range(len(num_boxes))}
            for aux in aux_shapes:
                ax_c, ay_c = aux.pop("center_emu")
                ax_vx, ay_vy = sx(ax_c), sy(ay_c)
                best_i = 0
                best_d = 1e30
                for i in range(len(num_boxes)):
                    ar = pin_to_arrow.get(i)
                    tx = ar["tipX"] if ar else (num_boxes[i]["x"] + num_boxes[i]["w"] * 0.5)
                    ty = ar["tipY"] if ar else (num_boxes[i]["y"] + num_boxes[i]["h"] * 0.5)
                    d = math.hypot(tx - ax_vx, ty - ay_vy)
                    if d < best_d:
                        best_d = d
                        best_i = i
                pin_aux[best_i].append(aux)

            slide_id = f"{deck_id.lower()}_{slide_num:02d}"
            slide_pin_ids = []

            for i, nb in enumerate(num_boxes):
                pin_num = nb["num"]
                raw_ans = raw_items[i]
                fix_key = (deck_id, slide_num, pin_num)
                if fix_key in SPECIFIC_PIN_FIXES:
                    canonical, fix_syns, teacher_note = SPECIFIC_PIN_FIXES[fix_key]
                    syn_base_raw = canonical
                else:
                    canonical = clean_title_case(raw_ans)
                    fix_syns = []
                    teacher_note = ""
                    syn_base_raw = raw_ans

                cat, hook, cue, intel_syns = infer_category_and_intel(canonical, syn_base_raw, canonical_bone)
                all_syns = generate_synonyms(canonical, syn_base_raw, fix_syns + intel_syns)

                ar = pin_to_arrow.get(i)
                label_cx = round(nb["x"] + nb["w"] * 0.5, 2)
                label_cy = round(nb["y"] + nb["h"] * 0.5, 2)
                if ar:
                    tip_x, tip_y = ar["tipX"], ar["tipY"]
                else:
                    # Whole-bone slide 67 (Fibula) -> center of photo
                    if photos:
                        tip_x = round(photos[0]["x"] + photos[0]["w"] * 0.5, 2)
                        tip_y = round(photos[0]["y"] + photos[0]["h"] * 0.5, 2)
                    else:
                        tip_x, tip_y = label_cx, label_cy

                nb_clean = {k: v for k, v in nb.items() if not k.startswith("_")}
                pin_id = f"{slide_id}_p{pin_num:02d}"
                slide_pin_ids.append(pin_id)

                # Slight extra exam weight for high-precision orientation/foramen landmarks
                pin_weight = base_weight
                if cat == "neurovascular":
                    pin_weight = round(pin_weight * 1.15, 2)
                elif any(w in canonical.lower() for w in ["superior", "inferior", "anterior", "posterior", "medial", "lateral"]):
                    pin_weight = round(pin_weight * 1.08, 2)

                pins_out.append({
                    "id": pin_id,
                    "slideId": slide_id,
                    "deck": deck_id,
                    "slideNum": slide_num,
                    "pinNum": pin_num,
                    "bone": canonical_bone,
                    "lab": lab_num,
                    "region": region,
                    "answer": canonical,
                    "rawAnswer": raw_ans,
                    "synonyms": all_syns,
                    "category": cat,
                    "hook": hook,
                    "cue": cue,
                    "teacherNote": teacher_note,
                    "weight": pin_weight,
                    "wholeBone": ar is None,
                    "labelBox": nb_clean,
                    "labelX": label_cx,
                    "labelY": label_cy,
                    "tipX": tip_x,
                    "tipY": tip_y,
                    "arrow": ar,
                    "auxShapes": pin_aux[i],
                })

            slides_out.append({
                "id": slide_id,
                "deck": deck_id,
                "slideNum": slide_num,
                "bone": canonical_bone,
                "rawBone": raw_bone,
                "lab": lab_num,
                "region": region,
                "weight": base_weight,
                "photos": photos,
                "slideTitles": slide_titles,
                "pinIds": slide_pin_ids,
            })

    return slides_out, pins_out


def extract_visual_gap_fillers(anatomy_root, out_static_dir):
    """Extracts Carpal, Hand, Foot Tarsal, and Key Joint Ligament visual occlusion cards."""
    apkg_path = os.path.join(
        anatomy_root,
        "Part 1 - Bones, Joints, Skull & Embryology (practical 5 Nov, test 6 Nov)",
        "From older students (2019-20 Drive)",
        "Anki decks",
        "bones ligaments v8.apkg",
    )
    if not os.path.isfile(apkg_path):
        return []

    wanted_headers = {
        "Carpal bones, Anterior/Posterior (or Palmar/Dorsal whatever the fuck you wanna call it)": (
            "Carpal Bones (Palmar & Dorsal Views)",
            "Carpals & Hand",
            3,
        ),
        "Hand bones, Palmar/Dorsal": (
            "Hand Skeleton (Carpals, Metacarpals & Phalanges)",
            "Carpals & Hand",
            3,
        ),
        "Carpal Articular Surface": (
            "Distal Radius & Ulna (Carpal Articular Surface)",
            "Carpals & Hand",
            3,
        ),
        "Ankle and Foot, Dorsal/Plantar": (
            "Foot & Tarsal Bones (Dorsal & Plantar Views)",
            "Foot & Tarsals",
            5,
        ),
        "Foot and Ankle, Lateral/Medial": (
            "Foot & Ankle Skeleton (Lateral & Medial Views)",
            "Foot & Tarsals",
            5,
        ),
        "Shoulder Ligaments": (
            "Shoulder & Acromioclavicular Joint Ligaments",
            "Joint Ligaments (Bonus)",
            3,
        ),
        "Right Elbow, Anterior/Posterior/Lateral/Medial": (
            "Elbow Joint Capsule & Collateral Ligaments",
            "Joint Ligaments (Bonus)",
            3,
        ),
        "Pelvis Bones & Ligaments, Anterior/Posterior": (
            "Pelvic Joints & Sacrospinous/Sacrotuberous Ligaments",
            "Joint Ligaments (Bonus)",
            4,
        ),
        "Knee Ligaments": (
            "Knee Joint (Cruciate, Collateral Ligaments & Menisci)",
            "Joint Ligaments (Bonus)",
            5,
        ),
    }

    cards_out = []
    occ_dir = os.path.join(out_static_dir, "media", "occlusion")
    os.makedirs(occ_dir, exist_ok=True)
    exported_files = set()

    with zipfile.ZipFile(apkg_path) as z:
        media_map = json.loads(z.read("media").decode("utf-8"))
        inv_media = {v: k for k, v in media_map.items()}
        db_name = "collection.anki21" if "collection.anki21" in z.namelist() else "collection.anki2"
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as tf:
            tf.write(z.read(db_name))
            tf.flush()
            conn = sqlite3.connect(tf.name)
            rows = conn.execute("SELECT flds FROM notes").fetchall()

        for idx, (flds,) in enumerate(rows):
            parts = flds.split("\x1f")
            if len(parts) < 10:
                continue
            hdr = parts[1].strip()
            if hdr not in wanted_headers:
                continue
            clean_title, group_name, lab_num = wanted_headers[hdr]

            m_img = re.search(r'src="([^"]+)"', parts[2])
            m_q = re.search(r'src="([^"]+)"', parts[3])
            m_a = re.search(r'src="([^"]+)"', parts[9])
            if not (m_img and m_q and m_a):
                continue

            img_fn, q_fn, a_fn = m_img.group(1), m_q.group(1), m_a.group(1)
            if not all(fn in inv_media for fn in (img_fn, q_fn, a_fn)):
                continue

            for fn in (img_fn, q_fn, a_fn):
                safe_fn = re.sub(r"[^A-Za-z0-9._-]", "_", fn)
                if safe_fn not in exported_files:
                    with open(os.path.join(occ_dir, safe_fn), "wb") as out_f:
                        out_f.write(z.read(inv_media[fn]))
                    exported_files.add(safe_fn)

            safe_img = re.sub(r"[^A-Za-z0-9._-]", "_", img_fn)
            safe_q = re.sub(r"[^A-Za-z0-9._-]", "_", q_fn)
            safe_a = re.sub(r"[^A-Za-z0-9._-]", "_", a_fn)

            cards_out.append({
                "id": f"occ_{len(cards_out)+1:03d}",
                "title": clean_title,
                "group": group_name,
                "lab": lab_num,
                "baseImg": f"media/occlusion/{safe_img}",
                "qMask": f"media/occlusion/{safe_q}",
                "aMask": f"media/occlusion/{safe_a}",
            })

    return cards_out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_static = here
    out_data_dir = os.path.join(out_static, "data")
    os.makedirs(out_data_dir, exist_ok=True)

    anatomy_root = find_anatomy_root()
    multilab = os.path.join(
        anatomy_root,
        "Part 1 - Bones, Joints, Skull & Embryology (practical 5 Nov, test 6 Nov)",
        "Multi-lab - pins, structure lists & combined slides",
    )

    print("Parsing BONES & SKULL answer keys...")
    bones_ans = parse_docx_answers(
        os.path.join(multilab, "[Labs 01-05 PINS] BONES - PINS answers.docx"),
        is_skull=False,
    )
    skull_ans = parse_docx_answers(
        os.path.join(multilab, "[Labs 06-09 PINS] SKULL - PINS answers.docx"),
        is_skull=True,
    )

    print("Extracting & optimizing BONES Pin Deck (83 slides)...")
    bones_slides, bones_pins = process_pptx_deck(
        "BONES",
        os.path.join(multilab, "[Labs 01-05 PINS] BONES - PINS.pptx"),
        bones_ans,
        "bones",
        out_static,
    )

    print("Extracting & optimizing SKULL Pin Deck (20 slides)...")
    skull_slides, skull_pins = process_pptx_deck(
        "SKULL",
        os.path.join(multilab, "[Labs 06-09 PINS] SKULL - PINS.pptx"),
        skull_ans,
        "skull",
        out_static,
    )

    print("Extracting Gap-Filler Carpal, Tarsal & Joint Ligament visual occlusion cards...")
    occlusion_cards = extract_visual_gap_fillers(anatomy_root, out_static)

    all_slides = bones_slides + skull_slides
    all_pins = bones_pins + skull_pins

    # Enrich SYLLABUS_GAP_DRILLS with generated synonyms
    gap_drills = []
    for item in SYLLABUS_GAP_DRILLS:
        d = dict(item)
        d["synonyms"] = generate_synonyms(item["answer"], item["answer"], item.get("synonyms", []))
        gap_drills.append(d)

    # Enrich BONE_ID_ITEMS with synonyms & ensure clean structure
    bone_id_items = []
    for item in BONE_ID_ITEMS:
        d = dict(item)
        d["synonyms"] = generate_synonyms(item["answer"], item["answer"], item.get("synonyms", []))
        bone_id_items.append(d)

    dataset = {
        "meta": {
            "course": "JUMC Anatomy Test 1 — Pins & Osteology Masterclass",
            "reviewLabDate": "2026-11-03T08:00:00+01:00",
            "practicalExamDate": "2026-11-05T08:00:00+01:00",
            "theoryExamDate": "2026-11-06T07:45:00+01:00",
            "viewBox": {"w": VIEW_W, "h": VIEW_H},
            "totalSlides": len(all_slides),
            "totalPins": len(all_pins),
            "bonesPins": len(bones_pins),
            "skullPins": len(skull_pins),
            "gapDrillsCount": len(gap_drills),
            "occlusionCount": len(occlusion_cards),
            "boneIdCount": len(bone_id_items),
        },
        "slides": all_slides,
        "pins": all_pins,
        "gapDrills": gap_drills,
        "occlusionCards": occlusion_cards,
        "boneIdCategories": BONE_ID_CATEGORIES,
        "boneIdItems": bone_id_items,
    }

    out_json = os.path.join(out_data_dir, "dataset.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    cat_counts = {}
    for p in all_pins:
        cat_counts[p["category"]] = cat_counts.get(p["category"], 0) + 1

    print(f"Done! Wrote {out_json}")
    print(f"  Slides: {len(all_slides)} | Official Pins: {len(all_pins)} (categories: {cat_counts})")
    print(f"  Gap-filler Drills: {len(gap_drills)} | Visual Occlusion Cards: {len(occlusion_cards)}")


if __name__ == "__main__":
    main()
