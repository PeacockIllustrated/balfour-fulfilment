"""
Curate the catalogue to 5 signs per category, rebrand them with Balfour branding,
and deploy a trimmed catalog.json.

Usage:
  python scripts/curate_catalog.py
"""

import json
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CATALOG_PATH = os.path.join(PROJECT_ROOT, 'shop', 'data', 'catalog.json')
CATALOG_BACKUP = os.path.join(PROJECT_ROOT, 'shop', 'data', 'catalog_full.json')
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, 'shop', 'public', 'images', 'products')
PREVIEW_DIR = os.path.join(SCRIPT_DIR, 'test_output', 'rebrand_preview')

# Hand-curated 5 signs per category (best representatives with images)
CURATED = {
    "site-setup-pack": ["PA115"],  # only 1 product

    "environmental-signs": [
        "PA518",   # Hazardous Waste Station
        "PA535",   # General Waste
        "PA549",   # Environmental Information
        "PA550",   # Dust & Air Quality Board
        "PA540",   # Danger refuelling area
    ],

    "site-entrance-signs": [
        "PCF151",  # Site organisation
        "PCF167",  # Welcome safety starts here
        "PCF29",   # Caution site entrance
        "PCF329",  # No entry for construction vehicles
        "PCF384",  # Site entrance
    ],

    "information-signs": [
        "PA116",   # This is a no smoking site
        "PCF153",  # Health & Safety Information
        "PCF154",  # Report to site office sign
        "PCF251",  # 5mph Site speed limit
        "PCF450",  # Assembly point
    ],

    "ppe-signs": [
        "PA120",   # Safety helmets must be worn on this site
        "PCF05",   # Hard hats must be worn beyond this point
        "PCF129",  # Hi-viz clothing must be worn on site
        "PCF961",  # PPE must be worn beyond this point
        "PCF962",  # Task specific PPE must be worn when required
    ],

    "hazard-signs": [
        "PCF09",   # Danger scaffolding incomplete
        "PCF100",  # Danger high voltage
        "PCF131",  # Danger demolition in progress
        "PCF37",   # Caution heavy plant crossing
        "PCF811",  # Danger construction site keep out
    ],

    "fire-signs": [
        "PA50",    # Fire Exit Left/Down
        "PA51",    # Fire Exit Right/Down
        "PCF461",  # Fire action
        "PCF701",  # Fire exit
        "PCF721",  # Fire extinguisher
    ],

    "pedestrian-signs": [
        "PA45",    # Pedestrians
        "PCF324",  # Pedestrians look left
        "PCF375",  # Pedestrian crossing point
        "PCF379",  # Pedestrian access
        "PCF963",  # Pedestrian access route
    ],

    "security-signs": [
        "PCF01",   # Construction area keep out
        "PCF03",   # Site working hours
        "PCF60",   # CCTV in operation
        "PCF61",   # Guard dogs on site
        "PCF79",   # Keep out
    ],

    "health-signs": [
        "PCF26",   # Toilet
        "PCF462",  # Eye wash
        "PCF463",  # First aid post
        "PCF707",  # Know where to get first aid
        "PCF712",  # AED Automated external defibrillator
    ],

    "site-marking": [
        "PCFMK01/10",  # Electric service below
        "PCFMK03/10",  # Water service below
        "PCFMK04/10",  # Gas service below
        "PCFMK10/10",  # Stop do not dig
        "PCFMK97/10",  # Custom Mark-em (Green)
    ],

    "simple-safety-signs": [
        "PCFBA100",  # Safety, Health & Environmental Pack
        "PCFBA101",  # SHE Notice Board
        "PCFBA102",  # Site Traffic & Environmental Plan
        "PCFBA103",  # Canteen Board
        "PCFBA104",  # A4 Wall Pocket Set
    ],

    "working-at-height": [
        "PA82PCF",   # When working at height do don't
        "PCFSB11",   # Hard hats must be worn on this site
        "PCFSB16",   # Always wear safety harness
        "PCFSB45",   # Safe working load
        "PCFSF42",   # Keep clear scaffolding being dismantled
    ],

    "traffic-signs": [
        "PA126",   # Slow
        "PCF24",   # 10mph Site speed limit
        "PCF33",   # Construction traffic left
        "PCF330",  # Fire assembly point
        "PCF353",  # Car parking area
    ],

    "parking-signs": [
        "PA40",    # Residents parking only
        "PCF21",   # No parking
        "PCF310",  # Reserved parking for
        "PCF315",  # Visitor parking
        "PCF517",  # Reserved parking disabled
    ],

    "roadworks-signs": [
        "PCFR70/6011",  # Stop
        "PCFR70/606L",  # Proceed Left
        "PCFR80/7001",  # Road works ahead
        "PCFR80/543",   # Traffic signals ahead
        "PCFR87/9011",  # One way (Left)
    ],

    "freestanding-signs": [
        "PCFDI21",   # Fire door keep clear
        "PCFDI26",   # Fire exit keep clear
        "PCFDI38",   # Push
        "PCFPU",     # Safe path ahead
        "PCFSG600",  # 600mm Stop/Go Lollipop
    ],

    "display-boards": [
        "PA639",    # Quality Common Scoring
        "PCFDWBH",  # Hazard Board
        "PCFDWTP",  # Traffic & Environmental Management Plan
        "PCFDWYP",  # Year Planner
        "PCFCF",    # A0 Clipframe
    ],

    "notice-boards": [
        "PA100",  # Health & Safety Notice Board
        "PA101",  # Company Information Board
        "PA104",  # Material Call Off and Delivery Record
        "PA105",  # Contractors Health & Safety Score Board
        "PA108",  # Daily Hazard Board
    ],

    "considerate-site-signs": [
        "PA109",   # we aim to please minimise
        "PA112",   # we aim to please 1-2-3
        "PA89",    # SITE SAFETY Under the Health & Safety Act
        "PA93",    # Mandatory Multi Sign Board
        "PA602E",  # Safety Concerns Line Sign
    ],

    "posters": [
        "PCFCCS05",  # Hazard Board
        "PCFCCS15",  # Save energy switch lights off
        "PCFCCS19",  # You Said We Did
        "PCFCCS52",  # Services
        "PCFCCS53",  # Crane Information Board
    ],

    "prestige-signs": ["PCFPR"],  # only 1 product

    "hoarding-signs": [
        "PCFHS011",  # Branded Hoarding Sign
        "PCFHS051",  # Branded Hoarding Sign with Site Name
        "PCFHS061",  # Branded Hoarding Sign with Site Name
        "PCFHSF10",  # Branded Site Fencing Banner
        "PCFHS015",  # Branded Hoarding Sign (Correx)
    ],

    "finished-home-signs": [
        "PCF614",     # Temporary Street Name Plate
        "PCF614T",    # Temporary Street Name Plate No Through Road
        "PCFFH40/10", # Please keep off the grass
        "PCFFH42",    # 50mm Glass Manifestation Discs
    ],

    "custom-signs": [
        "PCF170",  # Custom Position/Name Sign
        "PCF995",  # Warning/Prohibition Sign
        "PCF998",  # Prohibition/Mandatory Sign
        "PCF999",  # Warning/Mandatory Sign
    ],

    "extras-accessories": [
        "PCFLFB0",  # A4 Lockable Notice Board (Correx)
        "PCFLFB2",  # A2 Lockable Notice Board (Correx)
        "PCFLFB4",  # A0 Lockable Notice Board (Correx)
        "PCFPFB1",  # A3 Lockable Notice Board (Felt)
        "PCFPFB3",  # A1 Lockable Notice Board (Felt)
    ],

    "other-signs": [
        "PA81PCF",  # Don't let a fall shatter your life
        "PA95",     # Site rules
        "PCF06",    # Safety equipment must be worn on this site
        "PCF07",    # No unauthorised access
        "PCF11",    # Senior Site Manager
    ],
}


def main():
    # Load full catalog
    with open(CATALOG_PATH) as f:
        catalog = json.load(f)

    # Back up full catalog (only if backup doesn't already exist)
    if not os.path.exists(CATALOG_BACKUP):
        shutil.copy2(CATALOG_PATH, CATALOG_BACKUP)
        print(f"Backed up full catalog to {CATALOG_BACKUP}")
    else:
        print(f"Backup already exists at {CATALOG_BACKUP}")

    # Build trimmed catalog
    trimmed_categories = []
    total_products = 0
    total_variants = 0
    all_selected_codes = []

    for cat in catalog['categories']:
        slug = cat['slug']
        if slug == 'for-admin-review':
            # Keep admin review category but empty it for the trimmed version
            continue

        selected_codes = CURATED.get(slug)
        if selected_codes is None:
            print(f"  WARNING: No curation for '{slug}' — skipping")
            continue

        # Filter products to only selected codes
        selected_products = []
        for code in selected_codes:
            for product in cat['products']:
                if product['baseCode'] == code:
                    selected_products.append(product)
                    break
            else:
                print(f"  WARNING: Code '{code}' not found in category '{slug}'")

        variant_count = sum(len(p['variants']) for p in selected_products)

        trimmed_cat = {
            'name': cat['name'],
            'slug': cat['slug'],
            'description': cat['description'],
            'products': selected_products,
            'productCount': len(selected_products),
        }
        trimmed_categories.append(trimmed_cat)
        total_products += len(selected_products)
        total_variants += variant_count
        all_selected_codes.extend(selected_codes)

        print(f"  {cat['name']:30s}  {len(selected_products):2d}/{cat['productCount']:3d} products")

    trimmed_catalog = {
        'categories': trimmed_categories,
        'totalProducts': total_products,
        'totalVariants': total_variants,
    }

    # Write trimmed catalog
    with open(CATALOG_PATH, 'w') as f:
        json.dump(trimmed_catalog, f, indent=2)

    print(f"\nTrimmed catalog written: {total_products} products, {total_variants} variants")
    print(f"Categories: {len(trimmed_categories)}")

    # Determine which signs need rebranding
    rebranded_path = os.path.join(SCRIPT_DIR, 'verified_rebranded.txt')
    rebranded = set()
    if os.path.exists(rebranded_path):
        with open(rebranded_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    rebranded.add(line)

    needs_rebrand = []
    already_rebranded = []
    for code in all_selected_codes:
        safe_code = code.replace('/', '_')
        if safe_code in rebranded or code in rebranded:
            already_rebranded.append(code)
            # Check if rebranded preview image exists and copy to products
            preview_path = os.path.join(PREVIEW_DIR, f'{safe_code}.png')
            product_path = os.path.join(PRODUCTS_DIR, f'{safe_code}.png')
            if os.path.exists(preview_path):
                shutil.copy2(preview_path, product_path)
        else:
            needs_rebrand.append(code)

    print(f"\nAlready rebranded: {len(already_rebranded)}")
    print(f"Need rebranding:   {len(needs_rebrand)}")

    if needs_rebrand:
        print("\nCodes to rebrand:")
        for code in needs_rebrand:
            print(f"  {code}")

    # Write the codes that need rebranding to a file for the rebrand script
    needs_file = os.path.join(SCRIPT_DIR, 'curated_needs_rebrand.txt')
    with open(needs_file, 'w') as f:
        for code in needs_rebrand:
            f.write(code + '\n')
    print(f"\nWrote {len(needs_rebrand)} codes to {needs_file}")

    return needs_rebrand


if __name__ == '__main__':
    codes = main()
    if codes:
        print(f"\nRun rebrand with:")
        print(f"  python scripts/rebrand_signs.py --codes {' '.join(codes)}")
