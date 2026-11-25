'use strict';
const ElturelFlyovers=(()=>{
  const {Vector3,BufferGeometry,Float32BufferAttribute,Mesh,Group}=THREE;
  const v=(x,y,z)=>new Vector3(x,y,z);
  function sculpt(){
    const pos=[],tints=[];
    function point(p,tint){
      pos.push(p.x,p.y,p.z);
      tints.push(tint.r,tint.g,tint.b);
    }
    function tri(a,b,c,hex){
      const tint=new THREE.Color(hex);
      for(const p of [a,b,c])point(v(...p),tint);
    }
    function primitive(g,center,scale,hex,rotation){
      const shape=g.index?g.toNonIndexed():g,attribute=shape.getAttribute('position');
      const tint=new THREE.Color(hex);
      for(let i=0;i<attribute.count;i++){
        const p=v(attribute.getX(i),attribute.getY(i),attribute.getZ(i)).multiply(scale);
        if(rotation)p.applyQuaternion(rotation);
        point(p.add(center),tint);
      }
      if(shape!==g)shape.dispose();
      g.dispose();
    }
    function ellipsoid(at,dimensions,hex){
      primitive(new THREE.SphereGeometry(1,8,5),v(...at),v(...dimensions),hex);
    }
    function taper(a,b,r0,r1,tint){
      const start=v(...a),end=v(...b),dir=end.clone().sub(start);
      const rotation=new THREE.Quaternion().setFromUnitVectors(v(0,1,0),dir.clone().normalize());
      primitive(new THREE.CylinderGeometry(r1,r0,1,5),start.lerp(end,.5),v(1,dir.length(),1),tint,rotation);
    }
    function geometry(){
      const g=new BufferGeometry();
      g.setAttribute('position',new Float32BufferAttribute(pos,3));
      g.setAttribute('color',new Float32BufferAttribute(tints,3));
      return g;
    }
    return {tri,ellipsoid,taper,geometry};
  }
  function figure(){
    const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
    const body=sculpt(),ash=0x2b1719,horn=0x3a2321,sinew=0x2e1a20;
    body.ellipsoid([0,0,0],[.24,.25,.47],ash);
    body.ellipsoid([0,.15,.38],[.22,.24,.22],0x452326);
    body.ellipsoid([0,.08,.54],[.16,.12,.15],ash);
    for(const s of [-1,1]){
      body.taper([s*.15,.30,.40],[s*.23,.57,.34],.087,.055,horn);
      body.taper([s*.23,.57,.34],[s*.19,.73,.23],.055,0,horn);
      body.taper([s*.10,-.10,-.29],[s*.24,-.35,-.36],.075,.054,ash);
      body.taper([s*.24,-.35,-.36],[s*.22,-.33,-.61],.055,.029,horn);
      body.taper([s*.22,-.33,-.59],[s*.27,-.35,-.73],.043,0,horn);
      body.taper([s*.19,-.04,.29],[s*.47,-.09,.15],.057,.035,ash);
      body.taper([s*.47,-.09,.15],[s*.47,-.17,.37],.034,0,horn);
    }
    body.taper([0,-.09,-.36],[.04,-.25,-.72],.064,.048,sinew);
    body.taper([.04,-.25,-.72],[-.16,-.29,-1.02],.048,.034,sinew);
    body.taper([-.16,-.29,-1.02],[-.30,-.13,-1.33],.034,.022,sinew);
    body.taper([-.30,-.13,-1.33],[-.23,-.04,-1.51],.023,.016,sinew);
    body.tri([-.29,-.10,-1.43],[-.10,-.01,-1.55],[-.24,.06,-1.69],horn);

    const shoulder=sculpt(),base=[0,0,0],joint=[.91,.08,.18],elbow=[.51,.08,.33],web=[.59,-.05,-.37];
    shoulder.tri(base,elbow,web,0x442326);
    shoulder.tri(elbow,joint,web,0x4f292c);
    shoulder.tri(base,web,[.18,-.03,-.65],0x311d20);
    shoulder.tri(web,joint,[.91,-.07,-.56],0x3c2024);
    shoulder.tri(web,[.91,-.07,-.56],[.67,-.12,-.73],0x3c2024);
    shoulder.taper(base,elbow,.065,.044,sinew);
    shoulder.taper(elbow,joint,.044,.03,sinew);
    const pinion=sculpt(),fan=[0,0,0];
    const outline=[[1.09,0,-.28],[.74,-.11,-.71],[.75,-.16,-1.13],
      [.36,-.09,-.73],[.27,-.15,-1.12],[.12,-.09,-.67],[0,-.15,-.74]];
    for(let i=1;i<outline.length;i++){
      pinion.tri(fan,outline[i-1],outline[i],i%2?0x45262a:0x361e23);
    }
    for(const tip of [outline[0],outline[2],outline[4],outline[6]])pinion.taper(fan,tip,.034,0,sinew);
    pinion.taper([.019,.012,.018],[-.017,.079,.16],.037,0,horn);

    const root=new Group();
    root.name='Ambient imp flyover';
    root.add(new Mesh(body.geometry(),material));
    const innerGeometry=shoulder.geometry(),outerGeometry=pinion.geometry(),wings=[];
    for(const side of [-1,1]){
      const hinge=new Group();hinge.position.set(side*.16,.12,.03);hinge.scale.x=side;root.add(hinge);
      const wing=new Group();hinge.add(wing);
      wing.add(new Mesh(innerGeometry,material));
      const outer=new Group();outer.position.set(...joint);wing.add(outer);
      outer.add(new Mesh(outerGeometry,material));
      wings.push({wing,outer});
    }
    root.visible=false;
    return {root,wings};
  }
  function build(scene){
    const {root,wings}=figure(),random=Elturel.seeded(774103);
    const mix=(a,b,t)=>a+(b-a)*t;
    scene.add(root);
    let lastTime=null,wait=7,flight=null;
    function tick(time,eye,aim,enabled,animate){
      const delta=lastTime===null?0:Math.max(0,Math.min(.1,time-lastTime));
      lastTime=time;
      if(!enabled){
        if(flight)wait=6;
        flight=null;root.visible=false;return;
      }
      if(!animate)return;
      if(!flight){
        wait-=delta;
        if(wait>0)return;
        const dx=aim.x-eye.x,dz=aim.z-eye.z,length=Math.hypot(dx,dz);
        if(length<1){wait=2;return}
        const direction=random()<.5?-1:1,offset=mix(55,69,random());
        flight={age:0,duration:mix(13,16,random()),span:mix(143,161,random()),
          x:eye.x+offset*dx/length,z:eye.z+offset*dz/length,
          frontX:dx/length,frontZ:dz/length,sideX:direction*dz/length,sideZ:-direction*dx/length,
          y:eye.y+mix(16,21,random()),factor:mix(.78,.97,random()),phase:random()*Math.PI*2};
      }
      const f=flight,p=f.age/f.duration;
      if(p>=1){flight=null;root.visible=false;wait=mix(32,58,random());return}
      const across=mix(-f.span,f.span,p),curve=32*(2*p-1)**2;
      const cadence=f.age*Math.PI*2*.91+f.phase;
      const flap=Math.sin(cadence),glide=.68+.32*Math.cos(f.age*.68+f.phase);
      const height=f.y+11*(2*p-1)**2+flap*.37;
      const x=f.x+f.sideX*across+f.frontX*curve,z=f.z+f.sideZ*across+f.frontZ*curve;
      // Shrink only at the far ends of the pass, where the imp is close to a pixel.
      const edge=Math.min(1,p*12,(1-p)*12);
      root.scale.setScalar(Math.max(.01,edge)*f.factor);
      root.position.set(x,Math.max(height,Elturel.surface(x,z)+15),z);
      root.rotation.set(-.05,Math.atan2(f.sideX+f.frontX*(2*p-1)*.4,f.sideZ+f.frontZ*(2*p-1)*.4),.10*Math.sin(f.age*1.1),'YXZ');
      for(const {wing,outer} of wings){
        wing.rotation.z=.13+.80*flap*glide;
        outer.rotation.z=-.11+.63*Math.sin(cadence-.64)*glide;
      }
      root.visible=true;f.age+=delta;
    }
    return {tick};
  }
  return {build};
})();
