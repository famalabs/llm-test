import sys
import json
from pathlib import Path
from chonkie.chunker import SlumberChunker
from chonkie.genie import MistralGenie
from chonkie.genie import OpenAIGenie
from chonkie.genie import GeminiGenie
import argparse
import os
import dotenv
dotenv.load_dotenv('.env')

PATH_NORMALIZATION_MARK = "+"

def normalize_relative_path(path: Path) -> str:
    """Restituisce il path relativo (così come passato) con / e \\ sostituiti da +"""
    return str(path).replace("/", PATH_NORMALIZATION_MARK).replace("\\", PATH_NORMALIZATION_MARK)

def main():
    
    ap = argparse.ArgumentParser(description="Agentic chunking of text files.")
    ap.add_argument("--input", "-i", required=True, help="Input file path for chunking.")
    ap.add_argument('--model', '-m', type=str, default='mistral-small-latest', help='Model to use for chunking (default: mistral-small-latest)')
    ap.add_argument('--provider', '-p', type=str, default='mistral', help='Provider to use for chunking (default: mistral)')

    args = ap.parse_args()
    
    provider = args.provider
    if provider == 'mistral':
        genie = MistralGenie(args.model, api_key=os.getenv("MISTRAL_API_KEY"))
    elif provider == 'openai':
        genie = OpenAIGenie(args.model, api_key=os.getenv("OPENAI_API_KEY"))
    elif provider == 'google':
        genie = GeminiGenie(args.model, api_key=os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"))
    else:
        print(f"Error: unsupported provider '{provider}'. Supported providers are 'mistral', 'openai', 'google'.")
        sys.exit(1)
    
    input_path = Path(args.input).expanduser().resolve()
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


    chunker = SlumberChunker(genie=genie)
    data = [c.text for c in chunker.chunk(text)]

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Saved chunks to: {output_path.resolve()}")

if __name__ == "__main__":
    main()
