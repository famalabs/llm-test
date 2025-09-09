from .utils import HUGGINGFACE

METRICS = {
    'rouge': {
        "function": HUGGINGFACE,
        "result_key": 'rouge1'          
    },
    'meteor': {
        "function": HUGGINGFACE,
        "result_key": 'meteor'
    },
}