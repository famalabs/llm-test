# Setup

```bash
python3.10 -m venv .venv
source .venv/bin/activate
pip install "git+https://github.com/leonardocrociani/chonkie.git#egg=chonkie[genie]"
```

# Run

```bash
export MISTRAL_API_KEY="your_mistral_api_key"
python additionals/agentic-chunking/main.py <your_input_file>
```
