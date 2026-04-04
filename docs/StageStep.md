# StageStep

Extends CTGTestStep. Transforms the subject on state. The callback receives CTGTestState and must return CTGTestState. The pipeline records pass or error — no comparison.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _fn | FUNCTION | `(CTGTestState -> CTGTestState)` — transforms state |

### CONSTRUCTOR :: STRING, FUNCTION, FUNCTION? -> stageStep

Creates a stage step with a name, transform function, and optional error handler.

---

### stageStep.expectedOutcome :: VOID -> NULL

Returns `null`. Stage steps do not require comparison.

---

### stageStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Calls the transform function with state. If the callback does not return a CTGTestState instance, the step errors. If an error handler is provided and the callback throws, the handler receives the error and its return value replaces the subject.

```javascript
CTGTest.init("example")
    .stage("double", (state) => { state.subject = state.subject * 2; return state; })
    .start(5);
```
