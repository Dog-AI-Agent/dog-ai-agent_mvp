import random


def sample_diseases_by_risk(diseases: list, per_level: int = 2) -> list:
    """
    위험도(risk_level) high/medium/low 각각 최대 per_level개씩 랜덤 샘플링.
    해당 등급에 per_level개 미만이면 있는 만큼만 반환.
    """
    buckets: dict[str, list] = {"high": [], "medium": [], "low": []}

    for d in diseases:
        level = getattr(d, "risk_level", None) or d.get("risk_level", "medium") if isinstance(d, dict) else d.risk_level
        level = level.lower() if level else "medium"
        if level in buckets:
            buckets[level].append(d)
        else:
            buckets["medium"].append(d)

    result = []
    for level in ("high", "medium", "low"):
        pool = buckets[level]
        picked = random.sample(pool, min(per_level, len(pool)))
        result.extend(picked)

    return result
