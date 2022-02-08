const policy = await Deno.readTextFile(
    `/home/paul/Documents/pektin/pektin-js-client/dist/policies/acme.ribston.js`
);
const input = `{"test":"test"}`;

const reqs = [];

for (let i = 0; i < 1; i++) {
    reqs.push(
        fetch(`http://[::]:8888/eval`, {
            method: "post",
            body: JSON.stringify({ policy, input }),
            headers: { "content-type": "application/json" }
        })
    );
}
console.time();
const res = await Promise.all(reqs);
console.timeEnd();
const j = await Promise.all(res.map(r => r.json()));

console.log(j);
