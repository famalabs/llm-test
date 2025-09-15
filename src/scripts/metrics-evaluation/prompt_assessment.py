from lib.data_loader import load_metrics_tests
from lib.data_loader import load_prompts
from lib.metrics.llm_as_a_judge import llm_judge_custom
from tqdm import tqdm
from dotenv import load_dotenv
import os
import json
import statistics
load_dotenv('.env')

LANG = 'en'
USE_CACHE = True
CACHE = {}
ROOT_FOLDER = 'output/evaluations/metrics/prompt-optimization'
NUM_TRIALS = 3

def add_to_cache(metric_name, meta, results):
    global CACHE
    if NUM_TRIALS != 1:
        return
    CACHE[metric_name] = {
        'meta': meta,
        'results': results
    }
    os.makedirs(ROOT_FOLDER, exist_ok=True)
    with open(f'{ROOT_FOLDER}/cache_{LANG}.json', 'w') as f:
        json.dump(CACHE, f, indent=4)

def load_cache():
    global CACHE
    if NUM_TRIALS > 1:
        print("Warning: Caching is disabled when NUM_TRIALS > 1")
        CACHE = {}
        return 
    if os.path.exists(f'{ROOT_FOLDER}/cache_{LANG}.json'):
        with open(f'{ROOT_FOLDER}/cache_{LANG}.json', 'r') as f:
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
    # metrics_results[prompt_name] => list of trials; each trial is a list of item-level results
    metrics_results = {}
    # metrics_meta[prompt_name] => {"trials": [{"threshld":..., "best_f1":...}, ...]}
    metrics_meta = {}
    if USE_CACHE: load_cache()
    prompts_structure = load_prompts()
    prompts = prompts_structure['prompts']

    total_tasks = len(prompts) * NUM_TRIALS
    with tqdm(total=total_tasks, desc='Evaluating prompts') as pbar:
        for prompt_structure in prompts:
            prompt_name = prompt_structure['label']
            prompt = prompt_structure['content']

            if NUM_TRIALS == 1 and prompt_name in CACHE:
                print(f'Using cached results for prompt: {prompt_name}')
                cached_meta = CACHE[prompt_name]['meta']
                cached_results = CACHE[prompt_name]['results']
                metrics_meta[prompt_name] = {"trials": [cached_meta]}
                metrics_results[prompt_name] = [cached_results]
                pbar.update(1)
                continue

            metrics_results[prompt_name] = []
            metrics_meta[prompt_name] = {"trials": []}

            for trial_idx in range(NUM_TRIALS):
                pbar.set_description(f'Evaluating: {prompt_name} (trial {trial_idx+1}/{NUM_TRIALS})')

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

                def prompt_funct(expected_answer, given_answer, query):
                    out = prompt
                    out += f"""
-----------
QUERY:
{query}
-----------
EXPECTED ANSWER: 
{expected_answer}
-----------
GIVEN ANSWER:
{given_answer}
-----------
""".strip()
                    return out

                raw_scores = []
                for item in batch_data:
                    result = llm_judge_custom(
                        references=[item['answer_reference']], 
                        predictions=[item['candidate']['Candidate']],
                        query=item['question_test'],
                        llm='mistral-small-latest',
                        prompt_funct=prompt_funct
                    )
                    raw_scores.append(result['score'])

                expected_binaries = [item['candidate']['Binary'] for item in batch_data]
                threshold, best_f1 = compute_best_threshold(raw_scores, expected_binaries)
                metrics_meta[prompt_name]["trials"].append({"threshold": threshold, "best_f1": best_f1})

                trial_results = []
                for item, raw_score in zip(batch_data, raw_scores):
                    candidate = item['candidate']
                    binary_pred = None
                    if candidate['Binary'] is not None:
                        comp_value = raw_score if raw_score is not None else float('nan')
                        binary_pred = int(comp_value >= threshold) if raw_score is not None else None
                    trial_results.append({
                        "group": item['group_name'],
                        "test": item['question_test'],
                        "candidate": candidate['Candidate'],
                        "expected_continuous": candidate['Expected'],
                        "expected_binary": candidate['Binary'],
                        "weight": candidate['Weight'],
                        "result_continuous": raw_score,
                        "result_binary": binary_pred,
                        "threshold": threshold
                    })

                metrics_results[prompt_name].append(trial_results)
                
                # Cache only single-trial runs
                if NUM_TRIALS == 1:
                    add_to_cache(prompt_name, metrics_meta[prompt_name]["trials"][0], metrics_results[prompt_name][0])

                pbar.update(1)

    os.makedirs(ROOT_FOLDER, exist_ok=True)
    with open(f'{ROOT_FOLDER}/results_{LANG}.json', 'w') as f:
        json.dump({"metrics": metrics_results, "meta": metrics_meta}, f, indent=4)

    result_str = '='*50 + '\n' + "FINAL RESULTS (mean ± std across trials)" + '\n' + '='*50 + '\n'
    print("="*50)
    print("FINAL RESULTS (mean ± std across trials)")
    print("="*50)

    for prompt in prompts:
        prompt_name = prompt['label']
        trials = metrics_results.get(prompt_name, [])

        cont_scores = []
        f1_scores = []
        acc_scores = []

        for trial_results in trials:
            total_continuous = 0.0
            count_continuous = 0
            total_binary = 0
            correct_binary = 0
            y_true = []
            y_pred = []
            for res in trial_results:
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
            cont_scores.append(final_continuous)
            f1_scores.append(f1)
            acc_scores.append(binary_accuracy)

        # Compute mean/std (std = 0.0 when trials = 1)
        def _mean(xs):
            return statistics.mean(xs) if xs else 0.0
        def _std(xs):
            return statistics.stdev(xs) if len(xs) > 1 else 0.0

        cont_mean, cont_std = _mean(cont_scores), _std(cont_scores)
        f1_mean, f1_std = _mean(f1_scores), _std(f1_scores)
        acc_mean, acc_std = _mean(acc_scores), _std(acc_scores)

        # ad ora consideriamo mean threshold
        trial_metas = metrics_meta.get(prompt_name, {}).get('trials', [])
        th_values = [m.get('threshold', 0.5) for m in trial_metas]
        th_mean = _mean(th_values)
        th_std = _std(th_values)

        output = (
            f"Prompt: {prompt_name:<25} | Continuous: {cont_mean:.4f} ± {cont_std:.4f} | "
            f"Binary F1: {f1_mean:.4f} ± {f1_std:.4f} | Accuracy: {acc_mean:.4f} ± {acc_std:.4f} | "
            f"Trials: {len(trials)} | Th(mean): {th_mean:.4f} ± {th_std:.4f}"
        )
        print(output)
        result_str += output + '\n'
        
    with open(f'{ROOT_FOLDER}/final_results_{LANG}.txt', 'w') as f:
        f.write(result_str)

if __name__ == "__main__":
    main()