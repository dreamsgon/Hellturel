'use strict';
const AtlasSurvey=(()=>{
  const L=Elturel, {ft,clamp}=L;
  const gridOptions={
    s5:'5 ft squares',s10:'10 ft squares',s25:'25 ft squares',s50:'50 ft squares',s100:'100 ft squares',
    auto:'Scale with zoom',h50:'50 ft hexes',h100:'100 ft hexes',h250:'250 ft hexes',h500:'500 ft hexes',
    off:'No grid'
  };
  function gridSpec(key,extent){
    if(key==='auto')key=extent<44?'s5':extent<111?'s10':extent<240?'s25':extent<455?'h50':extent<840?'h100':extent<1450?'h250':'h500';
    return {key,feet:Number(key.slice(1)),hex:key.startsWith('h')};
  }
  function setup(camera,center,w,h,yaw,mode){
    const angle=mode==='top'?Math.PI/2:Math.atan(Math.sqrt(.5));
    const heading=mode==='iso'?yaw+Math.PI/4:yaw;
    const d=mode==='top'?960:1150;
    camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;
    camera.up.set(-Math.sin(heading)*Math.sin(angle),Math.cos(angle),-Math.cos(heading)*Math.sin(angle));
    camera.position.set(center.x+Math.sin(heading)*d*Math.cos(angle),center.y+d*Math.sin(angle),center.z+Math.cos(heading)*d*Math.cos(angle));
    camera.lookAt(center.x,center.y,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    return camera;
  }
  function project(camera,p,w,h){
    const q=new THREE.Vector3(p.x,p.y,p.z).project(camera);
    return [(q.x+1)*w/2,(1-q.y)*h/2];
  }
  function rayAt(camera,x,y,w,h){
    const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x/w*2-1,1-y/h*2),camera);
    return ray.ray;
  }
  function planeAt(camera,x,y,w,h,level){
    const ray=rayAt(camera,x,y,w,h);
    return ray.at((level-ray.origin.y)/ray.direction.y,new THREE.Vector3());
  }
  function groundAt(camera,x,y,w,h,world) {
    const ray=rayAt(camera,x,y,w,h);
    function sample(t){const p=ray.at(t,new THREE.Vector3());return p}
    const top=(120-ray.origin.y)/ray.direction.y,bottom=(-185-ray.origin.y)/ray.direction.y;
    function floor(p){const f=L.fluid(p.x,p.z);return Math.max(L.terrain(p.x,p.z),world.bridgeSurface(p.x,p.z),f?.y??-Infinity)}
    let prev=Math.max(top,0);
    for(let t=prev;t<=bottom+2;t+=2){
      const p=sample(t);
      if(p.y<floor(p)){
        let low=prev,high=t;
        for(let i=0;i<13;i++){const mid=(low+high)/2,q=sample(mid);if(q.y>floor(q))low=mid;else high=mid}
        return sample((low+high)/2);
      }
      prev=t;
    }
    return planeAt(camera,x,y,w,h,8);
  }
  function line(ctx,a,b){ctx.moveTo(...a);ctx.lineTo(...b)}
  function grid(ctx,camera,w,h,mode,yaw,level,style,extent,u=1,align=null){
    const spec=gridSpec(style,extent);
    if(!spec.feet)return false;
    const m=spec.feet*ft;
    const a=align?.angle??0,c=Math.cos(a),s=Math.sin(a),ox=align?.x??0,oz=align?.z??0;
    function world(x,z){return {x:ox+c*x+s*z,y:level,z:oz-s*x+c*z}}
    function local(p){const x=p.x-ox,z=p.z-oz;return [c*x-s*z,s*x+c*z]}
    const corners=[[0,0],[w,0],[w,h],[0,h]].map(q=>local(planeAt(camera,...q,w,h,level)));
    const lowX=Math.min(...corners.map(p=>p[0])), highX=Math.max(...corners.map(p=>p[0]));
    const lowZ=Math.min(...corners.map(p=>p[1])), highZ=Math.max(...corners.map(p=>p[1]));
    if(m*w/(camera.right-camera.left)<4*u||Math.max(highX-lowX,highZ-lowZ)/m>620)return true;
    ctx.save();ctx.beginPath();ctx.strokeStyle='rgba(236,212,179,.33)';ctx.lineWidth=.74*u;
    const proj=(x,z)=>project(camera,world(x,z),w,h);
    if(spec.hex){
      const r=m/Math.sqrt(3),dz=r*1.5;
      const offsets=Array.from({length:6},(_,i)=>[r*Math.cos(Math.PI/6+i*Math.PI/3),r*Math.sin(Math.PI/6+i*Math.PI/3)]);
      for(let row=Math.floor(lowZ/dz)-1;row<=Math.ceil(highZ/dz)+1;row++){
        for(let col=Math.floor(lowX/m)-1;col<=Math.ceil(highX/m)+1;col++){
          const x=(col+(row%2? .5:0))*m,z=row*dz;
          for(let i=0;i<3;i++)line(ctx,proj(x+offsets[i][0],z+offsets[i][1]),proj(x+offsets[i+1][0],z+offsets[i+1][1]));
        }
      }
    }else{
      for(let x=Math.floor(lowX/m)*m;x<=highX+m;x+=m)line(ctx,proj(x,lowZ-m),proj(x,highZ+m));
      for(let z=Math.floor(lowZ/m)*m;z<=highZ+m;z+=m)line(ctx,proj(lowX-m,z),proj(highX+m,z));
    }
    ctx.stroke();ctx.restore();return false;
  }
  function marks(ctx,camera,w,h,center,ruler=[],unit=1,margin=83,nav=true,north=0){
    const proj=p=>project(camera,p,w,h);
    function stroke(a,b,c,width){ctx.strokeStyle=c;ctx.lineWidth=width*unit;ctx.beginPath();line(ctx,a,b);ctx.stroke()}
    function label(s,x,y,weight='600'){
      ctx.font=weight+' '+Math.round(12*unit)+'px system-ui';
      ctx.lineWidth=3.2*unit;ctx.strokeStyle='#241615';ctx.strokeText(s,x,y);ctx.fillStyle='#ffe3b9';ctx.fillText(s,x,y);
    }
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    if(nav){
      const mpp=(camera.right-camera.left)/w;
      const desire=116*unit*mpp/ft,base=10**Math.floor(Math.log10(desire));
      const feet=([5,2,1].find(n=>n*base<=desire)||1)*base;
      const len=feet*ft/mpp,x=23*unit,y=h-margin*unit;
      for(const [c,width] of [['#291813',4],['#f0ca91',1.75]]){
        stroke([x,y],[x+len,y],c,width);
        for(const a of [x,x+len])stroke([a,y-4*unit],[a,y+4*unit],c,width);
      }
      label(feet.toLocaleString()+' ft',x,y-9*unit);
      const a=proj(center),b=proj({x:center.x+Math.sin(north),y:center.y,z:center.z-Math.cos(north)});
      const dir=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const u=[w-42*unit,h-(margin+14)*unit],v=[u[0]+Math.cos(dir)*21*unit,u[1]+Math.sin(dir)*21*unit];
      stroke(u,v,'#291813',5);stroke(u,v,'#f0ca91',1.9);
      for(const q of [-.63,.63])stroke(v,[v[0]-Math.cos(dir+q)*8*unit,v[1]-Math.sin(dir+q)*8*unit],'#f0ca91',1.9);
      label('N',v[0]+(Math.cos(dir)*10-3)*unit,v[1]+(Math.sin(dir)*12+4)*unit);
    }
    if(ruler.length){
      const pts=ruler.map(proj);
      if(pts.length===2){
        const [a,b]=pts,dx=ruler[1].x-ruler[0].x,dz=ruler[1].z-ruler[0].z;
        const bearing=(Math.round(Math.atan2(dx,-dz)*180/Math.PI)+360)%360;
        stroke(a,b,'#2c1714',5);stroke(a,b,'#ffce92',2.15);
        const climb=(ruler[1].y-ruler[0].y)/ft;
        label((Math.hypot(dx,dz)/ft).toFixed(1)+' ft   '+String(bearing).padStart(3,'0')+'°   '+(climb>=0?'↑ ':'↓ ')+Math.abs(climb).toFixed(1)+' ft',
          clamp((a[0]+b[0])/2+5*unit,8*unit,w-126*unit),clamp((a[1]+b[1])/2-11*unit,13*unit,h-12*unit));
      }
      for(const [x,y] of pts){ctx.beginPath();ctx.arc(x,y,4*unit,0,Math.PI*2);ctx.fillStyle='#ffd49c';ctx.fill();ctx.strokeStyle='#211614';ctx.lineWidth=1.5*unit;ctx.stroke()}
    }
    ctx.restore();
  }
  function mapLayer(world){
    const can=document.createElement('canvas');can.width=1680;can.height=1190;
    const ctx=can.getContext('2d'),scale=1.4;
    ctx.translate(can.width/2,can.height/2);ctx.scale(scale,scale);
    const points=(a,close=false)=>{
      ctx.beginPath();a.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(close)ctx.closePath();
    };
    ctx.fillStyle='#211b1e';ctx.fillRect(-600,-425,1200,850);
    points(L.river);ctx.lineWidth=245;ctx.strokeStyle='#383239';ctx.stroke();
    points(L.outline,true);ctx.lineWidth=2;ctx.strokeStyle='#a46b56';ctx.fillStyle='#61504a';ctx.fill();ctx.stroke();
    ctx.save();ctx.clip();
    const normal=ctx.getImageData(0,0,can.width,can.height),arr=normal.data;
    const cols=Math.ceil(can.width/3),levels=new Float32Array(cols*Math.ceil(can.height/3)).fill(NaN);
    for(let y=0;y<can.height;y+=3)for(let x=0;x<can.width;x+=3){
      const xx=(x-can.width/2)/scale,zz=(y-can.height/2)/scale;
      if(!L.inside(xx,zz,L.outline))continue;
      const h=L.terrain(xx,zz),n=Math.sin(xx*.161+zz*.22)*2.5+Math.sin(zz*.66-xx*.537)*1.9;
      if(h>-20)levels[(y/3)*cols+x/3]=(h+152.4)/(25*ft);
      const altitude=clamp(h/2,-19,25)+n;
      for(let oy=0;oy<3&&y+oy<can.height;oy++)for(let ox=0;ox<3&&x+ox<can.width;ox++){
        const k=((y+oy)*can.width+x+ox)*4;
        arr[k]=clamp(94+altitude,0,255);arr[k+1]=clamp(75+altitude,0,255);arr[k+2]=clamp(69+altitude*.8,0,255);
      }
    }
    ctx.putImageData(normal,0,0);
    ctx.lineCap='round';ctx.lineJoin='round';
    points(L.gorge);ctx.lineWidth=58;ctx.strokeStyle='#292025';ctx.stroke();
    points(L.gorge);ctx.lineWidth=30;ctx.strokeStyle='#381e24';ctx.stroke();
    for(const r of L.roads){
      ctx.beginPath();
      for(let i=1;i<r.path.length;i++){
        const a=r.path[i-1],b=r.path[i];
        if(!L.valid(...a,-5)||!L.valid(...b,-5))continue;
        ctx.moveTo(...a);ctx.lineTo(...b);
      }
      ctx.lineWidth=r.w;ctx.strokeStyle=r.climb?'#aaa080':'#928075';ctx.stroke();
    }
    for(const [p,w] of [[L.canal,24],[L.garden,7]]){
      points(p);ctx.lineWidth=w;ctx.strokeStyle='#8c392e';ctx.stroke();ctx.lineWidth=w*.44;ctx.strokeStyle='#cb714b';ctx.stroke();
    }
    for(const b of L.bridges){
      points([[b.x1,b.z1],[b.x2,b.z2]]);
      ctx.lineWidth=b.w+3;ctx.strokeStyle='#472f2c';ctx.stroke();
      ctx.lineWidth=b.w;ctx.strokeStyle='#c2a384';ctx.stroke();
    }
    ctx.fillStyle='#65616b';ctx.beginPath();ctx.arc(L.pond.x,L.pond.z,L.pond.r,0,Math.PI*2);ctx.fill();
    for(const o of world.worldObjects){
      ctx.save();ctx.translate(o.x,o.z);ctx.rotate(-o.angle);
      ctx.fillStyle=o.burnt?'#514348':o.style%4===1?'#a87564':o.style===5?'#978d87':'#797080';
      ctx.strokeStyle='#3e3333';ctx.lineWidth=1.15;ctx.fillRect(-o.w/2,-o.d/2,o.w,o.d);ctx.strokeRect(-o.w/2,-o.d/2,o.w,o.d);
      ctx.strokeStyle='rgba(231,205,187,.28)';ctx.lineWidth=.7;ctx.beginPath();line(ctx,[-o.w/2,0],[o.w/2,0]);ctx.stroke();ctx.restore();
    }
    points(L.wallLine.map(([x,z])=>[x*.947,z*.926]));ctx.lineWidth=3.2;ctx.strokeStyle='#bf9b83';ctx.stroke();
    ctx.restore();
    const contours=document.createElement('canvas');contours.width=can.width;contours.height=can.height;
    const lines=contours.getContext('2d');lines.strokeStyle='#fee6aca8';lines.lineWidth=1.5;lines.beginPath();
    for(let y=0;y+3<can.height;y+=3)for(let x=0;x+3<can.width;x+=3){
      const i=(y/3)*cols+x/3,a=levels[i],b=levels[i+1],c=levels[i+cols+1],d=levels[i+cols];
      const level=Math.ceil(Math.min(a,b,c,d));
      if(!(level<=Math.max(a,b,c,d)))continue;
      const hits=[];
      if((a<level)!==(b<level))hits.push([x+3*(level-a)/(b-a),y]);
      if((b<level)!==(c<level))hits.push([x+3,y+3*(level-b)/(c-b)]);
      if((c<level)!==(d<level))hits.push([x+3*(level-d)/(c-d),y+3]);
      if((d<level)!==(a<level))hits.push([x,y+3*(level-a)/(d-a)]);
      for(let j=1;j<hits.length;j+=2){lines.moveTo(...hits[j-1]);lines.lineTo(...hits[j])}
    }
    lines.stroke();return {base:can,contours};
  }
  return {gridOptions,gridSpec,setup,project,planeAt,groundAt,grid,marks,mapLayer};
})();
