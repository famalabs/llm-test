from .utils import HUGGINGFACE
from .UniEval.utils import convert_to_json
from .UniEval.metric.evaluator import get_evaluator

# https://huggingface.co/spaces/evaluate-metric/comet -> 0/1 with the model "Unbabel/wmt22-comet-da"
# BLEURT’s output is always a number between 0 and (approximately 1). This value indicates how similar the generated text is to the reference texts, with values closer to 1 representing more similar texts.


def unieval(references, predictions):
    task = 'dialogue'
    
    src_list = references
    context_list = [""] * len(references)
    
    data = convert_to_json(
        output_list=predictions,
        src_list=src_list,
        context_list=context_list
    )
    
    evaluator = get_evaluator(task, device='cpu')
    results = evaluator.evaluate(data, print_result=False)
    
    return {"unieval": results[0]['overall']}

METRIC = {
    "comet" : {
        "function": HUGGINGFACE,
        "result_key": 'scores'
    },
    "bleurt": {
        "function": HUGGINGFACE,
        "result_key": 'scores'       
    }, 
    "unieval" : {
        "function" : unieval,
        "result_key": 'unieval'
    }
}
