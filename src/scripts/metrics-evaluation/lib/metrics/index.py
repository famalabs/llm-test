from .test_specific import METRICS as TEST_SPECIFIC_METRICS
from .text_overlapping import METRICS as TEXT_OVERLAPPING_METRICS
from .learned_models import METRIC as LEARNED_MODELS_METRICS

METRICS = {
    **TEST_SPECIFIC_METRICS, 
    **TEXT_OVERLAPPING_METRICS,
    **LEARNED_MODELS_METRICS
}

print("Loaded metrics:", list(METRICS.keys()))