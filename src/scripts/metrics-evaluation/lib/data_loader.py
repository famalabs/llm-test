import os
import pandas as pd
import json

METRICS_SOURCE_CSV = "local/Metriche LM - Groups + Metrics.csv"
METRICS_DESTINATION_JSON = "data/metrics-evaluation.json"
EVALUATION_PROMPTS_JSON = 'data/evaluation-prompts.json'

def load_prompts():
    if not os.path.exists(EVALUATION_PROMPTS_JSON):
        raise FileNotFoundError(f"Evaluation Prompts JSON file not found: {EVALUATION_PROMPTS_JSON}")

    with open(EVALUATION_PROMPTS_JSON, 'r') as f:
        return json.loads(f.read())
    

def load_metrics_tests():

    # se esiste il json e non c'è il csv, ritorna il json
    if os.path.exists(METRICS_DESTINATION_JSON) and not os.path.exists(METRICS_SOURCE_CSV):
        with open(METRICS_DESTINATION_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # se non esiste il csv, solleva un errore
    if not os.path.exists(METRICS_SOURCE_CSV):
        raise FileNotFoundError(f"Source CSV file not found: {METRICS_SOURCE_CSV}")
    
    # else -> aggiorna il json con il contenuto del csv
    
    df = pd.read_csv(METRICS_SOURCE_CSV)
    df = df.dropna(how="all")

    grouped = {}
    for (group, test), g in df.groupby(["Group", "Test"]):
        full_ref = g["FullRef"].iloc[0]
        key_ref = g["KeyRef"].iloc[0] if pd.notna(g["KeyRef"].iloc[0]) else ""

        candidates = []
        for _, row in g.iterrows():
            candidates.append({
                "Candidate": row["Candidate"],
                "MainCategory": int(row["Main Category"]) if pd.notna(row["Main Category"]) else None,
                "SubCategory": int(row["Sub Category"]) if pd.notna(row["Sub Category"]) else None,
                "Continuous": float(row["Continuous"]) if pd.notna(row["Continuous"]) else None,
                "Binary": int(row["Binary (unit test)"]) if pd.notna(row["Binary (unit test)"]) else None
            })

        grouped[group] = {
            "Test": test,
            "FullRef": full_ref,
            "KeyRef": key_ref,
            "Candidates": candidates
        }

    with open(METRICS_DESTINATION_JSON, "w", encoding="utf-8") as f:
        json.dump(grouped, f, ensure_ascii=False, indent=2)

    os.remove(METRICS_SOURCE_CSV)
    return grouped