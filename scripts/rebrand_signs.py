"""
Hybrid sign rebrand pipeline:
  1. Primary: Extract raw image from PDF (no Persimmon overlay) + add BB logo
  2. Fallback: Image-process the existing PNG (template match + replace)
  3. Pass-through: Signs with no Persimmon logo are copied unchanged

Usage:
  python scripts/rebrand_signs.py                    # process all
  python scripts/rebrand_signs.py --batch 20          # first 20 signs
  python scripts/rebrand_signs.py --codes PCF128 PA100  # specific codes
  python scripts/rebrand_signs.py --preview           # save to preview dir instead of overwriting
"""

import fitz
import os
import re
import json
import sys
import argparse
import numpy as np
import cv2
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATH = os.path.join(PROJECT_ROOT, 'BROCHURE & PRICELIST',
                        'Onesign Signs_Site Signage Catalogue_January2026.pdf')
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, 'shop', 'public', 'images', 'products')
PREVIEW_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'rebrand_preview')
BB_LOGO_SVG = os.path.join(PROJECT_ROOT, 'shop', 'public', 'assets', 'balfour_icon.svg')
MAPPING_PATH = os.path.join(SCRIPT_DIR, 'image_mapping.json')

CODE_PATTERN = re.compile(r'(P(?:CF|A)[A-Z]*\d+\w*(?:/[A-Z0-9]+)*)')
PRODUCT_PAGES = range(3, 60)

# --- BB Logo rendering ---

_bb_logo_cache = {}

def get_bb_logo(width, height):
    """Render BB logo SVG to RGBA PIL Image, cached."""
    key = (width, height)
    if key in _bb_logo_cache:
        return _bb_logo_cache[key]
    doc = fitz.open(BB_LOGO_SVG)
    page = doc[0]
    svg_rect = page.rect
    scale = min(width / svg_rect.width, height / svg_rect.height)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    doc.close()
    img = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
    _bb_logo_cache[key] = img
    return img


# --- Persimmon logo detection ---

def build_persimmon_template():
    """Create a tight template of just the Persimmon house icon from a known image."""
    # Use PCF128 which has a clear top-center Persimmon logo
    ref_path = os.path.join(PRODUCTS_DIR, 'PCF128.png')
    if not os.path.exists(ref_path):
        ref_path = os.path.join(PRODUCTS_DIR, 'PA44.png')
    if not os.path.exists(ref_path):
        return None, None

    img = cv2.imread(ref_path)
    h, w = img.shape[:2]
    # Crop the logo region: top ~15%, center-right area
    top_strip = img[0:int(h * 0.17), :]

    # Find the teal house icon within the strip
    hsv = cv2.cvtColor(top_strip, cv2.COLOR_BGR2HSV)
    lower = np.array([75, 50, 25])
    upper = np.array([110, 255, 160])
    mask = cv2.inRange(hsv, lower, upper)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        # Fallback: use the full top strip as template
        return top_strip, 'full_strip'

    # Get the house icon contour
    largest = max(contours, key=cv2.contourArea)
    x, y, cw, ch = cv2.boundingRect(largest)

    # Expand to include "Persimmon" text to the right
    icon_template = top_strip[max(0, y-2):y+ch+2, max(0, x-2):]
    return icon_template, 'icon_plus_text'


def detect_persimmon_region(image, template):
    """Multi-scale template match to find Persimmon logo region in an image."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    tpl_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)
    h_img, w_img = gray.shape
    th, tw = tpl_gray.shape

    best = None
    best_val = 0

    for scale in [0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.8]:
        nw, nh = int(tw * scale), int(th * scale)
        if nw >= w_img or nh >= h_img or nw < 15 or nh < 8:
            continue
        resized = cv2.resize(tpl_gray, (nw, nh))
        result = cv2.matchTemplate(gray, resized, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)
        if max_val > best_val:
            best_val = max_val
            best = (max_loc[0], max_loc[1], nw, nh)

    if best_val < 0.55:
        return None, best_val

    # Expand region to cover the full logo width (icon is only part of it)
    x, y, rw, rh = best
    # Expand left to catch the house icon, right to end of "Persimmon" text
    expanded_x = max(0, x - int(rw * 0.15))
    expanded_w = min(w_img - expanded_x, int(rw * 1.15))

    return (expanded_x, y, expanded_w, rh), best_val


def detect_persimmon_anywhere(image):
    """Detect Persimmon logo by two-pass color detection.

    Pass 1: Narrow teal range finds the distinctive house icon (avoids false positives
            from green sign content sections).
    Pass 2: Broad green range scans only the icon's Y-band to find the full
            "Persimmon" text extent, building a complete bounding box.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h_img, w_img = image.shape[:2]

    # Pass 1: Narrow teal range — finds just the house icon
    narrow_lower = np.array([75, 50, 25])
    narrow_upper = np.array([110, 255, 160])
    narrow_mask = cv2.inRange(hsv, narrow_lower, narrow_upper)

    contours, _ = cv2.findContours(narrow_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, 'none'

    # Find small teal clusters (house icon is compact, not a big sign section)
    candidates = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 30:
            continue
        x, y, cw, ch = cv2.boundingRect(c)
        # Skip anything spanning >60% of image width (that's sign content, not a logo)
        if cw > w_img * 0.6:
            continue
        candidates.append((x, y, cw, ch, area))

    if not candidates:
        return None, 'none'

    # Check for Persimmon logo in top area or bottom-right
    for cx, cy, cw, ch, area in sorted(candidates, key=lambda c: -c[4]):
        center_y = cy + ch / 2
        center_x = cx + cw / 2

        pos_type = None
        if center_y < h_img * 0.20:
            pos_type = 'top'
        elif center_y > h_img * 0.65 and center_x > w_img * 0.4:
            pos_type = 'bottom_right'

        if pos_type is None:
            continue

        # Pass 2: Broad green range in the icon's Y-band to find full logo extent
        broad_lower = np.array([60, 30, 20])
        broad_upper = np.array([120, 255, 200])
        broad_mask = cv2.inRange(hsv, broad_lower, broad_upper)

        band_top = max(0, cy - 5)
        band_bottom = min(h_img, cy + ch + 10)
        band_mask = broad_mask[band_top:band_bottom, :]
        band_contours, _ = cv2.findContours(band_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if band_contours:
            all_pts = np.vstack(band_contours)
            bx, by, bw, bh = cv2.boundingRect(all_pts)
            rx = max(0, bx - 5)
            ry = max(0, band_top + by - 5)
            region = (rx, ry,
                      min(w_img - rx, bw + 10),
                      min(h_img - ry, bh + 10))
            return region, pos_type
        else:
            region = (max(0, cx - 3), max(0, cy - 3),
                      min(w_img - cx + 3, cw * 6), ch + 6)
            return region, pos_type

    return None, 'none'


# --- Raw PDF image extraction ---

def build_pdf_image_index(pdf):
    """Build an index: for each product page, map sign bboxes to raw image xrefs."""
    index = {}  # page_idx -> list of (sign_bbox, xref, raw_size)

    for page_idx in PRODUCT_PAGES:
        if page_idx >= len(pdf):
            break
        page = pdf[page_idx]
        page_dict = page.get_text('dict')
        blocks = page_dict['blocks']

        text_blocks = [b for b in blocks if b['type'] == 0]
        image_blocks = [b for b in blocks if b['type'] == 1]

        # Extract code positions
        code_positions = []
        for block in text_blocks:
            for line in block.get('lines', []):
                for span in line.get('spans', []):
                    codes = CODE_PATTERN.findall(span['text'])
                    for code in codes:
                        bbox = span['bbox']
                        code_positions.append((code, (bbox[0]+bbox[2])/2, bbox[1]))

        # Build image xref lookup by page placement
        img_list = page.get_images(full=True)
        seen = set()
        img_placements = []  # (xref, rect, native_w, native_h)
        for info in img_list:
            xref = info[0]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                base = pdf.extract_image(xref)
                if not base:
                    continue
                for rect in page.get_image_rects(xref):
                    img_placements.append((xref, rect, base['width'], base['height']))
            except:
                continue

        index[page_idx] = {
            'code_positions': code_positions,
            'image_blocks': image_blocks,
            'img_placements': img_placements,
        }

    return index


def find_sign_in_pdf(pdf, index, product_code):
    """Find a product sign in the PDF and return its raw image + metadata."""
    for page_idx, data in index.items():
        # Check if product code is on this page
        matching_codes = [(c, x, y) for c, x, y in data['code_positions']
                          if c.startswith(product_code) or product_code in c]
        if not matching_codes:
            continue

        page = pdf[page_idx]
        code, code_x, code_y = matching_codes[0]

        # Find the sign image above this code
        best_img_block = None
        best_dist = float('inf')

        for img_block in data['image_blocks']:
            bbox = img_block['bbox']
            w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
            if w < 40 or h < 40 or w > 580 or h > 900:
                continue
            img_x = (bbox[0]+bbox[2])/2
            img_bottom = bbox[3]
            y_gap = code_y - img_bottom
            x_diff = abs(img_x - code_x)
            if y_gap < -10 or y_gap > 150 or x_diff > 100:
                continue
            dist = max(0, y_gap) + x_diff * 0.5
            if dist < best_dist:
                best_dist = dist
                best_img_block = bbox

        if not best_img_block:
            continue

        sign_rect = fitz.Rect(best_img_block)

        # Find the best-fitting raw image (prefer size match over largest overlap)
        best_raw = None
        best_score = -1

        for xref, rect, nw, nh in data['img_placements']:
            intersection = sign_rect & rect
            if intersection.is_empty:
                continue

            overlap = intersection.width * intersection.height
            sign_area = sign_rect.width * sign_rect.height
            raw_area = rect.width * rect.height

            if sign_area <= 0:
                continue

            # Skip images that are vastly larger than the sign (background images)
            if raw_area > sign_area * 4:
                continue

            # Score: prefer images whose size closely matches the sign
            size_ratio = min(raw_area, sign_area) / max(raw_area, sign_area)
            overlap_ratio = overlap / sign_area

            # Strongly prefer images that are close in size to the sign
            score = overlap_ratio * 0.3 + size_ratio * 0.7

            if score > best_score:
                best_score = score
                best_raw = (xref, rect, nw, nh)

        if not best_raw:
            continue

        xref, raw_rect, nw, nh = best_raw

        # Extract raw image
        base = pdf.extract_image(xref)
        nparr = np.frombuffer(base['image'], np.uint8)
        raw_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        return {
            'page': page_idx,
            'sign_bbox': best_img_block,
            'raw_img': raw_img,
            'raw_size': (nw, nh),
            'xref': xref,
        }

    return None


# --- Logo compositing ---

def add_bb_logo_to_image(image, position='top_center', region=None):
    """Add the Balfour Beatty logo to an image at the specified position.

    position: 'top_center' or 'bottom_right'
    region: (x, y, w, h) - if provided, uses y position but centers on full image width
            for top logos, or places in region for bottom-right logos
    """
    h, w = image.shape[:2]
    result = image.copy()

    if region:
        rx, ry, rw, rh = region
        center_y = ry + rh / 2

        if center_y < h * 0.4:
            # Top-positioned logo: center horizontally on the FULL image width
            # Size by height to match the detected region; icon aspect ratio handles width
            logo_h = rh
            logo_w = int(logo_h * 2)  # generous, aspect ratio will constrain
            bb = get_bb_logo(logo_w, logo_h)
            bb_np = np.array(bb)
            lh, lw = bb_np.shape[:2]
            ox = (w - lw) // 2
            oy = ry + (rh - lh) // 2
        else:
            # Bottom-right logo: keep region-based positioning
            logo_h = rh
            logo_w = int(logo_h * 2)
            bb = get_bb_logo(logo_w, logo_h)
            bb_np = np.array(bb)
            lh, lw = bb_np.shape[:2]
            ox = rx + (rw - lw) // 2
            oy = ry + (rh - lh) // 2
    elif position == 'top_center':
        # Size by height to match original Persimmon header area
        logo_h = int(h * 0.08)
        logo_w = int(logo_h * 2)  # generous, aspect ratio will constrain
        bb = get_bb_logo(logo_w, logo_h)
        bb_np = np.array(bb)
        lh, lw = bb_np.shape[:2]
        ox = (w - lw) // 2
        oy = max(2, int(h * 0.015))
    elif position == 'bottom_right':
        logo_h = int(h * 0.06)
        logo_w = int(logo_h * 2)
        bb = get_bb_logo(logo_w, logo_h)
        bb_np = np.array(bb)
        lh, lw = bb_np.shape[:2]
        ox = w - lw - max(4, int(w * 0.03))
        oy = h - lh - max(4, int(h * 0.03))
    else:
        return result

    # Alpha composite
    if ox < 0 or oy < 0 or ox + lw > w or oy + lh > h:
        return result

    alpha = bb_np[:, :, 3] / 255.0
    logo_bgr = cv2.cvtColor(bb_np[:, :, :3], cv2.COLOR_RGB2BGR)

    for c in range(3):
        result[oy:oy+lh, ox:ox+lw, c] = (
            alpha * logo_bgr[:, :, c] +
            (1 - alpha) * result[oy:oy+lh, ox:ox+lw, c]
        ).astype(np.uint8)

    return result


# --- Main pipeline ---

def process_sign(product_code, pdf, pdf_index, template, output_dir):
    """Process a single sign: extract clean image + add BB logo."""
    existing_path = os.path.join(PRODUCTS_DIR, f'{product_code.replace("/", "_")}.png')
    if not os.path.exists(existing_path):
        return 'missing', f'No existing image at {existing_path}'

    existing_img = cv2.imread(existing_path)
    if existing_img is None:
        return 'error', 'Could not read existing image'

    h_img, w_img = existing_img.shape[:2]
    safe_name = product_code.replace('/', '_')

    # Step 1: Try raw PDF extraction (Workflow D)
    pdf_result = find_sign_in_pdf(pdf, pdf_index, product_code)

    if pdf_result:
        raw_img = pdf_result['raw_img']

        # Check if raw image is clean (no Persimmon logo)
        # Use template matching on the upscaled raw image — much more reliable
        # than teal color detection alone
        upscaled = cv2.resize(raw_img, (w_img, h_img), interpolation=cv2.INTER_LANCZOS4)

        raw_is_clean = True
        if template is not None:
            # Check all 4 rotations — some signs are rotated in the PDF
            for rot_code in [None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180]:
                check_img = cv2.rotate(upscaled, rot_code) if rot_code is not None else upscaled
                raw_region, raw_conf = detect_persimmon_region(check_img, template)
                if raw_region is not None and raw_conf >= 0.55:
                    raw_is_clean = False
                    break
        if raw_is_clean:
            # Double-check with color-based detection on all rotations
            for rot_code in [None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180]:
                check_img = cv2.rotate(upscaled, rot_code) if rot_code is not None else upscaled
                raw_color_region, raw_pos = detect_persimmon_anywhere(check_img)
                if raw_color_region is not None:
                    raw_is_clean = False
                    break

        if raw_is_clean:
            # Raw image has no Persimmon logo — use it directly
            out_path = os.path.join(output_dir, f'{safe_name}.png')
            cv2.imwrite(out_path, upscaled)
            return 'raw_clean', 'Raw extraction (clean, no Persimmon)'

    # Step 2: Fallback — image processing on existing PNG (Workflow B)
    # Detect Persimmon logo by template matching
    region = None
    conf = 0
    if template is not None:
        region, conf = detect_persimmon_region(existing_img, template)

    if region is None or conf < 0.55:
        # Try color-based detection
        region, pos_type = detect_persimmon_anywhere(existing_img)

    if region is None:
        # No Persimmon logo found — copy unchanged
        out_path = os.path.join(output_dir, f'{safe_name}.png')
        cv2.imwrite(out_path, existing_img)
        return 'no_logo', 'No Persimmon logo detected — copied unchanged'

    # Mask the Persimmon logo with background color
    x, y, rw, rh = region
    result = existing_img.copy()

    # Expand mask region by a few pixels to catch any edge remnants
    pad = 4
    mx = max(0, x - pad)
    my = max(0, y - pad)
    mrw = min(w_img - mx, rw + pad * 2)
    mrh = min(h_img - my, rh + pad * 2)

    # Sample background from edges around the expanded region
    border = 5
    samples = []
    if my > border:
        samples.extend(existing_img[my-border:my, mx:mx+mrw].reshape(-1, 3).tolist())
    if my+mrh+border < h_img:
        samples.extend(existing_img[my+mrh:my+mrh+border, mx:mx+mrw].reshape(-1, 3).tolist())
    if mx > border:
        samples.extend(existing_img[my:my+mrh, mx-border:mx].reshape(-1, 3).tolist())
    if mx+mrw+border < w_img:
        samples.extend(existing_img[my:my+mrh, mx+mrw:mx+mrw+border].reshape(-1, 3).tolist())

    bg_color = np.median(samples, axis=0).astype(np.uint8) if samples else np.array([255, 255, 255], dtype=np.uint8)

    # Clean fill over the expanded region
    result[my:my+mrh, mx:mx+mrw] = bg_color

    out_path = os.path.join(output_dir, f'{safe_name}.png')
    cv2.imwrite(out_path, result)
    return 'img_processed', f'Persimmon removed (conf={conf:.2f})'


def main():
    parser = argparse.ArgumentParser(description='Rebrand sign images from Persimmon to Balfour Beatty')
    parser.add_argument('--batch', type=int, help='Process N signs (from offset)')
    parser.add_argument('--offset', type=int, default=0, help='Start from sign index N (0-based)')
    parser.add_argument('--codes', nargs='+', help='Process specific product codes')
    parser.add_argument('--preview', action='store_true', help='Save to preview dir instead of overwriting')
    args = parser.parse_args()

    output_dir = PREVIEW_DIR if args.preview else PRODUCTS_DIR
    os.makedirs(output_dir, exist_ok=True)

    # Get list of product codes to process
    if args.codes:
        codes = args.codes
    else:
        # Get all unique base codes from existing images
        codes = []
        for f in sorted(os.listdir(PRODUCTS_DIR)):
            if f.endswith('.png'):
                code = f.replace('.png', '').replace('_', '/')
                codes.append(code)

    if args.offset:
        codes = codes[args.offset:]
    if args.batch:
        codes = codes[:args.batch]

    print(f"{'='*70}")
    print(f"Balfour Beatty Sign Rebrand Pipeline")
    print(f"{'='*70}")
    print(f"Signs to process: {len(codes)}")
    print(f"Output: {output_dir}")

    # Build template for Persimmon logo detection
    print("\nBuilding Persimmon logo template...")
    template, tpl_type = build_persimmon_template()
    print(f"  Template type: {tpl_type}")

    # Open PDF and build index
    print("Indexing PDF...")
    pdf = fitz.open(PDF_PATH)
    pdf_index = build_pdf_image_index(pdf)
    print(f"  Indexed {len(pdf_index)} pages")

    # Process each sign
    stats = {'raw_clean': 0, 'img_processed': 0, 'no_logo': 0, 'missing': 0, 'error': 0}

    for i, code in enumerate(codes):
        safe = code.replace('/', '_')
        status, msg = process_sign(code, pdf, pdf_index, template, output_dir)
        stats[status] += 1

        symbol = {'raw_clean': 'D', 'img_processed': 'B', 'no_logo': '-', 'missing': '?', 'error': '!'}
        print(f"  [{symbol.get(status, '?')}] {safe:<20} {msg}")

    pdf.close()

    # Summary
    print(f"\n{'='*70}")
    print(f"RESULTS")
    print(f"{'='*70}")
    print(f"  [D] Raw PDF extraction (clean):  {stats['raw_clean']}")
    print(f"  [B] Image processing (fallback): {stats['img_processed']}")
    print(f"  [-] No logo (unchanged):         {stats['no_logo']}")
    print(f"  [?] Missing source image:        {stats['missing']}")
    print(f"  [!] Errors:                      {stats['error']}")
    print(f"  Total processed:                 {sum(stats.values())}")
    print(f"\nOutput saved to: {output_dir}")


if __name__ == '__main__':
    main()
