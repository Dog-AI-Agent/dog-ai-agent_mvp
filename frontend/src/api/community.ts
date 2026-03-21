import { Platform } from "react-native";
import { get, post, put, del } from "./client";
import type {
  CommunityPost,
  CommunityPostListResponse,
  CommunityComment,
  CommunityCategory,
} from "../types";

export const getPosts = (
  category?: CommunityCategory,
  sort: "latest" | "popular" = "latest",
  q?: string,
  limit = 20,
  offset = 0,
): Promise<CommunityPostListResponse> =>
  get<CommunityPostListResponse>("/community/posts", {
    category,
    sort,
    q,
    limit,
    offset,
  });

export const createPost = (data: {
  category: CommunityCategory;
  title: string;
  content: string;
  recipe_data?: {
    ingredients: { name: string; amount: string }[];
    steps: string[];
  } | null;
}): Promise<CommunityPost> =>
  post<CommunityPost>("/community/posts", JSON.stringify(data), {
    "Content-Type": "application/json",
  });

export const uploadPostImages = async (
  postId: string,
  imageUris: string[],
): Promise<{ message: string; urls: string[] }> => {
  const formData = new FormData();

  for (const uri of imageUris) {
    const filename = uri.split("/").pop() || "photo.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    if (Platform.OS === "web") {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append("files", blob, filename);
    } else {
      formData.append("files", {
        uri,
        name: filename,
        type,
      } as unknown as Blob);
    }
  }

  return post<{ message: string; urls: string[] }>(
    `/community/posts/${postId}/images`,
    formData,
    undefined,
    60000,
  );
};

export const deletePostImage = (
  postId: string,
  imageId: string,
): Promise<void> => del<void>(`/community/posts/${postId}/images/${imageId}`);

export const getPost = (postId: string): Promise<CommunityPost> =>
  get<CommunityPost>(`/community/posts/${postId}`);

export const updatePost = (
  postId: string,
  data: {
    title?: string;
    content?: string;
    recipe_data?: {
      ingredients: { name: string; amount: string }[];
      steps: string[];
    } | null;
  },
): Promise<CommunityPost> =>
  put<CommunityPost>(`/community/posts/${postId}`, JSON.stringify(data), {
    "Content-Type": "application/json",
  });

export const deletePost = (postId: string): Promise<void> =>
  del<void>(`/community/posts/${postId}`);

export const toggleLike = (
  postId: string,
): Promise<{ liked: boolean; like_count: number }> =>
  post<{ liked: boolean; like_count: number }>(
    `/community/posts/${postId}/like`,
    "",
  );

export const getComments = (postId: string): Promise<CommunityComment[]> =>
  get<CommunityComment[]>(`/community/posts/${postId}/comments`);

export const createComment = (
  postId: string,
  content: string,
): Promise<CommunityComment> =>
  post<CommunityComment>(
    `/community/posts/${postId}/comments`,
    JSON.stringify({ content }),
    { "Content-Type": "application/json" },
  );

export const deleteComment = (commentId: string): Promise<void> =>
  del<void>(`/community/comments/${commentId}`);
