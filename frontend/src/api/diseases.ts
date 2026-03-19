import { get } from "./client";
import type { DiseaseDetailResponse } from "../types";

export const getDisease = (diseaseId: string): Promise<DiseaseDetailResponse> =>
  get<DiseaseDetailResponse>(`/diseases/${diseaseId}`);
