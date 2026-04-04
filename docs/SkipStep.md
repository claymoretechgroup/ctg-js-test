# SkipStep

Extends CTGTestStep. Evaluates a predicate and sets a skip target on state. The pipeline checks `state.skipTargets` before executing the targeted step. Skip does not produce a result entry.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _targetName | STRING | Name of the step to skip |
| _predicate | FUNCTION\|NULL | `(CTGTestState -> BOOL)` or null for unconditional skip |

### CONSTRUCTOR :: STRING, STRING, FUNCTION? -> skipStep

Creates a skip step with a name, target step name, and optional predicate. If the predicate is null, the skip is unconditional.

---

### skipStep.producesResult :: VOID -> BOOL

Returns `false`. Skip modifies state without producing a result entry.

---

### skipStep.expectedOutcome :: VOID -> NULL

Returns `null`. Skip does not require comparison.

---

### skipStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Evaluates the predicate (if provided) against state and sets `state.skipTargets[targetName]` to the result. If the predicate is null, unconditionally sets the target to true.

```javascript
CTGTest.init("example")
    .skip("skip if negative", "check", (state) => state.subject < 0)
    .assert("check", (state) => state.subject, 42)
    .start(42);
```

### Ordering and Targeting Rules

- Skip must appear before its target in the pipeline
- A step may have at most one skip targeting it
- Skip is scoped to the pipeline it is defined in — cannot target steps inside chained pipelines
- If the predicate is null, the skip is unconditional
