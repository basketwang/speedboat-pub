from fastapi import APIRouter

from store import store

router = APIRouter(prefix="/v1", tags=["models"])


@router.get("/models")
async def list_models():
    return {"object": "list", "data": store.models()}
