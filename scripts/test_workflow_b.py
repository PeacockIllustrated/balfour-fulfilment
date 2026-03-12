"""
Workflow B: Pure image processing on existing PNGs.
- Template-match the Persimmon logo in each image
- Mask/inpaint the logo region
- Composite the Balfour Beatty logo in the same spot
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw
import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, 'shop', 'public', 'images', 'products')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'workflow_b')
BB_LOGO_SVG = os.path.join(PROJECT_ROOT, 'shop', 'public', 'assets', 'balfour_full_logo.svg')

# Test images: top-center logo, bottom-right logo, no logo
TEST_IMAGES = ['PA100.png', 'PA535.png', 'PCF128.png']


def create_bb_logo_png(width, height):
    """Create a Balfour Beatty logo PNG at the given size using PyMuPDF SVG rendering."""
    import fitz
    # Render SVG to pixmap
    doc = fitz.open(BB_LOGO_SVG)
    page = doc[0]
    # Scale to fit desired width while maintaining aspect ratio
    svg_rect = page.rect
    scale_x = width / svg_rect.width
    scale_y = height / svg_rect.height
    scale = min(scale_x, scale_y)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    doc.close()

    # Convert to PIL Image
    img = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
    return img


def create_persimmon_templates():
    """Extract Persimmon logo templates from known images for template matching.

    We'll crop the logo region from PA44 (top-center) and PA518 (bottom-right)
    to use as templates.
    """
    templates = []

    # Template 1: Top-center Persimmon logo (from PA44 - crop top portion)
    img = cv2.imread(os.path.join(PRODUCTS_DIR, 'PA44.png'))
    if img is not None:
        h, w = img.shape[:2]
        # The Persimmon logo is typically in the top ~15% of the image, centered
        template_top = img[0:int(h * 0.15), int(w * 0.2):int(w * 0.95)]
        templates.append(('top_center', template_top))
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'template_top_center.png'), template_top)

    # Template 2: Bottom-right Persimmon logo (from PA518 - crop bottom-right)
    img2 = cv2.imread(os.path.join(PRODUCTS_DIR, 'PA518.png'))
    if img2 is not None:
        h, w = img2.shape[:2]
        template_br = img2[int(h * 0.8):h, int(w * 0.6):w]
        templates.append(('bottom_right', template_br))
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'template_bottom_right.png'), template_br)

    return templates


def detect_persimmon_logo(image, templates, threshold=0.6):
    """Use multi-scale template matching to find the Persimmon logo."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h_img, w_img = gray.shape

    best_match = None
    best_val = 0
    best_type = None

    for logo_type, template in templates:
        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)
        th, tw = template_gray.shape

        # Try multiple scales
        for scale in [0.5, 0.7, 0.85, 1.0, 1.2, 1.5]:
            new_w = int(tw * scale)
            new_h = int(th * scale)
            if new_w >= w_img or new_h >= h_img or new_w < 20 or new_h < 10:
                continue

            resized = cv2.resize(template_gray, (new_w, new_h))
            result = cv2.matchTemplate(gray, resized, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)

            if max_val > best_val and max_val >= threshold:
                best_val = max_val
                best_match = (max_loc[0], max_loc[1], new_w, new_h)
                best_type = logo_type

    return best_match, best_type, best_val


def detect_persimmon_by_color_and_text(image):
    """Alternative detection: find the green Persimmon house icon by color.

    The Persimmon logo uses a distinctive dark teal/green (#00474a) color
    for its house icon, paired with the text 'Persimmon'.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h_img, w_img = image.shape[:2]

    # Persimmon green/teal in HSV: H ~85-95, S ~80-255, V ~50-120
    lower_teal = np.array([80, 80, 40])
    upper_teal = np.array([100, 255, 140])
    mask = cv2.inRange(hsv, lower_teal, upper_teal)

    # Find contours of teal regions
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None, 'none'

    # Find the largest teal region (likely the Persimmon house icon)
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)

    if area < 50:  # Too small to be a logo
        return None, 'none'

    x, y, cw, ch = cv2.boundingRect(largest)

    # Expand the bounding box to include "Persimmon" text next to it
    # The text is typically to the right of the house icon
    # Expand right by ~3x the icon width, and vertically by a small margin
    expanded_x = max(0, x - 5)
    expanded_y = max(0, y - 5)
    expanded_w = min(w_img - expanded_x, cw * 5)
    expanded_h = min(h_img - expanded_y, ch + 10)

    # Determine position type
    center_y = y + ch / 2
    center_x = x + cw / 2

    if center_y < h_img * 0.25:
        pos_type = 'top_center'
    elif center_y > h_img * 0.7 and center_x > w_img * 0.5:
        pos_type = 'bottom_right'
    elif center_y > h_img * 0.7:
        pos_type = 'bottom_left'
    else:
        pos_type = 'middle'

    return (expanded_x, expanded_y, expanded_w, expanded_h), pos_type


def replace_logo(image_path, output_path, templates):
    """Detect and replace the Persimmon logo in a single image."""
    image = cv2.imread(image_path)
    if image is None:
        print(f"  ERROR: Could not read {image_path}")
        return False

    h_img, w_img = image.shape[:2]
    print(f"\n  Processing: {os.path.basename(image_path)} ({w_img}x{h_img})")

    # Method 1: Template matching
    match, match_type, confidence = detect_persimmon_logo(image, templates)

    # Method 2: Color-based detection (fallback)
    color_match, color_type = detect_persimmon_by_color_and_text(image)

    print(f"  Template match: {match_type} (confidence: {confidence:.2f})" if match else "  Template match: NONE")
    print(f"  Color match: {color_type} at {color_match}" if color_match else "  Color match: NONE")

    # Use the best detection
    logo_region = None
    detection_method = None

    if match and confidence > 0.65:
        logo_region = match  # (x, y, w, h)
        detection_method = f"template ({match_type}, conf={confidence:.2f})"
    elif color_match:
        logo_region = color_match
        detection_method = f"color ({color_type})"

    if not logo_region:
        print(f"  No Persimmon logo detected - copying original")
        cv2.imwrite(output_path, image)
        return True

    print(f"  Detection: {detection_method}")
    print(f"  Logo region: x={logo_region[0]}, y={logo_region[1]}, w={logo_region[2]}, h={logo_region[3]}")

    # Save debug image showing detection
    debug = image.copy()
    x, y, rw, rh = logo_region
    cv2.rectangle(debug, (x, y), (x + rw, y + rh), (0, 0, 255), 2)
    cv2.putText(debug, detection_method, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
    debug_path = output_path.replace('.png', '_debug.png')
    cv2.imwrite(debug_path, debug)

    # Step 1: Inpaint the logo region
    # Sample the background color around the logo edges
    x, y, rw, rh = logo_region

    # Create a mask for the logo region
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    mask[y:y+rh, x:x+rw] = 255

    # Sample background color from the border around the logo
    border = 3
    bg_samples = []
    # Top edge
    if y > border:
        bg_samples.extend(image[y-border:y, x:x+rw].reshape(-1, 3).tolist())
    # Bottom edge
    if y + rh + border < h_img:
        bg_samples.extend(image[y+rh:y+rh+border, x:x+rw].reshape(-1, 3).tolist())
    # Left edge
    if x > border:
        bg_samples.extend(image[y:y+rh, x-border:x].reshape(-1, 3).tolist())
    # Right edge
    if x + rw + border < w_img:
        bg_samples.extend(image[y:y+rh, x+rw:x+rw+border].reshape(-1, 3).tolist())

    if bg_samples:
        bg_color = np.median(bg_samples, axis=0).astype(np.uint8)
    else:
        bg_color = np.array([255, 255, 255], dtype=np.uint8)

    print(f"  Background color (BGR): {bg_color}")

    # Fill the logo region with background color
    result = image.copy()
    result[y:y+rh, x:x+rw] = bg_color

    # Use inpainting for smoother edges
    result = cv2.inpaint(image, mask, 3, cv2.INPAINT_TELEA)

    # Step 2: Composite the Balfour Beatty logo
    # Create BB logo at appropriate size
    logo_target_w = rw
    logo_target_h = rh

    try:
        bb_logo = create_bb_logo_png(logo_target_w, logo_target_h)
        bb_np = np.array(bb_logo)

        # Composite using alpha channel
        if bb_np.shape[2] == 4:  # RGBA
            alpha = bb_np[:, :, 3] / 255.0
            logo_rgb = bb_np[:, :, :3]
            # Convert RGB to BGR for OpenCV
            logo_bgr = cv2.cvtColor(logo_rgb, cv2.COLOR_RGB2BGR)

            # Center the logo in the region
            lh, lw = logo_bgr.shape[:2]
            offset_x = x + (rw - lw) // 2
            offset_y = y + (rh - lh) // 2

            # Ensure we don't go out of bounds
            if offset_x >= 0 and offset_y >= 0 and offset_x + lw <= w_img and offset_y + lh <= h_img:
                for c in range(3):
                    result[offset_y:offset_y+lh, offset_x:offset_x+lw, c] = (
                        alpha * logo_bgr[:, :, c] + (1 - alpha) * result[offset_y:offset_y+lh, offset_x:offset_x+lw, c]
                    ).astype(np.uint8)

        print(f"  BB logo composited at ({offset_x}, {offset_y}), size {lw}x{lh}")
    except Exception as e:
        print(f"  WARNING: Could not composite BB logo: {e}")

    cv2.imwrite(output_path, result)
    print(f"  Saved: {output_path}")
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("WORKFLOW B: Pure Image Processing Test")
    print("=" * 60)

    # Step 1: Create templates from known logo positions
    print("\nCreating Persimmon logo templates...")
    templates = create_persimmon_templates()
    print(f"Created {len(templates)} templates")

    # Step 2: Process each test image
    for img_name in TEST_IMAGES:
        img_path = os.path.join(PRODUCTS_DIR, img_name)
        out_path = os.path.join(OUTPUT_DIR, img_name)

        if not os.path.exists(img_path):
            print(f"\n  SKIP: {img_name} not found")
            continue

        replace_logo(img_path, out_path, templates)

    print("\n" + "=" * 60)
    print(f"Results saved to: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == '__main__':
    main()
