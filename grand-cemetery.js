'use strict';
window.GrandCemetery=(()=>{
  const levels={chapel:0,ossuary:-7.4},levelAt=y=>y> -2.1?0:-7.4;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const landing={x:-18.154,z:1.494};
  function inside(points,x,z){
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,az]=points[j],[bx,bz]=points[i],dx=bx-ax,dz=bz-az;
      const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);
      if(Math.hypot(x-ax-t*dx,z-az-t*dz)<.003)return true;
      if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)hit=!hit;
    }
    return hit;
  }
  function build(){
    const scene=new THREE.Scene(),floors=[],solids=[],lights=[],sightLights=[];
    scene.background=new THREE.Color(0x221a21);scene.fog=new THREE.FogExp2(0x231b26,.014);
    const mats={},geos=new Set(),textures=new Set(),stacks=new Map(),groups=[],sources=[];
    const G=g=>{geos.add(g);return g};
    const cube=G(new THREE.BoxGeometry(1,1,1)),shaft=G(new THREE.CylinderGeometry(1,1,1,28));
    let seed=93603;
    const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    // Mortar joints, bedding planes and tool marks are drawn in physical units.
    function surface(kind){
      const c=document.createElement('canvas');c.width=c.height=512;
      const a=c.getContext('2d'),wood=kind==='wood',marble=kind==='marble';
      const cols=wood?4:kind==='floor'?3:4,rows=wood?1:kind==='floor'?4:8;
      a.fillStyle=wood?'#42362e':'#756f68';a.fillRect(0,0,512,512);
      for(let j=0;j<rows;j++)for(let i=-1;i<cols;i++){
        const w=512/cols,h=512/rows,x=(i+(j%2)*.5)*w,y=j*h;
        const v=(wood?79:marble?174:kind==='floor'?133:153)+rng()*20;
        const color=(d)=>'rgb('+[v+d+7,v+d-(wood?15:0),v+d-(wood?29:6)].join(',')+')';
        a.fillStyle=color(-17);a.fillRect(x+1,y+1,w-2,h-2);
        a.fillStyle=color(0);a.fillRect(x+3,y+2,w-5,h-5);
        for(let k=0;k<130;k++){
          const xx=x+3+rng()*(w-7),yy=y+3+rng()*(h-8);
          a.fillStyle=rng()<.45?'#fcf3dc23':'#30261a1c';a.fillRect(xx,yy,wood?.6:1+rng()*3,wood?10+rng()*53:.7+rng()*2);
        }
      }
      const img=a.getImageData(0,0,512,512);
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){
        const i=(y*512+x)*4,grain=(rng()-.5)*11+3*Math.sin(.04*x+.062*y);
        const vein=marble?8*Math.exp(-Math.pow(6*Math.sin(x*.024+y*.037+Math.sin(y*.045)),2)):0;
        for(let k=0;k<3;k++)img.data[i+k]+=grain-vein;
      }
      a.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
      t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;textures.add(t);return t;
    }
    const maps=Object.fromEntries(['stone','floor','marble','wood'].map(k=>[k,surface(k)]));
    const tones={stone:[0xc8b8a8,'stone'],trim:[0xe4d9c7,'marble'],floor:[0xb8aa9d,'floor'],wood:[0xc29d79,'wood'],
      iron:[0x635f60],gold:[0xbf9758],bone:[0xcfbe9e,'marble'],slate:[0x766e76,'floor'],marble:[0xe4daca,'marble'],
      glass:[0x9f769e],cloth:[0x794a64],rubble:[0xa59a92,'stone']};
    for(const [name,[color,k]] of Object.entries(tones)){
      const m=new THREE.MeshStandardMaterial({color,map:maps[k]||null,roughness:name==='glass'?.29:name==='marble'?.58:.86,metalness:['gold','iron'].includes(name)?.44:.02,side:THREE.DoubleSide});
      if(k){
        m.bumpMap=maps[k];m.bumpScale=.026;
        m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
          #ifdef USE_INSTANCING
          vec3 dims=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
          vec2 size=abs(normal.y)>.65?dims.xz:abs(normal.x)>.65?dims.zy:dims.xy;
          vMapUv=uv*size/2.4;vBumpMapUv=vMapUv;
          #endif`)};
      }
      mats[name]=m;
    }
    function layer(id,kind){
      const g=new THREE.Group();g.userData={id,kind};groups.push(g);scene.add(g);return g;
    }
    const transform=new THREE.Object3D(),painted=new Map();
    function builder(ox,oz,id){
      const main=layer(id,'main'),walls=layer(id,'walls'),cut=layer(id,'cut'),roof=layer(id,'roof');
      function stamp(group,mat,shape,x,y,z,w,h,d,angle=0){
        const material=mats[mat]||mats.stone,key=group.id+'/'+material.id+'/'+shape.id;
        if(!stacks.has(key))stacks.set(key,{group,material,shape,matrices:[]});
        transform.position.set(x+ox,y,z+oz);transform.scale.set(w,h,d);transform.rotation.set(0,angle,0);
        transform.updateMatrix();stacks.get(key).matrices.push(transform.matrix.clone());
      }
      function collider(x,y,z,w,h,d,ry,r){solids.push({x:x+ox,y,z:z+oz,w,h,d,ry,r})}
      function box(mat,x,y,z,w,h,d,ry=0,solid=false){
        stamp(main,mat,cube,x,y,z,w,h,d,ry);if(solid)collider(x,y-h/2,z,w,h,d,ry);
      }
      function column(mat,x,y,z,r,h,solid=true){
        stamp(main,mat,shaft,x,y+h/2,z,r,h,r);if(solid)collider(x,y,z,2*r,h,2*r,0,r);
      }
      function sheet(points,getY,group,mat,holes=[]){
        if(points.length<3)return;
        const rings=[points,...holes].map(r=>r.map(([x,z])=>new THREE.Vector2(x,z)));
        const idx=THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)).flat(),p=[],uv=[];
        for(const {x,y:z} of rings.flat()){p.push(x+ox,getY(x,z),z+oz);uv.push(x/2.4,z/2.4)}
        const geom=G(new THREE.BufferGeometry());geom.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
        geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.setIndex(idx.reverse());geom.computeVertexNormals();
        group.add(new THREE.Mesh(geom,mat));
      }
      function floor(label,points,y,ceilingHeight=3.3,mat='floor',holes=[]){
        const height=typeof y==='function'?y:()=>y;
        const poly=points.map(([x,z])=>[x+ox,z+oz]);
        floors.push({label,polygon:poly,holes:holes.map(r=>r.map(([x,z])=>[x+ox,z+oz])),id,y:(x,z)=>height(x-ox,z-oz),xmin:Math.min(...poly.map(p=>p[0])),xmax:Math.max(...poly.map(p=>p[0])),
          zmin:Math.min(...poly.map(p=>p[1])),zmax:Math.max(...poly.map(p=>p[1]))});
        sheet(points,height,main,mats[mat]||mats.floor,holes);
        if(ceilingHeight>0)sheet(points,(x,z)=>height(x,z)+ceilingHeight,roof,mats.stone,holes);
      }
      function ceiling(points,height){
        sheet(points,height,roof,mats.stone);
      }
      function wall(x1,z1,x2,z2,y,h,th=.28,mat='stone'){
        const x=(x1+x2)/2,z=(z1+z2)/2,w=Math.hypot(x2-x1,z2-z1),ry=Math.atan2(z1-z2,x2-x1);
        if(w<.005)return;
        stamp(walls,mat,cube,x,y+h/2,z,w,h,th,ry);collider(x,y,z,w,h,th,ry);
        if(h>1.4)stamp(cut,mat,cube,x,y+.105,z,w,.21,th,ry);
      }
      function stairs(label,x1,z1,y1,x2,z2,y2,w){
        const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),px=-dz*w/(2*len),pz=dx*w/(2*len);
        const count=Math.max(1,Math.ceil(Math.abs(y2-y1)/.17));
        for(let i=0;i<count;i++){
          const a=i/count,c=(i+1)/count,ax=x1+a*dx,az=z1+a*dz,bx=x1+c*dx,bz=z1+c*dz;
          const h=y1+(y2-y1)*(a+c)/2;
          floor(i?'':label,[[ax+px,az+pz],[bx+px,bz+pz],[bx-px,bz-pz],[ax-px,az-pz]],h,0,'slate');
          stamp(main,'trim',cube,(ax+bx)/2,h-.095,(az+bz)/2,w,.18,len/count,Math.atan2(dx,dz));
        }
      }
      function arch(x,z,y,w,h,ry=0){
        const rise=Math.min(h*.52,w*.5),spring=h-rise,th=clamp(w*.08,.15,.36);
        for(const sign of [-1,1]){
          const off=(w/2+th/2)*sign;column('trim',x+Math.cos(ry)*off,y,z-Math.sin(ry)*off,th*.66,spring,false);
        }
        const shape=new THREE.Shape();
        const trace=(outer,reverse)=>{for(let i=0;i<=36;i++){const a=(reverse?36-i:i)*Math.PI/36;
          const xx=(w/2+outer)*Math.cos(a),yy=spring+(rise+outer)*Math.sin(a);
          if(i===0&&!reverse)shape.moveTo(xx,yy);else shape.lineTo(xx,yy)}};
        trace(th,false);trace(0,true);shape.closePath();
        const geo=G(new THREE.ExtrudeGeometry(shape,{depth:th,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2}));
        const mesh=new THREE.Mesh(geo,mats.trim);mesh.position.set(x+ox,y,z+oz);mesh.rotation.y=ry;walls.add(mesh);
      }
      function art(kind,x,y,z,w,h,ry=0,rx=0){
        if(!painted.has(kind)){
          const map=new THREE.TextureLoader().load((window.CemeteryPictures||{})[kind]||window.RosePicture.rose);
          map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;textures.add(map);
          const glass=['lathander','rose','torm'].includes(kind);
          painted.set(kind,new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:0xffffff,emissiveIntensity:glass?.53:.13,roughness:glass?.34:.9,side:THREE.DoubleSide}));
        }
        const m=new THREE.Mesh(G(new THREE.PlaneGeometry(w,h)),painted.get(kind));m.rotation.order='YXZ';m.rotation.set(rx,ry,0);
        m.position.set(x+ox,y,z+oz);main.add(m);
      }
      function lamp(x,y,z,color,power=18,reach=12){sources.push({id,x:x+ox,y,z:z+oz,color,power,reach})}
      function pool(points,y){sheet(points,()=>y,main,mats.glass)}
      function portal(x,y,z,w,h,ry){
        const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{clock:{value:0}},
          vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader:'varying vec2 p;uniform float clock;void main(){float r=length(p);float k=sin(atan(p.y,p.x)*6.+r*12.-clock*.42);float e=exp(-abs(r-.73-.035*k)*13.);gl_FragColor=vec4(.23+.31*e,.06+.16*e,.32+.48*e,.65*e+.14*(1.-smoothstep(.2,.9,r)));}'});
        mats.portal=m;const mesh=new THREE.Mesh(G(new THREE.PlaneGeometry(w,h)),m);mesh.position.set(x+ox,y,z+oz);mesh.rotation.y=ry||0;
        mesh.onBeforeRender=()=>{m.uniforms.clock.value=performance.now()*.001};main.add(mesh);
      }
      return {D:Object.fromEntries(Object.keys(mats).map(k=>[k,k])),floor,ceiling,wall,box,column,stairs,arch,art,lamp,pool,portal};
    }
    CemeteryChapel(builder(0,0,0));CemeteryOssuary(builder(landing.x,landing.z,-7.4));
    for(const {group,material,shape,matrices} of stacks.values()){
      const mesh=new THREE.InstancedMesh(shape,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();group.add(mesh);
    }
    const fill=new THREE.HemisphereLight(0xf4e4dc,0x75616c,1.35);fill.userData.baseIntensity=1.35;lights.push(fill);scene.add(fill);
    const study=new THREE.AmbientLight(0xffede2,1.15);scene.add(study);study.visible=false;
    for(let i=0;i<5;i++){const l=new THREE.PointLight(0xffffff,0,14);l.userData.baseIntensity=0;lights.push(l);sightLights.push(l);scene.add(l)}
    function updateLights(x,z,y=0){
      const nearest=sources.filter(s=>s.id===levelAt(y)).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
      for(let i=0;i<sightLights.length;i++){const l=sightLights[i],s=nearest[i];l.userData.baseIntensity=s?.power||0;
        if(s){l.color.set(s.color);l.distance=s.reach;l.position.set(s.x,s.y,s.z)}}
    }
    function floorAt(x,z,maxY=Infinity){
      let h=-Infinity;
      for(const r of floors){if(x<r.xmin-.003||x>r.xmax+.003||z<r.zmin-.003||z>r.zmax+.003)continue;
        const y=r.y(x,z);if(y<=maxY+.001&&y>h&&inside(r.polygon,x,z)&&!r.holes.some(hole=>inside(hole,x,z)))h=y}
      return h;
    }
    function blocked(x,z,y,h=1.66){
      if(!Number.isFinite(floorAt(x,z,y+.03)))return true;
      return solids.some(o=>{if(y+.16>=o.y+o.h||y+h<=o.y)return false;
        const dx=x-o.x,dz=z-o.z;if(o.r)return Math.hypot(dx,dz)<o.r+.16;
        const c=Math.cos(o.ry),s=Math.sin(o.ry);return Math.abs(dx*c-dz*s)<o.w/2+.16&&Math.abs(dx*s+dz*c)<o.d/2+.16});
    }
    function survey(enabled,y,darkness){
      const id=levelAt(y);for(const g of groups)g.visible=enabled?g.userData.id===id&&!['walls','roof'].includes(g.userData.kind):g.userData.kind!=='cut';
      study.visible=enabled&&!darkness;
    }
    function dispose(){
      scene.traverse(o=>{if(o.isInstancedMesh)o.dispose()});scene.clear();
      for(const g of geos)g.dispose();for(const m of Object.values(mats))m.dispose();for(const m of painted.values())m.dispose();for(const t of textures)t.dispose();
    }
    updateLights(0,0);
    return {scene,lights,sightLights,levels,levelAt,updateLights,floorAt,blocked,mapRects:y=>floors.filter(r=>r.id===levelAt(y)),mapSolids:solids,survey,dispose};
  }
  return {build};
})();
