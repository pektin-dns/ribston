const te = new TextEncoder();
const td = new TextDecoder();
import { path } from "../deps.ts";

export class Evaluator {
    id: string;
    worker: Worker | null;
    process: Deno.Process | null;
    type: "worker" | "process";
    ready: boolean;
    constructor({ id, type }: { id: string; type: "worker" | "process" }) {
        this.id = id;
        this.worker = null;
        this.process = null;
        this.type = type;
        this.ready = false;
    }

    createFirst = async () => {
        await Deno.mkdir(path.join("work", this.id), { recursive: true }).catch(() => {});
        await Deno.mkdir(path.join("watch", this.id), { recursive: true }).catch(() => {});
        await Deno.writeTextFile(path.join("watch", this.id, "watch"), Date.now().toString());
        await Deno.writeTextFile(path.join("work", this.id, "policy.json"), "x");
        this.create();
    };
    create = async () => {
        if (this.type === "worker") {
            this.worker = new Worker(new URL("./Worker.js", import.meta.url).href, {
                type: "module"
            });
            setTimeout(() => (this.ready = true), 1000);
        } else {
            this.process = Deno.run({
                cmd: [
                    `deno`,
                    `run`,
                    `--allow-read=./work/${this.id}/,./watch/${this.id}/`,
                    `./evaluator/Process.js`,
                    this.id
                ],
                stdout: `piped`,
                stderr: `piped`
            });
            setTimeout(() => (this.ready = true), 100);
            await this.process.status();
        }
    };
    callEval = async (input: string, policy: string): Promise<string | false> => {
        this.ready = false;
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
            if (!this.process) return false;

            await Deno.writeTextFile(
                path.join("work", this.id, "policy.json"),
                JSON.stringify({ input, policy })
            );
            Deno.writeTextFile(path.join("work", this.id, "watch"), Date.now().toString());
            Deno.writeTextFile(path.join("work", this.id, "watch"), Date.now().toString());

            const { code } = await this.process.status();
            const rawOutput = await this.process.output();
            const rawError = await this.process.stderrOutput();

            if (code === 0) {
                return td.decode(rawOutput);
            } else {
                return td.decode(rawError);
            }
        }
    };

    destroy = async () => {
        if (this.type === "worker") {
            if (!this.worker) return false;
            this.worker.terminate();
            this.worker = null;
        } else {
            if (!this.process) return false;
            try {
                this.process.kill("SIGTERM");
                this.process.close();
            } catch (error) {}
            this.process = null;
            await this.createFirst();
        }
    };
}
