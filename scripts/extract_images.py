"""
Extract product sign images from the PDF brochure.
Matches images to product codes using spatial analysis (image above, code text below).
Saves one image per base product code to public/images/products/.
"""

import fitz
import os
import re
import json
import sys

PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'products')
MAPPING_PATH = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'image_mapping.json')

# Product code pattern - matches codes like PA100, PCF128/F, PCFB01/M, PCFSB12/H, etc.
CODE_PATTERN = re.compile(r'^(P(?:CF|A)\w*\d+\w*)(?:/\w+)?$')
# Pattern to extract base code (without size suffix)
BASE_CODE_PATTERN = re.compile(r'^(P(?:CF|A)\w*\d+\w?)(?:/[A-Z]+)?$')

# Pages to process (0-indexed): pages 4-56 contain products
PRODUCT_PAGES = range(3, 56)

# Minimum image dimensions to consider (skip tiny icons, logos, etc.)
MIN_WIDTH = 50
MIN_HEIGHT = 50
# Maximum image dimensions to skip (background images)
MAX_WIDTH = 600
MAX_HEIGHT = 900


def get_base_code(code):
    """Extract base product code (without size suffix like /F, /M, /Y)."""
    match = BASE_CODE_PATTERN.match(code)
    if match:
        return match.group(1)
    # Handle codes without suffix
    if CODE_PATTERN.match(code):
        return code
    return None


def extract_product_codes_from_text(text):
    """Extract all product codes from a text string."""
    codes = []
    # Split by whitespace and common separators
    tokens = re.split(r'[\s,;]+', text.strip())
    for token in tokens:
        token = token.strip()
        if CODE_PATTERN.match(token):
            codes.append(token)
    return codes


def find_nearest_code_below(image_bbox, text_blocks, page_height):
    """Find the product code in text blocks nearest below the image."""
    img_x_center = (image_bbox[0] + image_bbox[2]) / 2
    img_bottom = image_bbox[3]

    best_code = None
    best_distance = float('inf')

    for block in text_blocks:
        block_bbox = block['bbox']
        block_x_center = (block_bbox[0] + block_bbox[2]) / 2
        block_top = block_bbox[1]

        # Text must be below the image
        if block_top < img_bottom - 5:
            continue

        # Text must be roughly horizontally aligned (within column width)
        x_diff = abs(img_x_center - block_x_center)
        if x_diff > 60:
            continue

        # Distance from bottom of image to top of text
        y_distance = block_top - img_bottom

        # Only look within reasonable range (not too far below)
        if y_distance > 120:
            continue

        # Extract codes from this text block
        text = ''
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                text += span['text'] + ' '

        codes = extract_product_codes_from_text(text)
        if codes:
            distance = y_distance + x_diff * 0.5
            if distance < best_distance:
                best_distance = distance
                best_code = codes[0]  # Take first code found

    return best_code


def extract_images():
    """Main extraction function."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    pdf = fitz.open(PDF_PATH)
    print(f"PDF has {len(pdf)} pages")

    image_mapping = {}  # base_code -> image file path
    extracted_count = 0
    skipped_count = 0
    no_code_count = 0

    for page_idx in PRODUCT_PAGES:
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

        for img_block in image_blocks:
            bbox = img_block['bbox']
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]

            # Skip images that are too small (icons) or too large (backgrounds)
            if width < MIN_WIDTH or height < MIN_HEIGHT:
                skipped_count += 1
                continue
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                skipped_count += 1
                continue

            # Find the nearest product code below this image
            code = find_nearest_code_below(bbox, text_blocks, page.rect.height)

            if not code:
                no_code_count += 1
                continue

            base_code = get_base_code(code)
            if not base_code:
                no_code_count += 1
                continue

            # Skip if we already have this base code
            if base_code in image_mapping:
                continue

            # Extract the image using clip rect from the page
            # This gives us the actual rendered image area
            clip = fitz.Rect(bbox)
            mat = fitz.Matrix(3, 3)  # 3x zoom for good quality
            pix = page.get_pixmap(matrix=mat, clip=clip)

            # Save image
            safe_filename = base_code.replace('/', '_')
            img_path = os.path.join(OUTPUT_DIR, f'{safe_filename}.png')
            pix.save(img_path)

            image_mapping[base_code] = f'/images/products/{safe_filename}.png'
            extracted_count += 1

            if extracted_count % 50 == 0:
                print(f"  Extracted {extracted_count} images...")

    pdf.close()

    # Save mapping
    with open(MAPPING_PATH, 'w', encoding='utf-8') as f:
        json.dump(image_mapping, f, indent=2, ensure_ascii=False)

    print(f"\nExtraction complete:")
    print(f"  Extracted: {extracted_count} unique product images")
    print(f"  Skipped (size filter): {skipped_count}")
    print(f"  No code found: {no_code_count}")
    print(f"  Mapping saved to: {MAPPING_PATH}")
    print(f"  Images saved to: {OUTPUT_DIR}")

    return image_mapping


if __name__ == '__main__':
    mapping = extract_images()
