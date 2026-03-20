/**
 * LLM 요약 마크다운을 섹션 단위로 분리하고 원하는 순서로 재조합합니다.
 *
 * 예) 기본 LLM 출력 순서: 추천 이유 → 재료 → 만드는 법
 *     원하는 순서:        만드는 법 → 추천 이유
 */

interface Section {
  heading: string; // "### 추천 이유" 등 헤더 라인 (없으면 빈 문자열)
  key: string; // 섹션 키워드 (소문자, 공백 제거)
  lines: string[]; // 헤더 이후 본문 라인들
}

/** 마크다운을 ### 기준으로 섹션 배열로 분리 */
export function splitSections(raw: string): Section[] {
  const lines = raw.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,4}\s+(.+)/);
    if (headingMatch) {
      if (current) sections.push(current);
      const title = headingMatch[1].trim();
      current = {
        heading: line,
        key: title.replace(/\s/g, "").toLowerCase(),
        lines: [],
      };
    } else {
      if (current) {
        current.lines.push(line);
      } else {
        // 첫 헤더 이전의 내용 → "intro" 섹션
        if (!sections.length || sections[0].key !== "__intro__") {
          current = { heading: "", key: "__intro__", lines: [line] };
        } else {
          sections[0].lines.push(line);
        }
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** 섹션 배열을 다시 마크다운 문자열로 합치기 */
function joinSections(sections: Section[]): string {
  return sections
    .map((s) =>
      s.heading ? [s.heading, ...s.lines].join("\n") : s.lines.join("\n"),
    )
    .join("\n");
}

/**
 * "만드는 법"을 "추천 이유" 앞으로 이동.
 * 나머지 섹션 순서는 유지.
 */
export function reorderSummary(raw: string): string {
  const sections = splitSections(raw);

  const recipeKeywords = ["만드는법", "조리법", "조리방법", "만들기", "재료"];
  const reasonKeywords = [
    "추천이유",
    "이유",
    "효능",
    "왜추천",
    "한줄소개",
    "소개",
  ];

  const recipeIdx = sections.findIndex((s) =>
    recipeKeywords.some((kw) => s.key.includes(kw)),
  );
  const reasonIdx = sections.findIndex((s) =>
    reasonKeywords.some((kw) => s.key.includes(kw)),
  );

  // 둘 다 있고, 추천이유가 만드는법보다 앞에 있을 때만 스왑
  if (recipeIdx !== -1 && reasonIdx !== -1 && reasonIdx < recipeIdx) {
    const reordered = [...sections];
    const [recipe] = reordered.splice(recipeIdx, 1);
    const newReasonIdx = reordered.findIndex((s) =>
      reasonKeywords.some((kw) => s.key.includes(kw)),
    );
    reordered.splice(newReasonIdx, 0, recipe);
    return joinSections(reordered);
  }

  return raw;
}

/**
 * 요약 텍스트에서 "추천 이유" 섹션만 추출 (intro 포함).
 * RecommendationScreen 요약 카드 전용.
 */
export function extractReasonOnly(raw: string): string {
  const sections = splitSections(raw);
  const reasonKeywords = ["추천이유", "이유", "효능", "왜추천", "__intro__"];

  const reasonSections = sections.filter((s) =>
    reasonKeywords.some((kw) => s.key.includes(kw)),
  );

  if (!reasonSections.length) return raw;
  return joinSections(reasonSections);
}
