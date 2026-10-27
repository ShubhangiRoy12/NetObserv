const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(require('node:path').resolve(__dirname, '../static/local-profiles.js'), 'utf8');
function environment(storage = new Map()) {
  const context = vm.createContext({window:{}, crypto:webcrypto, TextEncoder,
    localStorage:{getItem:key=>storage.get(key) ?? null, setItem:(key,value)=>storage.set(key,value), removeItem:key=>storage.delete(key)}});
  vm.runInContext(source,context);
  return {store:context.window.NetObserveProfiles,storage};
}
(async()=>{
  const {store,storage}=environment();
  assert.equal(store.session(),null);
  const password='LocalDemoOnly!123';
  await store.register('Demo User','test@example.invalid',password);
  assert.equal(store.session().email,'test@example.invalid');
  assert(![...storage.values()].join('').includes(password));
  const profiles=JSON.parse(storage.get('netobserve.localProfiles.v1'));
  assert.equal(profiles[0].salt.length,32);
  assert.equal(profiles[0].passwordHash.length,64);
  assert.equal(environment(storage).store.session().email,'test@example.invalid');
  await assert.rejects(store.register('Demo','TEST@example.invalid',password),/already/);
  store.signOut();
  assert.equal(store.session(),null);
  await assert.rejects(store.signIn('test@example.invalid','wrong password'),/incorrect/);
  assert.equal(store.session(),null);
  await store.signIn(' TEST@example.invalid ',password);
  assert.equal(store.session().email,'test@example.invalid');
  const session=JSON.parse(storage.get('netobserve.localSession.v1'));
  session.expiresAt=Date.now()-1;
  storage.set('netobserve.localSession.v1',JSON.stringify(session));
  assert.equal(store.session(),null);
  assert(!storage.has('netobserve.localSession.v1'));
  await store.register('Second Demo','second@example.invalid',password);
  const both=JSON.parse(storage.get('netobserve.localProfiles.v1'));
  assert.notEqual(both[0].salt,both[1].salt);
  assert.notEqual(both[0].passwordHash,both[1].passwordHash);
  await assert.rejects(store.register('Demo','third@example.invalid','short'),/12/);
  const broken=environment(new Map([
    ['netobserve.localProfiles.v1','broken'],
    ['netobserve.localSession.v1',JSON.stringify({profileId:'demo',expiresAt:Date.now()+10000})]
  ]));
  assert.throws(()=>broken.store.session());
  const blocked=new Map();
  blocked.get=()=>{throw new Error('Storage blocked');};
  assert.throws(()=>environment(blocked).store.session(),/Storage blocked/);
  console.log('PASS local profiles: real PBKDF2, unique salts, no plaintext storage, registration, duplicate rejection, wrong-password rejection, remembered session, sign-out, expiry');
})().catch(error=>{console.error(error);process.exitCode=1;});
