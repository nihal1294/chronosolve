"""Registry mapping hard user-rule assumption literals to structured conflicts.

Hard rules authored by the user (breaks, caps, exclusions, orderings) gate their
constraints on a fresh assumption literal. When the model is INFEASIBLE, CP-SAT's
sufficient_assumptions_for_infeasibility() returns the literals that cause the
clash; this registry turns those literal indices back into RuleConflicts (a
machine-addressable RuleRef plus readable text) so the result can name - and the
M7.3 UI can soften - exactly which rules conflict.
"""

from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from timetable_solver.models.rules import RuleRef
from timetable_solver.models.schedule import RuleConflict


@dataclass
class AssumptionRegistry:
    """Maps assumption-literal indices to the rule instances that created them."""

    model: cp_model.CpModel
    _by_index: dict[int, RuleConflict] = field(default_factory=dict)

    def gate(self, ref: RuleRef, description: str) -> cp_model.IntVar:
        """Return a fresh assumption literal, tagged with the rule it guards.

        Gate a constraint with .only_enforce_if(lit); on infeasibility the literal
        maps back to (ref, description) so the clash can be named and softened.

        Args:
            ref: Machine-addressable reference to the rule instance.
            description: Human-readable text naming the rule this literal guards.

        Returns:
            A boolean variable already registered as a model assumption.
        """
        lit = self.model.new_bool_var(f"assume_{len(self._by_index)}")
        self.model.add_assumption(lit)
        self._by_index[lit.index] = RuleConflict(ref=ref, description=description)
        return lit

    def describe(self, indices: list[int]) -> list[RuleConflict]:
        """Map literal indices to their conflicts, de-duplicated by ref, in order."""
        seen: set[tuple[str, str]] = set()
        conflicts: list[RuleConflict] = []
        for i in indices:
            conflict = self._by_index.get(i)
            if conflict is None:
                continue
            ref_key = (conflict.ref.kind, conflict.ref.key)
            if ref_key in seen:
                continue
            seen.add(ref_key)
            conflicts.append(conflict)
        return conflicts

    @property
    def has_assumptions(self) -> bool:
        """True once at least one rule has registered an assumption literal."""
        return bool(self._by_index)
