from .test_specific import METRICS as TEST_SPECIFIC_METRICS
from .text_overlapping import METRICS as TEXT_OVERLAPPING_METRICS
from .learned_models import METRIC as LEARNED_MODELS_METRICS
from .word_embeddings import METRICS as WORD_EMBEDDINGS_METRICS
from .answer_embeddings import METRICS as ANSWER_EMBEDDINGS_METRICS
from .llm_as_a_judge import METRICS as LLM_AS_A_JUDGE_METRICS

METRICS = {
    **TEST_SPECIFIC_METRICS, 
    **TEXT_OVERLAPPING_METRICS,
    **LEARNED_MODELS_METRICS, 
    **WORD_EMBEDDINGS_METRICS,
    **ANSWER_EMBEDDINGS_METRICS,
    **LLM_AS_A_JUDGE_METRICS
}

print("Loaded metrics:", list(METRICS.keys()))