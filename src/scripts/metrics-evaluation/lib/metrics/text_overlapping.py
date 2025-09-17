import evaluate    
rouge_metric = evaluate.load('rouge')
meteor_metric = evaluate.load('meteor') 

def rouge(references, predictions):
    results = rouge_metric.compute(predictions=predictions, references=references, use_aggregator=False)
    return {'rouge1': results['rouge1'][0]}

def meteor(references, predictions):
    results = meteor_metric.compute(predictions=predictions, references=references)
    return {'meteor': results['meteor']}

METRICS = {
    'rouge': {
        "function": rouge,
        "result_key": 'rouge1'          
    },
    'meteor': {
        "function": meteor,
        "result_key": 'meteor'
    },
}