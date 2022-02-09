import { Application, Router, Ajv } from "./deps.ts";
import { Evaluator } from "./evaluator/Evaluator.ts";
const ajv = new Ajv();

const requestSchema = {
    properties: {
        policy: { type: `string` },
        input: { properties: {}, additionalProperties: true }
    }
};
const validateRequestSchema = ajv.compile(requestSchema);

const router = new Router();

const min = 10;
const max = 100;

const evalPool: Evaluator[] = [];

for (let i = 0; i < min; i++) {
    const newEval = new Evaluator({ id: i.toString(), type: "process" });
    await newEval.createFirst();
    evalPool.push(newEval);
}

export const getEvaluator = async (evalPool: Evaluator[]) => {
    for (let i = 0; i < evalPool.length; i++) {
        const evaluator = evalPool[i];
        if (evaluator.ready) {
            evaluator.ready = false;
            console.log(`selected evaluator ${i}`);

            return evaluator;
        }
    }
    if (evalPool.length < max) {
        const newEval = new Evaluator({ id: evalPool.length.toString(), type: "process" });
        await newEval.createFirst();
        evalPool.push(newEval);
        console.log(`creating new evaluator ${evalPool.length}`);
        await new Promise(resolve => setTimeout(resolve, 100));

        return newEval;
    }
};

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
        input: string;
        policy: string;
    };
    const evaluator = await getEvaluator(evalPool);
    console.log("got eval");

    try {
        if (!evaluator) {
            context.response.body = { error: true, message: "No evaluator available" };
            context.response.status = 200;
            return;
        }

        const answer = await evaluator.callEval(input, policy);
        evaluator.destroy();
        context.response.body = answer
            ? answer.replaceAll("\n", "")
            : { error: true, message: "Couldnt parse answer from evaluator" };
        context.response.status = 200;
    } catch (error) {
        context.response.body = { error: true, message: error };
        context.response.status = 400;
    }

    return;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server started`);

await app.listen({ port: 80 });
