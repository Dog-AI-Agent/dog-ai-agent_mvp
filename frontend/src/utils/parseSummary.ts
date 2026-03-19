export interface ParsedRecipe {
  name: string;
  ingredients: string;
  reason: string;
  serving: string;
  steps: string[];
}

export interface ParsedSummary {
  message: string;
  recipes: ParsedRecipe[];
}

const stripMarkdown = (text: string): string =>
  text.replace(/\*\*/g, "").replace(/(?<!\w)\*(?!\*)/g, "");

const RECIPE_HEADER_RE = /^#{2,4}\s*(?:추천\s*)?레시피(?:\s*\d+)?[:.]\s*(.+)$/;
const RECIPE_HEADER_NUMBERED_RE = /^#{2,4}\s*(\d+)\.\s*(.+)$/;

type SectionKey = "ingredients" | "reason" | "serving" | "steps" | "none";

const detectSection = (line: string): { key: SectionKey; rest: string } | null => {
  const stripped = line.replace(/^#{1,4}\s*/, "");

  if (/^재료\s*[:/]/.test(stripped))
    return { key: "ingredients", rest: stripped.replace(/^재료\s*[:/]\s*/, "") };
  if (/^추천\s*이유\s*[:/]/.test(stripped))
    return { key: "reason", rest: stripped.replace(/^추천\s*이유\s*[:/]\s*/, "") };
  if (/^급여량\s*[:/]/.test(stripped))
    return { key: "serving", rest: stripped.replace(/^급여량\s*[:/]\s*/, "") };
  if (/^만드는\s*법\s*[:/]/.test(stripped))
    return { key: "steps", rest: stripped.replace(/^만드는\s*법\s*[:/]\s*/, "") };
  return null;
};

const parseRecipeBlock = (lines: string[]): ParsedRecipe => {
  let ingredients = "";
  let reason = "";
  let serving = "";
  const steps: string[] = [];
  let currentSection: SectionKey = "none";
  const reasonLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const section = detectSection(line);
    if (section) {
      if (currentSection === "reason" && reasonLines.length > 0) {
        reason = reasonLines.join(" ");
        reasonLines.length = 0;
      }
      currentSection = section.key;
      if (section.rest) {
        if (currentSection === "ingredients") ingredients = section.rest;
        else if (currentSection === "reason") reasonLines.push(section.rest);
        else if (currentSection === "serving") serving = section.rest;
        else if (currentSection === "steps") {
          const s = section.rest.replace(/^\d+\.\s*/, "").trim();
          if (s) steps.push(s);
        }
      }
      continue;
    }

    const bulletStripped = line.replace(/^[-•]\s*/, "");
    const stepMatch = line.match(/^\d+\.\s*(.+)/);

    switch (currentSection) {
      case "ingredients":
        ingredients = ingredients ? ingredients + ", " + bulletStripped : bulletStripped;
        break;
      case "reason":
        reasonLines.push(bulletStripped);
        break;
      case "serving":
        serving = serving ? serving + " " + bulletStripped : bulletStripped;
        break;
      case "steps":
        if (stepMatch) {
          steps.push(stepMatch[1].trim());
        } else if (line.startsWith("-") || line.startsWith("•")) {
          if (steps.length > 0) steps[steps.length - 1] += " " + bulletStripped;
          else steps.push(bulletStripped);
        } else if (steps.length > 0) {
          steps[steps.length - 1] += " " + line;
        }
        break;
      default:
        break;
    }
  }

  if (currentSection === "reason" && reasonLines.length > 0) {
    reason = reasonLines.join(" ");
  }

  return { name: "", ingredients, reason, serving, steps };
};

export const parseSummary = (raw: string): ParsedSummary => {
  const cleaned = stripMarkdown(raw);
  const lines = cleaned.split("\n");

  const messageLines: string[] = [];
  const recipes: ParsedRecipe[] = [];
  let currentRecipeLines: string[] = [];
  let currentRecipeName = "";
  let foundFirstRecipe = false;

  for (const line of lines) {
    const trimmed = line.trim();

    let recipeName: string | null = null;
    const m1 = trimmed.match(RECIPE_HEADER_RE);
    if (m1) {
      recipeName = m1[1].trim();
    } else {
      const m2 = trimmed.match(RECIPE_HEADER_NUMBERED_RE);
      if (m2) recipeName = m2[2].trim();
    }

    if (recipeName) {
      if (foundFirstRecipe && currentRecipeLines.length > 0) {
        const parsed = parseRecipeBlock(currentRecipeLines);
        parsed.name = currentRecipeName;
        recipes.push(parsed);
      }
      currentRecipeName = recipeName;
      currentRecipeLines = [];
      foundFirstRecipe = true;
      continue;
    }

    if (foundFirstRecipe) {
      currentRecipeLines.push(line);
    } else {
      if (/^#{1,4}\s*추천\s*레시피\s*$/.test(trimmed)) {
        foundFirstRecipe = true;
        continue;
      }
      messageLines.push(line);
    }
  }

  if (foundFirstRecipe && currentRecipeLines.length > 0) {
    const parsed = parseRecipeBlock(currentRecipeLines);
    parsed.name = currentRecipeName;
    recipes.push(parsed);
  }

  const message = messageLines
    .join("\n")
    .replace(/^#{1,4}\s*/gm, "")
    .trim();

  return { message, recipes };
};

// ─── Recipe Detail parser ───

export interface IngredientDetail {
  name: string;
  explanations: string[];
}

export interface ParsedRecipeDetail {
  message: string;
  ingredientDetails: IngredientDetail[];
  closing: string;
}

export const parseRecipeDetail = (raw: string): ParsedRecipeDetail => {
  const cleaned = stripMarkdown(raw);
  const lines = cleaned.split("\n");

  const messageLines: string[] = [];
  const ingredients: IngredientDetail[] = [];
  const closingLines: string[] = [];

  let currentIngredient: IngredientDetail | null = null;
  let phase: "message" | "ingredients" | "closing" = "message";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);

    if (numberedMatch && !line.match(/^(\d+)\.\s+.{60,}/)) {
      if (currentIngredient) ingredients.push(currentIngredient);
      currentIngredient = { name: numberedMatch[2].trim(), explanations: [] };
      phase = "ingredients";
      continue;
    }

    if (phase === "message") {
      if (line) messageLines.push(line);
      continue;
    }

    if (phase === "ingredients" && currentIngredient) {
      if (line.startsWith("-") || line.startsWith("•")) {
        currentIngredient.explanations.push(line.replace(/^[-•]\s*/, "").trim());
        continue;
      }
      if (line && !numberedMatch) {
        ingredients.push(currentIngredient);
        currentIngredient = null;
        phase = "closing";
        closingLines.push(line);
        continue;
      }
    }

    if (phase === "closing" && line) closingLines.push(line);
  }

  if (currentIngredient) ingredients.push(currentIngredient);

  return {
    message: messageLines.join(" ").trim(),
    ingredientDetails: ingredients,
    closing: closingLines.join(" ").trim(),
  };
};
