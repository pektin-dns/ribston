const policy = await Deno.readTextFile(
    `/home/paul/Documents/pektin/pektin-js-client/dist/policies/acme.ribston.js`
);
const input = `{"test":"test"}`;

const reqs = [];

for (let i = 0; i < 100; i++) {
    reqs.push(
        fetch(`http://[::]:8888/eval`, {
            method: "post",
            body: JSON.stringify({ policy, input }),
            headers: { "content-type": "application/json" }
        })
    );
}
const t1 = performance.now();
const res = await Promise.all(reqs);
const t2 = performance.now();
const j = await Promise.all(res.map(r => r.json()));
console.log(j, t2 - t1);
