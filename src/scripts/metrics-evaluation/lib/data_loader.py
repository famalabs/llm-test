import os
import pandas as pd
import json

SOURCE_CSV = "data/Metriche LM - Groups.csv"
DESTINATION_JSON_IT = "data/metrics-evaluation-it.json"
DESTINATION_JSON_EN = "data/metrics-evaluation-en.json"

def load_metrics_tests(lang):
    
    if lang == "it":
        DESTINATION_JSON = DESTINATION_JSON_IT
    elif lang == "en":
        DESTINATION_JSON = DESTINATION_JSON_EN
    else:
        raise ValueError(f"Unsupported language: {lang}. Supported languages are 'it' and 'en'.")

    # se esiste il json e non c'è il csv, ritorna il json
    if os.path.exists(DESTINATION_JSON) and not os.path.exists(SOURCE_CSV):
        with open(DESTINATION_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # se non esiste il csv, solleva un errore
    if not os.path.exists(SOURCE_CSV):
        raise FileNotFoundError(f"Source CSV file not found: {SOURCE_CSV}")
    
    # else -> aggiorna il json con il contenuto del csv
    
    df = pd.read_csv(SOURCE_CSV)
    df = df.dropna(how="all")
    grouped = {}
    for (group, test), g in df.groupby(["Group", "Test"]):
        reference = g["Reference"].iloc[0]
        keywords = g["Keywords"].iloc[0] if pd.notna(g["Keywords"].iloc[0]) else ""

        candidates = []
        for _, row in g.iterrows():
            candidates.append({
                "Candidate": row["Candidate"],
                "Expected": row["Expected"] if pd.notna(row["Expected"]) else None,
                "Weight": row["Weight"] if pd.notna(row["Weight"]) else None,
                "Binary": int(row["Binary"]) if pd.notna(row["Binary"]) else None
            })

        grouped[group] = {
            "Test": test,
            "Reference": reference,
            "Keywords": keywords.split(",") if isinstance(keywords, str) else [],
            "Candidates": candidates
        }

    with open(DESTINATION_JSON, "w", encoding="utf-8") as f:
        json.dump(grouped, f, ensure_ascii=False, indent=2)

    os.remove(SOURCE_CSV)
    return grouped