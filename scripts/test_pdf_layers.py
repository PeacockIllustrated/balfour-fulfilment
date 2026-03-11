"""
Investigate PDF Form XObjects and overlays.
Key finding: PCF128's raw image has NO Persimmon logo, but the page render does.
The logo must be in a separate layer (Form XObject) overlaid on the page.
"""

import fitz
import os
import numpy as np
import cv2

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATH = os.path.join(PROJECT_ROOT, 'BROCHURE & PRICELIST', 'Onesign Signs_Site Signage Catalogue_January2026.pdf')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'workflow_d')

os.makedirs(OUTPUT_DIR, exist_ok=True)

pdf = fitz.open(PDF_PATH)

# Focus on page 10 (idx 9) where PCF128 lives
page_idx = 9
page = pdf[page_idx]

print(f"Page {page_idx+1} analysis")
print(f"{'='*70}")

# 1. List all Form XObjects referenced on this page
print("\n--- Resources: Form XObjects ---")
resources = page.get_text('rawdict')  # not what we need

# Let's look at the page's resource dictionary directly
page_xref = page.xref
print(f"Page xref: {page_xref}")

# Get the page's content stream commands
print("\n--- Content stream drawing commands ---")
stream = page.read_contents()
decoded = stream.decode('latin-1', errors='replace')

# Find all Do commands (which draw images or Form XObjects)
import re
do_commands = re.findall(r'(/\w+)\s+Do', decoded)
print(f"Do commands: {do_commands}")

# Find all image placement commands (cm + Do sequences)
# Pattern: q ... cm /ImX Do Q
cm_do_pattern = re.findall(r'q\s+([\d.\-e ]+)\s+cm\s*\n\s*(/\w+)\s+Do\s*\n\s*Q', decoded)
print(f"\nImage placements (transform + name):")
for transform, name in cm_do_pattern:
    vals = transform.split()
    if len(vals) == 6:
        a, b, c, d, e, f = [float(v) for v in vals]
        # a,d = scale, e,f = position
        print(f"  {name}: scale=({a:.1f}, {d:.1f}) pos=({e:.1f}, {f:.1f})")

# 2. Check Optional Content Groups (OCG/layers)
print("\n--- Optional Content Groups ---")
oc_layers = pdf.get_layer()
print(f"Layers: {oc_layers}")

ocgs = pdf.get_ocgs()
print(f"OCGs: {ocgs}")

# 3. Try rendering the page with and without specific layers
print("\n--- Layer visibility test ---")

# First, render PCF128's region normally
pcf128_bbox = (37.35, 105.35, 129.89, 174.76)
clip = fitz.Rect(pcf128_bbox)

# Expand clip slightly to include any overlapping decorations
expanded_clip = fitz.Rect(pcf128_bbox[0] - 5, pcf128_bbox[1] - 30, pcf128_bbox[2] + 5, pcf128_bbox[3] + 5)

mat = fitz.Matrix(3, 3)
pix_normal = page.get_pixmap(matrix=mat, clip=expanded_clip)
pix_normal.save(os.path.join(OUTPUT_DIR, 'pcf128_normal_render.png'))
print(f"  Normal render saved ({pix_normal.width}x{pix_normal.height})")

# 4. Try toggling layer visibility
if ocgs:
    for xref, info in ocgs.items():
        name = info.get('name', '?')
        print(f"  OCG xref={xref}: name='{name}'")

        # Try hiding this layer and re-rendering
        # Use set_layer_ui_config or similar
        pdf.set_layer(-1, on=[], off=[xref])
        page2 = pdf[page_idx]
        pix_hidden = page2.get_pixmap(matrix=mat, clip=expanded_clip)
        pix_hidden.save(os.path.join(OUTPUT_DIR, f'pcf128_hide_layer_{xref}.png'))
        print(f"    Rendered with layer {xref} hidden")

        # Restore
        pdf.set_layer(-1, on=[xref], off=[])

# 5. Examine the Form XObjects directly
print("\n--- Form XObject contents ---")
# Get the page's resource dictionary
res = page.get_text('rawdict')

# Manually inspect the xref table for Form XObjects
# We can use pdf.xref_get_keys() for each object
for key in pdf.xref_get_keys(page_xref):
    print(f"  Page key: {key}")

# Try to find the XObject resources
print("\n--- Inspecting XObject references from content stream ---")
# The Do commands reference names like /Fm0, /Im0, etc.
# These map to XObject resources

# Let's look at what the Form XObjects contain by examining their streams
# Get XObject dict from page resources
xobj_dict = page.xref  # We need another approach

# Direct approach: search for form XObjects in the PDF
for i in range(pdf.xref_length()):
    try:
        keys = pdf.xref_get_keys(i)
        if 'Subtype' in keys and 'BBox' in keys:
            subtype = pdf.xref_get_key(i, 'Subtype')
            if subtype[1] == '/Form':
                bbox_str = pdf.xref_get_key(i, 'BBox')
                # Check if this form xobject contains drawing commands
                try:
                    stream_bytes = pdf.xref_stream(i)
                    if stream_bytes:
                        stream_text = stream_bytes.decode('latin-1', errors='replace')[:200]
                        has_persimmon = 'ersimmon' in stream_text.lower()
                        # Check for image references
                        has_image = '/Im' in stream_text or 'Do' in stream_text
                        size = len(stream_bytes)
                        if has_image or has_persimmon or size > 100:
                            print(f"  Form xref={i}: bbox={bbox_str[1]}, size={size}b, has_img={has_image}, persimmon={has_persimmon}")
                            if size < 500:
                                print(f"    Content: {stream_text[:300]}")
                except:
                    pass
    except:
        continue

# 6. Direct test: render page clip that JUST contains the raw sign image area
# vs the area that includes the Persimmon header overlay
print("\n--- Comparing raw image vs page render ---")

# Raw image xref 387 is at (37.35, 105.35, 129.89, 174.76)
# Let's see what's rendered ABOVE it (where the Persimmon logo appears)
above_clip = fitz.Rect(37.35, 75, 129.89, 105)
pix_above = page.get_pixmap(matrix=fitz.Matrix(5, 5), clip=above_clip)
pix_above.save(os.path.join(OUTPUT_DIR, 'pcf128_above_sign_5x.png'))
print(f"  Area above PCF128 sign saved ({pix_above.width}x{pix_above.height})")

# And render the sign itself without the area above
sign_only_clip = fitz.Rect(37.35, 105.35, 129.89, 174.76)
pix_sign = page.get_pixmap(matrix=fitz.Matrix(5, 5), clip=sign_only_clip)
pix_sign.save(os.path.join(OUTPUT_DIR, 'pcf128_sign_only_5x.png'))
print(f"  Sign-only region saved ({pix_sign.width}x{pix_sign.height})")

pdf.close()
print("\nDone.")
