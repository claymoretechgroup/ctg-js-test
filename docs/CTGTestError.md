# CTGTestError

Typed error class extending `Error` with bidirectional name/code lookup for test framework errors.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Resolved error type name (e.g. `"INVALID_OPERATION"`) |
| _code | INT | Resolved numeric error code |
| _msg | STRING | Error message (defaults to type name if not provided) |
| _data | * | Optional structured data attached to the error |
| name | STRING | Always `"CTGTestError"` (for native Error compatibility) |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1000 | INVALID_OPERATION | Invalid step definition or pipeline operation |
| 1001 | INVALID_CHAIN | Second argument to chain is not a CTGTest instance |
| 1002 | INVALID_CONFIG | Unrecognized or invalid configuration key |
| 1003 | INVALID_EXPECTED_OUTCOME | Expected outcome is not a valid value for comparison |
| 1004 | INVALID_SKIP | Invalid skip target or predicate |
| 1100 | CHAIN_DEPTH_EXCEEDED | Chain nesting exceeds maximum allowed depth |
| 2000 | FORMATTER_ERROR | Formatter encountered an error during output |
| 2001 | RUNNER_ERROR | Runner encountered an error during execution |

---

### CONSTRUCTOR :: STRING|INT, STRING?, * -> ctgTestError

Creates a typed error from a type name or numeric code. Resolves both directions via the `ERROR_TYPES` map. If `msg` is not provided, defaults to the type name. Throws a native `TypeError` for unknown types or codes.

```javascript
throw new CTGTestError("INVALID_CHAIN", "expected CTGTest instance");
throw new CTGTestError(1002, "Unknown config key: bogus", { key: "bogus" });
```

---

### ctgTestError.type :: VOID -> STRING

Returns the error type name.

```javascript
err.type; // "INVALID_CHAIN"
```

---

### ctgTestError.code :: VOID -> INT

Returns the numeric error code.

```javascript
err.code; // 1001
```

---

### ctgTestError.msg :: VOID -> STRING

Returns the human-readable error message.

```javascript
err.msg; // "expected CTGTest instance"
```

---

### ctgTestError.data :: VOID -> *

Returns the optional structured data attached to the error.

```javascript
const err = new CTGTestError("FORMATTER_ERROR", "serialization failed", { cause: originalError });
err.data; // { cause: originalError }
```

---

### CTGTestError.lookup :: STRING|INT -> INT|STRING

Bidirectional lookup. String input returns the numeric code. Integer input returns the type name. Throws `TypeError` for unknown values.

```javascript
CTGTestError.lookup("INVALID_CHAIN");  // 1001
CTGTestError.lookup(1001);             // "INVALID_CHAIN"
```
