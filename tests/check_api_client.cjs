const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../static') + '/';
function context(handler) {
  let calls = 0;
  const elements = [];
  const timers = [];
  const ctx = vm.createContext({
    URL, AbortController, console,
    location: {origin:'https://ui.example', reload(){}},
    window:{NETOBSERVE_CONFIG:{apiBaseUrl:'https://netobserv.onrender.com'}},
    document:{body:{prepend(){}},querySelector(){return {append(){}};},createElement(){const e={style:{},setAttribute(){},append(){}};elements.push(e);return e;}},
    setTimeout(fn, ms){ timers.push(ms); if(ms < 20000) queueMicrotask(fn); return 0; }, clearTimeout(){},
    fetch: async (...args)=>{calls++;return handler(...args);}
  });
  vm.runInContext(fs.readFileSync(root+'api-client.js','utf8'),ctx);
  return {api:ctx.window.NetObserveAPI, calls:()=>calls,elements,timers};
}
const response = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
(async()=>{
  let n=0;
  const wake=context(async url=>{assert.equal(url.origin,'https://netobserv.onrender.com');return ++n<3?response({},503):response({devices:[]});});
  const wakeStates=[];
  wake.api.subscribe(({state})=>wakeStates.push(state));
  await wake.api.fetch('/stream');assert.equal(wake.calls(),3);
  assert(wakeStates.includes('reconnecting'));
  assert.equal(wake.api.getState().state,'connected');
  const denied=context(async()=>response({},422));
  await assert.rejects(denied.api.fetch('/predict',{method:'POST'}));assert.equal(denied.calls(),1);
  const offline=context(async()=>{throw new TypeError('offline');});
  await assert.rejects(offline.api.fetch('/stream'));assert.equal(offline.calls(),4);
  assert.equal(offline.api.getState().state,'unavailable');
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
  // Health and telemetry success must not mask pending metrics initialization.
  const finish = new Map();
  const dashboard=context(url => new Promise(resolve => finish.set(url.pathname,resolve)));
  dashboard.api.requireEndpoints(['/health','/model-metrics','/stream']);
  let sidebarState;
  dashboard.api.subscribe(({state})=>{sidebarState=state;});
  const healthRequest=dashboard.api.fetch('/health');
  const metricsRequest=dashboard.api.fetch('/model-metrics');
  const streamRequest=dashboard.api.fetch('/stream');
  await Promise.resolve();
  finish.get('/health')(response({status:'operational'}));
  finish.get('/stream')(response({devices:[]}));
  await Promise.all([healthRequest,streamRequest]);
  assert.equal(sidebarState,'connecting');
  assert.equal(banner(dashboard).style.display,'flex');
  finish.get('/model-metrics')(response({accuracy:0.87}));
  await metricsRequest;
  assert.equal(sidebarState,'connected');
  assert.equal(banner(dashboard).style.display,'none');
  // A slow healthy refresh stays connected regardless of how long it is pending.
  const slowRefresh=dashboard.api.fetch('/stream');
  await Promise.resolve();
  assert.equal(dashboard.api.getState().pending,1);
  assert.equal(sidebarState,'connected');
  assert.equal(banner(dashboard).style.display,'none');
  finish.get('/stream')(response({devices:[]}));
  await slowRefresh;
  assert.equal(banner(dashboard).style.display,'none');
  let finishHealth, finishStream;
  const lifecycle=context(url => new Promise(resolve => {
    if(url.pathname === '/health') finishHealth=resolve;
    else finishStream=resolve;
  }));
  lifecycle.api.requireEndpoints(['/health','/stream']);
  const health=lifecycle.api.fetch('/health');
  const stream=lifecycle.api.fetch('/stream');
  assert.equal(banner(lifecycle).style.display,'flex');
  await Promise.resolve();
  finishHealth(response({status:'operational'}));
  await health;
  assert.equal(lifecycle.api.getState().state,'connecting');
  assert.equal(banner(lifecycle).style.display,'flex');
  finishStream(response({devices:[]}));
  await stream;
  assert.equal(lifecycle.api.getState().state,'connected');
  assert.equal(banner(lifecycle).style.display,'none');
  assert(lifecycle.elements.some(e => e.id === 'telemetry-disclosure'));
  const poll=lifecycle.api.fetch('/stream');
  assert.equal(banner(lifecycle).style.display,'none');
  assert(!lifecycle.timers.includes(700));
  assert.equal(lifecycle.api.getState().state,'connected');
  await Promise.resolve();
  finishStream(response({devices:[]}));
  await poll;
  assert.equal(banner(lifecycle).style.display,'none');
  let streamFails=true;
  const recovery=context(async url => url.pathname === '/stream' && streamFails
    ? response({},403) : response(url.pathname === '/stream' ? {devices:[]} : {status:'operational'}));
  await assert.rejects(recovery.api.fetch('/stream'));
  await recovery.api.fetch('/health');
  assert.equal(recovery.api.getState().state,'degraded');
  assert.equal(banner(recovery).style.display,'flex');
  assert.equal(recovery.elements.find(e => e.textContent === 'Retry connection').hidden,false);
  streamFails=false;
  await recovery.api.fetch('/stream');
  assert.equal(recovery.api.getState().state,'connected');
  assert.equal(banner(recovery).style.display,'none');
  // A failed POST can recover on a later user submission (stable endpoint state).
  let badPrediction=true;
  const postRecovery=context(async()=>badPrediction ? response({},422) : response({risk_score:0.5,risk_level:'MEDIUM'}));
  await assert.rejects(postRecovery.api.fetch('/predict',{method:'POST'}));
  badPrediction=false;
  await postRecovery.api.fetch('/predict',{method:'POST'});
  assert.equal(banner(postRecovery).style.display,'none');
  // Recover from temporary network failure without navigation or fake success.
  let networkDown=false;
  const network=context(async()=>{
    if(networkDown) throw new TypeError('Failed to fetch');
    return response({devices:[]});
  });
  await network.api.fetch('/stream');
  networkDown=true;
  await assert.rejects(network.api.fetch('/stream'));
  assert.equal(network.api.getState().state,'unavailable');
  assert.equal(banner(network).style.display,'flex');
  networkDown=false;
  await network.api.retryFailed();
  assert.equal(network.api.getState().state,'connected');
  assert.equal(banner(network).style.display,'none');
  assert.equal(network.calls(),6);
  for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.js'))) new vm.Script(fs.readFileSync(root+name,'utf8'),{filename:name});
  console.log('PASS: URL routing, wake-up retries, HTTP failures, retry exhaustion, invalid prediction, deduplication, JS syntax');
})();
