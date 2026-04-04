# AssertAnyStep

Extends CTGTestStep. Computes an actual value from state. The pipeline compares the actual value against a list of candidates and passes if any candidate matches.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _fn | FUNCTION | `(CTGTestState -> *)` — computes actual value |
| _candidates | [*] | Candidate values the pipeline compares actual against |

### CONSTRUCTOR :: STRING, FUNCTION, [*], FUNCTION? -> assertAnyStep

Creates an assertAny step with a name, compute function, candidate array, and optional error handler. Candidates must be an array.

---

### assertAnyStep.expectedOutcome :: VOID -> OBJECT

Returns `{ type: "candidates", candidates: [*] }`. The pipeline uses this to compare `state.actual` against each candidate after execution.

---

### assertAnyStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Calls the compute function with state and sets `state.actual` to the return value. Does not modify `state.subject`. If an error handler is provided and the function throws, the handler receives the error and its return value is set as `state.actual`.

```javascript
CTGTest.init("example")
    .assertAny("check", (state) => state.subject, [41, 42, 43])
    .start(42);
```
