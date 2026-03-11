"""
Deep-dive into PDF structure to understand how signs are composed.
Goal: figure out if the Persimmon logo is a separate image layer
that can be excluded when rendering.
"""

import fitz
import os
import json
import numpy as np
import cv2

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATH = os.path.join(PROJECT_ROOT, 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'workflow_d')

os.makedirs(OUTPUT_DIR, exist_ok=True)

pdf = fitz.open(PDF_PATH)

# Let's focus on page 42 (idx 41) which has PA100 (H&S Notice Board with top-center Persimmon logo)
# and page 10 (idx 9) which has PCF128

for page_idx, product_code in [(41, 'PA100'), (9, 'PCF128'), (5, 'PA535')]:
    page = pdf[page_idx]
    print(f"\n{'='*70}")
    print(f"PAGE {page_idx+1} - Looking for {product_code}")
    print(f"{'='*70}")

    # 1. Get ALL image objects on this page with full metadata
    img_list = page.get_images(full=True)
    print(f"\nTotal image objects on page: {len(img_list)}")

    seen_xrefs = set()
    for i, img_info in enumerate(img_list):
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)

        # Get image properties
        try:
            base_image = pdf.extract_image(xref)
            if not base_image:
                continue
            w = base_image['width']
            h = base_image['height']
            ext = base_image['ext']
            cs = base_image['colorspace']
            bpc = base_image.get('bpc', '?')

            # Get placement rectangles on the page
            rects = page.get_image_rects(xref)

            # Analyze colors
            nparr = np.frombuffer(base_image['image'], np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            color_info = ""
            if img is not None:
                # Check for Persimmon teal
                hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                lower_teal = np.array([75, 60, 30])
                upper_teal = np.array([105, 255, 150])
                teal_mask = cv2.inRange(hsv, lower_teal, upper_teal)
                teal_pct = np.count_nonzero(teal_mask) / (h * w) * 100

                # Dominant color
                avg = img.mean(axis=(0, 1)).astype(int)
                color_info = f"avg_bgr=({avg[0]},{avg[1]},{avg[2]}) teal={teal_pct:.1f}%"

                # Save each image for inspection
                img_path = os.path.join(OUTPUT_DIR, f'page{page_idx+1}_xref{xref}_{w}x{h}.png')
                cv2.imwrite(img_path, img)

            print(f"\n  Image xref={xref}: {w}x{h} {ext} cs={cs} bpc={bpc}")
            print(f"    {color_info}")
            for rect in rects:
                print(f"    Placed at: {rect} (page coords)")
                # Check size on page
                pw = rect.width
                ph = rect.height
                print(f"    Page size: {pw:.1f}x{ph:.1f} pts")

        except Exception as e:
            print(f"  Image xref={xref}: ERROR - {e}")

    # 2. Get text blocks to find product code locations
    print(f"\n--- Text containing '{product_code}' ---")
    page_dict = page.get_text('dict')
    for block in page_dict['blocks']:
        if block['type'] != 0:
            continue
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                if product_code in span['text'] or 'ersimmon' in span['text']:
                    print(f"  '{span['text']}' at {span['bbox']} size={span['size']:.1f}")

    # 3. Look at the raw page content stream for drawing commands
    # This tells us the order of rendering (what's drawn on top of what)
    print(f"\n--- Page content stream (first 3000 chars) ---")
    xref_page = page.xref
    stream = page.read_contents()
    if stream:
        decoded = stream.decode('latin-1', errors='replace')[:3000]
        print(decoded[:2000])

pdf.close()
print("\n\nDone. Check test_output/workflow_d/ for extracted individual image objects.")
