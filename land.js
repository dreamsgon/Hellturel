'use strict';
const Elturel = (() => {
  const ft = .3048;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
  const dist = (a,b,c,d) => Math.hypot(a-c,b-d);
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  const outline = [[-485,212],[-520,81],[-471,-83],[-387,-214],[-253,-324],[-95,-342],
    [39,-315],[167,-322],[323,-296],[431,-259],[507,-159],[523,-44],[504,126],
    [466,242],[404,283],[307,277],[256,312],[196,295],[139,319],[41,282],
    [-67,302],[-116,283],[-190,302],[-227,276],[-338,295],[-373,253],[-439,254]];
  const wallLine = [...outline.slice(0,14),[474,260]];
  const gorge = [[18,-340],[25,-277],[43,-223],[30,-164],[22,-116],[3,-55],[-9,2],[-23,68],[-23,120],[-42,176],[-36,235],[-32,305]];
  const oldGarden = [[-72,236],[-79,195],[-64,150],[-63,106],[-55,75],[-47,38],[-40,0],[-30,-43],[-19,-83],[-16,-117],[-5,-164],[-11,-188]];
  // The spring head sits in the open curtain gap below the cathedral forecourt.
  const garden = [[-95,219],[-93,204],[-94,185],[-86,161],[-79,148],[-73,125],[-76,109],[-71,89],[-74,76],[-70,61],[-61,49],[-61,35],[-51,19],[-48,3],[-51,-9],[-39,-29],[-40,-44],[-30,-62],[-28,-79],[-20,-98],[-25,-115],[-18,-134],[-24,-150],[-23,-163],[-35,-178],[-48,-194]];
  const canal = [[-48,-194],[-22,-222],[38,-245],[113,-262],[188,-264],[246,-256],[314,-264],[387,-239],[442,-192],[471,-147],[475,-65],[460,20],[468,90],[453,142],[431,185],[408,235],[395,295]];
  const river = [[-1600,410],[-943,486],[-560,407],[-246,391],[34,381],[282,419],[482,421],[799,318],[1350,275],[2300,380]];
  const pond = {x:-306,z:73,r:11,level:7.1};
  const chains=[[-467,176,-161,64],[-459,-102,-160,-105],[-321,-279,-74,-157],[-103,-326,-11,-178],
    [224,-297,64,-169],[484,-193,160,-51],[482,128,143,104],[301,280,65,145]];
  const furrow = (x,z) => Math.sin(x*.11+z*.069)*1.15+Math.sin(z*.054-x*.043)*1.65;
  function segment(x,z,a,b) {
    const dx=b[0]-a[0], dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    return {t,d:dist(x,z,a[0]+t*dx,a[1]+t*dz)};
  }
  const pathParts=new WeakMap();
  function pathDistance(x,z,path) {
    let parts=pathParts.get(path);
    if(!parts){
      parts=path.slice(1).map(([bx,bz],i)=>{
        const [ax,az]=path[i],dx=bx-ax,dz=bz-az;
        return [ax,az,dx,dz,1/(dx*dx+dz*dz||1)];
      });
      pathParts.set(path,parts);
    }
    let d=Infinity;
    for(const [ax,az,dx,dz,inv] of parts){
      const px=x-ax,pz=z-az,t=clamp((px*dx+pz*dz)*inv,0,1);
      const ox=px-t*dx,oz=pz-t*dz;
      d=Math.min(d,ox*ox+oz*oz);
    }
    return Math.sqrt(d);
  }
  function inside(x,z,poly) {
    let hit=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const [a,b]=poly[i],[c,d]=poly[j];
      if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
    }
    return hit;
  }
  const closedOutline=[...outline,outline[0]];
  const cliff = (x,z) => pathDistance(x,z,closedOutline);
  const riftWidth = z => 26+5*Math.sin(z*.033)+3*Math.sin(z*.083);
  const bluffPath = [[-79,247],[-65,174],[-49,99],[-36,25],[-19,-47],[-7,-113],[-9,-168]];
  function riftCenter(z) {
    for(let i=1;i<gorge.length;i++){
      const [a,az]=gorge[i-1],[b,bz]=gorge[i];
      if(z<=bz)return mix(a,b,clamp((z-az)/(bz-az),0,1));
    }
    return gorge.at(-1)[0];
  }
  function plateau(x,z) {
    const d=pathDistance(x,z,bluffPath);
    return 34*(1-smooth(48,100,d))*smooth(-224,-163,z)*(1-smooth(247,293,z))*(1-smooth(riftCenter(z)-12,riftCenter(z)+8,x));
  }
  function gardenLevel(z){
    return 4.85+smooth(-193,-161,z)*(31.4+Math.max(0,z+161)*.015);
  }
  const terraces=[];
  const cemeteryPit={x:-414.3,z:171.6,r:5.4};
  function surfaceBase(x,z) {
    let y=9+1.2*Math.sin(x*.011+z*.006)+1.2*Math.sin(z*.015)+.3*Math.sin(x*.049-z*.037);
    y+=plateau(x,z);
    // A low ridge rises behind the warehouses; the quays lie on its southern foot.
    if(x>60)y+=6.8*(1-smooth(0,138,dist(x,z,361,-112)))+3.8*(1-smooth(0,88,dist(x,z,163,173)));
    if(x>200&&x<253&&z>28&&z<61)y-=.59*(1-smooth(0,13,dist(x,z,231,44)));
    if(x>297&&x<343&&z>216&&z<267)y-=.87*(1-smooth(1,18,dist(x,z,320,242)));
    const stream=pathDistance(x,z,canal), falls=pathDistance(x,z,garden);
    if(stream<23)y=mix(.9,y,smooth(8,19,stream));
    if(falls<12){
      const width=4.4+.8*Math.sin(z*.13)+.65*Math.sin(z*.31);
      const margin=falls-width;
      const bed=gardenLevel(z)-2.3+4.3*smooth(-2,2,margin);
      y=mix(bed,y,smooth(1.5,7,margin));
    }
    const forecourt=(1-smooth(1.65,3.6,Math.abs(x+94)))*smooth(224.8,226.3,z)*(1-smooth(230,231.1,z));
    y=mix(y,42.62,forecourt);
    y-=7.9*(1-smooth(6,14,dist(x,z,pond.x,pond.z)));
    y-=8.2*(1-smooth(1.7,cemeteryPit.r,dist(x,z,cemeteryPit.x,cemeteryPit.z)));
    if(x<-54&&x>-145)for(const pad of terraces){
      const dx=x-pad.x,dz=z-pad.z;
      if(Math.abs(dx)>pad.radius||Math.abs(dz)>pad.radius)continue;
      const margin=Math.max(Math.abs(dx*pad.c-dz*pad.s)-pad.w/2,Math.abs(dx*pad.s+dz*pad.c)-pad.d/2);
      y=mix(clamp(y,pad.level-1.1,pad.level+.03),y,smooth(.8,4.3,margin));
    }
    return y;
  }
  function surface(x,z){
    const y=surfaceBase(x,z),q=segment(x,z,[-59,63],[33,81]);
    // Cut the western bridge approach into the high bluff instead of burying
    // the sloping deck several metres inside solid terrain.
    if(q.d>=8.5)return y;
    const deck=mix(42.99815532978139,10.851031271880492,q.t)-.16;
    return mix(Math.min(y,deck),y,smooth(5.2,8.5,q.d));
  }
  function plainHeight(x,z){
    const riverDist=pathDistance(x,z,river),meander=12*Math.sin(x*.019)+7*Math.sin(x*.051+z*.01);
    const plain=-135+8*Math.sin(x*.009+z*.006)+7*Math.cos(x*.018-z*.014)+furrow(x,z)*1.7;
    let y=mix(-169+furrow(x,z),plain,smooth(103+meander,166+meander,riverDist));
    if(Math.abs(x)<90&&z>-348&&z<325){
      const d=pathDistance(x,z,gorge);
      const width=14+3.8*Math.sin(z*.084)+2.6*Math.sin(z*.21);
      const bed=-165+furrow(x,z)*1.4;
      y=mix(y,Math.min(y,mix(bed,plain,smooth(width-3,width+8,d))),smooth(-348,-315,z)*(1-smooth(283,325,z)));
    }
    return y;
  }
  // The plain is triangulated on an 18-metre lattice. Use its actual triangle
  // height for feet, river depth and chain anchors as well as the visible mesh.
  const plainSamples=new Map();
  function nodeHeight(i,j){
    const key=(i+300)*601+j+300;
    if(!plainSamples.has(key))plainSamples.set(key,plainHeight(i*18,j*18));
    return plainSamples.get(key);
  }
  function avernusFloor(x,z){
    const i=Math.floor(x/18),j=Math.floor(z/18),u=x/18-i,v=z/18-j;
    if(u+v<=1)return (1-u-v)*nodeHeight(i,j)+u*nodeHeight(i+1,j)+v*nodeHeight(i,j+1);
    return (u+v-1)*nodeHeight(i+1,j+1)+(1-u)*nodeHeight(i,j+1)+(1-v)*nodeHeight(i+1,j);
  }
  const island=(x,z)=>inside(x,z,outline)&&pathDistance(x,z,gorge)>riftWidth(z)-2;
  // Match the sampled, relaxed triangles used by islandChunk, including its rim.
  const islandStep=2.7,islandOriginX=-648,islandOriginZ=-486;
  const cellCache=new Map();
  function islandCell(i,j){
    const key=i+':'+j;
    if(!cellCache.has(key))cellCache.set(key,island(islandOriginX+(i+.5)*islandStep,islandOriginZ+(j+.5)*islandStep)?1:0);
    return cellCache.get(key);
  }
  function islandVertex(i,j){
    let x=islandOriginX+i*islandStep,z=islandOriginZ+j*islandStep;
    const a=islandCell(i-1,j-1),b=islandCell(i,j-1),c=islandCell(i,j),d=islandCell(i-1,j);
    const dx=a+d-b-c,dz=a+b-c-d,len=Math.hypot(dx,dz)||1,count=a+b+c+d;
    const relax=count===1?-.34:count===3?.34:0;
    x+=islandStep*relax*dx/len;z+=islandStep*relax*dz/len;
    return [x,z,surface(x,z)];
  }
  function islandSurface(x,z){
    const ci=Math.floor((x-islandOriginX)/islandStep),cj=Math.floor((z-islandOriginZ)/islandStep);
    for(let j=cj-1;j<=cj+1;j++)for(let i=ci-1;i<=ci+1;i++){
      if(!islandCell(i,j))continue;
      const p=[islandVertex(i,j),islandVertex(i+1,j),islandVertex(i,j+1),islandVertex(i+1,j+1)];
      for(const [a,b,c] of [[p[0],p[2],p[1]],[p[1],p[2],p[3]]]){
        const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(det)<1e-9)continue;
        const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/det;
        const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/det,w=1-u-v;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)return u*a[2]+v*b[2]+w*c[2];
      }
    }
    return -Infinity;
  }
  // The underside varies independently of the city surface, leaving open air below.
  const underside=(x,z)=>-55+9*Math.sin(x*.018+z*.011)+7*Math.sin(z*.027-x*.013)+3*Math.sin(x*.075+z*.048);
  function terrain(x,z) {return island(x,z)?surface(x,z):avernusFloor(x,z)}
  const bridgeDefs = [
    {id:'reach',x1:-86,z1:-230,x2:88,z2:-213,w:10, name:'Torm’s Reach'},
    {id:'blade',x1:-59,z1:63,x2:33,z2:81,w:10, name:'Torm’s Blade'},
    {id:'garden-footbridge',x1:-62,z1:64,x2:-83,z2:77,w:4.8,name:'Garden Footbridge'},
    {id:'maiden',x1:-81,z1:-205,x2:-12,z2:-251,w:8,name:'Maiden’s Bridge'},
    {id:'dusk-bridge',x1:385,z1:-212,x2:403,z2:-247,w:9,name:'Dusk Gate bridge'}
  ];
  const bridges=bridgeDefs.map(b=>({...b,y1:surface(b.x1,b.z1)+.12,y2:surface(b.x2,b.z2)+.12}));
  const places=[
    {id:'dock',name:'Dock District',district:'East Elturel',x:243,z:48,look:[144,3],note:'Trading houses and shuttered lanes above Dragoneye Docks.'},
    {id:'chains',name:'Above the Styx',district:'Avernus',x:510,z:703,altitude:139,look:[-59,32],pitch:-.23,note:'An aerial view of Elturel, its broken bluff and the chains that run down to the plain. You arrive in flight.'},
    {id:'east-anchor',name:'Eastern Chain Anchor',district:'Avernus',x:686,z:160,look:[481,132],pitch:.42,note:'From the ash plain, the chain leads up past the broken rock to the eastern wall.'},
    {id:'market',name:'Shiarra’s Market',district:'Dock District',x:278,z:142,look:[-23,100],note:'A soup line and shelter tents fill the old market square.'},
    {id:'dragoneye',name:'Dragoneye Docks',district:'Dock District',x:308,z:242,look:[308,354],note:'Warehouse yards, broken wharves and an overturned ferry.'},
    {id:'hall-vista',name:'High Hall Vista',district:'Dock District',x:77,z:260,look:[-94,241],pitch:.18,note:'A timber landing overlooks the rift and the towers of High Hall.'},
    {id:'coster',name:'Dragoneye Coster',district:'Dock District',x:178,z:226,look:[197,244],note:'The stone counting house of the river traders.'},
    {id:'dock-house',name:'The Dock House',district:'Dock District',x:376,z:190,look:[393,189],note:'The harbormaster’s old house above the wharves.'},
    {id:'lava-docks',name:'Canal Docks',district:'Dock District',x:438,z:-55,look:[480,-74],note:'The old inlet now carries molten rock.'},
    {id:'twin-suns',name:'Keep of the Twin Suns',district:'Dock District',x:373,z:-197,look:[367,-211],note:'A scorched keep behind Dusk Gate.'},
    {id:'antlers',name:'A Pair of Black Antlers',district:'Dock District',x:69.01,z:-114.65,look:[68,-123],note:'Ontharr Frume and the Order of the Gauntlet once met in this taproom. Guest rooms stand above it, and a stone cellar below.'},
    {id:'reach',name:'Torm’s Reach',district:'The Rift',x:59,z:-216,look:[-60,-230],note:'The northern span over the divided city.'},
    {id:'blade',name:'Torm’s Blade',district:'The Rift',x:0,z:74,look:[-100,49],note:'The steep southern span climbs toward High District.'},
    {id:'maiden',name:'Maiden’s Bridge',district:'North Elturel',x:-58,z:-216,look:[-13,-186],note:'A stone span by the canal and Maiden’s Leap.'},
    {id:'shieldhall',name:'Helm’s Shieldhall',district:'Westerly',x:-218,z:-172,look:[-236,-155],note:'Fortress temple and citadel of the Hellriders.'},
    {id:'west-gate',name:'West Gate',district:'Westerly',x:-326,z:-228,look:[-398,-243],note:'The old road ends above one of the infernal chains.'},
    {id:'cemetery',name:'Grand Cemetery',district:'Westerly',x:-338,z:158,look:[-390,158],note:'Follow the stones through the broken brass gate to the Walk of Bravery.'},
    {id:'west-docks',name:'West Docks',district:'Westerly',x:-289,z:248,look:[-288,320],note:'The travelhouses still overlook the broken quay.'},
    {id:'switchback',name:'Western Switchback',district:'Westerly',x:-161,z:152,look:[-139,88],note:'The old carriage route climbs the western slope.'},
    {id:'gardens',name:'The Gardens',district:'High District',x:-84,z:-4,look:[-47,-49],note:'Withered bowers and the lava stream above Maiden’s Leap.'},
    {id:'leap',name:'Maiden’s Leap',district:'High District',x:-39,z:-158,look:[-15,-201],note:'The spring from High Hall falls into the north canal.'},
    {id:'hall',name:'High Hall',district:'High District',x:-103,z:202,look:[-97,233],note:'Three towers still stand over the soot-stained alabaster cathedral.'},
    {id:'vesh',name:'Vesh House',district:'Dock District',x:219,z:42,look:[218,46],note:'A shuttered sailmaker’s house. The cut cloth is still pegged to its drying frame.'},
    {id:'yard',name:'Bell’s Wash Yard',district:'Westerly',x:-289,z:73,look:[-317,75],note:'A rain cistern and laundry court behind the cooper’s house.'},
    {id:'stair',name:'Orrel Stair',district:'High District',x:-103,z:81,look:[-65,71],note:'A terrace of narrow houses with stone balconies.'},
    {id:'net-shop',name:'Mugge’s Net Loft',district:'Dock District',x:243.06,z:38.40,look:[246,32],note:'Rolf Mugge mended nets for the Chionthar boats. His last job still hangs from the frame.',
      keepsake:{at:[-3.4,-1.65],title:'The netting needles',text:'Three needles on the bench still have twine wound round them. The fourth has a split tip, bound tight with a strip of sailcloth. Rolf cut his mark into the handle after someone at Dragoneye Docks walked off with his good one.'}},
    {id:'bell-house',name:'Stace’s Laundry',district:'Westerly',x:-335.3,z:67.08,look:[-328,67],note:'Petronelle Stace took in sheets from the inns above the West Docks. Her folding table stands beside the drying line.',
      keepsake:{at:[-3.5,-2.45],title:'The marked linen',text:'A red stitch in the corner of each sheet tells Petronelle which inn to send it back to. Two sheets in this pile have the mark cut away. Both have been torn into strips a hand’s breadth wide.'}},
    {id:'orrel-house',name:'Holcot House',district:'High District',x:-107.49,z:69.94,look:[-114,70],note:'Aldreda Holcot wrote letters for her neighbors on Orrel Stair. Her small desk stands across from the bed.',
      keepsake:{at:[1.99,-1.62],title:'A letter on the desk',text:'“Mother, if the western road opens, wait at the foot of the switchback. I know the buckle on your blue case.” Under the last line Aldreda has left room for a mark. The customer never came back to make it.'}}
  ];
  const reserves=[
    [225,42,22,26],[254,47,19,20],[278,142,37,33],[311,245,24,33],[196,245,27,25],[393,189,17,19],
    [369,-211,27,21],[67,-123,16,16],[-236,-154,32,29],[-343,-246,22,22],[-390,166,54,43],
    [-97,237,55,40],[-306,73,26,23],[-104,82,11,11],[216,49,14,12]
  ];
  const ramp=[[-177,173],[-154,124],[-148,75],[-143,36],[-123,61],[-132,112],[-113,150],[-93,173],[-102,195]];
  const wards = [
    {key:'east',x0:61,x1:457,z0:-236,z1:282,dx:40,dz:34,wx:11,wz:8,phase:1.5,tilt:.12},
    {key:'west',x0:-489,x1:-123,z0:-304,z1:285,dx:37,dz:35,wx:9,wz:8,phase:3.7,tilt:-.24},
    {key:'high',x0:-116,x1:14,z0:-191,z1:207,dx:26,dz:36,wx:2.7,wz:4,phase:2.9,tilt:.16}
  ];
  const roads=[], parcels=[];
  function valid(x,z,pad=0) {
    return inside(x,z,outline)&&cliff(x,z)>18+pad&&pathDistance(x,z,gorge)>riftWidth(z)+6+pad&&
      pathDistance(x,z,canal)>13+pad&&dist(x,z,pond.x,pond.z)>12+pad;
  }
  function buildable(x,z,r,key) {
    if(!valid(x,z,r)||pathDistance(x,z,oldGarden)<10+r||reserves.some(([a,b,w,h])=>Math.abs(a-x)<w+r&&Math.abs(b-z)<h+r))return false;
    if(bridges.some(b=>segment(x,z,[b.x1,b.z1],[b.x2,b.z2]).d<b.w/2+r+4))return false;
    if(pathDistance(x,z,ramp)<r+5)return false;
    return key!=='high'||plateau(x,z)>22;
  }
  function districtPoint(w,x,z) {
    return [x+(z-25)*w.tilt+w.wx*Math.sin(z/50+x/145+w.phase),z+w.wz*Math.sin(x/43+z/83+w.phase)];
  }
  const rand=seeded(1379);
  for(const ward of wards){
    const {x0,x1,z0,z1,dx,dz,key}=ward;
    for(let x=x0;x<x1;x+=dx){
      const path=[];
      for(let z=z0;z<z1+4;z+=4)path.push(districtPoint(ward,x,z));
      roads.push({path,w:key==='high'?4.6:6});
    }
    for(let z=z0;z<z1;z+=dz){
      const path=[];
      for(let x=x0;x<x1+4;x+=4)path.push(districtPoint(ward,x,z));
      roads.push({path,w:key==='high'?5:7.2});
    }
    for(let z=z0;z+dz<=z1+2;z+=dz)for(let x=x0;x+dx<=x1+2;x+=dx){
      for(const side of [1,-1])for(let col=0;col<(key==='high'?1:3);col++){
        const openCourt=Math.sin(x*.032+z*.053)*Math.cos(z*.041-x*.017)>.63;
        if(rand()<(openCourt?.30:.12))continue;
        const count=key==='high'?1:3;
        const width=dx/count*(.63+rand()*.24);
        const depth=8+rand()*(key==='east'?6:4.4);
        const px=x+(col+.5)*dx/count+(rand()-.5)*2.7;
        const front=z+(side===1?0:dz);
        const pz=front+side*(4.3+depth/2+rand()*1.4);
        const [a,b]=districtPoint(ward,px,pz);
        if(!buildable(a,b,Math.hypot(width,depth)*.48,key))continue;
        const [a1,b1]=districtPoint(ward,px+2,pz);
        const angle=-Math.atan2(b1-b,a1-a)+(side===1?Math.PI:0)+(rand()-.5)*.19;
        const h=key==='east'?4.7+rand()*4.7:key==='high'?8.3+rand()*6:6.3+rand()*6.8;
        parcels.push({id:'house-'+parcels.length,x:a,z:b,w:width,d:depth,h,angle,ward:key,style:Math.floor(rand()*6),burnt:rand()<(key==='east'?.2:.09)});
      }
    }
  }
  roads.push({path:ramp,w:7.4,climb:true});
  roads.push({path:[[-86,-230],[-114,-230],[-153,-228],[-207,-193],[-213,-172],[-270,-199],[-336,-241]],w:9});
  roads.push({path:[[33,81],[70,83],[108,68],[155,55],[222,28],[256,60],[278,142],[307,242]],w:10});
  roads.push({path:[[88,-213],[114,-200],[133,-166],[171,-144],[229,-136],[282,-141],[351,-168],[402,-217]],w:9});
  roads.push({path:[[136,0],[161,10],[193,25],[224,40],[253,53],[271,63]],w:11});
  roads.push({path:[[-59,63],[-71,65],[-84,81],[-92,105],[-107,150],[-102,195],[-103,210]],w:6,climb:true});
  // Remove parcels crossed by the hand-laid thoroughfares.
  const mainRoads=roads.slice(-6);
  const houses=parcels.filter(p=>pathDistance(p.x,p.z,garden)>8+Math.hypot(p.w,p.d)*.5&&!mainRoads.some(r=>pathDistance(p.x,p.z,r.path)<r.w/2+Math.min(p.w,p.d)*.56+1.1));
  // Cut level building benches into the bluff. Each shoulder rejoins the original hill.
  const hillside=[...houses.filter(p=>p.ward==='high'),
    {x:-109,z:85,w:10,d:11,angle:1.59},{x:-114,z:70,w:9.2,d:10,angle:1.58}];
  for(const p of hillside){
    const c=Math.cos(p.angle),s=Math.sin(p.angle),level=surface(p.x,p.z);
    const cornerHeights=[];
    for(const x of [-p.w/2,p.w/2])for(const z of [-p.d/2,p.d/2])cornerHeights.push(surface(p.x+x*c+z*s,p.z-x*s+z*c));
    if(Math.max(...cornerHeights)-Math.min(...cornerHeights)>3.4)
      terraces.push({...p,c,s,level,radius:Math.hypot(p.w,p.d)*.5+6});
  }

  // The mesher and the swimmer use the same bank limits and liquid elevations.
  const lavaBeds=[
    {path:gorge,pad:45,level:()=>-156,margin:(x,z,d)=>Math.min(riftWidth(z)+6-d,cliff(x,z)-1,inside(x,z,outline)?100:-100)},
    {path:canal,pad:24,level:()=>4.85,margin:(x,z,d)=>Math.min(18-d,island(x,z)?Math.max(.05,Math.min(cliff(x,z),pathDistance(x,z,gorge)-riftWidth(z)+2)):-2)},
    {path:garden,pad:11,level:(_x,z)=>gardenLevel(z),margin:(_x,_z,d)=>8.8-d}
  ];
  function fluid(x,z,height=Infinity) {
    const beneath=height<underside(x,z)&&island(x,z);
    const ground=beneath?avernusFloor(x,z):terrain(x,z);
    for(const bed of lavaBeds){
      if(beneath&&bed.path!==gorge)continue;
      const d=pathDistance(x,z,bed.path);
      if(d<bed.pad&&bed.margin(x,z,d)>0&&ground<bed.level(x,z))return {kind:'lava',y:bed.level(x,z)};
    }
    if(!beneath&&dist(x,z,pond.x,pond.z)<pond.r&&ground<pond.level)return {kind:'water',y:pond.level};
    if(pathDistance(x,z,river)<193&&ground<-152.4)return {kind:'water',y:-152.4};
    return null;
  }
  return {ft,clamp,mix,smooth,dist,seeded,outline,wallLine,gorge,garden,canal,river,pond,chains,
    segment,pathDistance,inside,cliff,riftWidth,plateau,surface,terrain,island,islandSurface,underside,avernusFloor,lavaBeds,bridges,places,roads,houses,fluid,valid};
})();



