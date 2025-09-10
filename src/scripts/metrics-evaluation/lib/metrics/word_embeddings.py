from bert_score import BERTScorer

def bertscore(references, predictions):
    scorer = BERTScorer(
        lang='it',
        device='cpu',
        model_type='bert-base-multilingual-cased'
    )
    _, _, f1 = scorer.score(references, predictions)
    return { 'f1':f1.tolist()[0]  } # custom score are processed sequentially

METRICS = {
    'bertscore': {
        "function": bertscore,
        "result_key": 'f1'
    },
}