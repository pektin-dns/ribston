//@ts-ignore x
delete globalThis.Deno; 
 const output={}; const input = {"api_method":"set","ip":"[::ffff:127.0.0.1]:38686","utc_millis":1641756541131,"user_agent":"some user agent","redis_entries":[{"name":"deine .mutter.:SOA","rr_set":[{"ttl":3600,"value":{"SOA":{"mname":"deine.mutter.","rname":"hostmaster.deine.mutter.","serial":0,"refresh":0,"retry":0,"expire":0,"minimum":0}}}]}]};

output.api_method = ["set", "get", "delete"].includes(input.api_method);
output.ip = true;
output.utc_millis = true;
output.user_agent = true;
output.redis_entries = input.redis_entries.map(rr_set => {
    return {
        name: rr_set.name.startsWith("_acme-challenge") && rr_set.name.endsWith(".:TXT"),
        rr_set: true
    };
});

console.log(JSON.stringify(output));