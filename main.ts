import { Application, Router } from "https://deno.land/x/oak@v10.1.0/mod.ts";
import Ajv from "https://esm.sh/ajv@8.6.1/dist/jtd?bundle";

const ajv = new Ajv();

const requestSchema = {
    properties: {
        policy: { type: "string" },
        input: { properties: {}, additionalProperties: true }
    }
};
const validateRequestSchema = ajv.compile(requestSchema);

const router = new Router();

router.post("/health", context => {
    context.response.headers.set("content-type", "application/json");
    context.response.body = { error: false };
    context.response.status = 200;
    return;
});

router.post("/eval-policy", async context => {
    //console.log(JSON.stringify(await context.request.body({ type: "json" }).value, null, "   "));

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

    const { input, policy } = body as {
        input: Record<string, unknown>;
        policy: string;
    };

    try {
        // eval input with given policy
        const beforePolicy = `//@ts-ignore x\ndelete globalThis.Deno; \n`;
        //console.log(createDefaultOutput(input), JSON.stringify(convertSchema(schema)));

        const afterPolicy = `\nconsole.log(JSON.stringify(output));`;
        await Deno.writeTextFile(
            "./policy.ts",
            beforePolicy +
                policy.replace(
                    "const input: Input = {} as Input;",
                    `const input: Input=${JSON.stringify(input)}; `
                ) +
                afterPolicy
        );
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
            cmd: ["deno", "run", "./policy.ts"],
            stdout: "piped",
            stderr: "piped"
        });

        // await its completion
        code = (await evalPolicy.status()).code;
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: "Couldn't create subprocess"
        };
        console.error(e);
        return;
    }

    if (code !== 0) {
        const rawError = await evalPolicy.stderrOutput();
        const errorString = new TextDecoder().decode(rawError);
        console.error(errorString);
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

    context.response.body = output;
    context.response.status = 200;
    return;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server started");

await app.listen({ port: 8888 });
