"""Registry mapping hard user-rule assumption literals to human descriptions.

Hard rules authored by the user (breaks, caps, exclusions, orderings) gate their
constraints on a fresh assumption literal. When the model is INFEASIBLE, CP-SAT's
sufficient_assumptions_for_infeasibility() returns the literals that cause the
clash; this registry turns those literal indices back into readable rule text so
the result can name exactly which rules conflict (consumed in M7.3).
"""

from dataclasses import dataclass, field

from ortools.sat.python import cp_model


@dataclass
class AssumptionRegistry:
    """Maps assumption-literal indices to the rule descriptions that created them."""

    model: cp_model.CpModel
    _by_index: dict[int, str] = field(default_factory=dict)

    def gate(self, description: str) -> cp_model.IntVar:
        """Return a fresh assumption literal; gate a constraint with .only_enforce_if(lit).

        Args:
            description: Human-readable text naming the rule this literal guards.

        Returns:
            A boolean variable already registered as a model assumption.
        """
        lit = self.model.new_bool_var(f"assume_{len(self._by_index)}")
        self.model.add_assumption(lit)
        self._by_index[lit.index] = description
        return lit

    def describe(self, indices: list[int]) -> list[str]:
        """Map assumption-literal indices back to their rule descriptions."""
        return [self._by_index[i] for i in indices if i in self._by_index]

    @property
    def has_assumptions(self) -> bool:
        """True once at least one rule has registered an assumption literal."""
        return bool(self._by_index)
