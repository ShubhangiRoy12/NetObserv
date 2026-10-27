const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../static') + '/';
function context(handler) {
  let calls = 0;
  const elements = [];
  let showSlowLoading;
  const ctx = vm.createContext({
    URL, AbortController, console,
    location: {origin:'https://ui.example', reload(){}},
    window:{NETOBSERVE_CONFIG:{apiBaseUrl:'https://netobserv.onrender.com'}},
    document:{body:{prepend(){}},createElement(){const e={style:{},setAttribute(){},append(){}};elements.push(e);return e;}},
    setTimeout(fn, ms){ if(ms === 700) showSlowLoading = fn; else if(ms < 20000) queueMicrotask(fn); return 0; }, clearTimeout(){},
    fetch: async (...args)=>{calls++;return handler(...args);}
  });
  vm.runInContext(fs.readFileSync(root+'api-client.js','utf8'),ctx);
  return {api:ctx.window.NetObserveAPI, calls:()=>calls,elements, showSlowLoading:()=>showSlowLoading()};
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
  assert(offline.elements.some(e => /Unable to load GET \/stream/.test(e.textContent)));
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
  const banner = ctx => ctx.elements.find(e => e.id === 'api-connection-status');
  let finishHealth, finishStream;
  const lifecycle=context(url => new Promise(resolve => {
    if(url.pathname === '/health') finishHealth=resolve;
    else finishStream=resolve;
  }));
  const health=lifecycle.api.fetch('/health');
  const stream=lifecycle.api.fetch('/stream');
  assert.equal(banner(lifecycle).style.display,'flex');
  await Promise.resolve();
  finishHealth(response({status:'operational'}));
  await health;
  assert.equal(banner(lifecycle).style.display,'flex');
  finishStream(response({devices:[]}));
  await stream;
  assert.equal(banner(lifecycle).style.display,'none');
  assert(lifecycle.elements.some(e => e.id === 'telemetry-disclosure'));
  const poll=lifecycle.api.fetch('/stream');
  assert.equal(banner(lifecycle).style.display,'none');
  lifecycle.showSlowLoading();
  assert.equal(banner(lifecycle).style.display,'flex');
  await Promise.resolve();
  finishStream(response({devices:[]}));
  await poll;
  assert.equal(banner(lifecycle).style.display,'none');
  let streamFails=true;
  const recovery=context(async url => url.pathname === '/stream' && streamFails
    ? response({},403) : response(url.pathname === '/stream' ? {devices:[]} : {status:'operational'}));
  await assert.rejects(recovery.api.fetch('/stream'));
  await recovery.api.fetch('/health');
  assert.equal(banner(recovery).style.display,'flex');
  assert.equal(recovery.elements.find(e => e.textContent === 'Retry connection').hidden,false);
  streamFails=false;
  await recovery.api.fetch('/stream');
  assert.equal(banner(recovery).style.display,'none');
  // A failed POST can recover on a later user submission (stable endpoint state).
  let badPrediction=true;
  const postRecovery=context(async()=>badPrediction ? response({},422) : response({risk_score:0.5,risk_level:'MEDIUM'}));
  await assert.rejects(postRecovery.api.fetch('/predict',{method:'POST'}));
  badPrediction=false;
  await postRecovery.api.fetch('/predict',{method:'POST'});
  assert.equal(banner(postRecovery).style.display,'none');
  for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.js'))) new vm.Script(fs.readFileSync(root+name,'utf8'),{filename:name});
  console.log('PASS: URL routing, wake-up retries, HTTP failures, retry exhaustion, invalid prediction, deduplication, JS syntax');
})();
