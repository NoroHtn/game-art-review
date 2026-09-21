import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../dist/round-clock.js',import.meta.url),'utf8');
function fixture(random){
  let frame;
  const node={textContent:'',classList:{toggle(){}},append(){},querySelector(){return {...node}}};
  const S={phase:'open',online:true,mult:1,A:{state:'placed',amount:10},B:{state:'placed',amount:10}};
  const c={S,performance:{now:()=>0},Math:Object.assign(Object.create(Math),{random:()=>random}),document:{createElement:()=>({...node}),querySelector:()=>node},window:{demo:{},roundScene:{get:()=>({preparing:false})}},requestAnimationFrame:fn=>{frame=fn},$:()=>node,fmt:n=>n.toFixed(2),money:n=>Math.round(n*100)/100,render(){},next(){S.phase='open'},start(){},reset(){S.phase='open';S.mult=1},beginLive(){S.phase='live';S.mult=1;S.A.state=S.B.state='active'},crash(){S.phase='ended';for(const p of [S.A,S.B])if(p.state==='active')p.state='lost'},cashout(k,target){S[k].state='paid';S[k].acceptedMult=target}};
  vm.createContext(c);vm.runInContext(code,c);return {c,S,frame:t=>frame(t)};
}
let f=fixture(0);f.c.beginLive();assert.equal(f.S.phase,'ended');assert.equal(f.S.mult,1);
f=fixture(.999999);f.c.beginLive();f.frame(1000);assert.equal(f.S.mult,1.3);f.S.online=false;f.frame(2000);assert.equal(f.S.mult,1.3);f.S.online=true;f.frame(16000);assert.equal(f.S.mult,5);assert.equal(f.S.A.state,'lost');
f=fixture(.5);f.S.A.auto=true;f.S.A.target=2;f.S.B.auto=true;f.S.B.target=3;f.c.beginLive();f.frame(8000);assert.equal(f.S.mult,3);assert.equal(f.S.A.state,'paid');assert.equal(f.S.B.state,'lost');
f=fixture(.9);f.c.beginLive();f.frame(1000);f.c.reset();f.frame(20000);assert.equal(f.S.phase,'open');assert.equal(f.S.mult,1);
console.log('PASS: automatic progression, 1x/5x bounds, offline pause, auto cashout before crash, crash wins ties, reset cancels clock');
