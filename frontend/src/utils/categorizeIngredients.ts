/**
 * 재료명 키워드 기반으로 고기/채소·과일/기타 카테고리 분류
 */
import type { IngredientInDisease } from "../types";

export type IngredientCategory = "meat" | "veggie" | "etc";

const MEAT_KEYWORDS = [
  "소고기", "닭", "오리", "연어", "참치", "고등어", "청어", "돼지", "양고기",
  "소 간", "소간", "소 심장", "소심장", "소 기관지", "소기관지",
  "닭가슴살", "닭 가슴살", "달걀", "계란", "사골", "닭발", "연골",
  "육수", "생선", "새우", "명태", "갈치", "홍합", "오징어", "멸치",
];
const VEGGIE_KEYWORDS = [
  "고구마", "브로콜리", "시금치", "케일", "피망", "당근", "호박", "블루베리",
  "딸기", "사과", "바나나", "수박", "오이", "셀러리", "파슬리", "감자",
  "고추", "토마토", "버섯", "두부", "콩", "렌틸", "병아리콩", "귀리",
  "현미", "보리", "아보카도", "올리브", "파", "양파", "마늘",
  "채소", "과일", "야채",
];

export function categorize(name: string): IngredientCategory {
  const lower = name.toLowerCase();
  if (MEAT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return "meat";
  if (VEGGIE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return "veggie";
  return "etc";
}

export interface CategorizedIngredients {
  meat: IngredientInDisease[];
  veggie: IngredientInDisease[];
  etc: IngredientInDisease[];
}

const MAX_PER_CATEGORY = 4;

export function categorizeIngredients(
  ingredients: IngredientInDisease[]
): CategorizedIngredients {
  const result: CategorizedIngredients = { meat: [], veggie: [], etc: [] };
  for (const ing of ingredients) {
    const cat = categorize(ing.name_ko);
    if (result[cat].length < MAX_PER_CATEGORY) {
      result[cat].push(ing);
    }
  }
  return result;
}

export const CATEGORY_META: Record<
  IngredientCategory,
  { label: string; emoji: string; color: string; bg: string }
> = {
  meat:  { label: "단백질·고기",  emoji: "🥩", color: "#b45309", bg: "#fef3c7" },
  veggie:{ label: "채소·과일",    emoji: "🥦", color: "#15803d", bg: "#f0fdf4" },
  etc:   { label: "기타 영양소",  emoji: "✨", color: "#6d28d9", bg: "#f5f3ff" },
};
