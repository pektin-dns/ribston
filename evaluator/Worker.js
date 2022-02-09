self.onmessage = e => {
    let input;
    try {
        input = JSON.parse(e.data.input);
    } catch (error) {
        return self.postMessage({ error: true, message: "Failed to parse Input" });
    }
    let evalOutput;
    try {
        evalOutput = eval(e.data.policy);
    } catch (error) {
        return self.postMessage({ error: true, message: error.message });
    }

    return self.postMessage(evalOutput);
};
