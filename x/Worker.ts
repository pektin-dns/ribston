self.onmessage = e => {
    const input = JSON.parse(e.data.input);
    const b = eval(e.data.policy);

    self.postMessage(b);
};
