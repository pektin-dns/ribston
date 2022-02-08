export const testEval = (policy: string) => {
    eval(`
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
    err("API method '$\{input.api_method}' not allowed");
}
if (output.error === undefined) {
    output.error = false;
    output.message = "Success";
}

output;

`);
};
