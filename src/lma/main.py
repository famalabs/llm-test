import argparse
import json
import os
from pathlib import Path
from typing import Dict, Tuple
from transformers import pipeline

ALLOWED_7 = [-1.0, -0.6, -0.3, 0.0, 0.3, 0.6, 1.0]

FIVE_TO_CONT = {
    0: -1.0,  # Very Negative
    1: -0.6,  # Negative
    2: 0.0,   # Neutral
    3: 0.6,   # Positive
    4: 1.0,   # Very Positive
}

LABEL_TO_INDEX = {
    "Very Negative": 0,
    "Negative": 1,
    "Neutral": 2,
    "Positive": 3,
    "Very Positive": 4
}

def expected_and_quantized(prob_by_class: Dict[int, float]) -> Tuple[float, float]:
    expected = sum(FIVE_TO_CONT[i] * prob_by_class[i] for i in FIVE_TO_CONT) # weighted average -> expected value
    quantized = min(ALLOWED_7, key=lambda v: abs(v - expected)) # valore più vicino
    return expected, quantized

def get_measure_score(actual: float, predicted: float) -> float:
    return round(1 - abs(actual - predicted) / 2, 4)


def main():
    ap = argparse.ArgumentParser(description="Sentiment + quantization + score")
    ap.add_argument("--input", "-i", required=True, help="Input JSON file with fields 'input' and 'scores'")
    ap.add_argument('--measure', '-m', default='polarity', help="Dimension to evaluate (default: polarity)")
    args = ap.parse_args()
    measure = args.measure

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("The file must contain a list of JSON objects.")

    sentiment_pipe = pipeline(
        "text-classification",
        model="tabularisai/multilingual-sentiment-analysis",
        truncation=True,
    )

    results = []
    total_score = 0.0
    count = 0

    for row in data:
        text = row["input"]
        if isinstance(text, list):
            text = "------\n".join(text)

        output = sentiment_pipe(text, top_k=None)

        probs = {}
        for o in output[0] if isinstance(output, list) and isinstance(output[0], list) else output:
            idx = LABEL_TO_INDEX[o["label"]]
            probs[idx] = float(o["score"])

        expected, quantized = expected_and_quantized(probs)

        actual_val = float(row["scores"][measure])
        score = get_measure_score(actual_val, quantized)
        total_score += score
        count += 1
        
        prediction = {}
        prediction[measure] = quantized
        prediction["expected"] = round(expected, 6)
        prediction["class_probs"] = {str(k): round(v, 6) for k, v in sorted(probs.items())}

        computedScores ={}
        computedScoresKey = f"{measure}Score"
        computedScores[computedScoresKey] = score

        results.append({
            "input": row["input"],
            "prediction": prediction,
            "actual": actual_val,
            "computedScores": computedScores
        })

    avg_score = total_score / count if count > 0 else 0.0

    out_dir = Path("output") / "sentiment-analysis"
    out_dir.mkdir(parents=True, exist_ok=True)
    norm_input = args.input.replace(os.sep, "+").replace(" ", "-")
    out_path = out_dir / f"sentiment={measure}_{norm_input}"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Output written to: {out_path}")
    print(f"Average {measure.capitalize()} Score: {avg_score:.4f}")


if __name__ == "__main__":
    main()
