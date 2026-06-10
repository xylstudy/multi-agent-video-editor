import json
import os
import tempfile

from downloader import save_metadata, _extract_id_from_url


def test_extract_id_from_full_url():
    url = "https://www.douyin.com/video/7628202769404480777?modal_id=999"
    assert _extract_id_from_url(url) == "7628202769404480777"


def test_extract_id_from_share_url():
    url = "https://v.douyin.com/iRxxxxx/"
    assert _extract_id_from_url(url) == "unknown"


def test_save_metadata():
    with tempfile.TemporaryDirectory() as tmpdir:
        metadata = {
            "video_id": "7628202769404480777",
            "title": "测试标题",
            "author": "测试作者",
            "author_id": "uid_123",
            "duration": 30.5,
            "width": 1080,
            "height": 1920,
            "like_count": 12345,
            "comment_count": 678,
            "share_count": 90,
        }
        source_url = "https://v.douyin.com/iRxxxxx/"
        result = save_metadata(metadata, tmpdir, source_url)

        output_path = os.path.join(tmpdir, "douyin_7628202769404480777.json")
        assert result == output_path
        assert os.path.exists(output_path)

        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["video_id"] == "7628202769404480777"
        assert data["title"] == "测试标题"
        assert data["author"] == "测试作者"
        assert data["author_id"] == "uid_123"
        assert data["duration"] == 30.5
        assert data["width"] == 1080
        assert data["height"] == 1920
        assert data["like_count"] == 12345
        assert data["comment_count"] == 678
        assert data["share_count"] == 90
        assert data["source_url"] == source_url
        assert "download_time" in data
