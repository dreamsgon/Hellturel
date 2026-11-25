'use strict';
window.HighHallCrypt=function buildCrypt(builder){
  const {box,wall,arch,column,stamp,lamp,line,candle,material,slabField,useLayer,rock,ballAt,mesh,
    random,trim,chalk,stone,black,iron,brass,wood,linen,amber,ash,coal,scene,lights,sightLights}=builder;
  const base=-6.096,ceiling=base+4.57;
  const hatch=builder.altarHatch||{xmin:-1.15,xmax:1.15,zmin:-31.05,zmax:-27.8,top:.435};
  const secretSteps=35,secretRun=.218,secretBottom=hatch.zmax-secretRun*secretSteps;
  const altarOpen=builder.altarOpen||(()=>false);
  const rooms=[],links=[],floors=[];
  function room(id,label,xmin,xmax,zmin,zmax){
    const result={id,label,xmin,xmax,zmin,zmax};
    rooms.push(result);return result;
  }
  const landing=room('',null,6.08,8.92,-49,-46.2);
  const hub=room('',null,3,12,-67,-49);
  const west=room('',null,-8,3,-59,-55);
  const temple=room('H12','Temple of the Highest',-22,-8,-67,-49);
  const westTomb=room('H10','Recessed Mausoleum',-27,-22,-61,-55);
  const upperWestTomb=room('H10','Recessed Mausoleum',-27,-22,-66,-62);
  const northTomb=room('H10','Recessed Mausoleum',-21,-16,-71,-67);
  const templeTomb=room('H10','Recessed Mausoleum',-15,-10,-49,-43);
  const westVault=room('H11','Vaults',-24,-16,-49,-42);
  const sideTomb=room('H10','Recessed Mausoleum',-28,-24,-48,-43);
  const south=room('',null,-4,-1,-55,-44);
  const southVault=room('H11','Vaults',-5,2,-44,-38);
  const southTomb=room('H10','Recessed Mausoleum',-6.15,-2.10,-38,-33.80);
  const southWestTomb=room('H10','Recessed Mausoleum',-10,-5,-44,-39);
  const backPassage=room('',null,9.80,12,-49,-42);
  const backVault=room('H11','Vaults',9.80,13.8,-42,-37);
  const backTomb=room('H10','Recessed Mausoleum',13.8,18,-41,-37);
  const crossing=room('',null,-9,16,-72,-67);
  const scholars=room('H13','Hall of Scholars',-11,1,-81,-72);
  const council=room('H14','Chamber of Torm’s Council',4,19,-83,-72);
  const hero=room('H15','Unknown Hero',12,19,-64,-59);
  const westCrypt=room('',null,16,20,-72,-67);
  const lowerCrypt=room('',null,12,20,-54,-50);
  const crypt=room('H16','Main Crypts',20,39,-72,-50);
  const vaultPassage=room('',null,16.5,19.5,-50,-47);
  const eastVault=room('H11','Vaults',14,21,-47,-41);
  const eastTomb=room('H10','Recessed Mausoleum',21,26,-47,-42);
  const endTomb=room('H10','Recessed Mausoleum',18,24,-41,-36.5);
  const escape=room('H17','Escape Tunnel',25.6,28.4,-88,-72);
  const secretLanding=room('',null,hatch.xmin,hatch.xmax,-37.55,secretBottom);
  const secretTurn=room('',null,hatch.xmax,5.28,-38,secretBottom);
  const secretPassage=room('',null,3.11,5.28,-49,-38);
  const secretRoute=new Set([secretLanding,secretTurn,secretPassage]);
  function connect(a,b,center,width){links.push({a,b,center,width})}
  connect(landing,hub,7.5,2.84);
  connect(hub,west,-57,2.85);
  connect(west,temple,-57,2.85);
  connect(temple,westTomb,-58.13,1.78);
  connect(temple,upperWestTomb,-64,1.70);
  connect(temple,northTomb,-18.4,1.74);
  connect(temple,templeTomb,-12.5,1.76);
  connect(temple,westVault,-19.55,1.76);
  connect(westVault,sideTomb,-45.2,1.65);
  connect(west,south,-2.5,2.08);
  connect(south,southVault,-2.5,2.08);
  connect(southVault,southTomb,-3.75,1.7);
  connect(southVault,southWestTomb,-41.5,1.69);
  connect(hub,backPassage,10.89,1.82);
  connect(backPassage,backVault,10.89,1.82);
  connect(backVault,backTomb,-39,1.65);
  connect(hub,crossing,7.35,3.45);
  connect(crossing,scholars,-4.55,2.1);
  connect(crossing,council,9.8,2.5);
  connect(hub,hero,-61.5,2.5);
  connect(crossing,westCrypt,-69.5,3.14);
  connect(westCrypt,crypt,-69.5,3.14);
  connect(hub,lowerCrypt,-52,2.8);
  connect(lowerCrypt,crypt,-52,2.8);
  connect(lowerCrypt,vaultPassage,18,2.08);
  connect(vaultPassage,eastVault,18,2.08);
  connect(eastVault,eastTomb,-44.2,1.72);
  connect(eastVault,endTomb,19.45,1.65);
  connect(crypt,escape,27,2.08);
  connect(secretLanding,secretTurn,-36.52,1.86);
  connect(secretTurn,secretPassage,(secretPassage.xmin+secretPassage.xmax)/2,secretPassage.xmax-secretPassage.xmin);
  connect(secretPassage,hub,4.20,1.76);

  const wallTint=material(0x858278,'wall-stone');
  const redOak=material(0x714536,'grain');
  const paleCloth=material(0xb1a08a);
  const water=material(0x58747b,null,{roughness:.22,metalness:.18});
  const copper=material(0x625046,null,{metalness:.46});
  const escapeStone=material(0x51464b,'cliff');
  const darkCeiling=material(0x5f5a56,'wall-plaster');

  function floor(rect,y,spacing=1.12,mat=black){
    floors.push({...rect,y});
    slabField(rect.xmin,rect.xmax,rect.zmin,rect.zmax,y,spacing,mat);
  }
  useLayer('crypt');
  for(const r of rooms){
    if(r===hero||r===escape)continue;
    floor(r,base,r===crypt?1.26:1.12,r===temple||r===council?trim:black);
  }
  for(let i=0;i<5;i++){
    const x0=12+i*.47;
    floor({...hero,xmin:x0,xmax:x0+.47},base+i*.147,.63,trim);
  }
  floor({...hero,xmin:14.35},base+.735,.96,trim);
  for(let i=0;i<9;i++){
    const z0=-72-i*.43;
    floor({...escape,zmin:z0-.43,zmax:z0},base-i*.15,.57,black);
  }
  floor({...escape,zmin:-87.24,zmax:-75.87},base-1.35,1.1,escapeStone);
  floors.push({...escape,zmax:-87.24,y:base-1.35});
  const treadTop=hatch.top-.02,firstRise=.193,lowerRise=(treadTop-base-16*firstRise)/(secretSteps-16);
  function secretStepY(index){
    return treadTop-Math.min(index,16)*firstRise-Math.max(0,index-16)*lowerRise;
  }
  useLayer('stairs');
  for(let i=0;i<secretSteps;i++){
    const z=hatch.zmax-i*secretRun,y=secretStepY(i);
    const step={xmin:hatch.xmin,xmax:hatch.xmax,zmin:z-secretRun,zmax:z,y};
    floors.push(step);
    box(trim,0,y-.09,z-secretRun/2,hatch.xmax-hatch.xmin,.18,secretRun);
    for(const x of [hatch.xmin-.20,hatch.xmax+.20]){
      const top=Math.min(hatch.top,y+2.22),height=top-y+.32;
      box(black,x,top-height/2,z-secretRun/2,.40,height,secretRun,true);
    }
  }
  useLayer('crypt');

  function roomEdges(r){
    return [
      {axis:'x',side:'zmin',opposite:'zmax',at:r.zmin,min:r.xmin,max:r.xmax,dir:-1},
      {axis:'x',side:'zmax',opposite:'zmin',at:r.zmax,min:r.xmin,max:r.xmax,dir:1},
      {axis:'z',side:'xmin',opposite:'xmax',at:r.xmin,min:r.zmin,max:r.zmax,dir:-1},
      {axis:'z',side:'xmax',opposite:'xmin',at:r.xmax,min:r.zmin,max:r.zmax,dir:1}
    ];
  }
  function openings(r,edge){
    if(r===landing&&edge.side==='zmax')return [{lo:edge.min,hi:edge.max}];
    if(r===secretLanding&&edge.side==='zmax')return [{lo:edge.min,hi:edge.max}];
    if(r===escape&&edge.side==='zmin')return [{lo:edge.min,hi:edge.max}];
    return links.flatMap(link=>{
      if(link.a!==r&&link.b!==r)return [];
      const next=link.a===r?link.b:link.a;
      if(next[edge.opposite]!==edge.at)return [];
      return [{lo:link.center-link.width/2,hi:link.center+link.width/2,link}];
    }).sort((a,b)=>a.lo-b.lo);
  }
  const portals=new Set();
  for(const r of rooms){
    const bottom=r===escape?base-1.35:base;
    const finish=r===temple||r===council||r===crypt?wallTint:black;
    for(const edge of roomEdges(r)){
      let cursor=edge.min;
      for(const opening of openings(r,edge)){
        if(opening.lo>cursor+.01)wall(edge.axis,edge.at+edge.dir*.425,cursor,opening.lo,bottom,ceiling,finish);
        if(opening.link&&!portals.has(opening.link)){
          portals.add(opening.link);
          const {center,width}=opening.link;
          const portalY=base+2.16;
          arch(center,portalY,edge.at,width,.44,.23,trim,edge.axis);
          wall(edge.axis,edge.at,opening.lo,opening.hi,base+2.70,ceiling,finish);
          for(const side of [-1,1]){
            const mark=center+side*(width/2+.045),length=portalY-base;
            const [x,z]=edge.axis==='x'?[mark,edge.at]:[edge.at,mark];
            box(trim,x,base+length/2,z,edge.axis==='x'?.16:.36,length,edge.axis==='x'?.36:.16);
          }
        }
        cursor=opening.hi;
      }
      if(cursor<edge.max-.01)wall(edge.axis,edge.at+edge.dir*.425,cursor,edge.max,bottom,ceiling,finish);
    }
    useLayer('cryptRoof');
    const height=r===escape?base+2.9:ceiling;
    box(darkCeiling,(r.xmin+r.xmax)/2,height+.08,(r.zmin+r.zmax)/2,r.xmax-r.xmin,.20,r.zmax-r.zmin);
    useLayer('crypt');
  }
  function chamberRibs(r,along){
    useLayer('cryptRoof');
    const span=r.xmax-r.xmin-.14;
    for(const z of along)arch((r.xmin+r.xmax)/2,base+3.05,z,span,1.54,.24,trim);
    useLayer('crypt');
  }
  chamberRibs(temple,[-64.6,-60.25,-55.8,-51.1]);
  chamberRibs(council,[-81.2,-77.6,-74.15]);
  chamberRibs(crypt,[-69.5,-64.5,-59.5,-54.5]);

  function sarcophagus(x,z,angle=0,decorated=false){
    box(black,x,base+.15,z,2.28,.30,1.04,true,angle);
    box(stone,x,base+.42,z,2.18,.48,.96,true,angle);
    box(decorated?chalk:trim,x,base+.70,z,2.32,.16,1.06,true,angle);
    const dx=Math.cos(angle),dz=-Math.sin(angle);
    const face=[x+dx*.57,base+.831,z+dz*.57];
    ballAt(decorated?brass:trim,...face,.31,.14,.28);
    if(decorated)line(brass,[x-dx*.68,base+.798,z-dz*.68],[x+dx*.22,base+.798,z+dz*.22],.043);
  }
  function upright(x,z,angle){
    box(black,x,base+.15,z,.98,.3,.49,true,angle);
    box(trim,x,base+1.36,z,.86,2.22,.43,true,angle);
    stamp(rock,chalk,x,base+2.52,z,.83,.54,.51,angle);
    const nx=Math.sin(angle),nz=Math.cos(angle);
    box(brass,x+nx*.24,base+1.66,z+nz*.24,.24,.37,.046,false,angle);
    const tx=Math.cos(angle),tz=-Math.sin(angle);
    const axis=Math.abs(tx)>.5?'x':'z',depth=.42;
    const [center,offset]=axis==='x'?[x,z+nz*depth]:[z,x+nx*depth];
    arch(center,base+2.55,offset,1.32,.37,.18,trim,axis);
    for(const side of [-1,1]){
      const bx=x+tx*side*.67+nx*depth,bz=z+tz*side*.67+nz*depth;
      column(stone,bx,base+1.30,bz,.18,2.6);
    }
  }
  for(const r of rooms.filter(r=>r.id==='H10')){
    const x=(r.xmin+r.xmax)/2,z=(r.zmin+r.zmax)/2;
    const door=roomEdges(r).find(edge=>openings(r,edge).length);
    const acrossX=door.axis==='x';
    const spread=Math.min(1.72,(acrossX?r.xmax-r.xmin:r.zmax-r.zmin)/2-.61);
    for(const offset of [-spread,spread])sarcophagus(x+(acrossX?offset:0),z+(acrossX?0:offset),
      acrossX?Math.PI/2:0,true);
    for(const side of [-1,1])candle(x+side*.54,base,z+.28,.19);
  }
  for(const r of rooms.filter(r=>r.id==='H11')){
    const x=(r.xmin+r.xmax)/2;
    for(const side of [-1,1]){
      let tx=x+side*1.28,z=side<0?r.zmin+.81:r.zmax-.81;
      if(r===southVault&&side<0){tx=x+1.10;z=r.zmin+.85;}
      if(r===eastVault&&side>0)tx=r.xmin+1.52;
      if(r===backVault){tx=x+.3;z=side<0?r.zmin+2.08:r.zmax-.81;}
      box(wood,tx,base+.53,z,2.46,.14,.93,true);
      for(const dx of [-.91,.91])box(coal,tx+dx,base+.24,z,.24,.49,.72);
      box(paleCloth,tx-.61,base+.64,z,.47,.08,.54,false,.12);

    }
  }
  for(const z of [-64.9,-62.17,-54.25,-51.5]){
    upright(-20.96,z,Math.PI/2);
    upright(-9.05,z,-Math.PI/2);
  }
  for(const x of [-17.8,-13.45]){
    upright(x,-65.96,0);upright(x,-50.02,Math.PI);
  }
  for(const x of [-18.2,-11.5]){
    column(stone,x,base+1.8,-58.3,.86,3.6);
    column(trim,x,base+.22,-58.3,1.1,.44);
  }
  column(black,-14.95,base+.46,-61.4,1.47,.92);
  column(chalk,-14.95,base+.96,-61.4,1.8,.22);
  for(const x of [-15.43,-15.14,-14.82,-14.52])candle(x,base+1.07,-61.44,.16+random()*.14);

  function boneShelf(x,z,angle){
    const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle);
    const depth=.59,width=1.30;
    box(black,x,base+.95,z,width,1.9,depth,true,angle);
    box(trim,x+nx*.13,base+1.12,z+nz*.13,width+.13,.14,depth+.32,false,angle);
    const bx=x+nx*.51,bz=z+nz*.51;
    ballAt(chalk,bx-.35*tx,base+1.31,bz-.35*tz,.23,.24,.24);
    for(let i=0;i<3;i++)line(trim,[bx-.11*tx,base+1.212+i*.032,bz-.11*tz],
      [bx+(.39-i*.055)*tx,base+1.24,bz+(.34-i*.055)*tz+i*.044],.032);
  }
  for(const x of [-9.5,-7.26,-5.03,-2.8,-.56])boneShelf(x,-80.37,0);
  for(const z of [-78.8,-76.52,-74.3]){
    boneShelf(-10.38,z,Math.PI/2);boneShelf(.38,z,-Math.PI/2);
  }
  for(const x of [-8,-6.05,-4.1,-2.15])candle(x,base,-79.19,.2);

  const tableX=11.7,tableZ=-77.46;
  column(wood,tableX,base+.44,tableZ,3.16,.88,1.8);
  column(redOak,tableX,base+.91,tableZ,8.8,.22,3.35);
  box(wood,tableX,base+.54,tableZ,7.9,1.08,2.62,true);
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,x=tableX+5.05*Math.cos(a),z=tableZ+2.15*Math.sin(a);
    const angle=Math.atan2(Math.cos(a),Math.sin(a));
    box(redOak,x,base+.29,z,.46,.11,.45,false,angle);
    box(wood,x+Math.cos(a)*.17,base+.65,z+Math.sin(a)*.17,.45,.67,.091,false,angle);
    for(const offset of [-.12,.12])box(wood,x+offset,base+.13,z,.051,.27,.29,false,angle);
  }
  for(const x of [9.3,11.6,14.15]){
    box(linen,x,base+1.029,tableZ+.15,.59,.018,.38,false,.14);
    candle(x+.24,base+1.025,tableZ-.34,.16);
  }

  const bier=base+.735;
  box(stone,17.42,bier+.35,-61.48,2.36,.70,1.10,true);
  box(chalk,17.42,bier+.75,-61.48,2.55,.16,1.24,true);


  line(iron,[16.54,bier+.857,-61.09],[18.16,bier+.875,-61.09],.056,.023);
  line(brass,[17.82,bier+.895,-61.24],[17.82,bier+.895,-60.96],.05);
  for(const x of [16.2,18.52])for(const z of [-62.15,-60.82])candle(x,bier+.02,z,.20+random()*.19);

  for(const z of [-65.7,-56.25])for(const x of [23.58,27.1,31.12,35.77]){
    box(black,x,base+1.52,z,.77,3.04,.77,true);
    box(stone,x,base+.18,z,1.08,.36,1.08);
    box(trim,x,base+3.13,z,1.02,.23,1.02);
  }
  function font(x,z){
    column(stone,x,base+.22,z,1.82,.44);
    column(chalk,x,base+.57,z,1.18,.59);
    column(trim,x,base+.89,z,1.92,.35);
    column(water,x,base+1.08,z,1.42,.032);
  }
  font(33.6,-61.02);font(28.63,-70.55);
  box(coal,26.84,base+.07,-71.06,1.56,.18,.82,false,.15);
  for(const z of [-68.25,-63.3,-57.8,-52.6])sarcophagus(37.34,z,Math.PI/2,true);
  for(const x of [23.2,30.2,36.35])sarcophagus(x,-51.13,0,false);
  // Folded blankets and a closed register remain beside the water fonts.
  for(const [x,z] of [[22.6,-63.4],[34.1,-68.8],[35.4,-55.1]]){
    box(linen,x,base+.06,z,.82,.12,.54,false,.12);
    box(paleCloth,x+.06,base+.16,z,.70,.08,.46,false,.18);
  }
  box(redOak,32.2,base+.41,-61.4,.77,.82,.64,true);
  box(linen,32.2,base+.85,-61.4,.49,.07,.32,false,.13);
  for(const [x,z,y,width] of [[7.5,-50.62,base+1.7,.7],[-12.27,-65.6,base+1.65,.67],
    [-9.95,-75.65,base+1.6,.63],[6.25,-80.95,base+1.48,.68],[17.45,-74.35,base+1.45,.67],
    [23.55,-69.05,base+1.62,.72],[36.33,-63.9,base+1.55,.66],[31.67,-54.32,base+1.53,.69]]){
    column(iron,x,(base+y)/2,z,.12,y-base);
    lamp(x,y,z,width);
  }
  for(let i=0;i<9;i++){
    const z=-77-i*1.16,side=i%2===0?1:-1;
    stamp(rock,i%3?escapeStone:ash,27+side*(.91+random()*.32),base-1.25,z,.66,.32,.83,random()*3,.2,.4);
  }
  function escapeBreach(){
    const y=base-1.35;
    const shape=new THREE.BufferGeometry(),positions=[],uv=[];
    const add=(a,b,c)=>{
      for(const vertex of [a,b,c]){
        const [x,h,z]=vertex;
        positions.push(x,h,z);uv.push((x+(z+88)*.46)*.53,(h+z*.31)*.61);
      }
    };
    const quad=(a,b,c,d)=>{add(a,b,c);add(a,c,d)};
    const inside=[
      [25.63,y,-87.24],[25.56,y+.93,-87.41],[25.67,y+2.24,-87.51],[25.93,y+3.42,-87.45],
      [26.47,y+3.86,-87.50],[27.14,y+3.98,-87.54],[27.89,y+3.64,-87.49],
      [28.35,y+2.87,-87.52],[28.47,y+1.70,-87.48],[28.38,y,-87.24]
    ];
    const breakLine=[
      [25.46,y-.04,-88.12],[25.32,y+1.05,-88.23],[25.48,y+2.18,-88.05],[25.82,y+3.31,-88.18],
      [26.38,y+3.70,-88.06],[27.06,y+3.86,-88.31],[27.84,y+3.47,-88.12],
      [28.51,y+2.77,-88.17],[28.58,y+1.56,-88.24],[28.54,y-.03,-88.15]
    ];
    for(let i=1;i<inside.length;i++){
      const a=inside[i-1],b=inside[i],c=breakLine[i],d=breakLine[i-1];
      quad(a,d,c,b);
      const direction=i<5?-1:1;
      const left=[d[0]+direction*.58,d[1]+.36,d[2]-.11],right=[c[0]+direction*.69,c[1]+.42,c[2]-.12];
      quad(d,c,right,left);
    }
    const start=[[25.63,y,-87.24],[26.35,y+.018,-87.24],[27.17,y+.013,-87.24],[28.38,y,-87.24]];
    const gap=[breakLine[0],[26.42,y-.025,-88.03],[27.33,y-.05,-88.18],breakLine.at(-1)];
    for(let i=1;i<start.length;i++){
      quad(start[i-1],start[i],gap[i],gap[i-1]);
      const a=gap[i-1],b=gap[i];
      quad(a,b,[b[0]+.11,b[1]-.88,b[2]+.14],[a[0]-.12,a[1]-1.24,a[2]+.36]);
    }
    shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    shape.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    shape.computeVertexNormals();
    mesh(shape,escapeStone);
    for(const [x,z,w,h,d,t] of [[25.46,-87.54,.51,.29,.62,.28],[28.28,-87.30,.59,.22,.55,.81],
      [25.71,-87.02,.34,.11,.26,.63],[28.42,-87.85,.37,.42,.46,-.25]]){
      stamp(rock,escapeStone,x,y+h*.24,z,w,h,d,t,.17,.23);
    }
  }
  escapeBreach();
  for(let i=0;i<8;i++){
    const x=26.82+(random()-.5)*3.2,z=-88.2-random()*8.5;
    ballAt(amber,x,base-3-random()*5,z,.052,.067,.052);
  }
  const secretLever={x:.82,z:-35.76};
  box(black,secretLever.x,base+.54,secretLever.z,.41,1.08,.37,true);
  box(iron,secretLever.x,base+1.03,secretLever.z,.38,.12,.31);
  line(brass,[secretLever.x,base+1.07,secretLever.z],[secretLever.x-.26,base+1.51,secretLever.z-.09],.065);
  ballAt(wood,secretLever.x-.26,base+1.51,secretLever.z-.09,.13,.105,.13);
  candle(.72,base+.13,-36.85,.18);
  candle(4.91,base+.13,-42.2,.19);
  useLayer('crypt');

  const lightAnchors=[[7.5,-50.62],[-14.75,-58.8],[-5.5,-76.1],[11.63,-77.46],
    [16.5,-62.03],[27.98,-61.67],[36.4,-67.3],[27.0,-73.3],[.63,-35.76],[4.48,-42.2]];
  const pooledLights=[58,42].map(intensity=>{
    const light=new THREE.PointLight(0xe8a178,intensity,11.4,2);
    light.userData.baseIntensity=intensity;
    scene.add(light);lights.push(light);sightLights.push(light);
    return light;
  });
  function updateLights(x,z){
    const anchors=lightAnchors.slice().sort(([ax,az],[bx,bz])=>
      (ax-x)**2+(az-z)**2-(bx-x)**2-(bz-z)**2);
    for(const [i,light] of pooledLights.entries())light.position.set(anchors[i][0],base+2.25,anchors[i][1]);
  }
  updateLights(7.5,-48);

  function floorAt(x,z,maxY=Infinity){
    let top=-Infinity;
    for(const rect of floors){
      if(rect.y<=maxY&&x>=rect.xmin&&x<=rect.xmax&&z>=rect.zmin&&z<=rect.zmax)top=Math.max(top,rect.y);
    }
    return top;
  }
  function blocked(x,z,y,height){
    if(altarOpen()||x<hatch.xmin-.2||x>hatch.xmax+.2||z<hatch.zmin-.2||z>hatch.zmax+.2)return false;
    return y<hatch.top-.10&&y+height>hatch.top-.13;
  }
  function atAltarLever(x,y,z){
    return Math.hypot(x-secretLever.x,z-secretLever.z)<1.36&&Math.abs(y-base)<.9;
  }
  function inSecretPassage(x,z){
    return [...secretRoute].some(r=>x>=r.xmin&&x<=r.xmax&&z>=r.zmin&&z<=r.zmax);
  }
  return {floorAt,blocked,mapRects:known=>known||altarOpen()?rooms:rooms.filter(r=>!secretRoute.has(r)),
    inSecretPassage,updateLights,atAltarLever};
};
