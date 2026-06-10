"""
Image Segmentation Pipeline for Beijing Photos
Extracts foreground objects (buildings, people) from photos
using OpenCV GrabCut + edge-aware initialization.
"""

import os
import cv2
import numpy as np
from PIL import Image
import glob

PHOTOS_DIR = "remotion/public/photos"
OUTPUT_DIR = "remotion/public/segmented"


def ensure_dir(d):
    os.makedirs(d, exist_ok=True)


def segment_foreground(img: np.ndarray) -> np.ndarray:
    """
    Extract foreground from image using GrabCut with smart initialization.
    Returns alpha mask (H, W) with values 0-255.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ---- Step 1: Find structural edges ----
    # Use adaptive Canny thresholds based on image statistics
    median_val = np.median(gray)
    low_thresh = int(max(0, 0.4 * median_val))
    high_thresh = int(min(255, 1.2 * median_val))
    edges = cv2.Canny(gray, low_thresh, high_thresh)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    # ---- Step 2: Background from borders ----
    border_bg = np.zeros((h, w), np.uint8)
    bw = max(5, min(w, h) // 30)  # border width
    border_bg[0:bw, :] = 255
    border_bg[h - bw:h, :] = 255
    border_bg[:, 0:bw] = 255
    border_bg[:, w - bw:w] = 255

    # Also dilate edges outward for background
    edge_bg = cv2.dilate(edges, np.ones((31, 31), np.uint8), iterations=1)
    edge_bg = 255 - edge_bg  # invert to get non-edge areas as candidate bg
    edge_bg = cv2.erode(edge_bg, np.ones((15, 15), np.uint8), iterations=1)

    # ---- Step 3: Foreground from center + edges ----
    # Assume main subject is in center 40% region
    center_fg = np.zeros((h, w), np.uint8)
    cx, cy = w // 2, h // 2
    roi_w, roi_h = w // 3, h // 3
    center_fg[cy - roi_h // 2:cy + roi_h // 2, cx - roi_w // 2:cx + roi_w // 2] = 255

    # Edge-dilated regions as likely foreground boundaries
    edge_fg = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=3)

    # ---- Step 4: Initialize GrabCut mask ----
    grab_mask = np.full(img.shape[:2], cv2.GC_PR_BGD, np.uint8)
    grab_mask[border_bg > 0] = cv2.GC_BGD
    grab_mask[edge_bg > 0] = cv2.GC_BGD
    grab_mask[center_fg > 0] = cv2.GC_FGD
    # Strong edges are probable foreground
    grab_mask[edge_fg > 0] = cv2.GC_FGD

    # ---- Step 5: Run GrabCut ----
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, grab_mask, None, bgd, fgd, 5, cv2.GC_INIT_WITH_MASK)

    # ---- Step 6: Extract and refine mask ----
    mask = np.where((grab_mask == cv2.GC_FGD) | (grab_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Clean up
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8), iterations=1)

    # Keep only largest connected component (the main subject)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num_labels > 1:
        # Label 0 is background, find largest foreground component
        sizes = stats[1:, -1]
        if len(sizes) > 0:
            largest = np.argmax(sizes) + 1
            mask = (labels == largest).astype(np.uint8) * 255

    # Feather the edges for smooth compositing
    mask_float = cv2.GaussianBlur(mask.astype(np.float32), (15, 15), 4)
    mask = np.clip(mask_float, 0, 255).astype(np.uint8)

    return mask


def process_photos():
    """Process all photos and save foreground composites."""
    ensure_dir(OUTPUT_DIR)

    # Get all jpg files
    files = sorted([f for f in os.listdir(PHOTOS_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

    # Check which ones are already processed
    existing = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()
    processed_prefixes = set()
    for e in existing:
        if e.startswith("fg_") and e.endswith(".png"):
            processed_prefixes.add(e.replace(".png", ""))

    to_process = []
    for i, fname in enumerate(files):
        base = f"fg_{i:03d}"
        if base not in processed_prefixes:
            to_process.append((i, fname))

    print(f"Found {len(files)} photos, {len(processed_prefixes)} already processed, {len(to_process)} remaining")

    for i, filename in to_process:
        src_path = os.path.join(PHOTOS_DIR, filename)
        safe_name = "".join(c if c.isascii() else "?" for c in filename[:50])
        print(f"[{i + 1}/{len(files)}] Processing: {safe_name}...", end=" ", flush=True)

        try:
            # Read with OpenCV (handles more formats)
            img = cv2.imread(src_path)
            if img is None:
                # Fallback to PIL
                pil_img = Image.open(src_path).convert("RGB")
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            h, w = img.shape[:2]

            # Skip very small images
            if h < 100 or w < 100:
                print(f"too small ({w}x{h}), skipping")
                continue

            # Segment foreground
            mask = segment_foreground(img)

            # Create RGBA composite (original image + alpha from mask)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            rgba = np.dstack([img_rgb, mask])

            # Determine output filename (use index-based to avoid encoding issues)
            base = f"fg_{i:03d}"
            out_path = os.path.join(OUTPUT_DIR, f"{base}.png")

            # Save as PNG with transparency
            Image.fromarray(rgba, "RGBA").save(out_path, "PNG")

            # Also save a metadata file mapping original to output
            fg_pct = np.sum(mask > 127) / (h * w) * 100
            print(f"→ {base}.png (fg: {fg_pct:.0f}%)")

        except Exception as e:
            print(f"ERROR: {e}")

    # Save a mapping file
    print("\nGenerating mapping file...")
    mapping = {}
    files = sorted([f for f in os.listdir(PHOTOS_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    for i, fname in enumerate(files):
        mapping[f"fg_{i:03d}"] = fname

    import json
    with open(os.path.join(OUTPUT_DIR, "mapping.json"), "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Output in: {OUTPUT_DIR}")


if __name__ == "__main__":
    process_photos()
