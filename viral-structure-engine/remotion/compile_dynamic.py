#!/usr/bin/env python3
"""
动态组件编译脚本。

功能：
1. 扫描 remotion/src/dynamic/ 目录下的 .tsx 文件
2. 用 esbuild 编译为 .js
3. 生成 dynamic/index.ts 入口文件（注册所有组件到注册表）

用法：
    python compile_dynamic.py                          # 编译全部
    python compile_dynamic.py watch                    # 监听模式
    python compile_dynamic.py comp_xxx.tsx             # 编译单个
"""

import subprocess
import sys
from pathlib import Path

REMOTION_DIR = Path(__file__).resolve().parent
DYNAMIC_SRC = REMOTION_DIR / "src" / "dynamic"
NODE_MODULES = REMOTION_DIR / "node_modules"


def ensure_dynamic_dir():
    DYNAMIC_SRC.mkdir(parents=True, exist_ok=True)
    init_file = DYNAMIC_SRC / "__init__.py"
    if not init_file.exists():
        init_file.write_text("")


def find_tsx_files() -> list[Path]:
    return sorted(DYNAMIC_SRC.glob("*.tsx"))


def generate_index(tsx_files: list[Path]):
    """生成 dynamic/index.ts，把每个组件导入并注册到 registry"""
    lines = [
        "// 自动生成 — 由 compile_dynamic.py 管理，不要手动编辑",
        'import { registerComponent } from "../components/registry";',
        "",
    ]

    for f in tsx_files:
        stem = f.stem  # 不带后缀的文件名
        lines.append(f'import {{ default as Comp_{stem} }} from "./{stem}";')

    lines.append("")

    for f in tsx_files:
        stem = f.stem
        # comp_xxx → "xxx" 作为注册名
        if stem.startswith("comp_"):
            name = stem.replace("comp_", "", 1)
        else:
            name = stem
        lines.append(
            f'registerComponent("{name}", Comp_{stem} as React.FC<Record<string, unknown>>);'
        )

    lines.append("")

    index_ts = DYNAMIC_SRC / "index.ts"
    index_ts.write_text("\n".join(lines), encoding="utf-8")
    print(f"  -> 生成 {index_ts.relative_to(REMOTION_DIR)} ({len(tsx_files)} 个组件)")


def compile_single(tsx_path: Path) -> bool:
    """用 esbuild 编译单个 .tsx -> .js"""
    if not tsx_path.exists():
        print(f"  文件不存在: {tsx_path}")
        return False

    js_path = tsx_path.with_suffix(".js")

    cmd = [
        "npx.cmd" if sys.platform == "win32" else "npx",
        "esbuild",
        str(tsx_path.resolve()),
        "--bundle",
        f"--outfile={js_path.resolve()}",
        "--format=esm",
        "--platform=browser",
        "--jsx=automatic",
        "--external:remotion",
        "--external:react",
        "--external:react-dom",
        f"--tsconfig={str((REMOTION_DIR / 'tsconfig.json').resolve())}",
    ]

    result = subprocess.run(
        cmd,
        cwd=str(REMOTION_DIR),
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        print(f"  X 编译失败 {tsx_path.name}: {result.stderr[:500]}")
        return False

    print(f"  OK 编译完成: {tsx_path.name} -> {js_path.name}")
    return True


def compile_all():
    ensure_dynamic_dir()
    tsx_files = find_tsx_files()

    if not tsx_files:
        print("没有找到动态组件，跳过编译")
        generate_index([])
        return

    print(f"编译 {len(tsx_files)} 个动态组件...")
    success = 0
    for f in tsx_files:
        if compile_single(f):
            success += 1

    generate_index(tsx_files)
    print(f"完成: {success}/{len(tsx_files)} 编译成功")


def watch():
    """简单监听模式：每次文件变化时重新编译"""
    import time

    known = {f: f.stat().st_mtime for f in find_tsx_files()}
    print(f"监听 {DYNAMIC_SRC} 目录... (Ctrl+C 停止)")

    try:
        while True:
            time.sleep(1)
            current = {f: f.stat().st_mtime for f in find_tsx_files()}
            changed = [f for f in current if f not in known or current[f] != known[f]]
            if changed:
                for f in changed:
                    compile_single(f)
                generate_index(find_tsx_files())
                print("  等待变更...")
            known = current
    except KeyboardInterrupt:
        print("\n停止监听")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "watch":
        watch()
    elif len(sys.argv) > 1:
        compile_single(Path(sys.argv[1]))
    else:
        compile_all()
