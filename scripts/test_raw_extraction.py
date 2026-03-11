"""
Workflow D: Extract raw image objects directly from the PDF.

Key finding: The Persimmon logo for many signs is a PAGE-LEVEL overlay, not part
of the sign image itself. So the raw embedded image objects may already be clean.

This script:
1. Finds sign images in the PDF by matching to product codes
2. Extracts the RAW image object (which may not have the Persimmon logo)
3. Compares with the page-rendered version (which includes the overlay)
"""

import fitz
import os
import re
import json
import numpy as np
import cv2
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATH = os.path.join(PROJECT_ROOT, 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, 'shop', 'public', 'images', 'products')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'workflow_d')
BB_LOGO_SVG = os.path.join(PROJECT_ROOT, 'shop', 'public', 'assets', 'persimmon_full_logo.svg')

CODE_PATTERN = re.compile(r'(P(?:CF|A)[A-Z]*\d+\w*(?:/[A-Z0-9]+)*)')

# Test a range of products from different pages/types
TEST_PRODUCTS = [
    'PCF128',   # Page 10 - info sign (raw image confirmed clean)
    'PCF52',    # Page 10 - another info sign
    'PA535',    # Page 6 - waste sign (raw image has logo baked in)
    'PA521',    # Page 6 - another environmental sign
    'PA100',    # Page 41 - notice board
    'PA110',    # Page 42 - considerate sign
    'PCF384',   # Page 9 - PPE sign
    'PA126',    # Traffic sign
]

os.makedirs(OUTPUT_DIR, exist_ok=True)


def create_bb_logo_png(width, height):
    """Render BB logo SVG to PNG at given size."""
    doc = fitz.open(BB_LOGO_SVG)
    page = doc[0]
    svg_rect = page.rect
    scale = min(width / svg_rect.width, height / svg_rect.height)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    doc.close()
    return Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)


def find_product_on_page(page, product_code):
    """Find product code text position and the sign image above it."""
    page_dict = page.get_text('dict')
    blocks = page_dict['blocks']

    # Find all text spans containing the product code
    code_spans = []
    for block in blocks:
        if block['type'] != 0:
            continue
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                if product_code in span['text']:
                    code_spans.append(span)

    if not code_spans:
        return None

    # Find image blocks
    image_blocks = [b for b in blocks if b['type'] == 1]

    # For each code span, find the nearest image above it
    for span in code_spans:
        code_bbox = span['bbox']
        code_x = (code_bbox[0] + code_bbox[2]) / 2
        code_y = code_bbox[1]

        best_img = None
        best_dist = float('inf')

        for img_block in image_blocks:
            bbox = img_block['bbox']
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            if w < 40 or h < 40 or w > 580 or h > 900:
                continue

            img_x = (bbox[0] + bbox[2]) / 2
            img_bottom = bbox[3]

            y_gap = code_y - img_bottom
            if y_gap < -10 or y_gap > 150:
                continue
            x_diff = abs(img_x - code_x)
            if x_diff > 100:
                continue

            dist = max(0, y_gap) + x_diff * 0.5
            if dist < best_dist:
                best_dist = dist
                best_img = bbox

        if best_img:
            return best_img

    return None


def find_overlapping_raw_image(page, sign_bbox):
    """Find the raw image object that best matches the sign's bbox on the page."""
    img_list = page.get_images(full=True)
    sign_rect = fitz.Rect(sign_bbox)

    best_match = None
    best_overlap = 0

    seen = set()
    for img_info in img_list:
        xref = img_info[0]
        if xref in seen:
            continue
        seen.add(xref)

        try:
            for inst_rect in page.get_image_rects(xref):
                # Check overlap with sign bbox
                intersection = sign_rect & inst_rect
                if intersection.is_empty:
                    continue

                overlap_area = intersection.width * intersection.height
                sign_area = sign_rect.width * sign_rect.height

                overlap_pct = overlap_area / sign_area if sign_area > 0 else 0

                if overlap_pct > best_overlap:
                    best_overlap = overlap_pct
                    best_match = (xref, inst_rect, overlap_pct)
        except:
            continue

    return best_match


def extract_raw_image(pdf, xref, target_w=None, target_h=None):
    """Extract raw image from PDF by xref and optionally resize."""
    base_image = pdf.extract_image(xref)
    if not base_image:
        return None

    nparr = np.frombuffer(base_image['image'], np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    if target_w and target_h:
        img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

    return img


def has_persimmon_logo(img):
    """Check if an image contains the Persimmon logo (teal house icon)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Persimmon teal
    lower = np.array([75, 60, 30])
    upper = np.array([105, 255, 150])
    mask = cv2.inRange(hsv, lower, upper)
    teal_pct = np.count_nonzero(mask) / (img.shape[0] * img.shape[1]) * 100

    # Also check top region specifically (most logos are at top)
    h = img.shape[0]
    top_region = mask[0:int(h*0.2), :]
    top_teal_pct = np.count_nonzero(top_region) / (top_region.shape[0] * top_region.shape[1]) * 100 if top_region.size > 0 else 0

    # Bottom-right region
    w = img.shape[1]
    br_region = mask[int(h*0.7):, int(w*0.5):]
    br_teal_pct = np.count_nonzero(br_region) / (br_region.shape[0] * br_region.shape[1]) * 100 if br_region.size > 0 else 0

    return {
        'total_teal': teal_pct,
        'top_teal': top_teal_pct,
        'br_teal': br_teal_pct,
        'has_logo': top_teal_pct > 1.0 or br_teal_pct > 2.0
    }


def main():
    pdf = fitz.open(PDF_PATH)

    print("=" * 70)
    print("WORKFLOW D: Raw Image Extraction Test")
    print("=" * 70)
    print(f"PDF has {len(pdf)} pages\n")

    results = []

    for product_code in TEST_PRODUCTS:
        print(f"\n--- {product_code} ---")

        # Search all pages for this product
        found = False
        for page_idx in range(3, 60):
            if page_idx >= len(pdf):
                break

            page = pdf[page_idx]
            text = page.get_text()
            if product_code not in text:
                continue

            # Find the sign image bbox
            sign_bbox = find_product_on_page(page, product_code)
            if not sign_bbox:
                continue

            print(f"  Found on page {page_idx+1}, sign bbox: {sign_bbox}")

            # 1. Render the page clip (includes overlay - this is what original extractor does)
            clip = fitz.Rect(sign_bbox)
            mat = fitz.Matrix(3, 3)
            pix_render = page.get_pixmap(matrix=mat, clip=clip)
            render_path = os.path.join(OUTPUT_DIR, f'{product_code}_page_render.png')
            pix_render.save(render_path)

            render_img = cv2.imdecode(
                np.frombuffer(pix_render.tobytes("png"), np.uint8),
                cv2.IMREAD_COLOR
            )

            # 2. Find and extract the raw image object
            raw_match = find_overlapping_raw_image(page, sign_bbox)
            if raw_match:
                xref, inst_rect, overlap_pct = raw_match
                raw_info = pdf.extract_image(xref)
                raw_w, raw_h = raw_info['width'], raw_info['height']

                print(f"  Raw image: xref={xref}, native={raw_w}x{raw_h}, overlap={overlap_pct:.0%}")

                # Extract at native resolution
                raw_img_native = extract_raw_image(pdf, xref)
                native_path = os.path.join(OUTPUT_DIR, f'{product_code}_raw_native.png')
                cv2.imwrite(native_path, raw_img_native)

                # Extract upscaled to match render size
                raw_img_upscaled = extract_raw_image(pdf, xref, pix_render.width, pix_render.height)
                upscale_path = os.path.join(OUTPUT_DIR, f'{product_code}_raw_upscaled.png')
                cv2.imwrite(upscale_path, raw_img_upscaled)

                # 3. Check for Persimmon logo in both versions
                render_logo = has_persimmon_logo(render_img)
                raw_logo = has_persimmon_logo(raw_img_native)

                print(f"  Page render logo: {render_logo}")
                print(f"  Raw image logo:   {raw_logo}")

                is_clean = not raw_logo['has_logo']
                results.append({
                    'code': product_code,
                    'page': page_idx + 1,
                    'raw_size': f'{raw_w}x{raw_h}',
                    'render_has_logo': render_logo['has_logo'],
                    'raw_is_clean': is_clean,
                    'overlap': f'{overlap_pct:.0%}'
                })

                if is_clean:
                    print(f"  *** RAW IMAGE IS CLEAN - no Persimmon logo! ***")
                else:
                    print(f"  Raw image has Persimmon logo baked in")

            else:
                print(f"  No matching raw image found")
                results.append({
                    'code': product_code,
                    'page': page_idx + 1,
                    'raw_size': 'N/A',
                    'render_has_logo': True,
                    'raw_is_clean': False,
                    'overlap': 'N/A'
                })

            found = True
            break

        if not found:
            print(f"  Not found in PDF")

    pdf.close()

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"{'Code':<12} {'Page':<6} {'Raw Size':<12} {'Render Logo':<14} {'Raw Clean':<12}")
    print("-" * 60)
    for r in results:
        print(f"{r['code']:<12} {r['page']:<6} {r['raw_size']:<12} {str(r['render_has_logo']):<14} {str(r['raw_is_clean']):<12}")

    clean_count = sum(1 for r in results if r['raw_is_clean'])
    total = len(results)
    print(f"\n{clean_count}/{total} signs have CLEAN raw images (no Persimmon logo)")
    print(f"Results saved to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()
