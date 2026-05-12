from fastapi import APIRouter

from store import store

router = APIRouter(prefix="/v1", tags=["gpu-types"])


@router.get("/gpu-types")
async def list_gpu_types():
    return {"object": "list", "data": store.gpu_types()}
