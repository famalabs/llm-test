"""
Nota: Esegui con CUDA_VISIBLE_DEVICES="" python src/scripts/metrics-evaluation/main.py per evitare di usare la GPU
"""

from lib.data_loader import load_metrics_tests
from lib.metrics.index import METRICS
from lib.metrics.utils import HUGGINGFACE
from tqdm import tqdm
import evaluate
from collections import defaultdict

def main():    
    metrics_tests = load_metrics_tests()
    
    total_iterations = sum(
        len(tests['Candidates']) 
        for tests in metrics_tests.values()
    ) * len(METRICS)
    
    metrics_results = defaultdict(list)
    
    with tqdm(total=total_iterations, desc='Evaluating metrics') as pbar:
        for metric_name, metric in METRICS.items():
            pbar.set_description(f"Evaluating metric: {metric_name}")
            
            batch_data = []
            
            for group_name, tests in metrics_tests.items():
                question_test = tests['Test']
                keywords = tests['Keywords']
                answer_reference = tests['Reference']
                answer_candidates = tests['Candidates']
                
                for candidate in answer_candidates:
                    batch_data.append({
                        'group_name': group_name,
                        'question_test': question_test,
                        'keywords': keywords,
                        'answer_reference': answer_reference,
                        'candidate': candidate
                    })
            
            if metric['function'] == HUGGINGFACE:
                # Batch processing for HF metrics
                references = [item['answer_reference'] for item in batch_data]
                predictions = [item['candidate']['Candidate'] for item in batch_data]
                
                results = evaluate.load(metric_name).compute(
                    references=references, 
                    predictions=predictions,
                    **({"sources": references} if metric_name == 'comet' else {})
                )
                
                result_key = metric['result_key']
                
                if isinstance(results[result_key], (int, float)):
                    scores = [results[result_key]] * len(batch_data)
                else:
                    scores = results[result_key]
                    
            else:
                scores = []
                result_key = metric['result_key']
                function = metric['function']
                for item in batch_data:
                    result = function(
                        references=[item['answer_reference']], 
                        predictions=[item['candidate']['Candidate']],
                        **({"keywords_list": [item['keywords']]} if metric_name == 'keyword_based' else {})
                    )
                    scores.append(result[result_key])
            
            for item, score in zip(batch_data, scores):
                candidate = item['candidate']
                
                metrics_results[metric_name].append({
                    "group": item['group_name'],
                    "test": item['question_test'],
                    "candidate": candidate['Candidate'],
                    "expected_continuous": candidate['Expected'],
                    "expected_binary": candidate['Binary'],
                    "weight": candidate['Weight'],
                    "result_continuous": score,
                    "result_binary": int(score > 0.5)
                })
                
                pbar.update(1)
    
    print("="*50)
    print("FINAL RESULTS")
    print("="*50)
    
    for metric_name in metrics_results.keys():
        results = metrics_results[metric_name]
        total_continuous = 0
        count_continuous = 0
        total_binary = 0
        count_binary = 0

        for res in results:
            if res['expected_continuous'] is not None and res['result_continuous'] is not None:
                total_continuous += 1 - abs(res['expected_continuous'] - res['result_continuous'])
                count_continuous += 1
            if res['expected_binary'] is not None and res['result_binary'] is not None:
                total_binary += 1 if res['expected_binary'] == res['result_binary'] else 0
                count_binary += 1

        final_continuous = total_continuous / count_continuous if count_continuous > 0 else 0
        final_binary = total_binary / count_binary if count_binary > 0 else 0
        print(f"Metric: {metric_name:<20} | Continuous Score: {final_continuous:.4f} | Binary Score: {final_binary:.4f}")

if __name__ == "__main__":
    main()