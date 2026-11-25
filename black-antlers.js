'use strict';
window.BlackAntlers=(()=>{
  const levels={ground:0,upper:3.3,cellar:-3.1,attic:6.35};
  const {ground,upper,cellar,attic}=levels;
  const levelAt=y=>y>(upper+attic)/2?attic:y>upper/2?upper:y<cellar/2?cellar:ground;
  const levelName=y=>({[ground]:'Taproom',[upper]:'Guest Rooms',[cellar]:'Cellar',[attic]:'Attic Loft'})[levelAt(y)];
  const footprint=[-9.3,9.3,-12.6,.48];
  const upperHole=[6.53,8.9,-5.8,-.69],cellarHole=[-8.82,-6.38,-11.36,-6.78];
  const atticHole=[7.59,9.22,-11.57,-6.49];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const ring=([x0,x1,z0,z1])=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  function inside(poly,x,z){
    let hit=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const [ax,az]=poly[j],[bx,bz]=poly[i],dx=bx-ax,dz=bz-az;
      const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);
      if(Math.hypot(x-ax-t*dx,z-az-t*dz)<.002)return true;
      if((az>z)!==(bz>z)&&x<ax+(bx-ax)*(z-az)/(bz-az))hit=!hit;
    }
    return hit;
  }
  function build(buildingMaterials){
    const scene=new THREE.Scene(),floors=[],mapSolids=[],ceilings=[],groups=[],sources=[],lights=[],sightLights=[];
    const seats=[],roomDoors=new Map(),tavernSurfaces=window.BlackAntlersMaterials?.create();
    const props=window.BlackAntlersProps?.create({mapSolids,floorAt,levelAt,ceilings});
    let furniture=null;
    scene.background=new THREE.Color(0x211920);scene.fog=new THREE.FogExp2(0x211920,.016);
    const geos=new Set(),materials=new Map(),instances=new Map(),pose=new THREE.Object3D();
    const geometry=g=>{geos.add(g);return g};
    const cube=geometry(new THREE.BoxGeometry(1,1,1));
    const windowPane=geometry(new THREE.PlaneGeometry(1,1));
    materials.set('leadedGlass',window.BlackAntlersMaterials.leadedGlass());
    const cylinder=geometry(new THREE.CylinderGeometry(1,1,1,18));
    const cask=geometry(new THREE.CylinderGeometry(.87,1,1,14));
    const sphere=geometry(new THREE.SphereGeometry(1,14,10));
    let seed=91052;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    function material(name,color,roughness=.87,emissive=0,intensity=0){
      const m=new THREE.MeshStandardMaterial({color,roughness,emissive,emissiveIntensity:intensity});
      tavernSurfaces?.apply(m,name);
      materials.set(name,m);return m;
    }
    const tones={dark:0x432f28,beam:0x594033,wood:0x8a6046,plank:0x916649,plank2:0x785741,plank3:0xa37355,
      mortar:0x665955,stone:0x8a7b70,stone2:0x7c7068,stone3:0x9d8c7b,plaster:0xb19a82,iron:0x4f4444,
      bronze:0xb18553,clay:0x984c3f,linen:0xceba9a,red:0x795251,blue:0x566775,green:0x6b7157,antler:0x40342d,ash:0x332b2b};
    for(const [name,color] of Object.entries(tones))material(name,color);
    // Borrow the city's resident textures; disposing this interior only owns its materials.
    if(buildingMaterials&&!tavernSurfaces){
      for(const [surface,names] of [[buildingMaterials.wood,['beam','wood','plank','plank2','plank3']],
        [buildingMaterials.stone,['stone','stone2','stone3']],[buildingMaterials.plaster,['plaster']]]){
        for(const name of names){
          const m=materials.get(name);
          m.map=surface.map;m.normalMap=surface.normalMap;m.normalScale.setScalar(.28);
        }
      }
    }
    material('fire',0xff8f45,.4,0xff4b16,2);
    material('coal',0xf46d31,.84,0xdd310e,.8);
    material('globe',0x779cff,.23,0x819eff,1.75);
    material('candle',0xffc17b,.32,0xff912a,1.32);
    material('ale',0xb36828,.22,0x854016,.1);
    material('foam',0xe4d0a4,.74);
    function group(level,kind){
      const g=new THREE.Group();g.userData={level,kind};groups.push(g);scene.add(g);return g;
    }
    const layers=new Map(Object.values(levels).map(y=>[y,{
      floor:group(y,'floor'),walls:group(y,'walls'),cut:group(y,'cut'),props:group(y,'props'),roof:group(y,'roof')
    }]));
    function stamp(target,name,shape,x,y,z,w,h,d,ry=0,rx=0,rz=0){
      if(furniture&&target===layers.get(furniture.level).props){
        target=furniture.group;x-=furniture.x;y-=furniture.y;z-=furniture.z;
      }
      const mat=materials.get(name),key=target.id+':'+mat.id+':'+shape.id;
      if(!instances.has(key))instances.set(key,{target,mat,shape,poses:[]});
      pose.position.set(x,y,z);pose.rotation.set(rx,ry,rz,'YXZ');pose.scale.set(w,h,d);pose.updateMatrix();
      instances.get(key).poses.push(pose.matrix.clone());
    }
    function box(target,name,x,y,z,w,h,d,ry=0){stamp(target,name,cube,x,y+h/2,z,w,h,d,ry)}
    function round(target,name,x,y,z,r,h,shape=cylinder){stamp(target,name,shape,x,y+h/2,z,r,h,r)}
    function beam(target,name,a,b,w,d=w){
      const mat=materials.get(name),key=target.id+':'+mat.id+':'+cube.id;
      if(!instances.has(key))instances.set(key,{target,mat,shape:cube,poses:[]});
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
      pose.position.copy(start.lerp(end,.5));pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
      pose.scale.set(w,direction.length(),d);pose.updateMatrix();instances.get(key).poses.push(pose.matrix.clone());
    }
    function solid(x,y,z,w,h,d,ry=0){
      const entry={x,y,z,w,h,d,ry};mapSolids.push(entry);return entry;
    }
    function startFurniture(label,level,x,z){
      const group=new THREE.Group();group.position.set(x,level,z);layers.get(level).props.add(group);
      furniture={label,level,x,y:level,z,group};
    }
    function finishFurniture(collision,seat){
      props?.register({...furniture,solids:[collision],seat});
      furniture=null;
    }
    function prop(y,name,x,offset,z,w,h,d,ry=0,collision=false){
      box(layers.get(y).props,name,x,y+offset,z,w,h,d,ry);
      if(collision)solid(x,y+offset,z,w,h,d,ry);
    }
    function meshBox(target,name,x,y,z,w,h,d){
      const m=new THREE.Mesh(cube,materials.get(name));
      m.position.set(x,y+h/2,z);m.scale.set(w,h,d);target.add(m);
      return m;
    }
    function addRoomDoor(id,x,z,level=upper){
      const group=new THREE.Group(),leaves=[];
      group.position.set(x,level,z);
      layers.get(level).walls.add(group);
      for(const side of [-1,1]){
        const panel=new THREE.Group();group.add(panel);leaves.push({panel,side});
        panel.position.x=side*.322;
        meshBox(panel,'wood',0,.04,0,.644,2.105,.147);
        for(const dx of [-.23,.23])meshBox(panel,'beam',dx,.04,-.003,.09,2.1,.179);
        for(const h of [.30,1.72])meshBox(panel,'beam',0,h,0,.64,.095,.177);
        for(const face of [-1,1])meshBox(panel,'iron',-side*.236,1.05,face*.093,.078,.132,.051);
      }
      roomDoors.set(id,{id,x,y:level,z,leaves,open:false,amount:0});
    }
    function setRoomDoors(openById={},immediate=false){
      for(const [id,door] of roomDoors){
        door.open=Boolean(openById?.[id]);
        if(immediate)door.amount=Number(door.open);
      }
      if(immediate)tickRoomDoors(0);
    }
    function tickRoomDoors(dt){
      for(const door of roomDoors.values()){
        door.amount+=(Number(door.open)-door.amount)*(1-Math.exp(-dt*12));
        for(const {panel,side} of door.leaves)panel.position.x=side*(.322+door.amount*.67);
      }
    }
    function interactionNear(items,x,y,z,yaw,reach){
      const facingX=Math.sin(yaw||0),facingZ=-Math.cos(yaw||0);
      let best=null,bestScore=Infinity;
      for(const item of items){
        const dx=item.x-x,dz=item.z-z,distance=Math.hypot(dx,dz);
        if(Math.abs(item.y-y)>.59||distance>reach)continue;
        const facing=distance>.001?(dx*facingX+dz*facingZ)/distance:1;
        const score=distance-.32*facing;
        if(score<bestScore){best=item;bestScore=score}
      }
      return best;
    }
    const seatNear=(x,y,z,yaw)=>interactionNear(seats,x,y,z,yaw,1.72);
    const roomDoorNear=(x,y,z,yaw)=>interactionNear(roomDoors.values(),x,y,z,yaw,1.65)?.id||null;
    function rectFloor(level,bounds,y=level,label='',holes=[]){
      const [xmin,xmax,zmin,zmax]=bounds;
      floors.push({id:level,xmin,xmax,zmin,zmax,y:()=>y,label,polygon:ring(bounds),holes:holes.map(ring)});
    }
    function irregularFloor(level,poly,label){
      const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
      floors.push({id:level,xmin:Math.min(...xs),xmax:Math.max(...xs),zmin:Math.min(...zs),zmax:Math.max(...zs),y:()=>level,label,polygon:poly,holes:[]});
      const outline=new THREE.Shape(poly.map(([x,z])=>new THREE.Vector2(x,-z))),shape=geometry(new THREE.ShapeGeometry(outline));
      const mesh=new THREE.Mesh(shape,materials.get('stone'));mesh.position.y=level;mesh.rotation.x=-Math.PI/2;layers.get(level).floor.add(mesh);
    }
    function slab(level,[x0,x1,z0,z1],finish){
      const g=layers.get(level).floor,w=x1-x0,d=z1-z0;
      if(w<.01||d<.01)return;
      box(g,finish==='wood'?'dark':'mortar',(x0+x1)/2,level-.21,(z0+z1)/2,w,.195,d);
      ceilings.push({x:(x0+x1)/2,z:(z0+z1)/2,y:level-.21,h:.19,w,d,ry:0});
      const dx=finish==='wood'?.29:1.13,dz=finish==='wood'?3.18:.71;
      const palette=finish==='wood'?['plank','plank2','plank3']:['stone','stone2','stone3'];
      for(let i=0;i<Math.ceil(w/dx);i++){
        const lo=x0+i*dx,hi=Math.min(x1,lo+dx);
        for(let j=-1;j<Math.ceil(d/dz);j++){
          const a=Math.max(z0,z0+(j+(i%3)*.31)*dz),b=Math.min(z1,z0+(j+1+(i%3)*.31)*dz);
          if(b-a<.025||hi-lo<.025)continue;
          const kind=palette[Math.floor(rand()*palette.length)];
          box(g,kind,(lo+hi)/2,level-.032,(a+b)/2,hi-lo-.014,.032,b-a-.014);
        }
      }
    }
    function wall(y,a,b,height,style='timber',thickness=.23){
      const g=layers.get(y).walls,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ry=-Math.atan2(dz,dx);
      const place=(m,t,base,w,h,d=thickness)=>box(g,m,a[0]+t*dx,y+base,a[1]+t*dz,w,h,d,ry);
      box(layers.get(y).cut,style==='stone'?'stone':'beam',(a[0]+b[0])/2,y,(a[1]+b[1])/2,len,.23,thickness+.04,ry);
      if(style==='stone'){
        place('mortar',.5,0,len,height);
        const n=Math.ceil(len/.78),rows=Math.ceil(height/.32),l=len/n,step=height/rows;
        for(let j=0;j<rows;j++)for(let i=-1;i<n;i++){
          const lo=Math.max(0,(i+(j%2)*.5)*l),hi=Math.min(len,(i+1+(j%2)*.5)*l);
          if(hi-lo>.05)place(['stone','stone2','stone3'][Math.floor(rand()*3)],(lo+hi)/(2*len),j*step+.012,hi-lo-.018,step-.024,thickness+.035);
        }
      }else{
        place('plaster',.5,0,len,height);
        place('beam',.5,.05,len,.16,thickness+.11);place('beam',.5,height-.17,len,.17,thickness+.08);
        const boardCount=Math.ceil(len/.38);
        for(let i=0;i<boardCount;i++)place(i%3?'wood':'beam',(i+.5)/boardCount,.19,len/boardCount-.018,.92,thickness+.044);
        place('dark',.5,1.11,len,.105,thickness+.12);
        const postCount=Math.max(1,Math.ceil(len/2.5));
        for(let i=0;i<=postCount;i++)place('beam',i/postCount,.11,.16,height-.18,thickness+.13);
      }
      solid((a[0]+b[0])/2,y,(a[1]+b[1])/2,len,height,thickness,ry);
    }
    function doorway(y,z,x0,x1,cx,width,height,style){
      wall(y,[x0,z],[cx-width/2,z],height,style);
      wall(y,[cx+width/2,z],[x1,z],height,style);
      const g=layers.get(y).walls;
      for(const side of [-1,1])box(g,'beam',cx+side*(width/2+.04),y,z,.16,2.21,.35);
      box(g,'beam',cx,y+2.17,z,width+.25,.19,.35);
      if(height>2.36)box(g,style==='stone'?'stone':'plaster',cx,y+2.36,z,width,height-2.36,.25);
    }
    function windowWall(y,axis,fixed,start,end,centers,h,openingWidth=1.25,bottom=1.08,top=2.36){
      const g=layers.get(y).walls,ry=axis==='x'?0:-Math.PI/2;
      const p=t=>axis==='x'?[t,fixed]:[fixed,t];
      let previous=start;
      for(const cx of centers){
        const left=cx-openingWidth/2,right=cx+openingWidth/2;
        if(left-previous>.01)wall(y,p(previous),p(left),h);
        const [x,z]=p(cx);
        stamp(g,'leadedGlass',windowPane,x,y+(bottom+top)/2,z,openingWidth,top-bottom,1,ry);
        box(g,'plaster',x,y,z,openingWidth,bottom,.23,ry);
        const boardCount=Math.ceil(openingWidth/.34);
        for(let i=0;i<boardCount;i++){
          const [bx,bz]=p(left+(i+.5)*openingWidth/boardCount);
          box(g,i%3?'wood':'beam',bx,y+.16,bz,openingWidth/boardCount-.014,bottom-.22,.269,ry);
        }
        box(g,'beam',x,y+.05,z,openingWidth,.14,.34,ry);
        box(g,'beam',x,y+bottom-.07,z,openingWidth+.17,.10,.45,ry);
        box(g,'beam',x,y+top,z,openingWidth+.11,.11,.36,ry);
        if(h>top+.11)box(g,'plaster',x,y+top+.11,z,openingWidth,h-top-.11,.24,ry);
        for(const side of [-1,1]){
          const [px,pz]=p(cx+side*openingWidth/2);
          box(g,'beam',px,y+bottom,pz,.075,top-bottom,.33,ry);
        }
        solid(x,y,z,openingWidth,top,.23,ry);
        solid(x,y+top,z,openingWidth,h-top,.23,ry);
        box(layers.get(y).cut,'beam',x,y,z,openingWidth,.23,.27,ry);
        previous=right;
      }
      if(end-previous>.01)wall(y,p(previous),p(end),h);
    }
    function enclose(y,height,style){
      if(y===cellar){
        for(const side of [-1,1])wall(y,[side*9.3,-12.6],[side*9.3,.48],height,style);
        wall(y,[-9.3,.48],[9.3,.48],height,style);
        doorway(y,-12.6,-9.3,9.3,0,2.05,height,style);
      }else if(y===ground){
        windowWall(y,'z',-9.3,-12.6,.48,[-10.15],height);
        windowWall(y,'z',9.3,-12.6,.48,[-10,-3.79],height);
        windowWall(y,'x',.48,-9.3,-1.1,[-4.3],height);
        windowWall(y,'x',.48,1.1,9.3,[4.3],height);
        for(const side of [-1,1])box(layers.get(y).walls,'beam',side*1.116,y,.48,.18,2.23,.34);
        box(layers.get(y).walls,'beam',0,y+2.22,.48,2.36,.18,.34);
        box(layers.get(y).walls,'plaster',0,y+2.40,.48,2.2,height-2.4,.24);
        windowWall(y,'x',-12.6,-9.3,9.3,[-6.7,6.32],height);
      }else{
        windowWall(y,'z',-9.3,-12.6,.48,[-10.13,-2.36],height);
        windowWall(y,'z',9.3,-12.6,.48,[-10,-3.86],height);
        windowWall(y,'x',.48,-9.3,9.3,[-6.97,-2.32,2.32],height);
        windowWall(y,'x',-12.6,-9.3,9.3,[-6.97,-2.32,2.32,6.2],height);
      }
    }
    function stairs(x,width,startZ,endZ,startY,endY,level){
      const g=layers.get(level).floor,count=20,d=(endZ-startZ)/count;
      for(let i=0;i<count;i++){
        const a=startZ+i*d,b=a+d,y=startY+(endY-startY)*(i+1)/count;
        rectFloor(level,[x-width/2,x+width/2,Math.min(a,b),Math.max(a,b)],y);
        box(g,level===ground?'stone3':'plank',x,y-.19,(a+b)/2,width,.19,Math.abs(d)+.013);
      }
      for(const side of [-1,1]){
        const railX=x+side*(width/2+.06);
        beam(g,'beam',[railX,startY+.94,startZ],[railX,endY+.94,endZ],.101);
        for(let i=0;i<=5;i++){
          const t=i/5;box(g,'beam',railX,startY+(endY-startY)*t,startZ+(endZ-startZ)*t,.10,.96,.10);
        }
        const steps=20;
        for(let i=0;i<steps;i++){
          const t=(i+.5)/steps,fy=startY+(endY-startY)*t;
          solid(railX,fy-.16,startZ+(endZ-startZ)*t,.11,1.15,Math.abs(d)+.014);
        }
      }
    }
    function light(level,x,y,z,color,power,reach){sources.push({level,x,y:level+y,z,color,power,reach})}
    function candle(level,x,y,z){
      const g=layers.get(level).props;
      round(g,'bronze',x,level+y,z,.108,.044);round(g,'linen',x,level+y+.039,z,.043,.156);
      stamp(g,'candle',sphere,x,level+y+.211,z,.037,.067,.038);
    }
    function chair(level,x,z,yaw,stool=false){
      const g=layers.get(level).props,c=Math.cos(yaw),s=Math.sin(yaw);
      const at=(u,v)=>[x+u*c+v*s,z-u*s+v*c];
      const deck=stool?.74:.42;
      startFurniture(stool?'Stool':'Chair',level,x,z);
      for(const u of [-.16,.16])for(const v of [-.16,.16]){
        const [px,pz]=at(u,v);prop(level,'beam',px,.045,pz,.066,deck-.019,.066,yaw);
      }
      if(stool){
        round(g,'wood',x,level+deck,z,.241,.076);
        for(const v of [-.16,.16]){
          const [px,pz]=at(0,v);prop(level,'beam',px,.29,pz,.35,.051,.056,yaw);
        }
      }
      else{
        prop(level,'wood',x,.42,z,.461,.079,.47,yaw);
        for(const u of [-.18,.18]){
          const [px,pz]=at(u,.20);prop(level,'beam',px,.46,pz,.074,.48,.08,yaw);
        }
        const [bx,bz]=at(0,.20);
        for(const h of [.67,.86])prop(level,'wood',bx,h,bz,.42,.068,.066,yaw);
      }
      const collision=solid(x,level+.03,z,.44,stool?.77:.88,.44,yaw);
      const seat={x,y:level,z,yaw,eyeHeight:stool?1.54:1.19};seats.push(seat);
      finishFurniture(collision,seat);
    }
    function table(level,x,z,w,d,angle=0,communal=false){
      const c=Math.cos(angle),s=Math.sin(angle),g=layers.get(level).props,t=level+.91;
      const at=(u,v)=>[x+u*c+v*s,z-u*s+v*c];
      const roundTop=d===0,depth=roundTop?w:d;
      startFurniture('Table',level,x,z);
      if(roundTop){
        round(g,'wood',x,t-.11,z,w/2,.13);round(g,'beam',x,level+.06,z,.14,.77);
        for(const sign of [-1,1])prop(level,'beam',x,.06,z,1.06,.11,.15,angle+sign*Math.PI/4);
      }else{
        prop(level,'wood',x,.81,z,w,.13,d,angle);
        for(const u of [-w*.41,w*.41])for(const v of [-d*.36,d*.36]){
          const [px,pz]=at(u,v);prop(level,'beam',px,.045,pz,.15,.80,.15,angle);
        }
      }
      const collision=solid(x,level+.03,z,w,.93,depth,angle);
      if(!roundTop||rand()>.45)candle(level,x-.28,.94,z+.07);
      for(const [u,v] of [[w*.24,0],[-w*.29,-.14]]){
        const [px,pz]=at(u,v);round(g,'bronze',px,t+.03,pz,.074,.146);round(g,'linen',px+.21,t+.03,pz+.06,.13,.024);
      }
      finishFurniture(collision);
      for(let i=0;i<(communal?4:3);i++){
        const a=angle+i*Math.PI*2/(communal?4:3);
        const [px,pz]=communal?at((i<2?-1:1)*w*.24,(i%2-.5)*(d+1.05)):[x+Math.cos(a)*(w*.5+.48),z+Math.sin(a)*(w*.5+.48)];
        chair(level,px,pz,Math.atan2(x-px,pz-z));
      }
    }
    function barrel(y,x,z,r=.47){
      const g=layers.get(y).props;
      round(g,'wood',x,y+.05,z,r,.47,cask);
      stamp(g,'wood',cask,x,y+.745,z,r,.47,r,0,Math.PI);
      for(const [h,s] of [[.15,.91],[.33,.99],[.70,.99],[.89,.91]])round(g,'iron',x,y+h,z,r*s,.055);
      round(g,'plank',x,y+.985,z,r*.86,.037);solid(x,y+.04,z,r*1.94,.99,r*1.94);
    }
    function crate(y,x,z,w=.67,d=.72,h=.68,angle=0){
      startFurniture('Crate',y,x,z);
      prop(y,'wood',x,.025,z,w,h,d,angle);
      const s=Math.sin(angle),c=Math.cos(angle);
      for(const u of [-w*.32,w*.32]){
        const v=d/2+.021;prop(y,'beam',x+u*c+v*s,.025,z-u*s+v*c,.085,h+.035,.058,angle);
      }
      finishFurniture(solid(x,y+.025,z,w,h,d,angle));
    }
    function privy(level,id,x0,x1,z0,z1,doorZ,sideWalls){
      const x=(x0+x1)/2,front=doorZ===z1?1:-1;
      for(const [a,b] of sideWalls)wall(level,a,b,2.63);
      doorway(level,doorZ,x0,x1,x,1.29,2.63);
      addRoomDoor(id,x,doorZ,level);
      rectFloor(level,[x0,x1,z0,z1],level,level===ground?'A4 Privy':'Guest Privy');
      const benchZ=front>0?z0+.45:z1-.45,g=layers.get(level).props;
      prop(level,'wood',x,.03,benchZ,1.08,.48,.70,0,true);
      prop(level,'beam',x,.51,benchZ,1.16,.11,.75);
      round(g,'ash',x,level+.62,benchZ,.229,.027);
      const rim=geometry(new THREE.TorusGeometry(.239,.045,8,20));
      stamp(g,'wood',rim,x,level+.648,benchZ,1,1,1,0,Math.PI/2);
      const bucketZ=benchZ+front*.54;
      round(g,'wood',x0+.32,level+.02,bucketZ,.139,.25,cask);
      round(g,'iron',x0+.32,level+.21,bucketZ,.146,.037);
      candle(level,x1-.27,1.62,benchZ);
      prop(level,'iron',x1-.27,1.55,benchZ,.29,.063,.17);
      light(level,x1-.27,1.84,benchZ,0xffbd87,12,4);
    }

    // The kitchen and cellar stair occupy the northwest bay of the taproom.
    rectFloor(ground,footprint,ground,'A1 Taproom',[cellarHole]);
    slab(ground,[-9.3,-8.82,-12.6,cellarHole[3]],'stone');
    slab(ground,[-6.38,-4.17,-12.6,cellarHole[3]],'stone');
    slab(ground,[-8.82,-6.38,-12.6,cellarHole[2]],'stone');
    slab(ground,[-9.3,-4.17,cellarHole[3],-6.7],'stone');
    slab(ground,[-4.17,9.3,-12.6,.48],'wood');
    slab(ground,[-9.3,-4.17,-6.7,.48],'wood');
    rectFloor(ground,[-9.3,-4.17,-12.6,-6.7],ground,'A3 Kitchen',[cellarHole]);
    enclose(ground,3.3,'timber');
    for(const [a,b] of [[[-9.3,-6.7],[-6.55,-6.7]],[[-5.02,-6.7],[-4.17,-6.7]],[[-4.17,-12.6],[-4.17,-9.7]],[[-4.17,-8.0],[-4.17,-6.7]]])wall(ground,a,b,3.12);
    rectFloor(ground,[cellarHole[0],cellarHole[1],cellarHole[2],cellarHole[3]],cellar-.4,'Cellar Stairs');
    stairs(-7.6,2.38,cellarHole[2],cellarHole[3],ground,cellar,ground);
    const apron=layers.get(ground).props;
    for(const x of [-8.84,-6.41]){
      for(const y of [.45,.96])beam(apron,'beam',[x,y,cellarHole[2]],[x,y,cellarHole[3]],.091);
      for(const z of [cellarHole[2],-9.85,-8.36,cellarHole[3]])prop(ground,'beam',x,.04,z,.13,1.01,.13);
      solid(x,.06,(cellarHole[2]+cellarHole[3])/2,.09,1.01,cellarHole[3]-cellarHole[2]);
    }
    for(const y of [.45,.96])beam(apron,'beam',[-8.84,y,cellarHole[3]],[-6.41,y,cellarHole[3]],.091);
    solid(-7.625,.06,cellarHole[3],2.43,1.01,.095);
    const kitchenShelfX=-4.52,kitchenShelfZ=-10.92;
    for(const h of [.61,1.16,1.69])prop(ground,'wood',kitchenShelfX,h,kitchenShelfZ,.47,.12,1.62);
    for(const z of [kitchenShelfZ-.74,kitchenShelfZ+.74])prop(ground,'beam',-4.39,.04,z,.18,1.77,.11);
    solid(kitchenShelfX,.04,kitchenShelfZ,.47,1.77,1.62);
    const tap=layers.get(ground).props,roof=layers.get(ground).roof;
    for(const z of [-11.48,-11.11,-10.82,-10.52])round(tap,'clay',kitchenShelfX,1.28,z,.102,.18);
    candle(ground,kitchenShelfX,1.81,kitchenShelfZ);
    for(const x of [-4.92,4.92])for(const z of [-8.12,-3.45]){
      prop(ground,'stone',x,0,z,.37,3.17,.40,0,true);
      prop(ground,'stone3',x,0,z,.58,.22,.59);prop(ground,'beam',x,2.87,z,.67,.20,.65);
    }
    for(const z of [-2.1,-4.4])box(roof,'beam',-1.48,2.89,z,15.6,.28,.24);
    for(const z of [-6.65,-8.94,-11.15])box(roof,'beam',0,2.89,z,18.5,.28,.24);
    const barX=-7.12;
    prop(ground,'wood',barX,.04,-4.05,1.13,1.1,4.4,0,true);
    prop(ground,'plank',barX,1.13,-4.05,1.38,.12,4.58);
    prop(ground,'linen',barX,1.251,-3.5,.32,.019,.44,.14);
    for(let i=0;i<4;i++)prop(ground,'ash',barX+(.085-i*.011),1.271,-3.61+i*.062,.15,.007,.012,.14);
    for(const z of [-5.95,-2.18])prop(ground,'beam',barX+.49,.07,z,.22,1.04,.23);
    for(let i=0;i<3;i++)round(tap,'clay',barX-.36,1.25,-5.86+i*.125,.051,.136);
    for(const z of [-5.79,-4.92,-4.05,-3.18,-2.31])chair(ground,-6.09,z,-Math.PI/2,true);
    prop(ground,'beam',-8.95,.37,-4.04,.56,.15,4.10,0,true);
    const tapEnds=[-5.6,-4.62,-3.61,-2.62];
    for(const z of tapEnds){
      const x=-8.87,y=.89,r=.36;
      stamp(tap,'wood',cylinder,x,y,z,r,.76,r,0,0,Math.PI/2);
      for(const offset of [-.25,.23])stamp(tap,'iron',cylinder,x+offset,y,z,r+.018,.045,r+.018,0,0,Math.PI/2);
      stamp(tap,'plank',cylinder,x+.388,y,z,r-.024,.039,r-.024,0,0,Math.PI/2);
      prop(ground,'bronze',x+.465,y-.123,z,.18,.084,.08);
      prop(ground,'bronze',x+.54,y-.205,z,.066,.13,.064);
      prop(ground,'bronze',x+.44,y-.056,z,.052,.069,.18);
      solid(x,.54,z,.76,.72,r*2);
    }
    const tankardModel=geometry(new THREE.LatheGeometry([
      [0,0],[.070,0],[.081,.010],[.086,.025],[.090,.144],[.088,.161],
      [.080,.161],[.078,.146],[.073,.025],[0,.021]
    ].map(([x,y])=>new THREE.Vector2(x,y)),20));
    const handleModel=geometry(new THREE.TorusGeometry(.053,.012,8,20));
    const tankards=[-4.93,-4.52,-3.94,-2.80].map((z,id)=>{
      const vessel=new THREE.Group();layers.get(ground).props.add(vessel);
      return {id,x:barX+.18,y:1.257,z,fill:0,vessel};
    });
    const tankardStandards=tankards.map(({x,y,z})=>({x,y,z}));
    const heldTankard=new THREE.Group();scene.add(heldTankard);
    const visibleTankard=(target)=>{
      const body=new THREE.Mesh(tankardModel,materials.get('bronze'));target.add(body);
      const handle=new THREE.Mesh(handleModel,materials.get('bronze'));
      handle.position.set(.100,.084,0);target.add(handle);
      for(const y of [.019,.128]){
        const band=new THREE.Mesh(cylinder,materials.get('iron'));
        band.position.y=y;band.scale.set(.091,.014,.091);target.add(band);
      }
      const liquid=new THREE.Mesh(cylinder,materials.get('ale'));target.add(liquid);
      const froth=new THREE.Mesh(cylinder,materials.get('foam'));target.add(froth);
      return {liquid,froth};
    };
    for(const tankard of tankards)Object.assign(tankard,visibleTankard(tankard.vessel));
    const handFill=visibleTankard(heldTankard);
    const stream=new THREE.Mesh(cylinder,materials.get('ale'));
    const streamX=-8.329,streamTop=.681;
    stream.visible=false;scene.add(stream);
    let activeTankard=null,pour=null,showHand=false;
    const cameraOffset=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),cameraRotation=new THREE.Quaternion();
    const placementRay=new THREE.Raycaster(),placementDirection=new THREE.Vector3();
    function setLiquid({liquid,froth},fill){
      liquid.visible=froth.visible=fill>.01;
      const level=.028+fill*.111,r=.072+fill*.006;
      liquid.position.y=level-.006;liquid.scale.set(r,.012,r);
      froth.position.set(.018,level+.002,-.021);froth.scale.set(r*.48,.005,r*.43);
    }
    function syncTankards(){
      for(const t of tankards){
        const layer=layers.get(levelAt(t.y)).props;
        if(t.vessel.parent!==layer)layer.add(t.vessel);
        t.vessel.visible=t!==activeTankard;t.vessel.position.set(t.x,t.y,t.z);setLiquid(t,t.fill);
      }
      activeTankard&&setLiquid(handFill,activeTankard.fill);
      heldTankard.visible=Boolean(activeTankard&&showHand);
      stream.visible=Boolean(pour&&showHand);
    }
    const syncPlacement=()=>{
      const y=pour.mugBottom;
      heldTankard.position.set(streamX,y,pour.z);heldTankard.rotation.set(0,Math.PI*.12,0);heldTankard.scale.setScalar(1);
      const bottom=y+.029+activeTankard.fill*.111,span=streamTop-bottom;
      stream.position.set(streamX,(streamTop+bottom)/2,pour.z);stream.scale.set(.012,span,.012);
    };
    function showHeld(camera,enabled=true){
      showHand=Boolean(enabled&&camera);syncTankards();
      if(!heldTankard.visible)return;
      if(pour){syncPlacement();return}
      camera.getWorldPosition(cameraPosition);camera.getWorldQuaternion(cameraRotation);
      cameraOffset.set(.31,-.35,-.58).applyQuaternion(cameraRotation);
      heldTankard.position.copy(cameraPosition).add(cameraOffset);
      heldTankard.quaternion.copy(cameraRotation);heldTankard.rotateY(-.35);heldTankard.rotateX(.22);heldTankard.scale.setScalar(.73);
    }
    function barTarget(x,y,z,yaw){
      if(activeTankard){
        if(pour)return {hint:'Pouring ale',pour};
        if(activeTankard.fill>=.999||Math.abs(y-ground)>.55||x< -8.66||x> -7.68)return null;
        const tap=interactionNear(tapEnds.map(z=>({x:streamX,y:ground,z})),x,y,z,yaw,.82);
        return tap?{hint:'Pour ale from the keg',tap}:null;
      }
      let tankard=null,best=Infinity;
      for(const t of tankards){
        const dx=t.x-x,dz=t.z-z,d=Math.hypot(dx,dz);
        if(d>1.72||Math.abs(t.y-(y+.72))>1.18||levelAt(t.y)!==levelAt(y))continue;
        const facing=(dx*Math.sin(yaw||0)-dz*Math.cos(yaw||0))/Math.max(.01,d);
        if(facing<-.32&&d>.51)continue;
        const score=d-.39*facing;
        if(score<best){tankard=t;best=score}
      }
      return tankard?{hint:tankard.fill>.01?'Pick up filled tankard':'Pick up tankard',tankard}:null;
    }
    const actionHint=(x,y,z,yaw)=>barTarget(x,y,z,yaw)?.hint||null;
    function useBar(x,y,z,yaw){
      const target=barTarget(x,y,z,yaw);
      if(!target)return false;
      if(target.tankard)activeTankard=target.tankard;
      else if(target.tap)pour={z:target.tap.z,elapsed:0,start:activeTankard.fill,mugBottom:.39};
      syncTankards();return true;
    }
    function tickBar(dt){
      if(!pour)return false;
      pour.elapsed+=Math.max(0,dt);
      const progress=clamp(pour.elapsed/1.6,0,1);
      activeTankard.fill=pour.start+(1-pour.start)*progress;
      if(progress===1)pour=null;
      syncTankards();
      if(pour&&showHand)syncPlacement();
      return progress===1;
    }
    function placeTankard(camera,x,y,z,yaw){
      if(!activeTankard||pour)return false;
      const level=levelAt(y),layer=layers.get(level),targets=[layer?.floor,layer?.props].filter(Boolean);
      scene.updateMatrixWorld(true);
      let spot;
      if(camera){
        camera.getWorldPosition(cameraPosition);camera.getWorldDirection(placementDirection);
        placementRay.set(cameraPosition,placementDirection);placementRay.far=2.65;
        const first=placementRay.intersectObjects(targets,true).find(hit=>hit.object.visible&&hit.object.parent.visible);
        if(first?.face&&first.face.normal.clone().transformDirection(first.object.matrixWorld).y>.56)spot=first.point;
      }
      if(!spot){
        const fx=x+.88*Math.sin(yaw||0),fz=z-.88*Math.cos(yaw||0);
        placementRay.set(cameraPosition.set(fx,y+1.65,fz),placementDirection.set(0,-1,0));placementRay.far=1.74;
        spot=placementRay.intersectObjects(targets,true).find(hit=>hit.object.visible&&hit.object.parent.visible)?.point;
      }
      if(!spot||!Number.isFinite(floorAt(spot.x,spot.z,spot.y+.12)))return false;
      if(tankards.some(t=>t!==activeTankard&&Math.hypot(t.x-spot.x,t.z-spot.z)<.15&&Math.abs(t.y-spot.y)<.2))return false;
      Object.assign(activeTankard,{x:spot.x,y:spot.y+.008,z:spot.z});
      activeTankard=null;syncTankards();return true;
    }
    function drinkTankard(){
      if(!activeTankard||pour||activeTankard.fill<=0)return false;
      activeTankard.fill=0;syncTankards();return true;
    }
    const hasHeldTankard=()=>Boolean(activeTankard);
    const getBarState=()=>({active:activeTankard?.id??null,tankards:tankards.map(({id,x,y,z,fill})=>({id,x,y,z,fill}))});
    function restoreBar(state){
      for(const t of tankards){
        const saved=state?.tankards?.find?.(item=>item?.id===t.id);
        const data=saved&&[saved.x,saved.y,saved.z,saved.fill].every(Number.isFinite)&&
          Number.isFinite(floorAt(saved.x,saved.z,saved.y+.12))?saved:tankardStandards[t.id];
        Object.assign(t,{x:data.x,y:data.y,z:data.z,fill:clamp(data.fill||0,0,1)});
      }
      activeTankard=tankards.find(t=>t.id===state?.active)||null;
      pour=null;syncTankards();
    }
    // The mounted rack spans the west wall over the service counter.
    prop(ground,'dark',-9.11,1.85,-4.03,.18,.81,1.21);
    for(const side of [-1,1]){
      const at=(z,y,x=0)=>[-8.91+x,y,-4.03+side*z];
      const crown=[at(.16,2.11),at(.58,2.23,.13),at(1.24,2.41,.21),at(2.04,2.53,.12),at(2.91,2.83,-.01)];
      for(let i=1;i<crown.length;i++)beam(tap,'antler',crown[i-1],crown[i],.125-i*.015);
      for(const [i,z,y,x] of [[1,.93,2.94,.33],[2,1.64,3.10,.14],[3,2.39,3.03,.30],[4,3.03,3.12,.05]])beam(tap,'antler',crown[i],at(z,y,x),.057);
    }
    for(const [x,z] of [[-5.3,-5.05],[.03,-6.42],[5.52,-4.33]]){
      stamp(tap,'globe',sphere,x,2.51,z,.155,.155,.155);
      light(ground,x,2.51,z,0x99aaff,11,7);
    }
    table(ground,-1.58,-10.44,3.62,1.14,0,true);table(ground,5.84,-9.74,3.63,1.14,0,true);
    wall(ground,[3.68,-12.6],[3.68,-7.73],3.08);
    doorway(ground,-7.73,3.68,9.3,6.24,1.62,3.08);
    rectFloor(ground,[3.68,9.3,-12.6,-7.73],ground,'A2 Order Meeting Room');
    privy(ground,'taproom-privy',7.64,9.3,-12.6,-10.23,-10.23,[[[7.64,-12.6],[7.64,-10.23]]]);
    prop(ground,'red',5.84,1.45,-12.41,1.57,1.19,.075);
    prop(ground,'bronze',5.84,1.93,-12.355,.24,.21,.031);
    for(let i=0;i<4;i++)prop(ground,'bronze',5.736+i*.068,2.1,-12.355,.049,.17-i*.024,.031);
    light(ground,6.31,1.43,-10.1,0xffc091,26,7);
    for(const [x,z,w,a] of [[-3.76,-2.72,1.48,.33],[-1.51,-5.44,1.72,.31],[1.93,-2.24,1.54,.91],[4.12,-5.61,1.62,.63]])table(ground,x,z,w,0,a);
    const fireX=2.11,fireZ=-12.13;
    for(const side of [-1,1])prop(ground,'stone',fireX+side*1.06,0,fireZ,.56,2.18,1.16,0,true);
    prop(ground,'stone3',fireX,1.79,fireZ,2.36,.44,1.08);
    prop(ground,'stone',fireX,2.22,fireZ-.19,1.63,.92,.73);
    prop(ground,'ash',fireX,.01,fireZ+.05,1.72,.11,1.33);
    for(let i=0;i<8;i++){
      const x=fireX+(i-3.5)*.16,z=fireZ+.02+.22*rand();
      beam(tap,'dark',[x-.13,.16,z-.31],[x+.23,.22,z+.32],.12);
      stamp(tap,i%2?'fire':'coal',sphere,x,.21+rand()*.16,z,.07,.16+rand()*.12,.066,0,0,(rand()-.5)*.65);
    }
    light(ground,fireX,.79,fireZ+.58,0xffad63,59,12);
    light(ground,kitchenShelfX,2.07,kitchenShelfZ,0xffbb80,26,8);
    light(ground,barX,1.77,-4.05,0xffc692,30,7);
    light(ground,0,2.34,-.74,0xffc392,23,8);

    // The two banks of guest rooms face a single east-west landing and corridor.
    rectFloor(upper,footprint,upper,'',[upperHole]);
    slab(upper,[-9.3,6.53,-12.6,.48],'wood');
    slab(upper,[6.53,8.9,-12.6,-5.8],'wood');
    slab(upper,[6.53,8.9,-.69,.48],'wood');
    slab(upper,[8.9,9.3,-12.6,.48],'wood');
    enclose(upper,2.92,'timber');
    stairs(7.7,2.29,-.69,-5.8,ground,upper,upper);
    rectFloor(upper,[-9.19,9.20,-7.31,-5.61],upper,'Guest Corridor',[[6.53,8.9,-5.8,-.69]]);
    const cuts=[-9.3,-4.64,0,4.64,9.3];
    const northRooms=['Common Bunkroom','A6 Spare Room','A8 Ontharr’s Room','A9 Lephit’s Room'];
    for(let i=0;i<4;i++){
      const lo=cuts[i],hi=cuts[i+1],northHi=i===3?7.52:hi,x=(lo+northHi)/2;
      if(i){
        wall(upper,[lo,-12.6],[lo,-7.31],2.9);
        wall(upper,[lo,-5.62],[lo,.48],2.9);
      }
      doorway(upper,-7.31,lo,northHi,x,1.34,2.9);
      addRoomDoor(`north-${i+1}`,x,-7.31);
      rectFloor(upper,[lo,northHi,-12.6,-7.31],upper,northRooms[i]);
      if(i<3){
        doorway(upper,-5.62,lo,hi,x,1.34,2.9);
        addRoomDoor(`south-${i+1}`,x,-5.62);
        rectFloor(upper,[lo,hi,-5.62,.48],upper,i===0?'A7 Broad Guest Room':`Guest Room ${i+5}`);
      }else{
        wall(upper,[hi-.15,-5.8],[hi-.15,-.69],1.0);
        rectFloor(upper,[6.53,8.9,-5.8,-.69],ground-.5,'Taproom Stairs');
      }
      for(const north of [true,false]){
        if(!north&&i===3)continue;
        const z=north?-10.98:-1.02,bedX=lo+1.18,colors=['red','blue','green','linen'];
        if(north&&i===0){
          for(let j=0;j<3;j++){
            const cx=lo+.88+j*1.43;
            prop(upper,'beam',cx,.035,-10.93,1.03,.37,2.43,0,true);
            prop(upper,'wood',cx,.41,-12.04,1.11,.35,.15);
            prop(upper,'linen',cx,.407,-10.93,.99,.14,2.31);
            prop(upper,colors[j],cx,.547,-10.63,1.01,.07,1.54);
            prop(upper,'linen',cx,.549,-11.78,.69,.12,.38);
            crate(upper,cx,-9.25,.57,.51,.46);
          }
          light(upper,x,1.87,-11.4,0xffbf8d,22,6);
        }else{
          prop(upper,'beam',bedX,.035,z,1.41,.45,2.36,0,true);
          prop(upper,'wood',bedX,.51,z+(north?-1.13:1.13),1.52,.52,.14);
          prop(upper,'linen',bedX,.48,z,1.37,.17,2.27);
          prop(upper,colors[(i+(north?0:1))%4],bedX,.65,z+(north?.23:-.23),1.38,.083,1.61);
          prop(upper,'linen',bedX,.67,z+(north?-.82:.82),.92,.19,.42);
          const roomEnd=north?northHi:hi,nightZ=north?-11.79:-.35;
          crate(upper,roomEnd-.67,z+.05,.69,.63,.56,(i%2-.5)*.14);
          prop(upper,'wood',roomEnd-.57,.02,nightZ,.7,.75,.55,0,true);
          candle(upper,roomEnd-.54,.77,nightZ);
          light(upper,roomEnd-.55,1.13,nightZ,0xffbf8d,18,6);
        }
      }
    }
    for(const x of [-5.99,-1.35,3.29,7.11]){
      prop(upper,'iron',x,1.43,-7.167,.15,.25,.073);
      prop(upper,'iron',x,1.61,-7.048,.067,.061,.29);
      candle(upper,x,1.67,-6.93);
      light(upper,x,1.91,-6.84,0xffc79a,25,7);
    }
    const deskX=4.1,deskZ=-9.65;
    prop(upper,'wood',deskX,.783,deskZ,.72,.12,1.29);
    for(const dx of [-.29,.29])for(const dz of [-.54,.54])
      prop(upper,'beam',deskX+dx,.04,deskZ+dz,.096,.75,.101);
    solid(deskX,upper+.04,deskZ,.72,.87,1.29);
    prop(upper,'linen',deskX,.905,deskZ+.23,.36,.023,.46,-.15);
    for(let i=0;i<4;i++)prop(upper,'ash',deskX+.011,.93,deskZ+.10+i*.071,.26,.007,.012,-.15);
    candle(upper,deskX-.145,.906,deskZ-.44);
    chair(upper,deskX-.73,deskZ,Math.PI/2);
    prop(upper,'stone3',2.39,.047,-12,1.06,.67,.66,0,true);
    prop(upper,'stone',2.39,.717,-12,1.21,.071,.76);
    prop(upper,'bronze',2.39,.81,-11.96,.21,.036,.21);
    for(let i=0;i<4;i++)prop(upper,'bronze',2.31+i*.055,.818,-12.086-i*.02,.042,.038,.14);
    wall(upper,[7.52,-12.6],[7.52,-7.3],2.92);
    privy(upper,'guest-privy',4.64,6.43,-5.62,-3.21,-5.62,[
      [[6.43,-5.62],[6.43,-3.21]],[[4.64,-3.21],[6.43,-3.21]]
    ]);
    rectFloor(upper,[atticHole[0],atticHole[1],atticHole[2],atticHole[3]],upper,'Loft Stairs');

    // The loft stair rises north along the east wall, clear of both guest doors and the landing below.
    stairs(8.405,1.60,atticHole[3],atticHole[2],upper,attic,attic);
    rectFloor(attic,footprint,attic,'Attic Loft',[atticHole]);
    rectFloor(attic,atticHole,upper-.5,'Guest Floor Stairs');
    slab(attic,[-9.3,atticHole[0],-12.6,.48],'wood');
    slab(attic,[atticHole[0],atticHole[1],-12.6,atticHole[2]],'wood');
    slab(attic,[atticHole[0],atticHole[1],atticHole[3],.48],'wood');
    slab(attic,[atticHole[1],9.3,-12.6,.48],'wood');
    for(const side of [-1,1])windowWall(attic,'z',side*9.3,-12.6,.48,[-6.06],2.24,1.48,.73,2.02);
    for(const z of [-12.6,.48])wall(attic,[-9.3,z],[9.3,z],2.19);
    const loftRoof=layers.get(attic).roof,ridgeZ=-6.06,ridgeY=attic+4.35;
    for(const z of [-12.78,.66]){
      beam(loftRoof,'plank',[0,attic+2.17,z],[0,ridgeY,ridgeZ],18.8,.21);
      for(const x of [-8.9,-5.9,-2.9,0,2.9,5.9,8.9])beam(loftRoof,'beam',[x,attic+2.08,z],[x,ridgeY-.10,ridgeZ],.18,.22);
    }
    for(const side of [-1,1]){
      const slope=[[side*9.3,attic+2.21,-12.60],[side*9.3,ridgeY,-6.06],[side*9.3,attic+2.21,.48]];
      const points=slope.map(([x,y,z])=>new THREE.Vector3(x,y,z));
      const geo=geometry(new THREE.BufferGeometry().setFromPoints(side>0?points:[points[2],points[1],points[0]]));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(side>0?[0,0,.5,1,1,0]:[1,0,.5,1,0,0],2));
      geo.computeVertexNormals();
      const cap=materials.get('plaster').clone();cap.side=THREE.DoubleSide;materials.set('gable'+side,cap);
      loftRoof.add(new THREE.Mesh(geo,cap));
    }
    for(const [x,z,w,d,h] of [[-8.2,-11.52,1.46,.91,1.07],[-6.8,-11.4,.8,.77,.72],[-8.22,-1.12,1.08,.93,.91],[5.66,-.68,1.08,.72,.8],[3.26,-11.49,1.03,.94,.73]])
      crate(attic,x,z,w,d,h);
    for(const [x,z] of [[-8.6,-3.49],[7.82,-1.25],[6.72,-10.81]])barrel(attic,x,z,.42);
    for(const [x,z] of [[-5.6,-4.61],[4.63,-9.41],[6.65,-1.66]]){
      prop(attic,'wood',x,.04,z,.46,.51,.46,0,true);
      candle(attic,x,.57,z);light(attic,x,1.14,z,0xffb27b,30,8);
    }

    // The old north wall masks a service passage into a rough-hewn chamber.
    rectFloor(cellar,footprint,cellar,'A5 Storeroom');slab(cellar,footprint,'stone');enclose(cellar,3.1,'stone');
    for(const [x,z,w] of [[-8.5,-3.09,.55],[-8.43,-4.68,.57],[-7.1,-3.48,.56],[-2.79,-11.41,.49],[3.78,-11.63,.44],[5.13,-11.56,.60],[6.54,-11.61,.56],[7.96,-11.56,.6],[8.36,-9.37,.56],[8.28,-7.76,.57],[6.97,-8.27,.52]])barrel(cellar,x,z,w);
    for(const [x,z,w,d,h,angle] of [[-5.11,-1.83,1.17,.97,1.16,.08],[-4.42,-3.7,.83,.94,.96,-.13],[-.43,-1.41,1.14,1.02,.85,.07],[2.59,-2.02,1.53,1.24,1.19,.09],[4.21,-1.87,1.09,.96,.91,-.19],[7.33,-2.05,.93,1.15,1.16,.16],[7.56,-4.3,1.14,.92,1.19,-.19],[-4.65,-11.71,1.18,.72,.86,.11]])crate(cellar,x,z,w,d,h,angle);
    prop(cellar,'wood',-.11,.07,-6.2,2.24,.91,.84,0,true);candle(cellar,.61,.99,-6.21);
    for(const [x,z] of [[-5.47,-6],[0,-6.2],[5.38,-4.95],[.18,-11.62]])light(cellar,x,1.52,z,0xffb982,24,8);
    const hallPoly=ring([-1.02,1.02,-16.16,-12.6]);
    const crypt=[[-1.02,-16.16],[-3.49,-16.82],[-4.52,-19.04],[-3.85,-21.31],[-1.58,-22.67],
      [1.72,-22.53],[4.04,-20.94],[4.43,-18.83],[3.17,-16.97],[1.02,-16.16]];
    irregularFloor(cellar,hallPoly,'');irregularFloor(cellar,crypt,'Hidden Shrine');
    wall(cellar,[-1.02,-12.6],[-1.02,-16.16],2.65,'stone');
    wall(cellar,[1.02,-16.16],[1.02,-12.6],2.65,'stone');
    for(let i=1;i<crypt.length;i++)wall(cellar,crypt[i-1],crypt[i],2.73,'stone',.36);
    const chamber=layers.get(cellar).props;
    const cover=geometry(new THREE.ShapeGeometry(new THREE.Shape(crypt.map(([x,z])=>new THREE.Vector2(x,-z)))));
    const lid=new THREE.Mesh(cover,materials.get('mortar'));lid.rotation.x=Math.PI/2;lid.position.y=cellar+2.68;
    lid.scale.y=-1;layers.get(cellar).roof.add(lid);
    box(layers.get(cellar).roof,'mortar',0,cellar+2.5,-14.4,2.1,.22,3.6);
    prop(cellar,'stone3',.07,.041,-20.89,2.47,.21,1.59);
    prop(cellar,'stone',.07,.22,-21.06,1.58,.83,.86,0,true);prop(cellar,'stone3',.07,1.05,-21.06,1.89,.18,1.12);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      round(chamber,'stone2',Math.cos(a)*1.58,cellar+.014,-19.53+Math.sin(a)*.94,.31,.055);
    }
    for(const x of [-.63,.77])candle(cellar,x,1.23,-21.08);
    light(cellar,.07,1.53,-20.83,0xffaa6f,38,8);

    const secretZ=-12.49,secretX=-.97,secretW=1.94,secret=new THREE.Group();
    secret.position.set(secretX,cellar,secretZ);layers.get(cellar).props.add(secret);
    const leaf=(...args)=>meshBox(secret,...args);
    leaf('beam',.97,.03,0,1.94,2.26,.20);
    for(const x of [.085,1.85])leaf('wood',x,0,.19,.17,2.32,.28);
    for(const y of [.15,.72,1.29,1.86,2.25])leaf('plank',.97,y,.22,1.82,.10,.39);
    for(const [x,y] of [[.34,.25],[1.2,.25],[.65,.82],[1.5,1.39],[.38,1.96]])leaf('wood',x,y,.15,.28,.32,.25);
    leaf('red',.97,.56,.425,.9,1.51,.044);
    leaf('bronze',.97,1.05,.46,.32,.36,.019);
    for(let i=0;i<4;i++)leaf('bronze',.848+i*.081,1.36,.46,.062,.21-i*.031,.021);
    leaf('bronze',.791,1.13,.46,.082,.29,.022);
    leaf('bronze',1.54,1.31,.35,.074,.053,.09);
    const secretTravel=2.28;
    let secretOpen=false;
    const setSecretOpen=(open,immediate=false)=>{
      secretOpen=Boolean(open);
      if(immediate)secret.position.x=secretX+(secretOpen?secretTravel:0);
    };
    const tickSecretDoor=dt=>{
      const end=secretX+(secretOpen?secretTravel:0);
      secret.position.x+=(end-secret.position.x)*(1-Math.exp(-dt*9));
    };
    const atSecretDoor=(x,y,z)=>Math.abs(y-cellar)<1.03&&Math.abs(x)<2&&Math.abs(z-secretZ)<1.7;
    const canCloseSecret=()=>true;

    for(const {target,mat,shape,poses} of instances.values()){
      const mesh=new THREE.InstancedMesh(shape,mat,poses.length);
      poses.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();target.add(mesh);
    }
    const ambient=new THREE.HemisphereLight(0xffe6ce,0x6c6373,1.26);
    ambient.userData.baseIntensity=1.26;scene.add(ambient);lights.push(ambient);
    const surveyLight=new THREE.AmbientLight(0xffe8d5,1.4);surveyLight.visible=false;scene.add(surveyLight);
    for(let i=0;i<6;i++){
      const p=new THREE.PointLight(0xffcaa0,0,14);p.userData.baseIntensity=0;scene.add(p);lights.push(p);sightLights.push(p);
    }
    function updateLights(x,z,y=0){
      const nearest=sources.filter(s=>s.level===levelAt(y)).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
      sightLights.forEach((p,i)=>{
        const s=nearest[i];p.userData.baseIntensity=s?.power||0;
        if(s){p.color.set(s.color);p.position.set(s.x,s.y,s.z);p.distance=s.reach}
      });
    }
    function floorAt(x,z,maxY=Infinity){
      let top=-Infinity;
      for(const f of floors){
        if(x<f.xmin-.002||x>f.xmax+.002||z<f.zmin-.002||z>f.zmax+.002)continue;
        const y=f.y(x,z);
        if(y>top&&y<=maxY+.001&&inside(f.polygon,x,z)&&!f.holes.some(hole=>inside(hole,x,z)))top=y;
      }
      return top;
    }
    function blocked(x,z,y,h=1.66,fromX,fromZ){
      if(!Number.isFinite(floorAt(x,z,y+.045)))return true;
      const doorSolid=(cx,cz,width,depth)=>{
        if(Math.abs(x-cx)>=width||Math.abs(z-cz)>=depth)return false;
        if(Math.abs(fromX-cx)<width&&Math.abs(fromZ-cz)<depth&&Math.abs(z-cz)>Math.abs(fromZ-cz)+1e-5)return false;
        return true;
      };
      if(Math.abs(y-cellar)<1.03&&doorSolid(secret.position.x+secretW/2,secretZ+.09,secretW/2+.13,.30))return true;
      for(const door of roomDoors.values()){
        if(Math.abs(y-door.y)>.61)continue;
        for(const {panel} of door.leaves){
          if(doorSolid(door.x+panel.position.x,door.z,.438,.19))return true;
        }
      }
      const overlaps=o=>{
        if(y+.16>=o.y+o.h||y+h<=o.y)return false;
        const dx=x-o.x,dz=z-o.z,c=Math.cos(o.ry),s=Math.sin(o.ry);
        return Math.abs(dx*c-dz*s)<o.w/2+.15&&Math.abs(dx*s+dz*c)<o.d/2+.15;
      };
      return mapSolids.some(overlaps)||ceilings.some(o=>y+h>o.y+.08&&overlaps(o));
    }
    function survey(enabled,y,darkness){
      for(const g of groups){
        const {level,kind}=g.userData;
        g.visible=enabled?level===levelAt(y)&&kind!=='walls'&&kind!=='roof':kind!=='cut';
      }
      surveyLight.visible=enabled&&!darkness;
    }
    function dispose(){
      scene.traverse(o=>{if(o.isInstancedMesh)o.dispose()});scene.clear();
      for(const g of geos)g.dispose();
      for(const m of materials.values())m.dispose();
      tavernSurfaces?.dispose();
    }
    syncTankards();updateLights(0,-.72);survey(false,ground,false);
    return {scene,levels,levelAt,levelName,lights,sightLights,updateLights,floorAt,blocked,
      mapRects:y=>floors.filter(f=>f.id===levelAt(y)),mapSolids,survey,dispose,
      atSecretDoor,setSecretOpen,tickSecretDoor,canCloseSecret,seatNear,roomDoorNear,setRoomDoors,tickRoomDoors,
      props,actionHint,useBar,tickBar,getBarState,restoreBar,showHeld,placeTankard,drinkTankard,hasHeldTankard};
  }
  return {build};
})();
