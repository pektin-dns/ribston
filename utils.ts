import { Schema } from "https://esm.sh/ajv@8.6.1";

export const convertSchema = (inputSchema: Schema) => {
    const traverse = (obj: Record<string, unknown>) => {
        Object.entries(obj).map(([key, value]) => {
            if (typeof value === "object") {
                traverse(value as Record<string, unknown>);
                return;
            }

            if (key === "type") {
                if (value === "array") {
                    /*@ts-ignore*/
                    traverse(obj["items"]["properties"]);
                    return;
                }
                if (obj["type"] !== "object") obj["type"] = "boolean";
            }
        });
        return obj;
    };
    const outputSchema = JSON.parse(JSON.stringify(inputSchema));
    if (!outputSchema || !outputSchema?.properties) {
        throw new Error("Missing properties on inputSchema");
    }
    outputSchema.properties = traverse(outputSchema.properties);

    return outputSchema;
};

export const createDefaultOutput = (input: Record<string, unknown>) => {
    const traverse = (input: Record<string, unknown>, newObject: Record<string, unknown>) => {
        Object.entries(input).map(([key, value]) => {
            if (Array.isArray(value)) {
                if (typeof value[0] === "object") {
                    newObject[key] = value.map(e => traverse(e, {}));
                    return;
                }
                newObject[key] = new Array(value.length).fill(false);
                return;
            }
            if (typeof value === "object") {
                traverse(value as Record<string, unknown>, newObject);
            }
            newObject[key] = false;
        });
        return newObject;
    };

    const output = JSON.parse(JSON.stringify(input));
    const defaultOutput = traverse(input, output);

    return defaultOutput;
};
