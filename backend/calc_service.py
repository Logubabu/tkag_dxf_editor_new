import math

STRESS_LIMIT_MPA = 3.5
PREFERRED_SPACING = [300, 275, 250, 225, 200, 175, 150, 125, 100]


def calculate_stresses(entity: dict) -> dict:
    """Calculate section stresses once; reinforcement edits must not call this."""
    width = max(float(entity.get("beamWidth", 1000)), 1.0)
    depth = max(float(entity.get("beamDepth", entity.get("ptSlabDepth", 200))), 1.0)
    moment = max(float(entity.get("appliedMoment", 100)), 0.0)  # kNm
    section_modulus = width * depth * depth / 6.0  # mm³, rectangular section
    stress = moment * 1_000_000 / section_modulus if section_modulus else 0.0
    entity["topStress"] = round(stress, 4)
    entity["bottomStress"] = round(stress, 4)
    entity["stressPassFail"] = stress <= STRESS_LIMIT_MPA
    entity["stressStatus"] = "PASS" if entity["stressPassFail"] else "FAIL"
    return entity


def recalculate_reinforcement(entity: dict, auto_correct: bool = False) -> dict:
    """Recalculate reinforcement only; top and bottom stresses are preserved."""
    width = max(float(entity.get("beamWidth", 1000)), 1.0)
    effective_depth = max(float(entity.get("effDepth", 175)), 1.0)
    moment = max(float(entity.get("appliedMoment", 100)), 0.0)
    diameter = max(float(entity.get("barDiameter", entity.get("inputDiameterOfBar", 12))), 1.0)
    spacing = max(float(entity.get("spacing", 200)), 1.0)

    ast_required = moment * 1_000_000 / (0.87 * 500 * 0.85 * effective_depth)
    bar_area = math.pi * diameter ** 2 / 4.0

    # A stress failure triggers an automatic adjustment to 100 mm or the
    # closest standard spacing that provides the required reinforcement.
    if auto_correct and not entity.get("stressPassFail", False):
        suitable = []
        for candidate in PREFERRED_SPACING:
            bars = max(1, math.ceil(width / candidate))
            if bars * bar_area >= ast_required:
                suitable.append(candidate)
        spacing = min(suitable, key=lambda value: abs(value - 100)) if suitable else 100

    bars = max(1, math.ceil(width / spacing))
    ast_provided = bars * bar_area
    entity.update({
        "barDiameter": diameter,
        "inputDiameterOfBar": diameter,
        "spacing": spacing,
        "spacingOfBar": spacing,
        "noOfBar": bars,
        "astReq": round(ast_required, 2),
        "astProvided": round(ast_provided, 2),
        "difference": round(ast_provided - ast_required, 2),
        "utilization": round(ast_required / ast_provided * 100, 2) if ast_provided else 0,
        "rebar": f"{bars}T{diameter:g}",
        "reinforcementStatus": "PASS" if ast_provided >= ast_required else "FAIL",
        # Status remains the immutable stress status for clarity.
        "status": entity.get("stressStatus", "FAIL"),
    })
    return entity


def optimise_entities(entities: list, auto_correct: bool = False) -> list:
    result = []
    for source in entities:
        entity = dict(source)
        # Uploaded entities have no stresses yet; subsequent verification data
        # already has them and must retain those values.
        if "stressStatus" not in entity:
            calculate_stresses(entity)
        result.append(recalculate_reinforcement(entity, auto_correct=auto_correct))
    return result
