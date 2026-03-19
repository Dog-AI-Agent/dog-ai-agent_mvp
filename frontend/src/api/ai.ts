import { Platform } from "react-native";
import { post } from "./client";
import type { BreedRecognitionResponse } from "../types";

export const recognizeBreed = async (imageUri: string): Promise<BreedRecognitionResponse> => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  if (Platform.OS === "web") {
    // Web: convert URI to Blob
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append("file", blob, filename);
  } else {
    // Mobile: RN FormData accepts { uri, name, type }
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type,
    } as unknown as Blob);
  }

  return post<BreedRecognitionResponse>("/ai/breed-recognition", formData, undefined, 60000);
};
