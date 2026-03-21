"""
Community API — 커뮤니티 게시판 (레시피 공유, Q&A, 자유)
"""
import json
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from backend.database import get_supabase, get_storage_supabase
from backend.deps import get_current_user_id
from backend.models.schemas import (
    CommentCreate,
    CommentResponse,
    CommunityImageResponse,
    CommunityPostCreate,
    CommunityPostListResponse,
    CommunityPostResponse,
    CommunityPostUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["community"])

VALID_CATEGORIES = {"recipe", "general_qna", "health_qna", "free"}
VALID_SORT_FIELDS = {"latest": "created_at", "popular": "like_count"}
MAX_IMAGES = 5


# ── 헬퍼 ──

def _build_post_response(post: dict, images: list[CommunityImageResponse], is_liked: bool) -> CommunityPostResponse:
    return CommunityPostResponse(
        post_id=post["id"],
        user_id=post["user_id"],
        nickname=post["users"]["nickname"] if isinstance(post.get("users"), dict) else "",
        category=post["category"],
        title=post["title"],
        content=post["content"],
        recipe_data=post.get("recipe_data"),
        images=images,
        view_count=post.get("view_count", 0),
        like_count=post.get("like_count", 0),
        comment_count=post.get("comment_count", 0),
        is_liked=is_liked,
        created_at=post["created_at"],
        updated_at=post["updated_at"],
    )


async def _get_images_for_post(db, post_id: str) -> list[CommunityImageResponse]:
    result = await run_in_threadpool(
        lambda: db.table("community_post_images")
        .select("id, image_url")
        .eq("post_id", post_id)
        .order("display_order")
        .execute()
    )
    return [CommunityImageResponse(id=r["id"], image_url=r["image_url"]) for r in (result.data or [])]


async def _check_user_liked(db, post_id: str, user_id: str) -> bool:
    result = await run_in_threadpool(
        lambda: db.table("community_likes")
        .select("id")
        .eq("post_id", post_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


# ── 게시글 목록 조회 ──

@router.get("/posts", response_model=CommunityPostListResponse)
async def list_posts(
    user_id: str = Depends(get_current_user_id),
    category: str | None = Query(None),
    sort: str = Query("latest"),
    q: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="유효하지 않은 카테고리입니다.")

    sort_field = VALID_SORT_FIELDS.get(sort, "created_at")
    db = get_supabase()

    # 게시글 쿼리
    query = db.table("community_posts").select("*, users(nickname)", count="exact")
    if category:
        query = query.eq("category", category)
    if q:
        query = query.or_(f"title.ilike.%{q}%,content.ilike.%{q}%")
    query = query.order(sort_field, desc=True).range(offset, offset + limit - 1)

    result = await run_in_threadpool(lambda: query.execute())
    posts = result.data or []
    total = result.count or 0

    # 현재 유저의 좋아요 여부 일괄 조회
    post_ids = [p["id"] for p in posts]
    liked_set: set[str] = set()
    if post_ids:
        likes_result = await run_in_threadpool(
            lambda: db.table("community_likes")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
            .execute()
        )
        liked_set = {r["post_id"] for r in (likes_result.data or [])}

    # 이미지 일괄 조회
    images_map: dict[str, list[CommunityImageResponse]] = {pid: [] for pid in post_ids}
    if post_ids:
        imgs_result = await run_in_threadpool(
            lambda: db.table("community_post_images")
            .select("id, post_id, image_url")
            .in_("post_id", post_ids)
            .order("display_order")
            .execute()
        )
        for img in (imgs_result.data or []):
            images_map.setdefault(img["post_id"], []).append(
                CommunityImageResponse(id=img["id"], image_url=img["image_url"])
            )

    page = (offset // limit) + 1
    return CommunityPostListResponse(
        posts=[
            _build_post_response(p, images_map.get(p["id"], []), p["id"] in liked_set)
            for p in posts
        ],
        total=total,
        page=page,
        limit=limit,
    )


# ── 게시글 작성 ──

@router.post("/posts", response_model=CommunityPostResponse)
async def create_post(
    body: CommunityPostCreate,
    user_id: str = Depends(get_current_user_id),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="유효하지 않은 카테고리입니다.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력해주세요.")

    db = get_supabase()

    insert_data = {
        "user_id": user_id,
        "category": body.category,
        "title": body.title.strip(),
        "content": body.content.strip(),
    }
    if body.category == "recipe" and body.recipe_data:
        insert_data["recipe_data"] = body.recipe_data.model_dump()

    result = await run_in_threadpool(
        lambda: db.table("community_posts").insert(insert_data).execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="게시글 작성에 실패했습니다.")

    post = result.data[0]

    # 닉네임 조회
    user_result = await run_in_threadpool(
        lambda: db.table("users").select("nickname").eq("id", user_id).limit(1).execute()
    )
    nickname = user_result.data[0]["nickname"] if user_result.data else ""
    post["users"] = {"nickname": nickname}

    return _build_post_response(post, [], False)


# ── 게시글 이미지 업로드 ──

COMMUNITY_BUCKET = "community"


@router.post("/posts/{post_id}/images")
async def upload_post_images(
    post_id: str,
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 게시글 존재 + 본인 확인
    post_result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, user_id")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post_result.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 게시글만 수정할 수 있습니다.")

    # 기존 이미지 수 확인
    existing = await run_in_threadpool(
        lambda: db.table("community_post_images")
        .select("id", count="exact")
        .eq("post_id", post_id)
        .execute()
    )
    existing_count = existing.count or 0
    if existing_count + len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"이미지는 최대 {MAX_IMAGES}장까지 가능합니다. (현재 {existing_count}장)",
        )

    storage = get_storage_supabase()
    uploaded_urls: list[str] = []

    for i, file in enumerate(files):
        file_bytes = await file.read()
        ext = (file.filename or "image.jpg").rsplit(".", 1)[-1] or "jpg"
        storage_path = f"{post_id}/{uuid.uuid4().hex}.{ext}"
        content_type = file.content_type or "image/jpeg"

        # Supabase Storage 업로드
        await run_in_threadpool(
            lambda path=storage_path, data=file_bytes, ct=content_type: storage.storage.from_(
                COMMUNITY_BUCKET
            ).upload(path=path, file=data, file_options={"content-type": ct})
        )

        public_url = storage.storage.from_(COMMUNITY_BUCKET).get_public_url(storage_path)
        uploaded_urls.append(public_url)

    # DB에 이미지 레코드 삽입
    rows = [
        {"post_id": post_id, "image_url": url, "display_order": existing_count + i}
        for i, url in enumerate(uploaded_urls)
    ]
    await run_in_threadpool(
        lambda: db.table("community_post_images").insert(rows).execute()
    )

    return {"message": f"{len(uploaded_urls)}장의 이미지가 추가되었습니다.", "urls": uploaded_urls}


# ── 게시글 이미지 삭제 ──

@router.delete("/posts/{post_id}/images/{image_id}")
async def delete_post_image(
    post_id: str,
    image_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 게시글 본인 확인
    post_result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, user_id")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if post_result.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 게시글만 수정할 수 있습니다.")

    # 이미지 레코드 조회
    img_result = await run_in_threadpool(
        lambda: db.table("community_post_images")
        .select("id, image_url")
        .eq("id", image_id)
        .eq("post_id", post_id)
        .limit(1)
        .execute()
    )
    if not img_result.data:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    # Storage에서 삭제 시도
    image_url = img_result.data[0]["image_url"]
    try:
        # URL에서 storage path 추출: .../community/post_id/filename.ext
        path_part = image_url.split(f"/{COMMUNITY_BUCKET}/")[1] if f"/{COMMUNITY_BUCKET}/" in image_url else None
        if path_part:
            storage = get_storage_supabase()
            storage.storage.from_(COMMUNITY_BUCKET).remove([path_part])
    except Exception as e:
        logger.warning(f"Storage 이미지 삭제 실패: {e}")

    # DB 레코드 삭제
    await run_in_threadpool(
        lambda: db.table("community_post_images").delete().eq("id", image_id).execute()
    )

    return {"message": "이미지가 삭제되었습니다."}


# ── 게시글 상세 조회 ──

@router.get("/posts/{post_id}", response_model=CommunityPostResponse)
async def get_post(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 조회수 +1
    await run_in_threadpool(
        lambda: db.rpc("increment_view_count", {"p_post_id": post_id}).execute()
    )

    result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("*, users(nickname)")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    post = result.data[0]
    images = await _get_images_for_post(db, post_id)
    is_liked = await _check_user_liked(db, post_id, user_id)

    return _build_post_response(post, images, is_liked)


# ── 게시글 수정 ──

@router.put("/posts/{post_id}", response_model=CommunityPostResponse)
async def update_post(
    post_id: str,
    body: CommunityPostUpdate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 본인 확인
    existing = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, user_id, category")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 게시글만 수정할 수 있습니다.")

    update_data: dict = {}
    if body.title is not None:
        update_data["title"] = body.title.strip()
    if body.content is not None:
        update_data["content"] = body.content.strip()
    if body.recipe_data is not None and existing.data[0]["category"] == "recipe":
        update_data["recipe_data"] = body.recipe_data.model_dump()

    if not update_data:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")

    result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .update(update_data)
        .eq("id", post_id)
        .execute()
    )

    # 수정된 게시글 반환
    updated = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("*, users(nickname)")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    post = updated.data[0]
    images = await _get_images_for_post(db, post_id)
    is_liked = await _check_user_liked(db, post_id, user_id)

    return _build_post_response(post, images, is_liked)


# ── 게시글 삭제 ──

@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    existing = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, user_id")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 게시글만 삭제할 수 있습니다.")

    await run_in_threadpool(
        lambda: db.table("community_posts").delete().eq("id", post_id).execute()
    )

    return {"message": "게시글이 삭제되었습니다."}


# ── 좋아요 토글 ──

@router.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 게시글 존재 확인
    post_result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, like_count")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    # 좋아요 존재 확인
    like_result = await run_in_threadpool(
        lambda: db.table("community_likes")
        .select("id")
        .eq("post_id", post_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    current_count = post_result.data[0].get("like_count", 0)

    if like_result.data:
        # 좋아요 취소
        await run_in_threadpool(
            lambda: db.table("community_likes")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        new_count = max(0, current_count - 1)
        await run_in_threadpool(
            lambda: db.table("community_posts")
            .update({"like_count": new_count})
            .eq("id", post_id)
            .execute()
        )
        return {"liked": False, "like_count": new_count}
    else:
        # 좋아요 추가
        await run_in_threadpool(
            lambda: db.table("community_likes")
            .insert({"post_id": post_id, "user_id": user_id})
            .execute()
        )
        new_count = current_count + 1
        await run_in_threadpool(
            lambda: db.table("community_posts")
            .update({"like_count": new_count})
            .eq("id", post_id)
            .execute()
        )
        return {"liked": True, "like_count": new_count}


# ── 댓글 목록 ──

@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    result = await run_in_threadpool(
        lambda: db.table("community_comments")
        .select("*, users(nickname)")
        .eq("post_id", post_id)
        .order("created_at")
        .execute()
    )

    return [
        CommentResponse(
            comment_id=c["id"],
            user_id=c["user_id"],
            nickname=c["users"]["nickname"] if isinstance(c.get("users"), dict) else "",
            content=c["content"],
            created_at=c["created_at"],
        )
        for c in (result.data or [])
    ]


# ── 댓글 작성 ──

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: str,
    body: CommentCreate,
    user_id: str = Depends(get_current_user_id),
):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해주세요.")

    db = get_supabase()

    # 게시글 존재 확인
    post_result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("id, comment_count")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not post_result.data:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    # 댓글 삽입
    result = await run_in_threadpool(
        lambda: db.table("community_comments")
        .insert({"post_id": post_id, "user_id": user_id, "content": body.content.strip()})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="댓글 작성에 실패했습니다.")

    # comment_count +1
    new_count = post_result.data[0].get("comment_count", 0) + 1
    await run_in_threadpool(
        lambda: db.table("community_posts")
        .update({"comment_count": new_count})
        .eq("id", post_id)
        .execute()
    )

    # 닉네임 조회
    user_result = await run_in_threadpool(
        lambda: db.table("users").select("nickname").eq("id", user_id).limit(1).execute()
    )
    nickname = user_result.data[0]["nickname"] if user_result.data else ""

    comment = result.data[0]
    return CommentResponse(
        comment_id=comment["id"],
        user_id=comment["user_id"],
        nickname=nickname,
        content=comment["content"],
        created_at=comment["created_at"],
    )


# ── 댓글 삭제 ──

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # 댓글 존재 + 본인 확인
    existing = await run_in_threadpool(
        lambda: db.table("community_comments")
        .select("id, user_id, post_id")
        .eq("id", comment_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 댓글만 삭제할 수 있습니다.")

    post_id = existing.data[0]["post_id"]

    await run_in_threadpool(
        lambda: db.table("community_comments").delete().eq("id", comment_id).execute()
    )

    # comment_count -1
    post_result = await run_in_threadpool(
        lambda: db.table("community_posts")
        .select("comment_count")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if post_result.data:
        new_count = max(0, post_result.data[0].get("comment_count", 0) - 1)
        await run_in_threadpool(
            lambda: db.table("community_posts")
            .update({"comment_count": new_count})
            .eq("id", post_id)
            .execute()
        )

    return {"message": "댓글이 삭제되었습니다."}
