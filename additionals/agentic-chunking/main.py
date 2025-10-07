import sys
import json
from pathlib import Path
from chonkie.chunker import SlumberChunker
from chonkie.genie import MistralGenie

PATH_NORMALIZATION_MARK = "+"

def normalize_relative_path(path: Path) -> str:
    """Restituisce il path relativo (così come passato) con / e \\ sostituiti da +"""
    return str(path).replace("/", PATH_NORMALIZATION_MARK).replace("\\", PATH_NORMALIZATION_MARK)

def main():
    if len(sys.argv) < 2:
        print("Usage: python additionals/agentic-chunking/main.py <input_file>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: file not found -> {input_path}")
        sys.exit(1)

    output_dir = Path("output/chunking")
    output_dir.mkdir(parents=True, exist_ok=True)

    normalized_rel_path = normalize_relative_path(input_path)
    output_filename = f"{normalized_rel_path}_chunks[agentic].json"
    output_path = output_dir / output_filename

    with input_path.open("r", encoding="utf-8") as f:
        text = f.read()

    chunker = SlumberChunker(genie=MistralGenie("mistral-small-latest"))
    data = [c.text for c in chunker.chunk(text)]

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Saved chunks to: {output_path.resolve()}")

if __name__ == "__main__":
    main()
