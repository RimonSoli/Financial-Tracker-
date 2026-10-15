// Family Cashflow: screens, forecast engine and storage.
// Shared data syncs through Firebase (sync.js). Each device also keeps a cached copy so it opens instantly and works offline.

// ---------- dates & money ----------
const P=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const iso=dt=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
const add=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return iso(d)};
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const ymd=(y,m,d)=>{const dt=new Date(y,m,1,12);return iso(new Date(dt.getFullYear(),dt.getMonth(),Math.min(d,dim(dt.getFullYear(),dt.getMonth())),12))};
const mstart=s=>s.slice(0,8)+'01';
const mend=s=>{const d=P(s);return ymd(d.getFullYear(),d.getMonth(),31)};
const diff=(a,b)=>Math.round((P(b)-P(a))/864e5);
const TODAY=iso(new Date());
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ord=n=>n+(n%100>10&&n%100<14?'th':['th','st','nd','rd'][n%10]||'th');
const short=s=>{const d=P(s);return MON[d.getMonth()]+' '+d.getDate()};
const mlabel=s=>{const d=P(s);return MONL[d.getMonth()]+' '+d.getFullYear()};
const when=s=>{const n=diff(TODAY,s);return n===0?'today':n===1?'tomorrow':n<7&&n>0?'in '+n+' days ('+short(s)+')':short(s)};
const money=(n,cents)=>{const a=Math.abs(n);const dec=cents||(a<100&&Math.round(a*100)%100)?2:0;return(n<-0.004?'−':'')+'$'+a.toLocaleString('en-CA',{minimumFractionDigits:dec,maximumFractionDigits:dec})};
const kmoney=n=>{const a=Math.abs(n);const s=a>=1000?(a/1000).toFixed(a>=10000?0:1).replace(/\.0$/,'')+'k':Math.round(a)+'';return(n<0?'−':'')+s};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=()=>'x'+Math.random().toString(36).slice(2,9);

// Money input fields: "$" shown in the field, commas every three digits as you type, empty instead of 0.
const parseMoney=s=>{const v=parseFloat(String(s==null?'':s).replace(/[^0-9.]/g,''));return isNaN(v)?0:v};
const groupDigits=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,',');
function fmtMoneyStr(raw){
  const s=String(raw).replace(/[^0-9.]/g,''),i=s.indexOf('.');
  let int=i<0?s:s.slice(0,i);const dec=i<0?null:s.slice(i+1).replace(/\./g,'').slice(0,2);
  int=int.replace(/^0+(?=\d)/,'');if(int===''&&dec!==null)int='0';
  return groupDigits(int)+(dec!==null?'.'+dec:'');
}
function moneyVal(n){if(!n)return'';const r=Math.round(Math.abs(n)*100)/100,cents=Math.round((r%1)*100);return groupDigits(String(Math.trunc(r)))+(cents?'.'+String(cents).padStart(2,'0'):'')}
function moneyField(id,v,o={}){
  return '<div class="money-in'+(o.hero?' hero':'')+'"><span aria-hidden="true">$</span><input type="text" inputmode="decimal" autocomplete="off" data-money id="'+id+'" value="'+moneyVal(v)+'" placeholder="'+(o.ph!=null?o.ph:'0.00')+'"'+(o.req?' required':'')+(o.attrs||'')+'></div>';
}

// ---------- example data ----------
function I(id,name,category,type,acct,rule,amount,x={}){return{id,name,category,type,acct,rule,amounts:[{from:'2000-01-01',amount}],remind:0,...x}}
function E(id,name,category,acct,amount){return{id,name,category,acct,amounts:[{from:'2000-01-01',amount}]}}
function sampleNW(){const A=(id,name,value)=>({id,name,value,updated:TODAY});
  return{assets:[A('home','Home',485000),A('car','Family car',22000),A('rrsp','RRSP',64000),A('tfsa','TFSA',31000)],
    debts:[A('mort','Mortgage',312000),A('cl','Car loan',9500),A('vb','Blue Visa balance',780),A('ab','Amex balance',76)]}}
function sample(){
  return{v:3,example:true,theme:'system',colors:{},nw:sampleNW(),undo:null,
    thresholds:{exp:1000,inc:10000},
    accounts:[{id:'c',name:'Checking',type:'checking',bal:6240,alert:1500},{id:'s',name:'Savings',type:'savings',bal:18500,alert:5000}],
    tags:[{id:'ins',name:'Insurance',color:'#2F6FD6'},{id:'tel',name:'Phone & internet',color:'#0E9488'}],balanceDate:TODAY,dismissed:[],replacing:null,
    categories:['Income','Savings','Housing','Insurance','Utilities','Subscriptions','Groceries','Dining out','Transportation','Household','Taxes','Education','Gifts','Home & car'],
    cards:[{id:'visa',name:'Blue Visa',last4:'2208',closeDay:20,delay:15,payFrom:'c'},{id:'amex',name:'Amex',last4:'1005',closeDay:5,delay:15,payFrom:'c'}],
    history:[{date:add(TODAY,-70),a:{c:{p:5900,a:5620},s:{p:17700,a:17700}}},{date:add(TODAY,-39),a:{c:{p:6410,a:6180},s:{p:18100,a:18100}}}],
    estimates:[E('gro','Groceries','Groceries','c',1100),E('din','Restaurants','Dining out','visa',380),E('gas','Fuel','Transportation','visa',300),E('hh','Household & pharmacy','Household','c',200)],
    items:[
      I('sal','Salary','Income','income','c',{freq:'biweekly',start:'2026-10-02'},2850),
      I('bon','Annual bonus','Income','income','c',{freq:'yearly',month:1,day:12},12000),
      I('tsv','Move to savings','Savings','transfer','c',{freq:'monthly',day:3},400,{to:'s'}),
      I('mtg','Mortgage','Housing','expense','c',{freq:'monthly',day:1},2150),
      {...I('hins','Home insurance','Insurance','expense','c',{freq:'monthly',day:15},128,{tag:'ins'}),amounts:[{from:'2000-01-01',amount:128},{from:'2026-06-15',amount:142}]},
      I('cins','Car insurance','Insurance','expense','c',{freq:'monthly',day:15},168,{tag:'ins'}),
      I('pwr','Nova Scotia Power','Utilities','expense','c',{freq:'monthly',day:20},210),
      I('net','Internet','Utilities','expense','c',{freq:'monthly',day:18},110,{tag:'tel'}),
      I('phn','Phones','Utilities','expense','visa',{freq:'monthly',day:7},95,{tag:'tel'}),
      I('nfx','Netflix','Subscriptions','expense','visa',{freq:'monthly',day:13},18.99),
      I('spt','Spotify','Subscriptions','expense','amex',{freq:'monthly',day:22},11.99),
      I('icl','iCloud','Subscriptions','expense','amex',{freq:'monthly',day:3},9.99),
      I('gym','Gym','Subscriptions','expense','amex',{freq:'monthly',day:1},54),
      I('ptx','Property tax','Taxes','expense','c',{freq:'semiannual',month:3,day:31},1640,{remind:30}),
      I('tax','Tax installment','Taxes','expense','c',{freq:'quarterly',month:2,day:15},950,{remind:21}),
      I('tui','School tuition','Education','expense','s',{freq:'yearly',month:7,day:31},4800,{remind:45}),
      I('xms','Christmas gifts','Gifts','expense','visa',{freq:'once',date:'2026-12-10'},800,{remind:21}),
      I('car','Car repair','Home & car','expense','s',{freq:'once',date:'2027-03-12'},900,{remind:30}),
    ]};
}
function blankState(){
  const b=sample();
  return{...b,example:false,items:[],estimates:[],cards:[],history:[],tags:[],nw:{assets:[],debts:[]},balanceDate:TODAY,replacing:null,
    accounts:[{id:'c',name:'Checking',type:'checking',bal:0,alert:0},{id:'s',name:'Savings',type:'savings',bal:0,alert:0}],
    colors:S.colors||{},palette:S.palette||[],thresholds:S.thresholds||b.thresholds,categories:S.categories||b.categories};
}

// ---------- storage & roles ----------
// Per-device settings (theme, years shown, dismissed notifications, role) stay on the device and are never synced.
const KEY='family-cashflow-cache',PREF='family-cashflow-prefs';
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const PREFS=Object.assign({theme:'system',dismissed:[],role:null},lsGet(PREF)||{});
const CUR_Y=P(TODAY).getFullYear();
// Calendar range in years, set per device. Older versions stored "years ahead"; turn that into an end year.
if(PREFS.yTo==null){PREFS.yFrom=CUR_Y;PREFS.yTo=PREFS.years?CUR_Y+(+PREFS.years||1):CUR_Y+1}
delete PREFS.years;
const HAS_CLOUD=!!(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey&&!/^PASTE/.test(window.FIREBASE_CONFIG.apiKey));
let S=lsGet(KEY);const HAD_CACHE=!!(S&&S.v>=2);
if(!HAD_CACHE)S=sample();
// ROLE: local (no Firebase: full editing on this device only) | connecting | editor | viewer | pending (waiting for approval) | error
let ROLE=!HAS_CLOUD?'local':(HAD_CACHE&&PREFS.role)?PREFS.role:'connecting',CONN=null,GATE_MSG='';
const DEV={requests:{},viewers:{},editors:{}},INFO={legacy:false,hasCode:false,owner:false,uid:null};
const CAN=()=>ROLE==='editor'||ROLE==='local';
const LOCAL_KEYS=new Set(['theme','dismissed','_rev']);

const bankOf=id=>S.accounts.find(a=>a.id===id);
const cardOf=id=>S.cards.find(c=>c.id===id);
const firstChk=()=>(S.accounts.find(a=>a.type==='checking')||S.accounts[0]||{}).id;
const firstSav=()=>{const c=firstChk();return(S.accounts.find(a=>a.type==='savings'&&a.id!==c)||S.accounts.find(a=>a.id!==c)||{}).id};
const acctName=id=>{const b=bankOf(id);if(b)return b.name;const c=cardOf(id);return c?c.name+' ••'+c.last4:'Removed account'};
const acctColor=a=>a&&a.type==='savings'?'var(--sav)':'var(--accent)';
const payFromOf=c=>bankOf(c.payFrom)?c.payFrom:firstChk();
const startBals=()=>{const o={};S.accounts.forEach(a=>o[a.id]=+a.bal||0);return o};
const TH=()=>S.thresholds||{exp:1000,inc:10000};
const yFrom=()=>Math.min(CUR_Y+10,Math.max(CUR_Y,+PREFS.yFrom||CUR_Y));
const yTo=()=>Math.min(CUR_Y+10,Math.max(yFrom(),+PREFS.yTo||CUR_Y+1));
// First month shown: this month, or January of the "from" year when that year is still ahead.
const calStart=()=>yFrom()>CUR_Y?yFrom()+'-01-01':mstart(TODAY);

function migrate(){
  if(!S.tags)S.tags=[];if(!S.colors)S.colors={};if(!S.palette)S.palette=[];if(!S.cards)S.cards=[];if(!S.items)S.items=[];if(!S.estimates)S.estimates=[];
  if(!S.nw)S.nw=S.example?sampleNW():{assets:[],debts:[]};
  if(!S.categories)S.categories=sample().categories;
  if(!S.accounts){const b=S.bal||{},al=S.alerts||{};
    S.accounts=[{id:'c',name:'Checking',type:'checking',bal:+b.c||0,alert:+al.c||0},{id:'s',name:'Savings',type:'savings',bal:+b.s||0,alert:+al.s||0}];}
  delete S.bal;delete S.alerts;
  if(!S.accounts.length)S.accounts=[{id:'c',name:'Checking',type:'checking',bal:0,alert:0}];
  S.history=(S.history||[]).map(h=>h.a?h:{date:h.date,a:{c:h.c||{p:0,a:0},s:h.s||{p:0,a:0}}});
  S.cards.forEach(c=>{if(!bankOf(c.payFrom))c.payFrom=firstChk()});
  if(!S.thresholds)S.thresholds={exp:1000,inc:10000};
  if(S.undo===undefined)S.undo=null;
  if(!S.balanceDate)S.balanceDate=TODAY;
  S.v=3;S.theme=PREFS.theme;S.dismissed=PREFS.dismissed||[];
}
migrate();
function syncObj(){const o={};for(const k in S)if(!LOCAL_KEYS.has(k)&&S[k]!==undefined)o[k]=S[k];return o}
window.APP={
  setRole(r,msg){
    // Offline or a brief connection error: a device that already knows its role keeps showing its saved copy.
    if(r==='error'&&HAD_CACHE&&(ROLE==='editor'||ROLE==='viewer')){CONN=false;renderStatus();return}
    ROLE=r;GATE_MSG=msg||'';if(r==='editor'||r==='viewer'){PREFS.role=r;lsSet(PREF,PREFS)}render()},
  setInfo(o){Object.assign(INFO,o);if(tab==='set'||ROLE==='pending')render()},
  // Whole state as one JSON string (older database rules) or one JSON string per section (current rules).
  cloudJSON:()=>JSON.stringify(syncObj()),
  keys(){const o=syncObj(),r={};for(const k in o)r[k]=JSON.stringify(o[k]===undefined?null:o[k]);return r},
  put(k,str){if(LOCAL_KEYS.has(k))return;try{S[k]=JSON.parse(str)}catch(e){}},
  refresh(){migrate();lsSet(KEY,S);render()},
  setState(json){try{const x=JSON.parse(json);if(!x||!(x.v>=2))return;S=x;migrate();lsSet(KEY,S);render()}catch(e){}},
  localRev:()=>S._rev||0,hadCache:()=>HAD_CACHE,
  setDevices(k,v){DEV[k]=v||{};render()},
  setConn(on){CONN=on;renderStatus()},
};
let pushT=null;
function save(){
  PREFS.theme=S.theme;PREFS.dismissed=S.dismissed;lsSet(PREF,PREFS);
  if(!CAN())return;                       // view-only devices keep only their own settings
  S._rev=Date.now();lsSet(KEY,S);
  if(ROLE==='editor'&&window.cloudSave){clearTimeout(pushT);pushT=setTimeout(()=>window.cloudSave(),400)}
}
const COLS=[['--c-in','Income','#2C7A4C'],['--c-bill','Bills','#14212A'],['--c-500','Payments of $500 or more','#A86E14'],['--c-card','Card payments','#B23636'],['--c-xfer','Transfers','#6A4E9A'],['--big','Day with a big payment','#E8641E'],['--bigin','Day with a big income','#2C7A4C']];
const inkFor=h=>{const n=parseInt(h.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;return(0.299*r+0.587*g+0.114*b)/255>0.6?'#1A0D05':'#FFFFFF'};
function applyColors(){const st=document.documentElement.style;
  for(const[k]of COLS){const v=S.colors[k];if(v)st.setProperty(k,v);else st.removeProperty(k)}
  if(S.colors['--big']){st.setProperty('--big-edge',S.colors['--big']);st.setProperty('--big-ink',inkFor(S.colors['--big']))}else{st.removeProperty('--big-edge');st.removeProperty('--big-ink')}
  if(S.colors['--bigin'])st.setProperty('--bigin-ink',inkFor(S.colors['--bigin']));else st.removeProperty('--bigin-ink')}
function curColor(k,def){if(S.colors[k])return S.colors[k];let v='';try{v=getComputedStyle(document.documentElement).getPropertyValue(k).trim()}catch(e){}return/^#[0-9a-f]{6}$/i.test(v)?v:def}
const tagOf=id=>id&&S.tags.find(t=>t.id===id);
const tagCol=it=>{const t=it&&tagOf(it.tag);return t?t.color:''};
const ROOT=document.documentElement,ORIG_THEME=ROOT.getAttribute('data-theme');
function applyTheme(){if(S.theme==='light'||S.theme==='dark')ROOT.setAttribute('data-theme',S.theme);else if(ORIG_THEME)ROOT.setAttribute('data-theme',ORIG_THEME);else ROOT.removeAttribute('data-theme')}

// ---------- forecast engine ----------
function occ(it,from,to){
  const r=it.rule,out=[],s=r.start||'2000-01-01',e=r.end||'9999-12-31';
  const lo=from>s?from:s,hi=to<e?to:e;if(lo>hi)return out;
  const push=d=>{if(d>=lo&&d<=hi)out.push(d)};
  if(r.freq==='once'){push(r.date);return out}
  if(r.freq==='weekly'||r.freq==='biweekly'){const st=r.freq==='weekly'?7:14;let d=add(r.start,Math.max(0,Math.floor(diff(r.start,lo)/st))*st);while(d<=hi){push(d);d=add(d,st)}return out}
  const m0=+r.month||0;
  const ms={monthly:[0,1,2,3,4,5,6,7,8,9,10,11],quarterly:[0,3,6,9].map(x=>(x+m0)%12),semiannual:[m0,(m0+6)%12],yearly:[m0]}[r.freq].sort((p,q)=>p-q);
  for(let y=P(lo).getFullYear();y<=P(hi).getFullYear();y++)for(const m of ms)push(ymd(y,m,+r.day||1));
  return out;
}
function amt(it,d){let a=it.amounts[0].amount;for(const x of it.amounts)if(x.from<=d)a=x.amount;return a}
const estMonth=(es,d)=>amt(es,mstart(d));
function cardBill(c,d){const p=P(d);let close=ymd(p.getFullYear(),p.getMonth(),c.closeDay);if(close<d)close=ymd(p.getFullYear(),p.getMonth()+1,c.closeDay);return{close,pay:add(close,+c.delay)}}
const stmtStart=(c,close)=>{const p=P(close);return add(ymd(p.getFullYear(),p.getMonth()-1,c.closeDay),1)};
// Runs day by day from `from` (where balances are `start`) to `end`. Each event carries d: {accountId: change} and after: {accountId: balance}.
function forecast(from,end,start){
  const ev=[],bills={},drift={};
  const charge=(c,d,a)=>{const b=cardBill(c,d);if(b.pay<=from||b.pay>end)return;const k=c.id+b.pay;
    (bills[k]||(bills[k]={id:'bill-'+k,date:b.pay,name:c.name+' bill',category:'Credit card',total:0,card:c,close:b.close,start:stmtStart(c,b.close)})).total+=a};
  for(const it of S.items){
    const c=it.type==='expense'?cardOf(it.acct):null;
    if(!c&&!bankOf(it.acct))continue;
    if(it.type==='transfer'&&(!bankOf(it.to)||it.to===it.acct))continue;
    for(const d of occ(it,c?add(from,-75):add(from,1),end)){
      const a=amt(it,d);
      if(c){charge(c,d,a);continue}
      const e={id:it.id+'@'+d,date:d,name:it.name,category:it.category,item:it,acct:it.acct,d:{}};
      if(it.type==='transfer'){e.d[it.acct]=-a;e.d[it.to]=a;e.amount=a;e.transfer=true}
      else{e.d[it.acct]=(it.type==='income'?1:-1)*a;e.amount=e.d[it.acct]}
      ev.push(e);
    }
  }
  for(const es of S.estimates){const c=cardOf(es.acct);if(!c&&!bankOf(es.acct))continue;
    for(let d=c?add(from,-75):add(from,1);d<=end;d=add(d,1)){const p=P(d),per=estMonth(es,d)/dim(p.getFullYear(),p.getMonth());
      if(c)charge(c,d,per);else{const x=drift[d]||(drift[d]={});x[es.acct]=(x[es.acct]||0)-per}}}
  for(const k in bills){const b=bills[k],pf=payFromOf(b.card);if(!pf)continue;ev.push({...b,acct:pf,d:{[pf]:-b.total},amount:-b.total,bill:true})}
  ev.sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:y.amount-x.amount);
  const cur={};S.accounts.forEach(a=>cur[a.id]=+(start[a.id]||0));
  const daily={};daily[from]={...cur};let i=0;
  for(let d=add(from,1);d<=end;d=add(d,1)){const x=drift[d];if(x)for(const k in x)if(k in cur)cur[k]+=x[k];
    while(i<ev.length&&ev[i].date===d){const e=ev[i];for(const k in e.d)if(k in cur)cur[k]+=e.d[k];e.after={};for(const k in e.d)e.after[k]=cur[k];i++}
    daily[d]={...cur}}
  return{ev,daily,end,bills:Object.values(bills)};
}
const sumBals=x=>x?Object.values(x).reduce((s,v)=>s+v,0):undefined;
const val=(x,a)=>x?a==='t'?sumBals(x):x[a]:undefined;
function lowPoint(a,from,days){let best={date:from,bal:Infinity};for(let i=0;i<=days;i++){const d=add(from,i),v=val(F.daily[d],a);if(v!==undefined&&v<best.bal)best={date:d,bal:v}}return best}
function freqText(r){
  return{once:()=>'One time, '+short(r.date)+(P(r.date).getFullYear()!==P(TODAY).getFullYear()?' '+P(r.date).getFullYear():''),
    weekly:()=>'Every '+DAYS[P(r.start).getDay()],biweekly:()=>'Every 2nd '+DAYS[P(r.start).getDay()],
    monthly:()=>'Monthly on the '+ord(+r.day),
    quarterly:()=>'Quarterly, '+[0,3,6,9].map(x=>MON[(x+(+r.month))%12]).join('/')+' '+ord(+r.day),
    semiannual:()=>'Twice a year, '+MON[+r.month]+' & '+MON[(+r.month+6)%12]+' '+ord(+r.day),
    yearly:()=>'Yearly, '+MON[+r.month]+' '+ord(+r.day)}[r.freq]();
}
const annual=it=>occ(it,TODAY,add(TODAY,364)).reduce((s,d)=>s+amt(it,d),0);
const annualEst=es=>{let t=0;const p=P(TODAY);for(let k=0;k<12;k++)t+=estMonth(es,ymd(p.getFullYear(),p.getMonth()+k,1));return t};
const evBal=e=>e.after?e.after[e.acct]:undefined;
const evAcct=e=>e.transfer?acctName(e.item.acct)+' → '+acctName(e.item.to):acctName(e.acct);
// Last day the calendar needs: the end of the last month shown, and at least 400 days out for the 12-month chart.
function calEnd(){const e=yTo()+'-12-31',m=add(TODAY,400);return e>m?e:m}

// ---------- notifications ----------
function notes(){
  const out=[];
  for(const e of F.ev){const n=diff(TODAY,e.date);if(n<0||n>120)continue;
    if(e.bill&&n<=7)out.push({id:e.id,lvl:n<=3?'urgent':'soon',date:e.date,title:e.name+' '+money(e.total),body:'Comes out of '+acctName(e.acct)+' '+when(e.date)+'. Covers card charges from '+short(e.start)+' to '+short(e.close)+'.'});
    else if(e.item&&e.item.remind&&n<=e.item.remind)out.push({id:e.id,lvl:n<=3?'urgent':'soon',date:e.date,title:e.name+' '+money(Math.abs(e.amount)),body:'Due '+when(e.date)+' from '+evAcct(e)+'.'+(evBal(e)!==undefined?' Balance after: '+money(evBal(e))+'.':'')});
  }
  for(const a of S.accounts){const lp=lowPoint(a.id,TODAY,60);
    if(lp.bal<(+a.alert||0))out.push({id:'low-'+a.id+'@'+lp.date+'@'+Math.round(lp.bal),lvl:lp.bal<0||a.type==='checking'?'urgent':'soon',date:lp.date,title:a.name+' dips to '+money(lp.bal),body:'Lowest point in the next 60 days, '+when(lp.date)+'. Your alert for '+a.name+' is '+money(+a.alert)+'.'+(a.type==='checking'?' A bill could bounce even if other accounts look fine.':'')})}
  if(ROLE==='editor')for(const[id,d]of Object.entries(DEV.requests||{}))out.push({id:'req@'+id,lvl:'urgent',date:TODAY,req:id,title:(d&&d.name||'A device')+' wants to view',body:'Allow it to see the family cashflow (view only), or deny it.'});
  if(!CAN())return out.sort((a,b)=>a.date<b.date?-1:1);
  const since=diff(S.balanceDate,TODAY);
  if(since>=14)out.push({id:'recon@'+S.balanceDate,lvl:'soon',date:TODAY,title:'Update your balances',body:'Last updated '+since+' days ago. Updating shows how the month went and keeps the forecast honest.'});
  return out.sort((a,b)=>a.date<b.date?-1:1);
}

// ---------- render ----------
let tab='cal',calAcct='t',totMode='month',openCat=null,F,N;
const $=s=>document.querySelector(s);
function renderStatus(){
  const el=$('#status');if(!el)return;
  if(ROLE==='local'){el.hidden=true;return}
  el.hidden=false;const on=CONN!==false;
  el.className='status '+(on?'on':'off');
  el.lastElementChild.textContent=(ROLE==='editor'?'Editor':ROLE==='viewer'?'View only':'')+(ROLE==='editor'||ROLE==='viewer'?(on?' · live':' · offline'):'');
}
function joinBox(){
  if(INFO.legacy||!INFO.hasCode)return '';
  return '<form id="joinForm" class="stack" style="text-align:left;width:100%;max-width:340px"><div class="field"><label for="joinCode">Editor passcode</label><input id="joinCode" type="password" autocomplete="off" required placeholder="Enter the passcode"></div><button class="btn primary" type="submit">Edit from this device</button><p class="small neg" id="joinMsg" style="margin:0"></p></form>';
}
function gateView(){
  if(ROLE==='pending')return '<div class="gatebox"><div class="big">Waiting for approval</div><p class="muted" style="margin:0">This device will show the family cashflow as <b>view only</b>. On a device that can edit, open the app and tap <b>Allow</b> on the notification, or go to Settings → Devices.</p><p class="muted small" style="margin:0">This screen updates by itself once you’re approved.</p><div class="spin" aria-hidden="true"></div>'+(joinBox()?'<p class="muted small" style="margin:8px 0 0">Want to edit from this device instead?</p>'+joinBox():'')+'</div>';
  if(ROLE==='error')return '<div class="gatebox"><div class="big">Can’t connect</div><p class="muted" style="margin:0">'+esc(GATE_MSG||'The app couldn’t reach the shared data.')+'</p><button class="btn" onclick="location.reload()">Try again</button></div>';
  return '<div class="gatebox"><div class="spin" aria-hidden="true"></div><div class="big">Connecting…</div><p class="muted" style="margin:0">Setting up this device. The first device to open the app becomes the editor; every device after that is view only unless it has the editor passcode.</p></div>';
}
function render(){
  applyTheme();applyColors();
  document.body.classList.toggle('viewer',!CAN());
  renderStatus();
  const gated=ROLE==='connecting'||ROLE==='pending'||ROLE==='error';
  document.body.classList.toggle('gate',gated);
  if(gated){$('#view').innerHTML=gateView();$('#undoBanner').hidden=true;return}
  if(!CAN()&&tab==='man')tab='cal';
  F=forecast(S.balanceDate,calEnd(),startBals());
  N=notes();
  const t=F.daily[TODAY]||startBals();
  $('#hBal').textContent=money(sumBals(t)||0);
  $('#hAcc').innerHTML=S.accounts.map(a=>'<span><i class="sw" style="background:'+acctColor(a)+'"></i>'+esc(a.name)+' <b>'+money(t[a.id]||0)+'</b></span>').join('');
  const nb=$('#nwBtn');nb.innerHTML='<span class="label">Net worth</span><b>'+money(netWorth().net)+' ›</b>';nb.setAttribute('aria-pressed',tab==='nw');
  const unread=N.filter(n=>!S.dismissed.includes(n.id)),urgent=unread.some(n=>n.lvl==='urgent');
  const bg=$('#badge'),bl=$('#bell');bg.hidden=!unread.length;bg.textContent=unread.length;bg.classList.toggle('soft',!urgent);
  bl.classList.toggle('on',unread.length>0);bl.classList.toggle('soft',!urgent);
  bl.setAttribute('aria-label',unread.length?unread.length+' notifications':'Notifications');
  $('#gear').setAttribute('aria-pressed',tab==='set');
  const ub=$('#undoBanner');
  if(S.undo&&CAN()){const at=new Date(S.undo.at);ub.hidden=false;
    ub.innerHTML='<span><b>'+(S.undo.what==='example'?'Your data was replaced with example data':'All your data was erased')+'</b> ('+at.toLocaleDateString('en-CA',{month:'short',day:'numeric'})+', '+at.toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'})+'). Undo brings everything back as it was.</span><span class="row" style="gap:8px"><button class="btn sm primary" data-act="undoErase">Undo</button><button class="btn sm" data-act="keepErase">Keep it this way</button></span>';
  }else ub.hidden=true;
  $('#banner').hidden=!S.example||!CAN()||!!S.undo;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  $('#view').innerHTML={cal:vCal,up:vUp,tot:vTot,cards:vCards,man:vMan,set:vSet,nw:vNW}[tab]();
  bindChart();
}
function netWorth(){const t=F&&F.daily[TODAY]||startBals(),bank=sumBals(t)||0,a=S.nw.assets.reduce((s,x)=>s+x.value,0)+bank,d=S.nw.debts.reduce((s,x)=>s+x.value,0);return{a,d,net:a-d,t}}

// ---------- balance chart ----------
// Pinch or scroll to zoom, drag to move along the timeline. The view is rebuilt on every render,
// so leaving the calendar and coming back always shows the next 12 months again.
let CV=null;
const CH={W:720,H:190,pl:46,pr:10,pt:14,pb:24};
function chartData(){
  const single=calAcct!=='t'?bankOf(calAcct):null,chks=S.accounts.filter(a=>a.type==='checking');
  const n=Math.max(30,diff(TODAY,F.end)+1),dates=[],pts=[],chk=[];
  for(let i=0;i<n;i++){const d=add(TODAY,i),x=F.daily[d]||{};dates.push(d);pts.push(val(x,calAcct)||0);chk.push(chks.reduce((s,a)=>s+(x[a.id]||0),0))}
  const showChk=!single&&chks.length>0&&S.accounts.length>1,alA=single||(chks.length===1?chks[0]:null);
  return{single,chks,dates,pts,chk,showChk,alA,al:alA?+alA.alert||0:null,n,start:0,span:Math.min(365,n)};
}
function chartTitle(){
  if(CV.start===0&&CV.span===Math.min(365,CV.n))return 'Next 12 months';
  const a=CV.dates[CV.start],b=CV.dates[CV.start+CV.span-1],y=s=>P(s).getFullYear();
  return short(a)+(y(a)!==y(b)?', '+y(a):'')+' – '+short(b)+', '+y(b);
}
function chartSVG(){
  const{W,H,pl,pr,pt,pb}=CH,{start,span,dates,showChk,al,alA,single,chks}=CV;
  const step=Math.max(1,Math.ceil(span/500));          // draw at most ~500 points, however far out the view is
  const idx=[];for(let i=start;i<start+span;i+=step)idx.push(i);if(idx[idx.length-1]!==start+span-1)idx.push(start+span-1);
  const pts=idx.map(i=>CV.pts[i]),chk=idx.map(i=>CV.chk[i]);
  let mn=Math.min(...pts,...(showChk?chk:[]),0),mx=Math.max(...pts,...(showChk?chk:[]),al||0);const pad=(mx-mn)*.08||100;mn-=pad;mx+=pad;
  const raw=(mx-mn)/4,mag=Math.pow(10,Math.floor(Math.log10(raw))),nice=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw);
  const X=i=>pl+(W-pl-pr)*(i-start)/Math.max(1,span-1),Y=v=>pt+(H-pt-pb)*(1-(v-mn)/(mx-mn));
  const path=a=>a.map((v,k)=>(k?'L':'M')+X(idx[k]).toFixed(1)+' '+Y(v).toFixed(1)).join('');
  const line=path(pts),base=Y(Math.max(mn,0));
  let g='';for(let v=Math.ceil(mn/nice)*nice;v<=mx;v+=nice)g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)"/><text class="ax" x="'+(pl-6)+'" y="'+(Y(v)+3)+'" text-anchor="end">'+kmoney(v)+'</text>';
  // Month ticks: every month when zoomed in, every few months when zoomed out. Years show on January.
  const every=span<=450?1:span<=800?2:span<=1300?3:span<=2600?6:12;let mt='',lastX=-99;
  for(let i=start;i<start+span;i++){const p=P(dates[i]);if(p.getDate()!==1||p.getMonth()%every)continue;const x=X(i);if(x-lastX<34)continue;lastX=x;
    const lbl=p.getMonth()===0||span>800?MON[p.getMonth()]+(p.getMonth()===0||every>=6?" '"+String(p.getFullYear()).slice(2):''):MON[p.getMonth()];
    mt+='<text class="ax" x="'+x+'" y="'+(H-8)+'" text-anchor="middle">'+lbl+'</text><line x1="'+x+'" x2="'+x+'" y1="'+(H-pb)+'" y2="'+(H-pb+4)+'" stroke="var(--muted)"/>'}
  const ser=showChk?CV.chk:CV.pts;let li=start;for(let i=start;i<start+span;i++)if(ser[i]<ser[li])li=i;const lv=ser[li];
  const col=single?acctColor(single):'var(--accent)';
  const chkLbl=chks.length===1?chks[0].name:'All checking',lowLbl=(single?single.name:showChk?chkLbl:'total').toLowerCase();
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Projected balance, '+esc(chartTitle())+'">'+g+
  (al!=null?'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(al)+'" y2="'+Y(al)+'" stroke="var(--warn)" stroke-dasharray="4 4"/>':'')+
  '<path d="'+line+'L'+X(start+span-1)+' '+base+'L'+X(start)+' '+base+'Z" fill="'+col+'" fill-opacity=".12"/>'+
  (showChk?'<path d="'+path(chk)+'" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="1 3" stroke-linecap="round"/>':'')+
  '<path d="'+line+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>'+
  '<circle cx="'+X(li)+'" cy="'+Y(lv)+'" r="4.5" fill="var(--bad)" stroke="var(--surface)" stroke-width="2"/>'+
  '<text class="ax" x="'+Math.min(Math.max(X(li),pl+60),W-80)+'" y="'+Math.min(Y(lv)+16,H-pb-4)+'" text-anchor="middle" style="fill:var(--bad)">'+esc(lowLbl)+' low '+kmoney(lv)+' '+short(dates[li])+'</text>'+mt+'</svg>';
}
function chart(){
  CV=chartData();
  const{single,showChk,chks,al,alA}=CV,col=single?acctColor(single):'var(--accent)',chkLbl=chks.length===1?chks[0].name:'All checking';
  return '<div class="panel chart"><div class="row between wrapr" style="margin-bottom:6px;gap:4px 10px"><h3 id="chTitle">'+esc(chartTitle())+'</h3><span class="row" style="gap:8px"><button class="btn sm" data-act="chartReset" id="chReset" hidden>Back to 12 months</button><span class="label">'+(single?esc(single.name):'Total cash')+'</span></span></div>'+
  '<div class="chsvg" id="chSvg">'+chartSVG()+'</div>'+
  '<div class="legend"><span><i style="background:'+col+'"></i>'+(single?esc(single.name):'Total')+'</span>'+(showChk?'<span><i style="background:var(--muted)"></i>'+esc(chkLbl)+' (dotted)</span>':'')+(al!=null?'<span><i style="background:var(--warn)"></i>'+esc(alA.name)+' alert '+money(al)+'</span>':'')+'<span class="chhint">Pinch or scroll to zoom · drag to move</span></div></div>';
}
function redrawChart(){
  const el=$('#chSvg');if(!el||!CV)return;el.innerHTML=chartSVG();
  $('#chTitle').textContent=chartTitle();$('#chReset').hidden=CV.start===0&&CV.span===Math.min(365,CV.n);
}
let chartRaf=0;
function setView(start,span){
  span=Math.round(Math.min(CV.n,Math.max(30,span)));start=Math.round(Math.min(CV.n-span,Math.max(0,start)));
  if(start===CV.start&&span===CV.span)return;CV.start=start;CV.span=span;
  if(!chartRaf)chartRaf=requestAnimationFrame(()=>{chartRaf=0;redrawChart()});
}
// Turns a screen x position into a fraction across the plot area (0 = left edge of the line, 1 = right edge).
function plotFrac(el,clientX){const r=el.getBoundingClientRect(),{W,pl,pr}=CH,x=(clientX-r.left)/r.width*W;return Math.min(1,Math.max(0,(x-pl)/(W-pl-pr)))}
function bindChart(){
  const el=$('#chSvg');if(!el||el._bound)return;el._bound=true;
  const ptrs=new Map();let g=null;
  const begin=()=>{const v=[...ptrs.values()];
    if(v.length===1)g={kind:'pan',x0:v[0].x,start0:CV.start};
    else if(v.length>=2){const[a,b]=v,mid=(a.x+b.x)/2,f=plotFrac(el,mid);g={kind:'pinch',d0:Math.max(10,Math.abs(a.x-b.x)),span0:CV.span,f,anchor:CV.start+f*(CV.span-1)}}};
  el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;ptrs.set(e.pointerId,{x:e.clientX});try{el.setPointerCapture(e.pointerId)}catch(_){}begin();el.classList.add('grab')});
  el.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId)||!g)return;ptrs.get(e.pointerId).x=e.clientX;const v=[...ptrs.values()],r=el.getBoundingClientRect(),plotW=r.width*(CH.W-CH.pl-CH.pr)/CH.W;
    if(g.kind==='pan'&&v.length===1)setView(g.start0-(v[0].x-g.x0)/plotW*(CV.span-1),CV.span);
    else if(g.kind==='pinch'&&v.length>=2){const span=g.span0*g.d0/Math.max(10,Math.abs(v[0].x-v[1].x));const s=Math.min(CV.n,Math.max(30,span));setView(g.anchor-g.f*(s-1),s)}});
  const end=e=>{ptrs.delete(e.pointerId);if(!ptrs.size){g=null;el.classList.remove('grab')}else begin()};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
  el.addEventListener('wheel',e=>{e.preventDefault();const f=plotFrac(el,e.clientX),anchor=CV.start+f*(CV.span-1);
    const s=Math.min(CV.n,Math.max(30,CV.span*Math.exp((e.deltaY||e.deltaX)*0.0015)));setView(anchor-f*(s-1),s)},{passive:false});
}
function lowCls(x){if(!x)return'';
  if(calAcct==='t'){if(S.accounts.some(a=>(x[a.id]||0)<0))return'negb';return S.accounts.some(a=>(x[a.id]||0)<(+a.alert||0))?'low':''}
  const a=bankOf(calAcct),v=x[calAcct];return v<0?'negb':a&&v<(+a.alert||0)?'low':''}
const CARD_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';
function calSegs(){
  const cc=cardOf(calAcct);
  return '<div class="row wrapr" style="gap:8px"><div class="seg" role="group" aria-label="Account">'+[['t','Total'],...S.accounts.map(a=>[a.id,a.name])].map(([k,l])=>'<button data-act="calAcct" data-a="'+esc(k)+'" aria-pressed="'+(calAcct===k)+'">'+esc(l)+'</button>').join('')+'</div>'+
  (S.cards.length?'<div class="seg cardseg" role="group" aria-label="Card calendars">'+S.cards.map(c=>'<button data-act="calAcct" data-a="'+c.id+'" aria-pressed="'+(calAcct===c.id)+'">'+CARD_SVG+' '+esc(c.name)+'</button>').join('')+'</div>':'')+
  '</div><p class="muted small" style="margin:-4px 0 0">'+(cc?'Showing the '+esc(cc.name)+' calendar. Tap Total or an account to go back to your bank balances.':'Tap a day to see its balances, or a card to see its calendar.')+'</p>';
}
// The months shown: from calStart() through December of the "to" year set in Settings.
function monthList(){const out=[],end=yTo()+'-12-01';let d=calStart();while(d<=end){out.push(d);const p=P(d);d=ymd(p.getFullYear(),p.getMonth()+1,1)}return out}
// One calendar day: up to three items as name + amount, the rest as dots.
function dayCell(o){
  const srt=o.items.slice().sort((p,q)=>Math.abs(q.amt)-Math.abs(p.amt));
  const lines=srt.slice(0,3).map(e=>'<span class="it '+e.kind+'"'+(e.color?' style="color:'+e.color+'"':'')+'><span class="n">'+esc(e.name)+'</span><span class="a">$'+kmoney(Math.abs(e.amt))+'</span></span>').join('');
  const dots=srt.slice(3).map(e=>'<i class="dot '+e.kind+'"'+(e.color?' style="background:'+e.color+'"':'')+'></i>').join('');
  return '<button class="'+o.cls+'" data-act="'+o.act+'" data-d="'+o.ds+'" aria-label="'+esc(o.aria)+'"><span class="d"><span>'+o.d+'</span>'+(o.tags||'')+'</span>'+lines+(dots?'<span class="dots">'+dots+'</span>':'')+'</button>';
}
const evKind=e=>e.transfer?'sv':e.amount>0?'in':e.bill?'bill':-e.amount>=500?'big':'';
function bigCls(exp,inc){const th=TH();return exp>=th.exp?'bigday':inc>=th.inc?'bigin':''}
// Monthly estimates have no date, so they're listed together under each month.
function estList(ests,ms,note,showAcct){
  if(!ests.length)return'';let t=0;
  const rows=ests.map(es=>{const a=estMonth(es,ms);t+=a;return'<div class="er"><span>'+esc(es.name)+(showAcct?' <span class="muted">· '+esc(acctName(es.acct))+'</span>':'')+'</span><b class="num">'+money(a)+'</b></div>'}).join('');
  return '<div class="mest"><div class="row between wrapr" style="gap:2px 10px"><span class="label">Monthly estimates</span><span class="muted small">'+note+'</span></div>'+rows+(ests.length>1?'<div class="er tot"><span>Total</span><b class="num">'+money(t)+'</b></div>':'')+'</div>';
}
function vCal(){
  const cc=cardOf(calAcct);
  if(cc)return '<div class="stack">'+calSegs()+vCardBody(cc)+'</div>';
  if(calAcct!=='t'&&!bankOf(calAcct))calAcct='t';
  const byDate={},addEv=e=>{if(calAcct!=='t'&&e.d[calAcct]===undefined)return;(byDate[e.date]||(byDate[e.date]=[])).push(e)};
  F.ev.forEach(addEv);
  const ests=S.estimates.filter(e=>bankOf(e.acct)&&(calAcct==='t'||e.acct===calAcct));
  let h='';
  for(const ms of monthList()){const y=P(ms).getFullYear(),m=P(ms).getMonth(),n=dim(y,m),first=new Date(y,m,1).getDay(),me=mend(ms);
    const endBal=val(F.daily[me],calAcct),prevD=add(ms,-1);
    let startBal,startLbl;
    if(F.daily[prevD]){startBal=val(F.daily[prevD],calAcct);startLbl='starts'}
    else if(F.daily[me]){startBal=val(F.daily[S.balanceDate],calAcct);startLbl=S.balanceDate===TODAY?'today':'on '+short(S.balanceDate)}
    let cells='SMTWTFS'.split('').map(c=>'<div class="dow">'+c+'</div>').join('')+'<div></div>'.repeat(first);
    for(let d=1;d<=n;d++){const ds=ymd(y,m,d),x=F.daily[ds],v=val(x,calAcct),evs=byDate[ds]||[];
      let exp=0,inc=0;evs.forEach(e=>{if(e.transfer)return;if(e.amount<0)exp=Math.max(exp,-e.amount);else inc=Math.max(inc,e.amount)});
      const big=bigCls(exp,inc);
      const cls=['day',ds<TODAY?'past':'',ds===TODAY?'today':'',big||(ds>=TODAY?lowCls(x):'')].join(' ');
      cells+=dayCell({ds,d,cls,act:'day',items:evs.map(e=>({name:e.bill?e.card.name:e.name,amt:e.amount,kind:evKind(e),color:tagCol(e.item)})),
        aria:short(ds)+(evs.length?': '+evs.map(e=>(e.bill?e.card.name+' payment':e.name)+' '+money(Math.abs(e.amount))).join(', '):'')+(v!==undefined?'. Balance '+money(v):'')});
    }
    const head=startBal!==undefined?startLbl+' <b>'+money(startBal)+'</b>':'past month';
    h+='<section class="month panel" id="mo-'+ms.slice(0,7)+'"><h3>'+MONL[m]+' '+y+'<span>'+head+'</span></h3><div class="grid">'+cells+'</div>'+
      estList(ests,ms,'taken off evenly through the month',calAcct==='t'&&S.accounts.length>1)+
      (endBal!==undefined?'<div class="mfoot">ends <b>'+money(endBal)+'</b>'+(startBal!==undefined?' <span class="'+(endBal-startBal<0?'neg':'pos')+'">('+(endBal-startBal>=0?'+':'')+money(endBal-startBal)+')</span>':'')+'</div>':'')+'</section>'}
  const th=TH();
  return '<div class="stack">'+calSegs()+chart()+
  '<div class="legend"><span><i style="background:var(--c-in)"></i>Income</span><span><i style="background:var(--c-bill)"></i>Bill</span><span><i style="background:var(--c-500)"></i>$500+</span><span><i style="background:var(--c-card)"></i>Card payment</span><span><i style="background:var(--c-xfer)"></i>Transfer</span>'+S.tags.map(t=>'<span><i style="background:'+esc(t.color)+'"></i>'+esc(t.name)+'</span>').join('')+'<span><i style="background:var(--big)"></i>Payment of '+money(th.exp)+' or more</span><span><i style="background:var(--bigin)"></i>Income of '+money(th.inc)+' or more</span><span><i style="background:var(--warn-soft);outline:1px solid var(--warn)"></i>Below an alert</span><button class="btn link small" data-act="tabTo" data-t="set" style="padding:0">Change colours</button></div>'+
  '<div class="months">'+h+'</div></div>';
}
function evRow(e,trough){
  const tg=e.item&&tagOf(e.item.tag);
  const meta=e.bill?'Card charges '+short(e.start)+' – '+short(e.close)+' · '+esc(acctName(e.acct)):(tg?'<span class="tagchip"><i style="background:'+esc(tg.color)+'"></i>'+esc(tg.name)+'</span> · ':'')+esc(e.category)+' · '+esc(evAcct(e));
  const amtTxt=e.transfer?money(e.amount,1):(e.amount>0?'+':'')+money(e.amount,1);
  const nm=e.item&&CAN()?'<button class="nm nmb" data-act="edit" data-i="'+e.item.id+'" aria-label="Edit '+esc(e.name)+'">'+esc(e.name)+' <span class="pen">Edit ›</span></button>':'<div class="nm">'+esc(e.name)+'</div>';
  const after=!e.transfer&&evBal(e)!==undefined?esc(acctName(e.acct))+' '+money(evBal(e)):'';
  return '<div class="li'+(trough?' trough':'')+'"><div class="date">'+MON[P(e.date).getMonth()]+'<b>'+P(e.date).getDate()+'</b></div><div>'+nm+'<div class="meta">'+meta+(trough?' · <b class="neg">low point</b>':'')+'</div>'+(e.bill?'<button class="btn link small" data-act="openCard" data-c="'+e.card.id+'" data-m="'+e.close+'">See what’s on this card →</button>':'')+'</div><div><div class="amt '+(e.amount>0&&!e.transfer?'pos':'')+'">'+amtTxt+'</div><div class="after">'+after+'</div></div></div>';
}
function vUp(){
  const end=add(TODAY,30),evs=F.ev.filter(e=>e.date>TODAY&&e.date<=end);
  let lo=null;evs.forEach(e=>{const a=bankOf(e.acct);if(e.transfer||!a||a.type!=='checking')return;if(!lo||evBal(e)<evBal(lo))lo=e});
  const loA=lo&&bankOf(lo.acct),isTrough=lo&&evBal(lo)<(+loA.alert||0);
  const inn=evs.reduce((s,e)=>s+(!e.transfer&&e.amount>0?e.amount:0),0);
  const t0=sumBals(F.daily[TODAY]||startBals()),t1=sumBals(F.daily[end]),out=inn-(t1-t0);
  const estM=S.estimates.filter(e=>bankOf(e.acct)).reduce((s,e)=>s+estMonth(e,TODAY),0);
  return '<div class="stack"><div class="kpis"><div class="kpi"><div class="label">Coming in</div><div class="num pos">'+money(inn)+'</div></div><div class="kpi"><div class="label">Going out</div><div class="num">'+money(out)+'</div></div><div class="kpi"><div class="label">Total in 30 days</div><div class="num">'+money(t1)+'</div></div></div>'+
  '<div class="panel"><div class="row between" style="margin-bottom:4px"><h3>Next 30 days</h3><span class="label">Amount · balance after</span></div><div class="list">'+(evs.map(e=>evRow(e,isTrough&&e===lo)).join('')||'<p class="muted">Nothing scheduled.</p>')+'</div>'+
  (estM?'<p class="muted small" style="margin:10px 0 0">Plus '+money(estM)+'/month in estimates paid from your bank accounts (groceries and similar), taken off a little each day. Card estimates are included in the card payments above.</p>':'')+'</div></div>';
}
function vTot(){
  const mult=totMode==='month'?1/12:1,cats={};let inc=0;
  const put=(cat,name,a,sub)=>{(cats[cat]||(cats[cat]={t:0,items:[]})).t+=a;cats[cat].items.push({name,a,sub})};
  for(const it of S.items){const a=annual(it)*mult;if(it.type==='income'){inc+=a;continue}if(it.type==='transfer')continue;put(it.category,it.name,a,freqText(it.rule))}
  for(const es of S.estimates)put(es.category,es.name,annualEst(es)*mult,'monthly estimate');
  const saved=S.items.filter(i=>i.type==='transfer'&&(bankOf(i.to)||{}).type==='savings').reduce((s,i)=>s+annual(i)*mult,0);
  const rows=Object.entries(cats).filter(c=>c[1].t>0).sort((a,b)=>b[1].t-a[1].t),tot=rows.reduce((s,r)=>s+r[1].t,0),max=rows.length?rows[0][1].t:1;
  return '<div class="stack"><div class="row between wrapr"><div class="seg" role="group" aria-label="Period"><button data-act="mode" data-m="month" aria-pressed="'+(totMode==='month')+'">Per month</button><button data-act="mode" data-m="year" aria-pressed="'+(totMode==='year')+'">Per year</button></div><span class="muted small">Based on the next 12 months</span></div>'+
  '<div class="kpis"><div class="kpi"><div class="label">Income</div><div class="num pos">'+money(inc)+'</div></div><div class="kpi"><div class="label">Expenses</div><div class="num">'+money(tot)+'</div></div><div class="kpi"><div class="label">Left over</div><div class="num '+(inc-tot<0?'neg':'pos')+'">'+money(inc-tot)+'</div>'+(saved?'<div class="muted small">'+money(saved)+' moved to savings</div>':'')+'</div></div>'+
  '<div class="panel">'+(rows.map(([c,v])=>'<div class="cat"><button data-act="cat" data-c="'+esc(c)+'" aria-expanded="'+(openCat===c)+'"><span><b>'+esc(c)+'</b> <span class="muted small">'+v.items.length+' item'+(v.items.length>1?'s':'')+' · '+Math.round(v.t/tot*100)+'%</span></span><span class="num" style="font-weight:600">'+money(v.t)+'</span><span class="bar"><i style="width:'+(v.t/max*100).toFixed(1)+'%"></i></span></button>'+
    (openCat===c?'<div class="sublist">'+v.items.sort((a,b)=>b.a-a.a).map(x=>'<div><span>'+esc(x.name)+' <span class="muted">· '+x.sub+'</span></span><span class="num">'+money(x.a,x.a<100)+'</span></div>').join('')+'</div>':'')+'</div>').join('')||'<p class="muted">Nothing added yet.</p>')+'</div></div>';
}
function vCards(){
  return '<div class="stack"><p class="muted" style="margin:0;font-size:13px">Everything each card pays for. Lost a card? <b>Replace lost card</b> gives you a checklist of every place to update.</p>'+S.cards.map(c=>{
    const its=S.items.filter(i=>i.acct===c.id),ests=S.estimates.filter(e=>e.acct===c.id),R=S.replacing&&S.replacing.card===c.id?S.replacing:null;
    const next=F.ev.find(e=>e.bill&&e.card.id===c.id&&e.date>TODAY);
    let body;
    if(R){const done=its.filter(i=>R.done.includes(i.id)).length;
      body='<div><div class="row between"><b>'+done+' of '+its.length+' updated</b><span class="muted small">'+(its.length-done)+' to go</span></div><div class="prog" style="margin-top:6px"><i style="width:'+(its.length?done/its.length*100:100)+'%"></i></div></div>'+
      its.map(i=>'<label class="check'+(R.done.includes(i.id)?' done':'')+'"><input type="checkbox" id="rc-'+i.id+'" data-act="tick" data-i="'+i.id+'"'+(R.done.includes(i.id)?' checked':'')+'><span>'+esc(i.name)+' <span class="muted small">· '+money(amt(i,TODAY),1)+'</span></span></label>').join('')+
      '<div class="fgrid" style="align-items:end"><div class="field"><label for="new4">New card last 4 digits</label><input id="new4" inputmode="numeric" maxlength="4" placeholder="0000"></div><div class="row"><button class="btn primary" data-act="finishRep" data-c="'+c.id+'">Finish</button><button class="btn" data-act="cancelRep">Cancel</button></div></div>';
    }else body=(its.length?'<div class="label">'+its.length+' automatic payment'+(its.length===1?'':'s')+'</div>':'')+its.map(i=>'<div class="check"><span style="flex:1;min-width:0">'+esc(i.name)+' <span class="muted small">· '+freqText(i.rule)+'</span></span><span class="num">'+money(amt(i,TODAY),1)+'</span></div>').join('')+
      (ests.length?'<div class="label est-l">Monthly estimates</div><div class="estlist">'+ests.map(e=>(CAN()?'<button class="estrow" data-act="editEst" data-e="'+e.id+'">':'<div class="estrow">')+'<span style="flex:1;min-width:0">'+esc(e.name)+' <span class="small">· estimate, no set date</span></span><span class="num">'+money(estMonth(e,TODAY))+'/mo</span>'+(CAN()?'</button>':'</div>')).join('')+'</div>':'')+
      '<div class="row wrapr"><button class="btn" data-act="startRep" data-c="'+c.id+'">Replace lost card</button><button class="btn" data-act="editCard" data-c="'+c.id+'">Edit</button></div>';
    return '<section class="panel ccard"><div class="plastic"><div><div class="nm">'+esc(c.name)+'</div><div style="font-size:12px;opacity:.75">Statement closes the '+ord(+c.closeDay)+' · paid from '+esc(acctName(payFromOf(c)))+' '+c.delay+' days later</div></div><div class="num" style="font-size:16px">•• '+esc(c.last4)+'</div></div>'+
      (next?'<div class="row between" style="font-size:13px"><span>Next payment from '+esc(acctName(next.acct))+': <b>'+short(next.date)+'</b></span><b class="num">'+money(next.total)+'</b></div>':'')+body+'</section>'}).join('')+
    '<button class="btn" data-act="editCard" data-c="" style="justify-self:start">Add a card</button><p class="muted small" style="margin:0">Only a nickname and the last 4 digits are stored, never the full card number.</p></div>';
}
function cardCharges(c,from,to){const out=[];for(const it of S.items)if(it.acct===c.id)for(const d of occ(it,from,to))out.push({d,id:it.id,name:it.name,a:amt(it,d),it});return out.sort((a,b)=>a.d<b.d?-1:1)}
function vCardBody(c){
  const ests=S.estimates.filter(e=>e.acct===c.id),its=S.items.filter(i=>i.acct===c.id),pf=acctName(payFromOf(c));
  const bills=F.bills.filter(b=>b.card.id===c.id);
  const next=F.bills.filter(b=>b.card.id===c.id&&b.date>TODAY).sort((a,b)=>a.date<b.date?-1:1)[0];
  let h='';
  for(const ms of monthList()){const y=P(ms).getFullYear(),m=P(ms).getMonth(),n=dim(y,m),me=mend(ms);
    const ch=cardCharges(c,ms,me),byD={};ch.forEach(x=>(byD[x.d]||(byD[x.d]=[])).push(x));
    let cells='SMTWTFS'.split('').map(x=>'<div class="dow">'+x+'</div>').join('')+'<div></div>'.repeat(new Date(y,m,1).getDay());
    for(let d=1;d<=n;d++){const ds=ymd(y,m,d),xs=byD[ds]||[],sum=xs.reduce((s,x)=>s+x.a,0),b=cardBill(c,ds);
      const isStart=stmtStart(c,b.close)===ds,isClose=b.close===ds,pay=bills.find(x=>x.date===ds);
      const big=bigCls(Math.max(0,...xs.map(x=>x.a)),0);
      const tags=(isStart?'<span class="tag">start</span>':'')+(isClose?'<span class="tag">close</span>':'')+(pay?'<span class="tag pay">pay</span>':'');
      cells+=dayCell({ds,d,act:'cday',tags:tags?'<span class="tags">'+tags+'</span>':'',
        cls:'day p'+(P(b.close).getMonth()%2)+(big?' '+big:'')+(ds===TODAY?' today':'')+(ds<TODAY?' past':''),
        items:xs.map(x=>({name:x.name,amt:-x.a,kind:x.a>=500?'big':'',color:tagCol(x.it)})),
        aria:short(ds)+(xs.length?': '+xs.map(x=>x.name+' '+money(x.a,1)).join(', '):'')+(isStart?'. Billing period starts':'')+(isClose?'. Billing period ends':'')+(pay?'. '+money(pay.total)+' paid from '+pf:'')});
    }
    const closeD=ymd(y,m,c.closeDay),bill=bills.find(b=>b.close===closeD),payIn=bills.filter(b=>b.date>=ms&&b.date<=me);
    h+='<section class="month panel" id="cm-'+ms.slice(0,7)+'"><h3>'+MONL[m]+' '+y+'<span>charges <b>'+money(ch.reduce((s,x)=>s+x.a,0))+'</b></span></h3><div class="grid">'+cells+'</div>'+
      estList(ests,ms,'included in the statement',false)+
      '<div class="stmt"><span>Billing period <b>'+short(stmtStart(c,closeD))+' – '+short(closeD)+'</b></span><span>'+(bill?'Statement <b class="num">'+money(bill.total)+'</b> · ':'')+'paid from '+esc(pf)+' <b>'+short(add(closeD,+c.delay))+'</b></span></div>'+
      (payIn.length?'<div class="mfoot">paid from '+esc(pf)+' this month: '+payIn.map(b=>'<b>'+money(b.total)+'</b> on '+short(b.date)).join(', ')+'</div>':'')+'</section>'}
  return '<div class="plastic"><div><div class="nm">'+esc(c.name)+'</div><div style="font-size:12px;opacity:.75">Closes the '+ord(+c.closeDay)+' · paid from '+esc(pf)+' '+c.delay+' days later</div></div><div class="num" style="font-size:16px">•• '+esc(c.last4)+'</div></div>'+
  '<div class="kpis"><div class="kpi"><div class="label">Next payment</div><div class="num">'+(next?money(next.total):'—')+'</div>'+(next?'<div class="muted small">from '+esc(pf)+' '+short(next.date)+'</div>':'')+'</div><div class="kpi"><div class="label">Recurring / mo</div><div class="num">'+money(its.reduce((s,i)=>s+annual(i),0)/12)+'</div></div><div class="kpi"><div class="label">Estimates / mo</div><div class="num">'+money(ests.reduce((s,e)=>s+estMonth(e,TODAY),0))+'</div></div></div>'+
  '<div class="legend"><span><i style="background:var(--sunk)"></i><i style="background:var(--accent-soft);margin-left:-3px"></i>Each shade is one billing period</span><span><b style="color:var(--accent);font-size:10px">START</b> / <b style="color:var(--accent);font-size:10px">CLOSE</b> period begins / ends</span><span><b style="color:var(--bad);font-size:10px">PAY</b> comes out of '+esc(pf)+'</span>'+S.tags.map(t=>'<span><i style="background:'+esc(t.color)+'"></i>'+esc(t.name)+'</span>').join('')+'<span><i style="background:var(--big)"></i>Charge of '+money(TH().exp)+' or more</span></div>'+
  '<div class="months">'+h+'</div>';
}
function vMan(){
  const byCat={};S.items.forEach(i=>(byCat[i.category]||(byCat[i.category]=[])).push(i));
  const ord2=(a,b)=>S.categories.indexOf(a)-S.categories.indexOf(b);
  const estTotal=S.estimates.reduce((s,e)=>s+estMonth(e,TODAY),0),now=F.daily[TODAY]||startBals();
  const f=x=>x===undefined?'<span class="muted">—</span>':'<span class="'+(x<-0.5?'neg':x>0.5?'pos':'muted')+'">'+(x>0.5?'+':'')+money(x)+'</span>';
  return '<div class="stack"><section class="panel stack"><div class="row between wrapr"><div><h3>Bank accounts</h3><div class="muted small">Balances entered '+short(S.balanceDate)+'</div></div><div class="row wrapr" style="gap:8px"><button class="btn sm" data-act="editAcct" data-a="">Add account</button><button class="btn sm primary" data-act="recon">Update balances</button></div></div>'+
  '<div>'+S.accounts.map(a=>'<button class="check" data-act="editAcct" data-a="'+a.id+'"><i class="sw" style="background:'+acctColor(a)+'"></i><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(a.name)+'</b> <span class="chip">'+(a.type==='savings'?'Savings':'Checking')+'</span><br><span class="muted small">Alert below '+money(+a.alert||0)+'</span></span><span class="num">'+money(now[a.id]||0)+'</span></button>').join('')+'</div>'+
  (S.history.length?'<div class="tscroll"><table><thead><tr><th>Checked</th>'+S.accounts.map(a=>'<th>'+esc(a.name)+'</th>').join('')+'<th>Total vs forecast</th></tr></thead><tbody>'+S.history.slice().reverse().map(h=>{let t=0;const cells=S.accounts.map(a=>{const r=h.a[a.id];if(!r)return'<td class="num">'+f()+'</td>';t+=r.a-r.p;return'<td class="num">'+f(r.a-r.p)+'</td>'}).join('');return'<tr><td>'+short(h.date)+'</td>'+cells+'<td class="num">'+f(t)+'</td></tr>'}).join('')+'</tbody></table></div>':'')+'</section>'+
  '<section class="panel"><div class="row between" style="margin-bottom:2px"><h3>Monthly estimates</h3><button class="btn sm primary" data-act="editEst" data-e="">Add</button></div><p class="muted small" style="margin:0 0 6px">Spending that changes from month to month. Type a new amount and it applies from this month on.</p>'+
  S.estimates.map(e=>'<div class="est"><button class="nm" data-act="editEst" data-e="'+e.id+'"><b style="font-weight:600">'+esc(e.name)+'</b><br><span class="muted small">'+esc(e.category)+' · '+esc(acctName(e.acct))+'</span></button>'+moneyField('est-'+e.id,estMonth(e,TODAY),{attrs:' data-est="'+e.id+'" aria-label="'+esc(e.name)+' per month"'})+'<div class="saved" id="sv-'+e.id+'"></div></div>').join('')+
  '<div class="row between" style="border-top:1px solid var(--line);padding-top:8px;margin-top:4px"><span class="label">Total per month</span><b class="num">'+money(estTotal)+'</b></div></section>'+
  '<section class="panel"><div class="row between" style="margin-bottom:6px"><h3>Recurring and planned</h3><button class="btn sm primary" data-act="edit" data-i="">Add</button></div>'+
  (Object.keys(byCat).sort(ord2).map(c=>'<div class="label" style="margin-top:12px">'+esc(c)+'</div>'+byCat[c].map(i=>'<button class="check" data-act="edit" data-i="'+i.id+'"><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(i.name)+'</b>'+(tagOf(i.tag)?' <span class="tagchip"><i style="background:'+esc(tagOf(i.tag).color)+'"></i>'+esc(tagOf(i.tag).name)+'</span>':'')+'<br><span class="muted small">'+freqText(i.rule)+' · '+esc(i.type==='transfer'?acctName(i.acct)+' → '+acctName(i.to):acctName(i.acct))+'</span></span><span class="num '+(i.type==='income'?'pos':'')+'">'+money(amt(i,TODAY),1)+'</span></button>').join('')).join('')||'<p class="muted">Nothing yet. Add your salary and bills to start the forecast.</p>')+'</section></div>';
}
function vNW(){
  const W=netWorth(),tot=W.a+W.d||1;
  const row=(x,kind)=>(CAN()?'<button class="check" data-act="editNW" data-k="'+kind+'" data-n="'+x.id+'">':'<div class="check">')+'<span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(x.name)+'</b><br><span class="muted small">Updated '+short(x.updated)+'</span></span><span class="num'+(kind==='debt'?' neg':'')+'">'+(kind==='debt'?'−':'')+money(x.value)+'</span>'+(CAN()?'</button>':'</div>');
  const group=(kind,list,title,total)=>'<section class="panel"><div class="row between" style="margin-bottom:4px"><h3>'+title+'</h3>'+(CAN()?'<button class="btn sm primary" data-act="editNW" data-k="'+kind+'" data-n="">Add</button>':'')+'</div>'+
    (kind==='asset'?S.accounts.map(a=>'<div class="check"><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(a.name)+'</b><br><span class="muted small">From your bank balances</span></span><span class="num">'+money(W.t[a.id]||0)+'</span></div>').join(''):'')+
    list.map(x=>row(x,kind)).join('')+
    (kind==='debt'&&!list.length?'<p class="muted small">Nothing added yet. Add your mortgage, loans and card balances.</p>':'')+
    '<div class="row between" style="border-top:1px solid var(--line);padding-top:8px;margin-top:6px"><span class="label">Total</span><b class="num'+(kind==='debt'?' neg':'')+'">'+(kind==='debt'?'−':'')+money(total)+'</b></div></section>';
  return '<div class="stack"><button class="btn link" data-act="tabTo" data-t="cal" style="justify-self:start">← Back</button>'+
  '<section class="panel stack"><div><div class="label">Net worth</div><div class="bal '+(W.net<0?'neg':'')+'">'+money(W.net)+'</div><div class="muted small">What you own minus what you owe, as of today</div></div>'+
  '<div class="nwbar" role="img" aria-label="Assets '+money(W.a)+', owed '+money(W.d)+'"><i style="width:'+(W.a/tot*100).toFixed(1)+'%;background:var(--good)"></i><i style="width:'+(W.d/tot*100).toFixed(1)+'%;background:var(--bad)"></i></div>'+
  '<div class="kpis"><div class="kpi"><div class="label">You own</div><div class="num pos">'+money(W.a)+'</div></div><div class="kpi"><div class="label">You owe</div><div class="num neg">'+money(W.d)+'</div></div><div class="kpi"><div class="label">Debt to assets</div><div class="num">'+(W.a?Math.round(W.d/W.a*100):0)+'%</div></div></div></section>'+
  group('asset',S.nw.assets,'What you own',W.a)+group('debt',S.nw.debts,'What you owe',W.d)+
  '<p class="muted small" style="margin:0">Bank accounts update with your balances. Everything else you update yourself, for example once a month or when a statement arrives.</p></div>';
}
function vSet(){
  const th=TH();
  return '<div class="stack"><button class="btn link" data-act="tabTo" data-t="cal" style="justify-self:start">← Back</button><h2 style="font-size:24px">Settings</h2>'+
  '<section class="panel stack"><h3>Appearance</h3><div class="seg" role="group" aria-label="Theme">'+[['system','Match device'],['light','Light'],['dark','Dark']].map(([k,l])=>'<button data-act="theme" data-v="'+k+'" aria-pressed="'+(S.theme===k)+'">'+l+'</button>').join('')+'</div><p class="muted small" style="margin:0">Theme is set separately on each device.</p></section>'+
  '<section class="panel stack"><h3>Calendar</h3><div class="fgrid" style="max-width:420px"><div class="field"><label for="calFrom">From year</label><select id="calFrom">'+yearOpts(yFrom(),CUR_Y)+'</select></div><div class="field"><label for="calTo">To year</label><select id="calTo">'+yearOpts(yTo(),yFrom())+'</select></div></div><p class="muted small" style="margin:0">The calendar shows '+mlabel(calStart())+' to December '+yTo()+'. It always starts at this month at the earliest. This is set separately on each device.</p></section>'+
  devicesSection()+(CAN()?
  '<section class="panel stack"><div><h3>Highlighted days</h3><p class="muted small" style="margin:4px 0 0">Days with one big payment turn orange, and days with one big income turn green, so they stand out as you scroll.</p></div><div class="fgrid"><div class="field"><label for="thExp">Orange: a payment of at least</label>'+moneyField('thExp',th.exp)+'</div><div class="field"><label for="thInc">Green: an income of at least</label>'+moneyField('thInc',th.inc)+'</div></div><div class="row"><button class="btn" data-act="saveTh">Save</button><span class="small pos" id="thMsg"></span></div></section>'+
  '<section class="panel stack"><div><h3>Colour tags</h3><p class="muted small" style="margin:4px 0 0">Give items a shared colour on the calendar, like one colour for all insurance. Assign a tag when you add or edit an item in Manage.</p></div><div>'+
    (S.tags.map(t=>{const n=S.items.filter(i=>i.tag===t.id).length;return'<div class="crow"><button type="button" class="swb" data-act="pick" data-t="tagc:'+t.id+'" style="background:'+esc(t.color)+'" aria-label="Change '+esc(t.name)+' colour"></button><input type="text" id="tn-'+t.id+'" data-tagn="'+t.id+'" value="'+esc(t.name)+'" aria-label="Tag name"><span class="muted small" style="white-space:nowrap">'+n+' item'+(n===1?'':'s')+'</span><button class="x" data-act="delTag" data-g="'+t.id+'" aria-label="Delete '+esc(t.name)+' tag">×</button></div>'}).join('')||'<p class="muted small" style="margin:0">No tags yet.</p>')+
    '</div><div class="crow" style="border-top:1px solid var(--line);padding-top:10px"><input type="hidden" id="newTagColor" value="#2F6FD6"><button type="button" class="swb" id="newTagSw" data-act="pick" data-t="newtag" style="background:#2F6FD6" aria-label="Choose new tag colour"></button><input type="text" id="newTagName" placeholder="New tag, e.g. Insurance"><button class="btn" data-act="addTag">Add</button></div></section>'+
  '<section class="panel stack"><div class="row between wrapr"><h3>Calendar colours</h3><button class="btn sm" data-act="resetColors">Reset to defaults</button></div><div>'+
    COLS.map(([k,l,d])=>'<div class="crow"><button type="button" class="swb" data-act="pick" data-t="col:'+k+'" style="background:'+curColor(k,d)+'" aria-label="Change colour for '+l+'"></button><span>'+l+'</span></div>').join('')+'</div><p class="muted small" style="margin:0">Used for anything without a colour tag.</p></section>'+
  '<section class="panel stack"><h3>Categories</h3><div class="row wrapr" style="gap:6px">'+S.categories.map(c=>'<span class="chip" style="font-size:13px;padding:4px 4px 4px 10px">'+esc(c)+' <button aria-label="Remove '+esc(c)+'" data-act="delCat" data-c="'+esc(c)+'" style="border:0;background:none;padding:0 6px;color:var(--muted)">×</button></span>').join('')+'</div><div class="row"><input id="newCat" placeholder="New category" style="flex:1;min-width:0;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)"><button class="btn" data-act="addCat">Add</button></div><p class="muted small" id="catMsg" style="margin:0"></p></section>'+
  '<section class="panel stack"><h3>Low-balance alerts</h3><p class="muted small" style="margin:0">The bell lights up when an account is forecast to drop below its level in the next 60 days.</p><div class="fgrid">'+S.accounts.map(a=>'<div class="field"><label for="al-'+a.id+'">'+esc(a.name)+' below</label>'+moneyField('al-'+a.id,+a.alert||0,{ph:'0'})+'</div>').join('')+'</div><div class="row"><button class="btn" data-act="saveAlert">Save alerts</button><span class="small pos" id="alMsg"></span></div></section>'+
  '<section class="panel stack"><h3>Data</h3><p class="muted small" style="margin:0">'+(ROLE==='editor'?'Changes you make show up on every approved device within a few seconds.':'Firebase isn’t set up yet, so entries are saved on this device only.')+'</p>'+
    (S.undo?'<div class="row wrapr"><button class="btn primary" data-act="undoErase">Undo the last erase</button></div>':'')+
    '<div class="row wrapr"><button class="btn" data-act="askErase" data-m="example">Replace with example data</button><button class="btn danger" data-act="askErase" data-m="blank">Start blank</button></div><div id="eraseBox" hidden></div></section></div>':'');
}
const yearOpts=(sel,min)=>{let o='';for(let y=min;y<=CUR_Y+10;y++)o+='<option value="'+y+'"'+(y===sel?' selected':'')+'>'+y+'</option>';return o};
function devicesSection(){
  if(ROLE==='local')return '';
  const when2=t=>t?new Date(t).toLocaleDateString('en-CA',{month:'short',day:'numeric'}):'';
  if(ROLE==='viewer')return '<section class="panel stack"><div class="row between"><h3>This device</h3><span class="role">View only</span></div><p class="muted small" style="margin:0">This device shows the family cashflow but can’t change it. Changes made on an editing device appear here automatically.</p>'+
    (INFO.legacy?'':INFO.hasCode?'<p class="muted small" style="margin:0">Have the editor passcode? Enter it to edit from this device.</p>'+joinBox():'<p class="muted small" style="margin:0">To edit from this device, ask for the editor passcode. It can be set in Settings on the main phone.</p>')+'</section>';
  const req=Object.entries(DEV.requests||{}),eds=Object.entries(DEV.editors||{}).filter(([id])=>id!==INFO.uid),vw=Object.entries(DEV.viewers||{}).filter(([id])=>!(DEV.editors||{})[id]);
  const rmBtn=(id,act)=>'<span id="rmv-'+esc(id)+'" hidden>Remove? <button class="btn sm danger" data-act="'+act+'" data-id="'+esc(id)+'">Yes</button></span><button class="btn sm" data-act="askRemove" data-id="'+esc(id)+'">Remove</button>';
  return '<section class="panel stack"><div class="row between wrapr"><h3>Devices</h3><span class="role">This device can edit</span></div>'+
    (INFO.legacy?'<div class="note-box"><b>Only one device can edit right now.</b> To edit from your computer or tablet too, publish the new database rules: copy <b>database.rules.json</b> from GitHub into Firebase → Realtime Database → Rules, then tap Publish and reopen the app.</div>':
    '<div><div class="label" style="margin-bottom:4px">Editor passcode</div><p class="muted small" style="margin:0 0 8px">Any device that enters this passcode can edit. Use at least 6 characters and share it only with people you trust. '+(INFO.hasCode?'A passcode is set.':'No passcode set yet.')+'</p>'+
    '<form id="codeForm" class="row wrapr" style="gap:8px"><input id="newCode" type="text" autocomplete="off" minlength="6" maxlength="64" required placeholder="'+(INFO.hasCode?'New passcode':'Choose a passcode')+'" style="flex:1;min-width:160px;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)"><button class="btn primary" type="submit">'+(INFO.hasCode?'Change':'Set passcode')+'</button>'+(INFO.hasCode?'<button class="btn" type="button" data-act="removeCode">Turn off</button>':'')+'</form><p class="small" id="codeMsg" style="margin:6px 0 0"></p></div>'+
    '<div><div class="label" style="margin-bottom:4px">Other devices that can edit</div>'+(eds.length?eds.map(([id,d])=>'<div class="check"><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(d&&d.name||'Device')+'</b><br><span class="muted small">Added '+when2(d&&d.at)+'</span></span>'+rmBtn(id,'removeEditor')+'</div>').join(''):'<p class="muted small" style="margin:0">None yet. On your computer or tablet, open the app and enter the passcode.</p>')+(INFO.owner?'':'<p class="muted small" style="margin:6px 0 0">The first phone that opened the app can always edit.</p>')+'</div>')+
    (req.length?'<div><div class="label" style="margin-bottom:4px">Waiting for approval</div>'+req.map(([id,d])=>'<div class="check"><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(d&&d.name||'A device')+'</b><br><span class="muted small">Asked '+when2(d&&d.at)+'</span></span><button class="btn sm primary" data-act="approve" data-id="'+esc(id)+'">Allow</button><button class="btn sm" data-act="deny" data-id="'+esc(id)+'">Deny</button></div>').join('')+'</div>':'')+
    '<div><div class="label" style="margin-bottom:4px">View-only devices</div>'+(vw.length?vw.map(([id,d])=>'<div class="check"><span style="flex:1;min-width:0"><b style="font-weight:600">'+esc(d&&d.name||'Device')+'</b><br><span class="muted small">Allowed '+when2(d&&d.at)+'</span></span>'+rmBtn(id,'removeViewer')+'</div>').join(''):'<p class="muted small" style="margin:0">None yet. Install the app on another device and it will ask to view. Allow it here.</p>')+'</div></section>';
}

// ---------- sheets ----------
function openSheet(html){$('#sheetBody').innerHTML=html;$('#sheet').hidden=false;const f=$('#sheetBody input:not([type=hidden])')||$('#sheetBody select')||$('#sheetBody .x');if(f){f.focus();if(f.dataset&&f.dataset.money!==undefined&&f.value)try{f.select()}catch(e){}}}
function closeSheet(){$('#sheet').hidden=true;render()}
const head=t=>'<div class="row between" style="margin-bottom:14px"><h2 style="font-size:20px">'+t+'</h2><button class="x" type="button" data-act="close" aria-label="Close">×</button></div>';
const acctOpts=(sel,cards)=>S.accounts.map(a=>'<option value="'+a.id+'"'+(sel===a.id?' selected':'')+'>'+esc(a.name)+'</option>').join('')+(cards?S.cards.map(c=>'<option value="'+c.id+'"'+(sel===c.id?' selected':'')+'>'+esc(c.name)+' ••'+esc(c.last4)+'</option>').join(''):'');
const catOpts=sel=>[...new Set([...S.categories,sel])].map(c=>'<option'+(c===sel?' selected':'')+'>'+esc(c)+'</option>').join('');
const delRow=(act,data)=>'<button class="btn danger" type="button" data-act="askDel">Delete</button><span id="delConfirm" hidden>Delete for good? <button class="btn sm danger" type="button" data-act="'+act+'" '+data+'>Yes, delete</button></span>';
function sheetNotes(){
  openSheet(head('Notifications')+(N.length?'<div>'+N.map(n=>'<div class="note '+n.lvl+(S.dismissed.includes(n.id)?' read':'')+'"><span class="stripe"></span><div><b>'+esc(n.title)+'</b><div class="muted" style="font-size:13px">'+esc(n.body)+'</div></div>'+(n.req?'<span class="row" style="gap:6px"><button class="btn sm primary" data-act="approve" data-id="'+esc(n.req)+'">Allow</button><button class="btn sm" data-act="deny" data-id="'+esc(n.req)+'">Deny</button></span>':S.dismissed.includes(n.id)?'':'<button class="btn sm" data-act="dismiss" data-n="'+esc(n.id)+'">Got it</button>')+'</div>').join('')+'</div><div class="row" style="margin-top:12px"><button class="btn" data-act="dismissAll">Mark all as seen</button></div>':'<p class="muted">All clear. Nothing needs your attention.</p>')+
  '<p class="muted small" style="margin-bottom:0">Reminders come from each item’s "remind me" setting, card payments due within a week, and your low-balance alerts.</p>');
}
function sheetDay(d){
  const evs=F.ev.filter(e=>e.date===d),x=F.daily[d];
  openSheet(head(P(d).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}))+
  (x?'<div class="kpis" style="margin-bottom:10px">'+S.accounts.map(a=>'<div class="kpi"><div class="label">'+esc(a.name)+'</div><div class="num">'+money(x[a.id]||0)+'</div></div>').join('')+'<div class="kpi"><div class="label">Total</div><div class="num">'+money(sumBals(x))+'</div></div></div><p class="muted small" style="margin:0 0 6px">Projected end-of-day balances.</p>':'<p class="muted">This day is before your last balance update, so only the scheduled items are shown.</p>')+
  '<div class="list">'+(evs.map(e=>evRow(e)).join('')||'<p class="muted">Nothing scheduled this day.</p>')+'</div>');
}
function sheetCDay(d){
  const c=cardOf(calAcct),xs=cardCharges(c,d,d),b=cardBill(c,d);
  openSheet(head(esc(c.name)+' · '+short(d))+'<div class="list">'+(xs.map(x=>CAN()?'<button class="check" data-act="edit" data-i="'+x.id+'"><span style="flex:1;font-weight:600">'+esc(x.name)+' <span class="pen" style="font-size:11px;color:var(--accent)">Edit ›</span></span><span class="num">'+money(x.a,1)+'</span></button>':'<div class="check"><span style="flex:1;font-weight:600">'+esc(x.name)+'</span><span class="num">'+money(x.a,1)+'</span></div>').join('')||'<p class="muted">No recurring charges this day.</p>')+'</div><p class="muted small">Charges on this day land on the statement closing '+short(b.close)+', paid from '+esc(acctName(payFromOf(c)))+' '+short(b.pay)+'.</p>');
}
function sheetEdit(id){
  const it=id?S.items.find(i=>i.id===id):{name:'',category:'Housing',type:'expense',acct:firstChk(),to:firstSav(),rule:{freq:'monthly'},amounts:[{from:TODAY,amount:0}],remind:0};
  const r={day:P(TODAY).getDate(),month:P(TODAY).getMonth(),start:TODAY,date:TODAY,...it.rule},cur=amt(it,TODAY);
  const hist=id&&it.amounts.length>1?'<div class="muted small">History: '+it.amounts.map(a=>money(a.amount,1)+(a.from>'2000-01-01'?' from '+short(a.from)+' '+P(a.from).getFullYear():'')).join(' → ')+'</div>':'';
  openSheet(head(id?'Edit '+esc(it.name):'Add recurring or planned')+'<form id="itemForm" class="stack" data-i="'+(id||'')+'">'+
  '<div class="field hero-f"><label for="fAmt">Amount</label>'+moneyField('fAmt',cur,{hero:1,req:1})+'</div>'+
  '<div class="field"><label for="fName">Name</label><input id="fName" required value="'+esc(it.name)+'" placeholder="e.g. Home insurance"></div>'+
  '<div class="fgrid"><div class="field"><label for="fType">Type</label><select id="fType">'+[['expense','Expense'],['income','Income'],['transfer','Transfer between accounts']].map(([v,l])=>'<option value="'+v+'"'+(it.type===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
  '<div class="field"><label for="fCat">Category</label><select id="fCat">'+catOpts(it.category)+'</select></div></div>'+
  '<div class="fgrid"><div class="field"><label for="fAcct" id="fAcctL">Paid from</label><select id="fAcct" data-cur="'+esc(it.acct)+'"></select></div><div class="field" id="fToW"><label for="fTo">Into</label><select id="fTo">'+acctOpts(it.to||firstSav())+'</select></div></div>'+
  '<div class="fgrid"><div class="field"><label for="fFreq">How often</label><select id="fFreq">'+[['once','One time'],['weekly','Every week'],['biweekly','Every 2 weeks'],['monthly','Monthly'],['quarterly','Quarterly'],['semiannual','Twice a year'],['yearly','Yearly']].map(([v,l])=>'<option value="'+v+'"'+(r.freq===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
  '<div class="field" data-for="day"><label for="fDay">Day of month</label><input id="fDay" type="number" min="1" max="31" value="'+r.day+'"></div>'+
  '<div class="field" data-for="month"><label for="fMonth">First month</label><select id="fMonth">'+MONL.map((m,i)=>'<option value="'+i+'"'+(+r.month===i?' selected':'')+'>'+m+'</option>').join('')+'</select></div>'+
  '<div class="field" data-for="start"><label for="fStart">First date</label><input id="fStart" type="date" value="'+r.start+'"></div>'+
  '<div class="field" data-for="date"><label for="fDate">Date</label><input id="fDate" type="date" value="'+r.date+'"></div></div>'+
  '<div class="fgrid"><div class="field"><label for="fFrom">'+(id?'New amount starts':'Starts')+'</label><input id="fFrom" type="date" value="'+TODAY+'"></div><div class="field"><label for="fRemind">Remind me (days before, 0 = off)</label><input id="fRemind" type="number" min="0" value="'+(it.remind||0)+'"></div></div>'+
  (id?'<div class="muted small" style="margin-top:-4px">Changing the amount updates this date and every one after it. Earlier payments keep their old amount.</div>':'')+hist+
  '<div class="field"><label for="fTag">Colour tag</label><select id="fTag"><option value="">None (default colours)</option>'+S.tags.map(t=>'<option value="'+t.id+'"'+(it.tag===t.id?' selected':'')+'>● '+esc(t.name)+'</option>').join('')+'<option value="__new">+ New tag…</option></select></div>'+
  '<div class="crow" id="fTagNewW" hidden style="border:0;padding-top:0"><input type="hidden" id="fTagColor" value="#2F6FD6"><button type="button" class="swb" id="fTagSw" data-act="pick" data-t="ftag" style="background:#2F6FD6" aria-label="Choose tag colour"></button><input type="text" id="fTagName" placeholder="Tag name, e.g. Insurance"></div>'+
  '<div class="row wrapr"><button class="btn primary" type="submit">Save</button>'+(id?delRow('del','data-i="'+id+'"'):'')+'</div></form>');
  syncForm();
}
function syncForm(){
  const f=$('#fFreq');if(!f)return;
  const show={once:['date'],weekly:['start'],biweekly:['start'],monthly:['day'],quarterly:['day','month'],semiannual:['day','month'],yearly:['day','month']}[f.value];
  document.querySelectorAll('[data-for]').forEach(el=>el.hidden=!show.includes(el.dataset.for));
  const ty=$('#fType').value,sel=$('#fAcct'),cur=sel.value||sel.dataset.cur;
  sel.innerHTML=acctOpts(cur,ty==='expense');if(![...sel.options].some(o=>o.value===cur))sel.value=firstChk();
  $('#fAcctL').textContent=ty==='income'?'Goes into':ty==='transfer'?'From':'Paid from';
  $('#fToW').hidden=ty!=='transfer';
  $('#fTagNewW').hidden=$('#fTag').value!=='__new';
}
function saveItem(form){
  const id=form.dataset.i,ex=id&&S.items.find(i=>i.id===id);
  const freq=$('#fFreq').value,rule={freq},from=$('#fFrom').value||TODAY,a=parseMoney($('#fAmt').value);
  if(freq==='once')rule.date=$('#fDate').value||TODAY;else if(freq==='weekly'||freq==='biweekly')rule.start=$('#fStart').value||TODAY;else{rule.day=+$('#fDay').value||1;if(freq!=='monthly')rule.month=+$('#fMonth').value}
  const type=$('#fType').value,base={name:$('#fName').value.trim()||'Untitled',type,category:$('#fCat').value,acct:$('#fAcct').value,to:$('#fTo').value,rule,remind:+$('#fRemind').value||0};
  if(type==='transfer'&&base.acct===base.to){const o=S.accounts.find(x=>x.id!==base.acct);if(o)base.to=o.id}
  let tg=$('#fTag').value;if(tg==='__new'){const nm=$('#fTagName').value.trim();if(nm){tg=uid();S.tags.push({id:tg,name:nm,color:$('#fTagColor').value})}else tg=''}
  base.tag=tg;
  if(ex){Object.assign(ex,base);if(a!==amt(ex,from)){ex.amounts=ex.amounts.filter(x=>x.from<from);ex.amounts.push({from,amount:a})}if(!ex.amounts.length)ex.amounts=[{from:'2000-01-01',amount:a}]}
  else{if(freq!=='once'&&!rule.start)rule.start=from;S.items.push({id:uid(),...base,amounts:[{from:'2000-01-01',amount:a}]})}
  S.example=false;save();closeSheet();
}
function setEst(es,a,from){es.amounts=es.amounts.filter(x=>x.from<from);es.amounts.push({from,amount:a});if(es.amounts[0].from!=='2000-01-01'&&es.amounts.length===1)es.amounts[0].from='2000-01-01'}
function sheetEst(id){
  const es=id?S.estimates.find(e=>e.id===id):{name:'',category:'Groceries',acct:firstChk(),amounts:[{from:'2000-01-01',amount:0}]};
  const hist=id&&es.amounts.length>1?'<div class="muted small">History: '+es.amounts.map(a=>money(a.amount)+(a.from>'2000-01-01'?' from '+mlabel(a.from):'')).join(' → ')+'</div>':'';
  openSheet(head(id?'Edit '+esc(es.name):'Add a monthly estimate')+'<form id="estForm" class="stack" data-e="'+(id||'')+'">'+
  '<div class="field hero-f"><label for="eAmt">Per month</label>'+moneyField('eAmt',estMonth(es,TODAY),{hero:1,req:1})+'</div>'+
  '<div class="field"><label for="eName">Name</label><input id="eName" required value="'+esc(es.name)+'" placeholder="e.g. Groceries"></div>'+
  '<div class="fgrid"><div class="field"><label for="eCat">Category</label><select id="eCat">'+catOpts(es.category)+'</select></div><div class="field"><label for="eAcct">Paid from</label><select id="eAcct">'+acctOpts(es.acct,true)+'</select></div>'+
  '<div class="field"><label for="eFrom">Starting</label><input id="eFrom" type="month" value="'+TODAY.slice(0,7)+'"></div></div>'+hist+
  '<div class="row wrapr"><button class="btn primary" type="submit">Save</button>'+(id?delRow('delEst','data-e="'+id+'"'):'')+'</div></form>');
}
function sheetCard(id){
  const c=id?cardOf(id):{name:'',last4:'',closeDay:20,delay:15,payFrom:firstChk()};
  openSheet(head(id?'Edit card':'Add a card')+'<form id="cardForm" class="stack" data-c="'+(id||'')+'"><div class="fgrid"><div class="field"><label for="cName">Nickname</label><input id="cName" required value="'+esc(c.name)+'" placeholder="Blue Visa"></div><div class="field"><label for="cLast">Last 4 digits</label><input id="cLast" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required value="'+esc(c.last4)+'"></div>'+
  '<div class="field"><label for="cClose">Statement closes on day</label><input id="cClose" type="number" min="1" max="31" value="'+c.closeDay+'"></div><div class="field"><label for="cDelay">Paid this many days later</label><input id="cDelay" type="number" min="0" max="60" value="'+c.delay+'"></div>'+
  '<div class="field"><label for="cPay">Paid from</label><select id="cPay">'+acctOpts(payFromOf(c))+'</select></div></div>'+
  '<button class="btn primary" type="submit" style="justify-self:start">Save</button></form>');
}
function sheetAcct(id){
  const a=id?bankOf(id):{name:'',type:'checking',bal:0,alert:0};
  const used=id&&(S.items.some(i=>i.acct===id||i.to===id)||S.estimates.some(e=>e.acct===id)||S.cards.some(c=>c.payFrom===id));
  openSheet(head(id?'Edit '+esc(a.name):'Add a bank account')+'<form id="acctForm" class="stack" data-a="'+(id||'')+'">'+
  '<div class="fgrid"><div class="field"><label for="aName">Name</label><input id="aName" required value="'+esc(a.name)+'" placeholder="e.g. Joint chequing, TFSA savings"></div><div class="field"><label for="aType">Type</label><select id="aType"><option value="checking"'+(a.type==='checking'?' selected':'')+'>Checking</option><option value="savings"'+(a.type==='savings'?' selected':'')+'>Savings</option></select></div>'+
  (id?'':'<div class="field"><label for="aBal">Balance today</label>'+moneyField('aBal',0,{req:1})+'</div>')+
  '<div class="field"><label for="aAlert">Alert me below</label>'+moneyField('aAlert',+a.alert||0,{ph:'0'})+'</div></div>'+
  (id?'<p class="muted small" style="margin:0">To change the balance, use <b>Update balances</b>.</p>':'')+
  '<div class="row wrapr"><button class="btn primary" type="submit">Save</button>'+(id?(S.accounts.length<2?'<span class="muted small">This is your only account, so it can’t be deleted.</span>':used?'<span class="muted small">To delete this account, first move the items, estimates and cards that use it.</span>':delRow('delAcct','data-a="'+id+'"')):'')+'</div></form>');
}
function sheetRecon(){
  const x=F.daily[TODAY]||startBals();
  openSheet(head('Update balances')+'<form id="reconForm" class="stack"><p class="muted" style="margin:0">Check your bank and enter today’s balances.</p>'+
  '<div class="fgrid">'+S.accounts.map(a=>'<div class="field"><label for="r-'+a.id+'">'+esc(a.name)+' (forecast '+money(x[a.id]||0,1)+')</label>'+moneyField('r-'+a.id,0,{req:1,ph:(x[a.id]||0).toFixed(2)})+'</div>').join('')+'</div>'+
  '<button class="btn primary" type="submit" style="justify-self:start">Compare and save</button></form>');
}
function reconResult(vals){
  const x=F.daily[TODAY]||startBals(),prev=S.balanceDate,rows=S.accounts.map(a=>({a,p:x[a.id]||0,v:vals[a.id]||0}));
  const entry={date:TODAY,a:{}};rows.forEach(r=>{entry.a[r.a.id]={p:Math.round(r.p*100)/100,a:r.v};r.a.bal=r.v});
  S.history.push(entry);S.balanceDate=TODAY;S.example=false;save();
  const P0=rows.reduce((s,r)=>s+r.p,0),A0=rows.reduce((s,r)=>s+r.v,0),v=A0-P0;
  const sums=h=>Object.values(h.a).reduce((s,r)=>[s[0]+r.a,s[1]+r.p],[0,0]);
  const last3=S.history.slice(-3),streak=last3.length===3&&last3.every(h=>{const[a,p]=sums(h);return a<p-25});
  let html;
  if(Math.abs(v)<25)html='<div class="result even"><h3>Right on target</h3><p style="margin:4px 0 0">Within '+money(Math.abs(v),1)+' of the forecast. Your estimates are working.</p></div>';
  else if(v>0)html='<div class="result good"><h3>You did well: '+money(v)+' ahead</h3><p style="margin:4px 0 0">You spent less than expected since '+short(prev)+'. If this keeps up, some monthly estimates may be set too high.</p></div>';
  else html='<div class="result bad"><h3>Over by '+money(-v)+'</h3><p style="margin:4px 0 0">You spent more than the forecast expected since '+short(prev)+'. Fixed bills rarely drift, so the gap is usually in your monthly estimates, or a recurring charge that isn’t added yet.</p></div>'+
    (streak?'<p style="margin:0"><b>Third check in a row over the forecast.</b> That’s a pattern rather than a one-off. Raising an estimate will make next month more accurate.</p>':'')+
    '<div class="panel"><div class="label" style="margin-bottom:6px">Monthly estimates to review</div>'+S.estimates.map(e=>'<div class="check"><span style="flex:1;min-width:0">'+esc(e.name)+'<br><span class="muted small num">'+money(estMonth(e,TODAY))+' per month</span></span><button class="btn sm" data-act="bump" data-e="'+e.id+'">Raise 10%</button></div>').join('')+'</div>'+
    '<button class="btn" data-act="edit" data-i="" style="justify-self:start">Add a missing recurring charge</button>';
  rows.filter(r=>r.a.type==='savings'&&Math.abs(r.v-r.p)>=25).forEach(r=>{html+='<p class="muted small" style="margin:0">'+esc(r.a.name)+' was '+money(Math.abs(r.v-r.p))+(r.v>r.p?' higher':' lower')+' than forecast. Check for a transfer or withdrawal that isn’t in the app.</p>'});
  openSheet(head('How this period went')+'<div class="stack"><div class="tscroll"><table><thead><tr><th></th><th>Forecast</th><th>Actual</th><th>Difference</th></tr></thead><tbody>'+
    rows.map(r=>[esc(r.a.name),r.p,r.v,r.v-r.p]).concat([['<b>Total</b>',P0,A0,v]]).map(([l,p,a,d])=>'<tr><td>'+l+'</td><td class="num">'+money(p)+'</td><td class="num">'+money(a)+'</td><td class="num '+(d<-0.5?'neg':d>0.5?'pos':'')+'">'+(d>0.5?'+':'')+money(d)+'</td></tr>').join('')+'</tbody></table></div>'+html+'<button class="btn primary" data-act="close" style="justify-self:start">Done</button></div>');
}
function sheetNW(kind,id){
  const list=kind==='asset'?S.nw.assets:S.nw.debts,x=id?list.find(v=>v.id===id):{name:'',value:0};
  openSheet(head((id?'Edit ':'Add ')+(kind==='asset'?'something you own':'something you owe'))+'<form id="nwForm" class="stack" data-k="'+kind+'" data-n="'+(id||'')+'">'+
  '<div class="fgrid"><div class="field"><label for="nName">Name</label><input id="nName" required value="'+esc(x.name)+'" placeholder="'+(kind==='asset'?'e.g. Home, RRSP':'e.g. Mortgage, Car loan')+'"></div>'+
  '<div class="field"><label for="nVal">'+(kind==='asset'?'Current value':'Amount owed')+'</label>'+moneyField('nVal',x.value,{req:1})+'</div></div>'+
  '<div class="row wrapr"><button class="btn primary" type="submit">Save</button>'+(id?delRow('delNW','data-k="'+kind+'" data-n="'+id+'"'):'')+'</div></form>');
}

// ---------- erase safeguards ----------
// Erasing needs the word ERASE typed in, and a full copy of the data is kept so it can be undone.
function showErase(mode){
  const b=$('#eraseBox');if(!b)return;b.hidden=false;
  b.innerHTML='<div class="erase"><p style="margin:0"><b>'+(mode==='example'?'This replaces all your data with example data':'This erases all your data')+(ROLE==='editor'?' on every device':'')+'.</b> You can undo it afterwards from the banner at the top of the app or from this section.</p><div class="field"><label for="eraseIn">Type ERASE to confirm</label><input id="eraseIn" autocomplete="off" autocapitalize="characters" spellcheck="false"></div><div class="row wrapr"><button class="btn danger" data-act="doErase" data-m="'+mode+'" id="eraseGo" disabled>'+(mode==='example'?'Replace my data':'Erase everything')+'</button><button class="btn" data-act="cancelErase">Cancel</button></div></div>';
  $('#eraseIn').focus();
}
function doErase(mode){
  if(($('#eraseIn')||{}).value.trim().toUpperCase()!=='ERASE')return;
  const snapshot=syncObj();delete snapshot.undo;
  const keep={theme:S.theme,dismissed:S.dismissed};
  S=mode==='example'?sample():blankState();Object.assign(S,keep);migrate();
  S.undo={at:Date.now(),what:mode,json:JSON.stringify(snapshot)};
  save();tab=mode==='example'?'cal':'man';calAcct='t';render();window.scrollTo({top:0});
}
function undoErase(){
  if(!S.undo)return;let old;try{old=JSON.parse(S.undo.json)}catch(e){return}
  const keep={theme:S.theme,dismissed:S.dismissed};S=old;Object.assign(S,keep);S.undo=null;migrate();save();tab='cal';calAcct='t';render();window.scrollTo({top:0});
}

// ---------- colour picker ----------
const clamp=x=>Math.max(0,Math.min(1,x));
function hsv2hex(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return'#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('').toUpperCase()}
function hex2hsv(hex){const n=parseInt(hex.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return{h,s:mx?d/mx:0,v:mx}}
const PK={t:null,h:0,s:0,v:0,orig:'#000000',edit:false};
const pkHex=()=>hsv2hex(PK.h,PK.s,PK.v);
function pickTarget(t){const[k,a]=t.split(/:(.*)/);
  if(k==='col'){const d=COLS.find(c=>c[0]===a);return curColor(a,d?d[2]:'#888888')}
  if(k==='tagc'){const g=tagOf(a);return g?g.color:'#888888'}
  if(k==='newtag')return $('#newTagColor').value;
  if(k==='ftag')return $('#fTagColor').value;return'#888888'}
function openPicker(t){PK.t=t;PK.orig=(pickTarget(t)||'#888888').toUpperCase();Object.assign(PK,hex2hsv(PK.orig));PK.edit=false;$('#pvOld').style.background=PK.orig;$('#pk').hidden=false;pkUpd();$('#pkSV').focus()}
function pkUpd(){
  const hex=pkHex(),sv=$('#pkSV');
  sv.style.backgroundColor='hsl('+PK.h+',100%,50%)';
  const t=$('#pkSVt');t.style.left=PK.s*100+'%';t.style.top=(1-PK.v)*100+'%';t.style.background=hex;
  const ht=$('#pkHt');ht.style.left=PK.h/360*100+'%';ht.style.background='hsl('+PK.h+',100%,50%)';$('#pkH').setAttribute('aria-valuenow',Math.round(PK.h));
  sv.setAttribute('aria-valuetext',hex);
  $('#pvNew').style.background=hex;
  if(document.activeElement!==$('#pkHex'))$('#pkHex').value=hex;
  $('#pkEditBtn').textContent=PK.edit?'Done':'Edit';$('#pkEditBtn').hidden=!S.palette.length;
  $('#pkPal').innerHTML=S.palette.length?S.palette.map(c=>'<button data-act="pkUse" data-hex="'+c+'" style="background:'+c+'" class="'+(c===hex?'on':'')+'" aria-label="'+(PK.edit?'Remove ':'Use ')+c+'">'+(PK.edit?'<span aria-hidden="true">×</span>':'')+'</button>').join(''):'<p class="muted small" style="margin:0;grid-column:1/-1">Colours you save appear here, ready to reuse for any calendar colour or tag.</p>';
}
function drag(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);fn(e);const mv=ev=>fn(ev),up=()=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)})}
drag($('#pkSV'),e=>{const r=$('#pkSV').getBoundingClientRect();PK.s=clamp((e.clientX-r.left)/r.width);PK.v=1-clamp((e.clientY-r.top)/r.height);pkUpd()});
drag($('#pkH'),e=>{const r=$('#pkH').getBoundingClientRect();PK.h=Math.min(359.9,clamp((e.clientX-r.left)/r.width)*360);pkUpd()});
$('#pkSV').addEventListener('keydown',e=>{const st=e.shiftKey?.1:.02,m={ArrowLeft:['s',-st],ArrowRight:['s',st],ArrowUp:['v',st],ArrowDown:['v',-st]}[e.key];if(m){e.preventDefault();PK[m[0]]=clamp(PK[m[0]]+m[1]);pkUpd()}});
$('#pkH').addEventListener('keydown',e=>{const st=e.shiftKey?20:3,m={ArrowLeft:-st,ArrowRight:st}[e.key];if(m){e.preventDefault();PK.h=(PK.h+m+360)%360;pkUpd()}});
$('#pkHex').addEventListener('input',e=>{let v=e.target.value.trim();if(v[0]!=='#')v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v)){const x=hex2hsv(v);PK.s=x.s;PK.v=x.v;if(x.s)PK.h=x.h;pkUpd()}});
$('#pk').addEventListener('click',e=>{if(e.target.id==='pk')closePicker()});
function closePicker(){$('#pk').hidden=true}
function applyPick(){
  const hex=pkHex(),[k,a]=PK.t.split(/:(.*)/);closePicker();
  if(k==='col'){S.colors[a]=hex;save();render()}
  else if(k==='tagc'){const g=tagOf(a);if(g){g.color=hex;save();render()}}
  else if(k==='newtag'){$('#newTagColor').value=hex;$('#newTagSw').style.background=hex}
  else if(k==='ftag'){$('#fTagColor').value=hex;$('#fTagSw').style.background=hex}
}

// ---------- events ----------
const VIEW_ACTS=new Set(['notes','close','settings','tabTo','calAcct','day','cday','openCard','dismiss','dismissAll','mode','cat','theme','chartReset']);
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act],[data-tab]');if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;render();window.scrollTo({top:0});return}
  const a=t.dataset.act;
  if(!CAN()&&!VIEW_ACTS.has(a))return;   // view-only devices can look around but not change shared data
  ({notes:sheetNotes,close:closeSheet,
    settings:()=>{tab=tab==='set'?'cal':'set';render();window.scrollTo({top:0})},
    tabTo:()=>{tab=t.dataset.t;render();window.scrollTo({top:0})},
    calAcct:()=>{calAcct=t.dataset.a;render()},
    day:()=>sheetDay(t.dataset.d),
    cday:()=>sheetCDay(t.dataset.d),
    openCard:()=>{calAcct=t.dataset.c;$('#sheet').hidden=true;tab='cal';render();const sec=t.dataset.m&&document.getElementById('cm-'+t.dataset.m.slice(0,7));if(sec)sec.scrollIntoView({block:'start'});else window.scrollTo({top:0})},
    dismiss:()=>{S.dismissed.push(t.dataset.n);save();render();sheetNotes()},
    dismissAll:()=>{N.forEach(n=>S.dismissed.includes(n.id)||S.dismissed.push(n.id));save();render();sheetNotes()},
    mode:()=>{totMode=t.dataset.m;render()},
    cat:()=>{openCat=openCat===t.dataset.c?null:t.dataset.c;render()},
    startRep:()=>{S.replacing={card:t.dataset.c,done:[]};save();render()},
    cancelRep:()=>{S.replacing=null;save();render()},
    tick:()=>{const R=S.replacing,i=t.dataset.i;R.done=R.done.includes(i)?R.done.filter(x=>x!==i):[...R.done,i];save();render()},
    finishRep:()=>{const v=($('#new4').value||'').trim(),c=cardOf(t.dataset.c);if(/^\d{4}$/.test(v))c.last4=v;S.replacing=null;save();render()},
    editCard:()=>sheetCard(t.dataset.c),
    editAcct:()=>sheetAcct(t.dataset.a),
    edit:()=>sheetEdit(t.dataset.i),
    editEst:()=>sheetEst(t.dataset.e),
    askDel:()=>{$('#delConfirm').hidden=false},
    del:()=>{S.items=S.items.filter(i=>i.id!==t.dataset.i);save();closeSheet()},
    delEst:()=>{S.estimates=S.estimates.filter(i=>i.id!==t.dataset.e);save();closeSheet()},
    delAcct:()=>{if(S.accounts.length<2)return;S.accounts=S.accounts.filter(x=>x.id!==t.dataset.a);if(calAcct===t.dataset.a)calAcct='t';save();closeSheet()},
    recon:sheetRecon,
    bump:()=>{const es=S.estimates.find(i=>i.id===t.dataset.e),n=Math.round(estMonth(es,TODAY)*1.1);setEst(es,n,mstart(TODAY));save();t.textContent='Now '+money(n);t.disabled=true},
    theme:()=>{S.theme=t.dataset.v;save();render()},
    addTag:()=>{const n=$('#newTagName').value.trim();if(!n)return;S.tags.push({id:uid(),name:n,color:$('#newTagColor').value});save();render()},
    delTag:()=>{const g=t.dataset.g;S.tags=S.tags.filter(x=>x.id!==g);S.items.forEach(i=>{if(i.tag===g)i.tag=''});save();render()},
    resetColors:()=>{S.colors={};save();render()},
    pick:()=>openPicker(t.dataset.t),
    approve:()=>{const id=t.dataset.id,d=DEV.requests[id];if(window.cloudApprove)window.cloudApprove(id,d&&d.name||'Device');if(!$('#sheet').hidden)closeSheet()},
    deny:()=>{if(window.cloudDeny)window.cloudDeny(t.dataset.id);if(!$('#sheet').hidden)closeSheet()},
    askRemove:()=>{const s=document.getElementById('rmv-'+t.dataset.id);if(s)s.hidden=false;t.hidden=true},
    removeViewer:()=>{if(window.cloudRemoveViewer)window.cloudRemoveViewer(t.dataset.id)},
    removeEditor:()=>{if(window.cloudRemoveEditor)window.cloudRemoveEditor(t.dataset.id)},
    removeCode:()=>{if(window.cloudRemoveCode)window.cloudRemoveCode()},
    chartReset:()=>{if(CV)setView(0,365)},
    pkCancel:closePicker,
    pkApply:applyPick,
    pkSave:()=>{const h=pkHex();if(!S.palette.includes(h)){S.palette.push(h);save()}pkUpd()},
    pkEdit:()=>{PK.edit=!PK.edit;pkUpd()},
    pkUse:()=>{const h=t.dataset.hex;if(PK.edit){S.palette=S.palette.filter(x=>x!==h);if(!S.palette.length)PK.edit=false;save()}else{const x=hex2hsv(h);PK.s=x.s;PK.v=x.v;if(x.s)PK.h=x.h}pkUpd()},
    editNW:()=>sheetNW(t.dataset.k,t.dataset.n),
    delNW:()=>{const k=t.dataset.k==='asset'?'assets':'debts';S.nw[k]=S.nw[k].filter(x=>x.id!==t.dataset.n);save();closeSheet()},
    addCat:()=>{const v=$('#newCat').value.trim();if(!v)return;if(!S.categories.includes(v))S.categories.push(v);save();render()},
    delCat:()=>{const c=t.dataset.c;if(S.items.some(i=>i.category===c)||S.estimates.some(i=>i.category===c)){$('#catMsg').textContent='"'+c+'" still has items. Move them to another category first.';return}S.categories=S.categories.filter(x=>x!==c);save();render()},
    saveAlert:()=>{S.accounts.forEach(a=>{const el=document.getElementById('al-'+a.id);if(el)a.alert=parseMoney(el.value)});save();render();const m=$('#alMsg');if(m)m.textContent='Saved'},
    saveTh:()=>{const e=parseMoney($('#thExp').value),i=parseMoney($('#thInc').value);S.thresholds={exp:e||1000,inc:i||10000};save();render();const m=$('#thMsg');if(m)m.textContent='Saved'},
    askErase:()=>showErase(t.dataset.m),
    cancelErase:()=>{const b=$('#eraseBox');if(b){b.hidden=true;b.innerHTML=''}},
    doErase:()=>doErase(t.dataset.m),
    undoErase:undoErase,
    keepErase:()=>{S.undo=null;save();render()},
  }[a]||(()=>{}))();
});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;
  if(f.id==='joinForm'){const code=$('#joinCode').value.trim(),m=$('#joinMsg');if(!code||!window.cloudJoin)return;m.textContent='Checking…';m.className='small muted';
    const ok=await window.cloudJoin(code);if(ok){m.textContent='Done. Reopening as an editor…';m.className='small pos';setTimeout(()=>location.reload(),600)}else{m.textContent='That passcode isn’t right. Check it and try again.';m.className='small neg'}return}
  if(!CAN())return;
  if(f.id==='codeForm'){const code=$('#newCode').value.trim(),m=$('#codeMsg');if(code.length<6){m.textContent='Use at least 6 characters.';m.className='small neg';return}
    const ok=window.cloudSetCode&&await window.cloudSetCode(code);m.textContent=ok?'Passcode saved. Enter it on your computer or tablet to edit from there.':'Couldn’t save the passcode. Check your connection and try again.';m.className='small '+(ok?'pos':'neg');if(ok)$('#newCode').value='';return}
  if(f.id==='itemForm')saveItem(f);
  else if(f.id==='estForm'){const id=f.dataset.e,a=parseMoney($('#eAmt').value),from=($('#eFrom').value||TODAY.slice(0,7))+'-01',base={name:$('#eName').value.trim()||'Untitled',category:$('#eCat').value,acct:$('#eAcct').value};
    if(id){const es=S.estimates.find(x=>x.id===id);Object.assign(es,base);if(a!==estMonth(es,from))setEst(es,a,from)}else S.estimates.push({id:uid(),...base,amounts:[{from:'2000-01-01',amount:a}]});S.example=false;save();closeSheet()}
  else if(f.id==='cardForm'){const id=f.dataset.c,v={name:$('#cName').value.trim(),last4:$('#cLast').value.trim(),closeDay:+$('#cClose').value||1,delay:+$('#cDelay').value||0,payFrom:$('#cPay').value};if(id)Object.assign(cardOf(id),v);else S.cards.push({id:uid(),...v});save();closeSheet()}
  else if(f.id==='acctForm'){const id=f.dataset.a,v={name:$('#aName').value.trim()||'Account',type:$('#aType').value,alert:parseMoney($('#aAlert').value)};
    if(id)Object.assign(bankOf(id),v);else S.accounts.push({id:uid(),...v,bal:parseMoney($('#aBal').value)});S.example=false;save();closeSheet()}
  else if(f.id==='nwForm'){const k=f.dataset.k==='asset'?'assets':'debts',id=f.dataset.n,v={name:$('#nName').value.trim()||'Untitled',value:parseMoney($('#nVal').value),updated:TODAY};
    if(id)Object.assign(S.nw[k].find(x=>x.id===id),v);else S.nw[k].push({id:uid(),...v});S.example=false;save();closeSheet()}
  else if(f.id==='reconForm'){const vals={};S.accounts.forEach(a=>vals[a.id]=parseMoney(($('#r-'+a.id)||{}).value));reconResult(vals)}
});
// Money fields: keep only digits and one decimal point, add commas, and keep the cursor in place.
function formatMoneyInput(t){
  const pos=t.selectionStart==null?t.value.length:t.selectionStart,before=t.value.slice(0,pos).replace(/[^0-9.]/g,'').length;
  const nv=fmtMoneyStr(t.value);if(nv===t.value)return;t.value=nv;
  let k=0,p=0;while(p<nv.length&&k<before){if(/[0-9.]/.test(nv[p]))k++;p++}
  try{t.setSelectionRange(p,p)}catch(e){}
}
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset)return;
  if(t.dataset.money!==undefined)formatMoneyInput(t);
  if(t.id==='eraseIn'){const b=$('#eraseGo');if(b)b.disabled=t.value.trim().toUpperCase()!=='ERASE'}
  if(t.dataset.col){S.colors[t.dataset.col]=t.value;applyColors()}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='calFrom'||t.id==='calTo'){
    if(t.id==='calFrom'){PREFS.yFrom=+t.value;if(+PREFS.yTo<PREFS.yFrom)PREFS.yTo=PREFS.yFrom}else PREFS.yTo=Math.max(+t.value,yFrom());
    lsSet(PREF,PREFS);render();return}
  if(!CAN())return;
  if(t.id==='fFreq'||t.id==='fType'||t.id==='fTag')syncForm();
  if(t.dataset.tagn){const g=tagOf(t.dataset.tagn);if(g&&t.value.trim()){g.name=t.value.trim();save();render()}}
  if(t.dataset.est){const es=S.estimates.find(x=>x.id===t.dataset.est),v=parseMoney(t.value);if(es&&v!==estMonth(es,TODAY)){setEst(es,v,mstart(TODAY));S.example=false;save();render();const m=$('#sv-'+es.id);if(m)m.textContent='Saved from '+MONL[P(TODAY).getMonth()]}}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pk').hidden){closePicker();return}if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet();if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.est){e.preventDefault();e.target.blur()}});
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
render();
// Offline support and home-screen install
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
