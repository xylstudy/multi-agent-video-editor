import asyncio
from pathlib import Path

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import chat_service
from db_models import (
    ChatAction,
    ChatAttachment,
    ChatSession,
    Material,
    MaterialType,
    Project,
    Task,
    User,
)
from routers import tasks


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    session = Session(engine)
    user = User(username="chat-user", hashed_password="x")
    session.add(user)
    session.commit()
    session.refresh(user)
    chat = ChatSession(user_id=user.id)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return session, user, chat


def test_chat_lists_only_owned_projects():
    session, user, chat = make_session()
    session.add(Project(name="我的项目", user_id=user.id))
    other = User(username="other-chat-user", hashed_password="x")
    session.add(other)
    session.commit()
    session.add(Project(name="别人的项目", user_id=other.id))
    session.commit()

    result = asyncio.run(chat_service.handle_message(session, user, chat, "有哪些项目"))

    assert "我的项目" in result["assistant_message"]["content"]
    assert "别人的项目" not in result["assistant_message"]["content"]
    assert len(session.exec(select(ChatAction)).all()) == 0


def test_chat_starts_owned_task_from_project_context(monkeypatch):
    session, user, chat = make_session()
    project = Project(name="夜游项目", user_id=user.id)
    session.add(project)
    session.commit()
    session.refresh(project)
    session.add_all([
        Material(
            project_id=project.id,
            type=MaterialType.VIDEO,
            filename="reference.mp4",
            storage_path="reference.mp4",
        ),
        Material(
            project_id=project.id,
            type=MaterialType.IMAGE,
            filename="photo.jpg",
            storage_path="photo.jpg",
        ),
    ])
    session.commit()
    queued = []
    monkeypatch.setattr(tasks.queue, "enqueue", lambda *args: queued.append(args))

    result = asyncio.run(
        chat_service.handle_message(
            session,
            user,
            chat,
            "生成分镜方案",
            {"route": f"/projects/{project.id}"},
        )
    )

    task = session.exec(select(Task)).one()
    assert task.project_id == project.id
    assert queued == [(task.id, project.id, user.id)]
    assert result["assistant_message"]["metadata"]["task_id"] == task.id
    assert result["action"]["status"] == "queued"


def test_chat_upload_video_creates_gene(monkeypatch):
    session, user, chat = make_session()
    source = Path(__file__).resolve().parent / ".chat-test-reference.mp4"
    source.write_bytes(b"fake video")
    attachment = ChatAttachment(
        session_id=chat.id,
        user_id=user.id,
        filename=source.name,
        media_type="video",
        storage_path=str(source),
    )
    session.add(attachment)
    session.commit()
    session.refresh(attachment)
    monkeypatch.setattr("gene_worker.start_gene_extraction", lambda *args: None)

    try:
        result = asyncio.run(
            chat_service.handle_message(
                session,
                user,
                chat,
                "analyze this video",
                {"attachment_ids": [attachment.id]},
            )
        )
    finally:
        source.unlink(missing_ok=True)

    gene = session.exec(select(chat_service.Gene)).one()
    assert gene.source_filename == source.name
    assert result["assistant_message"]["metadata"]["gene_id"] == gene.id
    assert session.get(ChatAttachment, attachment.id).status == "used"


def test_chat_asks_to_disambiguate_multiple_projects():
    session, user, chat = make_session()
    session.add_all([
        Project(name="项目 A", user_id=user.id),
        Project(name="项目 B", user_id=user.id),
    ])
    session.commit()

    result = asyncio.run(chat_service.handle_message(session, user, chat, "分析参考视频"))

    content = result["assistant_message"]["content"]
    assert "多个项目" in content
    assert "项目 A" in content
    assert "项目 B" in content
