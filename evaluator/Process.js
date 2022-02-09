const id = Deno.args[0];
const watcher = Deno.watchFs(`./watch/${id}/`);
for await (const event of watcher) {
    const rawFile = await Deno.readTextFile(`./work/${id}/policy.json`);
    const { input, policy } = JSON.parse(rawFile);
    //@ts-ignore x
    delete globalThis.Deno;

    const e = eval(policy);
    console.log(JSON.stringify(e));
    break;
}
