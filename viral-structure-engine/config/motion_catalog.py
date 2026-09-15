"""Stable Remotion motion recipes exposed to planning and rendering agents."""

ADVANCED_MOTION_COMPONENTS = {
    "focus_blur_resolve": "焦点由重度模糊收拢到清晰，适合高级感标题和金句",
    "kinetic_warp": "逐字/逐词弹性形变入场，适合开场钩子和高潮文案",
    "mask_reveal_up": "多行文字从遮罩中依次上推揭示，适合章节标题",
    "rgb_glitch_text": "RGB 分色、扫描条和短促抖动，适合强节奏瞬间",
    "broll_stack": "多张素材以卡片堆叠方式连续落入，适合 B-roll 集合",
    "split_screen_burst": "四宫格爆发式展开，适合同时展示多个细节",
    "parallax_photo": "背景与前景分层反向运动，形成 2.5D 景深推镜",
    "polaroid_collage": "多张拍立得卡片错落拼贴，适合旅行和生活回忆",
    "beat_montage": "依据 beat_frames 在素材间硬切并加入击打闪光",
    "hero_push_in": "电影式持续推镜配大标题，适合开头和主视觉",
    "cinematic_grain": "统一电影调色、暗角和动态颗粒，适合情绪镜头",
    "neon_light_rays": "霓虹光束扫过画面，适合城市夜景和科技氛围",
}

ADVANCED_TRANSITIONS = {
    "zoom_through": "高速穿越式缩放并在中心产生高光",
    "liquid_warp": "椭圆形液态形变与柔光扫过",
    "chromatic_aberration": "快速位移配合 RGB 色差分离",
}


def build_motion_catalog_prompt() -> str:
    component_lines = "\n".join(
        f'- "custom:{name}": {description}'
        for name, description in ADVANCED_MOTION_COMPONENTS.items()
    )
    transition_lines = "\n".join(
        f'- "{name}": {description}'
        for name, description in ADVANCED_TRANSITIONS.items()
    )
    return f"""
【高级镜头配方（稳定内置，不需要生成新组件）】
{component_lines}

【高级转场】
{transition_lines}

使用规则：
- 上述 custom:* 均已内置，选择后必须设置 need_new_component=false。
- 多图组件通过 custom_render_config.source_material_ids 传入素材 ID 数组。
- beat_montage 通过 custom_render_config.beat_frames 传入相对本镜头的帧位置，例如 [0, 8, 17, 25]。
- 颜色通过 custom_render_config.accent_color 设置；强度通过 intensity 设置。
- parallax_photo 优先同时填写 source_material_id、fg_source_id 和 composite_mode="fg_overlay"。
- 高级效果用于关键镜头；普通叙事镜头仍应保持克制，避免每镜都堆特效。
""".strip()
