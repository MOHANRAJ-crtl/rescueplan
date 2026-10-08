/* DOM/event integration checks against an isolated running FastAPI server.
   This is not a browser layout or accessibility audit. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const base = process.argv[2];
if(!base) throw new Error('Use python tests/run_frontend_smoke.py');
const source = fs.readFileSync(path.join(__dirname,'../frontend/app.js'),'utf8');
const clients = [];
const errors = [];
const password = 'Frontend-test-password#42';
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(check,label) {
  for(let n=0;n<160;n++) {if(check())return;await sleep(50);}
  throw new Error(`Timed out: ${label}`);
}
async function browser(entry='app') {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const dom = new JSDOM(`<!doctype html><body data-entry="${entry}"><div id="app"></div><div id="modal-root"></div><div id="toast-root"></div></body>`,
    {url:base+'/'+(entry==='app'?'':entry+'-login.html'),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w = dom.window;
  w.scrollTo=()=>{};
  w.AbortController=global.AbortController;
  w.fetch=async (url, options={}) => {
    const target=new URL(url,w.location.href);
    const cookie=dom.cookieJar.getCookieStringSync(target.href);
    const response=await fetch(target,{...options,headers:{...options.headers,...(cookie?{Cookie:cookie}:{}),...(options.method!=='GET'?{Origin:base}:{})}});
    for(const setCookie of response.headers.getSetCookie())dom.cookieJar.setCookieSync(setCookie,target.href);
    return response;
  };
  w.addEventListener('error',event=>errors.push(event.message));
  w.eval(source);
  clients.push(dom);
  await until(()=>dom.window.document.querySelector('#login-form'),'login render');
  return dom;
}
const doc = dom => dom.window.document;
const html = dom => doc(dom).getElementById('app').innerHTML;
async function submit(dom,id,fields,finished) {
  const form=doc(dom).getElementById(id);
  assert.ok(form,`missing form ${id}`);
  for(const [name,value] of Object.entries(fields)) {
    const input=form.elements.namedItem(name);
    assert.ok(input,`missing ${id}.${name}`);
    input.value=String(value);
  }
  form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await until(finished,id);
  await sleep(20);
}
async function click(dom,selector,finished) {
  const el=doc(dom).querySelector(selector);
  assert.ok(el,`missing ${selector}`);
  assert.ok(!el.disabled,`disabled ${selector}`);
  el.click();
  if(finished)await until(finished,selector);
  await sleep(20);
}
async function raw(dom,url,method='GET',data) {
  const cookie=dom.cookieJar.getCookieStringSync(base);
  const auth=await fetch(base+'/api/auth/me',{headers:{Cookie:cookie}}).then(r=>r.json());
  const response=await fetch(base+url,{method,headers:{Cookie:cookie,'Content-Type':'application/json',Origin:base,...(auth.csrfToken?{'X-CSRF-Token':auth.csrfToken}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  assert.ok(response.ok,await response.clone().text());
  return response.json();
}
async function main() {
  let checks=0;
  function pass(name){checks++;process.stdout.write(`PASS ${name}\n`);}
  const admin=await browser();
  assert.match(html(admin),/Create admin account/);
  assert.doesNotMatch(html(admin),/demo123|admin@rescueplan/);
  await submit(admin,'login-form',{name:'Ops Admin',email:'ops@gmail.com',password},()=>html(admin).includes('Recovery control'));
  assert.match(html(admin),/Saved in MongoDB/);
  assert.match(html(admin),/Ops Admin/);
  pass('first admin setup signs in and renders the shared dashboard');

  await click(admin,'[data-action="nav"][data-page="drivers"]',()=>html(admin).includes('Fleet register'));
  for(const [number,name] of [[1,'Arjun'],[2,'Ravi']]) {
    await click(admin,'[data-action="new-vehicle"]',()=>doc(admin).getElementById('vehicle-form'));
    await submit(admin,'vehicle-form',{registration:`TN 30 QA ${number}`,type:'Cargo van',capacityKg:750},()=>!doc(admin).getElementById('vehicle-form'));
    await click(admin,'[data-action="new-driver"]',()=>doc(admin).getElementById('driver-form'));
    const vehicleSelect=doc(admin).getElementById('driver-vehicle');
    await submit(admin,'driver-form',{name,email:name.toLowerCase()+'@gmail.com',password,phone:'900001000'+number,distanceKm:number*3,vehicleId:vehicleSelect.value,status:'Available'},()=>html(admin).includes(name.toLowerCase()+'@gmail.com')&&!doc(admin).getElementById('driver-form'));
  }
  pass('admin vehicle and driver forms create personal logins through the API');

  const initial=await raw(admin,'/api/state');
  const arjunId=initial.drivers.find(d=>d.name==='Arjun').id;
  const raviId=initial.drivers.find(d=>d.name==='Ravi').id;
  await click(admin,'[data-action="nav"][data-page="orders"]',()=>doc(admin).querySelector('[data-action="new-order"]'));
  await click(admin,'[data-action="new-order"]',()=>doc(admin).getElementById('order-form'));
  const deadline=new Date(Date.now()+3600000); deadline.setMinutes(deadline.getMinutes()-deadline.getTimezoneOffset());
  await submit(admin,'order-form',{customer:'Green Basket',pickup:'Central hub',destination:'Fairlands, Salem',weightKg:280,dueAt:deadline.toISOString().slice(0,16),driverId:arjunId},()=>html(admin).includes('Green Basket')&&!doc(admin).getElementById('order-form'));
  pass('new delivery form converts the local deadline and notifies the assigned driver');

  const original=await browser('driver');
  await submit(original,'login-form',{email:'arjun@gmail.com',password:'incorrect'},()=>doc(original).getElementById('login-error')?.textContent.length);
  assert.match(doc(original).getElementById('login-error').textContent,/incorrect/);
  await submit(original,'login-form',{email:'arjun@gmail.com',password},()=>html(original).includes('Hello, Arjun'));
  assert.match(html(original),/Green Basket/);
  assert.doesNotMatch(html(original),/Warehouse stock/);
  pass('driver sign-in handles errors and renders only driver controls');

  await click(original,'[data-action="update-location"]',()=>doc(original).getElementById('location-form'));
  await submit(original,'location-form',{location:'Salem central hub'},()=>!doc(original).getElementById('location-form'));
  assert.equal((await raw(admin,'/api/state')).drivers.find(d=>d.id===arjunId).location,'Salem central hub');
  await click(original,'[data-action="report-breakdown"]',()=>doc(original).getElementById('report-form'));
  await submit(original,'report-form',{type:'Engine failure',urgency:'High',location:'Kondalampatti junction',description:'Engine stopped. Cargo is safe.'},()=>html(original).includes('Engine failure')&&!doc(original).getElementById('report-form'));
  assert.match(html(original),/Unverified/);
  pass('driver location and breakdown forms persist and show report status');

  admin.window.dispatchEvent(new admin.window.Event('focus'));
  await until(()=>html(admin).includes('Disrupted'),'admin polling picks up breakdown');
  await click(admin,'[data-action="nav"][data-page="incidents"]',()=>doc(admin).querySelector('[data-action="review"]'));
  await click(admin,'[data-action="review"]',()=>doc(admin).querySelector('[data-action="verify"]'));
  await click(admin,'[data-action="verify"]',()=>doc(admin).querySelector('[data-action="generate"]'));
  await click(admin,'[data-action="generate"]',()=>doc(admin).querySelector('input[name="recovery-driver"]'));
  assert.equal(doc(admin).querySelector('input[name="recovery-driver"]:checked').value,raviId);
  await click(admin,'[data-action="approve-plan"]',()=>!doc(admin).querySelector('[role="dialog"]'));
  const assigned=(await raw(admin,'/api/state')).plans[0];
  assert.equal(assigned.assignedDriverId,raviId);
  pass('admin reviews the report, generates a server plan and assigns the replacement');

  const replacement=await browser('driver');
  await submit(replacement,'login-form',{email:'ravi@gmail.com',password},()=>html(replacement).includes('RECOVERY ASSIGNMENT'));
  assert.match(html(replacement),/Kondalampatti junction/);
  assert.match(html(replacement),/Green Basket/);
  await click(replacement,'[data-action="notifications"]',()=>doc(replacement).querySelector('[role="dialog"]'));
  assert.match(doc(replacement).getElementById('modal-root').innerHTML,/New recovery assignment/);
  await click(replacement,'[data-action="close-modal"]',()=>!doc(replacement).querySelector('[role="dialog"]'));
  for(const [before,after] of [['Accept recovery task','Confirm cargo pickup'],['Confirm cargo pickup','Complete deliveries']]) {
    assert.match(html(replacement),new RegExp(before));
    await click(replacement,'[data-action="advance-plan"]',()=>html(replacement).includes(after));
  }
  await click(replacement,'[data-action="advance-plan"]',()=>html(replacement).includes('You’re up to date'));
  const completed=await raw(admin,'/api/state');
  assert.equal(completed.plans[0].status,'Completed');
  assert.equal(completed.orders[0].status,'Delivered');
  assert.equal(completed.vehicles.find(v=>v.id===initial.drivers[0].vehicleId).status,'Breakdown');
  pass('replacement receives instructions and accepts, picks up and completes the recovery');

  await click(admin,'[data-action="nav"][data-page="stock"]',()=>doc(admin).querySelector('[data-action="new-stock"]'));
  await click(admin,'[data-action="new-stock"]',()=>doc(admin).getElementById('stock-form'));
  await submit(admin,'stock-form',{name:'<img src=x onerror=alert(1)>',category:'Other',quantity:30,unit:'units',warehouse:'Custom hub'},()=>html(admin).includes('&lt;img')&&!doc(admin).getElementById('stock-form'));
  assert.ok(!doc(admin).querySelector('img[src="x"]'));
  pass('stock form supports custom warehouses and escapes user content');

  await click(replacement,'[data-action="logout"]',()=>doc(replacement).getElementById('login-form'));
  assert.equal((await fetch(base+'/api/state',{headers:{Cookie:replacement.cookieJar.getCookieStringSync(base)}})).status,401);
  pass('sign-out removes server access');
  assert.deepEqual(errors,[]);
  process.stdout.write(`${checks} frontend DOM workflow checks passed.\n`);
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;}).finally(()=>clients.forEach(dom=>dom.window.close()));

