/* RescuePlan · plain JavaScript client for the same-origin FastAPI backend. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const icons = {
    logo: '<path d="M5 19V5h8a5 5 0 0 1 0 10H9m5 0 5 4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    truck: '<path d="M3 6h12v11H3zm12 4h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
    package: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v9M7 5.8l9 5v5"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
    warehouse: '<path d="m3 10 9-7 9 7v11H3V10Zm5 11v-8h8v8M8 17h8"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h13"/>',
    switch: '<path d="M4 7h16l-4-4M20 17H4l4 4"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    wrench: '<path d="M14 6a5 5 0 0 0-7 7l-5 5 4 4 5-5a5 5 0 0 0 7-7l-4 4-4-4 4-4Z"/>',
    file: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h6"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    weight: '<path d="M6 7h12l3 14H3L6 7Z"/><circle cx="12" cy="5" r="2"/>',
    phone: '<path d="M5 3h4l2 5-3 2c2 4 3 5 6 6l2-3 5 2v4c0 4-7 2-12-3S1 3 5 3Z"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0]).join('').toUpperCase();
  const avatar = (name, index = 0) => `<span class="avatar ${['','avatar-blue','avatar-purple','avatar-amber'][index % 4]}" aria-hidden="true">${e(initials(name))}</span>`;
  const logo = () => `<span class="logo"><span class="logo-mark">${icon('logo')}</span><span class="brand-name">RescuePlan<span style="color:var(--mint)">.</span></span></span>`;
  const time = value => new Date(value).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});
  const ago = value => { const mins = Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000)); return mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.floor(mins/60)} hr ago` : new Date(value).toLocaleDateString('en-IN'); };
  const today = () => new Date().toLocaleDateString('en-IN', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const num = value => Number(value).toLocaleString('en-IN');
  const blankState = () => ({version:1, revision:-1, drivers:[], vehicles:[], orders:[], incidents:[], plans:[], stock:[], notifications:[], activity:[], admins:[]});
  let state = blankState();
  let session = null;
  let csrfToken = '';
  let setupRequired = false;
  let loading = true;
  let disconnected = false;
  let busy = 0;
  let refreshing = false;
  let page = 'overview';
  let filter = 'All';
  let search = '';
  let toastTimer;
  let lastFocus;
  let modalCleanup;
  const entryRole = () => location.hash.match(/^#\/login\/(admin|driver)$/)?.[1] || (document.body.dataset.entry === 'driver' ? 'driver' : 'admin');
  async function api(path, method='GET', data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const headers = {};
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
    try {
      const response = await fetch(path, {method, headers, credentials:'same-origin', cache:'no-store', signal:controller.signal, ...(data !== undefined ? {body:JSON.stringify(data)} : {})});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.detail || `Request failed (${response.status}).`);
        error.status = response.status;
        if(response.status === 401 && session && path !== '/api/auth/login') {
          const role = session.role;
          session = null; csrfToken = ''; state = blankState(); closeModal();
          history.replaceState(null,'',location.pathname+`#/login/${role}`); render();
        }
        throw error;
      }
      return result;
    } catch(error) {
      if(error.name === 'AbortError' || error instanceof TypeError) throw new Error('Cannot reach the server. Start python run.py and check the MongoDB connection.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function refreshState(redraw=true) {
    const next = await api('/api/state');
    const accountChanged = session?.id !== next.user.id;
    const changed = accountChanged || next.revision !== state.revision || disconnected;
    if(accountChanged) csrfToken=(await api('/api/auth/me')).csrfToken;
    state = next; session = next.user; disconnected = false;
    if(accountChanged) { closeModal(); page='overview'; filter='All'; search=''; }
    if(redraw && changed) render();
    return state;
  }
  async function mutation(path, method='POST', data={}) {
    const result = await api(path, method, data);
    await refreshState(false);
    return result;
  }
  function connectionScreen(message='Connecting to your operations workspace…', retry=false) {
    app.innerHTML = `<main class="connection-screen">${logo()}<h1>${retry?'Connection needed':'Opening RescuePlan'}</h1><p>${e(message)}</p>${retry?'<button class="btn btn-primary" data-action="retry-connection">Try again</button>':''}</main>`;
  }
  async function boot() {
    loading=true; connectionScreen();
    try {
      setupRequired = (await api('/api/auth/setup-status')).setupRequired;
      try {
        const auth = await api('/api/auth/me');
        session=auth.user; csrfToken=auth.csrfToken; await refreshState(false);
      } catch(error) { if(error.status !== 401) throw error; session=null; csrfToken=''; state=blankState(); }
      if(setupRequired && entryRole() !== 'admin') history.replaceState(null,'',location.pathname+'#/login/admin');
      const requested = ['admin','driver'].includes(document.body.dataset.entry) ? document.body.dataset.entry : null;
      if(session && !location.hash && requested && requested !== session.role) history.replaceState(null,'',location.pathname+`#/login/${requested}`);
      loading=false; disconnected=false; render();
    } catch(error) {loading=false; disconnected=true; connectionScreen(error.message,true);}
  }
  const driver = id => state.drivers.find(d => d.id === id);
  const vehicle = id => state.vehicles.find(v => v.id === id);
  const incident = id => state.incidents.find(i => i.id === id);
  const plan = id => state.plans.find(p => p.id === id);
  const currentDriver = () => driver(session?.driverId);
  const liveIncidents = () => state.incidents.filter(i => !['Resolved','Rejected'].includes(i.status));
  const availableDrivers = () => state.drivers.filter(d => d.status === 'Available' && vehicle(d.vehicleId)?.status === 'Ready' && !state.orders.some(o => o.driverId === d.id && ['Assigned','In transit','Disrupted'].includes(o.status)));
  const visibleNotifications = () => state.notifications.filter(n => n.target === (session?.role === 'admin' ? 'admin' : session?.driverId));
  function assertRole(role) { if(session?.role !== role) throw new Error(`Open the ${role} portal to complete this action.`); }
  function flash(message) {
    clearTimeout(toastTimer);
    toastRoot.innerHTML = `<div class="toast">${icon('checkCircle')}<span>${e(message)}</span></div>`;
    toastTimer = setTimeout(() => { toastRoot.innerHTML = ''; },4200);
  }
  function badge(status) {
    const colors = { Available:'green',Ready:'green',Delivered:'green',Resolved:'green',Completed:'green',Verified:'green','In stock':'green','Low stock':'amber','Out of stock':'red',Assigned:'blue','In transit':'blue','On delivery':'blue','On recovery':'blue',Accepted:'blue','Picked up':'blue',Draft:'gray',Unverified:'amber',High:'red',Normal:'blue',Low:'gray',Disrupted:'red',Breakdown:'red',Rejected:'gray','Off duty':'gray','In use':'blue' };
    return `<span class="badge badge-${colors[status] || 'gray'}">${e(status)}</span>`;
  }
  function empty(title,text,iconName='checkCircle',action='') {
    return `<div class="empty-state"><div class="empty-symbol">${icon(iconName)}</div><h3>${e(title)}</h3><p>${e(text)}</p>${action}</div>`;
  }
  function stat(label,value,note,iconName,tone='') {
    return `<div class="stat-card ${tone}"><div class="stat-top"><span class="stat-label">${e(label)}</span><span class="stat-icon">${icon(iconName)}</span></div><div class="stat-value">${num(value)}</div><div class="stat-bottom">${e(note)}</div></div>`;
  }
  function heading(title,subtitle,actions='') {
    return `<div class="page-heading"><div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`;
  }
  const adminNav = [ ['overview','grid','Recovery control'],['incidents','alert','Breakdown reports'],['plans','route','Recovery plans'],['orders','package','Deliveries'],['drivers','users','Drivers & vehicles'],['stock','warehouse','Warehouse stock'] ];
  const driverNav = [ ['overview','grid','My dashboard'],['tasks','truck','My assignments'],['reports','file','My reports'] ];
  function render() {
    const authHash = location.hash.match(/^#\/login\/(admin|driver)$/);
    if (!session || authHash) {
      const role = authHash?.[1] || (document.body.dataset.entry === 'driver' ? 'driver' : 'admin');
      renderLogin(role); return;
    }
    const isAdmin = session.role === 'admin';
    const nav = isAdmin ? adminNav : driverNav;
    if (!nav.some(n=>n[0]===page)) page='overview';
    const name = session.name;
    const pageLabel = nav.find(n=>n[0]===page)[2];
    const unread = visibleNotifications().filter(n=>!n.read).length;
    const pageHtml = isAdmin ? ({overview:overview,incidents:incidentsPage,plans:plansPage,orders:ordersPage,drivers:driversPage,stock:stockPage}[page])() : ({overview:driverDashboard,tasks:tasksPage,reports:reportsPage}[page])();
    document.title = `RescuePlan · ${pageLabel}`;
    app.innerHTML = `<div class="shell"><div class="mobile-backdrop" data-action="close-menu"></div><aside class="sidebar" id="sidebar" aria-label="Main navigation">${logo()}<div class="workspace"><div class="workspace-symbol">${icon('warehouse')}</div><div><strong>Salem operations</strong><span>${isAdmin ? 'Admin workspace' : 'Driver workspace'}</span></div></div><div class="nav-label">${isAdmin ? 'OPERATIONS' : 'MY WORKSPACE'}</div><nav class="nav-list">${nav.map(([id,ic,label])=>`<button class="nav-item ${page===id?'active':''}" data-action="nav" data-page="${id}" aria-label="${label}" title="${label}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span>${id==='incidents'&&liveIncidents().length?`<span class="nav-count">${liveIncidents().length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-footer">${avatar(name)}<div><strong>${e(name)}</strong><span>${isAdmin?'Administrator':'Delivery driver'}</span></div></div><button class="nav-item" data-action="logout" aria-label="Sign out" title="Sign out">${icon('logout')}<span>Sign out</span></button></div></aside><div class="main-shell"><header class="topbar"><div class="flex"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb"><span class="crumb-root">${isAdmin?'Workspace':'Driver portal'}</span>${icon('chevron','crumb-divider')}<strong>${e(pageLabel)}</strong></div></div><div class="top-actions"><span class="demo-label">${disconnected?'Connection lost':'Connected'}</span><button class="btn btn-light btn-sm" data-action="switch">${icon('switch')}<span>Switch portal</span></button><button class="icon-btn" data-action="notifications" aria-label="Notifications${unread?`, ${unread} unread`:''}">${icon('bell')}${unread?'<span class="notification-dot"></span>':''}</button><span class="divider"></span>${avatar(name)}</div></header><main class="content" id="main" tabindex="-1">${pageHtml}<footer class="content-footer"><span>RescuePlan · Salem delivery operations</span><span class="flex">${icon('shield')}${disconnected?'Retrying connection…':'Saved in MongoDB · Updates every 5 sec'}</span></footer></main></div></div>`;
  }
  function renderLogin(role) {
    const admin = role === 'admin';
    const setup = admin && setupRequired;
    document.title = `RescuePlan · ${setup?'Create admin':admin?'Admin login':'Driver login'}`;
    app.innerHTML = `<main class="auth-layout"><section class="auth-story">${logo()}<div class="auth-topline"><span>DELIVERY RECOVERY</span><span>SALEM / TN</span></div><h1>Breakdown.<br>Handover.<br><em>Back on route.</em></h1><p>A clear next step for every disrupted delivery.</p><div class="auth-network"><div class="auth-network-head"><span>THE RECOVERY JOURNEY</span><span class="mono">01 — 04</span></div><div class="auth-journey">${[['01','file','Report','Driver logs the breakdown.'],['02','shield','Verify','Admin checks the report.'],['03','route','Assign','A replacement driver takes over.'],['04','checkCircle','Deliver','The cargo reaches its destination.']].map(([n,ic,title,copy])=>`<div class="auth-step"><span class="journey-number">${n}</span>${icon(ic)}<strong>${title}</strong><span>${copy}</span></div>`).join('')}</div></div><div class="auth-story-footer"><span>RescuePlan / Operations workspace</span><span>Every delivery has a next step.</span></div></section><section class="auth-form-side"><nav class="portal-tabs" aria-label="Login portals"><a href="admin-login.html" class="${admin?'active':''}" ${admin?'aria-current="page"':''}>${icon('shield')}Admin login</a><a href="driver-login.html" class="${admin?'':'active'}" ${admin?'':'aria-current="page"'}>${icon('truck')}Driver login</a></nav><div class="auth-form"><div class="auth-access"><span class="mono">${setup?'FIRST / ADMIN':admin?'01 / ADMIN':'02 / DRIVER'}</span><span class="auth-symbol">${icon(admin?'shield':'truck')}</span></div><h2>${setup?'Start your control room.':admin?'Make the next move.':'Your route starts here.'}</h2><p>${setup?'Create the first administrator account for this workspace.':admin?'Verify reports and coordinate a recovery.':'View your assignments and report a breakdown.'}</p><form id="login-form" data-role="${role}" data-setup="${setup}">${setup?'<div class="field"><label for="login-name">Your name</label><input id="login-name" name="name" autocomplete="name" required maxlength="80"></div>':''}<div class="field"><label for="login-email">Email address</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="you@gmail.com" maxlength="120" required></div><div class="field"><label for="login-password">Password</label><div class="input-password"><input id="login-password" name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" ${setup?'minlength="10"':''} maxlength="128" required><button type="button" class="icon-btn" data-action="toggle-password" aria-label="Show password">${icon('eye')}</button></div>${setup?'<span class="field-help">Use at least 10 characters.</span>':''}</div><div class="form-error" id="login-error" role="alert"></div><button class="btn btn-primary btn-wide" type="submit">${setup?'Create admin account':`Sign in as ${admin?'admin':'driver'}`}</button></form><div class="demo-hint"><strong>${setup?'Your own account':admin?'Your operations workspace':'Need an account?'}</strong>${setup?'Use your email address and choose a password.':admin?'An existing administrator can add another admin from Drivers & vehicles.':'Ask your admin to create your driver account with your email and a password.'}</div><div class="auth-form-footer">${admin?'One shared workspace for all admins.':'A personal workspace for each driver.'}${session?`<button class="text-link" data-action="return-workspace">Return to ${e(session.name)}’s dashboard</button>`:''}</div></div><footer class="auth-bottom"><span>© ${new Date().getFullYear()} RescuePlan</span><span>Local operations</span></footer></section></main>`;
  }
  function missionTimeline(i) {
    const stages=['Report logged','Verified','Plan ready','Driver assigned','Delivered'];
    const stage=i?({Unverified:0,Verified:1,Draft:2,Assigned:3,'Picked up':3,Resolved:4}[i.status]??0):-1;
    return `<ol class="mission-timeline" aria-label="Recovery progress">${stages.map((name,n)=>`<li class="${n<stage?'done':n===stage?'current':''}"><span class="mission-step">${n<stage?icon('check'):String(n+1).padStart(2,'0')}</span><span>${name}</span>${n===stage?'<span class="sr-only">Current stage</span>':''}</li>`).join('')}</ol>`;
  }

  function networkMap() {
    const i=liveIncidents()[0];
    const p=i?state.plans.find(p=>p.incidentId===i.id):null;
    const ready=driver(p?.assignedDriverId||p?.selectedDriverId)||availableDrivers()[0];
    return `<div class="network command-network"><div class="map-caption"><span>SALEM RECOVERY NETWORK</span><span>Location schematic</span></div><svg class="network-svg" viewBox="0 0 720 340" role="img" aria-labelledby="map-title map-desc"><title id="map-title">Recovery handover network</title><desc id="map-desc">Illustrative connections between the hub, reported breakdown, recovery driver and delivery destinations. This is not a live geographic map.</desc><defs><pattern id="map-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0v36" fill="none" stroke="#ffffff09"/></pattern></defs><rect width="720" height="340" fill="url(#map-grid)"/><g fill="none" stroke="#546078" stroke-width="2"><path d="M106 104h65l139 74h104l175-84"/><path d="M105 265h94l111-87"/><path d="M414 178h90l85 82"/></g><path class="route-flow" d="M105 265h94l111-87h104l175-84" fill="none" stroke="#cefb64" stroke-width="3" stroke-dasharray="7 7"/><path d="M414 178h90l85 82" fill="none" stroke="#a797f9" stroke-width="2.5" stroke-dasharray="6 6"/><g><rect x="88" y="86" width="36" height="36" rx="10" fill="#384561" stroke="#677794"/><path d="m97 104 9-7 9 7v9H97v-9m5 9v-7h8v7" stroke="#dde7f5" fill="none" stroke-width="1.7"/><text x="38" y="148" fill="#d6deef" font-size="15">Central hub</text><text x="38" y="169" fill="#8e9db9" font-size="12">DISPATCH ORIGIN</text></g><g><rect x="87" y="247" width="36" height="36" rx="10" fill="#d0fb69"/><path d="M95 256h13v11H95Zm13 4h5l4 4v3h-9" fill="none" stroke="#1b253c" stroke-width="1.8"/><circle cx="99" cy="269" r="2" fill="#1b253c"/><circle cx="113" cy="269" r="2" fill="#1b253c"/><text x="145" y="303" fill="#d0fb69" font-size="14">${e(ready?.name||'No driver available')}</text><text x="145" y="323" fill="#8e9db9" font-size="12">${p?.assignedDriverId?'ASSIGNED DRIVER':'RECOVERY CANDIDATE'}</text></g><g><circle cx="310" cy="178" r="35" fill="#f2b98910" stroke="#f2b98935"/><rect x="291" y="159" width="38" height="38" rx="12" fill="#f2b989"/><path d="m310 166 10 19h-20l10-19Zm0 6v6m0 4h.01" fill="none" stroke="#503624" stroke-width="1.8"/><text x="255" y="126" fill="#f3c7a3" font-size="14">${i?'Reported breakdown':'No active incident'}</text></g><g><rect x="573" y="78" width="32" height="32" rx="9" fill="#d0fb69"/><path d="m582 94 5 5 9-11" fill="none" stroke="#1b253c" stroke-width="2"/><text x="559" y="58" fill="#d6deef" font-size="14">Delivery 01</text><rect x="573" y="244" width="32" height="32" rx="9" fill="#a797f9"/><path d="m582 260 5 5 9-11" fill="none" stroke="#1b253c" stroke-width="2"/><text x="549" y="299" fill="#d6deef" font-size="14">Delivery 02</text></g></svg><div class="map-legend"><span class="legend-item"><span class="legend-line"></span>Recovery handover</span><span class="legend-item"><span class="legend-square amber"></span>Breakdown</span><span class="legend-item">Illustrative locations</span></div></div>`;
  }

  function overview() {
    const active=liveIncidents();
    const first=active[0];
    const currentPlan=first?state.plans.find(p=>p.incidentId===first.id):null;
    const count=value=>String(value).padStart(2,'0');
    const metrics=[['Active deliveries',state.orders.filter(o=>o.status!=='Delivered').length],['Open incidents',active.length],['Drivers ready',availableDrivers().length],['Completed',state.orders.filter(o=>o.status==='Delivered').length]];
    return `<div class="command-heading"><div><div class="eyebrow">OPERATIONS / SALEM</div><h1>Recovery control<span class="title-period">.</span></h1></div><div class="heading-actions"><span class="date-label">${icon('calendar')}${today()}</span><button class="btn btn-primary" data-action="new-order">${icon('plus')}New delivery</button></div></div><div class="command-metrics">${metrics.map(([label,value],n)=>`<div><span class="metric-index">0${n+1}</span><strong>${count(value)}</strong><span>${label}</span></div>`).join('')}</div><div class="command-board"><section class="mission-canvas"><div class="mission-head"><div><div class="eyebrow">${first?'ACTIVE REPORT / '+e(first.id):'RECOVERY NETWORK'}</div><h2>${first?e(first.type):'Every delivery, on course.'}</h2><p>${first?`${e(driver(first.driverId)?.name)} · ${e(first.location)}`:'No open breakdown reports in your workspace.'}</p></div>${first?badge(first.urgency):badge('Available')}</div>${networkMap()}<div class="mission-bottom"><div class="mission-bottom-title"><strong>Recovery journey</strong><span>${currentPlan?e(currentPlan.status):first?'Awaiting verification':'No active recovery'}</span></div>${missionTimeline(first)}</div></section><aside class="recovery-inbox"><div class="inbox-heading"><span class="eyebrow">NEXT ACTION</span><div class="flex between"><h2>Recovery queue</h2><span class="inbox-number">${count(active.length)}</span></div></div>${active.length?active.slice(0,2).map(queueCard).join(''):empty('All clear','New driver reports will arrive here.','shield')}<div class="queue-footer">${icon('shield')}Admin approval before assignment</div></aside></div><section class="dispatch-roster"><div class="roster-heading"><span class="eyebrow">YOUR DRIVERS</span><button class="text-link" data-action="nav" data-page="drivers">Manage team</button></div><div class="driver-ribbon">${state.drivers.map((d,n)=>`<button class="driver-token ${d.status==='Available'?'ready':''}" data-action="edit-driver" data-id="${e(d.id)}"><span class="token-number">0${n+1}</span>${avatar(d.name,n)}<span><strong>${e(d.name)}</strong><span class="token-status">${e(d.status)}</span></span>${icon(d.status==='Available'?'checkCircle':d.status==='Breakdown'?'wrench':'truck')}</button>`).join('')}</div></section><div class="lower-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">DELIVERIES</div><h2>Delivery board</h2></div><button class="text-link" data-action="nav" data-page="orders">View all</button></div>${orderTable(state.orders.slice(0,5),false)}<div class="table-foot">${Math.min(5,state.orders.length)} of ${state.orders.length} deliveries</div></section><section class="panel"><div class="panel-head"><div><div class="eyebrow">WORKSPACE UPDATES</div><h2>Recent activity</h2></div>${icon('clock')}</div><div class="activity-list">${state.activity.slice(0,4).map(activityItem).join('')}</div></section></div>`;
  }

  function queueCard(i) {
    const action = i.status==='Unverified'?'Review report':i.status==='Verified'?'Generate recovery plan':i.status==='Draft'?'Review recovery plan':'View recovery';
    const actionName = i.status==='Verified'?'generate':i.status==='Draft'?'open-plan':'review';
    const p = state.plans.find(p=>p.incidentId===i.id && p.status!=='Completed');
    const load = i.orderIds.reduce((sum,id)=>sum+(state.orders.find(o=>o.id===id)?.weightKg||0),0);
    return `<article class="queue-card ${i.status!=='Unverified'?'selected':''}"><div class="queue-title"><span class="mono">${e(i.id)}</span>${badge(i.urgency)}</div><h3>${e(i.type)}</h3><p>${e(driver(i.driverId)?.name)} · ${e(vehicle(i.vehicleId)?.registration)}</p><div class="queue-meta">${icon('pin')}${e(i.location)}</div><div class="queue-meta">${icon('package')}${i.orderIds.length} deliveries · ${num(load)} kg on board</div><div class="queue-meta">${icon('clock')}Reported ${ago(i.reportedAt)}</div><div class="flex between" style="margin-top:9px">${badge(i.status)}</div><button class="btn btn-${i.status==='Unverified'?'light':'primary'} btn-wide" data-action="${actionName}" data-id="${e(actionName==='open-plan'?p?.id:i.id)}">${icon(i.status==='Unverified'?'file':'route')}${action}</button></article>`;
  }
  function activityItem(a) { return `<div class="activity-item"><span class="activity-icon">${icon(a.icon)}</span><div><p>${e(a.text)}</p><time datetime="${e(a.createdAt)}">${ago(a.createdAt)}</time></div></div>`; }
  function orderTable(orders,withActions=true) {
    if(!orders.length) return empty('No matching deliveries','Try a different filter or add a delivery.','package');
    return `<div class="table-wrap"><table><caption class="sr-only">Delivery orders</caption><thead><tr><th>Delivery</th><th>Driver</th><th>Status</th><th>Due</th>${withActions?'<th><span class="sr-only">Actions</span></th>':''}</tr></thead><tbody>${orders.map(o=>`<tr><td><strong class="mono">${e(o.id)}</strong><span class="cell-sub">${e(o.customer)}</span></td><td>${e(driver(o.driverId)?.name||'Unassigned')}</td><td>${badge(o.status)}</td><td>${time(o.dueAt)}</td>${withActions?`<td><button class="text-link" data-action="order-detail" data-id="${e(o.id)}">Details</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
  }
  function filterBar(tabs,placeholder) {
    return `<div class="filter-bar"><div class="tabs" aria-label="Filter by status">${tabs.map(t=>`<button class="tab ${filter===t?'active':''}" data-action="filter" data-filter="${e(t)}" aria-pressed="${filter===t}">${e(t)}</button>`).join('')}</div><div class="search-field">${icon('search')}<label class="sr-only" for="list-search">${e(placeholder)}</label><input id="list-search" type="search" placeholder="${e(placeholder)}" value="${e(search)}"></div></div>`;
  }
  const matches = text => String(text).toLowerCase().includes(search.toLowerCase().trim());
  function incidentsPage() {
    const list = state.incidents.filter(i=>(filter==='All'||(filter==='Open'&&!['Resolved','Rejected'].includes(i.status))||filter===i.status)&&matches(`${i.id} ${i.type} ${i.location} ${driver(i.driverId)?.name}`));
    return `${heading('Breakdown reports','Verify a report before creating a recovery plan.')}<section class="panel">${filterBar(['All','Open','Unverified','Resolved'],'Search reports…')}${list.length?`<div class="table-wrap"><table><caption class="sr-only">Driver breakdown reports</caption><thead><tr><th>Report</th><th>Driver / location</th><th>Affected</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>${list.map(i=>`<tr><td><strong class="mono">${e(i.id)}</strong><span class="cell-sub">${e(i.type)}</span></td><td><strong>${e(driver(i.driverId)?.name)}</strong><span class="cell-sub">${e(i.location)}</span></td><td>${i.orderIds.length} deliveries</td><td>${badge(i.urgency)}</td><td>${badge(i.status)}</td><td><button class="text-link" data-action="review" data-id="${e(i.id)}">Review</button></td></tr>`).join('')}</tbody></table></div>`:empty('No reports here','Reports matching your selection will appear here.','shield')}</section>`;
  }
  function plansPage() {
    return `${heading('Recovery plans','Compare available drivers, approve a plan and track the handover.')}<div class="stack">${state.plans.length?state.plans.slice().reverse().map(p=>`<article class="panel plan-card"><div class="flex between"><div><span class="eyebrow">${e(p.id)}</span><h2>${e(incident(p.incidentId)?.type)} · ${e(p.incidentId)}</h2></div>${badge(p.status)}</div><dl class="detail-list"><div><dt>Recovery driver</dt><dd>${e(driver(p.assignedDriverId||p.selectedDriverId)?.name||'Choose a driver')}</dd></div><div><dt>Affected deliveries</dt><dd>${p.orderIds.length} · ${num(p.totalWeightKg)} kg</dd></div><div><dt>Pickup location</dt><dd>${e(incident(p.incidentId)?.location)}</dd></div></dl><button class="btn btn-${p.status==='Draft'?'primary':'light'}" data-action="open-plan" data-id="${e(p.id)}">${icon('route')}${p.status==='Draft'?'Review & approve':'View plan'}</button></article>`).join(''):empty('No recovery plans yet','Verify a breakdown report, then generate a plan from the report.','route',`<button class="btn btn-primary" data-action="nav" data-page="incidents">Review breakdown reports</button>`)}</div>`;
  }
  function ordersPage() {
    const list = state.orders.filter(o=>(filter==='All'||filter===o.status)&&matches(`${o.id} ${o.customer} ${o.destination} ${driver(o.driverId)?.name}`));
    return `${heading('Deliveries','Manage delivery details and follow each order to completion.',`<button class="btn btn-primary" data-action="new-order">${icon('plus')}New delivery</button>`)}<section class="panel">${filterBar(['All','Assigned','In transit','Disrupted','Delivered'],'Search deliveries…')}${orderTable(list)}<div class="table-foot">${list.length} matching ${list.length===1?'delivery':'deliveries'}</div></section>`;
  }
  function driversPage() {
    const list = state.drivers.filter(d=>matches(`${d.name} ${d.email} ${vehicle(d.vehicleId)?.registration}`));
    return `${heading('Drivers & vehicles','Know who is ready and keep your fleet details up to date.',`<button class="btn btn-light" data-action="new-admin">${icon('shield')}Add admin</button><button class="btn btn-light" data-action="new-vehicle">${icon('truck')}Add vehicle</button><button class="btn btn-primary" data-action="new-driver">${icon('plus')}Add driver</button>`)}<div class="filter-bar" style="background:white;border:1px solid var(--line);border-radius:12px;margin-bottom:20px"><span class="small muted">${availableDrivers().length} available · ${state.drivers.length} drivers · ${state.vehicles.length} vehicles</span><div class="search-field">${icon('search')}<label class="sr-only" for="list-search">Search drivers or vehicles</label><input id="list-search" type="search" placeholder="Search drivers or vehicles…" value="${e(search)}"></div></div><div class="card-grid">${list.map((d,n)=>`<article class="panel driver-card"><div class="flex between">${avatar(d.name,n)}${badge(d.status)}</div><h3>${e(d.name)}</h3><p class="small muted">${e(d.email)}</p><dl class="detail-list"><div><dt>Vehicle</dt><dd>${e(vehicle(d.vehicleId)?.registration||'Not assigned')}</dd></div><div><dt>Type</dt><dd>${e(vehicle(d.vehicleId)?.type||'—')}</dd></div><div><dt>Payload</dt><dd>${vehicle(d.vehicleId)?num(vehicle(d.vehicleId).capacityKg)+' kg':'—'}</dd></div><div><dt>Vehicle status</dt><dd>${badge(vehicle(d.vehicleId)?.status||'Unassigned')}</dd></div><div><dt>Last location</dt><dd>${e(d.location||'Not shared')}${d.locationUpdatedAt?`<span class="cell-sub">${ago(d.locationUpdatedAt)}</span>`:''}</dd></div></dl><button class="btn btn-light btn-wide" data-action="edit-driver" data-id="${e(d.id)}">Manage driver</button></article>`).join('')}</div>${!list.length?empty('No matching drivers','Try searching by name, email or registration.','users'):''}<section class="panel" style="margin-top:24px"><div class="panel-head"><div><h2>Fleet register</h2><p>All vehicles, including unassigned vehicles</p></div></div><div class="table-wrap"><table><caption class="sr-only">Vehicle fleet</caption><thead><tr><th>Registration</th><th>Type</th><th>Payload</th><th>Driver</th><th>Status</th></tr></thead><tbody>${state.vehicles.map(v=>`<tr><td><strong>${e(v.registration)}</strong></td><td>${e(v.type)}</td><td>${num(v.capacityKg)} kg</td><td>${e(state.drivers.find(d=>d.vehicleId===v.id)?.name||'Unassigned')}</td><td>${badge(v.status)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function stockPage() {
    const list = state.stock.filter(s=>matches(`${s.name} ${s.category} ${s.warehouse}`));
    return `${heading('Warehouse stock','Admins manage available stock across the delivery hubs.',`<button class="btn btn-primary" data-action="new-stock">${icon('plus')}Add stock item</button>`)}<section class="panel">${filterBar(['All'],'Search stock…')}${list.length?`<div class="table-wrap"><table><caption class="sr-only">Warehouse inventory</caption><thead><tr><th>Item</th><th>Warehouse</th><th>Available</th><th>Stock level</th><th></th></tr></thead><tbody>${list.map(s=>`<tr><td><strong>${e(s.name)}</strong><span class="cell-sub">${e(s.category)}</span></td><td>${e(s.warehouse)}</td><td>${num(s.quantity)} ${e(s.unit)}</td><td>${badge(s.quantity===0?'Out of stock':s.quantity<20?'Low stock':'In stock')}</td><td><button class="text-link" data-action="edit-stock" data-id="${e(s.id)}">Update stock</button></td></tr>`).join('')}</tbody></table></div>`:empty('No matching stock items','Add a stock item or try another search.','warehouse')}</section>`;
  }
  function driverDashboard() {
    const d=currentDriver();
    const active=state.orders.filter(o=>o.driverId===d.id&&o.status!=='Delivered');
    const complete=state.orders.filter(o=>o.driverId===d.id&&o.status==='Delivered');
    const ownReports=state.incidents.filter(i=>i.driverId===d.id);
    return `<div class="command-heading"><div><div class="eyebrow">DRIVER / SALEM</div><h1>My dashboard<span class="title-period">.</span></h1></div><span class="date-label">${icon('calendar')}${today()}</span></div><div class="driver-welcome"><div class="driver-pass-main"><div class="eyebrow">YOUR SHIFT / ${e(vehicle(d.vehicleId)?.registration||'NO VEHICLE')}</div><h2>Hello, ${e(d.name.split(' ')[0])}.</h2><p>${active.length?'Your next pickup and handover are below.':'Your next assignment will appear here.'}</p><div class="heading-actions">${badge(d.status)}<button class="btn btn-light" data-action="update-location">${icon('pin')}Update location</button><button class="btn btn-light" data-action="report-breakdown">${icon('alert')}Report a breakdown</button></div></div><div class="driver-pass-count"><span>ON YOUR BOARD</span><strong>${String(active.length).padStart(2,'0')}</strong><span>${active.length===1?'ACTIVE DELIVERY':'ACTIVE DELIVERIES'}</span></div></div><div class="stats-grid driver-stats">${stat('My active deliveries',active.length,'Assigned to you','package')}${stat('Completed',complete.length,'Recorded deliveries','checkCircle','green-stat')}${stat('My reports',ownReports.length,`${ownReports.filter(i=>!['Resolved','Rejected'].includes(i.status)).length} open reports`,'file')}</div><div class="driver-layout"><section class="stack"><div class="panel assignment-panel"><div class="panel-head"><div><div class="eyebrow">YOUR NEXT MOVE</div><h2>Current assignments</h2><p>Pickup and delivery instructions</p></div>${icon('route')}</div>${driverAssignments(d.id)}</div></section><section class="stack"><div class="panel vehicle-panel"><div class="panel-head"><div><div class="eyebrow">FLEET DETAILS</div><h2>My vehicle</h2></div>${icon('truck')}</div><div class="panel-body"><h3>${e(vehicle(d.vehicleId)?.registration||'No vehicle assigned')}</h3><dl class="detail-list"><div><dt>Type</dt><dd>${e(vehicle(d.vehicleId)?.type||'—')}</dd></div><div><dt>Capacity</dt><dd>${num(vehicle(d.vehicleId)?.capacityKg||0)} kg</dd></div><div><dt>Status</dt><dd>${badge(vehicle(d.vehicleId)?.status||'Unassigned')}</dd></div></dl></div></div><div class="panel"><div class="panel-head"><h2>My latest report</h2><button class="text-link" data-action="nav" data-page="reports">View all</button></div>${ownReports.length?reportSummary(ownReports[ownReports.length-1]):empty('No reports submitted','Report a breakdown so admin can coordinate help.','file')}</div></section></div>`;
  }

  function tasksPage() {
    const d = currentDriver();
    const completed = state.orders.filter(o=>o.driverId===d.id&&o.status==='Delivered');
    return `${heading('My assignments','Your pickup instructions, delivery details and progress.')}<div class="panel">${driverAssignments(d.id)}</div><section class="panel" style="margin-top:23px"><div class="panel-head"><h2>Completed deliveries</h2></div>${completed.length?orderTable(completed):empty('No completed deliveries yet','Completed jobs will appear here.','checkCircle')}</section>`;
  }
  function progress(p) {
    const stages = ['Assigned','Accepted','Picked up','Completed'];
    const index = stages.indexOf(p.status);
    return `<div class="progress-steps" aria-label="Recovery progress: ${e(p.status)}">${stages.map((s,n)=>`<div class="progress-step ${n<=index?'done':''}"><span class="step-circle">${n<=index?icon('check'):n+1}</span><span>${s}</span></div>`).join('')}</div>`;
  }
  function driverAssignments(id) {
    const plans = state.plans.filter(p=>p.assignedDriverId===id&&p.status!=='Completed');
    const ordinary = state.orders.filter(o=>o.driverId===id&&!o.recoveryPlanId&&!['Delivered','Disrupted'].includes(o.status));
    const disrupted = state.orders.filter(o=>o.driverId===id&&o.status==='Disrupted');
    if (!plans.length&&!ordinary.length&&!disrupted.length) return empty('You’re up to date','You will receive a notification when admin assigns a delivery or recovery task.','truck');
    return `${plans.map(p=>recoveryTask(p)).join('')}${ordinary.map(o=>`<article class="driver-task"><div class="flex between"><span class="mono">${e(o.id)}</span>${badge(o.status)}</div><h3 style="margin-top:14px">${e(o.customer)}</h3><div class="route-stops"><div class="route-stop"><span class="stop-icon">${icon('warehouse')}</span><div><strong>Pickup · ${e(o.pickup)}</strong><p>${num(o.weightKg)} kg to collect</p></div></div><div class="route-stop"><span class="stop-icon">${icon('pin')}</span><div><strong>Deliver · ${e(o.destination)}</strong><p>Due ${time(o.dueAt)}</p></div></div></div><div class="task-actions"><button class="btn btn-primary" data-action="update-order" data-id="${e(o.id)}">${icon(o.status==='Assigned'?'package':'checkCircle')}${o.status==='Assigned'?'Confirm pickup':'Mark delivered'}</button></div></article>`).join('')}${disrupted.length?`<div class="panel-body"><div class="plan-note">${disrupted.length} ${disrupted.length===1?'delivery is':'deliveries are'} paused because of your breakdown report. Admin will coordinate the replacement driver.</div></div>`:''}`;
  }
  function recoveryTask(p) {
    const i = incident(p.incidentId);
    const button = {Assigned:'Accept recovery task',Accepted:'Confirm cargo pickup','Picked up':'Complete deliveries'}[p.status];
    return `<article class="driver-task"><div class="flex between"><span class="eyebrow" style="margin:0">RECOVERY ASSIGNMENT</span>${badge(p.status)}</div><h3 style="margin-top:13px">Take over ${p.orderIds.length} ${p.orderIds.length===1?'delivery':'deliveries'}</h3><p class="small muted" style="margin-top:5px">${e(p.id)} · Assigned by admin</p>${progress(p)}<div class="route-stops"><div class="route-stop"><span class="stop-icon">${icon('truck')}</span><div><strong>Collect from ${e(driver(i.driverId)?.name)}</strong><p>${e(i.location)}</p><p>${num(p.totalWeightKg)} kg · ${e(driver(i.driverId)?.phone)}</p></div></div>${p.orderIds.map(id=>state.orders.find(o=>o.id===id)).filter(Boolean).map(o=>`<div class="route-stop"><span class="stop-icon">${icon('pin')}</span><div><strong>${e(o.customer)}</strong><p>${e(o.destination)} · ${num(o.weightKg)} kg</p><p>${e(o.id)} · Due ${time(o.dueAt)}</p></div></div>`).join('')}</div>${button?`<div class="task-actions"><button class="btn btn-primary" data-action="advance-plan" data-id="${e(p.id)}">${icon(p.status==='Picked up'?'checkCircle':'truck')}${button}</button></div>`:''}</article>`;
  }
  function reportSummary(i) {
    const p = state.plans.find(p=>p.incidentId===i.id);
    return `<div class="panel-body"><div class="flex between"><span class="mono">${e(i.id)}</span>${badge(i.status)}</div><h3 style="margin-top:15px">${e(i.type)}</h3><p class="small muted" style="margin-top:6px">${e(i.location)}</p><p class="small muted" style="margin-top:8px">${p?.assignedDriverId?`Recovery driver: ${e(driver(p.assignedDriverId)?.name)}`:i.status==='Rejected'?`Reason: ${e(i.rejectionReason)}`:i.status==='Resolved'?'This report is closed.':'Admin will review your report and coordinate the next step.'}</p><p class="tiny muted" style="margin-top:10px">Submitted ${ago(i.reportedAt)}</p></div>`;
  }
  function reportsPage() {
    const list = state.incidents.filter(i=>i.driverId===session.driverId).slice().reverse();
    return `${heading('My reports','Follow the status of the breakdowns you have reported.',`<button class="btn btn-primary" data-action="report-breakdown">${icon('plus')}Report breakdown</button>`)}<div class="card-grid">${list.map(i=>`<article class="panel"><div class="panel-head"><h2>${e(i.id)}</h2>${badge(i.urgency)}</div>${reportSummary(i)}<div class="panel-body small muted">${e(i.description)}</div></article>`).join('')}</div>${!list.length?`<div class="panel">${empty('No reports yet','Submit a report if a breakdown stops your deliveries.','file')}</div>`:''}`;
  }
  function openModal(title,subtitle,body,footer='',wide=false) {
    if (modalCleanup) modalCleanup();
    lastFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><div class="modal-head"><div><h2 id="dialog-title">${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:''}</section></div>`;
    document.body.style.overflow = 'hidden';
    const dialog = modalRoot.querySelector('[role="dialog"]');
    const first = dialog.querySelector('input:not([type="hidden"]),select,textarea,button');
    (first||dialog).focus();
    const trap = event => {
      if(event.key === 'Escape') { closeModal(); return; }
      if(event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>!el.hidden);
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const firstItem = items[0]; const lastItem = items[items.length-1];
      if(event.shiftKey && (document.activeElement===firstItem||document.activeElement===dialog)) {event.preventDefault();lastItem.focus();}
      else if(!event.shiftKey && (document.activeElement===lastItem||document.activeElement===dialog)) {event.preventDefault();firstItem.focus();}
    };
    document.addEventListener('keydown',trap);
    modalCleanup = () => document.removeEventListener('keydown',trap);
  }
  function closeModal() {
    if(modalCleanup) modalCleanup();
    modalCleanup = null;
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
    if(lastFocus?.isConnected) lastFocus.focus();
    else document.getElementById('main')?.focus({preventScroll:true});
  }
  const cancelButton = () => '<button class="btn btn-light" data-action="close-modal">Cancel</button>';
  function reviewIncident(id) {
    assertRole('admin');
    const i = incident(id);
    if(!i) throw new Error('This report is no longer available.');
    const p = state.plans.find(p=>p.incidentId===i.id);
    const body = `<div class="incident-detail"><div class="flex between"><span class="mono">${e(i.id)}</span>${badge(i.status)}</div><h3>${e(i.type)}</h3><p>${e(i.description)}</p><dl class="detail-list"><div><dt>Reported by</dt><dd>${e(driver(i.driverId)?.name)}</dd></div><div><dt>Vehicle</dt><dd>${e(vehicle(i.vehicleId)?.registration||'Not assigned')}</dd></div><div><dt>Location</dt><dd>${e(i.location)}</dd></div><div><dt>Urgency</dt><dd>${badge(i.urgency)}</dd></div><div><dt>Reported</dt><dd>${time(i.reportedAt)}</dd></div></dl></div><h3 style="margin-bottom:12px">Affected deliveries</h3>${i.orderIds.length?orderTable(i.orderIds.map(id=>state.orders.find(o=>o.id===id)).filter(Boolean),false):'<p class="small muted">No active deliveries were on board.</p>'}${p?.assignedDriverId?`<div class="plan-note">${e(driver(p.assignedDriverId)?.name)} is coordinating recovery. Status: ${e(p.status)}.</div>`:''}`;
    let footer = '<button class="btn btn-light" data-action="close-modal">Close</button>';
    if(i.status === 'Unverified') footer=`<button class="btn btn-light" data-action="reject-report" data-id="${e(id)}">Reject report</button><button class="btn btn-primary" data-action="verify" data-id="${e(id)}">${icon('shield')}Verify report</button>`;
    else if(i.status==='Verified' && i.orderIds.length) footer+=`<button class="btn btn-primary" data-action="generate" data-id="${e(id)}">${icon('route')}Generate recovery plan</button>`;
    else if(i.status==='Verified'&&!i.orderIds.length) footer+=`<button class="btn btn-primary" data-action="resolve-report" data-id="${e(id)}">${icon('checkCircle')}Close report</button>`;
    else if(p) footer+=`<button class="btn btn-primary" data-action="open-plan" data-id="${e(p.id)}">View recovery plan</button>`;
    openModal('Review breakdown report','Check the driver’s report before approving recovery.',body,footer,true);
  }
  async function verifyReport(id) {
    assertRole('admin'); const result=await mutation(`/api/incidents/${id}/verify`);
    render(); reviewIncident(id); flash('Report verified. You can now generate a recovery plan.'); return result;
  }
  function getCandidates(i) { return state.plans.find(p=>p.incidentId===i.id)?.candidates || []; }
  async function generatePlan(id) {
    assertRole('admin'); const result=await mutation(`/api/incidents/${id}/plan`);
    render(); openPlan(result.id); return result;
  }
  function openPlan(id) {
    assertRole('admin');
    const p=plan(id); if(!p) throw new Error('Recovery plan not found.');
    const i=incident(p.incidentId);
    const candidates=p.status==='Draft'?getCandidates(i,p.totalWeightKg):p.candidates;
    if(p.status==='Draft'&&!candidates.some(c=>c.driverId===p.selectedDriverId)) p.selectedDriverId=candidates[0]?.driverId;
    const d=driver(p.assignedDriverId||p.selectedDriverId);
    const chosen=candidates.find(c=>c.driverId===(p.assignedDriverId||p.selectedDriverId));
    const body=`<div class="plan-grid"><div><div class="eyebrow">${p.status==='Draft'?'SELECT A RECOVERY DRIVER':'ASSIGNED RECOVERY DRIVER'}</div><h3>${p.status==='Draft'?'Available drivers that can carry the load':e(d?.name||'No driver selected')}</h3>${p.status==='Draft'?candidates.map((c,n)=>{const cd=driver(c.driverId);const v=vehicle(c.vehicleId);return `<label class="candidate ${c.driverId===p.selectedDriverId?'recommended':''}"><div class="flex">${avatar(cd.name,n)}<div><strong>${e(cd.name)} ${n===0?'<span class="badge badge-green">Recommended</span>':''}</strong><p>${e(v.type)} · ${num(v.capacityKg)} kg payload</p><p>${num(c.distanceKm)} km away · about ${c.etaMinutes} min to pickup</p></div></div><input class="candidate-choice" type="radio" name="recovery-driver" value="${e(cd.id)}" aria-label="Choose ${e(cd.name)}" ${c.driverId===p.selectedDriverId?'checked':''}></label>`;}).join('')||empty('No drivers available','A driver may have received another assignment. Update your fleet and try again.','users'):progress(p)}<div class="plan-note">${p.status==='Draft'?'The server ranks available drivers by admin-entered distance and vehicle capacity. Pickup times are estimates, not live GPS.':'The assigned driver receives this plan in their personal portal.'}</div></div><div><div class="plan-summary"><div class="eyebrow">RECOVERY SUMMARY</div><h2>${p.orderIds.length} deliveries · ${num(p.totalWeightKg)} kg</h2><p>Collect the cargo from the reported breakdown location.</p><dl class="detail-list"><div><dt>Pickup</dt><dd>${e(i.location)}</dd></div><div><dt>Original driver</dt><dd>${e(driver(i.driverId)?.name)}</dd></div><div><dt>Recovery driver</dt><dd id="plan-driver-label">${e(d?.name||'Unavailable')}</dd></div><div><dt>Pickup estimate</dt><dd id="plan-eta-label">${chosen?'About '+chosen.etaMinutes+' min':'—'}</dd></div></dl></div><div style="margin-top:20px"><h3>Delivery sequence</h3><p class="tiny muted" style="margin-top:3px">Ordered by the delivery deadline</p><dl class="detail-list">${p.orderIds.map((id,n)=>{const o=state.orders.find(o=>o.id===id);return `<div><dt>${n+1}. ${e(o.customer)}</dt><dd>${time(o.dueAt)}<span class="cell-sub" style="display:block;font-size:.8125rem;color:var(--muted)">${e(o.destination)}</span></dd></div>`;}).join('')}</dl></div></div></div>`;
    const footer=p.status==='Draft'?`${cancelButton()}<button class="btn btn-light" data-action="refresh-plan" data-id="${e(p.id)}">Refresh options</button><button class="btn btn-primary" data-action="approve-plan" data-id="${e(p.id)}" ${!candidates.length?'disabled':''}>${icon('checkCircle')}Approve & assign driver</button>`:'<button class="btn btn-light" data-action="close-modal">Close plan</button>';
    openModal(p.status==='Draft'?'Review recovery plan':'Recovery plan',`${p.incidentId} · ${p.status}`,body,footer,true);
    modalRoot.dataset.planId=p.id;
  }
  async function assignPlan(id, driverId) {
    assertRole('admin');
    if(!driverId) throw new Error('Choose an available recovery driver.');
    const result=await mutation(`/api/plans/${id}/assign`,'POST',{driverId});
    closeModal(); render(); flash('Driver assigned. Instructions are now in their driver portal.'); return result;
  }
  async function advancePlan(id) {
    assertRole('driver'); const p=plan(id);
    const status={Assigned:'Accepted',Accepted:'Picked up','Picked up':'Completed'}[p?.status];
    if(!status) throw new Error('This task is already completed.');
    const result=await mutation(`/api/plans/${id}/status`,'PATCH',{status});
    render(); flash(`Recovery updated: ${result.status.toLowerCase()}.`); return result;
  }
  function reportForm() {
    assertRole('driver');
    const d=currentDriver();
    if(!vehicle(d.vehicleId)) throw new Error('Ask admin to assign a vehicle before submitting a vehicle breakdown.');
    if(liveIncidents().some(i=>i.driverId===d.id)) {
      openModal('You already have an open report','Admin is coordinating your current breakdown.',`<p>Your open report is visible in My reports. A second report for the same driver is not needed.</p>`,`<button class="btn btn-primary" data-action="nav" data-page="reports">View my reports</button>`);return;
    }
    const onRecovery=state.plans.find(p=>p.assignedDriverId===d.id&&p.status!=='Completed');
    if(onRecovery) throw new Error('Contact admin if your recovery vehicle breaks down. Chained recoveries are not supported in this version.');
    const active=state.orders.filter(o=>o.driverId===d.id&&o.status!=='Delivered');
    const body=`<form id="report-form"><div class="incident-detail flex between"><div><strong>${e(vehicle(d.vehicleId).registration)}</strong><p class="small muted">${active.length} active deliveries will be flagged</p></div>${icon('truck')}</div><div class="form-grid"><div class="field"><label for="issue-type">Breakdown type</label><select name="type" id="issue-type"><option>Engine failure</option><option>Flat tyre</option><option>Battery issue</option><option>Vehicle damage</option><option>Other mechanical issue</option></select></div><div class="field"><label for="report-urgency">Priority</label><select name="urgency" id="report-urgency"><option>High</option><option>Normal</option><option>Low</option></select></div><div class="field full"><label for="report-location">Breakdown location</label><input name="location" id="report-location" required maxlength="160" placeholder="Junction, landmark and city"></div><div class="field full"><label for="report-description">What happened?</label><textarea name="description" id="report-description" required maxlength="1500" placeholder="Describe the issue and the cargo on board."></textarea></div></div><div class="form-error" id="report-error" role="alert"></div></form>`;
    openModal('Report a breakdown','The admin team will receive your report.',body,`${cancelButton()}<button class="btn btn-primary" type="submit" form="report-form">${icon('file')}Submit report</button>`);
  }
  async function submitReport(data) {
    assertRole('driver'); const result=await mutation('/api/incidents','POST',data);
    closeModal(); page='reports'; render(); flash('Report submitted. Admin can now review it.'); return result;
  }
  async function openNotifications() {
    const list=visibleNotifications();
    const body=list.length?`<div class="notification-list">${list.map(n=>`<article class="notification ${n.read?'':'unread'}"><strong>${e(n.title)}</strong><p>${e(n.body)}</p><time datetime="${e(n.createdAt)}">${ago(n.createdAt)}</time>${n.planId&&session.role==='driver'?'<button class="text-link" data-action="nav" data-page="tasks">View assignment</button>':n.incidentId&&session.role==='admin'?`<button class="text-link" data-action="review" data-id="${e(n.incidentId)}">Review report</button>`:n.incidentId?'<button class="text-link" data-action="nav" data-page="reports">View my report</button>':''}</article>`).join('')}</div>`:empty('No notifications yet','Assignment and report updates will appear here.','bell');
    await mutation('/api/notifications/read'); render();
    openModal('Notifications','Updates for your current portal.',body,'<button class="btn btn-light" data-action="close-modal">Close</button>');
  }
  function switchPortal() {
    openModal('Switch portal','Sign out and open the login page for another role.',`<button class="switch-portal-option" data-action="go-login" data-role="admin"><span class="auth-symbol" style="margin:0">${icon('shield')}</span><div><strong>Admin portal</strong><span>Shared reports, recovery plans and fleet management</span></div></button><button class="switch-portal-option" data-action="go-login" data-role="driver"><span class="auth-symbol" style="margin:0">${icon('truck')}</span><div><strong>Driver portal</strong><span>Personal assignments, reports and delivery updates</span></div></button>`,'<button class="btn btn-light" data-action="close-modal">Keep current portal</button>');
  }
  async function signOut(role=session?.role || 'admin') {
    if(session) await api('/api/auth/logout','POST',{});
    session=null; csrfToken=''; state=blankState(); closeModal(); page='overview'; filter='All'; search='';
    history.replaceState(null,'',location.pathname+`#/login/${role}`); render();
  }
  function orderDetail(id) {
    const o=state.orders.find(o=>o.id===id);if(!o) throw new Error('Delivery not found.');
    if(session.role==='driver'&&o.driverId!==session.driverId) throw new Error('This delivery is not assigned to you.');
    const body=`<div class="incident-detail"><div class="flex between"><span class="mono">${e(o.id)}</span>${badge(o.status)}</div><h3>${e(o.customer)}</h3><dl class="detail-list"><div><dt>Pickup</dt><dd>${e(o.pickup)}</dd></div><div><dt>Destination</dt><dd>${e(o.destination)}</dd></div><div><dt>Payload</dt><dd>${num(o.weightKg)} kg</dd></div><div><dt>Assigned driver</dt><dd>${e(driver(o.driverId)?.name||'Unassigned')}</dd></div><div><dt>Due</dt><dd>${new Date(o.dueAt).toLocaleString('en-IN')}</dd></div>${o.recoveryPlanId?`<div><dt>Recovery plan</dt><dd>${e(o.recoveryPlanId)}</dd></div>`:''}</dl></div>`;
    openModal('Delivery details','Pickup, destination and current progress.',body,'<button class="btn btn-light" data-action="close-modal">Close</button>');
  }
  function newOrder() {
    assertRole('admin');
    const ready=availableDrivers();
    if(!ready.length) throw new Error('No driver is available. Update the fleet before assigning a new delivery.');
    const due=new Date(Date.now()+2*3600000);due.setMinutes(due.getMinutes()-due.getTimezoneOffset());
    const body=`<form id="order-form"><div class="form-grid"><div class="field full"><label for="order-customer">Customer / shop</label><input id="order-customer" name="customer" required maxlength="100" placeholder="e.g. Green Basket"></div><div class="field full"><label for="order-pickup">Pickup location</label><input id="order-pickup" name="pickup" required maxlength="160" value="Salem central hub"></div><div class="field full"><label for="order-destination">Delivery destination</label><input id="order-destination" name="destination" required maxlength="160" placeholder="Area and city"></div><div class="field"><label for="order-weight">Cargo weight (kg)</label><input id="order-weight" name="weightKg" type="number" min="1" max="100000" step="1" value="100" required></div><div class="field"><label for="order-due">Delivery deadline</label><input id="order-due" name="dueAt" type="datetime-local" value="${due.toISOString().slice(0,16)}" required></div><div class="field full"><label for="order-driver">Assign a driver</label><select id="order-driver" name="driverId">${ready.map(d=>`<option value="${e(d.id)}">${e(d.name)} · ${num(vehicle(d.vehicleId).capacityKg)} kg</option>`).join('')}</select></div></div><div class="form-error" id="order-error" role="alert"></div></form>`;
    openModal('Create delivery','The assigned driver will receive the instructions.',body,`${cancelButton()}<button class="btn btn-primary" form="order-form" type="submit">${icon('plus')}Create & assign</button>`);
  }
  async function addOrder(data) {
    assertRole('admin'); data.dueAt=new Date(data.dueAt).toISOString(); data.weightKg=Number(data.weightKg);
    const result=await mutation('/api/orders','POST',data);
    closeModal(); page='orders'; render(); flash('Delivery assigned. The driver has been notified.'); return result;
  }
  function vehicleForm() {
    assertRole('admin');
    openModal('Add vehicle','Register a vehicle before assigning it to a driver.',`<form id="vehicle-form"><div class="field"><label for="vehicle-registration">Registration number</label><input name="registration" id="vehicle-registration" placeholder="TN 30 XX 1234" required maxlength="25"></div><div class="form-grid"><div class="field"><label for="vehicle-type">Vehicle type</label><select id="vehicle-type" name="type"><option>Cargo van</option><option>Mini truck</option><option>Pickup truck</option></select></div><div class="field"><label for="vehicle-capacity">Payload capacity (kg)</label><input name="capacityKg" id="vehicle-capacity" type="number" min="1" max="100000" value="750" step="1" required></div></div><div class="form-error" id="vehicle-error" role="alert"></div></form>`,`${cancelButton()}<button class="btn btn-primary" form="vehicle-form" type="submit">Add vehicle</button>`);
  }
  async function addVehicle(data) {
    assertRole('admin'); data.capacityKg=Number(data.capacityKg);
    const result=await mutation('/api/vehicles','POST',data);
    closeModal(); render(); flash('Vehicle added to the fleet.'); return result;
  }
  function driverForm(id) {
    assertRole('admin');
    const d=id?driver(id):null;
    const unassigned=state.vehicles.filter(v=>!state.drivers.some(other=>other.vehicleId===v.id&&other.id!==d?.id));
    if(!unassigned.length) throw new Error('Add an unassigned vehicle before creating a driver.');
    const locked=!!d&&(state.orders.some(o=>o.driverId===d.id&&o.status!=='Delivered')||liveIncidents().some(i=>i.driverId===d.id));
    const body=`<form id="driver-form" data-id="${e(id||'')}"><div class="form-grid"><div class="field full"><label for="driver-name">Driver name</label><input name="name" id="driver-name" required maxlength="80" value="${e(d?.name||'')}" placeholder="Full name"></div><div class="field full"><label for="driver-email">Email address</label><input name="email" id="driver-email" type="email" required maxlength="120" value="${e(d?.email||'')}" placeholder="name@example.com"></div><div class="field full"><label for="driver-password">${d?'New password (optional)':'Login password'}</label><input id="driver-password" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" ${d?'':'required'}><span class="field-help">${d?'Leave blank to keep the current password. A change signs the driver out.':'At least 10 characters. Give these login details to the driver.'}</span></div><div class="field"><label for="driver-phone">Phone</label><input name="phone" id="driver-phone" type="tel" required maxlength="25" value="${e(d?.phone||'')}"></div><div class="field"><label for="driver-distance">Estimated distance to recovery area (km)</label><input name="distanceKm" id="driver-distance" type="number" min="0" max="500" step="0.1" value="${d?.distanceKm??5}" required><span class="field-help">Admin estimate used to rank recovery drivers. Update it for the current incident.</span></div><div class="field full"><label for="driver-vehicle">Vehicle</label><select name="vehicleId" id="driver-vehicle" ${locked?'disabled':''}>${unassigned.map(v=>`<option value="${e(v.id)}" ${v.id===d?.vehicleId?'selected':''}>${e(v.registration)} · ${num(v.capacityKg)} kg</option>`).join('')}</select></div><div class="field full"><label for="driver-status">Driver status</label><select id="driver-status" name="status" ${locked?'disabled':''}>${(locked?[d.status]:['Available','Off duty','Breakdown']).map(s=>`<option ${s===d?.status?'selected':''}>${e(s)}</option>`).join('')}</select><span class="field-help">${locked?'Vehicle and status stay locked while a delivery or report is open.':'Set Available after confirming the vehicle is ready.'}</span></div></div><div class="form-error" id="driver-error" role="alert"></div></form>`;
    const repairButton=d?.status==='Breakdown'&&!liveIncidents().some(i=>i.driverId===d.id)?`<button class="btn btn-light" data-action="confirm-vehicle-ready" data-id="${e(d.id)}">Confirm vehicle ready</button>`:'';
    openModal(d?'Manage driver':'Add driver',d?'Update the driver’s details.':'Create the driver’s personal login and assign a vehicle.',body,`${cancelButton()}${repairButton}<button class="btn btn-primary" form="driver-form" type="submit">${d?'Save changes':'Add driver'}</button>`);
  }
  async function saveDriver(data,id) {
    assertRole('admin'); data.distanceKm=Number(data.distanceKm);
    if(!data.password) delete data.password;
    const result=await mutation(id?`/api/drivers/${id}`:'/api/drivers',id?'PATCH':'POST',data);
    closeModal(); render(); flash(id?'Driver details updated.':'Driver added. Their personal login is ready.'); return result;
  }
  function stockForm(id) {
    assertRole('admin');const item=id?state.stock.find(s=>s.id===id):null;
    const body=`<form id="stock-form" data-id="${e(id||'')}"><div class="field"><label for="stock-name">Stock item</label><input id="stock-name" name="name" value="${e(item?.name||'')}" required maxlength="100"></div><div class="form-grid"><div class="field"><label for="stock-category">Category</label><select name="category" id="stock-category">${['Groceries','Household','Healthcare','Other'].map(s=>`<option ${s===item?.category?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label for="stock-unit">Unit</label><select name="unit" id="stock-unit">${['boxes','cartons','units'].map(s=>`<option ${s===item?.unit?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label for="stock-quantity">Available quantity</label><input name="quantity" id="stock-quantity" type="number" min="0" max="1000000" step="1" value="${item?.quantity??0}" required></div><div class="field"><label for="stock-warehouse">Warehouse</label><input name="warehouse" id="stock-warehouse" maxlength="100" value="${e(item?.warehouse||'Salem central hub')}" required></div></div><div class="form-error" id="stock-error" role="alert"></div></form>`;
    openModal(item?'Update stock':'Add stock item','Record the currently available quantity.',body,`${cancelButton()}<button class="btn btn-primary" form="stock-form" type="submit">Save stock</button>`);
  }
  async function saveStock(data,id) {
    assertRole('admin'); data.quantity=Number(data.quantity);
    const result=await mutation(id?`/api/stock/${id}`:'/api/stock',id?'PATCH':'POST',data);
    closeModal(); render(); flash('Warehouse stock updated.'); return result;
  }
  async function updateOrder(id) {
    assertRole('driver'); const o=state.orders.find(o=>o.id===id);
    const status={Assigned:'In transit','In transit':'Delivered'}[o?.status];
    if(!status) throw new Error('This delivery cannot be updated now.');
    const result=await mutation(`/api/orders/${id}/status`,'PATCH',{status});
    render(); flash(`Delivery updated: ${result.status.toLowerCase()}.`); return result;
  }
  async function resolveReport(id) {
    assertRole('admin'); const result=await mutation(`/api/incidents/${id}/resolve`);
    closeModal(); render(); flash('Report closed. Confirm the vehicle ready after repairs.'); return result;
  }
  function rejectForm(id) {
    assertRole('admin');const i=incident(id);
    if(!i||i.status!=='Unverified') throw new Error('Only an unverified report can be rejected.');
    openModal('Reject breakdown report','The driver will receive your reason.',`<form id="reject-form" data-id="${e(id)}"><div class="field"><label for="reject-reason">Reason for rejection</label><textarea id="reject-reason" name="reason" required maxlength="500" placeholder="Explain why the report could not be verified."></textarea><span class="field-help">The reported vehicle remains unavailable until admin confirms its condition.</span></div><div class="form-error" id="reject-error" role="alert"></div></form>`,`${cancelButton()}<button class="btn btn-danger" form="reject-form" type="submit">Reject report</button>`);
  }
  async function rejectReport(id,reason) {
    assertRole('admin'); const result=await mutation(`/api/incidents/${id}/reject`,'POST',{reason});
    closeModal(); render(); flash('Report rejected. The driver has received the reason.'); return result;
  }
  async function confirmVehicleReady(id) {
    assertRole('admin'); const result=await mutation(`/api/drivers/${id}/vehicle-ready`);
    closeModal(); render(); flash('Vehicle confirmed ready. Driver status updated.'); return result;
  }
  function adminForm() {
    assertRole('admin');
    openModal('Add administrator','This account shares the same operations workspace.',`<form id="admin-form"><div class="field"><label for="admin-name">Name</label><input id="admin-name" name="name" maxlength="80" autocomplete="name" required></div><div class="field"><label for="admin-email">Email</label><input id="admin-email" name="email" type="email" maxlength="120" autocomplete="off" required></div><div class="field"><label for="admin-password">Password</label><input id="admin-password" name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><span class="field-help">Use at least 10 characters.</span></div><div class="form-error" role="alert"></div></form>`,`${cancelButton()}<button class="btn btn-primary" form="admin-form" type="submit">Create admin account</button>`);
  }
  async function addAdmin(data) {
    assertRole('admin'); const result=await mutation('/api/admins','POST',data);
    closeModal(); render(); flash('Administrator added to the shared workspace.'); return result;
  }
  function locationForm() {
    assertRole('driver'); const d=currentDriver();
    openModal('Update my location','Share your latest landmark or address with admin.',`<form id="location-form"><div class="field"><label for="current-location">Current location</label><input id="current-location" name="location" maxlength="160" value="${e(d.location||'')}" required></div><div class="form-error" role="alert"></div></form>`,`${cancelButton()}<button class="btn btn-primary" form="location-form" type="submit">Save location</button>`);
  }
  async function updateLocation(data) {
    assertRole('driver'); const result=await mutation('/api/me/location','PATCH',data);
    closeModal(); render(); flash('Location shared with admin.'); return result;
  }
  function navigate(nextPage) {
    closeModal();page=nextPage;filter='All';search='';render();
    document.getElementById('main')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');
    if(!button) { if(event.target.classList.contains('modal-backdrop')) closeModal(); return; }
    if(button.disabled || busy) return;
    const action=button.dataset.action; const id=button.dataset.id;
    button.disabled=true; busy++;
    try {
      const actions={
        nav:()=>navigate(button.dataset.page), filter:()=>{filter=button.dataset.filter;render();},
        menu:()=>{document.getElementById('sidebar')?.classList.toggle('open');document.querySelector('.mobile-backdrop')?.classList.toggle('visible');button.setAttribute('aria-expanded',String(document.getElementById('sidebar')?.classList.contains('open')));},
        'close-menu':()=>{document.getElementById('sidebar')?.classList.remove('open');document.querySelector('.mobile-backdrop')?.classList.remove('visible');document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded','false');},
        'close-modal':closeModal, review:()=>reviewIncident(id), verify:()=>verifyReport(id), generate:()=>generatePlan(id),
        'open-plan':()=>openPlan(id), 'approve-plan':()=>assignPlan(id,modalRoot.querySelector('input[name="recovery-driver"]:checked')?.value),
        'refresh-plan':async()=>{await refreshState(false);render();openPlan(id);},
        'advance-plan':()=>advancePlan(id), 'report-breakdown':reportForm, notifications:openNotifications, switch:switchPortal,
        'go-login':()=>signOut(button.dataset.role), logout:()=>signOut(),
        'toggle-password':()=>{const field=document.getElementById('login-password');field.type=field.type==='password'?'text':'password';button.setAttribute('aria-label',field.type==='password'?'Show password':'Hide password');},
        'new-order':newOrder, 'order-detail':()=>orderDetail(id), 'new-driver':()=>driverForm(), 'edit-driver':()=>driverForm(id),
        'new-vehicle':vehicleForm, 'new-stock':()=>stockForm(), 'edit-stock':()=>stockForm(id), 'update-order':()=>updateOrder(id),
        'reject-report':()=>rejectForm(id), 'resolve-report':()=>resolveReport(id), 'confirm-vehicle-ready':()=>confirmVehicleReady(id),
        'new-admin':adminForm, 'update-location':locationForm, 'retry-connection':boot,
        'return-workspace':()=>{history.replaceState(null,'',location.pathname+'#/workspace');render();}
      };
      if(actions[action]) await actions[action]();
    } catch(error) {flash(error.message);}
    finally {button.disabled=false;busy--;}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target; if(!form.id.endsWith('-form'))return;
    event.preventDefault(); if(busy)return;
    const data=Object.fromEntries(new FormData(form));
    const controls=[...document.querySelectorAll(`[form="${form.id}"][type="submit"],#${form.id} [type="submit"]`)];
    controls.forEach(b=>b.disabled=true); busy++;
    const errorField=form.querySelector('.form-error'); if(errorField)errorField.textContent='';
    try {
      if(form.id==='login-form') {
        const setup=form.dataset.setup==='true';
        const result=await api(setup?'/api/auth/setup':'/api/auth/login','POST',setup?data:{email:data.email,password:data.password,role:form.dataset.role});
        session=result.user;csrfToken=result.csrfToken;setupRequired=false;
        await refreshState(false);page='overview';filter='All';search='';
        history.replaceState(null,'',location.pathname+'#/workspace');render();return;
      }
      const handlers={
        'report-form':()=>submitReport(data), 'order-form':()=>addOrder(data), 'vehicle-form':()=>addVehicle(data),
        'driver-form':()=>saveDriver(data,form.dataset.id||null), 'stock-form':()=>saveStock(data,form.dataset.id||null),
        'reject-form':()=>rejectReport(form.dataset.id,data.reason), 'admin-form':()=>addAdmin(data), 'location-form':()=>updateLocation(data)
      };
      if(handlers[form.id]) await handlers[form.id]();
    } catch(error) {
      const out=form.querySelector('.form-error');
      if(out?.isConnected){out.textContent=error.message;out.setAttribute('tabindex','-1');out.focus();}else flash(error.message);
    } finally {controls.forEach(b=>b.disabled=false);busy--;}
  });
  document.addEventListener('input',event=>{
    if(event.target.id!=='list-search')return;
    search=event.target.value; const caret=event.target.selectionStart;
    render(); const field=document.getElementById('list-search'); field?.focus(); try{field?.setSelectionRange(caret,caret);}catch{}
  });
  document.addEventListener('change',event=>{
    if(event.target.name!=='recovery-driver')return;
    const p=plan(modalRoot.dataset.planId); if(!p||p.status!=='Draft')return;
    const d=driver(event.target.value); const c=getCandidates(incident(p.incidentId)).find(c=>c.driverId===d?.id); if(!c)return;
    p.selectedDriverId=d.id;
    modalRoot.querySelectorAll('.candidate').forEach(el=>el.classList.toggle('recommended',el.querySelector('input').checked));
    document.getElementById('plan-driver-label').textContent=d.name; document.getElementById('plan-eta-label').textContent=`About ${c.etaMinutes} min`;
  });
  window.addEventListener('hashchange',()=>{if(!loading){closeModal();render();}});
  async function poll() {
    // Avoid replacing fields while someone is typing or reviewing a modal.
    // Every write is still validated against current database state.
    if(!session || loading || refreshing || busy || document.hidden || modalRoot.querySelector('[role="dialog"]') || document.activeElement?.matches('input,textarea,select') || location.hash.startsWith('#/login/'))return;
    refreshing=true;
    try {await refreshState();}
    catch(error) {if(session&&!disconnected){disconnected=true;render();flash(error.message);}}
    finally {refreshing=false;}
  }
  setInterval(poll,5000);
  window.addEventListener('focus',poll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  boot();
})();
