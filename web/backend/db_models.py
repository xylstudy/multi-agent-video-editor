import enum
import json
from datetime import datetime
from typing import Optional

from pydantic import field_validator
from sqlmodel import Field, Relationship, SQLModel, Column
from sqlalchemy import String, DateTime, Text, JSON


class PipelineMode(str, enum.Enum):
    EDITING_TRANSFER = "editing_transfer"
    AGENT_PIPELINE = "agent_pipeline"


class TaskType(str, enum.Enum):
    END_TO_END = "end_to_end"
    ANALYZE_VIDEO = "analyze_video"
    MATERIAL_ANALYSIS = "material_analysis"
    GENERATE_SCHEME = "generate_scheme"
    RENDER = "render"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Provider(str, enum.Enum):
    DEEPSEEK = "deepseek"
    ZHIPU = "zhipu"
    MOONSHOT = "moonshot"
    ALIYUN = "aliyun"


class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    email: Optional[str] = Field(default=None, index=True)


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    projects: list["Project"] = Relationship(back_populates="user")
    api_keys: list["ApiKey"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    created_at: datetime


class ApiKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    provider: Provider
    key_value: str
    is_user_provided: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="api_keys")


class ApiKeyCreate(SQLModel):
    provider: Provider
    key_value: str


class ApiKeyRead(SQLModel):
    id: int
    provider: Provider
    is_user_provided: bool
    created_at: datetime


class ProjectBase(SQLModel):
    name: str
    topic: str = Field(default="")
    pipeline_mode: PipelineMode = Field(default=PipelineMode.EDITING_TRANSFER)


class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    status: str = Field(default="idle")  # idle / running / etc.
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="projects")
    materials: list["Material"] = Relationship(back_populates="project")
    tasks: list["Task"] = Relationship(back_populates="project")


class ProjectCreate(ProjectBase):
    gene_id: Optional[int] = None  # 从基因库选择参考视频时传入


class ProjectRead(ProjectBase):
    id: int
    user_id: int
    status: str
    created_at: datetime


class MaterialType(str, enum.Enum):
    VIDEO = "video"
    IMAGE = "image"
    AUDIO = "audio"


class Material(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    type: MaterialType
    filename: str
    storage_path: str
    metadata_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Project = Relationship(back_populates="materials")

    def get_metadata(self) -> dict:
        if self.metadata_json:
            return json.loads(self.metadata_json)
        return {}

    def set_metadata(self, data: dict):
        self.metadata_json = json.dumps(data, ensure_ascii=False)


class MaterialRead(SQLModel):
    id: int
    project_id: int
    type: MaterialType
    filename: str
    meta: dict
    created_at: datetime


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    type: TaskType
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    progress: int = Field(default=0)
    logs: list = Field(default_factory=list, sa_column=Column(JSON))
    result_path: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    project: Project = Relationship(back_populates="tasks")


class TaskCreate(SQLModel):
    type: TaskType


class TaskRead(SQLModel):
    id: int
    project_id: int
    type: TaskType
    status: TaskStatus
    progress: int
    logs: list
    result_path: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime


class TaskProgressEvent(SQLModel):
    type: str  # "log" | "progress" | "status"
    data: dict


class GeneStatus(str, enum.Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    DONE = "done"
    FAILED = "failed"


class Gene(SQLModel, table=True):
    """视频基因：一条爆款参考视频 + 它的完整结构分析报告。"""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    status: GeneStatus = Field(default=GeneStatus.PENDING)
    source_filename: str = ""
    video_path: str = ""  # 存储的参考视频副本
    report_path: str = ""  # analysis_result.json 路径
    error_message: Optional[str] = None
    progress: int = Field(default=0)  # 提取进度 0-100
    progress_logs: list = Field(default_factory=list, sa_column=Column(JSON))  # 提取过程事件日志

    # 摘要字段（报告解析后填充，供列表卡片展示）
    duration: float = 0.0
    shot_count: int = 0
    structure_type: str = ""
    narrative_type: str = ""
    overall_emotion: str = ""
    hook_method: str = ""

    created_at: datetime = Field(default_factory=datetime.utcnow)


class GeneRead(SQLModel):
    id: int
    title: str
    status: GeneStatus
    source_filename: str
    duration: float
    shot_count: int
    structure_type: str
    narrative_type: str
    overall_emotion: str
    hook_method: str
    error_message: Optional[str]
    progress: int
    progress_logs: list
    created_at: datetime

    @field_validator("progress", "progress_logs", mode="before")
    @classmethod
    def _none_to_default(cls, v, info):
        # 历史行新列可能是 NULL，兜底为默认值，避免整列序列化 500
        if v is None:
            return [] if info.field_name == "progress_logs" else 0
        return v
