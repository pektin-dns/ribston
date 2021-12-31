# run

from the root folder of the project

```sh
curl -X 'POST' http://localhost:8888/ -v -H 'content-type: application/json' -d @examples/policies/test.json
```

# policy

```ts
output.api_method = ["set", "get", "delete"].includes(input.api_method);
output.ip = true;
output.utc_millis = true;
output.user_agent = true;
output.rr_sets = input.rr_sets.map(rr_set => {
    return {
        name: rr_set.name.startsWith("_acme-challenge") && rr_set.name.endsWith("."),
        value: true,
        ttl: rr_set.ttl < 3600,
        rr_type: rr_set.rr_type === "TXT"
    };
});
```

# schema

```json
{
    "type": "object",
    "required": ["api_method", "ip", "utc_millis", "user_agent", "rr_sets"],
    "additionalProperties": false,
    "properties": {
        "api_method": { "type": "string" },
        "ip": { "type": "string" },
        "utc_millis": { "type": "number" },
        "user_agent": { "type": "string" },
        "rr_sets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "rr_type": { "type": "string" },
                    "ttl": { "type": "number" },
                    "value": { "type": "string" }
                }
            }
        }
    }
}
```
