import { Application, Router } from "https://deno.land/x/oak@v10.1.0/mod.ts";
import Ajv, { JSONSchemaType, Schema } from "https://esm.sh/ajv@8.6.1?bundle";
import { convertSchema, createDefaultOutput } from "./utils.ts";
const ajv = new Ajv();

// curl -X 'POST' http://localhost:8888/ -v -H 'content-type: application/json' -d @test.json

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
            message: "Error while trying to parse inputSchema: " + e
        };
        return;
    }

    let validateOutputSchema;
    try {
        validateOutputSchema = ajv.compile(convertSchema(schema));
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Error while trying to create outputSchema: " + e
        };
        return;
    }

    if (!validateInputSchema(input)) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message:
                "Input does not match given inputSchema: " +
                (validateInputSchema.errors ? validateInputSchema.errors[0].message : ""),
            errorData: validateInputSchema.errors
        };
        return;
    }

    try {
        // eval input with given policy
        const beforePolicy = `delete globalThis.Deno; \n const input=${JSON.stringify(
            input
        )}; const output=${JSON.stringify(createDefaultOutput(input))};\n`;
        //console.log(createDefaultOutput(input), JSON.stringify(convertSchema(schema)));

        const afterPolicy = `\nconsole.log(JSON.stringify(output));`;
        await Deno.writeTextFile("./policy.ts", beforePolicy + policy + afterPolicy);
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Could not write temporary file"
        };
        console.error(e);
        return;
    }

    let evalPolicy, code;
    try {
        // create subprocess
        evalPolicy = Deno.run({
            cmd: ["deno", "run", "--no-check", "./policy.ts"],
            stdout: "piped",
            stderr: "piped"
        });

        // await its completion
        code = (await evalPolicy.status()).code;
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Could create subprocess"
        };
        console.error(e);
        return;
    }

    if (code !== 0) {
        const rawError = await evalPolicy.stderrOutput();
        const errorString = new TextDecoder().decode(rawError);
        context.response.body = { error: true, message: "Error evaluating policy:" + errorString };
        context.response.status = 400;
        return;
    }
    let output: Record<string, unknown>;
    try {
        const rawOutput = new TextDecoder().decode(await evalPolicy.output());

        output = JSON.parse(rawOutput);
    } catch (e) {
        context.response.body = { error: true, message: "Error parsing policy output: " + e };
        context.response.status = 400;
        return;
    }

    if (!validateOutputSchema(output)) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message:
                "Output does not match given outputSchema: " +
                (validateOutputSchema.errors ? validateOutputSchema.errors[0].message : ""),
            errorData: validateOutputSchema.errors
        };
        return;
    }

    context.response.body = output;
    context.response.status = 200;
    return;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server started");

await app.listen({ port: 8888 });
