"""
Nota: Esegui con CUDA_VISIBLE_DEVICES="" python src/scripts/metrics-evaluation/main.py per evitare di usare la GPU
"""

from lib.data_loader import load_metrics_tests
from lib.metrics.index import METRICS
from lib.metrics.utils import HUGGINGFACE
from tqdm import tqdm
import evaluate
from collections import defaultdict
import os
import json

LANG = 'it'
TO_NORMALIZE = {'bleurt', 'unieval', 'bertscore', 'embedding_gemma'}
USE_CACHE = False
CACHE = {}

def normalize_scores(metric_name, raw_scores):
    if metric_name not in TO_NORMALIZE:
        return list(raw_scores), {"method": "none"}
    vals = [x for x in raw_scores if x is not None]
    if not vals:
        return list(raw_scores), {"method": "minmax", "min": None, "max": None}
    vmin, vmax = min(vals), max(vals)
    if vmax == vmin:
        return [0.5 if x is not None else None for x in raw_scores], {"method": "minmax-constant", "min": vmin, "max": vmax}
    rng = vmax - vmin
    return [(x - vmin) / rng if x is not None else None for x in raw_scores], {"method": "minmax", "min": vmin, "max": vmax}

def add_to_cache(metric_name, meta, results):
    global CACHE
    CACHE[metric_name] = {
        'meta': meta,
        'results': results
    }
    os.makedirs('output/evaluations/metrics', exist_ok=True)
    with open(f'output/evaluations/metrics/cache_{LANG}.json', 'w') as f:
        json.dump(CACHE, f, indent=4)

def load_cache():
    global CACHE
    if os.path.exists(f'output/evaluations/metrics/cache_{LANG}.json'):
        with open(f'output/evaluations/metrics/cache_{LANG}.json', 'r') as f:
            CACHE = json.load(f)
    else:
        CACHE = {}

def compute_best_threshold(scores, labels):
    filtered = [(s, l) for s, l in zip(scores, labels) if l is not None]
    if not filtered:
        return 0.5, 0.0
    filtered.sort(key=lambda x: x[0], reverse=True)
    total_pos = sum(1 for _, l in filtered if l == 1)
    if total_pos == 0:
        return 0.5, 0.0
    tp = 0
    best_f1 = -1.0
    best_idx = 0
    for i, (_, label) in enumerate(filtered):
        if label == 1:
            tp += 1
        k = i + 1  # number of predicted positives at this cutoff
        precision = tp / k
        recall = tp / total_pos if total_pos > 0 else 0.0
        if precision + recall == 0:
            f1 = 0.0
        else:
            f1 = 2 * precision * recall / (precision + recall)
        if f1 > best_f1:
            best_f1 = f1
            best_idx = i
    if best_idx < len(filtered) - 1:
        th = (filtered[best_idx][0] + filtered[best_idx + 1][0]) / 2
    else:
        th = filtered[best_idx][0] - 1e-6
    return th, best_f1

def main():
    metrics_tests = load_metrics_tests(LANG)
    metrics_results = defaultdict(list)
    metrics_meta = {}
    if USE_CACHE: load_cache()
    
    with tqdm(total=len(METRICS), desc='Evaluating metrics') as pbar:
        for metric_name, metric in METRICS.items():
            pbar.set_description(f"Evaluating metric: {metric_name}")
            
            if metric_name in CACHE:
                print(f"Using cached results for metric: {metric_name}")
                metrics_meta[metric_name] = CACHE[metric_name]['meta']
                metrics_results[metric_name] = CACHE[metric_name]['results']
                pbar.update(1)
                continue
            
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
                print(f"Metric {metric_name} is a HuggingFace metric, BATCH PROCESSING IT...")
                # Batch processing for HF metrics
                references = [item['answer_reference'] for item in batch_data]
                predictions = [item['candidate']['Candidate'] for item in batch_data]
                
                results = evaluate.load(metric_name).compute(
                    references=references, 
                    predictions=predictions,
                    **({ "lang" : "it"} if metric_name == 'bertscore' else {}),
                    **({"sources": references} if metric_name == 'comet' else {})
                )
                
                result_key = metric['result_key']
                
                if isinstance(results[result_key], (int, float)):
                    raise ValueError(f"Metric {metric_name} returned a single score for the entire batch, which is unexpected.")
                else:
                    raw_scores = results[result_key]
                    
            else:
                print(f"Metric {metric_name} is a custom function, PROCESSING ITEM BY ITEM...")
                raw_scores = []
                result_key = metric['result_key']
                function = metric['function']
                for item in batch_data:
                    result = function(
                        references=[item['answer_reference']], 
                        predictions=[item['candidate']['Candidate']],
                        **({"keywords_list": [item['keywords']]} if metric_name == 'keyword_based' else {}),
                        **({"query": item['question_test']} if metric_name.startswith('g_eval') or metric_name.startswith('llm_judge_custom') else {})
                    )

                    raw_scores.append(result[result_key])

            normalized_scores, norm_meta = normalize_scores(metric_name, raw_scores)
            scores_for_threshold = [s for s in normalized_scores]
            
            expected_binaries = [item['candidate']['Binary'] for item in batch_data]
            threshold, best_f1 = compute_best_threshold(scores_for_threshold, expected_binaries)
            metrics_meta[metric_name] = {"threshold": threshold, "best_f1": best_f1, "normalization": norm_meta}

            for item, raw_score, norm_score in zip(batch_data, raw_scores, normalized_scores):
                candidate = item['candidate']
                binary_pred = None
                if candidate['Binary'] is not None:
                    comp_value = norm_score if norm_score is not None else float('nan')
                    binary_pred = int(comp_value >= threshold) if norm_score is not None else None
                metrics_results[metric_name].append({
                    "group": item['group_name'],
                    "test": item['question_test'],
                    "candidate": candidate['Candidate'],
                    "expected_continuous": candidate['Expected'],
                    "expected_binary": candidate['Binary'],
                    "result_continuous_raw": raw_score,
                    "result_continuous": norm_score,
                    "result_binary": binary_pred,
                    "threshold": threshold
                })
                pbar.update(1)
                
            add_to_cache(metric_name, metrics_meta[metric_name], metrics_results[metric_name])

    os.makedirs('output/evaluations/metrics', exist_ok=True)
    with open(f'output/evaluations/metrics/results_{LANG}.json', 'w') as f:
        json.dump({"metrics": metrics_results, "meta": metrics_meta}, f, indent=4)

    result_str = '='*50 + '\n' + "FINAL RESULTS" + '\n' + '='*50 + '\n'
    print("="*50)
    print("FINAL RESULTS")
    print("="*50)
    
    for metric_name in metrics_results.keys():
        results = metrics_results[metric_name]
        total_continuous = 0.0
        count_continuous = 0
        total_binary = 0
        correct_binary = 0
        
        y_true = []
        y_pred = []
        for res in results:
            if res['expected_continuous'] is not None and res['result_continuous'] is not None:
                total_continuous += 1 - abs(res['expected_continuous'] - res['result_continuous'])
                count_continuous += 1
            if res['expected_binary'] is not None and res['result_binary'] is not None:
                total_binary += 1
                correct_binary += 1 if res['expected_binary'] == res['result_binary'] else 0
                y_true.append(res['expected_binary'])
                y_pred.append(res['result_binary'])
        if y_true:
            tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
            fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
            fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        else:
            f1 = 0.0
        final_continuous = total_continuous / count_continuous if count_continuous > 0 else 0.0
        binary_accuracy = correct_binary / total_binary if total_binary > 0 else 0.0
        meta = metrics_meta.get(metric_name, {})
        
        output = (f"Metric: {metric_name:<25} | Continuous Score: {final_continuous:.4f} | Binary F1: {f1:.4f} | Binary Accuracy: {binary_accuracy:.4f} | Threshold: {meta.get('threshold', 0.5):.4f}")
        print(output)
        result_str += output + '\n'
        
    with open(f'output/evaluations/metrics/final_results_{LANG}.txt', 'w') as f:
        f.write(result_str)

if __name__ == "__main__":
    main()