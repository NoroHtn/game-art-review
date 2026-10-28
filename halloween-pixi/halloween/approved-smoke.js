// Approved source pixels, separated into a fixed vessel and continuously rising wisps.
const SAFE_TOP={multi:[128,118,124],collect:[140,118,116],mystery:[116,113,100]};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const round=v=>Math.round(v*1000)/1000,fract=v=>v-Math.floor(v);
function hue(r,g,b){const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;if(!d)return 0;return(((hi===r?(g-b)/d:hi===g?(b-r)/d+2:(r-g)/d+4)*60)+360)%360;}

export function separateApprovedPlume(source,width,height,name,tier=0){
 const count=width*height,selected=new Uint8Array(count),protectedPixels=new Uint8Array(count);
 const safe=SAFE_TOP[name][clamp(tier,0,2)],floor=190;let protectedCount=0;
 const goldCandidates=new Uint8Array(count);
 for(let y=110;y<floor;y++)for(let x=60;x<Math.min(width,452);x++){
  const i=y*width+x,p=i*4,r=source[p],g=source[p+1],b=source[p+2],h=hue(r,g,b);
  if(source[p+3]>3&&r>90&&g>40&&h>=12&&h<=78&&g>b*1.14)goldCandidates[i]=1;
 }
 if(name==='mystery'){
  // Small isolated warm filaments belong to the red vapor, not to the solid
  // coin/rim cluster. Native coin clusters are large and connected.
  const visited=new Uint8Array(count);
  for(let y=110;y<floor;y++)for(let x=60;x<Math.min(width,452);x++){
   const start=y*width+x;if(!goldCandidates[start]||visited[start])continue;
   const component=[start];visited[start]=1;
   for(let at=0;at<component.length;at++){
    const i=component[at],cx=i%width,cy=Math.floor(i/width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const nx=cx+dx,ny=cy+dy;if(nx<60||nx>=Math.min(width,452)||ny<110||ny>=floor)continue;
     const n=ny*width+nx;if(goldCandidates[n]&&!visited[n]){visited[n]=1;component.push(n);}
    }
   }
   const coinTop=[155,140,110][clamp(tier,0,2)];
   if(component.length>=160)for(const i of component)if(Math.floor(i/width)>=coinTop)protectedPixels[i]=1;
  }
 }else protectedPixels.set(goldCandidates);
 for(let y=0;y<floor;y++)for(let x=60;x<Math.min(width,452);x++){
  const i=y*width+x,p=i*4,r=source[p],g=source[p+1],b=source[p+2],a=source[p+3];if(a<3)continue;
  const h=hue(r,g,b),outer=((x-256)/182)**2+((y-184)/46)**2<=1,inner=((x-256)/155)**2+((y-175)/22)**2<1;
  if(protectedPixels[i]||(y>=136&&outer&&!inner)){protectedPixels[i]=1;protectedCount++;continue;}
  const colored=name==='multi'?b>g+9&&r>g+7:name==='collect'?b>r+5&&g>r-8:(h<28||h>350)&&r>g+3&&r>b+3;
  if(y<safe||colored)selected[i]=1;
 }
 const filled=selected.slice();
 for(let y=1;y<floor-1;y++)for(let x=61;x<Math.min(width-1,451);x++){
  const i=y*width+x;if(selected[i]||protectedPixels[i]||source[i*4+3]<3)continue;
  let left=false,right=false,up=false,down=false;
  for(let d=1;d<=3;d++){left||=!!selected[i-d];right||=!!selected[i+d];if(y>=d)up||=!!selected[i-d*width];if(y+d<floor)down||=!!selected[i+d*width];}
  if(left&&right||up&&down)filled[i]=1;
 }
 const horizontal=new Float32Array(count),soft=new Float32Array(count),weights=[1,2,3,4,3,2,1];
 for(let y=0;y<floor;y++)for(let x=57;x<Math.min(width,455);x++){
  let v=0;for(let d=-3;d<=3;d++)if(x+d>=0&&x+d<width)v+=filled[y*width+x+d]*weights[d+3];horizontal[y*width+x]=v/16;
 }
 for(let y=0;y<floor;y++)for(let x=57;x<Math.min(width,455);x++){
  let v=0;for(let d=-3;d<=3;d++)if(y+d>=0&&y+d<floor)v+=horizontal[(y+d)*width+x]*weights[d+3];
  soft[y*width+x]=protectedPixels[y*width+x]?0:Math.max(filled[y*width+x],v/16);
 }
 const body=new Uint8ClampedArray(source),parts=Array.from({length:3},()=>new Uint8ClampedArray(source.length));
 const mouth=new Uint8ClampedArray(source.length),plume=new Uint8ClampedArray(source.length);
 let alphaMass=0,lowerAlphaMass=0,extractedPixels=0,minY=height,maxY=0;
 for(let i=0;i<count;i++){
  const p=i*4,x=i%width,y=Math.floor(i/width),a=source[p+3]/255,m=soft[i];if(!m||!a)continue;
  const smoke=a*m;body[p+3]=Math.round((a-smoke)/Math.max(.00001,1-smoke)*255);
  for(let c=0;c<3;c++)plume[p+c]=source[p+c];plume[p+3]=Math.round(smoke*255);
  const anchored=smooth((y-171)/17)*.58,baseAlpha=smoke*anchored,flowAlpha=(smoke-baseAlpha)/Math.max(.00001,1-baseAlpha);
  const lobes=[178,256,334].map(cx=>Math.exp(-.5*((x-cx)/86)**2)),total=lobes.reduce((s,n)=>s+n,0);
  for(let c=0;c<3;c++)mouth[p+c]=source[p+c];mouth[p+3]=Math.round(baseAlpha*255);
  for(let n=0;n<3;n++){for(let c=0;c<3;c++)parts[n][p+c]=source[p+c];parts[n][p+3]=Math.round((1-(1-flowAlpha)**(lobes[n]/total))*255);}
  alphaMass+=smoke;if(y>=safe)lowerAlphaMass+=smoke;if(smoke>.015){extractedPixels++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 return{body,parts,mouth,plume,stats:{extractedPixels,alphaMass:round(alphaMass),lowerAlphaMass:round(lowerAlphaMass),oldCutY:safe,minY,maxY,protectedGoldPixels:protectedCount,featherSourcePixels:3}};
}

export function separateApprovedPearl(source,width,height){
 const pixels=new Uint8ClampedArray(source.length),gold=new Uint8Array(width*height);
 for(let y=22;y<90;y++)for(let x=108;x<408;x++){
  const i=y*width+x,p=i*4,r=source[p],g=source[p+1],b=source[p+2],h=hue(r,g,b);
  if(source[p+3]>3&&h>=12&&h<=85&&r>=g*.92&&g>b*1.065)gold[i]=1;
 }
 let movingPixels=0,alphaMass=0;
 for(let y=30;y<82;y++)for(let x=116;x<400;x++){
  const i=y*width+x,p=i*4,r=source[p],g=source[p+1],b=source[p+2];
  const ellipse=Math.hypot((x-256)/126,(y-55)/17);if(ellipse>=1||gold[i])continue;
  // Cool pearl is distinct from warm coin faces. Remove a native-pixel guard
  // around those faces too, so specular coin edges cannot drift with the whorl.
  const cool=smooth((Math.max(b-r,b-g,Math.min(r,b)-g)-4)/18);if(!cool)continue;
  let distance=7;
  for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
   if(gold[ny*width+nx])distance=Math.min(distance,Math.hypot(dx,dy));
  }
  const alpha=source[p+3]*cool*smooth((1-ellipse)*6)*smooth((distance-3)/3);
  if(alpha<.5)continue;
  for(let c=0;c<3;c++)pixels[p+c]=source[p+c];pixels[p+3]=Math.round(alpha);
  movingPixels++;alphaMass+=alpha/255;
 }
 return{pixels,stats:{movingPixels,alphaMass:round(alphaMass),goldCoinPixelsExcluded:true,coinEdgeGuardSourcePixels:3,featherSourcePixels:3}};
}

export class ApprovedSmokeRig{
 constructor({PIXI,view,texture,tier=0}){
  Object.assign(this,{PIXI,view});this.kind=view.name==='super'?'approved-pearl-whorl':'approved-advecting-plume';
  this.layer=this.makeLayer();this.wisps=[];this.derived=[];this.destroyed=false;this.last=null;this.setTexture(texture,tier);
 }
 makeLayer(){const layer=new this.PIXI.Container();layer.label='approved-plume-'+this.view.name;layer.eventMode='none';if(this.view.name==='super')this.view.motionBody.addChild(layer);else this.view.motionBody.addChildAt(layer,0);return layer;}
 textureFromPixels(pixels,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const g=canvas.getContext('2d'),data=g.createImageData(width,height);data.data.set(pixels);g.putImageData(data,0,0);
  const texture=this.PIXI.Texture.from(canvas);this.derived.push(texture);return texture;
 }
 sourcePixels(texture){
  const canvas=document.createElement('canvas');canvas.width=texture.width;canvas.height=texture.height;const g=canvas.getContext('2d'),f=texture.frame;
  g.drawImage(texture.source.resource,f.x,f.y,f.width,f.height,0,0,texture.width,texture.height);return g.getImageData(0,0,canvas.width,canvas.height).data;
 }
 disposeLayer(layer,textures){layer.mask=null;layer.destroy({children:true,texture:false,textureSource:false});for(const texture of textures)texture.destroy(true);}
 clearDerived(){
  if(this.view.sprite.texture===this.bodyTexture&&this.sourceTexture)this.view.sprite.texture=this.sourceTexture;
  this.layer.mask=null;for(const node of this.layer.removeChildren())node.destroy({children:true,texture:false,textureSource:false});
  for(const texture of this.derived)texture.destroy(true);this.derived=[];this.wisps=[];this.bodyTexture=null;this.mask=null;this.mouthSprite=null;
 }
 setTexture(texture,tier=0){
  if(this.destroyed||texture===this.bodyTexture)return;
  if(texture===this.sourceTexture&&tier===this.tier){this.view.sprite.texture=this.bodyTexture||texture;return;}
  const fading=this.sourceTexture&&this.last?.phase==='Grow'&&tier!==this.tier;if(this.fade)this.finishFade();
  if(fading){
   const oldLayer=this.layer,oldTextures=this.derived,ghost=new this.PIXI.Container(),body=new this.PIXI.Sprite(this.bodyTexture||this.sourceTexture);
   body.anchor.set(.5);body.scale.set(this.view.baseScale||1);if(this.view.name==='super')ghost.addChild(body,oldLayer);else ghost.addChild(oldLayer,body);
   this.view.motionBody.addChildAt(ghost,0);this.fade={ghost,textures:oldTextures,start:this.last.time||0};
   this.layer=this.makeLayer();this.derived=[];this.wisps=[];this.mask=null;this.mouthSprite=null;
  }else this.clearDerived();
  this.sourceTexture=texture;this.tier=tier;this.width=texture.width;this.height=texture.height;
  const source=this.sourcePixels(texture),{Sprite,Container,Graphics}=this.PIXI;
  if(this.view.name==='super'){
   const pearl=separateApprovedPearl(source,this.width,this.height);
   const whorl=this.textureFromPixels(pearl.pixels,this.width,this.height);this.bodyTexture=null;this.view.sprite.texture=texture;
   this.mask=new Graphics().ellipse(256,55,126,17).fill(0xffffff);this.layer.addChild(this.mask);this.layer.mask=this.mask;
   for(let n=0;n<3;n++){const node=new Container(),sprite=new Sprite(whorl);node.pivot.set(256,55);node.addChild(sprite);this.layer.addChild(node);this.wisps.push({node,sprite,stream:n,copy:0});}
   this.stats={approvedRegion:{x:130,y:38,width:252,height:34},fixedGoldRim:true,...pearl.stats};
  }else{
   const extracted=separateApprovedPlume(source,this.width,this.height,this.view.name,tier);this.stats=extracted.stats;
   this.bodyTexture=this.textureFromPixels(extracted.body,this.width,this.height);this.view.sprite.texture=this.bodyTexture;
   this.mouthSprite=new Sprite(this.textureFromPixels(extracted.mouth,this.width,this.height));this.layer.addChild(this.mouthSprite);
   extracted.parts.forEach((pixels,stream)=>{const part=this.textureFromPixels(pixels,this.width,this.height);for(let copy=0;copy<2;copy++){
    const node=new Container(),sprite=new Sprite(part);node.pivot.set(256,177);node.addChild(sprite);this.layer.addChild(node);this.wisps.push({node,sprite,stream,copy});
   }});
  }
  if(this.mask)this.layer.addChild(this.mask);this.resize(this.view.baseScale||1);this.update(this.last||{time:0,tier,reducedMotion:true});
 }
 resize(scale=this.view.baseScale||1){if(this.destroyed)return;this.scale=scale;this.layer.scale.set(scale);this.layer.position.set(-this.width*scale/2,-this.height*scale/2);}
 update(options={}){
  if(this.destroyed)return;this.last={...options};const time=Number(options.time)||0,still=!!options.reducedMotion,index=['multi','collect','mystery','super'].indexOf(this.view.name);
  const inhale=clamp(Number(options.inhale)||0),exhale=clamp(Number(options.exhale)||0),anticipation=clamp(Number(options.anticipation)||0),grow=clamp(Number(options.grow)||0),energy=clamp(Number(options.energy??options.reaction)||0),intensity=Number(options.intensity??options.tier??this.tier)||0;
  if(this.view.name==='super'){
   this.wisps.forEach(({node},n)=>{const phase=time/(1500+n*170)+index+n*2.1,amplitude=(3.5+intensity*.4)/Math.max(.1,this.scale||1);
    node.position.set(256+(still?0:Math.sin(phase)*amplitude),55+(still?0:Math.cos(phase*.83)*1.5/Math.max(.1,this.scale||1)));
    node.scale.set(still?1:1.075+Math.sin(phase*.7)*.025+exhale*.018);node.rotation=still?0:Math.sin(phase*.54)*.04;node.alpha=still?(n===0?1:0):n===0?.86:.32;
   });
  }else{
   if(this.mouthSprite){this.mouthSprite.position.set(0,still?0:inhale*4-exhale*2);this.mouthSprite.alpha=still?1:.86+inhale*.08;}
   for(const{node,stream,copy}of this.wisps){
    const period=2250+stream*170,p=fract(time/period+index*.173+stream*.283+copy*.5),fade=Math.sin(p*Math.PI)**2,drift=(4.5+intensity*.35)/Math.max(.1,this.scale||1);
    node.position.set(256+(still?0:Math.sin(time/430+index*1.8)*drift+Math.sin(time/1430+stream*2.2)*drift*.16+Math.sin(p*Math.PI*1.6+stream)*drift*.22),
     177+(still?0:-42*(p-.2)+inhale*9+anticipation*3-exhale*10-grow*5));
    node.scale.set(still?1:(.91+.17*p)*(1-inhale*.035+exhale*.04),still?1:.92+.13*p);node.alpha=still?(copy===0?1:0):fade*(1.02+energy*.08);
   }
  }
  if(this.fade){const k=smooth((time-this.fade.start)/210);this.fade.ghost.alpha=1-k;this.layer.alpha=k;this.view.sprite.alpha=k;if(k>=1||still)this.finishFade();}
 }
 finishFade(){if(!this.fade)return;this.disposeLayer(this.fade.ghost,this.fade.textures);this.fade=null;this.layer.alpha=1;this.view.sprite.alpha=1;}
 reset(){this.finishFade();this.update({time:0,tier:this.tier,reducedMotion:true});}
 clear(){this.reset();}
 snapshot(){return{kind:this.kind,tier:this.tier,sourceWidth:this.width,sourceHeight:this.height,stats:this.stats,logicalWisps:this.view.name==='super'?1:3,sprites:this.wisps.length,
  bodyAlphaDerived:!!this.bodyTexture,bodyCropActive:!this.bodyTexture||this.view.sprite.texture===this.bodyTexture,time:this.last?.time||0,reducedMotion:!!this.last?.reducedMotion,crossfade:!!this.fade,
  sample:this.wisps.map(({node,stream,copy})=>({stream,copy,x:round(node.x),y:round(node.y),alpha:round(node.alpha),scaleX:round(node.scale.x),scaleY:round(node.scale.y)}))};}
 destroy(){if(this.destroyed)return;this.finishFade();this.clearDerived();this.layer.destroy({children:true});this.destroyed=true;}
}
