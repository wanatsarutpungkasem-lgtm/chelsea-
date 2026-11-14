// Original, stylised stadium concept; not an architectural model of Stamford Bridge.
const host=document.querySelector('.portrait-hero');
if(host){
 const caption=document.createElement('div');caption.className='dream-scene-caption';caption.innerHTML='<small>FROM A SCREEN TO A DREAM</small><strong>THE BLUE DREAM</strong>';host.append(caption);
 const controls=document.createElement('div');controls.className='dream-scene-controls';
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='หยุดการเคลื่อนไหว';toggle.setAttribute('aria-pressed','false');controls.append(toggle);host.append(controls);
 const label=host.querySelector('.art-label');label.textContent='สนามจำลองในความฝัน · BLUE AT HEART';
 let renderer,scene,camera,frame=0,visible=true,paused=false,targetX=0,targetY=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const stopped=()=>paused||reduced.matches||document.documentElement.classList.contains('motion-off');
 function render(){frame=0;if(!renderer||document.hidden||!visible)return;camera.position.x+=(targetX-camera.position.x)*.07;camera.position.y+=(3.6+targetY-camera.position.y)*.07;camera.lookAt(0,2,-17);renderer.render(scene,camera);if(!stopped()&&(Math.abs(camera.position.x-targetX)>.002||Math.abs(camera.position.y-3.6-targetY)>.002))frame=requestAnimationFrame(render);}
 function request(){if(!frame)frame=requestAnimationFrame(render);}
 function sync(){toggle.textContent=stopped()?'เปิดการเคลื่อนไหว':'หยุดการเคลื่อนไหว';toggle.setAttribute('aria-pressed',String(stopped()));if(stopped()){targetX=0;targetY=0;}request();}
 toggle.addEventListener('click',()=>{paused=!stopped();if(reduced.matches){toggle.textContent='ลดการเคลื่อนไหวตามการตั้งค่าเครื่อง';return;}sync();});
 try{
  const T=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
  scene=new T.Scene();scene.background=new T.Color('#091629');scene.fog=new T.FogExp2('#12274c',.012);
  camera=new T.PerspectiveCamera(56,1,.1,180);camera.position.set(0,3.6,18);
  renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.25:1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.domElement.className='dream-canvas';renderer.domElement.setAttribute('aria-hidden','true');host.prepend(renderer.domElement);
  scene.add(new T.HemisphereLight(0x9ec6ff,0x07101c,2));const light=new T.DirectionalLight(0xdcecff,3);light.position.set(-12,30,10);scene.add(light);
  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.7,metalness:.15,...extra});
  const navy=mat('#081329'),blue=mat('#193f9d'),pale=mat('#a6c9ff',{emissive:'#668fff',emissiveIntensity:2}),grass=mat('#24584e');
  function box(w,h,d,x,y,z,m){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);scene.add(o);return o;}
  box(52,.2,76,0,-.2,-28,grass);
  const stripe=mat('#326b5e');for(let i=0;i<10;i++)box(52,.012,3.8,0,-.08,-61+i*7.6,stripe);
  const white=new T.LineBasicMaterial({color:'#d5e8e3'});
  function line(points){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));scene.add(new T.Line(g,white));}
  line([[-23,.02,7],[23,.02,7],[23,.02,-61],[-23,.02,-61],[-23,.02,7]]);line([[-23,.02,-27],[23,.02,-27]]);
  const circle=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;circle.push([Math.cos(a)*6,.03,-27+Math.sin(a)*6]);}line(circle);
  for(const z of [7,-61]){const s=z===7?-1:1;line([[-10,.04,z],[-10,.04,z+s*12],[10,.04,z+s*12],[10,.04,z]]);line([[-4,0,z],[-4,3,z],[4,3,z],[4,0,z]]);}
  // Terraced stands and luminous roof edges.
  for(let row=0;row<10;row++){
   const y=.6+row*.7,z=-65-row*1.2;box(70,.6,1.1,0,y,z,row%2?blue:navy);
   for(const side of [-1,1])box(1.1,.6,83,side*(28+row*1.1),y,-26,row%2?blue:navy);
  }
  box(78,.35,2,0,9,-75,navy);box(76,.12,.12,0,8.7,-73.8,pale);
  for(const side of [-1,1]){box(2,.3,89,side*39,9,-27,navy);box(.12,.12,87,side*38,8.7,-27,pale);}
  // A few shared geometries keep the crowd detail inexpensive.
  const seats=new T.InstancedMesh(new T.BoxGeometry(.45,.32,.4),blue,1000);const dummy=new T.Object3D();let k=0;
  for(let row=0;row<10;row++)for(let col=0;col<100;col++){dummy.position.set(-33+col*.66,1+row*.7,-65-row*1.2);dummy.updateMatrix();seats.setMatrixAt(k++,dummy.matrix);}scene.add(seats);
  // Tunnel frames in the foreground establish the walk-out perspective.
  box(14,.2,18,0,-.05,13,navy);
  for(const side of [-1,1]){box(.6,9,19,side*6.5,4.5,13,navy);box(.12,.10,18,side*6.15,1.1,13,pale);}
  box(14,.5,18,0,9,13,navy);
  for(const z of [3,8,12]){for(const s of [-1,1])box(.09,6.8,.12,s*4.3,3.4,z,pale);box(8.6,.09,.12,0,6.8,z,pale);}
  for(const side of [-1,1]){
   box(.25,15,.25,side*23,7.5,-45,navy);
   box(6,.5,.4,side*23,15,-45,pale);
   const glow=new T.Mesh(new T.PlaneGeometry(18,30),new T.MeshBasicMaterial({color:'#79a8ff',transparent:true,opacity:.055,depthWrite:false,side:T.DoubleSide}));
   glow.position.set(side*20,5,-44);glow.rotation.z=side*-.25;scene.add(glow);
  }
  const resize=new ResizeObserver(()=>{const r=host.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);request();});resize.observe(host);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)request();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(host);
  host.addEventListener('pointermove',event=>{if(stopped()||event.pointerType==='touch')return;const r=host.getBoundingClientRect();targetX=((event.clientX-r.left)/r.width-.5)*1.8;targetY=-((event.clientY-r.top)/r.height-.5)*.55;request();});
  host.addEventListener('pointerleave',()=>{targetX=0;targetY=0;request();});
  document.addEventListener('visibilitychange',request);reduced.addEventListener('change',sync);new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.domElement.style.display='none';controls.hidden=true;label.textContent='BLUE AT HEART · ภาพสำรอง';});sync();request();
 }catch{controls.hidden=true;label.textContent='BLUE AT HEART · อ้ายโอห์ม แฟนเชลซี';}
}
