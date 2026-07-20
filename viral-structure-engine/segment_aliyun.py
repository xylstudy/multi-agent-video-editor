"""
Alibaba Cloud Vision API - Image Segmentation Pipeline
Uses SegmentCommonImage API to extract foreground from photos.
Uploads images to OSS, calls API, downloads results.
"""

import os, sys, json, base64, io, tempfile, uuid, time
from concurrent.futures import ThreadPoolExecutor, as_completed

import oss2
import requests
from PIL import Image
import numpy as np
from aliyunsdkcore.client import AcsClient
from aliyunsdkimageseg.request.v20191230.SegmentCommonImageRequest import SegmentCommonImageRequest

# ===== Config =====
# 阿里云凭证请通过环境变量或 .env 文件配置，切勿硬编码到源码中。
ACCESS_KEY = os.getenv("ALIYUN_ACCESS_KEY_ID", "")
ACCESS_SECRET = os.getenv("ALIYUN_ACCESS_KEY_SECRET", "")
REGION = os.getenv("ALIYUN_REGION", "cn-shanghai")
BUCKET_NAME = os.getenv("ALIYUN_BUCKET_NAME", "video-seg-3270e1a5")
OSS_ENDPOINT = os.getenv("ALIYUN_OSS_ENDPOINT", f"https://oss-{REGION}.aliyuncs.com")

PHOTOS_DIR = os.getenv("SEGMENT_PHOTOS_DIR", "remotion/public/photos")
OUTPUT_DIR = os.getenv("SEGMENT_OUTPUT_DIR", "remotion/public/segmented")
MAX_WORKERS = 4  # parallel uploads & API calls


def ensure_dir(d):
    os.makedirs(d, exist_ok=True)


def _require_credentials():
    """检查阿里云凭证是否已配置，未配置则抛出清晰错误。"""
    if not ACCESS_KEY or not ACCESS_SECRET:
        raise RuntimeError(
            "阿里云凭证未配置。请在 viral-structure-engine/.env 中设置:\n"
            "  ALIYUN_ACCESS_KEY_ID=你的AccessKeyId\n"
            "  ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret\n"
            "并执行 `python -m dotenv` 或重启终端以加载环境变量。"
        )


def init_oss():
    """Initialize OSS bucket."""
    _require_credentials()
    auth = oss2.Auth(ACCESS_KEY, ACCESS_SECRET)
    bucket = oss2.Bucket(auth, OSS_ENDPOINT, BUCKET_NAME)
    return bucket


def upload_to_oss(bucket, local_path, oss_key):
    """Upload file to OSS, return pre-signed URL valid for 1 hour."""
    bucket.put_object_from_file(oss_key, local_path)
    signed_url = bucket.sign_url("GET", oss_key, 3600)
    return signed_url


def call_segment_api(client, image_url):
    """Call Alibaba Cloud SegmentCommonImage API, return result data."""
    req = SegmentCommonImageRequest()
    req.set_ImageURL(image_url)
    req.set_ReturnForm("mask")  # return binary mask
    req.set_accept_format("json")

    resp = client.do_action_with_exception(req)
    result = json.loads(resp)
    return result


def download_result(result_url):
    """Download segmentation mask from result URL."""
    resp = requests.get(result_url, timeout=30)
    resp.raise_for_status()
    return resp.content


def composite_mask_with_original(original_path, mask_data):
    """
    Combine original image with the returned mask.
    The API returns either a 4-channel PNG (when ReturnForm is not set)
    or a binary mask image.
    """
    original = Image.open(original_path).convert("RGB")
    orig_arr = np.array(original)
    h, w = orig_arr.shape[:2]

    # Load mask
    mask_img = Image.open(io.BytesIO(mask_data))

    # Resize mask to match original if needed
    if mask_img.size != (w, h):
        mask_img = mask_img.resize((w, h), Image.LANCZOS)

    mask_arr = np.array(mask_img)

    # If mask is RGB, take the red channel (common for mask images)
    if len(mask_arr.shape) == 3:
        mask_gray = mask_arr[:, :, 0]
    else:
        mask_gray = mask_arr

    # Create RGBA: original RGB + mask as alpha
    rgba = np.dstack([orig_arr, mask_gray])
    return Image.fromarray(rgba, "RGBA")


def process_single_photo(args):
    """Process one photo: upload → API → download → composite → save."""
    i, filename, src_path, bucket, client = args

    safe_name = "".join(c if c.isascii() else "?" for c in filename[:40])

    try:
        # 1. Upload to OSS
        oss_key = f"photos/{i:03d}_{uuid.uuid4().hex[:8]}.jpg"
        signed_url = upload_to_oss(bucket, src_path, oss_key)

        # 2. Call API
        result = call_segment_api(client, signed_url)
        result_url = result.get("Data", {}).get("ImageURL", "")
        if not result_url:
            return i, filename, False, "No ImageURL in response"

        # 3. Download result mask
        mask_data = download_result(result_url)

        # 4. Composite with original
        # The API returned a mask image, need to composite with original
        original = Image.open(src_path).convert("RGB")
        orig_arr = np.array(original)
        h, w = orig_arr.shape[:2]

        mask_img = Image.open(io.BytesIO(mask_data))
        if mask_img.size != (w, h):
            mask_img = mask_img.resize((w, h), Image.LANCZOS)

        mask_arr = np.array(mask_img)
        if len(mask_arr.shape) == 3:
            mask_gray = mask_arr[:, :, 0]
        else:
            mask_gray = mask_arr

        rgba = np.dstack([orig_arr, mask_gray])
        result_img = Image.fromarray(rgba, "RGBA")

        # 5. Save
        out_name = f"fg_{i:03d}.png"
        out_path = os.path.join(OUTPUT_DIR, out_name)
        result_img.save(out_path, "PNG")

        fg_pct = np.sum(mask_gray > 127) / (h * w) * 100
        return i, filename, True, f"fg={fg_pct:.0f}%"

    except Exception as e:
        return i, filename, False, str(e)


def process_all_photos():
    """Process all photos using parallel API calls."""
    ensure_dir(OUTPUT_DIR)

    # Get all photos
    files = sorted(
        [f for f in os.listdir(PHOTOS_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    )

    # Check which are already done (skip if already processed via API)
    existing = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()
    existing_prefixes = {e.replace(".png", "") for e in existing if e.startswith("fg_") and e.endswith(".png")}

    to_process = []
    for i, fname in enumerate(files):
        base = f"fg_{i:03d}"
        if base not in existing_prefixes:
            to_process.append((i, fname))
        else:
            # Check if it's an API-processed file (has real alpha, not the old grabcut version)
            fg_path = os.path.join(OUTPUT_DIR, f"{base}.png")
            try:
                img = Image.open(fg_path)
                arr = np.array(img)
                # If more than 30% soft edges, it's probably the old grabcut version
                if arr.shape[2] == 4:
                    alpha = arr[:, :, 3]
                    soft = np.sum((alpha > 5) & (alpha < 250)) / alpha.size
                    if soft > 0.15:
                        # Re-process
                        to_process.append((i, fname))
                        print(f"  {base}: has soft edges ({soft:.1%}), re-processing")
                    else:
                        print(f"  {base}: already processed (API version)")
                else:
                    to_process.append((i, fname))
            except:
                to_process.append((i, fname))

    print(f"Total: {len(files)} photos, {len(to_process)} to process")

    if not to_process:
        print("All photos already processed!")
        return

    # Initialize OSS and API client
    bucket = init_oss()
    _require_credentials()
    client = AcsClient(ACCESS_KEY, ACCESS_SECRET, REGION)

    # Process in parallel
    args_list = []
    for i, fname in to_process:
        src_path = os.path.join(PHOTOS_DIR, fname)
        args_list.append((i, fname, src_path, bucket, client))

    completed = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_single_photo, args) for args in args_list]

        for future in as_completed(futures):
            i, filename, success, msg = future.result()
            safe_name = "".join(c if c.isascii() else "?" for c in filename[:40])
            if success:
                completed += 1
                print(f"  [{i:03d}] {safe_name[:35]:35s} ✓ {msg}")
            else:
                failed += 1
                print(f"  [{i:03d}] {safe_name[:35]:35s} ✗ {msg}")

    # Save mapping
    mapping = {}
    for i, fname in enumerate(files):
        mapping[f"fg_{i:03d}"] = fname
    with open(os.path.join(OUTPUT_DIR, "mapping.json"), "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"\nDone! {completed} succeeded, {failed} failed")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    process_all_photos()
