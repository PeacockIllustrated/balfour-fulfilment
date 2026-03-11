# Balfour Beatty Sign Rebrand — Batch Progress Tracker

**Total images**: 785
**Batch size**: 100 images per batch (8 batches total)
**Output**: `scripts/test_output/rebrand_preview/` (preview mode — not overwriting originals)
**Logo**: `shop/public/assets/balfour_icon.svg` (BB double-B icon, #005d99 blue)

## Batch Plan

| Batch | Range       | Count | Status    | [D] Raw | [B] Processed | [-] No Logo | [?] Missing | [!] Error | Notes |
|-------|-------------|-------|-----------|---------|---------------|-------------|-------------|-----------|-------|
| 1     | 1–100       | 100   | DONE      | 14      | 76            | 10          | 0           | 0         | 5 flagged issues |
| 2     | 101–200     |       | PENDING   |         |               |             |             |           |       |
| 3     | 201–300     |       | PENDING   |         |               |             |             |           |       |
| 4     | 301–400     |       | PENDING   |         |               |             |             |           |       |
| 5     | 401–500     |       | PENDING   |         |               |             |             |           |       |
| 6     | 501–600     |       | PENDING   |         |               |             |             |           |       |
| 7     | 601–700     |       | PENDING   |         |               |             |             |           |       |
| 8     | 701–785     |       | PENDING   |         |               |             |             |           |       |

## Cumulative Totals

- **Processed**: 100 / 785
- **Errors**: 0

## Issues Log

### Batch 1 Issues

| # | Code   | Workflow | Issue Type              | Description |
|---|--------|----------|-------------------------|-------------|
| 1 | PA541  | [D]      | Rotated raw image       | Raw PDF image is rotated 90deg — Persimmon text visible on left edge |
| 2 | PA548  | [D]      | Rotated raw image       | Same as PA541 — rotated raw, Persimmon visible on edge |
| 3 | PA602E | [D]      | Content-embedded brand  | "persimmonhomes.com" email + Persimmon logo is part of sign content, not a header overlay |
| 4 | PA602F | [D]      | Content-embedded brand  | Same sign as PA602E (different format) |
| 5 | PA682W | [B]      | Incomplete masking      | Persimmon house icon remnant showing behind BB logo — mask region too small |
