import { Application, Router } from "https://deno.land/x/oak@v10.1.0/mod.ts";
import Ajv, { JSONSchemaType, Schema } from "https://esm.sh/ajv@8.6.1";
const ajv = new Ajv();

interface RequestData {
    schema: Schema;
    policy: string;
    input: Record<string, unknown>;
}

const requestSchema: JSONSchemaType<RequestData> = {
    type: "object",
    properties: {
        schema: { type: "object" },
        policy: { type: "string" },
        input: { type: "object" }
    },
    required: ["schema", "policy", "input"],
    additionalProperties: false
};
const validateRequestSchema = ajv.compile(requestSchema);

const router = new Router();
router.post("/", async context => {
    context.response.headers.set("content-type", "application/json");

    if (context.request.headers.get("content-type") !== "application/json") {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Invalid content type header: 'content-type: application/json' is required"
        };
        return;
    }
    if (!context.request.hasBody) {
        context.response.status = 400;
        context.response.body = { error: true, message: "Body required" };
        return;
    }
    let body;
    try {
        body = await context.request.body({ type: "json" }).value;
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Error while trying to parse body: " + e
        };
        return;
    }

    if (!validateRequestSchema(body)) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message:
                "Invalid request body: " +
                (validateRequestSchema.errors ? validateRequestSchema.errors[0].message : ""),
            errorData: validateRequestSchema.errors
        };
        return;
    }

    const { input, schema, policy } = body;
    let validateInputSchema;
    try {
        validateInputSchema = ajv.compile(schema);
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Error while trying to parse schema: " + e
        };
        return;
    }

    if (!validateInputSchema(input)) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message:
                "Input does not match given schema: " +
                (validateInputSchema.errors ? validateInputSchema.errors[0].message : ""),
            errorData: validateInputSchema.errors
        };
        return;
    }

    // eval input with given policy

    const beforePolicy = `const input=JSON.parse(Deno.args[0]); let output;\n`;
    const afterPolicy = `\nconsole.log(output);`;
    await Deno.writeTextFile("./policy.ts", beforePolicy + policy + afterPolicy);

    // create subprocess
    const evalPolicy = Deno.run({
        cmd: ["deno", "run", "./policy.ts", JSON.stringify(input)],
        stdout: "piped",
        stderr: "piped"
    });

    // await its completion
    const { code } = await evalPolicy.status();

    if (code !== 0) {
        const rawError = await evalPolicy.stderrOutput();
        const errorString = new TextDecoder().decode(rawError);
        context.response.body = { error: true, message: "Error evaluating policy:" + errorString };
        context.response.status = 400;
        return;
    }
    const out = await evalPolicy.output();
    context.response.body = new TextDecoder().decode(out);
    context.response.status = 200;
    return;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server started");

await app.listen({ port: 8888 });
