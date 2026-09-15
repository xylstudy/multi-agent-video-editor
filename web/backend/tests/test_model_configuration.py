from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import model_runtime
from secret_store import decrypt_secret
from db_models import (
    EndpointMode,
    ModelConfigurationCreate,
    ModelConfigurationUpdate,
    ModelPurpose,
    User,
)
from routers import models


def make_session():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)
    session = Session(test_engine)
    user = User(id=1, username="model-user", hashed_password="x")
    session.add(user)
    session.commit()
    return test_engine, session, user


def create_config(session, user, *, provider, name, model_id, vision=False):
    return models.create_model(
        ModelConfigurationCreate(
            provider=provider,
            display_name=name,
            model_id=model_id,
            endpoint_url="https://example.com/v1",
            api_key=f"secret-{provider}-1234",
            supports_vision=vision,
            use_for_vision=vision,
            use_for_text=not vision,
        ),
        current_user=user,
        session=session,
    )


def test_chat_url_supports_base_and_full_modes():
    assert models.build_chat_url(
        "https://example.com/v1/", EndpointMode.BASE_URL
    ) == "https://example.com/v1/chat/completions"
    assert models.build_chat_url(
        "https://gateway.example/chat/completions", EndpointMode.FULL_URL
    ) == "https://gateway.example/chat/completions"


def test_model_reads_never_expose_raw_api_key():
    _, session, user = make_session()
    created = create_config(
        session, user, provider="zhipu", name="Vision", model_id="glm", vision=True
    )

    payload = created.model_dump()
    assert "api_key" not in payload
    assert payload["has_api_key"] is True
    assert payload["masked_api_key"].startswith("sec")
    assert "secret-zhipu-1234" not in str(payload)


def test_defaults_are_unique_and_runtime_uses_selected_models(monkeypatch):
    test_engine, session, user = make_session()
    vision = create_config(
        session, user, provider="zhipu", name="Vision", model_id="vision-v1", vision=True
    )
    text = create_config(
        session, user, provider="deepseek", name="Text", model_id="text-v1", vision=False
    )
    models.set_default_model(
        vision.id, ModelPurpose.TEXT, current_user=user, session=session
    )
    refreshed = models.list_models(current_user=user, session=session)
    assert sum(item.is_default_text for item in refreshed) == 1
    assert next(item for item in refreshed if item.id == vision.id).is_default_text

    models.set_default_model(
        text.id, ModelPurpose.TEXT, current_user=user, session=session
    )
    monkeypatch.setattr(model_runtime, "engine", test_engine)
    runtime = model_runtime.get_user_model_env(user.id)
    assert runtime["VISION_CONFIGURED"] == "1"
    assert runtime["TEXT_CONFIGURED"] == "1"
    assert runtime["VISION_MODEL_ID"] == "vision-v1"
    assert runtime["TEXT_MODEL_ID"] == "text-v1"


def test_blank_key_on_edit_keeps_existing_secret():
    _, session, user = make_session()
    created = create_config(
        session, user, provider="deepseek", name="Text", model_id="text-v1"
    )
    models.update_model(
        created.id,
        ModelConfigurationUpdate(display_name="Renamed", api_key=""),
        current_user=user,
        session=session,
    )
    stored = models._owned_config(session, user.id, created.id)
    assert stored.display_name == "Renamed"
    assert stored.api_key != "secret-deepseek-1234"
    assert decrypt_secret(stored.api_key) == "secret-deepseek-1234"
