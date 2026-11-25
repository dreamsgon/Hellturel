'use strict';
window.HighHall=(()=>{
  function build(){
    const scene=new THREE.Scene(),textures=[],materials=[],geometry=new Set(),batches=new Map(),solids=[];
    scene.background=new THREE.Color(0x211916);
    scene.fog=new THREE.FogExp2(0x2b211f,.025);
    const loader=new THREE.TextureLoader(),assets=window.ELTUREL_TEXTURES||{};
    const layers={};
    for(const name of ['ground','upperWalls','roof','stairs','crypt','cryptRoof','choir','choirStairs','choirRoof']){
      const group=new THREE.Group();group.name=name;scene.add(group);layers[name]=group;
    }
    let disposed=false,seed=17625,layer='ground';
    function random(){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    }
    function map(key,color){
      if(!assets[key])return null;
      const texture=loader.load(assets[key],loaded=>{if(disposed)loaded.dispose()});
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      if(color)texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=4;textures.push(texture);
      return texture;
    }
    function material(color,key,opts={}){
      const m=new THREE.MeshStandardMaterial({color,roughness:.87,...opts});
      if(key){
        m.map=map(key+'-color',true);
        m.normalMap=map(key+'-normal',false);
        m.normalScale.set(.42,.42);
      }
      materials.push(m);
      return m;
    }
    function luminous(color){
      const m=new THREE.MeshBasicMaterial({color});
      materials.push(m);
      return m;
    }
    // The floor maps are baked offline and loaded only with the interior scene.
    const floorAssets=window.HIGH_HALL_TEXTURES||{};
    function floorMaterial(key){
      if(!floorAssets[key+'-color']||!floorAssets[key+'-normal']||!floorAssets[key+'-roughness'])throw new Error('High Hall floor textures were not loaded');
      const load=(suffix,srgb)=>{
        const texture=loader.load(floorAssets[key+suffix],loaded=>{if(disposed)loaded.dispose()});
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
        texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
        texture.anisotropy=4;textures.push(texture);return texture;
      };
      const m=new THREE.MeshStandardMaterial({color:0xffffff,map:load('-color',true),normalMap:load('-normal',false),
        roughnessMap:load('-roughness',false),normalScale:new THREE.Vector2(.42,.42),roughness:1});
      materials.push(m);return m;
    }
    const naveFloor=[floorMaterial('nave')];
    const stone=material(0xaaa398,'wall-stone');
    const trim=material(0xc2b3a0,'limestone');
    const chalk=material(0xd6c9b8,'limestone');
    const black=material(0x59514d,'wall-stone');
    const choirFloor=[floorMaterial('choir')];
    const cryptFloor=[floorMaterial('crypt')];
    const floorPalettes=new Map([[trim,choirFloor],[chalk,choirFloor],[black,cryptFloor],[stone,cryptFloor]]);
    const mortar=material(0x5d5653);
    const vault=material(0x756c64,'wall-plaster',{side:THREE.DoubleSide});
    const ash=material(0x796b61,'cinder-soil');
    const wood=material(0x645049,'grain');
    const teak=material(0x845635,'grain',{roughness:.55});
    const coal=material(0x322722,'timber');
    const rug=material(0x6b2527);
    const cloth=material(0x622b35,null,{side:THREE.DoubleSide});
    const brass=material(0x9a7550,null,{metalness:.48,roughness:.57});
    const iron=material(0x3a3432,null,{metalness:.32});
    const wax=material(0xd2ab7f);
    const paper=material(0xb09b75);
    const linen=material(0x716956);
    const amber=luminous(0xffb671),flame=luminous(0xffe1a6);
    const ember=luminous(0xad5940),violet=luminous(0x624e83),glass=luminous(0x9a4a30);
    function stainedPane(key){
      const texture=loader.load(window.RosePicture[key],loaded=>{if(disposed)loaded.dispose()});
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
      return material(0xffffff,null,{map:texture,emissiveMap:texture,emissive:0xfff4eb,
        emissiveIntensity:.63,bumpMap:texture,bumpScale:.008,roughness:.27,side:THREE.DoubleSide});
    }
    const lancets=['gauntlet','watch','scales','dawn'].map(stainedPane);
    const paneWidth=2.94,paneBottom=3.11,paneSpring=7.45,paneRise=1.22,paneHeight=paneSpring+paneRise-paneBottom;
    const lancetShape=new THREE.Shape();
    lancetShape.moveTo(-paneWidth/2,0);lancetShape.lineTo(paneWidth/2,0);
    lancetShape.absellipse(0,paneSpring-paneBottom,paneWidth/2,paneRise,0,Math.PI,false,0);
    lancetShape.closePath();
    const lancetPane=new THREE.ShapeGeometry(lancetShape,32);
    const paneVertices=lancetPane.attributes.position;
    for(let i=0;i<paneVertices.count;i++){
      lancetPane.attributes.uv.setXY(i,paneVertices.getX(i)/paneWidth+.5,paneVertices.getY(i)/paneHeight);
    }
    const unitBox=new THREE.BoxGeometry(1,1,1);
    const shaft=new THREE.CylinderGeometry(.5,.56,1,12);
    const ball=new THREE.SphereGeometry(.5,12,8);
    const rock=new THREE.IcosahedronGeometry(.5,0);
    const helper=new THREE.Object3D();
    const tone=new THREE.Color();
    function enqueue(shape,mat,tint,y){
      geometry.add(shape);
      const name=layer==='ground'&&y>3.25?'upperWalls':layer;
      let shapes=batches.get(name);
      if(!shapes){shapes=new Map();batches.set(name,shapes)}
      let mats=shapes.get(shape);
      if(!mats){mats=new Map();shapes.set(shape,mats)}
      let list=mats.get(mat);
      if(!list){list=[];mats.set(mat,list)}
      list.push([helper.matrix.clone(),tone.set(tint).clone()]);
    }
    function stamp(shape,mat,x,y,z,w,h,d,ry=0,tint=0xffffff,rx=0,rz=0){
      helper.position.set(x,y,z);helper.scale.set(w,h,d);helper.rotation.set(rx,ry,rz);
      helper.updateMatrix();
      enqueue(shape,mat,tint,y);
    }
    function box(mat,x,y,z,w,h,d,solid=false,ry=0,tint=0xffffff){
      stamp(unitBox,mat,x,y,z,w,h,d,ry,tint);
      if(solid)solids.push({x,y:y-h/2,z,w,h,d,ry});
    }
    function column(mat,x,y,z,w,h=w,d=w){
      stamp(shaft,mat,x,y,z,w,h,d);
    }
    function ballAt(mat,x,y,z,w,h=w,d=w){
      stamp(ball,mat,x,y,z,w,h,d);
    }
    function mesh(shape,mat){
      geometry.add(shape);
      const body=new THREE.Mesh(shape,mat);
      body.receiveShadow=true;
      layers[layer].add(body);
      return body;
    }
    function v([x,y,z]){return new THREE.Vector3(x,y,z)}
    function line(mat,a,b,width,depth=width){
      helper.position.copy(v(a).lerp(v(b),.5));
      const direction=v(b).sub(v(a));
      helper.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
      helper.scale.set(width,direction.length(),depth);
      helper.updateMatrix();
      enqueue(unitBox,mat,0xffffff,helper.position.y);
    }
    const daylight=new THREE.HemisphereLight(0xa9a4bd,0x564135,.97);
    scene.add(daylight);
    const surveyFill=new THREE.HemisphereLight(0xfff1df,0x9b8782,2.4);
    surveyFill.visible=false;scene.add(surveyFill);
    const cinder=new THREE.DirectionalLight(0xff9871,1.25);
    cinder.position.set(-15,14,0);scene.add(cinder);
    const sanctuary=new THREE.PointLight(0xffc492,130,14,2);
    sanctuary.position.set(0,4.5,-28);scene.add(sanctuary);
    const cryptLight=new THREE.PointLight(0xdd9363,62,12,2);
    cryptLight.position.set(5,-4.17,-51);scene.add(cryptLight);
    const naveLight=new THREE.PointLight(0xffaf72,84,14,2);
    naveLight.position.set(-4.9,3.5,-11.3);scene.add(naveLight);
    const eastLight=new THREE.PointLight(0xff8663,42,11,2);
    eastLight.position.set(7.4,3.4,-20.6);scene.add(eastLight);
    const stairLight=new THREE.PointLight(0xfdb086,26,8,2);
    stairLight.position.set(7.5,.20,-40.6);scene.add(stairLight);
    const sightLights=[sanctuary,naveLight,eastLight,stairLight,cryptLight];
    const lights=[daylight,cinder,...sightLights];
    for(const light of lights)light.userData.baseIntensity=light.intensity;
    function lamp(x,y,z,w=.8){
      column(iron,x,y-.18,z,w*.23,.42);
      column(brass,x,y,z,w,.21);
      stamp(rock,ember,x,y+.074,z,w*.84,.15,w*.84,.1);
      for(let i=0;i<5;i++){
        const dx=(random()-.5)*w*.67,dz=(random()-.5)*w*.67;
        stamp(rock,i%2?amber:flame,x+dx,y+.16+random()*.11,z+dz,w*.21,(.3+random()*.35)*w,w*.25,random()*3);
      }
    }
    function candle(x,y,z,h){
      column(wax,x,y+h/2,z,.043,h);
      column(iron,x,y+.02,z,.104,.035);
      ballAt(flame,x+.006,y+h+.046,z,.04,.095,.04);
    }
    function slabField(x0,x1,z0,z1,y,spacing,mats=naveFloor){
      const palette=Array.isArray(mats)?mats:(floorPalettes.get(mats)||[mats]);
      // The grout is recessed below the flags to avoid coplanar depth flicker.
      box(mortar,(x0+x1)/2,y-.27,(z0+z1)/2,x1-x0,.46,z1-z0);
      let ix=0;
      for(let x=x0;x<x1-.02;x+=spacing,ix++){let iz=0;for(let z=z0;z<z1-.02;z+=spacing,iz++){
        const w=Math.min(spacing,x1-x),d=Math.min(spacing,z1-z);
        const t=.67+random()*.30;
        box(palette[(ix*7+iz*11)%palette.length],x+w/2,y-.062,z+d/2,w-.023,.124,d-.024,false,0,new THREE.Color(t,t*.97,t*.94));
      }}
    }
    function wall(axis,offset,a,b,y0,y1,mat=stone){
      const length=b-a,thick=.85;
      const broad=(along,y,w,h,d,t)=>{
        if(axis==='x')box(mat,along,y,offset,w,h,d,false,0,t);
        else box(mat,offset,y,along,d,h,w,false,0,t);
      };
      solids.push(axis==='x'?{x:(a+b)/2,y:y0,z:offset,w:length,h:y1-y0,d:thick,ry:0}:
        {x:offset,y:y0,z:(a+b)/2,w:thick,h:y1-y0,d:length,ry:0});
      for(let row=y0,n=0;row<y1;row+=.64,n++){
        const h=Math.min(.64,y1-row);
        for(let i=a,j=0;i<b-.0001;j++){
          const w=Math.min(b-i,j===0&&n%2?.72:1.46),t=.79+random()*.21;
          broad(i+w/2,row+h/2,w-.014,h-.012,thick,new THREE.Color(t,t*.987,t*.96));
          i+=w;
        }
      }
    }
    function arch(center,y,z,w,r,depth,mat,axis='x'){
      const n=19,outline=[];
      for(let i=0;i<=n;i++){
        const angle=Math.PI*i/n,along=center+w/2*Math.cos(angle),up=y+r*Math.sin(angle);
        outline.push(axis==='x'?[along,up,z]:[z,up,along]);
      }
      const curve=new THREE.CatmullRomCurve3(outline.map(v));
      mesh(new THREE.TubeGeometry(curve,n,.5*depth,8,false),mat);
    }
    function vaultBay(z0,z1){
      const span=8.95,spring=8.3,rise=4.5,segments=18,pos=[],uv=[],indices=[];
      for(let i=0;i<=segments;i++){
        const a=i*Math.PI/segments;
        for(const z of [z0,z1]){
          const x=Math.cos(a)*span,y=spring+Math.sin(a)*rise;
          pos.push(x,y,z);uv.push(x*.37,z*.34);
        }
        if(i){const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1)}
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.setIndex(indices);g.computeVertexNormals();mesh(g,vault);
      for(const side of [-1,1]){
        const points=[];
        for(let i=0;i<=14;i++){
          const t=i/14,x=side*(1-2*t)*span,y=spring+rise*Math.sin(Math.PI*t);
          points.push(new THREE.Vector3(x,y,z0+(z1-z0)*t));
        }
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,.115,6,false),trim);
      }
      arch(0,spring,z0,span*2,rise,.35,trim);
    }
    function pilaster(x,z,corrupt){
      box(black,x,.21,z,1.55,.42,1.55,true);
      box(trim,x,.46,z,1.32,.24,1.32);
      column(trim,x,4.38,z,1.02,7.61);
      for(const side of [-1,1])column(chalk,x+side*.32,4.18,z+.32,.27,7.28);
      box(chalk,x,8.24,z,1.35,.39,1.41);
      box(trim,x,8.47,z,1.52,.16,1.58);
      const front=z+.58;
      const emblem=corrupt?brass:chalk;
      line(emblem,[x,2.76,front+.16],[x,3.63,front+.16],.085,.03);
      line(emblem,[x-.19,3.40,front+.16],[x+.19,3.40,front+.16],.06,.03);
      box(black,x,2.61,front,.57,.12,.27);
    }
    function curtain(x0,x1,z,short){
      const pos=[],uv=[],ind=[],rows=8,columns=26;
      for(let i=0;i<=columns;i++){
        const u=i/columns,x=x0+(x1-x0)*u;
        const fold=Math.sin(u*27)*.09+Math.cos(u*41)*.038;
        const bottom=short?1.61+.28*Math.sin(u*19)+1.11*Math.max(0,Math.sin(u*32))**7:
          .32+.24*Math.sin(u*13)+.69*Math.max(0,Math.sin(u*28))**9;
        for(let j=0;j<=rows;j++){
          const t=j/rows;
          pos.push(x+.08*(1-t)*Math.sin(u*24),bottom+(4.16-bottom)*t,z+fold*(1+.6*(1-t)));
          uv.push(u,t);
          if(i&&j){
            const k=i*(rows+1)+j,b=k-rows-1;
            ind.push(b-1,k-1,k,b-1,k,b);
          }
        }
      }
      const shape=new THREE.BufferGeometry();
      shape.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      shape.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      shape.setIndex(ind);shape.computeVertexNormals();
      layer='upperWalls';mesh(shape,cloth);layer='ground';
    }
    const upper={xmin:-11.5,xmax:11.5,zmin:-34,zmax:2.6};
    const altarHatch={xmin:-1.15,xmax:1.15,zmin:-31.05,zmax:-27.8,top:.435};
    function aroundHatch(x0,x1,z0,z1,draw){
      draw(x0,altarHatch.xmin,z0,z1);
      draw(altarHatch.xmax,x1,z0,z1);
      draw(altarHatch.xmin,altarHatch.xmax,z0,altarHatch.zmin);
      draw(altarHatch.xmin,altarHatch.xmax,altarHatch.zmax,z1);
    }
    aroundHatch(upper.xmin,upper.xmax,upper.zmin,upper.zmax,
      (x0,x1,z0,z1)=>slabField(x0,x1,z0,z1,0,1.16));
    wall('x',1.2,-11.9,-1.64,0,9);
    wall('x',1.2,1.64,11.9,0,9);
    wall('x',1.2,-1.64,1.64,3.9,6.02);
    for(const [left,right] of [[-1.64,-1.37],[1.37,1.64]])wall('x',1.2,left,right,6.02,8.47);
    wall('x',1.2,-1.64,1.64,8.47,9);
    box(trim,0,.035,1.17,3.24,.07,1.22);
    arch(0,2.57,1.14,3.11,1.38,.26,chalk);
    for(const side of [-1,1]){
      box(trim,side*1.62,1.32,1.14,.20,2.64,.57);
      box(wood,side*1.38,1.36,.34,.17,2.72,1.39,false,side*.14);
      box(iron,side*1.42,.99,.28,.19,.09,1.17,false,side*.14);
    }
    const roseY=8.03,roseRadius=2,apseBase=5.73,apseHalf=2.3;
    wall('x',-34,-11.9,-apseHalf,0,9.8);
    wall('x',-34,-apseHalf,apseHalf,0,apseBase);
    wall('x',-34,apseHalf,6.07,0,9.8);
    wall('x',-34,8.94,11.9,0,9.8);
    wall('x',-34,6.07,8.94,3.1,9.8);
    arch(7.5,2,-34,2.76,1.15,.27,trim);
    const bays=[.91,-7.5,-15.9,-24.3,-33.9];
    layer='roof';
    for(let i=1;i<bays.length;i++)vaultBay(bays[i],bays[i-1]);
    // Close each vault end against its masonry. The apse has a through-cut oculus.
    function vaultEnd(z,base,oculus){
      const angle=Math.asin((base-8.3)/4.5),width=8.95*Math.cos(angle);
      const outline=new THREE.Shape();outline.moveTo(-width,base);
      if(oculus){
        outline.lineTo(-apseHalf,base);outline.lineTo(-apseHalf,apseBase);
        outline.lineTo(apseHalf,apseBase);outline.lineTo(apseHalf,base);
        const opening=new THREE.Path();
        opening.absarc(0,roseY,roseRadius,0,Math.PI*2,true);outline.holes.push(opening);
      }
      outline.lineTo(width,base);
      outline.absellipse(0,8.3,8.95,4.5,angle,Math.PI-angle,false,0);
      outline.closePath();
      const masonry=mesh(new THREE.ExtrudeGeometry(outline,{depth:.85,bevelEnabled:false,curveSegments:48}),stone);
      masonry.position.z=z;
    }
    vaultEnd(-34.425,9.8,true);
    vaultEnd(.775,9,false);
    layer='ground';
    for(const side of [-1,1]){
      const x=side*11.85;
      wall('z',x,-34,1.2,0,2.75);
      wall('z',x,-34,1.2,8.65,10.15);
      for(const [a,b] of [[-34,-30.2],[-27.1,-23],[-19.9,-15.3],[-12.2,-7.6],[-4.5,1.2]])wall('z',x,a,b,2.75,8.65);
      box(vault,side*10.25,8.7,-16.3,3.2,.45,35.2);
      box(chalk,side*11.36,.43,-16.4,.35,.85,35.4);
      for(const z of [-28.65,-21.45,-13.75,-6.05]){
        solids.push({x,y:2.75,z,w:.75,h:5.9,d:3.1,ry:0});
        box(black,side*12.35,5.58,z,.24,5.68,3.04);
        const paneIndex=[-28.65,-21.45,-13.75,-6.05].indexOf(z);
        stamp(lancetPane,lancets[side>0?3-paneIndex:paneIndex],side*11.78,paneBottom,z,1,1,1,-side*Math.PI/2);
        box(trim,side*11.49,3.01,z,.71,.23,3.30);
        for(const k of [-1,1])box(trim,side*11.71,(paneBottom+paneSpring)/2,z+k*paneWidth/2,.35,paneSpring-paneBottom,.22);
        arch(z,7.45,x,2.95,1.22,.28,chalk,'z');
        if(z===-21.45||z===-6.05){
          box(wood,side*11.43,5.18,z+side*.93,.16,3.81,.95,false,side*.31);
          box(iron,side*11.41,4.19,z+side*.93,.17,.12,1.00);
        }
      }
      for(const [i,z] of [-4.3,-11.1,-17.9,-24.7].entries()){
        pilaster(side*5.05,z,(side===1&&i>0)||(side===-1&&i===2));
        if(i%2===0){column(iron,side*6.25,1.07,z, .12,2.13);lamp(side*6.25,2.17,z,.64)}
      }
      arch(-24.44,1.38,side*11.42,2.14,1.06,.23,trim,'z');
      box(black,side*11.34,1.04,-24.44,.17,1.91,1.91);
      box(chalk,side*11.17,.56,-24.44,.50,.16,1.98,true);
      for(const k of [-1,1])candle(side*11.07,.65,-24.44+k*.39,.19);
    }
    // A transverse pair of curtains opens from the foyer onto the sanctuary.
    line(brass,[-5.35,4.21,-12.48],[5.35,4.21,-12.48],.067);
    curtain(-5.14,-3.04,-12.48,false);
    curtain(-3.02,-2.10,-12.48,true);
    curtain(2.18,3.41,-12.48,true);
    curtain(3.42,5.12,-12.48,false);
    // The nave runner, pews and broken furnishings leave three open approaches.
    for(let z=-3;z>=-23;z-=2.5){
      box(rug,0,.014,z,3.55,.028,2.48);
      for(const x of [-1.66,1.66])box(brass,x,.031,z,.045,.014,2.44);
    }
    for(const side of [-1,1])for(let i=0;i<8;i++){
      const x=side*3.62,z=-4.82-i*2.22;
      if((side===1&&i===4)||(side===-1&&i===1)){
        for(let j=0;j<5;j++)stamp(unitBox,coal,x+(random()-.5)*2,.13,z+(random()-.5)*.83,1.1+random(),.14,.14,random()*3);
        continue;
      }
      const m=(i===5&&side<0)?coal:wood;
      box(m,x,.44,z,2.25,.15,.67,true);
      box(m,x,.75,z+.32,2.29,.57,.13,true);
      for(const edge of [-1,1]){
        box(m,x+edge*1.04,.24,z,.13,.46,.65);
        box(m,x+edge*1.12,.63,z+.07,.14,.52,.38);
      }
    }
    // Two transept rooms remain usable as a sacristy and a refugee shelter.
    for(const side of [-1,1]){
      const x=side*7.78;
      wall('z',side*5.85,-33.6,-27.6,0,4.35);
      wall('x',-26.9,side<0?-11.49:5.86,side<0?-10.5:7.1,0,3.98);
      wall('x',-26.9,side<0?-8.2:9.76,side<0?-5.86:11.48,0,3.98);
      arch(side<0?-9.33:8.42,2.23,-26.9,2.56,1.02,.24,trim);
      if(side<0){
        box(wood,x,.86,-31.7,2.4,1.72,.72,true);
        for(let j=0;j<4;j++){
          box(wood,x,.64+j*.24,-31.29,2.28,.075,.18);
          for(let i=0;i<6;i++)if(random()>.25)box(random()>.5?paper:rug,x-1+i*.36,.59+j*.24,-31.18,.18,.17,.24,false,.2*random());
        }
        box(wood,-10.55,.43,-30.35,.49,.86,1.65,true);
        for(let j=0;j<4;j++)candle(-10.52,.88,-30.9+j*.31,.14+j*.017);
        box(trim,x,.40,-32.87,1.72,.80,.64,true);
        box(chalk,x,.87,-32.87,1.90,.16,.77,true);
        for(const dx of [-.58,.51])candle(x+dx,.96,-32.87,.24);
      }else{
        for(let j=0;j<3;j++){
          const z=-28.3-j*1.63;
          box(linen,10.76,.12,z,1.16,.24,1.24,true);
          box(paper,10.96,.27,z-.30,.56,.18,.34);
        }
        box(wood,9.9,.32,-32.69,.58,.64,.67,true);
        lamp(9.9,.69,-32.69,.45);
      }
    }
    const dais=[-3.1,3.1,-31.15,-25.8],stepLength=.48;
    for(let i=0;i<3;i++){
      const front=dais[3]-stepLength*i,h=(i+1)*.145;
      aroundHatch(dais[0],dais[1],dais[2],front,(x0,x1,z0,z1)=>{
        box(i===2?chalk:trim,(x0+x1)/2,h/2,(z0+z1)/2,x1-x0,h,z1-z0);
      });
    }
    // The altar rides on two bronze guides. Each teak hatch leaf pivots outward
    // into its own recess, leaving the full width of the stone stair usable.
    const altarRig=new THREE.Group(),hatchLeaves=[],fingers=[];
    altarRig.name='Torm’s altar';
    layers.ground.add(altarRig);
    function moving(part,name,x,y,z){
      const group=new THREE.Group();
      group.name=name;group.position.set(x,y,z);part.add(group);return group;
    }
    function piece(parent,shape,mat,x,y,z,w,h,d,rx=0,ry=0,rz=0){
      geometry.add(shape);
      const mesh=new THREE.Mesh(shape,mat);
      mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.set(rx,ry,rz);
      mesh.receiveShadow=true;mesh.castShadow=true;parent.add(mesh);return mesh;
    }
    for(const side of [-1,1]){
      box(trim,side*1.46,.63,-29.25,.53,.39,2.98,true);
      box(chalk,side*1.49,.87,-29.25,.52,.16,2.98);
      box(iron,side*1.34,.98,-29.55,.17,.09,3.05);
      for(const z of [-30.85,-27.88]){
        box(brass,side*1.34,1.0,z,.22,.11,.20);
      }
      const hinge=moving(altarRig,'Teak stair hatch',side*1.15,altarHatch.top,-29.425);
      hatchLeaves.push({hinge,side});
      piece(hinge,unitBox,teak,-side*.567,-.073,0,1.13,.145,3.23);
      for(const z of [-1.46,0,1.46]){
        piece(hinge,unitBox,iron,-side*.566,.007,z,1.07,.018,.087);
        piece(hinge,shaft,brass,-side*.085,.023,z,.121,.047,.121);
      }
    }
    const altar=moving(altarRig,'Sliding altar table',0,1.0,-28.73);
    piece(altar,unitBox,trim,0,.07,0,2.7,.14,1.40);
    piece(altar,unitBox,teak,0,.178,0,2.44,.16,1.26);
    for(const edge of [-1,1])piece(altar,unitBox,brass,0,.211,edge*.61,2.34,.048,.047);
    const palm=moving(altar,'Carved teak gauntlet',0,.24,-.13);
    piece(palm,shaft,teak,0,.22,0,.86,.52,.71);
    piece(palm,rock,teak,0,.72,0,1.22,.99,.80,-.025);
    piece(palm,unitBox,brass,0,.34,.371,.66,.116,.045);
    for(let i=0;i<4;i++){
      const x=-.44+i*.292,length=[.28,.36,.34,.26][i];
      const knuckle=moving(palm,'Finger knuckle',x,1.02,.062);
      piece(knuckle,shaft,teak,0,length*.46,0,.275,length,.31);
      piece(knuckle,ball,teak,0,length*.84,.016,.28,.26,.31);
      const tip=moving(knuckle,'Fingertip',0,length*.84,.012);
      piece(tip,shaft,teak,0,length*.37,0,.245,length*.83,.28);
      piece(tip,ball,teak,0,length*.72,0,.247,.19,.28);
      piece(knuckle,unitBox,brass,0,length*.66,.135,.165,.064,.028);
      fingers.push({knuckle,tip,i});
    }
    const thumb=moving(palm,'Thumb',-.49,.69,.21);
    piece(thumb,shaft,teak,0,.26,0,.33,.54,.33);
    piece(thumb,ball,teak,0,.53,0,.31,.25,.33);
    const leverX=2.11,leverZ=-28.38;
    box(iron,leverX,.53,leverZ,.43,.19,.46,true);
    const lever=moving(altarRig,'Altar release lever',leverX,.56,leverZ);
    piece(lever,shaft,iron,0,.39,0,.099,.79,.095);
    piece(lever,ball,brass,0,.78,0,.22,.22,.22);
    let altarTarget=false,altarMotion=0;
    function applyAltarPose(){
      const t=altarMotion*altarMotion*(3-2*altarMotion);
      lever.rotation.x=.45-t*1.07;
      altar.position.z=-28.73-2.16*t;
      altar.position.y=1.0+.12*t;
      palm.rotation.x=.17-t*.29;
      for(const {knuckle,tip,i} of fingers){
        knuckle.rotation.x=1.26-t*1.34;
        knuckle.rotation.z=(i-1.5)*(.026+.054*t);
        tip.rotation.x=1.14-t*1.10;
      }
      thumb.rotation.x=.48-t*.62;
      thumb.rotation.z=-1.09+t*.45;
      const phase=Math.max(0,(t-.17)/.83);
      for(const {hinge,side} of hatchLeaves)hinge.rotation.z=side*phase*1.60;
    }
    function setAltarOpen(open,instant=false){
      altarTarget=Boolean(open);
      if(instant){altarMotion=Number(altarTarget);applyAltarPose()}
    }
    function tickAltar(dt){
      const next=altarTarget?Math.min(1,altarMotion+dt*1.20):Math.max(0,altarMotion-dt*1.45);
      if(next!==altarMotion){altarMotion=next;applyAltarPose()}
    }
    function atUpperLever(x,y,z){
      return x>altarHatch.xmax+.06&&Math.abs(y-altarHatch.top)<.82&&Math.hypot(x-leverX,z-leverZ)<1.48;
    }
    applyAltarPose();
    for(const side of [-1,1]){
      for(let i=0;i<7;i++)candle(side*(1.46+i*.21),.435,-27.72+(i%3)*.28,.13+random()*.21);
      column(iron,side*3.71,1.01,-28.69,.18,2.02);
      lamp(side*3.71,2.0,-28.7,1.08);
      box(rug,side*3.15,6.33,-33.42,1.57,3.9,.14);
      box(brass,side*3.15,8.22,-33.37,1.91,.11,.18);
    }
    layer='roof';
    const roseZ=-33.63;
    const apseGlass=mesh(new THREE.CircleGeometry(roseRadius+.025,96),stainedPane('rose'));
    apseGlass.position.set(0,roseY,roseZ);
    const surround=mesh(new THREE.TorusGeometry(roseRadius,.13,12,96),chalk);
    surround.position.set(0,roseY,roseZ+.095);
    layer='ground';
    for(const [x,z] of [[-8,-2],[8,-10],[-7.4,-16.1],[6.4,-22.3],[-4.5,-24.5],[2.15,-12.4]]){
      for(let i=0;i<11;i++){
        const y=.11+random()*.09,sz=.11+random()*.27;
        stamp(rock,i%4?ash:chalk,x+(random()-.5)*2.1,y,z+(random()-.5)*1.45,sz,y*1.9,sz,random()*4);
      }
      line(black,[x-.45,.011,z-.35],[x+.29,.012,z+.66],.025,.015);
      line(black,[x+.29,.012,z+.66],[x+.77,.011,z+.87],.015,.013);
    }
    // The eastern passage steps down to the catacomb vault and tomb chamber.
    const stair={xmin:6.08,xmax:8.92,zmin:-46.2,zmax:-34};
    const cryptY=-6.096,stairs=34,run=(stair.zmax-stair.zmin)/stairs;
    layer='stairs';
    function stairHeight(z){return cryptY*Math.min(1,Math.max(0,Math.floor((stair.zmax-z)/run+1e-7)/stairs))}
    for(let i=0;i<stairs;i++){
      const z=stair.zmax-(i+.5)*run,h=cryptY*i/stairs;
      box(trim,7.5,h-.17,z,2.82,.34,run+.005);
      box(chalk,7.5,h-.054,z+run*.40,2.82,.10,.075);
    }
    for(const side of [-1,1]){
      const x=7.5+side*1.72;
      for(let i=0;i<6;i++){
        const z=-35.02-i*2.034,y=stairHeight(z);
        wall('z',x,z-1.02,z+1.02,y-.43,y+3.06,black);
        if(side===1){
          layer='cryptRoof';
          box(vault,7.5,y+3.06,z,3.4,.21,2.034);
          layer='stairs';
        }
      }
      for(const z of [-36.7,-41.0,-44.9])lamp(x-side*.50,stairHeight(z)+1.62,z,.46);
    }
    const mats={stone,trim,chalk,black,mortar,vault,ash,wood,teak,coal,rug,cloth,brass,iron,wax,paper,linen,amber,flame,ember,violet,glass};
    const builder={...mats,mats,m:mats,scene,lights,sightLights,box,wall,arch,column,stamp,lamp,line,candle,material,slabField,mesh,shaft,rock,unitBox,ballAt,random,layers,
      altarHatch,altarOpen:()=>altarMotion>=.94,
      useLayer(name){layer=name},addSolid(obstacle){solids.push({ry:0,...obstacle})}};
    layer='choir';
    const choir=window.HighHallChoir(builder);
    layer='crypt';
    const catacombs=window.HighHallCrypt(builder);
    layer='ground';
    const coords=[],colors=[];
    for(let i=0;i<270;i++){
      coords.push((random()-.5)*22,.4+7.8*random(),-random()*33);
      colors.push(.29+random()*.35,.22+random()*.23,.17+random()*.14);
    }
    const dustGeometry=new THREE.BufferGeometry();
    dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    dustGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const dust=new THREE.PointsMaterial({size:.048,vertexColors:true,transparent:true,opacity:.59,depthWrite:false});
    geometry.add(dustGeometry);materials.push(dust);layers.upperWalls.add(new THREE.Points(dustGeometry,dust));
    for(const [name,shapes] of batches)for(const [shape,mats] of shapes)for(const [mat,list] of mats){
      const instances=new THREE.InstancedMesh(shape,mat,list.length);
      for(let i=0;i<list.length;i++){
        instances.setMatrixAt(i,list[i][0]);instances.setColorAt(i,list[i][1]);
      }
      instances.computeBoundingSphere();instances.receiveShadow=true;
      layers[name].add(instances);
    }
    batches.clear();
    function contains(rect,x,z){
      return x>=rect.xmin&&x<=rect.xmax&&z>=rect.zmin&&z<=rect.zmax;
    }
    function floorAt(x,z,maxY=Infinity){
      let surface=Math.max(choir.floorAt(x,z,maxY),catacombs.floorAt(x,z,maxY));
      if(contains(stair,x,z)){
        const step=stairHeight(z);
        if(step<=maxY)surface=Math.max(surface,step);
      }
      if(contains(upper,x,z)){
        let floor=0;
        if(x>dais[0]&&x<dais[1]&&z>dais[2]&&z<dais[3])floor=.145*Math.min(3,1+Math.floor((dais[3]-z)/stepLength));
        if(contains(altarHatch,x,z))floor=altarMotion>=.94?-Infinity:altarHatch.top;
        if(floor<=maxY)surface=Math.max(surface,floor);
      }
      return surface;
    }
    function blocked(x,z,y,height){
      if(!Number.isFinite(floorAt(x,z,y+.01))||choir.blocked?.(x,z,y,height)||catacombs.blocked?.(x,z,y,height))return true;
      if(altarMotion>.005&&altarMotion<.94&&y>altarHatch.top-.25&&contains(altarHatch,x,z))return true;
      if(Math.abs(x)<1.52&&Math.abs(z-altar.position.z)<.89&&y<altar.position.y+.34&&y+height>altar.position.y-.08)return true;
      return solids.some(o=>{
        if(y+.13>=o.y+o.h||y+height<=o.y)return false;
        const dx=x-o.x,dz=z-o.z,c=Math.cos(o.ry),s=Math.sin(o.ry);
        return Math.abs(dx*c-dz*s)<o.w/2+.20&&Math.abs(dx*s+dz*c)<o.d/2+.20;
      });
    }
    function atLever(x,y,z){
      return atUpperLever(x,y,z)||Boolean(catacombs.atAltarLever?.(x,y,z));
    }
    function canCloseAltar(x,y,z){
      return y<-1.52||Math.abs(x)>1.67||z<altarHatch.zmin-1.05||z>altarHatch.zmax+.40;
    }
    function survey(enabled,levelY,darkness=false){
      const lower=levelY<-3,above=levelY>3;
      surveyFill.visible=enabled&&!darkness;
      surveyFill.intensity=lower?3.2:1.35;
      layers.ground.visible=!enabled||!lower&&!above;
      layers.upperWalls.visible=!enabled;
      layers.roof.visible=!enabled;
      layers.stairs.visible=!enabled||!above;
      layers.choir.visible=!enabled||above;
      layers.choirStairs.visible=!enabled||!lower;
      layers.choirRoof.visible=!enabled;
      layers.crypt.visible=!enabled||lower;
      layers.cryptRoof.visible=!enabled;
    }
    function mapRects(y,known=false){
      if(y>3)return choir.mapRects();
      if(y<-3)return [stair,...catacombs.mapRects(known)];
      return [upper,stair];
    }
    function dispose(){
      if(disposed)return;
      disposed=true;
      scene.traverse(o=>{if(o.isInstancedMesh)o.dispose()});
      scene.clear();
      for(const g of geometry)g.dispose();
      for(const m of materials)m.dispose();
      for(const t of textures)t.dispose();
    }
    return {scene,floorAt,blocked,survey,mapRects,inSecretPassage:catacombs.inSecretPassage,mapSolids:solids,lights,sightLights,updateLights:catacombs.updateLights,
      setAltarOpen,tickAltar,atLever,canCloseAltar,atBalconyDoor:choir.atBalconyDoor,setBalconyOpen:choir.setBalconyOpen,
      tickBalcony:choir.tickBalcony,canCloseBalcony:choir.canCloseBalcony,atOrgan:choir.atOrgan,dispose};
  }
  return {build};
})();
