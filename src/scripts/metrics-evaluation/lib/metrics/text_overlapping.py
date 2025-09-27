import evaluate    
from rouge_score import rouge_scorer
meteor_metric = evaluate.load('meteor') 

def rouge(references, predictions):
    scorer = rouge_scorer.RougeScorer(['rouge1'], use_stemmer=True)
    scores = scorer.score(references, predictions)
    return scores

def rouge_recall(references, predictions):
    if len(references) != 1 or len(predictions) != 1:
        raise ValueError("rouge_recall metric only supports single reference and single prediction.")
    scores = rouge(references[0], predictions[0])
    return {'rouge_recall': scores['rouge1'].recall}

def rouge_precision(references, predictions):
    if len(references) != 1 or len(predictions) != 1:
        raise ValueError("rouge_precision metric only supports single reference and single prediction.")
    scores = rouge(references[0], predictions[0])
    return {'rouge_precision': scores['rouge1'].precision}

def meteor(references, predictions):
    results = meteor_metric.compute(predictions=predictions, references=references)
    return {'meteor': results['meteor']}

METRICS = {
    'rouge_recall': {
        "function": rouge_recall,
        "result_key": 'rouge_recall'
    },
    'rouge_precision': {
        "function": rouge_precision,
        "result_key": 'rouge_precision'
    },
    'meteor': {
        "function": meteor,
        "result_key": 'meteor'
    },
}