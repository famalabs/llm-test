from .utils import HUGGINGFACE
from .UniEval.utils import convert_to_json
from .UniEval.metric.evaluator import get_evaluator

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
