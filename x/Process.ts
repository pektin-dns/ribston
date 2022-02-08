import { writeAllSync } from "../deps.ts";
const td = new TextDecoder();
const te = new TextEncoder();
const buf = new Uint8Array(10240);

const main = () => {
    const n = Deno.stdin.readSync(buf) as number;
    const m = td.decode(buf.subarray(0, n));

    const command = JSON.parse(m);
    const { input } = command;

    const e = eval(command.policy);
    writeAllSync(Deno.stdout, te.encode(`${JSON.stringify(e)}\n`));
};
window.onload = () => main();
