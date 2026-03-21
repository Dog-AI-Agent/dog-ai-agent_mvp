import { Platform } from "react-native";
import { post } from "./client";
import type { BreedRecognitionResponse } from "../types";

const buildFormData = (imageUri: string): FormData => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  if (Platform.OS === "web") {
    // Web: Blob은 호출 시점에 비동기로 처리해야 하므로 별도 처리
  } else {
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type,
    } as unknown as Blob);
  }
  return formData;
};

export const recognizeBreed = async (
  imageUri: string,
): Promise<BreedRecognitionResponse> => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  if (Platform.OS === "web") {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append("file", blob, filename);
  } else {
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type,
    } as unknown as Blob);
  }

  return post<BreedRecognitionResponse>(
    "/ai/breed-recognition",
    formData,
    undefined,
    60000,
  );
};

// 비회원용 품종 인식 (하루 3회 제한)
export const recognizeBreedGuest = async (imageUri: string): Promise<BreedRecognitionResponse> => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  if (Platform.OS === "web") {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append("file", blob, filename);
  } else {
    formData.append("file", { uri: imageUri, name: filename, type } as unknown as Blob);
  }

  return post<BreedRecognitionResponse>("/ai/breed-recognition-guest", formData, undefined, 60000);
};

export const fetchGradcam = async (imageUri: string): Promise<string> => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  if (Platform.OS === "web") {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append("file", blob, filename);
  } else {
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type,
    } as unknown as Blob);
  }

  const res = await post<{ gradcam_image_b64: string }>(
    "/ai/gradcam",
    formData,
    undefined,
    90000,
  );
  return `data:image/png;base64,${res.gradcam_image_b64}`;
};
