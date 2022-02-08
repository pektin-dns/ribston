const te = new TextEncoder();
const td = new TextDecoder();

export class Evaluator {
    id: string;
    worker: Worker | null;
    process: Deno.Process | null;
    type: "worker" | "process";
    buf: Uint8Array;
    constructor({ id, type }: { id: string; type: "worker" | "process" }) {
        this.id = id;
        this.worker = null;
        this.process = null;
        this.type = type;
        this.buf = new Uint8Array(10240);
    }
    create = async () => {
        if (this.type === "worker") {
            this.worker = new Worker(new URL("./Worker.ts", import.meta.url).href, {
                type: "module"
            });
        } else {
            this.process = Deno.run({
                cmd: [`deno`, `run`, `./evaluator/Process.ts`],
                stdout: `piped`,
                stderr: `piped`,
                stdin: "piped"
            });
            console.log(await this.process.status());
        }
    };
    callEval = async (input: string, policy: string): Promise<string | false> => {
        if (this.type === "worker") {
            if (!this.worker) this.create();
            if (!this.worker) return false;

            this.worker.postMessage({ input, policy });
            return new Promise(resolve => {
                if (!this.worker) return;
                this.worker.onmessage = e => {
                    resolve(e.data);
                };
            });
        } else {
            if (!this.process) this.create();

            if (!this.process || !this.process.stdin || !this.process.stdout) return false;
            this.process.stdin.write(te.encode(`${JSON.stringify({ input, policy })}\n`));

            const n = (await this.process.stdout.read(this.buf)) as number;
            const out = td.decode(this.buf.subarray(0, n));
            if (out === undefined || out === "undefined\n") return false;
            return JSON.parse(out);
        }
    };

    destroy = () => {
        if (this.type === "worker") {
            if (!this.worker) return false;
            this.worker.terminate();
            this.worker = null;
        } else {
            if (!this.process) return false;

            this.process.kill("SIGTERM");
            this.process.close();
            this.process = null;
        }
    };
}

const policy = `
const input="test"
var ApiResponseType;
(function(ApiResponseType1) {
ApiResponseType1["Success"] = "success";
ApiResponseType1["PartialSuccess"] = "partial-success";
ApiResponseType1["Error"] = "error";
ApiResponseType1["Ignored"] = "ignored";
})(ApiResponseType || (ApiResponseType = {
}));
var PektinRRType;
(function(PektinRRType1) {
PektinRRType1["A"] = "A";
PektinRRType1["AAAA"] = "AAAA";
PektinRRType1["CAA"] = "CAA";
PektinRRType1["CNAME"] = "CNAME";
PektinRRType1["MX"] = "MX";
PektinRRType1["NS"] = "NS";
PektinRRType1["OPENPGPKEY"] = "OPENPGPKEY";
PektinRRType1["SOA"] = "SOA";
PektinRRType1["SRV"] = "SRV";
PektinRRType1["TLSA"] = "TLSA";
PektinRRType1["TXT"] = "TXT";
})(PektinRRType || (PektinRRType = {
}));

const output = {
};
const err = (msg)=>{
output.error = true;
output.message = msg;
};
if (input.api_method === "get") {
if (!input.request_body.Get.keys.every((key)=>key.startsWith("_acme-challenge") && key.endsWith(".:TXT")
)) {
    err("Invalid key");
}
} else if (input.api_method === "delete" || input.api_method === "set") {
const records = input.api_method === "delete" ? input.request_body.Delete.records : input.request_body.Set.records;
if (!records.every((record)=>record.name.startsWith("_acme-challenge") && record.rr_type === PektinRRType.TXT
)) {
    err("Invalid key");
}
} else {
err(\`API method \${input.api_method} is not allowed\`);
}
if (output.error === undefined) {
output.error = false;
output.message = "Success";
}

output;

`;
