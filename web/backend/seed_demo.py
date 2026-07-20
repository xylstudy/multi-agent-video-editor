"""示例数据种子脚本。

为新用户提供开箱即用的示例内容（页面不再空白）：
  - 一条【示例】视频基因（基于仓库内置示例视频 + 真实镜头切分时间轴手工标注的报告）
  - 一个【示例】项目 + 一条成功的端到端任务（成片来自仓库内置示例成片）

用法：
    python seed_demo.py [username]     # 默认给第一个用户

示例数据均以「【示例】」开头，可随时删除，不影响正式数据。
"""
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from app_config import STORAGE_ROOT  # noqa: E402
from database import engine  # noqa: E402
from db_models import (  # noqa: E402
    Gene, GeneStatus, Material, MaterialType, Project, Task, TaskStatus, TaskType, User,
)
from sqlmodel import Session, select  # noqa: E402

REPO_ROOT = BACKEND_DIR.parent.parent
SAMPLE_VIDEO = REPO_ROOT / "videos" / "北京旅行Vlog _ 漫步京城.mp4"
SAMPLE_OUTPUT = REPO_ROOT / "videos" / "final_video.mp4"

DEMO_GENE_TITLE = "【示例】北京旅行爆款 Vlog"
DEMO_PROJECT_NAME = "【示例】北京旅行 Vlog"

# 示例报告：镜头时间轴来自对示例视频的真实场景切分（20 个镜头 / 19.5s / 1080x1920）
SHOT_DEFS = [
    ("hook", "震撼", "故宫角楼日出金光洒在护城河面，镜面倒影如画"),
    ("scene_establish", "期待", "航拍俯拍天安门广场全景，人群如织"),
    ("scene_establish", "期待", "走进午门，红墙金瓦在蓝天下格外醒目"),
    ("daily_moment", "好奇", "沿中轴线漫步，镜头跟随穿过太和门"),
    ("daily_moment", "惊叹", "太和殿前仰视金銮宝座，雕龙细节毕现"),
    ("persona_expression", "开心", "主角转身对镜头微笑，比出打卡手势"),
    ("daily_moment", "平静", "御花园古柏参天，光影斑驳洒落石径"),
    ("daily_moment", "好奇", "推开胡同老宅木门，四合院天井跃然眼前"),
    ("daily_moment", "欢乐", "南锣鼓巷糖葫芦特写，糖衣晶莹剔透"),
    ("emotion_peak", "治愈", "什刹海夕阳下划船，金色波光荡漾"),
    ("daily_moment", "满足", "铜锅涮肉热气升腾，羊肉片翻滚入汤"),
    ("daily_moment", "欢乐", "朋友碰杯北冰洋汽水，气泡溢出杯口"),
    ("persona_expression", "放松", "主角倚在景山万春亭栏杆远眺京城"),
    ("emotion_peak", "震撼", "景山顶俯瞰故宫全景，金色琉璃海洋"),
    ("daily_moment", "平静", "傍晚前门大街灯笼次第亮起"),
    ("daily_moment", "怀旧", "老舍茶馆内相声演员抖包袱，观众大笑"),
    ("emotion_peak", "感动", "夜幕下CBD灯光秀，现代与古典交相辉映"),
    ("closing_moment", "治愈", "主角在胡同口挥手告别，夕阳拉长了影子"),
    ("closing_moment", "温暖", "慢镜头回放旅程碎片：笑容、美食、红墙"),
    ("closing_moment", "平静", "黑场前定格天安门夜景，字幕浮现"),
]

SCRIPT_STRUCTURE = [
    {"index": 0, "purpose": "hook", "shot_range": "镜头0 - 镜头1", "content_summary": "故宫角楼日出+天安门航拍，用最震撼的画面先声夺人", "duration_hint": 2, "emotion": "震撼", "rhythm": "快"},
    {"index": 1, "purpose": "场景铺展", "shot_range": "镜头2 - 镜头8", "content_summary": "沿中轴线深度游览故宫，穿插胡同与美食，节奏舒缓", "duration_hint": 7, "emotion": "好奇", "rhythm": "中"},
    {"index": 2, "purpose": "情绪递进", "shot_range": "镜头9 - 镜头16", "content_summary": "什刹海夕阳、涮肉碰杯、景山俯瞰、茶馆相声，情绪持续走高", "duration_hint": 8, "emotion": "治愈", "rhythm": "中"},
    {"index": 3, "purpose": "高潮爆发", "shot_range": "镜头17 - 镜头19", "content_summary": "CBD灯光秀收束全片，告别画面+夜景定格，余韵悠长", "duration_hint": 2.5, "emotion": "感动", "rhythm": "慢"},
]

CURVE_POINTS = [
    {"time": 0.0, "intensity": 0.95, "note": "开场即高潮画面抓人"},
    {"time": 2.0, "intensity": 0.55, "note": "进入故宫，节奏放缓"},
    {"time": 5.0, "intensity": 0.5, "note": "中轴线漫步，平稳铺展"},
    {"time": 8.0, "intensity": 0.6, "note": "胡同美食，生活气息"},
    {"time": 11.0, "intensity": 0.7, "note": "涮肉碰杯，情绪升温"},
    {"time": 14.0, "intensity": 0.85, "note": "景山俯瞰全景，视觉高点"},
    {"time": 17.0, "intensity": 0.9, "note": "灯光秀高潮"},
    {"time": 19.0, "intensity": 0.4, "note": "告别收束，余韵回落"},
]

DEMO_REPORT = {
    "source_path": str(SAMPLE_VIDEO),
    "duration": 19.5,
    "resolution": [1080, 1920],
    "shot_count": 20,
    "structure_summary": "典型情绪递进型旅行 Vlog：震撼开场→场景铺展→情绪递进→灯光秀高潮→温暖收尾",
    "hook_summary": "开场直接使用故宫角楼日出的航拍级画面，配合 BGM 第一拍切入，3 秒内建立「大片感」预期",
    "key_techniques": [
        "开场即王炸：把全片最美画面放在第 1 秒",
        "快慢交替：大场景航拍与市井特写交替维持新鲜感",
        "情绪锚点：每 3-4 个镜头设置一个人物互动瞬间",
        "日落黄金时刻：核心情绪画面集中在蓝调时刻前后拍摄",
        "首尾呼应：以天安门开始，以天安门夜景结束",
    ],
    "vlog_meta": {
        "narrative_type": "timeline",
        "structure_type": "情绪递进型",
        "persona_type": "back_figure",
        "persona_ratio": 0.15,
        "hook_method": "视觉冲击",
        "hook_detail": "角楼日出金光+护城河镜面倒影，无需旁白直接抓人",
        "empty_shot_count": 0,
        "empty_shot_ratio": 0.0,
        "emotion_arc": ["震撼", "期待", "好奇", "治愈", "感动"],
        "overall_emotion": "治愈",
        "key_techniques": [],
    },
    "shots": [
        {
            "index": i,
            "start_time": float(i),
            "end_time": float(i + 1) if i < 19 else 19.5,
            "duration": 1.0 if i < 19 else 0.5,
            "shot_type": st,
            "visual_description": desc,
            "camera_movement": "固定镜头" if i % 3 else "推镜头",
            "shot_size": "long" if st in ("hook", "scene_establish", "emotion_peak") else "medium",
            "composition": "对称" if i % 2 else "三分法",
            "color_mood": "warm",
            "subtitle_text": "",
            "voiceover_text": "",
            "transition_in": "cut",
            "emotion": emo,
            "structure_purpose": "",
            "has_face": st == "persona_expression",
            "bgm_sync": True,
            "is_empty_shot": False,
            "motion_intensity": 0.5,
            "color_stats": {},
            "audio_type": "music",
        }
        for i, (st, emo, desc) in enumerate(SHOT_DEFS)
    ],
    "raw_structure_analysis": {
        "script_structure": SCRIPT_STRUCTURE,
        "rhythm_analysis": {
            "curve_points": CURVE_POINTS,
            "pattern": "快-慢-递进-爆发",
            "climax_position_percent": 87,
            "front_3s_shot_count": 3,
            "estimated_bpm_range": "90-110",
            "bgm_style_guess": "国风电子 / 大气史诗感",
        },
        "packaging_analysis": {
            "subtitle_font_guess": "思源黑体 Bold",
            "subtitle_color_and_stroke": "白色字+黑色描边",
            "subtitle_position": "bottom",
            "subtitle_animation": "fade_in",
            "subtitle_density": "每秒约2字",
            "title_cards": [{"position_in_timeline": "约19秒处", "content": "北京，下次见", "style": "居中金字放大"}],
            "transitions_used": [
                {"between": "镜头0到镜头1", "type": "cut"},
                {"between": "镜头9到镜头10", "type": "dissolve"},
                {"between": "镜头16到镜头17", "type": "flash_white"},
            ],
            "color_grade": "vivid",
            "color_grade_detail": "高饱和暖色调，突出红墙金瓦与夕阳氛围",
            "stickers_effects": "无贴纸，少量慢动作",
        },
        "hook_strategy": {
            "method": "视觉冲击",
            "detail": "第1秒直接给出故宫角楼日出的金色调航拍画面，镜面倒影形成对称构图，无旁白，纯画面+BGM重拍抓人",
            "effectiveness": "强视觉锤，3秒留存的关键抓手",
            "connection_to_body": "由同一地点切入步行视角，从远及近自然过渡",
        },
        "structure_type": {
            "category": "情绪递进型",
            "reasoning": "从震撼→好奇→治愈→感动，情绪曲线持续走高并在87%处爆发",
            "core_characteristics": "以时间为明线、情绪为暗线；大场景与市井细节交替；高潮后置",
        },
        "key_techniques": [
            "开场即王炸：把全片最美画面放在第1秒",
            "快慢交替：大场景航拍与市井特写交替维持新鲜感",
            "情绪锚点：每3-4个镜头设置一个人物互动瞬间",
            "日落黄金时刻：核心情绪画面集中在蓝调时刻前后拍摄",
            "首尾呼应：以天安门开始，以天安门夜景结束",
        ],
        "narrative_type": "timeline",
        "persona_type": "back_figure",
        "persona_ratio": 0.15,
        "empty_shot_count": 0,
        "overall_emotion": "治愈",
        "overall_summary": "典型情绪递进型旅行Vlog：震撼开场→场景铺展→情绪递进→灯光秀高潮→温暖收尾",
    },
    "raw_shot_analyses": [
        {
            "shot_index": i,
            "start_time": float(i),
            "end_time": float(i + 1) if i < 19 else 19.5,
            "has_face": st == "persona_expression",
            "one_sentence_summary": desc,
            "emotion": emo,
            "structure_role": {"primary_function": st, "confidence": 0.9, "reasoning": "示例标注"},
        }
        for i, (st, emo, desc) in enumerate(SHOT_DEFS)
    ],
}


def get_user(session, username: str | None) -> User:
    if username:
        user = session.exec(select(User).where(User.username == username)).first()
    else:
        user = session.exec(select(User)).first()
    if not user:
        raise SystemExit("用户不存在，请先注册")
    return user


def seed_gene(session: Session, user: User) -> Gene | None:
    if session.exec(select(Gene).where(Gene.title == DEMO_GENE_TITLE, Gene.user_id == user.id)).first():
        print("示例基因已存在，跳过")
        return None
    gene = Gene(title=DEMO_GENE_TITLE, user_id=user.id, status=GeneStatus.DONE)
    session.add(gene)
    session.commit()
    session.refresh(gene)

    gene_dir = STORAGE_ROOT / "users" / str(user.id) / "genes" / str(gene.id)
    gene_dir.mkdir(parents=True, exist_ok=True)
    video_dest = gene_dir / SAMPLE_VIDEO.name
    shutil.copy2(SAMPLE_VIDEO, video_dest)
    report_dest = gene_dir / "report.json"
    report_dest.write_text(json.dumps(DEMO_REPORT, ensure_ascii=False, indent=2), encoding="utf-8")

    meta = DEMO_REPORT["vlog_meta"]
    gene.status = GeneStatus.DONE
    gene.source_filename = SAMPLE_VIDEO.name
    gene.video_path = str(video_dest)
    gene.report_path = str(report_dest)
    gene.duration = DEMO_REPORT["duration"]
    gene.shot_count = DEMO_REPORT["shot_count"]
    gene.structure_type = meta["structure_type"]
    gene.narrative_type = meta["narrative_type"]
    gene.overall_emotion = meta["overall_emotion"]
    gene.hook_method = meta["hook_method"]
    session.add(gene)
    session.commit()
    print(f"示例基因已创建: id={gene.id}")
    return gene


def seed_project_and_work(session: Session, user: User):
    if session.exec(select(Project).where(Project.name == DEMO_PROJECT_NAME, Project.user_id == user.id)).first():
        print("示例项目已存在，跳过")
        return
    project = Project(
        name=DEMO_PROJECT_NAME,
        topic="北京旅行",
        pipeline_mode="editing_transfer",
        user_id=user.id,
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    # 素材：参考视频 + 示例照片（如存在）
    project_dir = STORAGE_ROOT / "users" / str(user.id) / "projects" / str(project.id)
    video_dir = project_dir / "video"
    video_dir.mkdir(parents=True, exist_ok=True)
    vdest = video_dir / SAMPLE_VIDEO.name
    shutil.copy2(SAMPLE_VIDEO, vdest)
    session.add(Material(
        project_id=project.id, type=MaterialType.VIDEO,
        filename=SAMPLE_VIDEO.name, storage_path=str(vdest),
    ))

    sample_photo = REPO_ROOT / "data" / "输入：主题北京" / "beijing_00.jpg"
    if sample_photo.exists():
        img_dir = project_dir / "image"
        img_dir.mkdir(parents=True, exist_ok=True)
        idest = img_dir / sample_photo.name
        shutil.copy2(sample_photo, idest)
        session.add(Material(
            project_id=project.id, type=MaterialType.IMAGE,
            filename=sample_photo.name, storage_path=str(idest),
        ))

    # 成功任务 + 成片
    task = Task(
        project_id=project.id, type=TaskType.END_TO_END,
        status=TaskStatus.SUCCESS, progress=100,
        logs=[{"time": datetime.utcnow().isoformat(), "step": "done", "message": "示例任务：成片来自仓库内置示例"}],
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    task_dir = project_dir / "tasks" / str(task.id)
    task_dir.mkdir(parents=True, exist_ok=True)
    out_dest = task_dir / SAMPLE_OUTPUT.name
    shutil.copy2(SAMPLE_OUTPUT, out_dest)
    task.result_path = str(out_dest)
    session.add(task)
    session.commit()
    print(f"示例项目已创建: id={project.id}, 示例成片任务: id={task.id}")


def main():
    username = sys.argv[1] if len(sys.argv) > 1 else None
    with Session(engine) as session:
        user = get_user(session, username)
        print(f"为用户 {user.username} (id={user.id}) 写入示例数据...")
        seed_gene(session, user)
        seed_project_and_work(session, user)
    print("完成")


if __name__ == "__main__":
    main()
