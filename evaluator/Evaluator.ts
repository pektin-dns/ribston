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
            this.worker = new Worker(new URL("./Worker.js", import.meta.url).href, {
                type: "module"
            });
        } else {
            this.process = Deno.run({
                cmd: [`deno`, `run`, `./evaluator/Process.js`],
                stdout: `piped`,
                stderr: `piped`,
                stdin: "piped"
            });
            await this.process.status();
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

            this.process = null;
        }
    };
}
