import { get, put, post, patch } from "./client";
import { getAuthToken } from "./tokenStore";
import type { AuthUser } from "../context/AuthContext";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface DogInfo {
  dog_id: string;
  user_id: string;
  name: string;
  birthday?: string | null;
  breed_id?: string | null;
  breed_name_ko?: string | null;
  favorite_ingredients: string[];
  created_at: string;
}

export interface AnalysisHistoryItem {
  history_id: string;
  breed_id?: string | null;
  breed_name_ko: string;
  breed_name_en?: string | null;
  confidence?: number | null;
  is_mixed_breed: boolean;
  image_url?: string | null;
  illustration_url?: string | null;
  is_pinned: boolean;
  created_at: string;
}

export interface UserUpdatePayload {
  name?: string;
  nickname?: string;
  birth_date?: string;
  address?: string;
}

export interface DogPayload {
  name: string;
  birthday?: string;
  breed_id?: string;
  favorite_ingredients?: string[];
}

export const getMe = (): Promise<AuthUser> => get<AuthUser>("/users/me");

export const updateMe = (payload: UserUpdatePayload): Promise<AuthUser> =>
  put<AuthUser>("/users/me", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });

export const getMyDog = (): Promise<DogInfo | null> =>
  get<DogInfo | null>("/users/me/dog");

export const createMyDog = (payload: DogPayload): Promise<DogInfo> =>
  post<DogInfo>("/users/me/dog", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });

export const updateMyDog = (payload: Partial<DogPayload>): Promise<DogInfo> =>
  put<DogInfo>("/users/me/dog", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });

// ── 분석 히스토리 저장 (multipart) ──
export const saveAnalysis = async (data: {
  breed_id?: string | null;
  breed_name_ko: string;
  breed_name_en?: string;
  confidence?: number;
  is_mixed_breed?: boolean;
  imageUri?: string | null;
}): Promise<AnalysisHistoryItem> => {
  const token = getAuthToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const formData = new FormData();
  formData.append("breed_name_ko", data.breed_name_ko);
  if (data.breed_id) formData.append("breed_id", data.breed_id);
  if (data.breed_name_en) formData.append("breed_name_en", data.breed_name_en);
  if (data.confidence != null)
    formData.append("confidence", String(data.confidence));
  formData.append("is_mixed_breed", String(data.is_mixed_breed ?? false));

  if (data.imageUri) {
    if (data.imageUri.startsWith("data:")) {
      // 웹: base64 data URL → Blob 변환
      const fetchRes = await fetch(data.imageUri);
      const blob = await fetchRes.blob();
      formData.append("image", blob, "dog.jpg");
    } else {
      // 네이티브: React Native FormData 형식
      formData.append("image", {
        uri: data.imageUri,
        type: "image/jpeg",
        name: "dog.jpg",
      } as any);
    }
  }

  const res = await fetch(`${BASE_URL}/users/me/analyses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── 분석 히스토리 조회 ──
export const getAnalyses = (): Promise<AnalysisHistoryItem[]> =>
  get<AnalysisHistoryItem[]>("/users/me/analyses");

// ── 일러스트 생성 ──
export const generateIllustration = (
  analysisId: string,
): Promise<{ illustration_url: string }> =>
  post<{ illustration_url: string }>(
    `/users/me/analyses/${analysisId}/illustration`,
    "",
    { "Content-Type": "application/json" },
    60000,
  );

// ── My Dog 핀 토글 ──
export const togglePin = (historyId: string): Promise<AnalysisHistoryItem> =>
  patch<AnalysisHistoryItem>(`/users/me/analyses/${historyId}/pin`);

// ── 분석 히스토리 선택 삭제 (POST 방식) ──
export const deleteAnalyses = (
  historyIds: string[],
): Promise<{ deleted: number }> =>
  post<{ deleted: number }>(
    "/users/me/analyses/delete",
    JSON.stringify({ history_ids: historyIds }),
    { "Content-Type": "application/json" },
  );
