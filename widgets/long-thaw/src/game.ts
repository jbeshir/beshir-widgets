import tundraUrl from './assets/tundra.png';
import tundraMidUrl from './assets/tundra-mid.png';
import iceUrl from './assets/ice-block.png';
import waterUrl from './assets/ice-water.png';
import treeUrl from './assets/tree.png';
import treeTopUrl from './assets/tree-top-snow.png';
import deadTreeUrl from './assets/dead-tree.png';
import snowballUrl from './assets/snowball.png';
import iglooUrl from './assets/igloo.png';
import standUrl from './assets/player-stand.png';
import jumpUrl from './assets/player-jump.png';
import hurtUrl from './assets/player-hurt.png';
import walk1Url from './assets/player-walk-1.png';
import walk2Url from './assets/player-walk-2.png';
import ghost1Url from './assets/ghost-1.png';
import ghost2Url from './assets/ghost-2.png';
import bat1Url from './assets/bat-1.png';
import bat2Url from './assets/bat-2.png';
import emberUrl from './assets/ember.png';
import flameUrl from './assets/flame.png';

type Rect = { x:number; y:number; w:number; h:number; kind?:'snow'|'ice'|'wood' };
type Enemy = { x:number; y:number; min:number; max:number; vx:number; type:'ghost'|'bat'; alive:boolean; phase:number };
type Hearth = { x:number; y:number; lit:boolean; label:string };
type Particle = { x:number; y:number; vx:number; vy:number; life:number; max:number; color:string; size:number };
type Mode = 'title'|'playing'|'paused'|'won';

const W=1280, H=720, WORLD=5940, GROUND=625;
const img = (src:string) => { const i=new Image(); i.src=src; return i; };
const art = {
  tundra:img(tundraUrl), tundraMid:img(tundraMidUrl), ice:img(iceUrl), water:img(waterUrl),
  tree:img(treeUrl), treeTop:img(treeTopUrl), deadTree:img(deadTreeUrl), snowball:img(snowballUrl), igloo:img(iglooUrl),
  stand:img(standUrl), jump:img(jumpUrl), hurt:img(hurtUrl), walk1:img(walk1Url), walk2:img(walk2Url),
  ghost1:img(ghost1Url), ghost2:img(ghost2Url), bat1:img(bat1Url), bat2:img(bat2Url), ember:img(emberUrl),
  flame:img(flameUrl)
};

const platforms:Rect[] = [
  {x:0,y:625,w:730,h:95},{x:800,y:625,w:370,h:95},{x:1240,y:625,w:540,h:95},
  {x:250,y:500,w:210,h:28},{x:520,y:420,w:190,h:28},{x:850,y:505,w:170,h:28},{x:1050,y:390,w:200,h:28},{x:1400,y:470,w:170,h:28},
  {x:1780,y:625,w:510,h:95},{x:2390,y:625,w:360,h:95},{x:2840,y:625,w:420,h:95},{x:3350,y:625,w:370,h:95},
  {x:1900,y:495,w:190,h:28,kind:'ice'},{x:2180,y:405,w:170,h:28,kind:'ice'},{x:2500,y:500,w:170,h:28,kind:'ice'},
  {x:2780,y:410,w:200,h:28,kind:'ice'},{x:3090,y:315,w:190,h:28,kind:'ice'},{x:3390,y:465,w:190,h:28,kind:'ice'},
  {x:3720,y:625,w:430,h:95},{x:4250,y:625,w:330,h:95},{x:4680,y:625,w:1260,h:95},
  {x:3830,y:510,w:180,h:28},{x:4100,y:410,w:160,h:28},{x:4380,y:315,w:175,h:28},{x:4650,y:445,w:190,h:28},
  {x:4920,y:350,w:180,h:28},{x:5180,y:270,w:190,h:28},{x:5460,y:395,w:190,h:28},{x:5700,y:285,w:200,h:28}
];
const hearths:Hearth[]=[
  {x:1540,y:578,lit:false,label:'GROVE'}, {x:3525,y:578,lit:false,label:'ICEWORKS'}, {x:5690,y:238,lit:false,label:'SUMMIT'}
];
const enemies:Enemy[]=[
  {x:930,y:460,min:820,max:1140,vx:55,type:'ghost',alive:true,phase:0},
  {x:2020,y:455,min:1850,max:2250,vx:70,type:'bat',alive:true,phase:1},
  {x:2630,y:565,min:2420,max:2720,vx:65,type:'ghost',alive:true,phase:2},
  {x:3190,y:265,min:3000,max:3420,vx:80,type:'bat',alive:true,phase:3},
  {x:4010,y:455,min:3790,max:4200,vx:75,type:'ghost',alive:true,phase:4},
  {x:4510,y:270,min:4300,max:4700,vx:90,type:'bat',alive:true,phase:5},
  {x:5260,y:225,min:5120,max:5490,vx:70,type:'ghost',alive:true,phase:6}
];
const flakes = Array.from({length:110},(_,i)=>({x:(i*137)%W,y:(i*83)%H,s:1+(i%4),v:12+(i%7)*4,z:.35+(i%3)*.25}));

class Sound {
  ctx?:AudioContext; music=true; next=0; beat=0;
  ensure(){ if(!this.ctx) this.ctx=new AudioContext(); if(this.ctx.state==='suspended') void this.ctx.resume(); }
  tone(freq:number,d=.08,type:OscillatorType='sine',gain=.045){ if(!this.ctx)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),n=this.ctx.currentTime;o.type=type;o.frequency.setValueAtTime(freq,n);g.gain.setValueAtTime(gain,n);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g).connect(this.ctx.destination);o.start(n);o.stop(n+d); }
  tick(t:number){ if(!this.music||!this.ctx||t<this.next)return; const notes=[146.8,220,293.7,246.9,196,293.7,329.6,220]; this.tone(notes[this.beat++%notes.length],1.7,'sine',.018);this.next=t+1.05; }
}

export function mountGame(canvas:HTMLCanvasElement){
  const c=canvas.getContext('2d')!, keys=new Set<string>(), pressed=new Set<string>(), sound=new Sound();
  let mode:Mode='title',last=performance.now(),time=0,camera=0,shake=0,flash=0,section=0,message='',messageFor=0;
  let particles:Particle[]=[], checkpoint={x:100,y:530,lit:0};
  const p={x:110,y:530,w:42,h:74,vx:0,vy:0,ground:false,face:1,hp:3,inv:0,dash:0,dashCd:0,coyote:0,jumpBuf:0};
  const ember={x:p.x+28,y:p.y+28,carried:true,energy:100,pulse:0};
  const reset=(all=true)=>{ p.x=all?110:checkpoint.x;p.y=all?530:checkpoint.y;p.vx=p.vy=0;p.hp=3;p.inv=1;ember.carried=true;ember.energy=100;ember.x=p.x+28;ember.y=p.y+28;if(all){time=0;checkpoint={x:110,y:530,lit:0};hearths.forEach(h=>h.lit=false);enemies.forEach(e=>e.alive=true);section=0;} mode='playing'; };
  const prevent=(e:KeyboardEvent)=>{ const k=e.code;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','KeyA','KeyD','KeyW','KeyE','KeyM','KeyP','KeyR','Escape','Enter'].includes(k)){e.preventDefault();e.stopPropagation();} if(!keys.has(k))pressed.add(k);keys.add(k);if(mode==='title'&&(k==='Enter'||k==='Space')){sound.ensure();reset();}else if(k==='Escape'||k==='KeyP'){mode=mode==='playing'?'paused':mode==='paused'?'playing':mode;}else if(k==='KeyM'){sound.ensure();sound.music=!sound.music;}else if(k==='KeyR'&&mode!=='title')reset();};
  const up=(e:KeyboardEvent)=>{keys.delete(e.code); if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','KeyA','KeyD','KeyW','KeyE'].includes(e.code)){e.preventDefault();e.stopPropagation();}};
  const focus=()=>canvas.focus(); window.addEventListener('keydown',prevent,{capture:true});window.addEventListener('keyup',up,{capture:true});canvas.addEventListener('pointerdown',focus);focus();
  const overlap=(a:{x:number;y:number;w:number;h:number},b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const solids=()=>platforms.concat(hearths.slice(0,2).flatMap((h,i)=>h.lit?[]:[{x:i===0?1745:3690,y:315,w:42,h:310,kind:'ice' as const}]));
  const puff=(x:number,y:number,color:string,n=8)=>{for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*180,vy:-40-Math.random()*150,life:.4+Math.random()*.5,max:1,color,size:3+Math.random()*7});};
  const hurt=()=>{if(p.inv>0)return;p.hp--;p.inv=1.25;p.vy=-420;p.vx=-p.face*260;shake=10;flash=.22;sound.tone(95,.25,'sawtooth',.06);puff(p.x+20,p.y+35,'#bdeeff',14);if(p.hp<=0)reset(false);};
  const physics=(dt:number)=>{
    time+=dt;sound.tick(time);p.inv=Math.max(0,p.inv-dt);p.dash=Math.max(0,p.dash-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.jumpBuf=Math.max(0,p.jumpBuf-dt);p.coyote=Math.max(0,p.coyote-dt);
    const left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
    if(pressed.has('Space')||pressed.has('ArrowUp')||pressed.has('KeyW'))p.jumpBuf=.14;
    if((pressed.has('ShiftLeft')||pressed.has('ShiftRight'))&&p.dashCd<=0){p.dash=.16;p.dashCd=.7;p.vx=p.face*720;p.vy=0;sound.tone(180,.12,'square',.05);puff(p.x+p.w/2,p.y+p.h/2,'#eafcff',10);}
    if(p.jumpBuf>0&&(p.ground||p.coyote>0)){p.vy=-590;p.ground=false;p.coyote=0;p.jumpBuf=0;sound.tone(330,.1,'triangle');}
    if(p.dash<=0){const target=((right?1:0)-(left?1:0))*280;p.vx+=(target-p.vx)*Math.min(1,dt*(p.ground?14:6));p.vy=Math.min(850,p.vy+1550*dt);}if(left)p.face=-1;if(right)p.face=1;
    let nx=p.x+p.vx*dt, box={x:nx,y:p.y,w:p.w,h:p.h};for(const q of solids())if(overlap(box,q)){if(p.vx>0)nx=q.x-p.w;else if(p.vx<0)nx=q.x+q.w;p.vx=0;box.x=nx;}p.x=nx;
    let ny=p.y+p.vy*dt;box={x:p.x,y:ny,w:p.w,h:p.h};const wasGround=p.ground;p.ground=false;for(const q of solids())if(overlap(box,q)){if(p.vy>0&&p.y+p.h<=q.y+16){ny=q.y-p.h;p.vy=0;p.ground=true;}else if(p.vy<0&&p.y>=q.y+q.h-14){ny=q.y+q.h;p.vy=0;}box.y=ny;}p.y=ny;if(wasGround&&!p.ground)p.coyote=.11;
    if(p.y>H+160)reset(false);p.x=Math.max(0,Math.min(WORLD-p.w,p.x));
    if(pressed.has('KeyE')){const d=Math.hypot((p.x+20)-ember.x,(p.y+38)-ember.y);if(ember.carried){ember.carried=false;ember.x=p.x+p.face*45;ember.y=p.y+40;sound.tone(260,.12,'triangle');}else if(d<105){ember.carried=true;sound.tone(520,.16,'triangle');}}
    if(ember.carried){ember.x+=(p.x+p.w/2+p.face*25-ember.x)*Math.min(1,dt*12);ember.y+=(p.y+24-ember.y)*Math.min(1,dt*12);ember.energy=Math.min(100,ember.energy+18*dt);}else{ember.energy=Math.max(0,ember.energy-2.3*dt);}
    const warmth=Math.hypot(p.x+20-ember.x,p.y+35-ember.y)<190;if(!warmth)ember.energy=Math.max(0,ember.energy-9*dt);if(ember.energy<=0){ember.energy=100;hurt();}
    ember.pulse+=dt;
    hearths.forEach((h,i)=>{if(!h.lit&&(i===0||hearths[i-1].lit)&&!ember.carried&&Math.hypot(ember.x-h.x,ember.y-h.y)<100){h.lit=true;checkpoint={x:h.x-80,y:h.y-70,lit:i+1};section=i+1;ember.energy=100;message=i===2?'THE BEACON REMEMBERS':'THE ICE RELEASES ITS HOLD';messageFor=2.6;puff(h.x,h.y,'#ffbd57',36);sound.tone(440,.5,'sine',.06);setTimeout(()=>sound.tone(660,.7,'sine',.05),160);if(i===2)mode='won';}}
    );
    enemies.forEach(e=>{if(!e.alive)return;e.phase+=dt*5;e.x+=e.vx*dt;if(e.x<e.min||e.x>e.max)e.vx*=-1;const ey=e.y+Math.sin(e.phase)*18;if(Math.abs(p.x-e.x)<52&&Math.abs(p.y-ey)<65){if(p.dash>0){e.alive=false;puff(e.x,ey,'#d9f6ff',18);sound.tone(700,.12,'triangle');}else hurt();}});
    particles.forEach(a=>{a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=180*dt;a.life-=dt;});particles=particles.filter(a=>a.life>0);if(Math.random()<dt*18)puff(ember.x,ember.y,'#ffc45b',1);
    messageFor=Math.max(0,messageFor-dt);camera+=(Math.max(0,Math.min(WORLD-W,p.x-W*.38))-camera)*Math.min(1,dt*5);shake=Math.max(0,shake-30*dt);flash=Math.max(0,flash-dt);
  };
  const text=(s:string,x:number,y:number,size=22,align:CanvasTextAlign='left',color='#edfaff')=>{c.font=`700 ${size}px "Nunito Sans"`;c.textAlign=align;c.fillStyle='#03101bbb';c.fillText(s,x+2,y+3);c.fillStyle=color;c.fillText(s,x,y);};
  const drawImage=(im:HTMLImageElement,x:number,y:number,w:number,h:number,flip=false,alpha=1)=>{c.save();c.globalAlpha=alpha;if(flip){c.translate(x+w,y);c.scale(-1,1);c.drawImage(im,0,0,w,h);}else c.drawImage(im,x,y,w,h);c.restore();};
  const drawGlow=(x:number,y:number,r:number,alpha=.4)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,221,120,${alpha})`);g.addColorStop(.35,`rgba(255,163,67,${alpha*.55})`);g.addColorStop(1,'rgba(255,138,47,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
  const background=()=>{
    const grad=c.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#071522');grad.addColorStop(.55,'#17384d');grad.addColorStop(1,'#8eb2bd');c.fillStyle=grad;c.fillRect(0,0,W,H);
    c.fillStyle='#d5edf255';for(let layer=0;layer<3;layer++){c.beginPath();c.moveTo(0,H);for(let x=-100;x<W+150;x+=170){const wx=x+camera*(.06+layer*.05);const y=360+layer*75+Math.sin(wx*.003+layer)*35;c.lineTo(x,y-100-(Math.abs(Math.sin(wx*.0017))*100));c.lineTo(x+120,y);}c.lineTo(W,H);c.fill();}
    c.fillStyle='#e5f7ff';for(const f of flakes){const x=(f.x-time*f.v-camera*f.z*.06+W*4)%W,y=(f.y+time*f.v*1.7)%H;c.globalAlpha=.25+f.z*.35;c.beginPath();c.arc(x,y,f.s,0,7);c.fill();}c.globalAlpha=1;
  };
  const world=()=>{c.save();c.translate(-camera+(Math.random()-.5)*shake,(Math.random()-.5)*shake);
    for(let x=100;x<WORLD;x+=410){const im=x%820===100?art.tree:art.deadTree;drawImage(im,x,GROUND-195,105,195,false,.72);if(x%820===100)drawImage(art.treeTop,x-42,GROUND-260,190,125,false,.8);}
    platforms.forEach(q=>{const tile=q.kind==='ice'?art.ice:art.tundra;for(let x=q.x;x<q.x+q.w;x+=70)drawImage(tile,x,q.y,72,70);if(q.h>40){c.fillStyle='#233e4c';c.fillRect(q.x,q.y+52,q.w,q.h-52);for(let x=q.x;x<q.x+q.w;x+=70)drawImage(art.tundraMid,x,q.y+48,72,72);}});
    hearths.slice(0,2).forEach((h,i)=>{if(h.lit)return;const x=i===0?1745:3690;for(let y=315;y<625;y+=68)drawImage(art.ice,x-15,y,72,72);c.fillStyle='#d9f8ff';c.globalAlpha=.55;c.fillRect(x+7,315,8,310);c.globalAlpha=1;});
    [765,2305,3275,4180].forEach(x=>{for(let y=GROUND+3;y<H;y+=65)drawImage(art.water,x,y,80,65);});
    drawImage(art.igloo,120,GROUND-132,165,135);drawImage(art.snowball,1320,GROUND-76,82,82);
    hearths.forEach((h,i)=>{c.fillStyle=h.lit?'#693b20':'#284657';c.fillRect(h.x-30,h.y+18,60,32);c.strokeStyle=h.lit?'#ffc260':'#8bb0bd';c.lineWidth=5;c.strokeRect(h.x-25,h.y-2,50,30);if(h.lit){drawGlow(h.x,h.y-20,170,.42);drawImage(art.flame,h.x-34,h.y-80,68,90);}text(`${i+1}`,h.x,h.y+43,16,'center',h.lit?'#fff2b0':'#a7c7d0');});
    enemies.forEach(e=>{if(!e.alive)return;const ey=e.y+Math.sin(e.phase)*18,frame=Math.floor(e.phase*2)%2===0;drawImage(e.type==='ghost'?(frame?art.ghost1:art.ghost2):(frame?art.bat1:art.bat2),e.x-34,ey-30,68,62,e.vx<0);});
    const glow=90+Math.sin(ember.pulse*5)*8;drawGlow(ember.x,ember.y,glow,.48);drawImage(art.ember,ember.x-18,ember.y-18,36,36);drawImage(art.flame,ember.x-23,ember.y-50,46,56,false,.9);
    const moving=Math.abs(p.vx)>30&&p.ground,frame=Math.floor(time*10)%2===0;let pim=p.inv>0&&Math.floor(time*12)%2?art.hurt:!p.ground?art.jump:moving?(frame?art.walk1:art.walk2):art.stand;drawImage(pim,p.x-17,p.y-20,76,96,p.face<0,p.inv>0?.55:1);
    if(p.dash>0){c.strokeStyle='#d9f8ff99';c.lineWidth=8;c.beginPath();c.moveTo(p.x-p.face*15,p.y+42);c.lineTo(p.x-p.face*100,p.y+42);c.stroke();}
    particles.forEach(a=>{c.globalAlpha=Math.max(0,a.life/a.max);c.fillStyle=a.color;c.beginPath();c.arc(a.x,a.y,a.size,0,7);c.fill();});c.globalAlpha=1;c.restore();};
  const hud=()=>{c.fillStyle='#05131ddd';c.beginPath();c.roundRect(24,22,330,76,18);c.fill();text('EMBER',45,51,14,'left','#9fc3cf');c.fillStyle='#183545';c.beginPath();c.roundRect(45,63,220,13,7);c.fill();const eg=c.createLinearGradient(45,0,265,0);eg.addColorStop(0,'#ef7047');eg.addColorStop(1,'#ffd77c');c.fillStyle=eg;c.beginPath();c.roundRect(45,63,220*ember.energy/100,13,7);c.fill();for(let i=0;i<3;i++){c.fillStyle=i<p.hp?'#f18a67':'#244150';c.beginPath();c.arc(292+i*20,69,7,0,7);c.fill();}
    c.fillStyle='#05131ddd';c.beginPath();c.roundRect(W-282,22,258,76,18);c.fill();text(['FROZEN GROVE','ICEWORKS','WIND ASCENT','BEACON LIT'][section],W-45,54,15,'right','#bce3ec');text(`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`,W-45,80,21,'right','#fff3c4');
    if(messageFor>0){c.globalAlpha=Math.min(1,messageFor);text(message,W/2,145,24,'center','#ffd884');c.globalAlpha=1;}
  };
  const overlay=()=>{if(mode==='playing')return;c.fillStyle='#03101acb';c.fillRect(0,0,W,H);if(mode==='title'){c.fillStyle='#e9fbff';c.font='700 64px "Cinzel Decorative"';c.textAlign='center';c.fillText('THE LONG THAW',W/2,235);c.fillStyle='#f2bd63';c.fillRect(W/2-180,262,360,3);text('Carry the last living ember to the summit beacon.',W/2,312,22,'center','#c5e4ea');text('MOVE',315,405,14,'center','#81a9b6');text('A D  /  ← →',315,440,22,'center');text('JUMP',530,405,14,'center','#81a9b6');text('SPACE',530,440,22,'center');text('DASH',750,405,14,'center','#81a9b6');text('SHIFT',750,440,22,'center');text('SET / TAKE EMBER',985,405,14,'center','#81a9b6');text('E',985,440,22,'center');text('PRESS ENTER TO BEGIN',W/2,555,22,'center','#ffd884');text('M toggles music  •  P pauses  •  R restarts',W/2,608,15,'center','#8db1bd');}
    if(mode==='paused'){text('PAUSED',W/2,310,48,'center','#edfaff');text('Press P or Escape to return',W/2,365,20,'center','#b8dce4');}
    if(mode==='won'){c.fillStyle='#fff1bf22';c.fillRect(0,0,W,H);c.font='700 54px "Cinzel Decorative"';c.textAlign='center';c.fillStyle='#fff1be';c.fillText('WINTER BREAKS',W/2,260);text('The summit beacon burns again.',W/2,316,23,'center','#d9eff2');text(`Your journey · ${Math.floor(time/60)}m ${Math.floor(time%60)}s`,W/2,374,19,'center','#f6ca77');text('PRESS R TO WALK THE PATH AGAIN',W/2,490,18,'center','#d6ebef');text('Art by Kenney · CC0',W/2,630,14,'center','#7fa2ad');}}
  const render=()=>{background();world();if(mode!=='title')hud();if(flash>0){c.fillStyle=`rgba(220,248,255,${flash})`;c.fillRect(0,0,W,H);}overlay();};
  const frame=(now:number)=>{const dt=Math.min(.033,(now-last)/1000);last=now;if(mode==='playing')physics(dt);render();pressed.clear();requestAnimationFrame(frame);};requestAnimationFrame(frame);
  if(import.meta.env.GAME_TEST_BUILD==='1') (window as unknown as {gameTest?:unknown}).gameTest={snapshot:()=>({mode,x:p.x,y:p.y,hp:p.hp,emberCarried:ember.carried,energy:ember.energy,lit:hearths.filter(h=>h.lit).length,time}),start:()=>reset(),teleport:(x:number,y:number)=>{p.x=x;p.y=y;},light:(i:number)=>{ember.carried=false;ember.x=hearths[i].x;ember.y=hearths[i].y;}};
  return()=>{window.removeEventListener('keydown',prevent,{capture:true});window.removeEventListener('keyup',up,{capture:true});canvas.removeEventListener('pointerdown',focus);};
}
