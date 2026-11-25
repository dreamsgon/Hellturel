'use strict';
window.HighHallChoir=(builder)=>{
  const {box,arch,column,lamp,line,candle,mesh,stamp,slabField,useLayer,addSolid,
    rock,unitBox,layers,ballAt,random,stone,trim,chalk,black,wood,brass,iron}=builder;
  const y=6.096,pi=Math.PI,tau=2*pi;
  const cx=7.70,cz=-8.65,inner=.49,outer=2.12,steps=32;
  const start=-pi/2,sweep=1.5*pi,rise=y/steps,tread=sweep/steps;
  const gallery={xmin:-11.36,xmax:11.36,zmin:-6.56,zmax:.74};
  const balcony={xmin:-5.58,xmax:5.58,zmin:-8.04,zmax:-6.56};
  const landingBack=-7.60,landingFront=gallery.zmin,landingNarrow=.39,landingWide=.83;
  const overlook={xmin:-2.97,xmax:2.97,zmin:.74,zmax:3.49};
  const deck=[gallery,balcony,overlook];
  const mapSolids=[];
  function solid(x,top,z,w,h,d,ry=0){
    const o={x,y:top-h/2,z,w,h,d,ry};
    addSolid(o);mapSolids.push(o);
  }
  function block(m,x,yy,z,w,h,d,ry=0){
    box(m,x,yy,z,w,h,d,false,ry);
    solid(x,yy,z,w,h,d,ry);
  }
  function onRect(rect,x,z){
    return x>=rect.xmin-1e-6&&x<=rect.xmax+1e-6&&z>=rect.zmin-1e-6&&z<=rect.zmax+1e-6;
  }
  function landingHalfWidth(z){
    const t=(z-landingBack)/(landingFront-landingBack);
    return landingNarrow+(landingWide-landingNarrow)*t;
  }
  function onLanding(x,z){
    return z>=landingBack&&z<=landingFront&&Math.abs(Math.abs(x)-cx)<=landingHalfWidth(z);
  }
  function onDeck(x,z){return onLanding(x,z)||deck.some(rect=>onRect(rect,x,z))}
  function point(side,a,r,yy){
    return [side*(cx+r*Math.sin(a)),yy,cz+r*Math.cos(a)];
  }
  function spiralAt(x,z){
    const u=Math.abs(x)-cx,v=z-cz,r=Math.hypot(u,v);
    return {r,t:(start-Math.atan2(u,v)+tau)%tau};
  }
  function treadHeight(t){
    return Math.min(steps,1+Math.floor(t/tread+1e-7))*rise;
  }
  useLayer('choir');
  for(const f of deck){
    slabField(f.xmin,f.xmax,f.zmin,f.zmax,y,1.04);
    box(black,(f.xmin+f.xmax)/2,y-.41,(f.zmin+f.zmax)/2,
      f.xmax-f.xmin,.18,f.zmax-f.zmin);
  }
  function stoneLanding(core){
    const front=landingFront,back=landingBack,x0=core-landingNarrow,x1=core+landingNarrow;
    const x2=core+landingWide,x3=core-landingWide;
    const profile=[[x0,back],[x1,back],[x2,front],[x3,front]];
    const vertices=[],uv=[],indices=[];
    function face(points,vertical=false){
      const base=vertices.length/3;
      for(let i=0;i<points.length;i++){
        const [x,yy,z]=points[i];vertices.push(x,yy,z);
        uv.push(vertical?(i===1||i===2?1.15:0):x*.88,vertical?yy*2:z*.88);
      }
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
    const high=profile.map(([x,z])=>[x,y,z]),low=profile.map(([x,z])=>[x,y-.48,z]);
    face([...high].reverse());face(low);
    for(let i=0;i<4;i++){
      const n=(i+1)%4;
      face([high[i],high[n],low[n],low[i]],true);
    }
    const surface=new THREE.BufferGeometry();
    surface.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    surface.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    surface.setIndex(indices);surface.computeVertexNormals();mesh(surface,trim);
    for(const direction of [-1,1])line(black,[core+direction*landingNarrow,y-.36,back],
      [core+direction*landingWide,y-.36,front],.14,.15);
  }
  for(const side of [-1,1]){
    const core=side*cx;
    stoneLanding(core);
    useLayer('choirStairs');
    const pos=[],uv=[],index=[];
    function face(points,flat=false){
      const offset=pos.length/3;
      for(let i=0;i<points.length;i++){
        const [x,yy,z]=points[i];pos.push(x,yy,z);
        uv.push(flat?x*.85:Math.hypot(x-points[0][0],z-points[0][2])*.85,flat?z*.85:yy*1.7);
      }
      if(side>0)index.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
      else index.push(offset,offset+2,offset+1,offset,offset+3,offset+2);
    }
    // Each tread is a wedge, so its visible rise matches the walking surface.
    for(let i=0;i<steps;i++){
      const a=start-i*tread,b=a-tread,top=(i+1)*rise-(i===steps-1?.012:0),bottom=top-.27,segments=3;
      for(let j=0;j<segments;j++){
        const u=a+(b-a)*j/segments,v=a+(b-a)*(j+1)/segments;
        face([point(side,u,inner,top),point(side,v,inner,top),point(side,v,outer,top),point(side,u,outer,top)],true);
        face([point(side,u,outer,top),point(side,v,outer,top),point(side,v,outer,bottom),point(side,u,outer,bottom)]);
        face([point(side,u,outer,bottom),point(side,v,outer,bottom),point(side,v,inner,bottom),point(side,u,inner,bottom)],true);
        face([point(side,v,inner,top),point(side,u,inner,top),point(side,u,inner,bottom),point(side,v,inner,bottom)]);
      }
      face([point(side,a,inner,bottom),point(side,a,inner,top),point(side,a,outer,top),point(side,a,outer,bottom)]);
      if(i<steps-2){
        line(chalk,point(side,a,outer+.015,top+.91),point(side,b,outer+.015,top+rise+.91),.095);
        if(i%4===0){
          const [x,,z]=point(side,a,outer+.028,top);
          column(iron,x,top+.46,z,.105,.91);
        }
      }
    }
    const stairGeometry=new THREE.BufferGeometry();
    stairGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    stairGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    stairGeometry.setIndex(index);stairGeometry.computeVertexNormals();
    mesh(stairGeometry,stone);
    column(black,core,.19,cz,1.10,.38);
    column(trim,core,y*.5,cz,.93,y);
    column(chalk,core,y+.11,cz,1.04,.22);
    ballAt(chalk,core,y+.40,cz,.39,.47,.39);
    useLayer('choir');
    const outerEdge=[[5.67,cx-landingWide],[cx+landingWide,11.36]];
    for(const [a,b] of outerEdge){
      block(black,side*(a+b)/2,y+.39,-6.58,b-a,.78,.16);
      box(chalk,side*(a+b)/2,y+.83,-6.58,b-a+.08,.15,.23);
    }
    for(const x of [side*5.57,side*11.24]){
      block(black,x,y+.42,-7.26,.16,.84,1.48);
      box(chalk,x,y+.87,-7.26,.22,.12,1.53);
    }
    for(const x of [side*6.80,side*8.60]){
      block(trim,x,y+.48,-6.43,.15,.95,.31);
      box(chalk,x,y+.99,-6.43,.26,.13,.39);
    }
    // The defensive chambers use a curved stone screen with narrow sight slits.
    const tx=side*8.63,tz=-1.96,turretRadius=2.30,segments=16;
    for(let i=0;i<segments;i++){
      const a=(i+.5)*tau/segments,x=tx+side*Math.cos(a)*turretRadius,z=tz+Math.sin(a)*turretRadius;
      if(i>=5&&i<11)continue;
      const rotation=-side*a-pi/2,w=2*turretRadius*Math.sin(pi/segments)+.04;
      block(stone,x,y+.49,z,w,.98,.36,rotation);
      if(i%3===0){
        box(trim,x,y+1.77,z,w,.24,.41,false,rotation);
        box(chalk,x,y+1.38,z,w*.29,.80,.42,false,rotation);
      }else block(stone,x,y+1.45,z,w,.96,.36,rotation);
      box(chalk,x,y+2.01,z,w,.22,.41,false,rotation);
    }
    box(wood,side*9.3,y+.22,-3.73,.74,.44,1.24);
    box(iron,side*9.3,y+.37,-3.73,.79,.078,1.29);
    box(wood,side*8.61,y+.499,-2.77,1.17,.13,.45);
    for(let i=0;i<4;i++)line(wood,[side*(8.3+i*.11),y+.52,-2.86],[side*(8.64+i*.06),y+.54,-2.57],.025);
    lamp(side*10.48,y+1.40,-3.26,.48);
    block(black,side*11.43,y+.43,-2.97,.19,.86,7.35);
    box(chalk,side*11.42,y+.88,-2.97,.25,.14,7.42);
  }
  for(let x=-5.38;x<=5.39;x+=.53){
    column(trim,x,y+.45,-8.0,.13,.78);
    column(chalk,x,y+.81,-8.0,.22,.12);
  }
  block(black,0,y+.13,-8.0,11.16,.26,.22);
  block(chalk,0,y+.86,-8.0,11.16,.16,.24);
  // The organ faces the landing. Its brass pipes flank the taller center rank.
  const organZ=-7.38;
  block(wood,0,y+.53,organZ,4.25,1.06,1.00);
  box(brass,0,y+1.05,organZ,4.35,.115,1.10);
  for(let i=-9;i<=9;i++){
    const x=i*.208,h=2.52-Math.abs(i)*.178;
    const diameter=.16+(.11*(1-Math.abs(i)/10));
    column(i%4===0?iron:brass,x,y+1.07+h/2,organZ-.13,diameter,h);
    column(trim,x,y+1.09+h*.87,organZ-.13,diameter*1.08,.10);
    box(black,x,y+1.26,organZ+.016,diameter*.57,.08,.018);
  }
  for(const side of [-1,1]){
    box(wood,side*2.08,y+1.66,organZ,.23,1.34,.88);
    column(chalk,side*2.12,y+2.39,organZ,.15,.23);
    ballAt(brass,side*2.12,y+2.57,organZ,.21);
    for(let j=0;j<5;j++)candle(side*(1.22+.18*j),y+1.16,organZ+.36,.09+random()*.09);
  }
  box(wood,0,y+.82,organZ+.67,2.1,.13,.48);
  box(black,0,y+.902,organZ+.67,1.92,.048,.39);
  for(let i=0;i<24;i++){
    const x=(i-11.5)*.073;
    box(chalk,x,y+.93,organZ+.69,.067,.028,.31);
    if(i%7!==2&&i%7!==6)box(black,x+.034,y+.955,organZ+.61,.036,.023,.178);
  }
  box(wood,0,y+.43,organZ+1.47,1.24,.13,.42);
  for(const side of [-1,1])box(wood,side*.51,y+.202,organZ+1.47,.12,.39,.33);
  for(const side of [-1,1]){
    for(let i=0;i<2;i++){
      const x=side*(3.17+i*1.25);
      block(wood,x,y+.37,-3.16,1.08,.18,.55);
      box(wood,x,y+.60,-2.94,1.08,.51,.12);
      box(wood,x,y+.186,-3.15,.88,.37,.45);
    }
    block(black,side*2.91,y+.17,2.13,.22,.34,2.78);
    block(chalk,side*2.91,y+.90,2.13,.24,.16,2.78);
    for(let z=1.0;z<3.5;z+=.42)column(trim,side*2.91,y+.49,z,.13,.74);
    box(chalk,side*2.86,y+.52,3.38,.40,1.04,.34);
  }
  block(black,0,y+.18,3.44,5.84,.36,.22);
  block(chalk,0,y+.91,3.44,5.86,.18,.26);
  for(let x=-2.58;x<=2.6;x+=.43)column(trim,x,y+.52,3.44,.14,.75);
  arch(0,y+1.77,.77,2.46,.78,.22,trim);
  const doors=[],hingeX=1.23,hingeZ=1.32,doorWidth=1.218,doorHeight=2.24,doorDepth=.135;
  let balconyOpen=false,doorTravel=0;
  function doorPiece(group,mat,x,yy,z,w,h,d){
    const part=mesh(unitBox,mat);
    part.position.set(x,yy,z);part.scale.set(w,h,d);group.add(part);
  }
  for(const side of [-1,1]){
    box(trim,side*1.29,y+1.10,hingeZ,.15,2.20,.46);
    const pivot=new THREE.Group();
    pivot.name='Choir balcony door';pivot.position.set(side*hingeX,y+.025,hingeZ);
    layers.choir.add(pivot);doors.push({side,pivot});
    doorPiece(pivot,wood,-side*doorWidth/2,doorHeight/2,0,doorWidth,doorHeight,doorDepth);
    for(let i=0;i<4;i++){
      const x=-side*(.17+i*.293);
      doorPiece(pivot,i%2===0?wood:black,x,1.12,.070,.265,2.17,.012);
    }
    for(const z of [-.077,.080]){
      for(const yy of [.32,1.91])doorPiece(pivot,iron,-side*.54,yy,z,1.04,.084,.038);
      doorPiece(pivot,brass,-side*(doorWidth-.17),1.07,z*1.26,.16,.16,.063);
      doorPiece(pivot,iron,-side*(doorWidth-.18),1.07,z*1.53,.069,.13,.052);
    }
    for(const yy of [.35,1.89])doorPiece(pivot,iron,0,yy,0,.11,.19,.19);
  }
  function updateBalconyPose(){
    const eased=doorTravel*doorTravel*(3-2*doorTravel);
    for(const {side,pivot} of doors)pivot.rotation.y=side*eased*1.55;
  }
  function setBalconyOpen(open,instant=false){
    balconyOpen=Boolean(open);
    if(instant){doorTravel=Number(balconyOpen);updateBalconyPose()}
  }
  function tickBalcony(dt){
    const next=balconyOpen?Math.min(1,doorTravel+dt*1.6):Math.max(0,doorTravel-dt*1.7);
    if(next!==doorTravel){doorTravel=next;updateBalconyPose()}
  }
  function atBalconyDoor(x,feet,z){
    return Math.abs(feet-y)<.65&&Math.abs(x)<1.39&&Math.abs(z-hingeZ)<1.73;
  }
  function canCloseBalcony(x,feet,z){
    if(Math.abs(feet-y)>.83||z<hingeZ-.26||z>hingeZ+doorWidth+.28)return true;
    return doors.every(({pivot})=>Math.hypot(x-pivot.position.x,z-hingeZ)>doorWidth+.28);
  }
  function blockedByDoors(x,z,feet,height){
    if(feet>=y+doorHeight+.03||feet+height<=y)return false;
    return doors.some(({side,pivot})=>{
      const dx=x-pivot.position.x,dz=z-hingeZ,c=Math.cos(pivot.rotation.y),s=Math.sin(pivot.rotation.y);
      const along=-side*(dx*c-dz*s),depth=dx*s+dz*c;
      return along>-.20&&along<doorWidth+.20&&Math.abs(depth)<doorDepth/2+.20;
    });
  }
  function atOrgan(x,feet,z){
    return Math.abs(feet-y)<.65&&Math.abs(x)<1.3&&z>=-6.51&&z<-5.13;
  }
  for(const x of [-2.26,-1.13,0,1.13,2.26]){
    box(black,x,y-.59,2.08,.33,.27,2.67);
    line(trim,[x,y-2.05,1.53],[x,y-.60,2.52],.28,.29);
    box(chalk,x,y-.76,2.95,.32,.24,.40);
  }
  for(let i=0;i<27;i++){
    const x=(random()-.5)*18,z=.56-random()*1.35,size=.12+random()*.29;
    stamp(rock,i%4?stone:black,x,y+size*.21,z,size,size*.61,size*.9,random()*tau);
  }
  useLayer('choirRoof');
  for(const side of [-1,1]){
    const x=side*8.64;
    for(let i=0;i<6;i++){
      const a=pi*i/6;
      const next=pi*(i+1)/6;
      line(trim,[x+Math.cos(a)*2.16,y+2.79,Math.sin(a)*2.16-2],[x+Math.cos(next)*2.16,y+2.79,Math.sin(next)*2.16-2],.17);
    }
    arch(0,y+2.42,-2.1,4.37,1.3,.23,trim,'z');
  }
  useLayer('ground');
  function floorAt(x,z,maxY=Infinity){
    if(maxY>=y-1e-7&&onDeck(x,z))return y;
    const {r,t}=spiralAt(x,z);
    if(r<inner||r>outer||t>sweep+1e-6)return -Infinity;
    const floor=treadHeight(t);
    return floor<=maxY+1e-7?floor:-Infinity;
  }
  function blocked(x,z,feet,height){
    if(blockedByDoors(x,z,feet,height))return true;
    const {r,t}=spiralAt(x,z),deckBelow=onDeck(x,z);
    const onSpiral=r>=inner&&r<=outer&&t<=sweep;
    if(feet>=y-.075&&feet<y+.78&&!deckBelow&&!(onSpiral&&treadHeight(t)>=y-.50))return true;
    if(r<inner+.12&&feet<y+.14)return true;
    if(deckBelow&&feet<y-.47&&feet+height>y-.47)return true;
    if(onSpiral){
      const floor=treadHeight(t);
      if(feet+.10<floor&&feet+height>floor-.27)return true;
    }
    if(feet>rise+.07&&feet<y-.10&&r<outer+.48&&!deckBelow&&
      (r>outer+.015||t>sweep+.015))return true;
    return false;
  }
  const footprint=[...deck,...[-1,1].map(side=>({xmin:side*cx-outer,xmax:side*cx+outer,zmin:cz-outer,zmax:cz+outer}))];
  function mapRects(){return footprint}
  return {floorAt,blocked,mapRects,mapSolids,atBalconyDoor,setBalconyOpen,tickBalcony,canCloseBalcony,atOrgan};
};
