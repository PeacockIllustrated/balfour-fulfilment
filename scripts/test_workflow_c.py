"""
Workflow C: PDF-aware extraction + compositing.

Instead of processing existing PNGs, this goes back to the source PDF:
1. Identifies the Persimmon logo as a separate image object in the PDF
2. Redacts/removes the logo from the page before rendering
3. Composites the Balfour Beatty logo onto the clean render

This leverages PyMuPDF's ability to manipulate PDF content at the object level.
"""

import fitz
import os
import json
import numpy as np
from PIL import Image
import cv2
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATH = os.path.join(PROJECT_ROOT, 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, 'shop', 'public', 'images', 'products')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'workflow_c')
BB_LOGO_SVG = os.path.join(PROJECT_ROOT, 'shop', 'public', 'assets', 'persimmon_full_logo.svg')

# Product code pattern
CODE_PATTERN = re.compile(r'(P(?:CF|A)[A-Z]*\d+\w*(?:/[A-Z0-9]+)*)')

TEST_PRODUCTS = ['PA100', 'PA535', 'PCF128']

# Page range for products
PRODUCT_PAGES = range(3, 60)


def create_bb_logo_png(width, height):
    """Create a Balfour Beatty logo PNG at the given size using PyMuPDF SVG rendering."""
    doc = fitz.open(BB_LOGO_SVG)
    page = doc[0]
    svg_rect = page.rect
    scale_x = width / svg_rect.width
    scale_y = height / svg_rect.height
    scale = min(scale_x, scale_y)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    doc.close()
    img = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
    return img


def find_persimmon_logos_on_page(page):
    """Find all Persimmon logo instances on a page by analyzing image objects.

    Returns list of (bbox, image_xref) for each Persimmon logo found.
    """
    logos = []
    img_list = page.get_images(full=True)

    # Get all image bboxes
    image_bboxes = []
    page_dict = page.get_text('dict')
    for block in page_dict['blocks']:
        if block['type'] == 1:  # image block
            image_bboxes.append(block['bbox'])

    # Analyze each image on the page
    seen_xrefs = set()
    for img_info in img_list:
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)

        try:
            base_image = page.parent.extract_image(xref)
            if not base_image:
                continue

            img_bytes = base_image['image']

            # Convert to numpy array for analysis
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue

            h, w = img.shape[:2]

            # The Persimmon house icon is typically very small (< 50px)
            # and is a distinctive teal/green shape
            if w > 80 or h > 80:
                continue  # Too large to be just the logo icon

            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

            # Check for Persimmon teal: H ~80-100, S ~80+, V ~40-140
            lower_teal = np.array([75, 60, 30])
            upper_teal = np.array([105, 255, 150])
            teal_mask = cv2.inRange(hsv, lower_teal, upper_teal)
            teal_ratio = np.count_nonzero(teal_mask) / (h * w)

            # Persimmon house icon typically has 20-80% teal coverage
            if teal_ratio > 0.15:
                for inst in page.get_image_rects(xref):
                    logos.append({
                        'bbox': inst,
                        'xref': xref,
                        'size': (w, h),
                        'teal_ratio': teal_ratio,
                        'type': 'icon'
                    })

        except Exception as e:
            continue

    return logos


def find_persimmon_text_on_page(page):
    """Find 'Persimmon' text instances on a page."""
    text_instances = []
    page_dict = page.get_text('dict')

    for block in page_dict['blocks']:
        if block['type'] != 0:
            continue
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                if 'persimmon' in span['text'].lower():
                    text_instances.append({
                        'bbox': fitz.Rect(span['bbox']),
                        'text': span['text'],
                        'size': span['size'],
                        'color': span.get('color', 0)
                    })

    return text_instances


def find_product_image_bbox(page, product_code):
    """Find the bounding box of a product sign image on a page, given its code."""
    page_dict = page.get_text('dict')
    blocks = page_dict['blocks']

    image_blocks = []
    text_blocks = []
    for block in blocks:
        if block['type'] == 1:
            image_blocks.append(block)
        elif block['type'] == 0:
            text_blocks.append(block)

    # Find the text span containing the product code
    code_positions = []
    for block in text_blocks:
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                if product_code in span['text']:
                    bbox = span['bbox']
                    code_positions.append({
                        'x_center': (bbox[0] + bbox[2]) / 2,
                        'y_top': bbox[1],
                        'y_bottom': bbox[3],
                        'bbox': bbox
                    })

    if not code_positions:
        return None

    # For each code, find the nearest image ABOVE it
    for code_pos in code_positions:
        best_img = None
        best_dist = float('inf')

        for img_block in image_blocks:
            bbox = img_block['bbox']
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]

            # Skip tiny or huge images
            if w < 40 or h < 40 or w > 580 or h > 900:
                continue

            img_x_center = (bbox[0] + bbox[2]) / 2
            img_bottom = bbox[3]

            # Image should be above the code text
            y_gap = code_pos['y_top'] - img_bottom
            if y_gap < -10 or y_gap > 150:
                continue

            x_diff = abs(img_x_center - code_pos['x_center'])
            if x_diff > 100:
                continue

            dist = max(0, y_gap) + x_diff * 0.5
            if dist < best_dist:
                best_dist = dist
                best_img = bbox

        if best_img:
            return best_img

    return None


def extract_clean_sign(page, sign_bbox, zoom=3):
    """Extract a sign from the page with Persimmon logos redacted.

    Steps:
    1. Find Persimmon logos (icon + text) that overlap with the sign area
    2. Redact them from the page
    3. Re-render the sign region
    """
    sign_rect = fitz.Rect(sign_bbox)

    # Find Persimmon logos on this page
    logos = find_persimmon_logos_on_page(page)
    texts = find_persimmon_text_on_page(page)

    redact_regions = []

    # Check which logos overlap with our sign
    for logo in logos:
        logo_rect = fitz.Rect(logo['bbox'])
        if sign_rect.intersects(logo_rect):
            redact_regions.append({
                'rect': logo_rect,
                'type': 'icon',
                'info': logo
            })
            print(f"    Found Persimmon icon at {logo_rect}, teal={logo['teal_ratio']:.2f}")

    # Check which text instances overlap
    for text in texts:
        text_rect = text['bbox']
        if sign_rect.intersects(text_rect):
            redact_regions.append({
                'rect': text_rect,
                'type': 'text',
                'info': text
            })
            print(f"    Found '{text['text']}' text at {text_rect}")

    if not redact_regions:
        print("    No Persimmon branding found in sign area")
        # Just extract normally
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, clip=sign_rect)
        return pix, []

    # Redact the Persimmon logo regions
    # First, sample the background color around each redaction
    for region in redact_regions:
        rect = region['rect']
        # Add redaction annotation with white fill (we'll fix the color after)
        page.add_redact_annot(rect, fill=(1, 1, 1))  # white fill

    # Apply redactions
    page.apply_redactions()

    # Render the cleaned sign
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=sign_rect)

    return pix, redact_regions


def composite_bb_logo(image_pil, redact_regions, sign_bbox, zoom=3):
    """Composite the Balfour Beatty logo where the Persimmon logo was."""
    if not redact_regions:
        return image_pil

    # Calculate the combined redaction area (icon + text together)
    all_rects = [r['rect'] for r in redact_regions]

    # Combine into one bounding box
    min_x = min(r.x0 for r in all_rects)
    min_y = min(r.y0 for r in all_rects)
    max_x = max(r.x1 for r in all_rects)
    max_y = max(r.y1 for r in all_rects)

    # Convert PDF coordinates to pixel coordinates relative to the sign
    sign_rect = fitz.Rect(sign_bbox)
    px_x = int((min_x - sign_rect.x0) * zoom)
    px_y = int((min_y - sign_rect.y0) * zoom)
    px_w = int((max_x - min_x) * zoom)
    px_h = int((max_y - min_y) * zoom)

    print(f"    Logo composite region: ({px_x}, {px_y}) {px_w}x{px_h}")

    # Create BB logo at the right size
    try:
        bb_logo = create_bb_logo_png(px_w, px_h)

        # Convert main image to RGBA if needed
        if image_pil.mode != 'RGBA':
            image_pil = image_pil.convert('RGBA')

        # Center the logo in the region
        lw, lh = bb_logo.size
        offset_x = px_x + (px_w - lw) // 2
        offset_y = px_y + (px_h - lh) // 2

        # Paste with alpha compositing
        if offset_x >= 0 and offset_y >= 0:
            image_pil.paste(bb_logo, (offset_x, offset_y), bb_logo)
            print(f"    BB logo pasted at ({offset_x}, {offset_y}), size {lw}x{lh}")

        return image_pil.convert('RGB')

    except Exception as e:
        print(f"    WARNING: Could not composite BB logo: {e}")
        return image_pil


def process_product(pdf, product_code, output_dir, zoom=3):
    """Process a single product: find it in the PDF, extract cleanly, composite BB logo."""
    print(f"\n  Processing: {product_code}")

    # Search all product pages for this code
    for page_idx in PRODUCT_PAGES:
        if page_idx >= len(pdf):
            break

        page = pdf[page_idx]

        # Check if this page has our product code
        page_text = page.get_text()
        if product_code not in page_text:
            continue

        print(f"    Found on page {page_idx + 1}")

        # Find the sign image bounding box
        sign_bbox = find_product_image_bbox(page, product_code)
        if not sign_bbox:
            print(f"    Could not locate sign image on page")
            continue

        print(f"    Sign bbox: {sign_bbox}")

        # We need to work on a copy of the page to avoid modifying the PDF
        # Re-open PDF for each extraction to avoid redaction side effects
        pdf_copy = fitz.open(PDF_PATH)
        page_copy = pdf_copy[page_idx]

        # Extract with Persimmon logos redacted
        pix, redact_regions = extract_clean_sign(page_copy, sign_bbox, zoom)

        # Convert pixmap to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Save the clean (redacted) version
        clean_path = os.path.join(output_dir, f'{product_code}_clean.png')
        img.save(clean_path)
        print(f"    Saved clean version: {clean_path}")

        # Composite the BB logo
        result = composite_bb_logo(img, redact_regions, sign_bbox, zoom)

        # Save final result
        final_path = os.path.join(output_dir, f'{product_code}.png')
        result.save(final_path)
        print(f"    Saved final: {final_path}")

        # Also save a debug image showing what was detected
        debug_img = cv2.imread(os.path.join(PRODUCTS_DIR, f'{product_code}.png'))
        if debug_img is not None:
            debug_path = os.path.join(output_dir, f'{product_code}_original.png')
            cv2.imwrite(debug_path, debug_img)

        pdf_copy.close()
        return True

    print(f"    Product not found in PDF")
    return False


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("WORKFLOW C: PDF-Aware Extraction Test")
    print("=" * 60)

    pdf = fitz.open(PDF_PATH)
    print(f"PDF has {len(pdf)} pages")

    # First, let's analyze what image objects exist on a few pages
    print("\n--- Analyzing PDF image objects ---")
    for page_idx in [3, 4, 5]:
        page = pdf[page_idx]
        logos = find_persimmon_logos_on_page(page)
        texts = find_persimmon_text_on_page(page)
        print(f"  Page {page_idx + 1}: {len(logos)} logo icons, {len(texts)} 'Persimmon' text instances")
        for logo in logos:
            print(f"    Icon: {logo['bbox']}, size={logo['size']}, teal={logo['teal_ratio']:.2f}")
        for text in texts:
            print(f"    Text: '{text['text']}' at {text['bbox']}")

    # Process each test product
    for product_code in TEST_PRODUCTS:
        process_product(pdf, product_code, OUTPUT_DIR)

    pdf.close()

    print("\n" + "=" * 60)
    print(f"Results saved to: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == '__main__':
    main()
