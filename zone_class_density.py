ZONE_CLASS_DENSITY = {
    "SFR1": {"du_per_acre": 4, "far": None},
    "SFR2": {"du_per_acre": 8, "far": None},
    "SFR3": {"du_per_acre": 14, "far": None},
    "MFR1": {"du_per_acre": 27, "far": 0.4},
    "MFR2": {"du_per_acre": 36, "far": 0.5},
    "MFR3": {"du_per_acre": 60, "far": 0.7},
    "MFR4": {"du_per_acre": 80, "far": 1.0},
    "MFR5": {"du_per_acre": 120, "far": 1.8},
    "MFR6": {"du_per_acre": 218, "far": 3.5},
    "MFR7": {"du_per_acre": 450, "far": 7.5},
    "MUR1": {"du_per_acre": 26, "far": 0.4},
    "MUR2": {"du_per_acre": 34, "far": 0.5},
    "MUR3": {"du_per_acre": 57, "far": 0.7},
    "MUR4": {"du_per_acre": 76, "far": 0.8},
    "MUR5": {"du_per_acre": 114, "far": 1.8},
    "MUR6": {"du_per_acre": 207, "far": 3.5},
    "MUR7": {"du_per_acre": 428, "far": 7.5},
    "FUD": {"du_per_acre": 10, "far": None},   # assume 10 DU/net
    "RRFU": {"du_per_acre": 0.1, "far": None},  # 1 du/lot, lots typically 10+ acres
    "CC": {"du_per_acre": None, "far": 0.75},
    "CC2": {"du_per_acre": None, "far": 1.5},
    "CG": {"du_per_acre": None, "far": 0.75},
    "CG2": {"du_per_acre": None, "far": 1.5},
    "CN": {"du_per_acre": None, "far": 0.75},
    "CN2": {"du_per_acre": None, "far": 1.5},
    "CO": {"du_per_acre": None, "far": 0.75},
    "CO2": {"du_per_acre": None, "far": 1.5},
    "RC": {"du_per_acre": None, "far": None},  # Rural Commercial
    "IC": {"du_per_acre": 0, "far": None},
    "IH": {"du_per_acre": 0, "far": None},
    "IL": {"du_per_acre": 0, "far": None},
    "IND": {"du_per_acre": 0, "far": None},
    "IO": {"du_per_acre": 0, "far": None},
    "RI": {"du_per_acre": 0, "far": None},  # Rural Industrial; present in data, not in domain list
    "EFU": {"du_per_acre": 0, "far": None},
    "PF": {"du_per_acre": 0, "far": None},
    "POS": {"du_per_acre": 0, "far": None},
}

for _base in ("MFR1", "MFR2", "MFR3", "MFR4", "MFR5", "MFR6", "MFR7",
              "MUR1", "MUR2", "MUR3", "MUR4", "MUR5", "MUR6", "MUR7"):
    ZONE_CLASS_DENSITY[_base + "z"] = dict(ZONE_CLASS_DENSITY[_base])
del _base

ESTIMATED = {
    "CC", "CC2", "CG", "CG2", "CN", "CN2", "CO", "CO2",  # FAR bucketed from "< 1.0" / "> 1.0"
    "RRFU",                                              # 1 du/lot on 10+ acre lots
    "IC", "IH", "IL", "IND", "IO", "RI", "EFU", "PF", "POS",  # housing assumed disallowed
}

DU_PER_ACRE = {k: v["du_per_acre"] for k, v in ZONE_CLASS_DENSITY.items()}
FAR = {k: v["far"] for k, v in ZONE_CLASS_DENSITY.items()}
