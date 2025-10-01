import argparse
import json
import sys
from typing import Any

import spacy
from spacy.util import is_package


def lemmatize_text(text: str, nlp) -> str:
  doc = nlp(text)
  return " ".join(tok.lemma_ for tok in doc)


def transform(obj: Any, nlp):
  if isinstance(obj, str):
    return lemmatize_text(obj, nlp)
  if isinstance(obj, list):
    return [transform(x, nlp) for x in obj]
  if isinstance(obj, dict):
    return {k: transform(v, nlp) for k, v in obj.items()}
  return obj


def main():
  parser = argparse.ArgumentParser(description="Lemmatize all strings in a JSON file using spaCy.")
  parser.add_argument("-i", "--input", required=True, help="Path to input JSON")
  parser.add_argument("-o", "--output", help="Path to output JSON")
  parser.add_argument("-m", "--model", default="it_core_news_lg", help="spaCy model to use (default: it_core_news_lg)")
  args = parser.parse_args()

  model = args.model
  if not is_package(model):
    print(f"spaCy model '{model}' not found. Install it with: python -m spacy download {model}", file=sys.stderr)
    sys.exit(1)

  nlp = spacy.load(model)

  with open(args.input, "r", encoding="utf-8") as f:
    data = json.load(f)

  lemmatized = transform(data, nlp)

  if not args.output:
    args.output = args.input.replace(".json", "_lem.json")

  with open(args.output, "w", encoding="utf-8") as f:
    json.dump(lemmatized, f, ensure_ascii=False, indent=2)

  print(f"Wrote lemmatized JSON to: {args.output}")


if __name__ == "__main__":
  main()