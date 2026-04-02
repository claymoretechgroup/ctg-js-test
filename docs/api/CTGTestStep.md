# CTGTestStep

Immutable-by-convention value object holding a single step definition. Created internally by `CTGTest.stage()`, `assert()`, `assertAny()`, and `chain()`. No validation at construction — deferred to `CTGTest._validateSteps()`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | One of: `"stage"`, `"assert"`, `"assert-any"`, `"chain"` |
| _name | STRING | Human-readable step name |
| _fn | ((*) -> *)\|ctgTest | Callable for stage/assert/assert-any; CTGTest instance for chain |
| _expected | * | Expected value for assert; candidate array for assert-any; `null` for stage/chain |
| _errorHandler | ((*) -> *)\|VOID | Optional recovery callable; `null` if not provided |

---

### CONSTRUCTOR :: STRING, STRING, ((*) -> *)|ctgTest, *, ((*) -> *)? -> ctgTestStep

Creates a step definition. All fields are write-once at construction with getter-only access.

```javascript
const step = new CTGTestStep("assert", "check value", (x) => x, 42, null);
step.type;         // "assert"
step.name;         // "check value"
step.expected;     // 42
step.errorHandler; // null
```
