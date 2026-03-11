"""
Extract product sign images from the PDF brochure (v2 - improved matching).

Improvements over v1:
- Broader regex to handle codes like PCFR70/6011, PCFMK01/10, PA318/S/10
- Per-span text positioning for wide text blocks with multiple codes
- Wider spatial matching thresholds
- Only extracts MISSING images (preserves existing ones)
"""

import fitz
import os
import re
import json

PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'shop', 'public', 'images', 'products')
CATALOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'shop', 'data', 'catalog.json')

# Broad code pattern - matches all product codes including complex suffixes
CODE_PATTERN = re.compile(r'(P(?:CF|A)[A-Z]*\d+\w*(?:/[A-Z0-9]+)*)')

# Pages to process (0-indexed): all product pages
PRODUCT_PAGES = range(3, 60)

# Minimum image dimensions to consider (skip tiny decorative elements)
MIN_WIDTH = 40
MIN_HEIGHT = 40
# Maximum image dimensions to skip (full-width background strips, page borders)
MAX_WIDTH = 580
MAX_HEIGHT = 900


def load_catalog_base_codes():
    """Load all base product codes from the catalog."""
    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    base_codes = {}  # base_code -> product info
    for cat in catalog['categories']:
        for product in cat['products']:
            base_codes[product['baseCode']] = {
                'name': product['name'],
                'image': product.get('image', ''),
                'variant_codes': [v['code'] for v in product['variants']]
            }
    return base_codes


def get_base_code_for_variant(variant_code, catalog_bases):
    """Find which base code a variant belongs to."""
    for base, info in catalog_bases.items():
        if variant_code in info['variant_codes'] or variant_code == base:
            return base
    return None


def get_existing_images():
    """Get set of base codes that already have images."""
    existing = set()
    if os.path.exists(OUTPUT_DIR):
        for f_name in os.listdir(OUTPUT_DIR):
            if f_name.endswith('.png'):
                existing.add(f_name.replace('.png', ''))
    return existing


def extract_code_positions_from_text_blocks(text_blocks):
    """Extract product codes with their x,y positions from text blocks.

    Uses per-span positioning for accuracy with wide text blocks
    that contain multiple product codes across columns.
    """
    code_positions = []  # list of (code, x_center, y_top, y_bottom)

    for block in text_blocks:
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                text = span['text'].strip()
                bbox = span['bbox']

                codes = CODE_PATTERN.findall(text)
                if codes:
                    x_center = (bbox[0] + bbox[2]) / 2
                    y_top = bbox[1]
                    y_bottom = bbox[3]
                    for code in codes:
                        code_positions.append((code, x_center, y_top, y_bottom))

    return code_positions


def find_best_code_for_image(image_bbox, code_positions, y_threshold=150, x_threshold=100):
    """Find the nearest product code below (or near) an image.

    Searches code_positions for the best spatial match.
    """
    img_x_center = (image_bbox[0] + image_bbox[2]) / 2
    img_bottom = image_bbox[3]
    img_top = image_bbox[1]

    best_code = None
    best_distance = float('inf')

    for code, code_x, code_y_top, code_y_bottom in code_positions:
        # Code should be below the image (with small tolerance)
        y_gap = code_y_top - img_bottom

        if y_gap < -10:  # Code is significantly above image bottom, skip
            continue

        if y_gap > y_threshold:  # Too far below
            continue

        # Horizontal alignment
        x_diff = abs(img_x_center - code_x)
        if x_diff > x_threshold:
            continue

        # Score: prefer close vertically, then horizontally
        distance = max(0, y_gap) + x_diff * 0.5
        if distance < best_distance:
            best_distance = distance
            best_code = code

    return best_code


def extract_images():
    """Main extraction function - only extracts missing images."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    catalog_bases = load_catalog_base_codes()
    existing = get_existing_images()

    # Build set of missing base codes
    missing_bases = set()
    for base in catalog_bases:
        safe = base.replace('/', '_')
        if safe not in existing:
            missing_bases.add(base)

    print(f"Catalog has {len(catalog_bases)} base products")
    print(f"Already have images for {len(existing)} products")
    print(f"Missing images for {len(missing_bases)} products")

    # Build a lookup: any variant code -> base code (only for missing ones)
    variant_to_base = {}
    for base in missing_bases:
        info = catalog_bases[base]
        variant_to_base[base] = base
        for vc in info['variant_codes']:
            variant_to_base[vc] = base

    pdf = fitz.open(PDF_PATH)
    print(f"PDF has {len(pdf)} pages")

    extracted_count = 0
    skipped_count = 0
    no_code_count = 0
    already_have_count = 0

    for page_idx in PRODUCT_PAGES:
        if page_idx >= len(pdf):
            break

        page = pdf[page_idx]
        page_dict = page.get_text('dict')
        blocks = page_dict['blocks']

        # Separate image and text blocks
        image_blocks = []
        text_blocks = []

        for block in blocks:
            if block['type'] == 1:  # image
                image_blocks.append(block)
            elif block['type'] == 0:  # text
                text_blocks.append(block)

        if not image_blocks:
            continue

        # Extract code positions from text (per-span for accuracy)
        code_positions = extract_code_positions_from_text_blocks(text_blocks)

        if not code_positions:
            continue

        for img_block in image_blocks:
            bbox = img_block['bbox']
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]

            # Skip images that are too small or too large
            if width < MIN_WIDTH or height < MIN_HEIGHT:
                skipped_count += 1
                continue
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                skipped_count += 1
                continue

            # Find the nearest product code for this image
            code = find_best_code_for_image(bbox, code_positions)

            if not code:
                no_code_count += 1
                continue

            # Map to base code
            base_code = variant_to_base.get(code)
            if not base_code:
                # Try partial matching - some codes in PDF may not exactly match catalog
                base_code = get_base_code_for_variant(code, catalog_bases)

            if not base_code:
                no_code_count += 1
                continue

            # Check if we already have this image
            safe_filename = base_code.replace('/', '_')
            if safe_filename in existing:
                already_have_count += 1
                continue

            # Skip if we already extracted this in this run
            if base_code not in missing_bases:
                continue

            # Extract the image
            clip = fitz.Rect(bbox)
            mat = fitz.Matrix(3, 3)  # 3x zoom for quality
            pix = page.get_pixmap(matrix=mat, clip=clip)

            img_path = os.path.join(OUTPUT_DIR, f'{safe_filename}.png')
            pix.save(img_path)

            missing_bases.discard(base_code)
            existing.add(safe_filename)
            extracted_count += 1

            if extracted_count % 20 == 0:
                print(f"  Extracted {extracted_count} new images...")

    pdf.close()

    print(f"\nExtraction complete:")
    print(f"  Newly extracted: {extracted_count} images")
    print(f"  Already had: {already_have_count}")
    print(f"  Skipped (size filter): {skipped_count}")
    print(f"  No code matched: {no_code_count}")
    print(f"  Still missing: {len(missing_bases)}")

    if missing_bases:
        print(f"\n  Still missing codes:")
        for code in sorted(missing_bases):
            name = catalog_bases.get(code, {}).get('name', '?')
            print(f"    {code}: {name[:60]}")

    return extracted_count


if __name__ == '__main__':
    extract_images()
