import React,{useState,useEffect,useRef,useMemo,Component,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {useFrame,useThree,useLoader} from '@react-three/fiber';
import {TextureLoader,SRGBColorSpace,Color,Shape,ExtrudeGeometry} from 'three';
import {ShaderGradientCanvas} from '@shadergradient/react';
const crestUrl=new URL('../images/chelsea-crest.png',import.meta.url).href;
const glassUrl=new URL('../images/ohm-cracked-glass.png',import.meta.url).href;
const palettes={blue:['#041339','#164cff','#70baff'],violet:['#0b1234','#694bff','#b7d4ff'],gold:['#081b46','#3167bf','#d4ed99']};
function FramePolicy({paused}){const set=useThree(s=>s.setFrameloop),invalidate=useThree(s=>s.invalidate);useEffect(()=>{set(paused?'demand':'always');invalidate()},[paused,set,invalidate]);return null}
// A close-fitting beveled glass shield; the crest is part of its surface material.
function createGlassShield(){
 const shape=new Shape();
 shape.moveTo(0,1.08);
 shape.bezierCurveTo(.42,1.08,.83,1.03,1.02,.86);
 shape.bezierCurveTo(1.12,.55,1.10,.04,.95,-.41);
 shape.bezierCurveTo(.77,-.83,.40,-1.04,0,-1.19);
 shape.bezierCurveTo(-.40,-1.04,-.77,-.83,-.95,-.41);
 shape.bezierCurveTo(-1.10,.04,-1.12,.55,-1.02,.86);
 shape.bezierCurveTo(-.83,1.03,-.42,1.08,0,1.08);
 const geometry=new ExtrudeGeometry(shape,{depth:.028,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.014,bevelThickness:.010,curveSegments:64});
 geometry.translate(0,.025,-.014);return geometry;
}
const surfaceVertex=`
 varying vec3 vSurface;
 varying vec3 vNormalView;
 varying vec3 vLocalNormal;
 void main(){
   vSurface=position;
   vLocalNormal=normal;
   vNormalView=normalize(normalMatrix*normal);
   gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
 }
`;
const surfaceFragment=`
 uniform sampler2D uCrest;
 uniform sampler2D uGlass;
 uniform vec3 uColor1,uColor2,uColor3;
 uniform float uTime;
 varying vec3 vSurface;
 varying vec3 vNormalView;
 varying vec3 vLocalNormal;
 void main(){
   vec3 n=normalize(vNormalView);
   float rim=pow(1.0-abs(n.z),2.0);
   float edge=1.0-smoothstep(.55,.98,abs(vLocalNormal.z));
   float flow=.5+.5*sin(vSurface.x*1.8+vSurface.y*1.4);
   vec3 glass=mix(uColor1,uColor2,flow)*.48;
   glass=mix(glass,uColor3,.2+rim*.5);
   float streak=pow(.5+.5*sin(vSurface.x*2.6+vSurface.y*1.7+uTime*.14),18.0);
   glass+=vec3(.35,.52,.75)*streak*.35;
   glass+=uColor3*(rim*.8+edge*.35);
   // User-supplied glass photo stays attached to the shield in object space.
   // Cover the shield without stretching the portrait image.
   vec2 glassUV=vec2(vSurface.x/2.25+.5,(vSurface.y+.03)/2.4*.80+.5);
   vec3 cracked=texture2D(uGlass,clamp(glassUV,0.0,1.0)).rgb;
   glass=mix(cracked,glass,.12)+uColor3*(edge*.28+rim*.12);
   // The PNG has transparent padding: its gold border fits a .94-unit radius.
   vec2 badgeUV=vec2(vSurface.x*(vLocalNormal.z<0.0?-1.0:1.0),vSurface.y)*(.425/.94)+.5;
   vec4 badge=texture2D(uCrest,clamp(badgeUV,0.0,1.0));
   float circle=1.0-smoothstep(.423,.426,length(badgeUV-.5));
   float face=smoothstep(.8,.99,abs(vLocalNormal.z));
   float mask=badge.a*circle*face;
   float sheen=pow(max(dot(n,normalize(vec3(-.4,.65,1.0))),0.0),28.0);
   vec3 ink=badge.rgb*(.94+.06*max(n.z,0.0));
   vec3 color=mix(glass,ink,mask)+vec3(sheen*.09);
   float alpha=mix(.90+edge*.1,1.0,mask);
   gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
 }
`;
function SceneCamera(){const camera=useThree(s=>s.camera);useEffect(()=>{camera.position.set(0,0,3.6);camera.lookAt(0,0,0);camera.updateProjectionMatrix()},[camera]);return null}
function ChelseaSurface({paused,colors,rotation,revision,pose}){
 const mesh=useRef(),clock=useRef(0);
 const geometry=useMemo(createGlassShield,[]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const [texture,glassTexture]=useLoader(TextureLoader,[crestUrl,glassUrl]);
 texture.colorSpace=SRGBColorSpace;
 glassTexture.colorSpace=SRGBColorSpace;
 const invalidate=useThree(s=>s.invalidate);
 const uniforms=useMemo(()=>({uTime:{value:0},uCrest:{value:texture},uGlass:{value:glassTexture},uColor1:{value:new Color(colors[0])},uColor2:{value:new Color(colors[1])},uColor3:{value:new Color(colors[2])}}),[texture,glassTexture]);
 useEffect(()=>{colors.forEach((color,i)=>uniforms['uColor'+(i+1)].value.set(color));invalidate()},[colors,uniforms,invalidate]);
 useEffect(()=>{if(mesh.current){mesh.current.rotation.set(0,rotation*Math.PI/180,0);pose.current=rotation;invalidate()}},[rotation,revision,pose,invalidate]);
 useFrame((_,dt)=>{
   if(paused||!mesh.current)return;
   clock.current+=Math.min(dt,.05);
   uniforms.uTime.value=clock.current;
   mesh.current.rotation.y+=Math.min(dt,.05)*.22;
   pose.current=mesh.current.rotation.y*180/Math.PI;
 });
 return <mesh ref={mesh} geometry={geometry}>
  <shaderMaterial uniforms={uniforms} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} transparent/>
 </mesh>
}
class Boundary extends Component{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<div className="energy-fallback"><img src={crestUrl} alt="ตราสโมสรเชลซี"/>BLUE AT HEART.<span>แสดงภาพนิ่งแทนฉาก 3D · อุปกรณ์นี้เปิดฉากไม่ได้</span></div>:this.props.children}}
function Experience(){
 const [rotation,setRotation]=useState(0),[revision,setRevision]=useState(0);
 const pose=useRef(0),drag=useRef(null);
 const turn=degrees=>{setPaused(true);setRotation(degrees>=-180&&degrees<=180?degrees:((degrees+180)%360+360)%360-180);setRevision(n=>n+1)};
 const down=e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,start:pose.current,active:false}};
 const move=e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.active){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag.current=null;return}if(Math.abs(dx)<8)return;d.active=true;e.currentTarget.setPointerCapture(e.pointerId)}turn(d.start+dx*.65)};
 const end=e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)};
 const [theme,setTheme]=useState('blue'),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false),[visible,setVisible]=useState(true),[documentVisible,setDocumentVisible]=useState(!document.hidden);const container=useRef();useEffect(()=>{const media=matchMedia('(prefers-reduced-motion:reduce)');const sync=()=>setReduced(media.matches||document.documentElement.classList.contains('motion-off'));sync();media.addEventListener('change',sync);const mo=new MutationObserver(sync);mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});const io=new IntersectionObserver(([e])=>setVisible(e.isIntersecting));io.observe(container.current);const vis=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',vis);return()=>{mo.disconnect();io.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',vis)}},[]);const stopped=paused||reduced||!visible||!documentVisible;const colors=palettes[theme];return <div ref={container} className="energy-experience"><div className="energy-scene" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} role="img" aria-label="ตราสโมสรเชลซีบนกรอบกระจกแตกร้าวจากภาพที่โอห์มเลือก ลากซ้ายขวาหรือใช้แถบเลื่อนด้านล่างเพื่อหมุนดูได้ครบ 360 องศา"><Boundary><ShaderGradientCanvas style={{position:'absolute',inset:0}} pixelDensity={1} fov={45}  frameloop={stopped?'demand':'always'}><SceneCamera/><Suspense fallback={null}><ChelseaSurface paused={stopped} colors={colors} rotation={rotation} revision={revision} pose={pose}/></Suspense><FramePolicy paused={stopped}/></ShaderGradientCanvas></Boundary><div className="energy-coordinate" aria-hidden="true">OHM / THE BLUE COLLECTION<br/>DRAG TO EXPLORE — 360°</div><span className="energy-drag-hint">ลากซ้าย–ขวาเพื่อหมุนดู 360°</span></div><div className="energy-rotation"><label htmlFor="energy-angle">หมุนดูรอบชิ้นงาน <output>{paused||reduced?Math.round(rotation)+'°':'หมุนอัตโนมัติ'}</output></label><input id="energy-angle" type="range" min="-180" max="180" step="1" value={rotation} onChange={e=>turn(Number(e.target.value))}/><button type="button" onClick={()=>turn(0)}>กลับมุมหน้า ↺</button></div><div className="energy-controls"><div role="group" aria-label="บรรยากาศของฉาก">{[['blue','น้ำเงิน'],['violet','ม่วง'],['gold','แสงแชมป์']].map(([id,label])=><button key={id} type="button" aria-pressed={theme===id} onClick={()=>setTheme(id)}>{label}</button>)}</div><button type="button" disabled={reduced} aria-pressed={stopped} onClick={()=>setPaused(!paused)}>{reduced?'ลดการเคลื่อนไหวตามอุปกรณ์':paused?'เล่นเอฟเฟกต์':'หยุดเอฟเฟกต์'}</button></div><p className="energy-caption" role="status">{theme==='blue'?'สีน้ำเงินที่อยู่ในใจ':theme==='violet'?'อีกมุมของโลกสีน้ำเงิน':'แสงของความทรงจำในวันแชมป์'} · เปลี่ยนสีได้ด้วยปุ่มด้านบน</p></div>}
const host=document.getElementById('blue-energy-root');if(host)createRoot(host).render(<Boundary><Experience/></Boundary>);
