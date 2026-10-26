const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../static') + '/';
function context(handler) {
  let calls = 0;
  const elements = [];
  const ctx = vm.createContext({
    URL, AbortController, console,
    location: {origin:'https://ui.example', reload(){}},
    window:{NETOBSERVE_CONFIG:{apiBaseUrl:'https://netobserv.onrender.com'}},
    document:{body:{prepend(){}},createElement(){const e={style:{},setAttribute(){},append(){}};elements.push(e);return e;}},
    setTimeout(fn, ms){ if(ms < 20000) queueMicrotask(fn); return 0; }, clearTimeout(){},
    fetch: async (...args)=>{calls++;return handler(...args);}
  });
  vm.runInContext(fs.readFileSync(root+'api-client.js','utf8'),ctx);
  return {api:ctx.window.NetObserveAPI, calls:()=>calls,elements};
}
const response = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
(async()=>{
  let n=0;
  const wake=context(async url=>{assert.equal(url.origin,'https://netobserv.onrender.com');return ++n<3?response({},503):response({devices:[]});});
  await wake.api.fetch('/stream');assert.equal(wake.calls(),3);
  const denied=context(async()=>response({},422));
  await assert.rejects(denied.api.fetch('/predict',{method:'POST'}));assert.equal(denied.calls(),1);
  const offline=context(async()=>{throw new TypeError('offline');});
  await assert.rejects(offline.api.fetch('/stream'));assert.equal(offline.calls(),4);
  assert.match(offline.elements[1].textContent,/unavailable/);
  const malformed=context(async()=>response({detail:'bad'}));
  await assert.rejects(malformed.api.fetch('/predict',{method:'POST'}));
  const shared=context(async()=>response({devices:[]}));
  const results=await Promise.all([shared.api.fetch('/stream'),shared.api.fetch('/stream')]);
  await Promise.all(results.map(r=>r.json()));assert.equal(shared.calls(),1);
  const predictions=context(async()=>response({risk_score:0.5,risk_level:'MEDIUM'}));
  await Promise.all([
    predictions.api.fetch('/predict',{method:'POST',body:'{"dur":1}'}),
    predictions.api.fetch('/predict',{method:'POST',body:'{"dur":2}'})
  ]);
  assert.equal(predictions.calls(),2);
  for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.js'))) new vm.Script(fs.readFileSync(root+name,'utf8'),{filename:name});
  console.log('PASS: URL routing, wake-up retries, HTTP failures, retry exhaustion, invalid prediction, deduplication, JS syntax');
})();
