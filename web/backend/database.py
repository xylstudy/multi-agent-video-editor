from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

from app_config import DB_PATH

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


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _migrate_gene_progress_columns()


def get_session() -> Session:
    with Session(engine) as session:
        yield session
