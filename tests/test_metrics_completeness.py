"""Every SoftConstraints weight must be scored (prevents the pre-M7.5 gap class).

A weight without a _METRICS entry shapes the CP-SAT objective but never enters
/score's weighted overall - exactly the silent gap M7.5 closed for the 4 base
teacher-preference weights. This test makes that gap impossible to reintroduce.
"""

from timetable_solver.models.constraints import SoftConstraints
from timetable_solver.scoring.quality import _METRICS


def test_every_soft_weight_has_a_metric() -> None:
    """Each SoftConstraints field is referenced by exactly the metric registry."""
    weight_attrs = {attr for attr, _fn in _METRICS.values()}
    assert weight_attrs == set(SoftConstraints.model_fields)
