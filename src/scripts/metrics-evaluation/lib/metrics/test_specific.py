from .utils import HUGGINGFACE

def test_specific_score(predictions, references, keywords_list):
    scores = []
    for pred, keywords in zip(predictions, keywords_list):
        pred_lower = pred.lower()
        # Contiamo quante keywords sono presenti nel candidato
        hits = sum(1 for kw in keywords if kw.lower() in pred_lower)
        score = hits / len(keywords)  # normalizzato tra 0 e 1
        scores.append(score)
    
    if len(scores) == 1:
        return {"keyword_based": scores[0]}

    return {"keyword_based": scores}

METRICS = {
    'keyword_based': {
        "function": test_specific_score,
        "result_key": 'keyword_based'
    },
    'exact_match': {
        "function": HUGGINGFACE,
        "result_key": 'exact_match'
    }
}