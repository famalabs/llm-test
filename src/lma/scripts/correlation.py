import argparse
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PATH_NORMALIZATION_MARK = "+"

def load_scores(json_path: Path) -> pd.DataFrame:
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("Input JSON must be a non-empty list of items.")

    score_rows = []
    for i, item in enumerate(data):
        if not isinstance(item, dict) or "scores" not in item:
            raise ValueError(f"Item #{i} is missing 'scores' field.")
        scores = item["scores"]
        if not isinstance(scores, dict):
            raise ValueError(f"'scores' in item #{i} must be an object/dict.")
        score_rows.append(scores)

    df = pd.DataFrame(score_rows)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        raise ValueError("No numeric score fields found.")
    df = df[numeric_cols]

    return df


def plot_correlation_matrix(corr: pd.DataFrame, out_path: Path, title: str = "Correlation Matrix (Pearson)"):
    cols = corr.columns.tolist()
    n = len(cols)

    fig_size = max(6.0, 0.7 * n + 2.0)
    plt.figure(figsize=(fig_size, fig_size))

    im = plt.imshow(corr.values, vmin=-1, vmax=1)  # default colormap
    plt.colorbar(im, fraction=0.046, pad=0.04, label="Pearson r")

    plt.xticks(range(n), cols, rotation=45, ha="right")
    plt.yticks(range(n), cols)

    plt.gca().set_xticks(np.arange(-.5, n, 1), minor=True)
    plt.gca().set_yticks(np.arange(-.5, n, 1), minor=True)
    plt.grid(which="minor", linestyle="-", linewidth=0.5, alpha=0.3)
    plt.tick_params(which="minor", length=0)

    for i in range(n):
        for j in range(n):
            val = corr.values[i, j]
            plt.text(j, i, f"{val:.2f}", ha="center", va="center")

    plt.title(title)
    plt.tight_layout()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, dpi=200, bbox_inches="tight")
    plt.close()

def main():
    parser = argparse.ArgumentParser(description="Compute and save a correlation matrix (PNG) from sentiment score JSON.")
    parser.add_argument("-i", "--input", required=True, type=str, help="Path to JSON file (list of items with 'scores').")
    args = parser.parse_args()

    in_path = Path(args.input).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"Input file not found: {in_path}")

    df = load_scores(in_path)

    corr = df.corr(method="pearson", numeric_only=True)

    normalized_in_path = str(in_path).replace('/', PATH_NORMALIZATION_MARK).replace('\\', PATH_NORMALIZATION_MARK).replace(' ', '-')
    out_path = Path("output") / "sentiment-analysis" / f"correlation-matrix-{normalized_in_path}.png"
    plot_correlation_matrix(corr, out_path, title="Correlation Matrix of Sentiment Scores (Pearson)")

    print(f"Saved correlation heatmap to: {out_path}")


if __name__ == "__main__":
    main()
