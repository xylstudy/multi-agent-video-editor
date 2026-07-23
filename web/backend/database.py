import json
import re

from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

from app_config import DB_PATH
from vse import VSE_KNOWLEDGE_DB

sqlite_url = f"sqlite:///{DB_PATH}"
engine = create_engine(sqlite_url, echo=False, connect_args={"check_same_thread": False})


def _migrate_gene_progress_columns():
    """为已存在的 gene 表补充进度字段（create_all 不会修改已有表），并回填存量 NULL。"""
    with engine.connect() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(gene)"))}
        if "progress" not in cols:
            conn.execute(text("ALTER TABLE gene ADD COLUMN progress INTEGER DEFAULT 0"))
        if "progress_logs" not in cols:
            conn.execute(text("ALTER TABLE gene ADD COLUMN progress_logs JSON"))
        # 存量行新列是 NULL，会导致 GeneRead 序列化失败，统一回填默认值
        conn.execute(text("UPDATE gene SET progress = 0 WHERE progress IS NULL"))
        conn.execute(text("UPDATE gene SET progress_logs = '[]' WHERE progress_logs IS NULL"))
        conn.commit()


def _migrate_knowledge_ownership():
    """回填存量个人知识的归属：条目 id 形如 k_u{user_id}_{uuid8}（提炼入库时的签发规则）。

    无归属记录的条目视为公共种子，无需插行。幂等：已存在的归属行跳过。
    """
    if not VSE_KNOWLEDGE_DB.exists():
        return
    try:
        entries = json.loads(VSE_KNOWLEDGE_DB.read_text(encoding="utf-8"))
    except Exception:
        return
    pairs = set()
    for e in entries:
        m = re.match(r"^k_u(\d+)_", str(e.get("id", "")))
        if m:
            pairs.add((e["id"], int(m.group(1))))
    if not pairs:
        return
    with engine.connect() as conn:
        existing = {row[0] for row in conn.execute(text("SELECT entry_id FROM knowledgeownership"))}
        for entry_id, user_id in pairs:
            if entry_id in existing:
                continue
            conn.execute(
                text("INSERT INTO knowledgeownership (entry_id, user_id, created_at) VALUES (:eid, :uid, datetime('now'))"),
                {"eid": entry_id, "uid": user_id},
            )
        conn.commit()


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _migrate_gene_progress_columns()
    _migrate_knowledge_ownership()


def get_session() -> Session:
    with Session(engine) as session:
        yield session
