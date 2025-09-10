from .utils import normalized_01_cosine_similarity
from mistralai import Mistral
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import os

load_dotenv(".env")

mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
paraphrase_miniLM_model = SentenceTransformer(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", device="cpu"
)
embedding_gemma_model = SentenceTransformer("google/embeddinggemma-300m", device="cpu")
mmbert_model = SentenceTransformer("jhu-clsp/mmBERT-base", device="cpu")


def mistral_embed(references, predictions):
    ref_embeds = mistral_client.embeddings.create(
        model="mistral-embed", inputs=references
    )
    ref_embeds = [e.embedding for e in ref_embeds.data]
    pred_embeds = mistral_client.embeddings.create(
        model="mistral-embed", inputs=predictions
    )
    pred_embeds = [e.embedding for e in pred_embeds.data]
    return {"similarity": normalized_01_cosine_similarity(ref_embeds, pred_embeds)}


def paraphrase_miniLM(references, predictions):
    ref_embeds = paraphrase_miniLM_model.encode(references)
    pred_embeds = paraphrase_miniLM_model.encode(predictions)

    return {"similarity": normalized_01_cosine_similarity(ref_embeds, pred_embeds)}


def embedding_gemma(references, predictions):
    ref_embeds = embedding_gemma_model.encode(references)
    pred_embeds = embedding_gemma_model.encode(predictions)

    return {"similarity": normalized_01_cosine_similarity(ref_embeds, pred_embeds)}


def mmbertscore(references, predictions):
    embeddings_ref = mmbert_model.encode(references)
    embeddings_pred = mmbert_model.encode(predictions)

    return {
        "similarity": normalized_01_cosine_similarity(embeddings_ref, embeddings_pred)
    }


METRICS = {
    "mistral-embed": {"function": mistral_embed, "result_key": "similarity"},
    "paraphrase_miniLM": {"function": paraphrase_miniLM, "result_key": "similarity"},
    "embedding_gemma": {"function": embedding_gemma, "result_key": "similarity"},
    "mmbertscore": {
        "function": mmbertscore,
        "result_key": "similarity",
    },
}
