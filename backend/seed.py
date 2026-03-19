"""
DB Seed Script — CSV + JSON → Supabase

Usage:
    python -m backend.seed
"""

import csv
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

BREED_DATA_PATH = BASE_DIR / "ai-service" / "breed" / "breed_data.json"
CSV_PATH = BASE_DIR / "data" / "breed_disease_food_combined_v2.csv"
FOOD_TRANS_PATH = BASE_DIR / "ai-service" / "LLM" / "food_translation.json"
DISEASE_TRANS_PATH = BASE_DIR / "data" / "disease_translation.csv"
INGREDIENT_TRANS_PATH = BASE_DIR / "data" / "ingredient_translation.csv"

BATCH_SIZE = 500


def normalize_breed_model(name: str) -> str:
    """CSV breed_model → DB breed_model 정규화: 소문자 + 하이픈/공백→언더스코어"""
    return name.strip().lower().replace("-", "_").replace(" ", "_")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Connected to Supabase.")

    # ── 1. Load source data ──
    with open(BREED_DATA_PATH, "r", encoding="utf-8") as f:
        breed_data = json.load(f)
    print(f"Loaded {len(breed_data)} breeds from breed_data.json")

    with open(FOOD_TRANS_PATH, "r", encoding="utf-8") as f:
        food_trans = json.load(f)
    print(f"Loaded {len(food_trans)} food translations")

    # Load disease translation (English -> Korean)
    disease_trans = {}
    with open(DISEASE_TRANS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            disease_trans[row["name_en"].strip()] = row["name_ko"].strip()
    print(f"Loaded {len(disease_trans)} disease translations")

    # Load ingredient translation (English -> Korean + category)
    ingredient_trans = {}
    with open(INGREDIENT_TRANS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ingredient_trans[row["name_en"].strip()] = {
                "name_ko": row["name_ko"].strip(),
                "category": row.get("category", "").strip(),
            }
    print(f"Loaded {len(ingredient_trans)} ingredient translations")

    csv_rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_rows.append(row)
    print(f"Loaded {len(csv_rows)} CSV rows")

    # ── 2. Insert breeds ──
    print("\n[1/7] Inserting breeds...")
    breed_records = []
    for b in breed_data:
        breed_model = b["en"].lower().replace(" ", "_")
        breed_records.append({
            "breed_model": breed_model,
            "name_en": b["en"],
            "name_ko": b["ko"],
            "size_category": b.get("size"),
            "synset": b.get("synset"),
        })

    # Upsert in batches
    for i in range(0, len(breed_records), BATCH_SIZE):
        batch = breed_records[i:i + BATCH_SIZE]
        db.table("breeds").upsert(batch, on_conflict="breed_model").execute()
    print(f"  Inserted {len(breed_records)} breeds")

    # Build breed_model -> id map
    all_breeds = db.table("breeds").select("id, breed_model").execute()
    breed_map = {b["breed_model"]: b["id"] for b in all_breeds.data}

    # ── 3. Extract & insert unique diseases ──
    print("\n[2/7] Inserting diseases...")
    unique_diseases = {}
    for row in csv_rows:
        disease = row["disease"].strip()
        if disease and disease not in unique_diseases:
            is_genetic = row.get("genetic_disease", "0") == "1.0" or row.get("genetic_disease", "0") == "1"
            unique_diseases[disease] = {
                "name_en": disease,
                "name_ko": disease_trans.get(disease, disease),
                "is_genetic": is_genetic,
            }

    disease_records = list(unique_diseases.values())
    for i in range(0, len(disease_records), BATCH_SIZE):
        batch = disease_records[i:i + BATCH_SIZE]
        db.table("diseases").upsert(batch, on_conflict="name_en").execute()
    print(f"  Inserted {len(disease_records)} diseases")

    # Build disease name -> id map
    all_diseases = db.table("diseases").select("id, name_en").execute()
    disease_map = {d["name_en"]: d["id"] for d in all_diseases.data}

    # ── 4. Extract & insert unique ingredients ──
    print("\n[3/7] Inserting ingredients...")
    unique_ingredients = set()
    for row in csv_rows:
        ingredients_str = row.get("effective_ingredients", "").strip()
        if ingredients_str:
            for ing in ingredients_str.split(","):
                ing = ing.strip()
                if ing:
                    unique_ingredients.add(ing)

    ingredient_records = [
        {
            "name_en": ing,
            "name_ko": ingredient_trans[ing]["name_ko"] if ing in ingredient_trans else ing,
            "category": ingredient_trans[ing]["category"] if ing in ingredient_trans else None,
        }
        for ing in sorted(unique_ingredients)
    ]
    for i in range(0, len(ingredient_records), BATCH_SIZE):
        batch = ingredient_records[i:i + BATCH_SIZE]
        db.table("ingredients").upsert(batch, on_conflict="name_en").execute()
    print(f"  Inserted {len(ingredient_records)} ingredients")

    # Build ingredient name -> id map
    all_ingredients = db.table("ingredients").select("id, name_en").execute()
    ingredient_map = {ing["name_en"]: ing["id"] for ing in all_ingredients.data}

    # ── 5. Extract & insert unique recipes (foods) ──
    print("\n[4/7] Inserting recipes...")
    unique_foods = set()
    for row in csv_rows:
        food = row.get("food", "").strip()
        if food:
            unique_foods.add(food)

    recipe_records = []
    for food in sorted(unique_foods):
        title_ko = food_trans.get(food, food)
        recipe_records.append({
            "title_en": food,
            "title_ko": title_ko,
        })

    for i in range(0, len(recipe_records), BATCH_SIZE):
        batch = recipe_records[i:i + BATCH_SIZE]
        db.table("recipes").upsert(batch, on_conflict="title_en").execute()
    print(f"  Inserted {len(recipe_records)} recipes")

    # Build recipe title -> id map
    all_recipes = db.table("recipes").select("id, title_en").execute()
    recipe_map = {r["title_en"]: r["id"] for r in all_recipes.data}

    # ── 6. Insert junction tables ──
    print("\n[5/7] Inserting breed_diseases...")
    bd_set = set()
    bd_records = []
    for row in csv_rows:
        breed_model = normalize_breed_model(row["breed_model"])
        disease = row["disease"].strip()
        breed_id = breed_map.get(breed_model)
        disease_id = disease_map.get(disease)
        if breed_id and disease_id and (breed_id, disease_id) not in bd_set:
            bd_set.add((breed_id, disease_id))
            is_genetic = row.get("genetic_disease", "0") in ("1.0", "1")
            bd_records.append({
                "breed_id": breed_id,
                "disease_id": disease_id,
                "risk_level": "high" if is_genetic else "medium",
            })

    for i in range(0, len(bd_records), BATCH_SIZE):
        batch = bd_records[i:i + BATCH_SIZE]
        db.table("breed_diseases").upsert(batch, on_conflict="breed_id,disease_id").execute()
    print(f"  Inserted {len(bd_records)} breed_diseases")

    print("\n[6/7] Inserting disease_ingredients & recipe_diseases & recipe_ingredients...")
    di_set = set()
    di_records = []
    rd_set = set()
    rd_records = []
    ri_records = []

    for row in csv_rows:
        disease = row["disease"].strip()
        food = row.get("food", "").strip()
        ingredients_str = row.get("effective_ingredients", "").strip()
        disease_id = disease_map.get(disease)
        recipe_id = recipe_map.get(food)

        # disease_ingredients
        if disease_id and ingredients_str:
            for idx, ing in enumerate(ingredients_str.split(",")):
                ing = ing.strip()
                ingredient_id = ingredient_map.get(ing)
                if ingredient_id and (disease_id, ingredient_id) not in di_set:
                    di_set.add((disease_id, ingredient_id))
                    di_records.append({
                        "disease_id": disease_id,
                        "ingredient_id": ingredient_id,
                        "priority": max(0, 5 - idx),
                    })

        # recipe_diseases
        if recipe_id and disease_id and (recipe_id, disease_id) not in rd_set:
            rd_set.add((recipe_id, disease_id))
            rd_records.append({
                "recipe_id": recipe_id,
                "disease_id": disease_id,
            })

        # recipe_ingredients
        if recipe_id and ingredients_str:
            for idx, ing in enumerate(ingredients_str.split(",")):
                ing = ing.strip()
                ingredient_id = ingredient_map.get(ing)
                ri_records.append({
                    "recipe_id": recipe_id,
                    "ingredient_id": ingredient_id,
                    "name": ingredient_trans[ing]["name_ko"] if ing in ingredient_trans else ing,
                    "sort_order": idx,
                })

    for i in range(0, len(di_records), BATCH_SIZE):
        batch = di_records[i:i + BATCH_SIZE]
        db.table("disease_ingredients").upsert(batch, on_conflict="disease_id,ingredient_id").execute()
    print(f"  Inserted {len(di_records)} disease_ingredients")

    for i in range(0, len(rd_records), BATCH_SIZE):
        batch = rd_records[i:i + BATCH_SIZE]
        db.table("recipe_diseases").upsert(batch, on_conflict="recipe_id,disease_id").execute()
    print(f"  Inserted {len(rd_records)} recipe_diseases")

    # Deduplicate recipe_ingredients by (recipe_id, name, sort_order)
    ri_seen = set()
    ri_deduped = []
    for ri in ri_records:
        key = (ri["recipe_id"], ri["name"], ri["sort_order"])
        if key not in ri_seen:
            ri_seen.add(key)
            ri_deduped.append(ri)

    # Clear existing recipe_ingredients to prevent duplicates on re-seed
    db.table("recipe_ingredients").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    for i in range(0, len(ri_deduped), BATCH_SIZE):
        batch = ri_deduped[i:i + BATCH_SIZE]
        db.table("recipe_ingredients").insert(batch).execute()
    print(f"  Inserted {len(ri_deduped)} recipe_ingredients")

    print("\n[7/7] Done! All data seeded successfully.")


if __name__ == "__main__":
    main()
