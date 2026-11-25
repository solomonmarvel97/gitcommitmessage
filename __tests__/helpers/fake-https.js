// Preloaded into CLI test processes with `node -r`: no real network calls
const fs = require('fs');
const https = require('https');
const { EventEmitter } = require('events');

https.request = (url, options, onResponse) => {
  let body = {};
  const req = new EventEmitter();
  req.setTimeout = () => {};
  req.write = (data) => { body = JSON.parse(data); };
  req.end = () => setImmediate(() => {
    fs.appendFileSync(process.env.FAKE_LOG, `${body.model}\n`);
    const count = fs.readFileSync(process.env.FAKE_LOG, 'utf8').trim().split('\n').length;
    const res = new EventEmitter();
    res.statusCode = body.model === process.env.FAKE_MISSING_MODEL
      ? 404
      : Number(process.env.FAKE_STATUS || 200);
    res.setEncoding = () => {};
    onResponse(res);
    res.emit('data', JSON.stringify({ choices: [{ message: { content: `feat: fake message ${count}` } }] }));
    res.emit('end');
  });
  return req;
};
