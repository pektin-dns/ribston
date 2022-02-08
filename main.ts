import { Application, Router, Ajv, path } from "./deps.ts";
const ajv = new Ajv();

const requestSchema = {
    properties: {
        policy: { type: `string` },
        input: { properties: {}, additionalProperties: true }
    }
};
const validateRequestSchema = ajv.compile(requestSchema);

const router = new Router();

export const randomString = (length = 100) => {
    function dec2hex(dec: number) {
        return dec.toString(16).padStart(2, "0");
    }

    const arr = new Uint8Array((length || 40) / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join("");
};

export const removeFiles = async (policyPath: string, inputPath: string) => {
    return await Promise.all([Deno.remove(policyPath), Deno.remove(inputPath)]);
};

router.post(`/health`, context => {
    context.response.headers.set(`content-type`, `application/json`);
    context.response.body = { error: false };
    context.response.status = 200;
    return;
});

router.post(`/eval`, async context => {
    context.response.headers.set(`content-type`, `application/json`);

    if (context.request.headers.get(`content-type`) !== `application/json`) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: `Invalid content type header: 'content-type: application/json' is required`
        };
        return;
    }
    if (!context.request.hasBody) {
        context.response.status = 400;
        context.response.body = { error: true, message: `Body required` };
        return;
    }
    let body;
    try {
        body = await context.request.body({ type: `json` }).value;
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: `Error while trying to parse body: ` + e
        };
        return;
    }

    if (!validateRequestSchema(body)) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message:
                `Invalid request body: ` +
                (validateRequestSchema.errors ? validateRequestSchema.errors[0].message : ``),
            errorData: validateRequestSchema.errors
        };
        return;
    }

    const { input, policy } = body as {
        input: Record<string, unknown>;
        policy: string;
    };
    const id = randomString(20);
    const basePath = path.join(`work`);
    const policyFileName = `${id}-policy.js`;
    const inputFileName = `${id}-input.json`;
    const policyPath = path.join(basePath, policyFileName);
    const inputPath = path.join(basePath, inputFileName);

    try {
        // eval input with given policy
        const beforePolicy = `//@ts-ignore x\nconst input=JSON.parse(await Deno.readTextFile("./work/${inputFileName}"))\ndelete globalThis.Deno;\n`;

        const afterPolicy = `\nconsole.log(JSON.stringify(output));`;

        await Deno.writeTextFile(
            policyPath,
            beforePolicy + policy.replace(/^const input [^;]*;$/gm, "") + afterPolicy
        );
        await Deno.writeTextFile(inputPath, JSON.stringify(input));
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: `Could not write temporary files`
        };
        console.error(e);
        return;
    }

    let evalPolicy, code;
    try {
        // create subprocess
        evalPolicy = Deno.run({
            cmd: [
                `deno`,
                `run`,
                `--allow-read=./work/${inputFileName}`,
                `./work/${policyFileName}`
            ],
            stdout: `piped`,
            stderr: `piped`
        });

        // await its completion
        code = (await evalPolicy.status()).code;
        await removeFiles(policyPath, inputPath);
    } catch (e) {
        await removeFiles(policyPath, inputPath);
        context.response.status = 400;
        context.response.body = {
            error: true,
            message: `Couldn't create subprocess`
        };
        console.error(e);
        return;
    }

    if (code !== 0) {
        const rawError = await evalPolicy.stderrOutput();
        const errorString = new TextDecoder().decode(rawError);
        console.error(errorString);
        context.response.body = { error: true, message: `Error evaluating policy:` + errorString };
        context.response.status = 400;
        return;
    }

    let output: Record<string, unknown>;
    try {
        const rawOutput = new TextDecoder().decode(await evalPolicy.output());

        output = JSON.parse(rawOutput);
    } catch (e) {
        context.response.body = { error: true, message: `Error parsing policy output: ` + e };
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

console.log(`Server started`);

await app.listen({ port: 80 });
