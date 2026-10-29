// Edgar game/win-fx.js fountain equations, driven by the existing visible-time clock.
const rnd=(i,k)=>{const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
export function coinFountain(frames){
 if(!frames?.length)return null;
 const root=new PIXI.Container();let age=0,count=0;
 const coins=Array.from({length:64},(_,i)=>{const sprite=new PIXI.Sprite(frames[0]);sprite.anchor.set(.5);root.addChild(sprite);return{sprite,i,depth:.45+rnd(i,1)*.95,life:1.5+rnd(i,3)*.6};});
 root.setCount=n=>count=n;
 root.update=dt=>{age+=dt;for(const c of coins){const{i,sprite:s,depth,life}=c,t=(age+rnd(i,4)*2.4)%2.4;s.visible=i<count&&t<life;if(!s.visible)continue;
  const x0=[-360,0,360][i%3]+(rnd(i,2)-.5)*120,vx=(rnd(i,6)-.5)*1500+(i%3-1)*260,vy=1350+depth*450+rnd(i,5)*450;
  s.position.set(x0+vx*t,620-vy*t+1100*t*t);s.scale.set(150*depth/frames[0].width);s.rotation=(rnd(i,7)-.5)*.7+(rnd(i,8)-.5)*2.1*t/life;
  s.texture=frames[Math.floor(t*(14+depth*14)+rnd(i,9)*frames.length)%frames.length];s.alpha=Math.min(1,(life-t)/.18);
 }};return root;
}
