from chonkie.chunker import SlumberChunker
from chonkie.genie import MistralGenie

chunker = SlumberChunker(
    genie = MistralGenie('mistral-small-latest')
)

with open('../../data/oki_full.txt') as file:
    text = file.read()

print(chunker.chunk(text))