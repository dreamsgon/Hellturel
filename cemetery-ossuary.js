'use strict';
window.CemeteryOssuary=b=>{
  const workshopY=-4.2,cryptY=-7.4,ceiling=3.46;
  // The printed grid is 18 plan units per five feet. The chapel stair fixes the origin.
  const scale=1.524/18, point=(x,z)=>[(x-1080)*scale,(z-815)*scale];

  function outline(x,z){
    const points=[[x,z]], openings=new Set();
    const path={
      points,openings,
      line(x,z){points.push([x,z]);return path},
      gap(x,z){openings.add(points.length-1);return path.line(x,z)},
      curve(cx,cz,x,z,count=6){
        const [ax,az]=points.at(-1);
        for(let i=1;i<=count;i++){
          const t=i/count,s=1-t;
          path.line(s*s*ax+2*s*t*cx+t*t*x,s*s*az+2*s*t*cz+t*t*z);
        }
        return path;
      },
      openEnd(){openings.add(points.length-1);return path}
    };
    return path;
  }
  function walls(path,y=cryptY,h=ceiling){
    path.points.forEach(([x,z],i)=>{
      if(path.openings.has(i))return;
      b.wall(...point(x,z),...point(...path.points[(i+1)%path.points.length]),y,h);
    });
  }
  function ring({points}){
    const [x,z]=points[0],[lastX,lastZ]=points.at(-1);
    return (x===lastX&&z===lastZ?points.slice(0,-1):points).map(p=>point(...p));
  }
  function room(label,path,holes=[],y=cryptY,h=ceiling){
    b.floor(label,ring(path),y,h,'floor',holes.map(ring));
    walls(path,y,h);
    for(const hole of holes)walls(hole,y,h);
  }
  function arch(x,z,y,width,angle=0,height=3.18){
    b.arch(...point(x,z),y,width*scale,height,angle);
  }

  const workshop=outline(1062,815).line(1047,815).curve(1037,829,1007,818)
    .line(1007,749).curve(1013,733,1033,728).line(1061,728).gap(1099,728)
    .line(1127,728).curve(1146,732,1153,749).line(1153,816)
    .curve(1120,829,1110,811).line(1096,802).line(1096,815).openEnd();
  room('G7 Workshop',workshop,[],workshopY,3.55);
  const stair=outline(1061,728).line(1061,674).gap(1099,674).line(1099,728).openEnd();
  walls(stair,cryptY,6.75);
  // Join the workshop soffit to the lower passage. This is ceiling geometry only.
  const upperZ=point(1080,728)[1],lowerZ=point(1080,674)[1];
  const lowRoof=cryptY+ceiling,highRoof=workshopY+3.55;
  b.ceiling(ring(stair),(_x,z)=>lowRoof+(highRoof-lowRoof)*(z-lowerZ)/(upperZ-lowerZ));
  b.stairs('',...point(1080,728),workshopY,...point(1080,674),cryptY,38*scale);
  arch(1080,813,workshopY,33);
  arch(1080,728,workshopY,32);
  arch(1080,674,cryptY,32);

  const lowerJunction=outline(991,638).line(1134,638).line(1134,602).line(1044,602)
    .line(1044,548).gap(1080,548).line(1080,566).line(1169,566).line(1169,675)
    .line(1099,675).line(1099,674).gap(1061,674).line(1061,675).line(991,675).openEnd();
  room('',lowerJunction);
  arch(991,656,cryptY,33,Math.PI/2);
  arch(1062,548,cryptY,30);

  const innerWest=outline(830,532).line(830,581).curve(795,604,794,658)
    .curve(795,703,831,730).line(831,782).curve(757,767,757,670)
    .line(757,643).curve(757,555,830,532);
  const innerEast=outline(882,531).curve(956,551,956,648)
    .line(956,671).curve(956,755,882,782).line(882,730)
    .curve(919,704,919,658).curve(919,609,882,582);
  const center=outline(852,620).line(861,620).curve(883,620,883,642)
    .line(883,674).curve(883,694,861,694).line(851,694)
    .curve(830,694,830,674).line(830,642).curve(830,620,852,620);
  const faithful=outline(683,493).gap(850,493).curve(906,497,949,540)
    .curve(991,581,991,638).gap(991,675).line(991,711)
    .curve(991,772,946,798).curve(911,818,854,818)
    .curve(763,818,718,762).curve(683,724,683,660);
  room('G8 Ossuary of the Faithful',faithful,[innerWest,innerEast,center]);

  const apse=outline(775,246).curve(773,278,797,280).line(828,280)
    .curve(848,277,850,245).curve(885,241,885,271)
    .curve(889,320,843,320).line(783,320).curve(740,319,740,277)
    .curve(740,244,775,246);
  const main=outline(683,493).line(686,250).curve(687,208,733,208)
    .line(873,208).curve(920,207,920,256).line(920,295)
    .curve(920,343,846,353).curve(793,349,776,405)
    .line(830,405).gap(830,443).line(776,443)
    .curve(791,490,850,493).openEnd();
  room('G9 Main Ossuary',main,[apse]);
  arch(830,424,cryptY,33,Math.PI/2);

  const meditation=outline(830,405).curve(834,371,865,370).line(938,368)
    .gap(938,365).gap(974,365).line(974,433).curve(974,477,935,477)
    .line(867,477).curve(833,477,830,443).openEnd();
  room('G10 Meditation Chamber',meditation);
  arch(956,367,cryptY,30);

  const passage=outline(938,365).line(938,208).gap(974,208).gap(974,246)
    .line(974,365).openEnd();
  room('',passage);
  const cathedral=outline(938,208).line(938,173).line(777,173)
    .line(766,163).line(775,138).line(974,138).line(974,208).openEnd();
  room('Collapsed Cathedral Passage',cathedral);
  arch(956,208,cryptY,30,0,2.92);
  const honor=outline(1044,548).curve(990,548,990,496).line(990,348)
    .curve(990,299,1037,299).line(1088,299).curve(1134,299,1134,348)
    .line(1134,495).curve(1134,548,1080,548).openEnd();
  room('G11 Vault of Honor',honor);

  const ascendance=outline(974,208).line(1044,208).line(1044,153)
    .curve(1044,120,1084,120).line(1108,120).curve(1151,121,1151,158)
    .line(1151,249).curve(1150,278,1123,278).line(1070,278)
    .curve(1044,278,1044,246).line(974,246).openEnd();
  room('G12 Vault of Ascendance',ascendance);
  arch(990,226,cryptY,32,Math.PI/2);

  function box(mat,x,z,w,h,d,rot=0,solid=false,y=cryptY){
    const [wx,wz]=point(x,z);
    b.box(mat,wx,y+h/2,wz,w*scale,h,d*scale,rot,solid);
  }
  const raised=(mat,x,z,w,h,d,base,rot=0,y=cryptY)=>box(mat,x,z,w,h,d,rot,false,y+base);
  const lamp=(x,z,color,intensity,range=13,y=cryptY)=>{
    const [wx,wz]=point(x,z);
    b.lamp(wx,y+2.35,wz,color,intensity,range);
  };
  const column=(mat,x,z,r,h,solid=true)=>{
    const [wx,wz]=point(x,z);
    b.column(mat,wx,cryptY,wz,r*scale,h,solid);
  };
  const art=(mat,x,z,w,h,angle=0,base=1.86)=>{
    const [wx,wz]=point(x,z);
    b.art(mat,wx,cryptY+base,wz,w*scale,h,angle);
  };
  let seed=221087;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  function scatter(x,z,w,d,count,y=cryptY){
    for(let i=0;i<count;i++){
      const size=.8+random()*1.9;
      box(i%4===0?'slate':'rubble',x+(random()-.5)*w,z+(random()-.5)*d,
        size,size*.04,size*.67,random()*Math.PI,false,y);
    }
  }

  for(const [x,z,r] of [[1026,763,Math.PI/2],[1135,763,Math.PI/2],[1045,746,0],[1116,745,.08]]){
    box('wood',x,z,21,.86,10,r,true,workshopY);
    raised('iron',x,z,22,.1,11,.83,r,workshopY);
    for(let i=0;i<4;i++){
      const shift=(i-1.5)*3;
      raised(i%2?'iron':'glass',x+Math.cos(r)*shift,z-Math.sin(r)*shift,1.4,.3,1.4,.93,0,workshopY);
    }
  }
  for(const [x,z] of [[1052,780],[1104,780],[1049,795],[1115,759]]){
    box('glass',x,z,11,.018,4,random()*Math.PI,false,workshopY);
    scatter(x,z,14,7,14,workshopY);
  }
  lamp(1052,760,0xe29466,25,13,workshopY);
  lamp(1080,700,0xab7ded,13,11,workshopY-1.45);

  function shelf(x,z,rotation,crests){
    for(let tier=0;tier<4;tier++){
      const base=.35+tier*.7;
      raised('trim',x,z,8,.12,6,base,rotation);
      raised('bone',x,z,2.6,.26,2.5,base+.12,rotation+random()*.35);
      for(let j=0;j<3;j++)raised('bone',x+(random()-.5)*3,z+(random()-.5)*3,3,.046,1,base+.12+j*.017,random()*Math.PI);
      if(crests&&tier===1&&random()<.36)raised('gold',x+1.5,z+1.2,1.4,.24,.7,base+.12,rotation);
    }
  }
  function wallShelves({points},crests){
    const clearance=5;
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],[nx,nz]=points[(i+1)%points.length];
      const dx=nx-x,dz=nz-z,len=Math.hypot(dx,dz),count=Math.max(1,Math.round(len/8));
      if(len<5)continue;
      for(let j=0;j<count;j++){
        const t=(j+.5)/count;
        shelf(x+t*dx+clearance*dz/len,z+t*dz-clearance*dx/len,-Math.atan2(dz,dx),crests);
      }
    }
  }
  wallShelves(innerWest,true);
  wallShelves(innerEast,true);
  wallShelves(center,true);
  wallShelves(apse,false);
  column('stone',813,246,17,ceiling);
  for(const z of [298,369,440,513,585,657]){
    arch(z>475?688:691,z,cryptY,38,Math.PI/2,2.68);
    box('trim',z>475?691:694,z,9,.4,31,0,true);
  }
  lamp(1008,656,0x9973cd,18);
  lamp(1149,585,0xe58476,15);
  lamp(972,707,0xb37ce6,17);
  lamp(855,756,0x9e6bc5,16);
  lamp(798,514,0xcc9adc,16);
  lamp(722,321,0xa789e6,25,16);

  for(const x of [865,938])column('stone',x,424,16,ceiling);
  arch(901,474,cryptY,37,0,2.76);
  art('mosaic',901,473,38,2.16);
  box('marble',901,467,33,.39,11,0,true);
  for(const [x,z] of [[860,389],[901,393],[899,438],[939,395]]){
    box('wood',x,z,5.5,.33,5.8);
    raised('cloth',x,z,6,.12,6,.33,.12);
  }
  lamp(902,407,0xdd9b69,22,12);

  for(const [i,x,z] of [[0,1062,307],[1,999,388],[2,1125,388],[3,999,458],[4,1125,458]]){
    const facing=i===0?0:Math.PI/2;
    arch(x,z,cryptY,37,facing,2.68);
    box('marble',x,z,14,.37,13,facing,true);
    raised('marble',x,z,5.5,.92,5,.37);
    raised('marble',x,z,3.7,.32,3.4,1.29,i*.32);
    raised('marble',x+.6,z,3.2,.31,3.2,1.57,i*.19);
    scatter(x+(i===0?0:x<1060?10:-10),z,9,10,11);
  }
  for(const z of [369,423,477])column('stone',1063,z,17,ceiling);
  scatter(1048,503,66,32,52);
  lamp(1060,491,0xb487c5,25,16);
  lamp(955,286,0xb488f5,11);
  lamp(796,154,0xb48373,10,9);
  for(let i=0;i<45;i++){
    const x=773+random()*29,z=142+random()*28,sz=3+random()*7;
    box('rubble',x,z,sz,.18+random()*1.35,sz*.72,random()*Math.PI);
  }
  box('rubble',782,156,15,1.68,31,0,true);
  scatter(807,155,22,26,41);

  // Stair markings retain the lower corridors' continuous walkable height.
  for(const [x,z,alongZ] of [[1044,656,false],[1114,656,false],
    [1117,584,false],[808,424,false],[956,348,true],[956,263,true],[919,156,false]]){
    for(let i=-2;i<=2;i++)box('trim',x+(alongZ?0:i*4),z+(alongZ?i*4:0),
      alongZ?25+i*2:1.1,.018,alongZ?1.1:25+i*2);
  }

  const pool=outline(1048,154).curve(1049,127,1084,126).line(1108,126)
    .curve(1145,127,1145,158).line(1145,248).curve(1145,272,1122,272)
    .line(1070,272).curve(1052,271,1048,246).line(1064,246)
    .curve(1081,245,1081,224).line(1081,182).curve(1081,155,1048,154);
  b.pool(ring(pool),cryptY+.024);
  const railing=outline(1048,154).curve(1081,155,1081,182).line(1081,196).line(1081,210).line(1081,224)
    .curve(1081,246,1048,246).openEnd();
  for(let i=1;i<railing.points.length;i++){
    const [x,z]=railing.points[i-1],[nx,nz]=railing.points[i];
    column('iron',x,z,.77,.93,false);
    box('iron',(x+nx)/2,(z+nz)/2,Math.hypot(nx-x,nz-z),.07,1.05,
      -Math.atan2(nz-z,nx-x),true,cryptY+.79);
  }
  art('fresco',1098,123,71,2.9);
  art('fresco',1046,181,46,2.64,Math.PI/2);
  art('corrupt',1148,205,67,3.26,-Math.PI/2);
  const [portalX,portalZ]=point(1145,205);
  b.portal(portalX,cryptY+1.72,portalZ,4.56,3.1,-Math.PI/2);
  lamp(1031,224,0xaa72e9,27,16);
  lamp(1128,204,0xd452fc,31,16);
};
