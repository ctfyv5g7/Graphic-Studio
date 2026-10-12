import './style.css';
import {enabled,save,list} from './cloud.js';

const $=s=>document.querySelector(s),cv=$('#cv'),ctx=cv.getContext('2d');
let W=1,H=1,dpr=1;const V={cx:0,cy:0,s:50};
const COL=['#2f8cf4','#e5484d','#30a46c','#ab4aba','#f5a524','#12a594'];
let eqs=[],vals={},ink=[],mode='pan',recog=true,trace=false,tp=null,cur=null,vkey='';
let LIGHT=false;const LC={'--card':'#fff','--grid':'#ececec','--axis':'#8a8a8a','--mut':'#6b6b6b','--fg':'#1b1b1b'};
/* ---------- Парсер выражений ---------- */
const FN=['asin','acos','atan','sinh','cosh','tanh','sin','cos','tan','sqrt','cbrt','abs','ln','log','exp','floor','ceil','sign'];
const MF={asin:Math.asin,acos:Math.acos,atan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp,floor:Math.floor,ceil:Math.ceil,sign:Math.sign};
function tokenize(s){const T=[];let i=0;while(i<s.length){const r=s.slice(i);let m;
 if(m=r.match(/^(\d+\.?\d*|\.\d+)/)){T.push({t:'n',v:+m[1]});i+=m[1].length}
 else if(/^[a-z]/.test(r)){const f=FN.find(n=>r.startsWith(n));
  if(f){T.push({t:'f',v:f});i+=f.length}else if(r.startsWith('pi')){T.push({t:'c',v:Math.PI});i+=2}else{T.push({t:'id',v:r[0]});i++}}
 else if('+-*/^()'.includes(r[0])){T.push({t:'o',v:r[0]});i++}else throw 0}
 return T}
function compile(src){
 let s=src.toLowerCase().replace(/\s+/g,'').replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/π/g,'pi').replace(/²/g,'^2').replace(/³/g,'^3').replace(/\*\*/g,'^').replace(/^(y|f\(x\))=/,'');
 const T=tokenize(s),vars=new Set();let i=0;const pk=()=>T[i];
 const isO=(p,v)=>p&&p.t==='o'&&p.v===v;
 function expr(){let l=term();while(isO(pk(),'+')||isO(pk(),'-')){const o=T[i++].v,r=term(),a=l;l=o==='+'?(x,v)=>a(x,v)+r(x,v):(x,v)=>a(x,v)-r(x,v)}return l}
 function term(){let l=unary();for(;;){const p=pk();if(!p)break;let o=null;
  if(isO(p,'*')||isO(p,'/')){o=T[i++].v}else if(p.t!=='o'||p.v==='('){o='*'}else break;
  const r=o==='*'&&p.t!=='o'||o==='*'&&p.v==='('?power():unary(),a=l;l=o==='*'?(x,v)=>a(x,v)*r(x,v):(x,v)=>a(x,v)/r(x,v)}return l}
 function unary(){if(isO(pk(),'-')){i++;const u=unary();return(x,v)=>-u(x,v)}if(isO(pk(),'+')){i++;return unary()}return power()}
 function power(){const b=atom();if(isO(pk(),'^')){i++;const e=unary();return(x,v)=>Math.pow(b(x,v),e(x,v))}return b}
 function atom(){const t=T[i++];if(!t)throw 0;
  if(t.t==='n'||t.t==='c'){const c=t.v;return()=>c}
  if(t.t==='o'&&t.v==='('){const e=expr();if(!isO(T[i++],')'))throw 0;return e}
  if(t.t==='f'){let a;if(isO(pk(),'(')){i++;a=expr();if(!isO(T[i++],')'))throw 0}else a=power();const f=MF[t.v];return(x,v)=>f(a(x,v))}
  if(t.t==='id'){const n=t.v;if(n==='x')return x=>x;if(n==='e')return()=>Math.E;vars.add(n);return(x,v)=>v[n]??1}
  throw 0}
 const f=expr();if(i<T.length)throw 0;return{f,vars:[...vars]}}
/* ---------- Список уравнений ---------- */
function addEq(text=''){const e={text,color:COL[eqs.length%6],vis:true,fn:null,vars:[],bad:false};comp(e);eqs.push(e);renderList();return e}
function comp(e){if(e.sp){e.fn=null;e.bad=false;e.vars=[];return}if(!e.text.trim()){e.fn=null;e.bad=false;e.vars=[];return}try{const c=compile(e.text);e.fn=c.f;e.vars=c.vars;e.bad=false}catch(x){e.fn=null;e.bad=true}}
function renderList(){const box=$('#eqs');box.innerHTML='';
 eqs.forEach((e,k)=>{const r=document.createElement('div');r.className='row'+(e.bad?' bad':'');
  const d=document.createElement('button');d.className='dot';d.style.borderColor=e.color;d.style.background=e.vis?e.color:'transparent';
  d.onclick=()=>{e.vis=!e.vis;d.style.background=e.vis?e.color:'transparent';draw()};
  const y=document.createElement('span');y.className='y';y.textContent='y =';
  const inp=document.createElement('input');inp.type='text';inp.value=e.text;inp.readOnly=!!e.sp;if(e.sp)y.textContent='';inp.placeholder='введите уравнение';inp.autocapitalize='off';inp.spellcheck=false;
  inp.oninput=()=>{e.text=inp.value;comp(e);r.classList.toggle('bad',e.bad);renderVars();draw()};
  const x=document.createElement('button');x.className='x';x.textContent='✕';x.onclick=()=>{eqs.splice(k,1);renderList();renderVars();draw()};
  r.append(d,y,inp,x);box.append(r)});renderVars()}
function renderVars(){const set=[...new Set(eqs.flatMap(e=>e.vars))].sort(),key=set.join();
 if(key===vkey&&$('#vars').children.length)return;vkey=key;const b=$('#vars');b.innerHTML='';
 if(!set.length){b.innerHTML='<div class="empty">Переменных нет. Введите, например, a*sin(b*x) — a и b появятся здесь.</div>';return}
 set.forEach(n=>{vals[n]??=1;const r=document.createElement('div');r.className='vrow';
  const l=document.createElement('b');l.textContent=n;
  const s=document.createElement('input');s.type='range';s.min=-10;s.max=10;s.step=.1;s.value=vals[n];
  const num=document.createElement('input');num.type='number';num.step=.1;num.value=vals[n];
  s.oninput=()=>{vals[n]=+s.value;num.value=s.value;draw()};
  num.oninput=()=>{vals[n]=+num.value||0;s.value=vals[n];draw()};
  r.append(l,s,num);b.append(r)})}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
 const t=b.dataset.t,v=t==='var',k=t==='task',m=t==='terms';$('#vars').hidden=!v;$('#task').hidden=!k;$('#terms').hidden=!m;$('#eqs').hidden=v||k||m;$('#add').hidden=v||k||m;if(v){vkey='';renderVars()}});
$('#add').onclick=()=>{addEq();const i=document.querySelectorAll('#eqs input');i[i.length-1].focus()};
function putEq(t){const last=eqs[eqs.length-1];if(last&&!last.text.trim()){last.text=t;comp(last);renderList()}else addEq(t)}
/* ---------- Рисование ---------- */
const nice=r=>{const p=10**Math.floor(Math.log10(r)),m=r/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p};
const g2=(px,py)=>({x:V.cx+(px-W/2)/V.s,y:V.cy-(py-H/2)/V.s});
const X=x=>(x-V.cx)*V.s+W/2,Y=y=>H/2-(y-V.cy)*V.s;
function draw(){const cs=getComputedStyle(document.documentElement),g=n=>LIGHT?LC[n]:cs.getPropertyValue(n).trim();
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=g('--card');ctx.fillRect(0,0,W,H);
 const st=nice(70/V.s),x0=V.cx-W/2/V.s,x1=V.cx+W/2/V.s,y0=V.cy-H/2/V.s,y1=V.cy+H/2/V.s;
 ctx.lineWidth=1;ctx.strokeStyle=g('--grid');ctx.beginPath();
 for(let k=Math.ceil(x0/st);k*st<=x1;k++){const p=Math.round(X(k*st))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H)}
 for(let k=Math.ceil(y0/st);k*st<=y1;k++){const p=Math.round(Y(k*st))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p)}ctx.stroke();
 ctx.strokeStyle=g('--axis');ctx.lineWidth=1.5;ctx.beginPath();const ax=Math.round(X(0))+.5,ay=Math.round(Y(0))+.5;
 ctx.moveTo(ax,0);ctx.lineTo(ax,H);ctx.moveTo(0,ay);ctx.lineTo(W,ay);ctx.stroke();
 ctx.fillStyle=g('--mut');ctx.font='11px "Segoe UI",system-ui,sans-serif';
 const ly=Math.min(Math.max(Y(0)+14,14),H-6),lx=Math.min(Math.max(X(0)-6,26),W-4),f=v=>String(parseFloat(v.toPrecision(8)));
 ctx.textAlign='center';for(let k=Math.ceil(x0/st);k*st<=x1;k++)if(k)ctx.fillText(f(k*st),X(k*st),ly);
 ctx.textAlign='right';for(let k=Math.ceil(y0/st);k*st<=y1;k++)if(k)ctx.fillText(f(k*st),lx,Y(k*st)+4);
 if(Math.abs(X(0))<W&&Math.abs(Y(0))<H&&X(0)>0&&Y(0)>0)ctx.fillText('0',X(0)-5,Y(0)+13);
 ctx.lineJoin='round';
 for(const e of eqs){if(!e.vis)continue;if(e.sp){drawSp(e);continue}if(!e.fn)continue;ctx.strokeStyle=e.color;ctx.lineWidth=2.5;ctx.beginPath();let pen=false,py=0;
  for(let px=0;px<=W;px+=1.5){const x=x0+px/V.s;if(e.lo!=null&&(x<e.lo||x>e.hi)){pen=false;continue}let y;try{y=e.fn(x,vals)}catch(_){y=NaN}
   if(!isFinite(y)){pen=false;continue}const sy=Y(y);if(Math.abs(sy)>1e5){pen=false;continue}
   if(pen&&Math.abs(sy-py)>H)pen=false;
   if(pen)ctx.lineTo(px,sy);else ctx.moveTo(px,sy);pen=true;py=sy}ctx.stroke();if(e.lo!=null)endpts(e)}
 ctx.lineCap='round';
 const stroke=(s,c)=>{if(s.length<2)return;ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();s.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.stroke()};
 ink.forEach(s=>stroke(s.pts,s.color));if(cur)stroke(cur.pts,'#f5a524');
 if(trace&&tp){const e=eqs.find(e=>e.vis&&e.fn);if(e){let y;try{y=e.fn(tp.x,vals)}catch(_){y=NaN}
  if(isFinite(y)){const sx=X(tp.x),sy=Y(y);ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(sx,sy,6,0,7);ctx.fill();
   const t='('+f(+tp.x.toFixed(3))+'; '+f(+y.toFixed(3))+')',w=ctx.measureText(t).width+16,bx=Math.min(Math.max(sx+10,4),W-w-4),by=Math.max(sy-34,4);
   ctx.fillStyle=g('--fg');ctx.fillRect(bx,by,w,24);ctx.fillStyle=g('--card');ctx.textAlign='left';ctx.font='13px "Segoe UI",sans-serif';ctx.fillText(t,bx+8,by+16)}}}}
function endpts(e){const cs=getComputedStyle(document.documentElement);
 for(const[x,cl]of[[e.lo,e.cl[0]],[e.hi,e.cl[1]]]){let y;try{y=e.fn(x,vals)}catch(_){continue}if(!isFinite(y))continue;
  ctx.beginPath();ctx.arc(X(x),Y(y),5,0,7);ctx.fillStyle=cl?e.color:(LIGHT?'#fff':cs.getPropertyValue('--card'));ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=e.color;ctx.stroke()}
 (e.pts||[]).forEach(p=>{ctx.beginPath();ctx.arc(X(p[0]),Y(p[1]),3.5,0,7);ctx.fillStyle=e.color;ctx.fill()})}
function resize(){const r=cv.getBoundingClientRect();dpr=window.devicePixelRatio||1;W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;draw()}
new ResizeObserver(resize).observe(cv);
/* ---------- Ввод ---------- */
const P=new Map();let lastD=0;
const zoomAt=(px,py,k)=>{const w=g2(px,py);V.s=Math.min(1e5,Math.max(1e-3,V.s*k));V.cx=w.x-(px-W/2)/V.s;V.cy=w.y+(py-H/2)/V.s;draw()};
const dist=()=>{const a=[...P.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1};
const setTr=px=>{tp=g2(px,0);draw()};
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
 if(mode==='pen'&&P.size===1)cur={pts:[g2(e.offsetX,e.offsetY)]};else if(P.size===2){lastD=dist();cur=null}
 if(trace&&mode==='pan')setTr(e.offsetX)});
cv.addEventListener('pointermove',e=>{const p=P.get(e.pointerId);
 if(!p){if(trace&&mode==='pan')setTr(e.offsetX);return}
 const dx=e.offsetX-p.x,dy=e.offsetY-p.y;p.x=e.offsetX;p.y=e.offsetY;
 if(P.size===2){const d=dist(),a=[...P.values()];zoomAt((a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2,d/lastD);lastD=d}
 else if(mode==='pen'&&cur){cur.pts.push(g2(e.offsetX,e.offsetY));draw()}
 else if(trace)setTr(e.offsetX);
 else{V.cx-=dx/V.s;V.cy+=dy/V.s;draw()}});
const up=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);if(cur&&mode==='pen'&&!P.size)finish()};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,e.deltaY<0?1.15:1/1.15)},{passive:false});
$('#bIn').onclick=()=>zoomAt(W/2,H/2,1.3);$('#bOut').onclick=()=>zoomAt(W/2,H/2,1/1.3);
$('#bHome').onclick=()=>{V.cx=0;V.cy=0;V.s=50;draw()};
$('#bTrace').onclick=e=>{trace=!trace;e.currentTarget.classList.toggle('on',trace);if(trace)tp=g2(W/2,0);draw()};
$('#bMode').onclick=e=>{mode=mode==='pan'?'pen':'pan';e.currentTarget.classList.toggle('on',mode==='pen');$('#mn').classList.toggle('pen',mode==='pen');
 toast(mode==='pen'?'Рисуйте график пальцем или мышью':'Режим перемещения')};
$('#rc').onchange=e=>{recog=e.target.checked;toast(recog?'Распознавание включено':'Распознавание выключено — штрихи останутся рисунком')};
$('#clr').onclick=()=>{ink=[];draw()};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800)}
/* ---------- Распознавание ---------- */
function fmt(v){const t=Math.max(.02,Math.min(.2,8/V.s)),g=t>.12?.5:.25,r=Math.round(v/g)*g;v=Math.abs(v-r)<t?r:+v.toFixed(2);return String(v===0?0:v)}
const sn=v=>{for(const g of[1,.5]){const r=Math.round(v/g)*g;if(r&&Math.abs(v-r)<.04*Math.abs(v))return r}return +v.toFixed(2)};
function lin(c,b){const s=fmt(c);if(b==='')return s;if(s==='1')return b;if(s==='-1')return '-'+b;return s+b}
function join(p){let s='';for(const[c,b]of p){if(fmt(c)==='0')continue;const t=lin(c,b);s=!s?t:t[0]==='-'?s+' - '+t.slice(1):s+' + '+t}return s||'0'}
const inn=c=>fmt(c)==='0'?'x':c>0?'x-'+fmt(c):'x+'+fmt(-c);
const den=c=>fmt(c)==='0'?'x':'('+inn(c)+')';
const sh=(v,n)=>fmt(v)==='0'?n:'('+n+(v>0?'−':'+')+fmt(Math.abs(v))+')';
function gauss(A,n){for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];if(Math.abs(A[c][c])<1e-12)return null;for(let r=0;r<n;r++)if(r!==c){const f=A[r][c]/A[c][c];for(let k=c;k<=n;k++)A[r][k]-=f*A[c][k]}}return A.map((r,i)=>r[n]/r[i])}
function lsq(rows,ys){const n=rows[0].length,A=Array.from({length:n},()=>Array(n+1).fill(0));rows.forEach((r,i)=>{for(let a=0;a<n;a++){for(let b=0;b<n;b++)A[a][b]+=r[a]*r[b];A[a][n]+=r[a]*ys[i]}});return gauss(A,n)}
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function plen(P){let s=0;for(let i=1;i<P.length;i++)s+=dist2(P[i-1],P[i]);return s}
function resamp(P,n){const st=plen(P)/(n-1),o=[P[0]];let acc=0;for(let i=1;i<P.length;i++){let a=P[i-1];const b=P[i];let d=dist2(a,b);while(acc+d>=st&&d>0){const t=(st-acc)/d;a={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};o.push(a);d=dist2(a,b);acc=0}acc+=d}if(o.length<n)o.push(P[P.length-1]);return o}
function dpl(P,i,j,e,out){let m=-1,d=0;const a=P[i],b=P[j],L=dist2(a,b)||1e-9;for(let k=i+1;k<j;k++){const q=Math.abs((b.x-a.x)*(a.y-P[k].y)-(a.x-P[k].x)*(b.y-a.y))/L;if(q>d){d=q;m=k}}if(d>e){dpl(P,i,m,e,out);out.push(m);dpl(P,m,j,e,out)} }
function segDev(P,i,j){const a=P[i],b=P[j],L=dist2(a,b)||1e-9;let d=0;for(let k=i+1;k<j;k++)d=Math.max(d,Math.abs((b.x-a.x)*(a.y-P[k].y)-(a.x-P[k].x)*(b.y-a.y))/L);return d/L}
/* «резкие палки»: ломаная из прямых отрезков с чёткими углами */
function polyline(P){const len=plen(P);if(len<=0)return null;const idx=[0];dpl(P,0,P.length-1,.04*len,idx);idx.push(P.length-1);if(idx.length>13)return null;
 for(let k=1;k<idx.length;k++)if(segDev(P,idx[k-1],idx[k])>.03)return null;
 const V2=idx.map(i=>({x:P[i].x,y:P[i].y}));
 for(let k=1;k<V2.length-1;k++){const a=Math.atan2(V2[k].y-V2[k-1].y,V2[k].x-V2[k-1].x),b=Math.atan2(V2[k+1].y-V2[k].y,V2[k+1].x-V2[k].x);let d=Math.abs(b-a);if(d>Math.PI)d=2*Math.PI-d;if(d<.52)return null}
 return V2}
function snapPoly(V2,len){for(let k=1;k<V2.length;k++){const a=V2[k-1],b=V2[k],dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dy)<.1*Math.abs(dx)){a.y=b.y=(a.y+b.y)/2}else if(Math.abs(dx)<.1*Math.abs(dy)){a.x=b.x=(a.x+b.x)/2}}
 if(V2.length>3&&dist2(V2[0],V2[V2.length-1])<.12*len)V2[V2.length-1]={x:V2[0].x,y:V2[0].y};return V2}
function lineEq(P){const n=P.length,mx=P.reduce((s,p)=>s+p.x,0)/n,my=P.reduce((s,p)=>s+p.y,0)/n,a=P[0],b=P[n-1],dx=b.x-a.x,dy=b.y-a.y;
 if(Math.abs(dx)<.1*Math.abs(dy))return{sp:{type:'vline',x:+fmt(mx)},text:'x = '+fmt(mx)};
 if(Math.abs(dy)<.09*Math.abs(dx))return{text:fmt(my)};
 const k=+fmt(dy/dx);return{text:join([[k,'x'],[my-k*mx,'']])}}
/* окружность и эллипс */
function recConic(P,closed){const n=P.length;
 const co=lsq(P.map(p=>[p.x,p.y,1]),P.map(p=>-(p.x*p.x+p.y*p.y)));if(!co)return null;
 const a=-co[0]/2,b=-co[1]/2,r2=a*a+b*b-co[2];if(r2<=0)return null;const r=Math.sqrt(r2);
 let s=0;P.forEach(p=>{s+=(Math.hypot(p.x-a,p.y-b)-r)**2});const ec=Math.sqrt(s/n)/r;
 let B={err:ec,type:'circle',cx:a,cy:b,a:r,b:r};
 const e=closed&&lsq(P.map(p=>[p.x*p.x,p.y*p.y,p.x,p.y]),P.map(()=>1));
 if(e&&e[0]>0&&e[1]>0){const ex=-e[2]/(2*e[0]),ey=-e[3]/(2*e[1]),K=1+e[2]**2/(4*e[0])+e[3]**2/(4*e[1]);
  if(K>0){const ra=Math.sqrt(K/e[0]),rb=Math.sqrt(K/e[1]);let s2=0;P.forEach(p=>{s2+=(Math.sqrt(((p.x-ex)/ra)**2+((p.y-ey)/rb)**2)-1)**2});const ee=Math.sqrt(s2/n);
   if(ee<ec-.03&&Math.abs(ra-rb)>.12*Math.max(ra,rb))B={err:ee,type:'ellipse',cx:ex,cy:ey,a:ra,b:B.type==='circle'?A:Bb}}}
 if(B.err>.12)return null;
 const q=v=>+fmt(v)||+v.toFixed(2),cx=q(B.cx),cy=q(B.cy),A=Math.max(q(B.a),.1),Bb=Math.max(q(B.b),.1);
 const text=B.type==='circle'?sh(cx,'x')+'²+'+sh(cy,'y')+'²='+fmt(A*A):sh(cx,'x')+'²/'+fmt(A*A)+' + '+sh(cy,'y')+'²/'+fmt(Bb*Bb)+' = 1';
 return{sp:{type:'ellipse',cx,cy,a:A,b:B.type==='circle'?A:Bb},text,name:B.type==='circle'?'окружность':'эллипс'}}
/* функции y = f(x) */
function recFn(P){
 const S=P.slice().sort((a,b)=>a.x-b.x),xmin=S[0].x,xmax=S[S.length-1].x,xr=xmax-xmin;if(xr<=0)return null;
 const N=64,xs=[],y0=[];
 for(let i=0;i<N;i++){const x=xmin+xr*i/(N-1);let j=0;while(j<S.length-2&&S[j+1].x<x)j++;const a=S[j],b=S[j+1],t=b.x>a.x?Math.min(1,Math.max(0,(x-a.x)/(b.x-a.x))):0;xs.push(x);y0.push(a.y+(b.y-a.y)*t)}
 const ys=y0.map((_,i)=>{let s=0,n=0;for(let k=-2;k<=2;k++)if(y0[i+k]!==undefined){s+=y0[i+k];n++}return s/n});
 const ymin=Math.min(...ys),ymax=Math.max(...ys);
 if(ymax-ymin<.05*xr)return{text:fmt(ys.reduce((a,b)=>a+b)/N),err:0};
 const yr=Math.max(ymax-ymin,.15*xr),C=[];
 const fit=(Bs,np,text)=>{const co=lsq(xs.map(x=>Bs.map(f=>f(x))),ys);if(!co)return;let s=0;for(let i=0;i<N;i++){let y=0;Bs.forEach((f,k)=>y+=co[k]*f(xs[i]));if(!isFinite(y))return;s+=(y-ys[i])**2}const err=Math.sqrt(s/N)/yr;C.push({err,sc:err+.012*np,text:text(co)})};
 const one=()=>1,id=x=>x,xm=+fmt((xmin+xmax)/2),cA=+fmt(xs[ys.indexOf(ymax)]),cB=+fmt(xs[ys.indexOf(ymin)]);
 fit([one,id],2,c=>join([[c[1],'x'],[c[0],'']]));
 fit([one,id,x=>x*x],3,c=>join([[c[2],'x^2'],[c[1],'x'],[c[0],'']]));
 fit([one,id,x=>x*x,x=>x**3],4,c=>join([[c[3],'x^3'],[c[2],'x^2'],[c[1],'x'],[c[0],'']]));
 fit([one,id,x=>x*x,x=>x**3,x=>x**4],5,c=>join([[c[4],'x^4'],[c[3],'x^3'],[c[2],'x^2'],[c[1],'x'],[c[0],'']]));
 const sx=+fmt(xmin),ex=+fmt(xmax);
 fit([one,x=>Math.sqrt(Math.max(0,x-sx))],3,c=>join([[c[1],'sqrt('+inn(sx)+')'],[c[0],'']]));
 fit([one,x=>Math.sqrt(Math.max(0,ex-x))],3,c=>join([[c[1],'sqrt('+(ex===0?'-x':ex+'-x')+')'],[c[0],'']]));
 [cA,cB].forEach(c0=>{fit([one,x=>Math.abs(x-c0)],3,c=>join([[c[1],'abs('+inn(c0)+')'],[c[0],'']]));fit([one,id,x=>Math.abs(x-c0)],4,c=>join([[c[2],'abs('+inn(c0)+')'],[c[1],'x'],[c[0],'']]))});
 for(let m=-6;m<=6;m+=.25){if(!m)continue;const k=sn(m/xr);if(!k)continue;fit([one,x=>Math.exp(k*(x-xmin))],3.5,c=>{const kx=k===1?'x':k===-1?'-x':k+'x';return join([[c[1]*Math.exp(-k*xmin),'exp('+kx+')'],[c[0],'']])})}
 if(xmin>-.2*xr)for(const t of[.001,.02,.1,.3]){const c0=+fmt(xmin-xr*t);if(xmin<=c0)continue;fit([one,x=>Math.log(x-c0)],3,c=>join([[c[1],'ln('+inn(c0)+')'],[c[0],'']]))}
 for(const t of[.02,.08,.2,.5])for(const c0 of[+fmt(xmin-xr*t),+fmt(xmax+xr*t)]){if(c0>xmin&&c0<xmax)continue;fit([one,x=>1/(x-c0)],3,c=>join([[1,fmt(c[1])+'/'+den(c0)],[c[0],'']]))}
 fit([one,x=>Math.cbrt(x-xm)],3,c=>join([[c[1],'cbrt('+inn(xm)+')'],[c[0],'']]));
 for(const c0 of[cA,cB])for(const f of[.08,.12,.18,.25,.35]){const d2=sn(2*(f*xr)**2);if(d2<=0)continue;const u=c0===0?'x^2':'('+inn(c0)+')^2';fit([one,x=>Math.exp(-((x-c0)**2)/d2)],4,c=>join([[c[1],'exp(-'+u+'/'+d2+')'],[c[0],'']]))}
 for(const c0 of[xm,+fmt(xmin+xr*.35),+fmt(xmin+xr*.65)])for(const kk of[2,3,4,6,8,12]){const k=sn(kk/xr);if(!k)continue;const arg=c0===0?(k===1?'x':k+'x'):(k===1?'':k)+'('+inn(c0)+')';fit([one,x=>Math.tanh(k*(x-c0))],4,c=>join([[c[1],'tanh('+arg+')'],[c[0],'']]))}
 const seen=new Set();for(let n=.75;n<=8;n+=.05){const w=sn(2*Math.PI*n/xr);if(!w||seen.has(w))continue;seen.add(w);
  fit([one,x=>Math.sin(w*x),x=>Math.cos(w*x)],4.3,c=>{const a=Math.hypot(c[1],c[2]),ph=Math.atan2(c[2],c[1]);return join([[a,'sin('+(w===1?'':w)+'x'+(Math.abs(ph)<.12?'':(ph>0?'+':'-')+fmt(Math.abs(ph)))+')'],[c[0],'']])})}
 C.sort((a,b)=>a.sc-b.sc);const b=C[0];return b&&b.err<.08?b:null}
function drawSp(e){ctx.strokeStyle=e.color;ctx.lineWidth=2.5;ctx.beginPath();const s=e.sp;
 if(s.type==='vline'){ctx.moveTo(X(s.x),0);ctx.lineTo(X(s.x),H)}else ctx.ellipse(X(s.cx),Y(s.cy),s.a*V.s,s.b*V.s,0,0,7);ctx.stroke()}
function addSp(sp,text){const last=eqs[eqs.length-1],e=last&&!last.text.trim()&&!last.sp?last:addEq('');e.sp=sp;e.text=text;e.fn=null;renderList()}
function finish(){const s=cur;cur=null;let P=s&&s.pts;
 if(!P||P.length<5||plen(P)<14/V.s){draw();return}
 P=resamp(P,120);const len=plen(P),closed=dist2(P[0],P[P.length-1])<.2*len,col='#f5a524',done=m=>{toast(m);draw()};
 const pv=polyline(P);
 if(pv){
  if(pv.length===2){
   if(recog){const L=lineEq(P);if(L.sp)addSp(L.sp,L.text);else putEq(L.text);return done('Прямая: '+(L.sp?'':'y = ')+L.text)}
   ink.push({pts:snapPoly(pv,len),color:col});return done('Прямая выровнена')}
  if(recog&&!closed){const r=recFn(P);if(r&&r.err<.04&&r.text.includes('abs')){putEq(r.text);return done('Распознано: y = '+r.text)}
  ink.push({pts:snapPoly(pv,len),color:col});return done('Ломаная выровнена по прямым отрезкам')}
 if(recog){let tv=0,mn=1e9,mx=-1e9;P.forEach((p,i)=>{mn=Math.min(mn,p.x);mx=Math.max(mx,p.x);if(i)tv+=Math.abs(p.x-P[i-1].x)});const fnlike=mx>mn&&tv<=1.35*(mx-mn);
  if(closed||!fnlike){const c=recConic(P,closed);if(c){addSp(c.sp,c.text);return done('Распознано: '+c.name+' '+c.text)}}
  if(fnlike){const r=recFn(P);if(r){putEq(r.text);return done('Распознано: y = '+r.text)}
  toast('Не распознано — штрих оставлен как рисунок')}
 ink.push({pts:P,color:col});draw()}
/* ---------- Задачи ---------- */
const num=s=>parseFloat(String(s).replace(',','.').replace(/[−–]/g,'-'));
const ru=v=>String(+(+v).toFixed(4)).replace('.',',').replace('-','−');
function parseTask(t){
 t=t.replace(/х/gi,'x').replace(/[−–]/g,'-').replace(/⩽|≤/g,'<=').replace(/\s+/g,' ');
 const d=t.match(/(-?\d+[.,]?\d*)\s*(<=|<)\s*x\s*(<=|<)\s*(-?\d+[.,]?\d*)/);
 let f=t,lo=null,hi=null,cl=[1,1];
 if(d){lo=num(d[1]);hi=num(d[4]);cl=[d[2]==='<='?1:0,d[3]==='<='?1:0];f=t.replace(d[0],'')}
 f=f.replace(/[,;]?\s*(где|where|при)(?=\s|$).*$/i,'').replace(/[,;.\s]+$/,'').replace(/^\s*\d+[.)]\s+/,'').replace(/^\s*(y|f\(x\))\s*=/i,'').trim();
 return{f,lo,hi,cl}}
let taskEq=null,lastTask=null;
function solve(){
 const dm=$('#tD').value.trim(),src=$('#tIn').value.trim(),out=$('#tOut');let c,note='';
 if(!src){out.innerHTML='<div class="res">Введите формулу, например <b>y = x^2 - 5</b>, затем область определения (например <b>−3 ≤ x ≤ 3</b>) и значения x для таблицы. Можно вставить условие целиком: <b>y = x^2 - 5, где -3 <= x <= 3</b>.</div>';return}
 const T=parseTask(dm?src+', где '+dm:src);
 try{if(!T.f)throw 0;c=compile(T.f)}catch(_){out.innerHTML='<div class="res">Не удалось разобрать формулу «'+T.f.replace(/</g,'&lt;')+'»</div>';return}
 if(T.lo==null||T.lo>=T.hi){T.lo=-5;T.hi=5;T.cl=[1,1];note='<span style="color:var(--bad)">Введите область определения, например −3 ≤ x ≤ 3. Сейчас взято −5 ≤ x ≤ 5.</span>'}
 const f=x=>{try{return c.f(x,vals)}catch(_){return NaN}};
 let xs=$('#tX').value.replace(/[−–]/g,'-').split(/[;\s]+/).map(num).filter(isFinite);
 if(!xs.length){const a=Math.ceil(T.lo),b=Math.floor(T.hi),st=Math.max(1,Math.ceil((b-a+1)/12));for(let x=a;x<=b;x+=st)xs.push(x)}
 xs.sort((a,b)=>a-b);const ys=xs.map(f);
 const N=4000;let mn=Infinity,mx=-Infinity,im=0,iM=0,bad=0;
 for(let i=0;i<=N;i++){const y=f(T.lo+(T.hi-T.lo)*i/N);if(!isFinite(y)||Math.abs(y)>1e5){bad++;continue}if(y<mn){mn=y;im=i}if(y>mx){mx=y;iM=i}}
 if(!isFinite(mn)){out.innerHTML='<div class="res">Функция не определена на этом промежутке.</div>';return}
 const lt=o=>o?'<':'≤',xat=i=>ru(T.lo+(T.hi-T.lo)*i/N);
 const mnO=im===0&&!T.cl[0]||im===N&&!T.cl[1],mxO=iM===0&&!T.cl[0]||iM===N&&!T.cl[1];
 const R=mx-mn<1e-9?'y = '+ru(mn):ru(mn)+' '+lt(mnO)+' y '+lt(mxO)+' '+ru(mx);
 const D=ru(T.lo)+' '+lt(!T.cl[0])+' x '+lt(!T.cl[1])+' '+ru(T.hi);
 const row=(h,a)=>'<tr><th>'+h+'</th>'+a.map(v=>'<td>'+v+'</td>').join('')+'</tr>';
 out.innerHTML='<div class="res"><b>а) Таблица значений</b><div class="tw" style="overflow-x:auto;margin-top:6px"><table>'+row('x',xs.map(ru))+row('y',ys.map(y=>isFinite(y)?ru(y):'—'))+'</table></div><input type="range" class="tsl" min="0" max="100" value="0" style="width:100%;display:none" aria-label="Прокрутка таблицы">График построен на координатной плоскости.<div style="margin-top:8px"><button class="pb" id="tPng" style="margin:0">⤓ Экспорт задачи в PNG</button></div></div>'
 +'<div class="res"><b>б) Область значений</b><div style="font-size:18px;margin:4px 0">'+R+'</div>наименьшее: '+ru(mn)+' (x = '+xat(im)+'), наибольшее: '+ru(mx)+' (x = '+xat(iM)+')<br><span style="color:var(--mut)">Область определения: '+D+'</span>'
 +(bad?'<br><span style="color:var(--bad)">Есть точки, где функция не определена или неограничена — ответ может быть неверным.</span>':'')+(note?'<br>'+note:'')+'</div>';
 lastTask={f:T.f,D,R,xs,ys,mn,mx,xmn:xat(im),xmx:xat(iM),bad,note:note.replace(/<[^>]+>/g,''),lo:T.lo,hi:T.hi};
 const tw=out.querySelector('.tw'),sl=out.querySelector('.tsl'),upd=()=>{const m=tw.scrollWidth-tw.clientWidth;sl.style.display=m>2?'block':'none';sl.value=m>0?tw.scrollLeft/m*100:0};
 sl.oninput=()=>{tw.scrollLeft=sl.value/100*(tw.scrollWidth-tw.clientWidth)};tw.onscroll=upd;upd();setTimeout(upd,60);$('#tPng').onclick=exportTask;
 const last=eqs[eqs.length-1];if(!taskEq||!eqs.includes(taskEq))taskEq=last&&!last.text.trim()?last:addEq('');
 eqs.forEach(e=>e.vis=false);
 Object.assign(taskEq,{text:T.f,lo:T.lo,hi:T.hi,cl:T.cl,pts:xs.map((x,i)=>[x,ys[i]]).filter(p=>isFinite(p[1])),vis:true});comp(taskEq);renderList();
 const w2=T.hi-T.lo,h2=(mx-mn)||2;V.cx=(T.lo+T.hi)/2;V.cy=(mn+mx)/2;V.s=Math.min(Math.max(Math.min(W/(w2*1.4),H/(h2*1.5)),4),300);draw()}
/* ---------- Термины ---------- */
const TERMS=[
['Функция','Правило, по которому каждому значению независимой переменной (аргумента) x из некоторого множества соответствует единственное значение зависимой переменной y. Записывают y = f(x).','y = x² − 5: каждому x соответствует ровно одно y.'],
['Аргумент (независимая переменная)','Переменная x, значения которой мы выбираем сами.',''],
['Зависимая переменная','Переменная y, значения которой определяются по значениям аргумента.',''],
['Значение функции','Число y, которое получается при подстановке конкретного значения аргумента в формулу.','y = x² − 5 при x = 2: y = 2² − 5 = −1.'],
['Область определения функции','Множество всех значений аргумента x, при которых функция имеет смысл или которые заданы условием задачи. Обозначается D(f). Часто записывается двойным неравенством.','−3 ≤ x ≤ 3. Для y = 6/(x + 3) нельзя брать x = −3.'],
['Область значений функции','Множество всех значений y, которые принимает функция, когда x пробегает всю область определения. Обозначается E(f).','y = x² − 5, −3 ≤ x ≤ 3: −5 ≤ y ≤ 4.'],
['График функции','Множество всех точек координатной плоскости, абсциссы которых равны значениям аргумента, а ординаты — соответствующим значениям функции.',''],
['Способы задания функции','Формулой, таблицей, графиком, словесным описанием.',''],
['Таблица значений','Таблица, в которой для выбранных значений x записаны соответствующие значения y. По её точкам строят график.',''],
['Двойное неравенство','Запись вида a ≤ x ≤ b: x одновременно не меньше a и не больше b. Знак < означает, что граница не входит в промежуток.','−3 ≤ x ≤ 3 — отрезок; −3 < x < 3 — интервал.'],
['Наибольшее и наименьшее значения','Самое большое и самое маленькое значения y на заданной области определения.','y = x² − 5 при −3 ≤ x ≤ 3: наименьшее −5 (при x = 0), наибольшее 4 (при x = ±3).'],
['Нуль функции','Значение аргумента, при котором значение функции равно 0 (график пересекает ось x).','y = x² − 5: нули x = ±√5.'],
['Возрастающая и убывающая функции','Функция возрастает, если большему значению x соответствует большее значение y; убывает, если большему x соответствует меньшее y.',''],
['Линейная функция','Функция вида y = kx + b. Графиком служит прямая; k — угловой коэффициент, b — значение y при x = 0.','y = ½x + 1.'],
['Квадратичная функция','Функция вида y = ax² + bx + c, где a ≠ 0. Графиком служит парабола.','y = x² − 5.'],
['Обратная пропорциональность','Функция вида y = k/x, где x ≠ 0. Графиком служит гипербола.','y = 6/(x + 3) — гипербола, сдвинутая влево на 3.'],
['Координатная плоскость','Плоскость с двумя перпендикулярными осями: x (ось абсцисс) и y (ось ординат), пересекающимися в начале координат O.','']];
function renderTerms(){const q=$('#tq').value.trim().toLowerCase();
 $('#tl').innerHTML=TERMS.filter(t=>!q||(t[0]+' '+t[1]).toLowerCase().includes(q)).map(t=>'<details class="res"><summary><b>'+t[0]+'</b></summary>'+t[1]+(t[2]?'<div class="ex">Пример: '+t[2]+'</div>':'')+'</details>').join('')||'<div class="empty">Ничего не найдено</div>'}
$('#tq').oninput=renderTerms;renderTerms();
/* ---------- Экспорт PNG ---------- */
async function saveBlob(b,name){
 try{if(window.claude&&claude.use){const d=await claude.use('downloads');if(d){await d.save({filename:name,data:b});return toast('Готово: '+name)}}}
 catch(e){const c=e&&e.code;if(c==='declined')return;if(c&&!['unavailable','not_granted','capability_disabled','capability_removed'].includes(c))return toast('Не удалось сохранить ('+c+')')}
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Сохранено: '+name)}
const toBlob=c=>new Promise(r=>c.toBlob(r,'image/png'));
function snap(){const tr=trace;trace=false;LIGHT=true;draw();const g=document.createElement('canvas');g.width=cv.width;g.height=cv.height;g.getContext('2d').drawImage(cv,0,0);LIGHT=false;trace=tr;draw();return g}
async function exportGraph(){await saveBlob(await toBlob(snap()),'graphic-studio-graph.png')}
async function exportTask(){const L=lastTask;if(!L){toast('Сначала решите задачу');return}
 const gi=snap(),Wd=1000,pad=40,cw=88,hw=56,per=Math.max(1,Math.floor((Wd-2*pad-hw)/cw)),n=Math.ceil(L.xs.length/per),asp=cv.width/cv.height,gh=Math.min(900,Math.round((Wd-2*pad)/asp)),gw=Math.round(gh*asp);
 const extra=(L.bad||L.note)?34:0,Ht=pad+84+38+n*86+gh+30+38+48+34+extra+40+pad;
 const c=document.createElement('canvas');c.width=Wd*2;c.height=Ht*2;const x=c.getContext('2d');x.scale(2,2);
 x.fillStyle='#fff';x.fillRect(0,0,Wd,Ht);x.textBaseline='top';x.textAlign='left';x.fillStyle='#1b1b1b';
 const F='"Segoe UI",system-ui,sans-serif',pr=s=>s.replace(/\^2/g,'²').replace(/\^3/g,'³').replace(/\*/g,'·').replace(/-/g,'−');
 let y=pad;x.font='bold 30px '+F;x.fillText('y = '+pr(L.f),pad,y);y+=42;
 x.font='22px '+F;x.fillStyle='#555';x.fillText('Область определения: '+L.D,pad,y);y+=42;
 x.fillStyle='#1b1b1b';x.font='bold 22px '+F;x.fillText('а) Таблица значений',pad,y);y+=38;
 for(let i=0;i<n;i++){const xs=L.xs.slice(i*per,(i+1)*per),ys=L.ys.slice(i*per,(i+1)*per);
  for(let r=0;r<2;r++){const yy=y+r*36;x.fillStyle='#ececec';x.fillRect(pad,yy,hw,36);x.strokeStyle='#999';x.lineWidth=1;x.strokeRect(pad+.5,yy+.5,hw,36);
   x.fillStyle='#1b1b1b';x.textAlign='center';x.font='bold 20px "Cambria Math",serif';x.fillText(r?'y':'x',pad+hw/2,yy+8);x.font='20px "Cambria Math",serif';
   xs.forEach((v,j)=>{const cx=pad+hw+j*cw;x.strokeRect(cx+.5,yy+.5,cw,36);x.fillText(r?(isFinite(ys[j])?ru(ys[j]):'—'):ru(v),cx+cw/2,yy+8)});x.textAlign='left'}
  y+=86}
 const gx=pad+(Wd-2*pad-gw)/2;x.drawImage(gi,gx,y,gw,gh);x.strokeStyle='#bbb';x.strokeRect(gx+.5,y+.5,gw,gh);y+=gh+30;
 x.fillStyle='#1b1b1b';x.font='bold 22px '+F;x.fillText('б) Область значений',pad,y);y+=38;
 x.font='bold 32px "Cambria Math",serif';x.fillText(L.R,pad,y);y+=48;
 x.font='20px '+F;x.fillStyle='#333';x.fillText('наименьшее: '+ru(L.mn)+' (x = '+L.xmn+'), наибольшее: '+ru(L.mx)+' (x = '+L.xmx+')',pad,y);y+=34;
 if(extra){x.fillStyle='#c42b1c';x.fillText(L.bad?'Есть точки, где функция не определена или неограничена — ответ может быть неверным.':L.note,pad,y)}
 x.fillStyle='#999';x.font='16px '+F;x.fillText('Graphic Studio',pad,Ht-pad-8);
 await saveBlob(await toBlob(c),'graphic-studio-task.png')}
$('#bPng').onclick=exportGraph;
$('#tGo').onclick=solve;$('#tIn').onkeydown=e=>{if(e.key==='Enter')solve()};
addEq('sin(x)');addEq('');

if(enabled){$('#cloud').hidden=false;
$('#cSave').onclick=async()=>{const n=prompt('Название графика','График 1');if(!n)return;try{await save(n,{eqs:eqs.map(e=>({text:e.text,color:e.color,vis:e.vis,sp:e.sp,lo:e.lo,hi:e.hi,cl:e.cl,pts:e.pts})),vals,ink,view:V});toast('Сохранено в облако')}catch(e){toast('Ошибка: '+e.message)}};
$('#cLoad').onclick=async()=>{try{const L=await list();if(!L.length)return toast('Сохранений нет');const n=prompt('Что загрузить?\n'+L.map((x,i)=>(i+1)+'. '+x.name).join('\n'));const it=L[(+n||0)-1];if(!it)return;const d=it.data;eqs=d.eqs.map(e=>({...e,fn:null,vars:[],bad:false}));eqs.forEach(comp);vals=d.vals||{};ink=d.ink||[];Object.assign(V,d.view);vkey='';renderList();draw();toast('Загружено')}catch(e){toast('Ошибка: '+e.message')}}}
