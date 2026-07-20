from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from db_models import ApiKey, ApiKeyCreate, ApiKeyRead, Provider, User

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyRead])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    keys = session.exec(select(ApiKey).where(ApiKey.user_id == current_user.id)).all()
    return [
        ApiKeyRead(
            id=k.id,
            provider=k.provider,
            is_user_provided=k.is_user_provided,
            created_at=k.created_at,
        )
        for k in keys
    ]


@router.post("", response_model=ApiKeyRead, status_code=status.HTTP_201_CREATED)
def create_or_update_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.provider == key_in.provider,
        )
    ).first()
    if existing:
        existing.key_value = key_in.key_value
        existing.is_user_provided = True
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return ApiKeyRead(
            id=existing.id,
            provider=existing.provider,
            is_user_provided=existing.is_user_provided,
            created_at=existing.created_at,
        )

    key = ApiKey(
        user_id=current_user.id,
        provider=key_in.provider,
        key_value=key_in.key_value,
        is_user_provided=True,
    )
    session.add(key)
    session.commit()
    session.refresh(key)
    return ApiKeyRead(
        id=key.id,
        provider=key.provider,
        is_user_provided=key.is_user_provided,
        created_at=key.created_at,
    )


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(
    provider: Provider,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    key = session.exec(
        select(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.provider == provider,
        )
    ).first()
    if key:
        session.delete(key)
        session.commit()
    return None
