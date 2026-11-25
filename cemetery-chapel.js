'use strict';
window.CemeteryChapel=b=>{
  const scale=1.524/20.4,center=[267,300],outerRadius=102,innerRadius=64;
  const [entranceX,entranceZ]=[427,280],arcTop=78,arcBottom=180,roof=6.7;
  const point=([x,z])=>[(x-entranceX)*scale,(z-entranceZ)*scale];
  const circle=(radius,angle)=>[center[0]+radius*Math.cos(angle*Math.PI/180),center[1]+radius*Math.sin(angle*Math.PI/180)];
  function arc(radius,from,to,divisions=Math.ceil(Math.abs(to-from)/7)){
    return Array.from({length:divisions+1},(_,i)=>circle(radius,from+(to-from)*i/divisions));
  }
  const floor=(label,points,y=0,ceiling=roof,surface='floor')=>b.floor(label,points.map(point),y,ceiling,surface);
  function wall(a,c,y=0,height=roof,thickness=.31,mat='stone'){
    const [x1,z1]=point(a),[x2,z2]=point(c);
    b.wall(x1,z1,x2,z2,y,height,thickness,mat);
  }
  function walls(points,y=0,height=roof,thickness=.31,mat='stone'){
    for(let i=1;i<points.length;i++)wall(points[i-1],points[i],y,height,thickness,mat);
  }
  function splitWall(a,c,holes){
    const p=t=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t];
    const yaw=Math.atan2(a[1]-c[1],c[0]-a[0]);
    let cursor=0;
    for(const {start,end,sill=0,lintel=4.16} of holes){
      wall(p(cursor),p(start));
      if(sill){
        wall(p(start),p(end),0,sill);
        const width=Math.hypot(c[0]-a[0],c[1]-a[1])*scale*(end-start);
        box('trim',p((start+end)/2),sill,width+.18,.16,.47,yaw);
        box('trim',p((start+end)/2),lintel,width+.19,.21,.43,yaw);
        for(const t of [start,end]){
          box('trim',p(t),(lintel+sill)/2,.14,lintel-sill,.41,yaw);
          box('iron',p(t+(t===start?1:-1)*(end-start)*.13),sill+.33,.038,.64,.06,yaw);
        }
        box('glass',p(start+(end-start)*.13),sill+.19,width*.13,.32,.045,yaw);
        box('glass',p(end-(end-start)*.12),lintel-.16,width*.15,.27,.047,yaw);
      }
      wall(p(start),p(end),lintel,roof-lintel);
      cursor=end;
    }
    wall(p(cursor),c);
  }
  function box(mat,where,y,w,h,d,yaw=0,solid=false){
    const [x,z]=point(where);b.box(mat,x,y,z,w,h,d,yaw,solid);
  }
  function lamp(where,y,color,power=18,reach=12){
    const [x,z]=point(where);b.lamp(x,y,z,color,power,reach);
  }
  function art(kind,where,y,w,h,yaw=0,pitch=0){
    const [x,z]=point(where);b.art(kind,x,y,z,w,h,yaw,pitch);
  }
  function frame(where,width,height,angle){
    const [x,z]=point(where);b.arch(x,z,0,width,height,angle);
  }
  const front=[
    [427,158],[468,158],[468,236],[507,236],[507,322],[468,322],[468,421],
    [507,458],[507,547],[468,585],[468,627],[427,627]
  ];
  const mourning=[
    [40,157],[61,137],[244,137],[265,157],[284,137],[369,137],[369,300],
    ...arc(outerRadius,0,-180),[61,301],[40,280]
  ];
  const light=[
    [369,137],[408,137],[427,157],[427,626],[408,647],[284,647],[265,628],
    [265,587],[244,566],[244,462],[266,442],[266,402],...arc(outerRadius,90,0)
  ];
  const vestments=[...arc(outerRadius,arcBottom,arcTop+360),...arc(innerRadius,arcTop,arcBottom)];
  floor('G1 · Walk of Bravery',front,0,0,'slate');
  floor('G2 · Chapel of Light',light);
  floor('G3 · Chapel of Mourning',mourning);
  floor('G4 · Vestment Chamber',vestments);

  const stepCount=22,stepRise=4.2/stepCount;
  for(let i=0;i<stepCount;i++){
    const a=arcTop+(arcBottom-arcTop)*i/stepCount,c=arcTop+(arcBottom-arcTop)*(i+1)/stepCount;
    const y=-(i+1)*stepRise;
    floor('',[circle(innerRadius,a),circle(outerRadius,a),circle(outerRadius,c),circle(innerRadius,c)],
      y,roof-y,'slate');
    wall(circle(outerRadius,a),circle(outerRadius,c),y,roof-y,.34);
    wall(circle(innerRadius,a),circle(innerRadius,c),y,.98,.26,'trim');
  }
  wall(circle(outerRadius,arcTop),circle(outerRadius,90),0,roof,.30);
  walls([[40,157],[61,137],[244,137],[265,157],[284,137],[408,137],[427,157]]);
  splitWall([40,157],[40,280],[{start:.38,end:.67,sill:1.14,lintel:4.73}]);
  walls([[40,280],[61,301],[165,301]]);
  const eastNotches=[{start:(262-157)/469,end:(298-157)/469,lintel:3.92},
    {start:(475-157)/469,end:(491-157)/469,sill:1.15,lintel:5.02},
    {start:(545-157)/469,end:(563-157)/469,sill:1.15,lintel:5.02}];
  splitWall([427,157],[427,626],eastNotches);
  walls([[427,626],[408,647],[284,647],[265,628],[265,587],[244,566]]);
  splitWall([244,462],[244,566],[{start:.22,end:.40,sill:1.13,lintel:4.86},
    {start:.59,end:.80,sill:1.13,lintel:4.86}]);
  walls([[244,462],[266,442],[266,402]]);
  // The circular screen has three openings between the chapels and vestment chamber.
  for(const [from,to] of [[180,203],[226,313],[337,405],[427,438]]){
    walls(arc(outerRadius,from,to));
  }
  for(const [angle,width,height] of [[214,2.98,4.45],[325,3.08,4.52],[56,2.91,4.23]]){
    frame(circle(outerRadius,angle),width,height,(270-angle)*Math.PI/180);
  }
  frame([427,280],2.69,4.03,Math.PI/2);
  for(const s of [-1,1]){
    box('wood',[415,280+s*16],1.54,.17,3.08,1.36,s*.12);
    for(const y of [.62,2.18])box('iron',[413,280+s*16],y,.08,.079,1.33,s*.12);
  }

  // Walk of Bravery memorials flank the long exterior approach.
  for(const [i,where] of [[448,178],[448,219],[448,339],[448,382],[448,423],[488,463],[488,544],[448,584]].entries()){
    const damaged=i===0||i===6;
    box('stone',where,.17,.86,.34,.83,0,true);
    box('trim',where,.37,.72,.13,.70);
    box('marble',where,.81,.50,.77,.42,0,true);
    box('marble',where,1.35,.47,.39,.60,0,true);
    if(!damaged){
      const [x,z]=point(where);
      b.column('marble',x,1.56,z,.18,.31);
      box('trim',[where[0]+5,where[1]],1.34,.07,.45,.31);
    }else box('rubble',[where[0]+10,where[1]+5],.14,.33,.28,.26,.62);
  }
  for(const where of [[450,248],[450,310],[408,280],[252,470],[410,595]])
    lamp(where,2.55,0xe7ad68,17,13);

  // G2 retains the fallen Torm pane and the broken frame it came from.
  const benches=[476,506,536,566];
  for(const z of benches)for(const x of [290,365]){
    box('wood',[x,z],.44,2.8,.14,.52,0,true);
    box('wood',[x,z-3],.74,2.82,.43,.13);
    for(const s of [-1,1])box('stone',[x+s*14,z],.23,.19,.46,.46);
  }
  box('stone',[346,623],.48,4.08,.96,1.42,0,true);
  box('marble',[346,623],.99,4.27,.15,1.59);
  art('torm',[381,595],.055,2.8,4.1,.26,-Math.PI/2);
  for(const [i,where] of [[377,567],[397,589],[381,618],[365,612],[369,585],[394,613],[383,569]].entries())
    box(i%2?'glass':'rubble',where,.055,.12+(i%3)*.067,.054,.15,i*.65);
  lamp([356,605],2.2,0xd07a48,22,12);
  lamp([350,454],2.86,0xd78b75,19,14);

  // G3's ceremonial pane occupies the west wall above the mourning altar.
  box('stone',[69,213],.52,1.22,1.04,3.32,0,true);
  box('marble',[69,213],1.08,1.37,.17,3.53);
  art('lathander',[45,213],3.47,5.37,4.7,Math.PI/2);
  for(const z of [187,223,259]){
    box('wood',[117,z],.43,2.74,.15,.54,Math.PI/2,true);
    box('wood',[121,z],.72,2.73,.42,.13,Math.PI/2);
  }
  lamp([78,217],3.05,0xd77dab,31,15);
  lamp([137,174],2.47,0x9972c1,18,12);
  for(const where of [[278,251],[308,279],[265,323],[397,364]])lamp(where,2.71,0x9560c8,18,12);
  for(const where of [[261,234],[298,245],[321,286]]){
    box('wood',where,.76,.74,1.52,.52,.13,true);
    box('iron',[where[0]+3,where[1]],.81,.06,.08,.20);
  }
};
