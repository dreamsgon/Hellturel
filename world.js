'use strict';
const ElturelWorld=(()=>{
  const L=Elturel,{clamp,mix,seeded}=L,TAU=Math.PI*2;
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const color=c=>new THREE.Color(c);
  function islandPaving(earth,street){
    if(!street.map||!street.normalMap)return earth;
    const plazas=[[277,145,61,51],[-99,218,59,34],[224,40,28,19],[313,245,57,18]];
    const width=2048,height=1536;
    const minX=Math.min(...L.outline.map(p=>p[0]))-16,maxX=Math.max(...L.outline.map(p=>p[0]))+16;
    const minZ=Math.min(...L.outline.map(p=>p[1]))-16,maxZ=Math.max(...L.outline.map(p=>p[1]))+16;
    const dx=(maxX-minX)/width,dz=(maxZ-minZ)/height;
    const mask=new Uint8Array(width*height);
    const shoulder=2.5;
    function stamp(x0,z0,x1,z1,margin){
      const i0=Math.max(0,Math.floor((x0-shoulder-minX)/dx));
      const i1=Math.min(width,Math.ceil((x1+shoulder-minX)/dx));
      const j0=Math.max(0,Math.floor((z0-shoulder-minZ)/dz));
      const j1=Math.min(height,Math.ceil((z1+shoulder-minZ)/dz));
      for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){
        const k=j*width+i;
        if(mask[k]===255)continue;
        const x=minX+(i+.5)*dx,z=minZ+(j+.5)*dz,d=margin(x,z);
        if(x>-439&&x<-350&&z>120&&z<208)continue;
        if(d>=shoulder)continue;
        const wear=.53*Math.sin(x*.83+z*.69)+.37*Math.sin(x*2.81-z*1.97)+
          .32*Math.sin(x*.37-z*.51)*Math.sin(x*1.12+z*.28);
        const cover=Math.round(255*(1-L.smooth(-1.03,1.26,d+wear)));
        mask[k]=Math.max(mask[k],cover);
      }
    }
    for(const {path,w} of L.roads){
      const r=w/2;
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],vx=b[0]-a[0],vz=b[1]-a[1],inverse=1/(vx*vx+vz*vz||1);
        stamp(Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r,(x,z)=>{
          const px=x-a[0],pz=z-a[1],t=clamp((px*vx+pz*vz)*inverse,0,1);
          return Math.hypot(px-t*vx,pz-t*vz)-r;
        });
      }
    }
    for(const [x,z,w,d] of plazas){
      const rx=w/2,rz=d/2,r=3.4;
      stamp(x-rx,z-rz,x+rx,z+rz,(px,pz)=>{
        const a=Math.abs(px-x)-rx+r,b=Math.abs(pz-z)-rz+r;
        return Math.hypot(Math.max(0,a),Math.max(0,b))+Math.min(0,Math.max(a,b))-r;
      });
    }
    // Fade paving onto the banks before the streams, pond and island rim.
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      const k=j*width+i;
      if(!mask[k])continue;
      const x=minX+(i+.5)*dx,z=minZ+(j+.5)*dz;
      if(!L.inside(x,z,L.outline)){mask[k]=0;continue}
      const clearance=Math.min(L.cliff(x,z)-10,L.pathDistance(x,z,L.gorge)-L.riftWidth(z)+2,
        L.pathDistance(x,z,L.canal)-5,L.pathDistance(x,z,L.garden)-5.1,L.dist(x,z,L.pond.x,L.pond.z)-4);
      mask[k]=Math.round(mask[k]*L.smooth(0,2.2,clearance));
    }
    const coverage=new THREE.DataTexture(mask,width,height,THREE.RedFormat);
    coverage.minFilter=THREE.LinearMipmapLinearFilter;
    coverage.magFilter=THREE.LinearFilter;
    coverage.generateMipmaps=true;
    coverage.anisotropy=street.map.anisotropy;
    coverage.needsUpdate=true;
    const material=earth.clone();
    material.name='Island soil and worn paving';
    material.customProgramCacheKey=()=>'island-paving';
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{
        pavingCoverage:{value:coverage},pavingColor:{value:street.map},pavingNormal:{value:street.normalMap},
        pavingTint:{value:street.color},pavingNormalScale:{value:street.normalScale},
        pavingBounds:{value:new THREE.Vector4(minX,minZ,1/(maxX-minX),1/(maxZ-minZ))}
      });
      shader.vertexShader='varying vec2 groundPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n groundPosition = position.xz;');
      shader.fragmentShader=`
        varying vec2 groundPosition;
        uniform sampler2D pavingCoverage, pavingColor, pavingNormal;
        uniform vec3 pavingTint;
        uniform vec2 pavingNormalScale;
        uniform vec4 pavingBounds;
      `+shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 coverageUv = (groundPosition - pavingBounds.xy) * pavingBounds.zw;
        vec2 pavingUv = groundPosition / 1.8;
        mat2 settRotation = mat2(.819152, .573576, -.573576, .819152);
        vec2 alternateUv = settRotation * pavingUv + vec2(.37, .61);
        float settVariation = .50 + .30 * sin(dot(groundPosition, vec2(.31, .19))) *
          sin(dot(groundPosition, vec2(-.23, .43))) + .20 * sin(dot(groundPosition, vec2(.13, -.29)));
        float alternateWeight = smoothstep(.16, .84, settVariation);
        float pavingWeight = texture2D(pavingCoverage, coverageUv).r;
        vec3 setts = mix(texture2D(pavingColor, pavingUv).rgb,
          texture2D(pavingColor, alternateUv).rgb, alternateWeight);
        float stone = dot(setts, vec3(.2126, .7152, .0722));
        // Brighter setts remain visible where soil fills the low joints.
        pavingWeight = clamp(pavingWeight + (stone - .36) * 1.4 *
          pavingWeight * (1.0 - pavingWeight), 0.0, 1.0);
        float variation = sin(groundPosition.x * .051 + groundPosition.y * .027);
        float tone = .81 + .12 * variation * variation;
        diffuseColor.rgb = mix(diffuseColor.rgb, setts * pavingTint * tone * vec3(1.0, .95, .89), pavingWeight);
      `).replace('#include <normal_fragment_maps>',`
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 soilNormal = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          soilNormal.xy *= normalScale;
          vec3 settNormal = texture2D(pavingNormal, pavingUv).xyz * 2.0 - 1.0;
          vec3 alternateNormal = texture2D(pavingNormal, alternateUv).xyz * 2.0 - 1.0;
          alternateNormal.xy = alternateNormal.xy * settRotation;
          settNormal = mix(settNormal, alternateNormal, alternateWeight);
          settNormal.xy *= pavingNormalScale;
          normal = normalize(tbn * mix(soilNormal, settNormal, pavingWeight));
        #else
          #include <normal_fragment_maps>
        #endif
      `);
    };
    return material;
  }
  function scorchTexture(){
    const canvas=document.createElement('canvas');
    canvas.width=96;canvas.height=128;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
    const hash=(x,y)=>{
      const wave=Math.sin(x*127.1+y*311.7)*43758.5453123;
      return wave-Math.floor(wave);
    };
    const noise=(x,y)=>{
      const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
      return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);
    };
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const u=x/(canvas.width-1)*2-1,v=1-y/(canvas.height-1);
      const drift=Math.sin(v*5)*.09+v*.14;
      const width=.61+.22*Math.sin(v*3.9)-v*.24;
      const ragged=.22*noise(x*.115,y*.04)+.14*noise(x*.31,y*.14);
      const spread=(1-Math.abs(u-drift)/width)*1.25-.18+ragged;
      const fade=clamp(v*12,0,1)*clamp((1-v)*9,0,1)*(1-v*.61);
      const grain=noise(x*.36,y*.13),i=(y*canvas.width+x)*4;
      pixels.data[i]=30+grain*34;
      pixels.data[i+1]=24+grain*30;
      pixels.data[i+2]=24+grain*27;
      pixels.data[i+3]=255*clamp(spread,0,1)*fade*(.74+grain*.26);
    }
    ctx.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }
  function cemeterySurface(kind){
    const marble=kind==='marble',stone=kind==='stone'||marble,size=384;
    const pixels=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
    const random=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const rowSize=marble?96:stone?64:48,columnSize=stone?128:64;
      const row=Math.floor(y/rowSize),shift=row%2*columnSize*.5,col=Math.floor((x+shift)/columnSize);
      const u=(x+shift)%columnSize,v=y%rowSize;
      const edge=Math.min(u,columnSize-u,v,rowSize-v);
      const grain=random(x,y);
      const color=random(col%(size/columnSize),row);
      const speck=random(Math.floor(x/7),Math.floor(y/9));
      const mortar=edge<(stone?2.7:1.8)+speck*1.55;
      const erosion=Math.sin(x/size*TAU*2+y/size*TAU)*Math.sin(y/size*TAU*3-x/size*TAU);
      const veins=marble?11*Math.sin(x*.012+y*.032+3*erosion)*erosion:0;
      const shade=mortar?(marble?131:stone?91:30)+10*grain:
        (marble?173:stone?151:57)+color*(stone?29:15)+grain*9+erosion*8+speck*6+Math.min(edge,6)*1.08+veins;
      const i=y*size+x;
      heights[i]=(mortar?.18:.66)+grain*.037+Math.min(edge,8)*.012;
      pixels[i*4]=shade*(stone?1.07:.91);
      pixels[i*4+1]=shade*(stone?1.02:.98);
      pixels[i*4+2]=shade*(stone?.96:1.08);
      pixels[i*4+3]=255;
    }
    function zWrap(value,period){return (value%period+period)%period;}
    const normals=new Uint8Array(pixels.length);
    const h=(x,y)=>heights[zWrap(y,size)*size+zWrap(x,size)];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const nx=h(x-1,y)-h(x+1,y),ny=h(x,y-1)-h(x,y+1),nz=.68,length=Math.hypot(nx,ny,nz);
      const i=(y*size+x)*4;
      normals.set([(nx/length+1)*127.5,(ny/length+1)*127.5,(nz/length+1)*127.5,255],i);
    }
    const texture=(bytes,colorSpace)=>{
      const map=new THREE.DataTexture(bytes,size,size);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
      map.colorSpace=colorSpace;map.generateMipmaps=true;map.anisotropy=8;map.needsUpdate=true;
      return map;
    };
    return new THREE.MeshStandardMaterial({map:texture(pixels,THREE.SRGBColorSpace),
      normalMap:texture(normals,THREE.NoColorSpace),roughness:marble?.68:stone?.91:.78,vertexColors:marble});
  }
  function forgedIron(){
    const size=256,color=new Uint8Array(size*size*4),normal=new Uint8Array(color.length);
    const noise=(x,y)=>{
      const wave=Math.sin(x*47.835+y*31.027)*8137.5;
      return wave-Math.floor(wave);
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const scale=noise(x,y),patch=noise(x>>3,y>>4);
      const streak=.5+.5*Math.sin(x/size*TAU*8+.7*Math.sin(y/size*TAU*2));
      const rust=clamp((patch*.56+scale*.13+streak*.15-.61)*3.6,0,1);
      const base=105+15*scale+18*patch+13*streak;
      const i=(y*size+x)*4;
      color[i]=base+rust*27;
      color[i+1]=base-6-rust*15;
      color[i+2]=base-5-rust*27;
      color[i+3]=255;
      normal[i]=127+20*(noise(x-1,y)-noise(x+1,y));
      normal[i+1]=127+20*(noise(x,y-1)-noise(x,y+1));
      normal[i+2]=252;normal[i+3]=255;
    }
    const map=(data,colorSpace)=>{
      const texture=new THREE.DataTexture(data,size,size);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps=true;texture.anisotropy=8;texture.colorSpace=colorSpace;texture.needsUpdate=true;
      return texture;
    };
    const finish=map(color,THREE.SRGBColorSpace);
    return new THREE.MeshStandardMaterial({color:0xe0d8d3,map:finish,
      normalMap:map(normal,THREE.NoColorSpace),roughness:.69,metalness:.48,
      emissive:0x777371,emissiveMap:finish,emissiveIntensity:.62});
  }
  function chainLink(){
    const path=new THREE.CurvePath(),r=.78,length=.62;
    const point=(x,y)=>new THREE.Vector3(x,y,0);
    path.add(new THREE.LineCurve3(point(r,-length),point(r,length)));
    const ring=(cx,cy,start,end)=>{
      const curve=new THREE.EllipseCurve(cx,cy,r,r,start,end);
      return new THREE.CatmullRomCurve3(curve.getPoints(11).map(p=>point(p.x,p.y)));
    };
    path.add(ring(0,length,0,Math.PI));
    path.add(new THREE.LineCurve3(point(-r,length),point(-r,-length)));
    path.add(ring(0,-length,Math.PI,TAU));
    const geometry=new THREE.TubeGeometry(path,48,.177,10,true);
    const uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*6);
    return geometry;
  }
  async function materials(renderer){
    const loader=new THREE.TextureLoader(),maps={};
    const pictures=Object.entries(window.RosePicture||{}).map(([key,url])=>['window-'+key,url]);
    await Promise.all([...Object.entries(window.ELTUREL_TEXTURES||{}),...pictures].map(async ([name,url])=>{
      const t=await loader.loadAsync(url);
      const heraldic=name.startsWith('window-');
      if(!heraldic)t.wrapS=t.wrapT=THREE.RepeatWrapping;
      if(name==='cloud-panorama'){t.wrapT=THREE.ClampToEdgeWrapping;t.generateMipmaps=false;t.minFilter=THREE.LinearFilter}
      t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(heraldic||name.endsWith('-color'))t.colorSpace=THREE.SRGBColorSpace;
      maps[name]=t;
    }));
    const p=(c,opts={})=>new THREE.MeshStandardMaterial({color:c,roughness:.89,...opts});
    const tex=(n,c,s=.6,opts={})=>p(c,{map:maps[n+'-color'],normalMap:maps[n+'-normal'],
      roughnessMap:maps[n+'-roughness']||null,normalScale:new THREE.Vector2(s,s),...opts});
    const heraldry={};
    for(const [name] of pictures){
      const glass=maps[name],symbol=name.slice(7);
      heraldry[symbol]=p(0xe7dce7,{name:'Heraldic glass — '+symbol,map:glass,emissiveMap:glass,
        emissive:0xfff4eb,emissiveIntensity:.58,bumpMap:glass,bumpScale:.008,roughness:.27,side:THREE.DoubleSide});
    }
    return {
      skyClouds:maps['cloud-panorama'],
      cliff:tex('cliff',0xe0c3ac,.66,{vertexColors:true}),
      crag:tex('cliff',0xcfafa0,.58),
      earth:tex('cinder-soil',0xc3b7a9,.43,{vertexColors:true}),
      stone:tex('limestone',0xe0cbb2), chalk:tex('limestone',0xffefda,.37),
      soot:tex('limestone',0x8b7770), rubble:tex('basalt',0xb2a291),
      houseStone:tex('wall-stone',0xe4dfd6,.86), houseChalk:tex('wall-stone',0xfff4e2,.64),
      houseSoot:tex('wall-stone',0xa89a91,.89), footing:tex('wall-stone',0xa09a91,.75),
      scorchedStone:tex('wall-stone',0xc3b1a0,.89),
      street:tex('paving',0xe7d6bd,.44,{vertexColors:true,side:THREE.DoubleSide}),
      slate:tex('slate',0x9da1b1),clay:tex('clay',0xcd8b79),
      pitchedSlate:tex('pitched-slate',0xa9a9b2,.78,{side:THREE.DoubleSide}),
      pitchedClay:tex('pitched-clay',0xc8ae9a,.71,{side:THREE.DoubleSide}),
      scorchedSlate:tex('pitched-slate',0x8f8182,.82,{side:THREE.DoubleSide}),
      scorchedClay:tex('pitched-clay',0xac9084,.78,{side:THREE.DoubleSide}),
      fireSoot:p(0xffffff,{map:scorchTexture(),transparent:true,alphaTest:.022,depthWrite:false}),
      charWood:tex('grain',0x49382e,.72),
      timber:tex('timber',0xc5a88b),door:tex('grain',0x866349,.62),
      frame:tex('grain',0x72604e,.43),charFrame:tex('timber',0x928880,.60),
      trim:p(0x352923),plaster:tex('wall-plaster',0xf8e5c6,.58),
      burntPlaster:tex('wall-plaster',0xc9b3a0,.69),
      metal:p(0x392c33,{metalness:.39,roughness:.64}),
      chain:forgedIron(),brass:p(0x855b40,{metalness:.56}),
      glass:p(0x302b33,{roughness:.29,emissive:0x653117,emissiveIntensity:.07}),
      hallGlass:p(0x414653,{roughness:.43,emissive:0x414663,emissiveIntensity:.20}),
      heraldry,
      cemeteryGlass:p(0x766385,{roughness:.33,emissive:0x73528f,emissiveIntensity:.24}),
      chapelAshlar:cemeterySurface('stone'),chapelSlate:cemeterySurface('slate'),chapelMarble:cemeterySurface('marble'),
      lit:p(0x8a6d4d,{roughness:.36,emissive:0xff9844,emissiveIntensity:.24}),
      ghost:p(0xc8b8f7,{emissive:0xbaa1ff,emissiveIntensity:1.15}),
      oak:tex('grain',0xb9956f,.37,{roughness:.92}),
      plank:tex('grain',0xb69b76,.46,{roughness:.91}),
      linen:p(0xb2a187,{roughness:1}),
      cloth:p(0xab8368,{side:THREE.DoubleSide})
    };
  }
  function masonryGeometry(u=3.1,v=2.6){
    const g=new THREE.BoxGeometry(1,1,1),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);
    return g;
  }
  function cathedralMasonry(width,height,depth){
    const g=new THREE.BoxGeometry(1,1,1),uv=g.attributes.uv,normal=g.attributes.normal;
    for(let i=0;i<uv.count;i++){
      const horizontal=Math.abs(normal.getX(i))>.5?depth:width;
      const vertical=Math.abs(normal.getY(i))>.5?depth:height;
      uv.setXY(i,uv.getX(i)*horizontal/4.8,uv.getY(i)*vertical/4.8);
    }
    return g;
  }
  function roofGeometry(u=5,v=4){
    const pos=[],uv=[];
    const a=[-.5,0,-.5],b=[.5,0,-.5],c=[.5,0,.5],d=[-.5,0,.5],e=[-.5,1,0],f=[.5,1,0];
    for(const [x,y,z,s,t,w] of [[a,e,f,[0,0],[0,v],[u,v]],[a,f,b,[0,0],[u,v],[u,0]],
      [d,c,f,[.17,0],[u+.17,0],[u+.17,v]],[d,f,e,[.17,0],[u+.17,v],[.17,v]]]){
      pos.push(...x,...y,...z);uv.push(...s,...t,...w);
    }
    return geo(pos,uv);
  }
  function geo(pos,uv,col,indices){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(col)g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    if(indices)g.setIndex(indices);
    g.computeVertexNormals();return g;
  }
  async function build(renderer){
    const mat=await materials(renderer),scene=new THREE.Scene(),env=Avernus.build(scene,mat.skyClouds,mat.rubble.map);
    const islandGround=islandPaving(mat.earth,mat.street);
    AvernianHorizon.build(scene,env,mat.cliff.map);
    const flyovers=ElturelFlyovers.build(scene);
    const rng=seeded(41800), between=(a,b)=>mix(a,b,rng()),pick=a=>a[Math.floor(rng()*a.length)];
    const cyl=(a,b,n)=>new THREE.CylinderGeometry(a,b,1,n);
    const shapeBox=new THREE.BoxGeometry(1,1,1);
    const shapes={box:shapeBox,detail:shapeBox,scorch:new THREE.PlaneGeometry(1,1),masonry:masonryGeometry(),roof:roofGeometry(),
      houseWall:masonryGeometry(1.48,1.08),foundation:masonryGeometry(1.66,.43),
      hillsideFoundation:masonryGeometry(1.66,1.76),pitchedRoof:roofGeometry(1.75,1.28),
      gable:geo([-.5,0,-.5,-.5,0,.5,-.5,1,0,.5,0,.5,.5,0,-.5,.5,1,0],[0,0,1.48,0,.74,.45,0,0,1.48,0,.74,.45]),
      rock:new THREE.IcosahedronGeometry(1,0),cyl:cyl(1,1,10),pole:cyl(.78,1,8),cone:cyl(0,1,10),
      orb:new THREE.SphereGeometry(1,12,8),roseRim:new THREE.TorusGeometry(1,.065,12,96),link:new THREE.TorusGeometry(1,.16,6,15),chainLink:chainLink()};
    shapes.anchorShaft=new THREE.LatheGeometry([[0,0],[.79,0],[.96,.017],[1,.029],[1,.068],[.97,.079],[.86,.088],
      [.86,.144],[.81,.163],[.68,.178],[.62,.212],[.60,.705],[.63,.735],[.63,.795],
      [.69,.811],[.73,.832],[.73,.891],[.69,.907],[.56,.918],[.56,.945],[.52,.96],[.45,.969],[0,.969]]
      .map(([r,h])=>new THREE.Vector2(r,h)),40);
    shapes.grassBlade=new THREE.SphereGeometry(1,4,2);
    shapes.anchorBolt=new THREE.SphereGeometry(1,12,8,0,TAU,0,Math.PI/2);
    shapes.towerShaft=cyl(1,1,24);
    shapes.ruinWall=shapes.houseWall;
    shapes.cathedralNave=cathedralMasonry(13.6,23,22);
    shapes.cathedralAisle=cathedralMasonry(8.2,12.25,22);
    const towerUV=shapes.towerShaft.attributes.uv;
    for(let i=0;i<towerUV.count;i++)towerUV.setXY(i,towerUV.getX(i)*6.4,towerUV.getY(i)*3.7);
    const tiles=new Map(),worldObjects=[],doors=[],dynamicDoors=new Map(),heat=[],soundFires=[],collision=new Map(),curated={};
    const cell=(x,z)=>Math.floor(x/16)+':'+Math.floor(z/16);
    function collider(o){
      const r=Math.hypot(o.w,o.d)/2+1;
      for(let x=Math.floor((o.x-r)/16);x<=Math.floor((o.x+r)/16);x++){
        for(let z=Math.floor((o.z-r)/16);z<=Math.floor((o.z+r)/16);z++){
          const k=x+':'+z;
          if(!collision.has(k))collision.set(k,[]);
          collision.get(k).push(o);
        }
      }
    }
    function batch(kind,m,position,rotation,scale,tint){
      const k=[kind,m,Math.floor(position.x/168),Math.floor(position.z/168)].join(':');
      if(!tiles.has(k))tiles.set(k,[]);
      tiles.get(k).push([new THREE.Matrix4().compose(position,rotation,scale),color(tint)]);
    }
    function inst(kind,m,x,y,z,w,h,d,a=0,tint=0xffffff,rx=0,rz=0){
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,a,rz,'YXZ'));
      batch(kind,m,V(x,y,z),q,V(w,h,d),tint);
    }
    function box(m,x,y,z,w,h,d,a=0,t=0xffffff){
      const body=w>=4&&d>=3&&h>3&&['chalk','stone','soot'].includes(m);
      const detail=Math.min(w,h,d)<.48&&Math.max(w,h,d)<8;
      inst(body?'masonry':detail?'detail':'box',m,x,y,z,w,h,d,a,t);
    }
    function beam(m,a,b,w,d=w,t=0xffffff){
      const start=V(...a),end=V(...b),dir=end.clone().sub(start);
      const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dir.clone().normalize());
      batch('box',m,start.lerp(end,.5),q,V(w,dir.length(),d),t);
    }
    function local(o,x,z){
      const c=Math.cos(o.angle),s=Math.sin(o.angle);
      return [o.x+x*c+z*s,o.z-x*s+z*c];
    }
    function lb(o,m,x,y,z,w,h,d,t=0xffffff){
      const [a,b]=local(o,x,z);box(m,a,o.y+y,b,w,h,d,o.angle,t);
    }
    function facadeBeam(o,m,a,b,width,depth,tint){
      const [ax,az]=local(o,a[0],a[2]),[bx,bz]=local(o,b[0],b[2]);
      beam(m,[ax,o.y+a[1],az],[bx,o.y+b[1],bz],width,depth,tint);
    }
    function sootMark(o,side,x,y,z,w,h,slope=0){
      if(w<=0||h<=0)return;
      const [px,pz]=local(o,x,z);
      inst('scorch','fireSoot',px,o.y+y,pz,w,h,1,o.angle+(side<0?Math.PI:0),0xffffff,slope);
    }
    function damagedEaves(o,h,rise,side,x,tint){
      const run=o.d/2+.41,edge=side*(o.d/2+.32),gap=Math.min(2.75,o.w*.37);
      const left=x-gap/2,right=x+gap/2,half=o.w/2+.41;
      lb(o,'charFrame',(left-half)/2,h+.04,edge,left+half,.19,.20,tint);
      lb(o,'charFrame',(right+half)/2,h+.04,edge,half-right,.19,.20,tint);
      for(const [end,direction,length,drop] of [[left,1,.45,.15],[right,-1,.65,.28]]){
        facadeBeam(o,'charWood',[end,h+.04,edge],[end+direction*length,h-drop,edge+side*.08],.16,.17,tint);
      }
      const slope=-Math.atan2(run,rise),length=Math.hypot(run,rise);
      sootMark(o,side,x,h+rise*.35+.027,side*run*.65,gap*1.85,length*.68,slope);
      for(const [dx,reach] of [[-.34,.15],[-.07,.23],[.19,.17],[.38,.09]]){
        const px=x+gap*dx;
        facadeBeam(o,'charWood',[px,h+rise*reach+.033,side*run*(1-reach)],
          [px+.08,h-.21,side*(run+.22)],.087,.12,tint);
      }
    }
    function windowFrame(o,side,x,y,w,h,{stone,frame,tint,shutter=false,lit=false}){
      const z=side*(o.d/2+.04);
      lb(o,stone,x,y,z,w+.22,h+.26,.15,tint);
      lb(o,'trim',x,y,z+side*.088,w+.05,h+.064,.06);
      lb(o,lit?'lit':'glass',x,y,z+side*.122,w-.025,h-.025,.045);
      lb(o,frame,x,y,z+side*.153,.055,h,.046);
      lb(o,stone,x,y-h/2-.095,z+side*.092,w+.33,.13,.32,tint);
      if(shutter)for(const hinge of [-1,1]){
        lb(o,frame,x+hinge*w*.71,y,z+side*.11,w*.37,h+.045,.12,tint);
      }
    }
    function door(o){
      const w=1.28,h=2.24,[x,z]=local(o,-w/2,o.d/2+.18);
      const pivot=new THREE.Group();pivot.position.set(x,o.y+.12,z);pivot.rotation.y=o.angle;
      const leaf=new THREE.Mesh(shapes.box,mat.door);
      leaf.scale.set(w,h,.145);leaf.position.set(w/2,h/2,0);leaf.castShadow=true;leaf.receiveShadow=true;pivot.add(leaf);
      for(const y of [.35,h-.46]){
        const strap=new THREE.Mesh(shapes.box,mat.metal);
        strap.scale.set(w*.85,.07,.035);strap.position.set(w/2,y,.08);pivot.add(strap);
      }
      const knob=new THREE.Mesh(shapes.orb,mat.brass);
      knob.scale.setScalar(.068);knob.position.set(w*.84,1.1,.13);pivot.add(knob);scene.add(pivot);
      const item={x,z,y:o.y,w,h,open:false,angle:0,pivot,o,id:o.id};
      doors.push(item);dynamicDoors.set(item.id,item);
    }
    function furnishHouse(o,solid,table){
      const prop=(...args)=>lb(o,...args);
      const rod=(m,a,b,size,tint)=>facadeBeam(o,m,a,b,size,size,tint);
      const round=(m,x,y,z,r,h,tint)=>{
        const [px,pz]=local(o,x,z);
        inst('cyl',m,px,o.y+y,pz,r,h,r,o.angle,tint);
      };
      const crate=(x,z,w,d,h)=>{
        prop('plank',x,h/2,z,w,h,d,0xc49b79);
        for(const dx of [-w*.33,w*.33])prop('oak',x+dx,h/2,z+d*.51,.11,h+.04,.075);
        solid(x,z,w,d,h);
      };
      if(o.id==='net-shop'){
        table(-3.4,-1.65,3.4,1.4);
        prop('linen',-3.7,1.17,-1.64,2.16,.07,1.16,0x776647);
        for(let i=0;i<5;i++)rod('oak',[-4.32+i*.35,1.23,-1.91],[-4.02+i*.35,1.23,-1.37],.035,0xb79b75);
        for(const x of [-5.5,-1.14])prop('timber',x,1.72,-4.22,.15,3.44,.19);
        prop('oak',-3.32,3.27,-4.22,4.48,.16,.15);
        // Hang a weighted net with a few missing strands where it is being repaired.
        for(let row=0;row<7;row++)for(let col=0;col<15;col++){
          if(row>2&&row<6&&col>5&&col<9)continue;
          const x=-5.38+col*.276,y=3.10-row*.285;
          for(const side of [-1,1])if((col>0&&side<0)||(col<14&&side>0))
            rod('linen',[x,y,-4.19],[x+side*.138,y-.285,-4.19],.024,0xa59168);
        }
        for(let i=0;i<7;i++)round('plank',-5.2+i*.62,1.04,-4.19,.092,.18,0xa89277);
        solid(-3.32,-4.22,4.48,.19,3.36);
        crate(5.35,-3.96,1.68,1.25,.82);
        crate(4.88,-2.7,1.12,.88,.57);
      }else if(o.id==='bell-house'){
        table(-3.5,-2.45,2.48,1.3);
        for(let i=0;i<3;i++)prop('linen',-3.57,1.16+i*.086,-2.52,1.01-i*.11,.085,.69-i*.045,0xe2d4bc);
        const rackZ=-4.5;
        for(const x of [-4.75,.85]){
          prop('timber',x,1.61,rackZ,.13,3.22,.16);
          solid(x,rackZ,.13,.16,3.22);
        }
        rod('linen',[-4.75,3.08,rackZ],[-2,2.94,rackZ],.036,0xd3b699);
        rod('linen',[-2,2.94,rackZ],[.85,3.08,rackZ],.036,0xd3b699);
        for(const [x,w,h,tint] of [[-4.02,.97,1.04,0xd1c5ae],[-2.78,1,1.55,0xb5aca4],[-1.31,1.22,1.22,0xd9c4ad],[.08,.89,1.43,0xa9a192]]){
          for(let i=0;i<8;i++)prop('cloth',x+(i-3.5)*w/8,3.01-h/2,rackZ+(i%2)*.035,w/8+.008,h,.044,tint);
          for(const dx of [-.35,.35])prop('oak',x+dx*w,3.02,rackZ+.041,.06,.16,.065);
        }
        for(const [x,z,r] of [[3.86,-2.85,.80],[4.37,-.91,.55]]){
          round('oak',x,.37,z,r,.61,0xc7a77d);
          for(const y of [.19,.61])round('metal',x,y,z,r+.025,.05);
          round('trim',x,.696,z,r-.055,.05,0x777b78);
          solid(x,z,r*2,r*2,.72);
        }
        prop('oak',4.75,.556,-2.84,.44,.92,.11,0xc0a483);
        for(let i=0;i<8;i++)prop('trim',4.75,.18+i*.079,-2.76,.39,.022,.056);
      }else{
        table(1.99,-1.62,1.95,1.32);
        prop('linen',1.95,1.16,-1.65,1.42,.065,.63,0x9f6b53);
        prop('oak',2.13,1.22,-1.74,.51,.07,.37,0xc5ad84);
        prop('linen',2.13,1.265,-1.74,.46,.028,.34,0xe1c59e);
        for(let i=0;i<4;i++)prop('trim',2.13,1.282,-1.83+i*.063,.32,.012,.012);
        round('clay',1.37,1.26,-1.23,.15,.23,0xc39576);
        const bedX=-2.8,bedZ=-2.59;
        prop('oak',bedX,.38,bedZ,1.58,.60,2.93);
        prop('oak',bedX,.79,bedZ-1.42,1.68,1.10,.19);
        prop('linen',bedX,.73,bedZ,1.52,.18,2.73,0xd8c7a2);
        prop('linen',bedX,.82,bedZ-.97,1.14,.22,.57,0xe3d0b2);
        prop('cloth',bedX,.84,bedZ+.27,1.57,.08,1.78,0x797969);
        solid(bedX,bedZ,1.68,3.05,.87);
        prop('houseStone',2.86,.64,-4.33,1.91,1.28,.85);
        prop('trim',2.86,.38,-3.88,1.19,.64,.06);
        prop('houseStone',2.86,1.34,-4.28,2.02,.18,.92);
        prop('scorchedStone',2.86,2.03,-4.59,1.46,1.28,.40);
        prop('timber',2.86,.26,-3.77,1.24,.24,.22);
        solid(2.86,-4.25,2.02,1.03,1.43);
        crate(-3.24,2.43,1.08,.71,.66);
      }
    }
    function house(src,interior=false,activeDoor=false){
      const o={...src,angle:src.angle||0,y:src.y??L.surface(src.x,src.z)+.09};
      const {x,y,z,w,d,h,angle,style=0}=o;
      const custom=interior==='furnished';
      const tavernShell=o.id==='antlers';
      const burnt=o.burnt||o.id==='oil-shop'||o.id==='market-tools';
      const stone=burnt?'scorchedStone':style===5?'houseChalk':'houseStone';
      const framed=style===2||style===3;
      const face=framed?(burnt?'burntPlaster':'plaster'):stone;
      const frame=burnt?'charFrame':'frame';
      const clay=style===1||style===4;
      const roofing=clay?(burnt?'scorchedClay':'pitchedClay'):(burnt?'scorchedSlate':'pitchedSlate');
      const rise=clamp(d*(style===4?.27:.35),1.5,5.8);
      const cross=!tavernShell&&!interior&&(style===3||style===5)&&d>6&&w>6;
      const tone=.104*Math.sin(x*.081+z*.123);
      const scarDirection=Math.sin(x*.47+z*.71)>0?1:-1;
      const roofFace=cross?{...o,angle:angle+Math.PI/2,w:d,d:w}:o;
      const tint=new THREE.Color().setHSL(.09+between(-.028,.028),between(.05,.24),clamp(between(.76,.98)+tone,.68,1));
      const walls=(m,px,py,pz,sx,sy,sz)=>{
        const [bx,bz]=local(o,px,pz);
        inst('houseWall',m,bx,y+py,bz,sx,sy,sz,angle,tint);
      };
      let footingBottom=y-1.24;
      for(const px of [-w/2,0,w/2])for(const pz of [-d/2,0,d/2]){
        footingBottom=Math.min(footingBottom,L.terrain(...local(o,px,pz))-.32);
      }
      const footingTop=y+.07;
      inst(y-footingBottom>3.2?'hillsideFoundation':'foundation',burnt?'houseSoot':'footing',x,(footingBottom+footingTop)/2,z,
        w+.26,footingTop-footingBottom,d+.26,angle,tint);
      if(interior){
        for(const side of [-1,1]){
          const width=(w-1.47)/2,px=side*(.735+width/2),zp=d/2;
          walls(face,px,h/2,zp,width,h,.41);
          walls(stone,side*w/2,h/2,0,.43,h,d);
          for(const [lx,lz,a,b] of [[px,zp,width,.42],[side*w/2,0,.43,d]]){
            const [cx,cz]=local(o,lx,lz);collider({x:cx,z:cz,y,w:a,d:b,h,angle});
          }
        }
        walls(stone,0,h/2,-d/2,w,h,.43);
        const [bx,bz]=local(o,0,-d/2);collider({x:bx,z:bz,y,w,d:.43,h,angle});
        lb(o,face,0,(h+2.36)/2,d/2,1.48,h-2.36,.44,tint);
        const solid=(px,pz,width,length,height,extra)=>{
          const [cx,cz]=local(o,px,pz);
          collider({x:cx,z:cz,y,w:width,d:length,h:height,angle,...extra});
        };
        const floorboards=Math.ceil(w/.26),boardTints=[0xb9a17e,0xd0b38f,0xa7856f,0xc8ab89];
        for(let i=0;i<floorboards;i++){
          const board=w/floorboards,px=(i+.5)*board-w/2;
          lb(o,'plank',px,.028,0,board-.014,.13,d,custom?boardTints[(i*7+Math.floor(i/5))%boardTints.length]:pick(boardTints));
        }
        if(custom)solid(0,.04,w,d+.26,.093,{tread:'wood',floorOnly:true});
        const table=(px,pz,width,length)=>{
          for(const x of [-1,1])for(const z of [-1,1])lb(o,'oak',px+x*(width/2-.14),.55,pz+z*(length/2-.08),.13,1.02,.12);
          lb(o,'oak',px,1.05,pz,width,.17,length);
          solid(px,pz,width,length,1.11);
        };
        if(custom)furnishHouse(o,solid,table);
        else{
          table(-w*.17,-d*.17,2.78,1.54);
          lb(o,'linen',-w*.21,1.15,-d*.16,1.77,.049,.91,0xbca58a);
          lb(o,'linen',-w*.13,1.20,-d*.20,.64,.056,.45,0xaaa0ac);
          lb(o,'trim',-w*.13,1.24,-d*.16,.44,.028,.042);
          table(w*.30,-d*.29,1.62,2.41);
          for(let i=0;i<4;i++){
            const [cx,cz]=local(o,w*.29+.20,-d*.29+(i-1.5)*.42);
            inst('cyl','linen',cx,y+1.23,cz,.12,.58,.12,angle,pick([0x7f6852,0xb49d87,0xbcab9e]),Math.PI/2);
          }
          for(let i=0;i<7;i++)lb(o,i%2?'oak':'plank',-w*.40,.35+(i%2)*.52,-d*.17+i*.65,.62,.64,.60);
          lb(o,'oak',w*.28,.43,d*.24,1.64,.81,.78);
          lb(o,'brass',w*.28,.84,d*.24,.43,.059,.082);
        }
        const [lx,lz]=local(o,w*.15,d*.20);heat.push({x:lx,y:y+2.9,z:lz,type:'lamp'});
        const group=new THREE.Group();group.position.set(x,y+h,z);group.rotation.y=angle;
        for(const [kind,m] of [['pitchedRoof',roofing],['gable',stone]]){
          const mesh=new THREE.Mesh(shapes[kind],mat[m]);
          mesh.scale.set(w+(kind==='pitchedRoof'?.71:0),rise,d+(kind==='pitchedRoof'?.81:0));
          mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
        }
        const ridge=new THREE.Mesh(shapes.box,mat[roofing]);
        ridge.position.y=rise-.04;ridge.scale.set(w+.76,.18,.21);
        ridge.castShadow=true;ridge.receiveShadow=true;group.add(ridge);
        if(custom){
          const ceilingHeight=o.id==='orrel-house'?3.34:4.08;
          const ceiling=new THREE.Mesh(shapes.box,mat.plank);
          ceiling.position.y=ceilingHeight-h;
          ceiling.scale.set(w,.16,d);
          ceiling.castShadow=ceiling.receiveShadow=true;
          group.add(ceiling);
        }
        scene.add(group);o.roof=group;
      }else{
        if(framed){
          walls(stone,0,h*.177,0,w,h*.354,d);
          walls(face,0,h*.675,0,w+.035,h*.65,d+.035);
        }else walls(stone,0,h/2,0,w,h,d);
        collider({x,z,y,w,d,h,angle,id:o.id});
        inst('pitchedRoof',roofing,x,y+h,z,(cross?d:w)+.72,rise,(cross?w:d)+.82,angle+(cross?Math.PI/2:0),tint);
        inst('gable',stone,x,y+h,z,cross?d:w,rise,cross?w:d,angle+(cross?Math.PI/2:0),tint);
        box(roofing,x,y+h+rise-.052,z,(cross?d:w)+.71,.15,.20,angle+(cross?Math.PI/2:0),tint);
      }
      for(const facade of [-1,1]){
        if(burnt&&!interior&&facade===(cross?scarDirection:1)){
          damagedEaves(roofFace,h,rise,facade,scarDirection*roofFace.w*.23,tint);
        }else{
          const eave=facade*(roofFace.d/2+.32);
          lb(roofFace,frame,0,h+.003,eave,roofFace.w+.70,.17,.18,tint);
          if(!interior)lb(roofFace,burnt?'charWood':'timber',0,h-.069,
            facade*(roofFace.d/2+.15),roofFace.w+.65,.11,.47,tint);
        }
        if(!interior){
          const eave=facade*(roofFace.d/2+.395),tileEnd=roofFace.w/2+.343;
          for(const side of [-1,1])facadeBeam(roofFace,frame,[side*tileEnd,h-.067,eave],
            [side*tileEnd,h+rise-.081,0],.14,.15,tint);
        }
        if(framed){
          const fz=facade*(d/2+.095),band=h*.349;
          lb(o,frame,0,band,fz,w+.065,.22,.21,tint);
          for(const side of [-1,1]){
            const post=side*(w/2-.09);
            lb(o,frame,post,(h+band)/2,fz,.25,h-band,.24,tint);
            const [ax,az]=local(o,post,fz),[bx,bz]=local(o,post-side*1.14,fz);
            beam(frame,[ax,y+band+.18,az],[bx,y+band+1.14,bz],.16,.14,tint);
          }
        }
        const floors=h>11?3:h>6.8||tavernShell?2:1,columns=Math.max(2,Math.floor(w/3.3));
        for(let f=0;f<floors;f++){
          const level=1.78+f*((h-1.2)/floors);
          for(let j=0;j<columns;j++){
            const dx=(j-(columns-1)/2)*w/(columns+.28);
            if((f===0&&facade===1&&Math.abs(dx)<1.45)||rng()<.12)continue;
            const lit=!o.burnt&&rng()<.13;
            if(tavernShell)continue;
            const ww=style===5?1.06:.8,hh=style===5?1.67:1.13,fz=facade*(d/2+.09);
            lb(o,framed?frame:stone,dx,level,fz,ww+.28,hh+.28,.18);
            lb(o,'trim',dx,level,fz+facade*.092,ww+.07,hh+.08,.058);
            lb(o,lit&&!burnt?'lit':'glass',dx,level,fz+facade*.127,ww,hh,.045);
            lb(o,frame,dx,level,fz+facade*.158,.063,hh,.043);
            if(style===5)lb(o,frame,dx,level+.10,fz+facade*.158,ww,.05,.045);
            lb(o,stone,dx,level-hh/2-.08,fz+facade*.115,ww+.38,.135,.36);
            if(f&&framed)for(const side of [-1,1])lb(o,frame,dx+side*(ww/2+.28),level,fz+facade*.113,.41,hh+.11,.13);
            if(burnt&&!interior&&facade===1&&Math.sign(dx)===scarDirection){
              const bottom=level+hh*.17,markHeight=Math.min(h-bottom-.03,f?3.55:2.55);
              const markWidth=Math.min(ww*(f?3.3:2.7),w-2*Math.abs(dx)-.05);
              sootMark(o,facade,dx,bottom+markHeight/2,facade*(d/2+.027),markWidth,markHeight);
              if(f&&j%2===0){
                lb(o,'charWood',dx+ww*.12,level+.10,fz+facade*.158,ww*.59,.082,.065,tint);
              }
            }
          }
          if(f&&!tavernShell&&style%3!==1)lb(o,framed?frame:stone,0,level-.87,facade*(d/2+.1),w,.17,.16);
        }
      }
      if(!interior||custom){
        const flank={...o,angle:angle+Math.PI/2,w:d,d:w};
        const dock=o.ward==='east';
        const detail=Math.abs(Math.sin(x*.734+z*1.297));
        const loadingHouse=(!activeDoor||custom)&&dock&&w>8.4&&d>8.8&&
          (['net-shop','long-house'].includes(o.id)||(o.id?.startsWith('house-')&&style===4&&detail>.76));
        for(const side of [-1,1]){
          const loading=loadingHouse&&side===1;
          const wallZ=side*(w/2+.05),low=style===5?2.14:1.89;
          const wide=d>9.2,ledge=h>6.8?h*.64:0;
          const shutter=dock&&!burnt&&(style===0||style===2||style===3);
          const fenestration={stone,frame,tint,shutter,lit:!burnt&&detail>.93};
          if(loading){
            lb(flank,stone,0,1.65,wallZ,3.02,3.31,.29,tint);
            lb(flank,'trim',0,1.53,wallZ+.181,2.56,3.02,.088);
            lb(flank,'door',0,1.53,wallZ+.252,2.38,2.96,.10,burnt?0x807170:0xb6a28c);
            lb(flank,frame,0,1.53,wallZ+.313,.065,2.94,.06);
            for(const height of [.47,2.52])lb(flank,'metal',0,height,wallZ+.322,2.26,.058,.06);
            lb(flank,stone,0,3.16,wallZ+.14,2.78,.26,.33,tint);
          }else if(!tavernShell){
            for(const offset of wide&&style!==4?[-d*.23,d*.23]:[d*(side*.14)]){
              windowFrame(flank,side,offset,low,style===5?.89:.73,style===4?.77:1.10,fenestration);
            }
          }
          if(ledge&&!tavernShell){
            const offset=d*(wide&&style!==5?.21:0);
            windowFrame(flank,side,offset,ledge,style===5?.95:.83,style===5?1.5:1.16,fenestration);
            if(wide&&offset&&style!==4)windowFrame(flank,side,-offset,ledge,.76,1.12,fenestration);
          }
          if(framed&&ledge)lb(flank,frame,0,h*.35,wallZ,d+.06,.19,.17,tint);
        }
        const end=cross?o:flank;
        for(const side of [-1,1]){
          const wallZ=side*(end.d/2+.055),attic=h+rise*.40;
          if(rise>2.1&&!tavernShell){
            const loft=loadingHouse&&side===1&&!cross;
            const ventWidth=loft?1.32:style===5?.71:.56;
            const ventHeight=loft?1.27:style===5?1.01:.72;
            lb(end,loft?frame:stone,0,attic,wallZ,ventWidth+.19,ventHeight+.21,.16,tint);
            lb(end,loft?'door':'trim',0,attic,wallZ+side*.10,ventWidth,ventHeight,.10);
            if(loft){
              lb(end,frame,0,attic+ventHeight*.66,wallZ+.69,.23,.23,1.58,tint);
              facadeBeam(end,frame,[0,attic+.04,wallZ+.15],[0,attic+ventHeight*.61,wallZ+1.21],.13,.13,tint);
              lb(end,'metal',0,attic-.02,wallZ+1.4,.033,1.53,.036);
            }else{
              for(const slat of [-1,0,1])lb(end,frame,0,attic+slat*ventHeight*.25,wallZ+side*.162,ventWidth,.048,.06,tint);
            }
          }
          if(framed||style===5){
            for(const rake of [-1,1]){
              facadeBeam(end,frame,[rake*end.w/2,h+.04,wallZ],[0,h+rise,wallZ],.15,.20,tint);
            }
            if(framed)lb(end,frame,0,h+.11,wallZ,end.w,.16,.13,tint);
          }
        }
      }
      if(o.ward==='high'&&style%2===0){
        lb(o,stone,0,3.62,d/2+.58,w*.61,.23,1.52);
        lb(o,'metal',0,4.61,d/2+1.26,w*.61,.081,.11);
        for(let i=-5;i<=5;i++)lb(o,'metal',i*w*.055,4.16,d/2+1.26,.047,.94,.047);
      }
      if(activeDoor||interior)door(o);else lb(o,'door',0,1.16,d/2+.13,1.33,2.32,.17);
      if(burnt&&!interior){
        const riseAboveDoor=Math.min(3.34,h-2.32);
        sootMark(o,1,scarDirection*.61,2.28+riseAboveDoor/2,d/2+.029,3.28,riseAboveDoor);
        const scarX=scarDirection*w*.30;
        sootMark(o,1,scarX,1.21,d/2+.028,Math.min(3.8,w*.28),2.42);
        for(const [dx,dz,width,height] of [[-.49,.31,.49,.18],[.13,.50,.40,.24],[.65,.27,.59,.15]]){
          const [px,pz]=local(o,scarX+dx,d/2+dz);
          const ground=L.surface(px,pz);
          inst('rock','rubble',px,ground+height*.44,pz,width,height,width*.68,angle+dx,0x817068,dx*.4);
        }
      }
      if(!interior&&o.ward==='east'&&!activeDoor){
        const recess=d/2+.17,portal=style===4||style===5?'houseChalk':stone;
        const dressed=style===0||style===4||style===5;
        for(const side of [-1,1]){
          lb(o,dressed?portal:frame,side*.78,1.16,recess,.23,2.32,.31,tint);
          if(dressed){
            lb(o,portal,side*.78,.24,recess+.06,.33,.48,.38,tint);
            lb(o,portal,side*.78,2.13,recess+.055,.32,.22,.38,tint);
          }
        }
        lb(o,dressed?portal:frame,0,2.43,recess+.038,1.94,.30,.39,tint);
        lb(o,portal,0,2.61,recess+.07,dressed?2.13:1.89,.11,.33,tint);
        lb(o,'metal',.40,1.08,recess+.102,.12,.12,.10);
        if(style===4&&!burnt&&w>8.1&&Math.sin(x*1.71+z*.73)>.77){
          const [cx,cz]=local(o,0,d/2+.66);
          inst('box',roofing,cx,y+2.89,cz,2.36,.14,1.20,angle,tint,.16);
          for(const side of [-1,1]){
            const px=side*.94;
            facadeBeam(o,frame,[px,2.31,recess+.07],[px,2.80,recess+.85],.12,.12,tint);
          }
        }
      }else{
        for(const side of [-1,1])lb(o,stone,side*.77,1.16,d/2+.16,.20,2.31,.27);
        lb(o,stone,0,2.38,d/2+.18,1.82,.25,.34);
      }
      const approach=L.terrain(...local(o,0,d/2+.61))-y;
      const thresholdBase=Math.min(-.07,approach-.14);
      lb(o,stone,0,(.13+thresholdBase)/2,d/2+.30,1.98,.13-thresholdBase,.85);
      if(approach<-.25){
        const lowerBase=Math.min(approach-.18,-.15);
        lb(o,'footing',0,(lowerBase-.10)/2,d/2+.67,2.11,-.10-lowerBase,.83);
      }
      if(custom){
        // Lift the chimney with the roof when exporting the furnished floor.
        for(const [cy,width,height,depth] of [[rise*.63,.91,rise*.83+1,1],[rise*1.05+.45,1.10,.18,1.24]]){
          const chimney=new THREE.Mesh(shapes.box,mat[stone]);
          chimney.position.set(w*.27,cy,-.69);
          chimney.scale.set(width,height,depth);
          chimney.castShadow=chimney.receiveShadow=true;
          o.roof.add(chimney);
        }
      }else if(!interior){
        lb(o,stone,w*.27,h+rise*.63,-.69,.91,rise*.83+1,1.00);
        lb(o,stone,w*.27,h+rise*1.05+.45,-.69,1.10,.18,1.24);
      }
      o.burnt=burnt;
      worldObjects.push(o);return o;
    }
    function mesh(pos,uv,col,ind,material){
      const body=new THREE.Mesh(geo(pos,uv,col,ind),material);
      body.receiveShadow=true;scene.add(body);return body;
    }
    function terrain(x0,z0,x1,z1,step){
      const pos=[],uv=[],col=[],ind=[];
      const nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step);
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
        const x=mix(x0,x1,i/nx),z=mix(z0,z1,j/nz),y=L.avernusFloor(x,z);
        const cliff=y<5&&y>-150;
        pos.push(x,y,z);uv.push(x/5.9+(cliff?y*.109:0),z/5.9+(cliff?y*.068:0));
        const noise=.53+.19*Math.sin(x*.055+z*.036)+.13*Math.sin(z*.072-x*.028)+.10*Math.sin(x*.191+z*.13);
        const t=cliff?.37+noise*.37:y<-102?.44+noise*.33:.67+noise*.41;
        col.push(t*(cliff?.92:1.13),t*(cliff?.85:1),t*.91);
        if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+nx+1;ind.push(a,b,a+1,b,b+1,a+1)}
      }
      mesh(pos,uv,col,ind,mat.earth);
    }
    // The city surface and its underside are separate meshes above the continuous plain.
    function islandChunk(x0,z0,x1,z1,step){
      const nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step);
      const top=[],bottom=[],uv=[],colors=[],topIndices=[],bottomIndices=[],wall=[],wallUV=[],wallColor=[],wallIndices=[],wallNormals=[];
      const coords=(i,j)=>[mix(x0,x1,i/nx),mix(z0,z1,j/nz)];
      const mask=new Uint8Array((nx+2)*(nz+2));
      for(let j=-1;j<=nz;j++)for(let i=-1;i<=nx;i++)mask[(j+1)*(nx+2)+i+1]=L.island(...coords(i+.5,j+.5));
      const occupied=(i,j)=>mask[(j+1)*(nx+2)+i+1];
      const rimNormals=[];
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
        let [x,z]=coords(i,j);
        const a=occupied(i-1,j-1),b=occupied(i,j-1),c=occupied(i,j),d=occupied(i-1,j);
        const dx=a+d-b-c,dz=a+b-c-d,len=Math.hypot(dx,dz)||1,count=a+b+c+d;
        const relax=count===1?-.34:count===3?.34:0;
        x+=step*relax*dx/len;z+=step*relax*dz/len;
        rimNormals.push(dx/len,dz/len);
        top.push(x,L.surface(x,z),z);bottom.push(x,L.underside(x,z),z);
        uv.push(x/6,z/6);colors.push(.81,.76,.69);
      }
      const index=(i,j)=>j*(nx+1)+i;
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
        if(!occupied(i,j))continue;
        const corners=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],v=corners.map(([a,b])=>index(a,b));
        topIndices.push(v[0],v[3],v[1],v[1],v[3],v[2]);
        bottomIndices.push(v[0],v[1],v[3],v[1],v[2],v[3]);
        for(const [a,b,di,dj] of [[0,1,0,-1],[1,2,1,0],[2,3,0,1],[3,0,-1,0]]){
          if(occupied(i+di,j+dj))continue;
          const base=wall.length/3;
          for(let band=0;band<=9;band++){
            const t=band/9;
            for(const idx of [v[a],v[b]]){
              const x=top[idx*3],z=top[idx*3+2],nx=rimNormals[idx*2],nz=rimNormals[idx*2+1];
              const y=mix(top[idx*3+1],bottom[idx*3+1],t);
              const shelf=Math.sin(Math.PI*t)*(2.2*Math.sin(x*.076+z*.098+t*20)+2.7*Math.cos(t*13-x*.019)+2.6);
              wall.push(x+nx*shelf,y,z+nz*shelf);wallUV.push((x+z)/9,y/9);
              const tilt=(Math.PI*Math.cos(Math.PI*t)*(2.2*Math.sin(x*.076+z*.098+t*20)+2.7*Math.cos(t*13-x*.019)+2.6)
                +Math.sin(Math.PI*t)*(44*Math.cos(x*.076+z*.098+t*20)-35.1*Math.sin(t*13-x*.019)))/(top[idx*3+1]-bottom[idx*3+1]);
              const normalLength=Math.hypot(nx,tilt,nz)||1;
              wallNormals.push(nx/normalLength,tilt/normalLength,nz/normalLength);
              const strata=.78+.15*Math.sin(y*.61+x*.046+z*.028);
              wallColor.push(strata,strata*.82,strata*.73);
            }
            if(band){const q=base+(band-1)*2;wallIndices.push(q,q+1,q+2,q+1,q+3,q+2)}
          }
        }
      }
      if(topIndices.length){
        mesh(top,uv,colors,topIndices,islandGround).castShadow=true;mesh(bottom,uv,colors,bottomIndices,mat.cliff);
        if(wallIndices.length){
          const shell=mesh(wall,wallUV,wallColor,wallIndices,mat.cliff);
          shell.geometry.setAttribute('normal',new THREE.Float32BufferAttribute(wallNormals,3));
        }
      }
    }
    for(let z=-486;z<486;z+=162)for(let x=-648;x<648;x+=162){
      terrain(x,z,x+162,z+162,18);islandChunk(x,z,x+162,z+162,2.7);
    }
    const escapeExit={x:-121,y:8,z:289,viewZ:298};
    const escapePassage=[
      {z:285, left:-1.38,right:1.39,height:3.86},
      {z:289, left:-1.39,right:1.39,height:3.86},
      {z:292, left:-1.58,right:1.46,height:3.63},
      {z:293, left:-1.65,right:1.60,height:3.76}
    ];
    const escapeLedge=[
      {z:293,left:-1.65,right:1.60},
      {z:294.5,left:-4.42,right:3.42},
      {z:298,left:-5.18,right:4.84},
      {z:301,left:-4.54,right:4.64},
      {z:302,left:-3.06,right:2.68}
    ];
    const escapeFloorProfile=[...escapePassage,...escapeLedge.slice(1)];
    function escapeSection(profile,z){
      for(let i=1;i<profile.length;i++){
        const a=profile[i-1],b=profile[i];
        if(z<a.z||z>b.z)continue;
        const t=(z-a.z)/(b.z-a.z);
        return {left:mix(a.left,b.left,t),right:mix(a.right,b.right,t),height:mix(a.height,b.height,t)};
      }
      return null;
    }
    const escapeParapet=[];
    function buildEscapeLedge(){
      const {x,y}=escapeExit;
      const pos=[],uv=[],col=[],ind=[];
      function face(a,b,c,d,tint=.78){
        const n=pos.length/3;
        const normal=V(...b).sub(V(...a)).cross(V(...d).sub(V(...a)));
        for(const point of [a,b,c,d]){
          const [px,py,pz]=point;
          pos.push(x+px,y+py,pz);
          if(Math.abs(normal.y)>Math.max(Math.abs(normal.x),Math.abs(normal.z)))uv.push(px*.55,pz*.48);
          else uv.push((px+pz*.73)*.55,py*.55);
          const shade=tint+.045*Math.sin(px*2.7+py*1.6+pz*.96);
          col.push(shade,shade*.89,shade*.83);
        }
        ind.push(n,n+1,n+2,n,n+2,n+3);
      }
      for(let i=1;i<escapeFloorProfile.length;i++){
        const a=escapeFloorProfile[i-1],b=escapeFloorProfile[i];
        face([a.left,0,a.z],[b.left,0,b.z],[b.right,0,b.z],[a.right,0,a.z],.84);
        for(const side of ['left','right']){
          const s=side==='left'?-1:1;
          const edge=p=>[p[side],0,p.z];
          const shoulder=p=>[p[side]+s*.55,-1.65-.32*Math.sin(p.z),p.z-.37];
          const foot=p=>[p[side]*.69,-5.9-.31*(p.z-285),285+(p.z-285)*.67];
          face(edge(a),edge(b),shoulder(b),shoulder(a),.72);
          face(shoulder(a),shoulder(b),foot(b),foot(a),.65);
        }
      }
      const end=escapeFloorProfile.at(-1);
      face([end.left,0,end.z],[end.right,0,end.z],[end.right+.55,-1.55,end.z-.37],[end.left-.55,-1.55,end.z-.37]);
      face([end.left-.55,-1.55,end.z-.37],[end.right+.55,-1.55,end.z-.37],[1.85,-11.17,296.39],[-2.11,-11.17,296.39],.65);
      const mouthProfile=p=>[
        [p.left,0,p.z],[p.left,.98,p.z],[p.left+.10,2.40,p.z],[p.left+.45,p.height-.38,p.z],
        [-.20,p.height,p.z+.07],[.73,p.height-.20,p.z-.12],[p.right-.18,2.64,p.z],
        [p.right,.96,p.z],[p.right,0,p.z]
      ];
      for(let i=1;i<escapePassage.length;i++){
        const a=mouthProfile(escapePassage[i-1]),b=mouthProfile(escapePassage[i]);
        for(let j=1;j<a.length;j++)face(a[j-1],a[j],b[j],b[j-1],.66+.026*j);
      }
      const mouth=mouthProfile(escapePassage.at(-1));
      const faceRim=[[-3.7,-.18,292.34],[-3.86,1.02,292.72],[-4.15,2.83,292.17],[-3.16,4.83,291.88],
        [-.80,6.04,292.05],[1.79,5.43,291.99],[3.88,3.67,292.61],[3.41,1.18,292.62],[3.76,-.23,292.25]];
      const cliffRim=[[-6.5,-2,282.8],[-6.4,1.72,282],[-7.3,5.3,281.9],[-4.9,7.08,281.5],
        [-1.8,9.65,281],[2.25,8.95,281.8],[5.2,5.21,282.5],[6.7,1.27,283.3],[6.12,-1.3,282.7]];
      for(let i=1;i<mouth.length;i++){
        face(mouth[i-1],faceRim[i-1],faceRim[i],mouth[i],.76);
        face(faceRim[i-1],cliffRim[i-1],cliffRim[i],faceRim[i],.72);
      }
      face([-1.42,0,285.01],[1.42,0,285.01],[1.42,4,285.01],[-1.42,4,285.01],.42);
      for(const side of ['left','right']){
        const s=side==='left'?1:-1;
        for(let i=1;i<escapeLedge.length;i++){
          const a=escapeLedge[i-1],b=escapeLedge[i];
          escapeParapet.push({a:[a[side]+(i===1?0:s*.24),a.z],b:[b[side]+s*.24,b.z],height:1.16});
        }
      }
      const parapetFront=end.z-.18;
      escapeParapet.push(
        {a:[end.left+.24,parapetFront],b:[-1.34,parapetFront],height:1.16},
        {a:[-1.34,parapetFront],b:[1.34,parapetFront],height:.58},
        {a:[1.34,parapetFront],b:[end.right-.24,parapetFront],height:1.16}
      );
      for(const {a,b,height} of escapeParapet){
        const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        const stones=Math.ceil(length/.89),angle=Math.atan2(-dz,dx);
        for(let i=0;i<stones;i++){
          const t=(i+.5)/stones,h=height+.10*Math.sin((a[0]+i)*5.2+a[1]);
          const px=x+mix(a[0],b[0],t),pz=mix(a[1],b[1],t);
          box('houseSoot',px,y+h/2,pz,length/stones+.08,h,.5,angle,0xe0cbb9);
          box('footing',px,y+h-.07,pz,length/stones+.13,.19,.59,angle,0xba9d8b);
        }
      }
      const caveRock=mat.cliff.clone();caveRock.side=THREE.DoubleSide; caveRock.normalScale.multiplyScalar(.75);
      const rock=mesh(pos,uv,col,ind,caveRock);rock.castShadow=true;
    }
    buildEscapeLedge();
    // Rock shelves are seated against the perimeter and each bank of the rift.
    const cragRandom=seeded(92177),cragBetween=(a,b)=>mix(a,b,cragRandom());
    for(const [line,rift] of [[[...L.outline,L.outline[0]],false],[L.gorge,true]])for(let j=1;j<line.length;j++){
      const a=line[j-1],b=line[j],length=L.dist(...a,...b),n=Math.max(1,Math.ceil(length/11));
      const nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
      for(let i=0;i<n;i++)for(const side of rift?[-1,1]:[0]){
        const t=(i+.5)/n,cx=mix(a[0],b[0],t),cz=mix(a[1],b[1],t);
        const offset=rift?side*(L.riftWidth(cz)-2):0,x=cx+nx*offset,z=cz+nz*offset;
        for(const y of [-15,-37,-54]){
          const r=cragBetween(4,8),cx=x+cragBetween(-1,1),cy=y+cragBetween(-3,3),cz=z+cragBetween(-1,1);
          const sy=cragBetween(3,7),angle=cragBetween(0,TAU),rx=cragBetween(-.3,.3),rz=cragBetween(-.3,.3);
          inst('rock','crag',cx,cy,cz,r,sy,r*.8,angle,0xd0bab0,rx,rz);
          const matrix=new THREE.Matrix4().compose(V(cx,cy,cz),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,angle,rz,'YXZ')),V(r,sy,r*.8));
          const attr=shapes.rock.attributes.position,triangles=[];let minY=Infinity,maxY=-Infinity;
          for(let k=0;k<attr.count;k+=3){
            const tri=[];for(let n=0;n<3;n++){
              const p=V(attr.getX(k+n),attr.getY(k+n),attr.getZ(k+n)).applyMatrix4(matrix);
              tri.push([p.x,p.y,p.z]);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
            }
            triangles.push(tri);
          }
          collider({x:cx,z:cz,y:minY,w:2*(r+sy*.35),d:2*(r+sy*.35),h:maxY-minY,angle:0,triangles});
        }
      }
    }
    const xEdges=[-1944,-1620,-1296,-972,-648,-324,0,324,648,972,1296,1620,1944];
    const zEdges=[-1782,-1458,-1134,-810,-486,-162,162,486,810,1134,1458,1782];
    for(let j=0;j<zEdges.length-1;j++)for(let i=0;i<xEdges.length-1;i++){
      const x=xEdges[i],z=zEdges[j];
      if(x>=-648&&x<648&&z>=-486&&z<486)continue;
      terrain(x,z,xEdges[i+1],zEdges[j+1],18);
    }
    function subdiv(path,step=2.8){
      const out=[path[0]];
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],n=Math.ceil(L.dist(...a,...b)/step);
        for(let j=1;j<=n;j++)out.push([mix(a[0],b[0],j/n),mix(a[1],b[1],j/n)]);
      }
      return out;
    }
    function ribbon(path,w,height,m){
      const pos=[],uv=[],col=[],ind=[];
      for(let i=0;i<path.length;i++){
        const [x,z]=path[i],a=path[Math.max(i-1,0)],b=path[Math.min(i+1,path.length-1)];
        const n=Math.max(.01,L.dist(...a,...b));
        const dx=(b[1]-a[1])/n,dz=-(b[0]-a[0])/n;
        for(const k of [-1,0,1]){
          const px=x+dx*w/2*k,pz=z+dz*w/2*k;
          pos.push(px,height(px,pz,i),pz);uv.push(px/1.8,pz/1.8);
          const c=.74+.24*Math.sin(x*.055+z*.028)**2;col.push(c,c*.95,c*.88);
        }
        if(i){
          const q=i*3,p=q-3;
          ind.push(p,q,p+1,p+1,q,q+1,p+1,q+1,p+2,p+2,q+1,q+2);
        }
      }
      if(ind.length)mesh(pos,uv,col,ind,m);
    }
    // Broken setts at the dock subsidence and bridge approaches.
    const damage=seeded(19822),seams=[],seamIndices=[];
    for(const [cx,cz,angle,length] of [[230,43,.68,17],[315,242,-.36,24],[46,81,.88,16],
      [-79,64,.30,10],[270,142,-.31,9],[-307,246,-.92,11]]){
      function fissure(x,z,heading,reach,width,branch){
        let previous=null;
        for(let i=0;i<=reach;i++){
          const a=heading+Math.sin(i*.62)*.38+(damage()-.5)*.83;
          const spread=(.12+.88*Math.sin(Math.PI*i/reach))*width*(.74+.52*damage());
          const nx=-Math.sin(a),nz=Math.cos(a),idx=seams.length/3;
          for(const k of [-1,1])seams.push(x+k*nx*spread,L.surface(x,z)+.132,z+k*nz*spread);
          if(previous!==null)seamIndices.push(previous,idx,previous+1,previous+1,idx,idx+1);
          if(branch&&i===Math.floor(reach*.54))fissure(x,z,heading+.81,Math.ceil(reach*.41),width*.48,false);
          if(branch&&i%3===1){
            const side=damage()<.5?1:-1,px=x+nx*(spread+.16)*side,pz=z+nz*(spread+.16)*side;
            inst('box','stone',px,L.surface(px,pz)+.155,pz,.27+damage()*.22,.18,.33+damage()*.31,a,0x978575,(damage()-.5)*.43,(damage()-.5)*.37);
          }
          previous=idx;x+=Math.cos(a)*.96;z+=Math.sin(a)*.96;
        }
      }
      fissure(cx-length*.46*Math.cos(angle),cz-length*.46*Math.sin(angle),angle,length,.18,true);
    }
    const seamMesh=new THREE.BufferGeometry();
    seamMesh.setAttribute('position',new THREE.Float32BufferAttribute(seams,3));seamMesh.setIndex(seamIndices);
    scene.add(new THREE.Mesh(seamMesh,new THREE.MeshBasicMaterial({color:0x282224,side:THREE.DoubleSide})));

    const water=env.liquid(false);
    ribbon(subdiv(L.river,8),386,()=>-152.4,water);
    // Clip each wet triangle against its bank on the same lattice as the city terrain.
    // Keeping the intersection vertices makes a continuous shore at encounter-map scale.
    function lavaSurface(bed,speed){
      const vertices=[],step=2.7;
      const cells=new Set(),samples=new Map();
      const key=(i,j)=>(i+300)*600+j+300;
      for(let n=1;n<bed.path.length;n++){
        const [ax,az]=bed.path[n-1],[bx,bz]=bed.path[n];
        for(let i=Math.floor((Math.min(ax,bx)-bed.pad)/step);i<=Math.ceil((Math.max(ax,bx)+bed.pad)/step);i++)
          for(let j=Math.floor((Math.min(az,bz)-bed.pad)/step);j<=Math.ceil((Math.max(az,bz)+bed.pad)/step);j++)cells.add(key(i,j));
      }
      function sample(i,j){
        const id=key(i,j);
        if(samples.has(id))return samples.get(id);
        const x=i*step,z=j*step,d=L.pathDistance(x,z,bed.path),y=bed.level(x,z);
        const clearance=d>=bed.pad?bed.pad-d:Math.min(bed.margin(x,z,d),y-L.terrain(x,z));
        const p={x,y,z,clearance};samples.set(id,p);return p;
      }
      function triangle(a,b,c){
        if(Math.max(a.clearance,b.clearance,c.clearance)<=0)return;
        const polygon=[];
        for(const [from,to] of [[a,b],[b,c],[c,a]]){
          if(from.clearance>0)polygon.push(from);
          if((from.clearance>0)!==(to.clearance>0)){
            const t=from.clearance/(from.clearance-to.clearance);
            polygon.push({x:mix(from.x,to.x,t),y:mix(from.y,to.y,t),z:mix(from.z,to.z,t)});
          }
        }
        for(let k=1;k<polygon.length-1;k++)for(const p of [polygon[0],polygon[k],polygon[k+1]])vertices.push(p.x,p.y+.018,p.z);
      }
      for(const id of cells){
        const i=Math.floor(id/600)-300,j=id%600-300;
        const a=sample(i,j),b=sample(i,j+1),c=sample(i+1,j),d=sample(i+1,j+1);
        triangle(a,b,c);triangle(b,d,c);
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      scene.add(new THREE.Mesh(g,env.liquid(true,speed)));
    }
    L.lavaBeds.forEach((bed,i)=>lavaSurface(bed,[.54,-1,1.4][i]));
    const canalWalk=subdiv(L.canal,1.5),fallsMaterial=env.liquid(true,1,true);
    for(let i=1;i<canalWalk.length;i++){
      const a=canalWalk[i-1],b=canalWalk[i],fromLand=L.island(...a);
      if(fromLand===L.island(...b))continue;
      const span=L.dist(...a,...b),sign=fromLand?1:-1;
      const dx=(b[0]-a[0])/span*sign,dz=(b[1]-a[1])/span*sign,verts=[],ind=[];
      // Find the lip for each filament individually so the cascade follows the broken edge.
      for(let lane=0;lane<=22;lane++){
        const offset=lane-11,bx=b[0]+dz*offset,bz=b[1]-dx*offset;
        let lo=-26,hi=26;
        for(let k=0;k<13;k++){
          const t=(hi+lo)*.5;
          if(L.island(bx+dx*t,bz+dz*t))lo=t;else hi=t;
        }
        const lx=bx+dx*lo,lz=bz+dz*lo;
        const endX=lx+dx*11,endZ=lz+dz*11;
        const base=L.fluid(endX,endZ,-100)?.y??L.avernusFloor(endX,endZ);
        for(let j=0;j<=18;j++){
          const t=j/18,forward=12*t-1,drift=Math.sin(t*5+lane*.42)*t*.48;
          verts.push(lx+dx*forward+dz*drift,mix(4.85,base,t*t),lz+dz*forward-dx*drift);
          if(j<18&&lane<22){const k=lane*19+j;ind.push(k,k+19,k+1,k+1,k+19,k+20)}
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(ind);
      scene.add(new THREE.Mesh(geometry,fallsMaterial));
    }
    const pool=new THREE.Mesh(new THREE.CircleGeometry(10.96,40),water);
    pool.rotation.x=-Math.PI/2;pool.position.set(L.pond.x,L.pond.level,L.pond.z);scene.add(pool);


    function rail(x1,z1,x2,z2,y1,y2,w=.32,h=.84,m='stone'){
      const n=Math.max(1,Math.ceil(L.dist(x1,z1,x2,z2)/2.3));
      beam(m,[x1,y1+h,z1],[x2,y2+h,z2],w,w);
      for(let i=0;i<=n;i++){
        const t=i/n;box(m,mix(x1,x2,t),mix(y1,y2,t)+h/2,mix(z1,z2,t),w,h,w);
      }
    }
    for(const b of L.bridges){
      const {x1,z1,x2,z2,y1,y2,w}=b;
      const len=L.dist(x1,z1,x2,z2),nx=(z2-z1)/len,nz=-(x2-x1)/len,path=subdiv([[x1,z1],[x2,z2]],2);
      ribbon(path,w,(_x,_z,i)=>mix(y1,y2,i/(path.length-1)),mat.street);
      for(const side of [-1,1]){
        const edge=w*.482*side;
        rail(x1+nx*edge,z1+nz*edge,x2+nx*edge,z2+nz*edge,y1,y2);
        beam('stone',[x1+nx*edge,y1-.44,z1+nz*edge],[x2+nx*edge,y2-.44,z2+nz*edge],1.08,.83);
        for(let section=0;section<4;section++){
          let prev;
          for(let i=0;i<=11;i++){
            const t=(section+i/11)/4,depth=9.4-8.2*Math.sin(Math.PI*i/11);
            const point=[mix(x1,x2,t)+nx*edge,mix(y1,y2,t)-depth,mix(z1,z2,t)+nz*edge];
            if(prev)beam('chalk',prev,point,.90,.86);
            prev=point;
          }
        }
      }
      for(let i=1;i<4;i++){
        const t=i/4;box('soot',mix(x1,x2,t),mix(y1,y2,t)-9,mix(z1,z2,t),3.5,17,w*.76,-Math.atan2(z2-z1,x2-x1));
      }
    }
    function tower(x,z,y,r,h,roof=false,broken=false){
      const hall=x>-140&&x<-60&&z>210&&z<266;
      inst('towerShaft',broken?'houseSoot':hall?'houseChalk':'houseStone',x,y+h*.49,z,r,h,r,0,broken?0xa58b84:0xe3d4ba);
      inst('cyl','chalk',x,y+h*.82,z,r*1.075,.45,r*1.075);
      inst('cyl','stone',x,y+h,z,r*1.08,.47,r*1.08);
      for(let i=0;i<12;i++){
        if(broken&&rng()<.42)continue;
        const a=TAU*i/12;box('stone',x+Math.sin(a)*r*.98,y+h+.43,z+Math.cos(a)*r*.98,.83,.86,.49,a);
      }
      if(roof)inst('cone','slate',x,y+h+r*.65,z,r*.89,r*1.30,r*.89,0,0xc0c0c5);
      collider({x,z,y,w:r*1.58,d:r*1.58,h,angle:0});
    }
    function curtain(a,b,h=6,gap=false){
      const len=L.dist(...a,...b),n=Math.max(1,Math.ceil(len/7.8)),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(let i=0;i<n;i++){
        if(gap&&Math.abs(i+.5-n/2)<1.34)continue;
        const t=(i+.5)/n,x=mix(a[0],b[0],t),z=mix(a[1],b[1],t),y=L.terrain(x,z);
        if(y<-20)continue;
        const broken=rng()<.13,high=h*(broken?between(.21,.61):between(.94,1.04));
        box(broken?'soot':'stone',x,y+high/2,z,len/n+.21,high,2.49,angle,0xd2c2aa);
        box('chalk',x,y+high+.039,z,len/n+.23,.28,2.65,angle,0xbfa88e);
        collider({x,z,y,w:len/n+.24,d:2.55,h:high,angle});
        if(!broken)for(let j=-1;j<=1;j++)box('stone',x+Math.cos(angle)*j*1.8,y+high+.52,z-Math.sin(angle)*j*1.8,1,.78,2.2,angle);
      }
    }
    const outer=L.wallLine.map(([x,z])=>[x*.947,z*.926]);
    for(let i=1;i<outer.length;i++){
      curtain(outer[i-1],outer[i],6.9,i===5||i===10);
      const [x,z]=outer[i-1];
      if(L.terrain(x,z)>1&&L.pathDistance(x,z,L.gorge)>39)tower(x,z,L.terrain(x,z),4.64,9.16,i%4===0,i%5===0);
    }

    function home(id,x,z,w,d,h,a,style=0,burnt=false,interior=false){
      const o=house({id,x,z,w,d,h,angle:a,style,burnt,ward:style===5?'high':'east'},interior,interior);
      curated[id]=o;return o;
    }
    const vesh=home('vesh',216,50,9.6,10.1,6.6,Math.PI-.39,2,false,true);
    const [lineX,lineZ]=local(vesh,6.5,1.3);
    for(const z of [-2.8,2.8])box('timber',lineX,vesh.y+1.48,lineZ+z,.13,2.95,.13);
    beam('timber',[lineX,vesh.y+2.83,lineZ-2.8],[lineX,vesh.y+2.83,lineZ+2.8],.055);
    for(let i=0;i<5;i++)box('cloth',lineX,vesh.y+2.35,lineZ-2+i*.94,.037,.86,.73,.04,0xd6c0a4);
    const sail=home('sail-house',228,60,12.8,11.3,7.9,Math.PI-.40,3);
    const net=home('net-shop',246,32,14.6,11.1,9.2,-.43,1,false,'furnished');
    home('oil-shop',228,22,11.5,11.2,7.37,-.43,2);
    home('tool-shop',199,14,12.6,10.7,9.4,-.39,5);
    home('long-house',247,70,14.9,12.6,8.1,Math.PI-.44,0);
    for(const [o,tint] of [[net,0x8d6452],[sail,0xa68c72]]){
      const dz=o.d/2+1.2;
      for(const x of [-o.w*.31,o.w*.31])lb(o,'door',x,1.57,dz+.66,.13,3.14,.13);
      lb(o,'timber',0,3.63,o.d/2+.18,o.w*.71,.13,.14);
      for(let i=0;i<9;i++){
        const [x,z]=local(o,(i-4)*o.w*.073,dz);
        inst('box','cloth',x,o.y+3.39,z,o.w*.074,.077,2.13,o.angle,i%3===0?0x896253:tint,.22);
      }
      const [x,z]=local(o,o.w/2-.65,dz+.12);
      heat.push({x,y:o.y+2.58,z,type:'lamp'});
      lb(o,'brass',o.w/2-.65,2.66,dz+.12,.31,.33,.27);
      lb(o,'lit',o.w/2-.65,2.64,dz+.27,.22,.23,.055);
    }
    home('bell-house',-328,67,11.9,11.6,8.9,-1.56,1,false,'furnished');
    const tavern=home('antlers',68,-123,19.2,12.8,6.75,.12,3);
    const tavernFlank={...tavern,angle:tavern.angle+Math.PI/2,w:tavern.d,d:tavern.w};
    const tavernGlazing={stone:'frame',frame:'charFrame',tint:0xa68b79,shutter:true};
    for(const [wall,side,low,high] of [
      [tavern,1,[-4.3,4.3],[-6.97,-2.32,2.32]],
      [tavern,-1,[-6.7,6.32],[-6.97,-2.32,2.32,6.2]],
      [tavernFlank,-1,[-10.15],[-10.13,-2.36]],
      [tavernFlank,1,[-10,-3.79],[-10,-3.86]]
    ]){
      const offset=wall===tavern?0:tavern.d/2-.48;
      for(const x of low)windowFrame(wall,side,x+offset,1.72,1.25,1.28,tavernGlazing);
      for(const x of high)windowFrame(wall,side,x+offset,5.02,1.25,1.28,tavernGlazing);
    }
    for(const side of [-1,1])windowFrame(tavernFlank,side,-6.06+tavern.d/2-.48,7.725,1.48,1.29,tavernGlazing);
    const sign=(x,y,z)=>{const [a,b]=local(tavern,x,z);return [a,tavern.y+y,b]};
    lb(tavern,'oak',0,2.96,tavern.d/2+.24,3.25,.61,.15);
    const lettering=document.createElement('canvas');lettering.width=768;lettering.height=128;
    const signPaint=lettering.getContext('2d');
    signPaint.fillStyle='#f1d89e';signPaint.textAlign='center';signPaint.textBaseline='middle';
    signPaint.font='bold 55px Georgia, serif';signPaint.fillText('A Pair of Black Antlers',384,64,710);
    signPaint.strokeStyle='#ba9c63';signPaint.lineWidth=3;signPaint.strokeRect(9,9,750,110);
    signPaint.globalCompositeOperation='destination-out';
    for(let i=0;i<310;i++){
      const x=(i*173)%768,y=(i*47)%128;
      signPaint.globalAlpha=.18+(i%7)*.075;
      signPaint.fillRect(x,y,1+(i%5),1+(i%3)*.55);
    }
    const signInk=new THREE.CanvasTexture(lettering);signInk.colorSpace=THREE.SRGBColorSpace;
    const signFace=new THREE.Mesh(new THREE.PlaneGeometry(3.11,.51),new THREE.MeshStandardMaterial({map:signInk,transparent:true,depthWrite:false,roughness:.94}));
    signFace.position.set(...sign(0,2.96,tavern.d/2+.32));signFace.rotation.y=tavern.angle;scene.add(signFace);
    for(const side of [-1,1]){
      const points=[[.12,3.07],[.61,3.55],[1.13,3.64],[1.58,4.02]];
      for(let i=1;i<points.length;i++){
        const [ax,ay]=points[i-1],[bx,by]=points[i];
        beam('trim',sign(ax*side,ay,6.81),sign(bx*side,by,6.81),.105,.102);
        if(i>1)beam('trim',sign(ax*side,ay,6.81),sign((ax+.105)*side,ay+.55,6.81),.081,.078);
      }
    }
    const orderPennant=document.createElement('canvas');
    orderPennant.width=192;orderPennant.height=320;
    const herald=orderPennant.getContext('2d');
    herald.beginPath();
    [[10,8],[182,8],[184,272],[156,266],[141,296],[113,285],[95,314],[77,286],[47,298],[35,275],[9,281]]
      .forEach(([x,y],i)=>i?herald.lineTo(x,y):herald.moveTo(x,y));
    herald.closePath();herald.clip();herald.fillStyle='#584c4c';herald.fillRect(0,0,192,320);
    for(let x=0;x<192;x++){
      const wash=.075+.07*Math.sin(x*.102)+.06*Math.cos(x*.23);
      herald.fillStyle=wash<0?`rgba(199,156,116,${-wash})`:`rgba(28,16,16,${wash})`;
      herald.fillRect(x,0,1,320);
    }
    herald.strokeStyle='#9b7d66';herald.lineWidth=3;herald.strokeRect(18,17,156,279);
    herald.fillStyle='#c3b499';herald.beginPath();
    [[66,209],[66,172],[48,149],[45,133],[52,125],[65,128],[76,143],[76,101],[85,95],[94,101],
      [94,85],[103,80],[112,86],[114,96],[122,92],[130,98],[130,113],[140,110],[147,118],[146,148],
      [131,173],[131,209]].forEach(([x,y],i)=>i?herald.lineTo(x,y):herald.moveTo(x,y));
    herald.closePath();herald.fill();
    herald.strokeStyle='#7a6a62';herald.lineWidth=4;
    for(const x of [92,110,129]){
      herald.beginPath();herald.moveTo(x,117);herald.lineTo(x-2,150);herald.stroke();
    }
    herald.beginPath();herald.moveTo(68,183);herald.lineTo(131,183);herald.stroke();
    const pennantInk=new THREE.CanvasTexture(orderPennant);pennantInk.colorSpace=THREE.SRGBColorSpace;
    const pennant=new THREE.Mesh(new THREE.PlaneGeometry(.76,1.28),
      new THREE.MeshStandardMaterial({map:pennantInk,alphaTest:.5,roughness:.99}));
    const pennantX=5.46,pennantZ=tavern.d/2+.11;
    pennant.position.set(...sign(pennantX,4.1,pennantZ));pennant.rotation.y=tavern.angle;scene.add(pennant);
    lb(tavern,'metal',pennantX,4.74,pennantZ,.91,.056,.09);
    for(const side of [-1,1]){
      const x=side*2.19,z=tavern.d/2+.13;
      lb(tavern,'metal',x,2.15,z+.125,.105,.44,.23);
      lb(tavern,'metal',x,2.36,z+.21,.26,.082,.25);
      lb(tavern,'glass',x,2.11,z+.22,.17,.32,.16);
      lb(tavern,'metal',x,1.91,z+.21,.24,.093,.24);
      for(const rail of [-1,1])lb(tavern,'metal',x+rail*.09,2.11,z+.29,.032,.37,.032);
    }
    const apronColors=[0x8d8073,0xb19e89,0x9d8b76,0x81756e,0xa59b88];
    for(let row=0;row<4;row++)for(let column=-15;column<=15;column++){
      const across=(column+(row%2)*.5)*.51,along=tavern.d/2+.28+row*.36;
      const [x,z]=local(tavern,across,along),shade=apronColors[(column+15+row*3)%apronColors.length];
      inst('detail','chapelAshlar',x,L.surface(x,z)+.018,z,.477,.075,.332,tavern.angle,shade);
    }
    for(let i=-3;i<=3;i++)lb(tavern,'metal',-5.18+i*.064,.78,tavern.d/2+.085,.047,.32-Math.abs(i)*.043,.095);
    lb(tavern,'metal',-5.18,.92,tavern.d/2+.136,.38,.051,.045);
    lb(tavern,'metal',-5.18,.66,tavern.d/2+.136,.38,.051,.045);
    home('dock-house',392,190,18.4,13.2,9.1,-1.54,5);
    home('coster',201,246,23.6,15.9,10.3,.06);
    home('coster-wing',169,253,18.4,13.3,7.4,.13,1);
    home('warehouse-east',331,245,24.2,11.5,7.9,.12,0,true);
    home('warehouse-west',288,251,22.4,11.5,7.4,.15,1);
    home('orrel-row',-109,85,10,11,10.5,1.59,5);
    home('orrel-house',-114,70,9.2,10,12.1,1.58,0,false,'furnished');
    home('market-bank',309,143,18.2,16,10.1,-1.58,5);
    home('market-counting',263,174,23.4,14.6,10,.01,5);
    home('market-bread',251,119,16.6,12.1,7.4,.14);
    home('market-tools',281,114,14.6,11.3,8.6,.04,3);
    home('shieldhall',-237,-149,38,26,15.2,.15,5);
    for(const x of [-259,-215])tower(x,-166,L.surface(x,-166),5.7,15.4,true);
    home('twin-suns',367,-211,25.7,12.6,13.2,.29,0,true);
    for(const x of [355,378])tower(x,-217,L.surface(x,-217),5.8,x===355?15:8,false,x!==355);
    for(const x of [-354,-333])tower(x,-247,L.terrain(x,-247),4.9,10);
    beam('stone',[-353,L.surface(-344,-247)+6.5,-247],[-333,L.surface(-344,-247)+6.5,-247],4.4,3.9);

    const cemeteryGate={x:-390,z:158,y:L.islandSurface(-390,158),outX:1,outZ:0};
    const cemeteryRandom=seeded(269403);
    const cemeteryRange=(a,b)=>mix(a,b,cemeteryRandom());
    const cemeteryY=(x,z)=>L.islandSurface(x,z);
    const chapelY=cemeteryGate.y;
    function cemeteryMasonry(x,y,z,w,h,d){
      const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;
      for(let i=0;i<uv.count;i++){
        const normalX=n.getX(i),normalY=n.getY(i),normalZ=n.getZ(i),atX=Math.abs(normalX)>.5,atY=Math.abs(normalY)>.5;
        const horizontal=atX?d:w,vertical=atY?d:h;
        const u0=atX?-normalX*z:(normalZ||1)*x;
        const v0=atY?-normalY*z:y;
        uv.setXY(i,(u0+(uv.getX(i)-.5)*horizontal)/2.45,(v0+(uv.getY(i)-.5)*vertical)/2.18);
      }
      const wall=new THREE.Mesh(g,mat.chapelAshlar);
      wall.position.set(x,y,z);wall.castShadow=wall.receiveShadow=true;
      scene.add(wall);
    }
    function cemeteryRoof(x,y,z,w,d,rise,axis){
      const length=axis==='z'?d:w,span=axis==='z'?w:d;
      const point=(along,high,across)=>axis==='z'?[x+across,y+high,z+along]:[x+along,y+high,z+across];
      const eave=span/2+.34,end=length/2+.33;
      for(const side of [-1,1]){
        const outerA=point(-end,0,side*eave),outerB=point(end,0,side*eave);
        const ridgeA=point(-end,rise,0),ridgeB=point(end,rise,0);
        const reversed=(axis==='z')===(side===1);
        const width=length/2.4,height=Math.hypot(eave,rise)/2.3;
        const positions=[...outerA,...outerB,...ridgeB,...ridgeA];
        const roof=new THREE.Mesh(geo(positions,[0,0,width,0,width,height,0,height],null,
          reversed?[0,2,1,0,3,2]:[0,1,2,0,2,3]),mat.chapelSlate);
        roof.castShadow=roof.receiveShadow=true;
        scene.add(roof);
        beam('charWood',outerA,outerB,.17,.23);
        beam('brass',outerA,outerB,.085,.083,0x665c4f);
        for(const cap of [-1,1])beam('slate',point(cap*end,0,side*eave),point(cap*end,rise,0),.15,.18,0x8f8790);
      }
      beam('slate',point(-end,rise-.005,0),point(end,rise-.005,0),.22,.22,0x8c838d);
      for(const side of [-1,1]){
        const plane=side*length/2,half=span/2;
        const gable=new THREE.Mesh(geo([...point(plane,-.18,-half),...point(plane,-.18,half),...point(plane,rise-.018,0)],
          [0,0,span/2.45,0,span/4.9,rise/2.18],null,
          (axis==='z')===(side===1)?[0,1,2]:[0,2,1]),mat.chapelAshlar);
        gable.castShadow=gable.receiveShadow=true;
        scene.add(gable);
      }
    }
    function cemeterySolid(material,x,y,z,w,h,d,angle=0,tint=0xffffff){
      if(material==='chapelAshlar')cemeteryMasonry(x,y+h/2,z,w,h,d);
      else box(material,x,y+h/2,z,w,h,d,angle,tint);
      collider({x,y,z,w,h,d,angle});
    }
    function cemeteryWalk(x0,x1,z0,z1,shade,lift=.053,pavingMaterial=mat.street){
      const pos=[],uv=[],colors=[],indices=[];
      const columns=Math.ceil((x1-x0)/1.25),rows=Math.ceil((z1-z0)/1.25);
      const tone=new THREE.Color(shade);
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
        const x=mix(x0,x1,col/columns),z=mix(z0,z1,row/rows);
        pos.push(x,cemeteryY(x,z)+lift,z);
        uv.push(x*.44,z*.44);
        const wear=cemeteryRange(.66,1);
        colors.push(tone.r*wear,tone.g*wear,tone.b*wear);
        if(row<rows&&col<columns){
          const i=row*(columns+1)+col,j=i+columns+1;
          indices.push(i,j,i+1,i+1,j,j+1);
        }
      }
      const paving=new THREE.Mesh(geo(pos,uv,colors,indices),pavingMaterial);
      paving.receiveShadow=true;
      scene.add(paving);
    }
    cemeteryWalk(-384,-335,155.8,160.2,0xc5b9a8,.067);
    cemeteryWalk(-390,-384,148.8,184.2,0xfff3df,.062,mat.chapelMarble);
    cemeteryWalk(-368,-365.5,125,203,0x948677);
    cemeteryWalk(-435,-365.5,135,137.5,0x948677);
    cemeteryWalk(-435,-365.5,194,196.5,0x948677);
    cemeteryWalk(-431,-428.6,136,196.5,0x948677);
    cemeteryWalk(-409.8,-405.8,181.7,185.7,0x948677);
    cemeteryWalk(-403.7,-390,147.4,185.25,0x9b8a80);

    function cemeteryFence(ax,az,bx,bz,damage=0){
      const length=Math.hypot(bx-ax,bz-az),panels=Math.ceil(length/4.5),span=length/panels;
      const along=[(bx-ax)/length,(bz-az)/length],angle=-Math.atan2(along[1],along[0]);
      const point=(distance,height)=> {
        const x=ax+distance*along[0],z=az+distance*along[1];
        return [x,cemeteryY(x,z)+height,z];
      };
      for(let i=0;i<=panels;i++){
        const [x,y,z]=point(i*span,0);
        cemeterySolid('soot',x,y-.14,z,.57,.52,.57,angle);
        const post=i%4===3?2.31:2.91;
        box('brass',x,y+post/2,z,.19,post,.19,angle,0x948b72);
        inst('cone','brass',x,y+post+.13,z,.17,.32,.17,angle);
        if(i===panels)break;
        if(cemeteryRandom()<damage){
          const [px,py,pz]=point(i*span+.66,.13);
          for(let b=0;b<5;b++)inst('box','brass',px+along[0]*b*.55,py+b*.026,pz+along[1]*b*.55,2.5,.11,.11,angle+1.19,0x847561,0,.03);
          continue;
        }
        for(const h of [.58,1.95,2.42])beam('brass',point(i*span,h),point((i+1)*span,h),.105,.10,0x9f9072);
        for(let b=1;b<=7;b++){
          const [px,py,pz]=point((i+b/8)*span,0);
          const top=cemeteryRange(2.48,2.74);
          inst('box','brass',px,py+top/2,pz,.073,top,.08,angle,0x9a9173,0,cemeteryRange(-.046,.046));
          inst('cone','brass',px,py+top+.075,pz,.104,.17,.104,angle);
        }
        const [px,py,pz]=point((i+.5)*span,0);
        collider({x:px,z:pz,y:py-.44,w:span,d:.17,h:3.20,angle});
      }
    }
    cemeteryFence(-350,120,-350,153.8,.14);
    cemeteryFence(-350,162.2,-350,208,.11);
    cemeteryFence(-439,120,-350,120,.28);
    cemeteryFence(-439,120,-439,208,.26);
    cemeteryFence(-439,208,-350,208,.37);
    for(const side of [-1,1]){
      const x=-350,z=158+side*4.21,y=cemeteryY(x,z);
      cemeterySolid('houseSoot',x,y-.35,z,1.08,4.07,1.1);
      box('chalk',x,y+3.61,z,1.35,.27,1.34);
      inst('cone','brass',x,y+4.03,z,.47,.71,.47,Math.PI*.25);
      const fallenX=x-3.6,fallenZ=z+side*.42,fallenY=cemeteryY(fallenX,fallenZ);
      for(let pin=0;pin<11;pin++)inst('box','brass',fallenX-pin*.18,fallenY+.23+pin*.014,fallenZ+side*pin*.16,.085,.11,2.85,-Math.PI/2+.66*side,0xa99973);
      for(const offset of [-1.2,0,1.2])inst('box','brass',fallenX-1+offset,fallenY+.31,fallenZ+side*.9,2.81,.12,.12,-Math.PI/2+.63*side,0x9a8369);
    }

    // All memorial profiles share their local ground line and face towards the grave.
    for(const style of ['round','shoulder','tablet']){
      const profile=new THREE.Shape();profile.moveTo(-.5,0);profile.lineTo(.5,0);
      if(style==='round'){
        profile.lineTo(.5,.65);profile.absellipse(0,.65,.5,.35,0,Math.PI,false,0);
      }else if(style==='shoulder'){
        profile.lineTo(.5,.73);profile.quadraticCurveTo(.31,.73,.29,.87);
        profile.quadraticCurveTo(0,1.12,-.29,.87);profile.quadraticCurveTo(-.31,.73,-.5,.73);
      }else{
        profile.lineTo(.5,.86);profile.lineTo(.33,1);profile.lineTo(-.33,1);profile.lineTo(-.5,.86);
      }
      profile.closePath();
      const cut=new THREE.ExtrudeGeometry(profile,{depth:.22,bevelEnabled:true,bevelSize:.016,bevelThickness:.014,bevelSegments:2,curveSegments:14});
      cut.translate(0,0,-.11);shapes['grave-'+style]=cut;
    }
    // A headstone is a single quarried slab. Lichen follows the stone grain.
    const slabCanvas=document.createElement('canvas');slabCanvas.width=slabCanvas.height=256;
    const slabCtx=slabCanvas.getContext('2d'),slabPixels=slabCtx.createImageData(256,256),grain=seeded(1652);
    for(let z=0;z<256;z++)for(let x=0;x<256;x++){
      const u=x*TAU/256,v=z*TAU/256,band=Math.sin(3*u+v+.7*Math.sin(2*v));
      const mottling=7*band+4*Math.cos(2*u-3*v)+3*Math.sin(6*u+4*v);
      const mineral=(grain()-.5)*20+3*Math.sin(24*u+7*v+2*band),lichen=Math.max(0,mottling-5)*1.8;
      const n=4*(256*z+x);
      slabPixels.data.set([155+mottling+mineral-lichen*.42,151+mottling+mineral,144+mottling+mineral-lichen,255],n);
    }
    slabCtx.putImageData(slabPixels,0,0);
    const slabMap=new THREE.CanvasTexture(slabCanvas);slabMap.colorSpace=THREE.SRGBColorSpace;
    slabMap.wrapS=slabMap.wrapT=THREE.RepeatWrapping;slabMap.anisotropy=4;
    mat.graveStone=new THREE.MeshStandardMaterial({map:slabMap,bumpMap:slabMap,bumpScale:.018,roughness:.91});
    mat.graveSoil=mat.earth.clone();mat.graveSoil.vertexColors=false;
    const memorials=[
      ['Mara Fen','Rope maker'],['Den & Orra Vale','Married forty years'],['Tessa Reed','Chionthar ferrywoman'],
      ['Perrin Holt','Bell founder'],['Ada Moss','Midwife'],['Eda & Linn','Sisters'],['Harl Pike','Stonecutter'],['Jory Wren','Apprentice cooper']
    ];
    const ledger=document.createElement('canvas');ledger.width=1024;ledger.height=512;
    const ink=ledger.getContext('2d'),patina=seeded(681);
    memorials.forEach(([name,trade],n)=>{
      const x=n%2*512,y=Math.floor(n/2)*128;
      ink.fillStyle='#696957';ink.fillRect(x,y,512,128);
      for(let i=0;i<2800;i++){
        ink.fillStyle=i%3?'#b6a38735':'#202a2438';ink.fillRect(x+patina()*511,y+patina()*127,1+patina()*4,1);
      }
      ink.strokeStyle='#baa581';ink.lineWidth=2;ink.strokeRect(x+8,y+7,496,114);
      ink.textAlign='center';ink.fillStyle='#eee0bf';ink.font='small-caps 42px Georgia';ink.fillText(name,x+256,y+59,464);
      ink.font='italic 27px Georgia';ink.fillText(trade,x+256,y+99,466);
      const plate=new THREE.PlaneGeometry(1,1),uv=plate.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,(x+1+uv.getX(i)*510)/1024,1-(y+1+(1-uv.getY(i))*126)/512);
      shapes['epitaph'+n]=plate;
    });
    const inscriptions=new THREE.CanvasTexture(ledger);inscriptions.colorSpace=THREE.SRGBColorSpace;
    inscriptions.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    mat.memorialPlate=new THREE.MeshStandardMaterial({name:'Grave inscription',map:inscriptions,roughness:.8,metalness:.14});
    let namedGraves=0;
    const tombSites=[[-424,143],[-360,143],[-424,201],[-360,200]];
    for(const side of [-1,1])for(let row=0;row<15;row++)for(let col=0;col<5;col++){
      const x=-394+side*(7.2+col*7.65)+cemeteryRange(-.55,.55);
      const z=123+row*5.85+cemeteryRange(-.45,.45);
      if(Math.abs(z-136.25)<2.6||Math.abs(z-195.25)<2.6||Math.abs(x+366.75)<2.6||
        (x>-385&&Math.abs(z-158)<4.1)||(x>-420&&x<-382&&z>145&&z<190)||
        Math.abs(x+429.8)<2.4||tombSites.some(([tx,tz])=>Math.abs(x-tx)<3.6&&Math.abs(z-tz)<4.6)||cemeteryRandom()<.18)continue;
      const y=cemeteryY(x,z),angle=cemeteryRange(-.27,.27);
      const slabTint=cemeteryRandom()<.25?0xe7e2d5:0xa29d94;
      const h=cemeteryRange(.53,1.39),w=cemeteryRange(.47,.9);
      const disrupted=cemeteryRandom()<.25;
      box(disrupted?'graveSoil':'graveStone',x,y+.015,z,w+1.04,.11,2.85,angle,disrupted?0x857164:0xb2aba0);
      if(disrupted){
        box('graveSoil',x,y+.070,z,w+.18,.025,1.8,angle,0x68564b);
        for(let j=0;j<4;j++){
          const sign=j%2===0?-1:1;
          inst('rock','rubble',x+sign*cemeteryRange(.58,1.12),y+.11,z+cemeteryRange(-1.25,1.28),.35,.18,.48,angle+cemeteryRandom());
        }
      }
      const mount={x,z,angle},[mx,mz]=local(mount,0,-1.05),my=cemeteryY(mx,mz);
      const marked=namedGraves<memorials.length&&side===1&&col>=2&&(row+col)%2===0&&!disrupted;
      const lean=disrupted?cemeteryRange(-.24,.24):cemeteryRange(-.045,.045);
      const headW=marked?1.05:w,headH=marked?1.18:h;
      inst('grave-'+['round','shoulder','tablet'][(row+col)%3],'graveStone',mx,my+.045,mz,headW,headH,1,angle,slabTint,lean);
      collider({x:mx,z:mz,y:my,w:headW+.04,h:headH,d:.30+headH*Math.abs(Math.sin(lean)),angle});
      if(marked){
        // Attach the plate using the same leaned coordinate frame as the stone.
        const away=headH*.49*Math.sin(lean)+.13*Math.cos(lean);
        inst('epitaph'+namedGraves,'memorialPlate',mx+Math.sin(angle)*away,
          my+.045+headH*.49*Math.cos(lean)-.13*Math.sin(lean),mz+Math.cos(angle)*away,
          .91,.228,1,angle,0xffffff,lean);
        if(namedGraves%2===0){
          // A handful of river pebbles laid at the foot of the inscription.
          for(let i=0;i<5;i++){
            const [px,pz]=local(mount,(i-2)*.093,-.75+.065*Math.sin(i*2.4));
            inst('orb','chalk',px,y+.096,pz,.061,.029,.048,i*.77,0xc7bca6);
          }
        }
        namedGraves++;
      }
      for(let j=0;j<7;j++){
        const gx=x+cemeteryRange(-1.25,1.25),gz=z+cemeteryRange(-1.9,1.9),height=cemeteryRange(.11,.39);
        const gy=cemeteryY(gx,gz);
        for(let k=0;k<3;k++){
          const turn=j*1.7+k*2.1,blade=height*(.46+.12*k);
          const lean=.42+.17*k,reach=blade*.5*Math.sin(lean);
          inst('grassBlade','charWood',gx+reach*Math.sin(turn),gy+blade*.44*Math.cos(lean),gz+reach*Math.cos(turn),
            .012,blade*.5,.008,turn,0xb4a08c,lean);
        }
      }
    }
    // Two old pollarded trees mark the corners of the burial walks.
    const branchRng=seeded(11509);
    function bough(start,end,r){
      const a=V(...start),b=V(...end),dir=b.clone().sub(a);
      batch('pole','charWood',a.lerp(b,.5),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dir.clone().normalize()),V(r,dir.length(),r),0xb79876);
    }
    for(const [x,z] of [[-435,124],[-354,204]]){
      const y=cemeteryY(x,z),knuckle=[x+.16,y+2.38,z-.11];
      bough([x,y-.11,z],knuckle,.34);collider({x,y,z,w:.66,h:2.42,d:.66,angle:0});
      for(let i=0;i<6;i++){
        const a=i*TAU/6+branchRng()*.35,r=.78+branchRng()*.55;
        const fork=[knuckle[0]+r*Math.cos(a),y+2.85+branchRng()*.75,knuckle[2]+r*Math.sin(a)];
        bough(knuckle,fork,.13);
        for(const turn of [-.43,.44]){
          const t=a+turn,tip=[fork[0]+Math.cos(t)*.83,fork[1]+.62+branchRng(),fork[2]+Math.sin(t)*.83];
          bough(fork,tip,.062);bough(tip,[tip[0]+.26*Math.cos(t+.6),tip[1]+.48,tip[2]+.37*Math.sin(t+.6)],.026);
        }
      }
    }
    const families=[
      {family:'Ayde',founder:'Oliver Ayde',object:'The copper begging bowl',
        history:'Oliver Ayde slept under the west bridge and ate at the chapter kitchen. When its almoner began reading the names of the poor aloud before supper, Oliver passed his bowl down the queue. Everyone dropped in a token. The almoner could count the meals, but he could no longer tell who had taken one. The Aydes kept that battered bowl after they acquired a bakehouse. His grandchildren paid for this vault in pennies.'},
      {family:'Osborne',founder:'Basilia Osborne',object:'The short measure',
        history:'Basilia Osborne sold candle wax by a brass weight with a hollow base. Her daughter found the hole while polishing it. Rather than take the case before a magistrate, the chandlers made Basilia supply the chapel with altar candles until the debt was paid. Her children kept the account on the back of the weight box. The last entry reads “paid,” in the daughter’s hand.'},
      {family:'Cantilupe',founder:'Vivian Cantilupe',object:'The players’ book',
        history:'Vivian Cantilupe charged a silver piece for a seat at his winter plays. Every bill carried a riddle. Anyone with the answer came in by the stage door for free. After a hard winter he used the blank leaves of his prompt book to record the names of neighbors buried at the city’s expense. His nieces brought that book here. Most visitors turn straight past the plays.'},
      {family:'Maltoun',founder:'Ismenia Maltoun',object:'The survey chain',
        history:'Ismenia Maltoun sounded a passage through the shoals of the Chionthar with a chain borrowed from a hedge wizard. Two smugglers carried it for her in return for a passage home. At the dock she surrendered their cargo and refused to surrender the men. Years later, when the river took her youngest son, the same two boatmen brought him home. Their oar pins lie beside the chain.'}
    ];
    for(const [i,[x,z]] of tombSites.entries()){
      const family=families[i],y=Math.max(...[-2,2].flatMap(dx=>[-2,2].map(dz=>cemeteryY(x+dx,z+dz))))+.035;
      const id='mausoleum-'+family.family.toLowerCase(),roof=new THREE.Group();
      const tomb={...family,id,x,y,z,w:4,d:4,h:2.94,angle:0,roof};
      curated[id]=tomb;worldObjects.push(tomb);scene.add(roof);
      cemeterySolid('chapelMarble',x,y-.32,z,3.98,.32,4.05);
      for(const dx of [-1.84,1.84])cemeterySolid('chapelAshlar',x+dx,y-.12,z,.36,2.98,4.1);
      cemeterySolid('chapelAshlar',x,y-.12,z+1.89,3.5,2.98,.33);
      for(const dx of [-1.3,1.3])cemeterySolid('chapelAshlar',x+dx,y-.12,z-1.9,1.32,2.98,.34);
      cemeterySolid('chapelMarble',x,y+2.30,z-1.9,1.31,.55,.34);
      door({...tomb,angle:Math.PI,d:3.6,y:y-.10});
      // Keep both roof slopes, gables and the ceiling together for the cutaway.
      function roofPiece(geometry,material,dx,dy,dz){
        const m=new THREE.Mesh(geometry,material);m.position.set(x+dx,y+dy,z+dz);
        m.castShadow=m.receiveShadow=true;roof.add(m);return m;
      }
      roofPiece(new THREE.BoxGeometry(4.25,.15,4.42),mat.chapelAshlar,0,2.85,0);
      const gable=new THREE.Shape();gable.moveTo(-2.05,0);gable.lineTo(2.05,0);gable.lineTo(0,1.03);gable.closePath();
      for(const end of [-2.05,1.85])roofPiece(new THREE.ExtrudeGeometry(gable,{depth:.20,bevelEnabled:false}),mat.chapelAshlar,0,2.91,end);
      for(const side of [-1,1])roofPiece(new THREE.BoxGeometry(2.52,.12,4.63),mat.chapelSlate,side*1.12,3.40,0).rotation.z=-side*Math.atan(.5);
      roofPiece(new THREE.BoxGeometry(.18,.16,4.67),mat.slate,0,3.98,0);
      const side=i%2?1:-1;
      cemeterySolid('graveStone',x+side*1.11,y,z+.15,.78,.54,2.22);
      box('chapelMarble',x+side*1.11,y+.56,z+.15,.87,.12,2.32);
      cemeterySolid('chapelAshlar',x,y,z+1.44,1.48,.81,.43);
      box('chapelMarble',x,y+.84,z+1.44,1.62,.09,.51);
      if(i===0){
        const bowl=new THREE.LatheGeometry([[.07,0],[.14,.03],[.24,.13],[.25,.16],[.23,.16],[.12,.055],[.025,.045]].map(([r,h])=>new THREE.Vector2(r,h)),24);
        const relic=new THREE.Mesh(bowl,mat.brass);relic.position.set(x,y+.89,z+1.44);scene.add(relic);
      }else if(i===1){
        box('oak',x,y+.95,z+1.44,.66,.12,.31);
        for(let j=0;j<3;j++)inst('cyl','brass',x+(j-1)*.19,y+1.07,z+1.44,.045+j*.014,.12,.045+j*.014);
      }else if(i===2){
        for(const k of [-1,1]){
          box('oak',x+k*.19,y+.914,z+1.44,.38,.048,.36);
          inst('box','chalk',x+k*.17,y+.963,z+1.44,.34,.045,.33,0,0xd5bd90,0,-k*.095);
          for(let j=0;j<5;j++)box('charWood',x+k*.17,y+.992,z+1.33+j*.045,.21,.007,.008);
        }
      }else{
        for(let j=0;j<11;j++)inst('link','chain',x+(j-5)*.068,y+.93,z+1.42,.075,.043,.046,0,0xbba99a,j%2?1.45:.55);
        for(const k of [-1,1])box('oak',x+k*.22,y+.918,z+1.58,.31,.038,.038,.14*k);
      }
      const tablet=document.createElement('canvas');tablet.width=768;tablet.height=256;
      const face=tablet.getContext('2d');face.fillStyle='#514c40';face.fillRect(0,0,768,256);
      face.strokeStyle='#aa9771';face.lineWidth=4;face.strokeRect(12,12,744,232);
      face.textAlign='center';face.fillStyle='#eee1be';face.font='small-caps 78px Georgia';face.fillText(family.family,384,113,690);
      face.font='italic 44px Georgia';face.fillText(family.object,384,189,690);
      const map=new THREE.CanvasTexture(tablet);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
      const bronze=new THREE.MeshStandardMaterial({map,roughness:.75,emissiveMap:map,emissive:0xffffff,emissiveIntensity:.13});
      for(const [dy,dz,width] of [[1.62,1.71,1.72],[2.58,-2.082,1.33]]){
        const plaque=new THREE.Mesh(new THREE.PlaneGeometry(width,width/3),bronze);
        plaque.rotation.y=Math.PI;plaque.position.set(x,y+dy,z+dz);scene.add(plaque);
      }
      heat.push({x:x-side*1.46,y:y+1.4,z:z+.9,type:'lamp'});
      box('brass',x-side*1.49,y+1.4,z+.9,.17,.31,.18);
      box('lit',x-side*1.39,y+1.42,z+.9,.045,.21,.13);
    }
    for(const [x,z,broken] of [[-377,151.1,true],[-377,164.9,false]]){
      const y=cemeteryY(x,z);
      cemeterySolid('houseSoot',x,y-.12,z,2.17,.50,2.24);
      cemeterySolid('chalk',x,y+.38,z,1.63,.24,1.64);
      cemeterySolid('houseStone',x,y+.62,z,1.14,broken?.62:1.22,1.16);
      if(broken){
        inst('pole','chalk',x-.52,y+.4,z+1.24,.56,1.72,.59,.2,0xa49a8e,1.26,.73);
        inst('rock','soot',x+.89,y+.15,z+.62,.70,.39,.54,.48);
      }else{
        box('chalk',x,y+1.9,z,1.41,.2,1.46);
        inst('pole','soot',x,y+2.39,z,.55,.82,.56);
        inst('orb','chalk',x,y+2.78,z,.54,.46,.54);
        box('brass',x,y+1.28,z-.595,.52,.31,.045,0,0x88735d);
      }
    }

    const chapelStone='chapelAshlar';
    const glassColors=[0xb49065,0x779296,0x785c94,0x936071,0x627687,0xa77663];
    const stainedGlass=glassColors.map(color=>new THREE.MeshStandardMaterial({
      color,emissive:color,emissiveIntensity:.29,roughness:.32,side:THREE.DoubleSide
    }));
    function cemeteryPane(project,points,index,frame=.027){
      const positions=points.flatMap(([x,y])=>project(x,y));
      const indices=[];
      for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      scene.add(new THREE.Mesh(geo(positions,points.flat(),null,indices),stainedGlass[index%stainedGlass.length]));
      for(let i=0;i<points.length;i++)beam('metal',project(...points[i]),project(...points[(i+1)%points.length]),frame);
    }
    const heraldicNames=['dawn','gauntlet','watch','scales'];
    function heraldicPane(key,project,points,limits,fragment=0,frame=.027){
      const material=mat.heraldry[key];
      if(!material){cemeteryPane(project,points,fragment,frame);return;}
      const [minX,minY,maxX,maxY]=limits;
      const area=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
      const geometry=new THREE.ShapeGeometry(area),pos=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i);
        uv.setXY(i,(x-minX)/(maxX-minX),(y-minY)/(maxY-minY));
        pos.setXYZ(i,...project(x,y));
      }
      geometry.computeVertexNormals();
      const pane=new THREE.Mesh(geometry,material);
      pane.receiveShadow=true;
      scene.add(pane);
      if(frame)for(let i=0;i<points.length;i++)beam('metal',project(...points[i]),project(...points[(i+1)%points.length]),frame);
    }
    function heraldicRose(project,radius){
      const circle=Array.from({length:72},(_,i)=>{
        const angle=i*TAU/72;
        return [radius*Math.cos(angle),radius*Math.sin(angle)];
      });
      heraldicPane('rose',project,circle,[-radius,-radius,radius,radius],2,0);
    }
    const nave={west:-403.8,east:-390,north:147.25,south:185.35,eave:11.25};
    const eastWall=(start,end,h=nave.eave,y=chapelY-.43)=>{
      cemeterySolid(chapelStone,nave.east,y,(start+end)/2,.87,h,end-start);
    };
    eastWall(nave.north,156.65);
    eastWall(159.35,172.57);
    eastWall(173.76,177.8);
    eastWall(179.14,nave.south);
    eastWall(156.65,159.35,nave.eave-3.83,chapelY+3.4);
    const eastLedges=[[172.57,173.76],[177.8,179.14]];
    for(let i=0;i<eastLedges.length;i++){
      const [z0,z1]=eastLedges[i],width=z1-z0;
      eastWall(z0,z0+width,1.9);
      eastWall(z0,z0+width,3.5,chapelY+7.32);
      const mid=z0+width/2;
      const project=(u,v)=>[-389.536,chapelY+1.7+v,mid-u*width/2.6];
      for(const side of [-1,1]){
        const center=side*.64,key=heraldicNames[i*2+(side+1)/2],limits=[center-.545,0,center+.545,5.49];
        heraldicPane(key,project,[[center-.545,2.32],[center-.23,1.97],[center+.03,2.27],
          [center+.22,1.72],[center+.545,2.46],[center+.545,4.76],[center,5.49],[center-.545,4.76]],limits,i,.039);
        if(i%2===0)heraldicPane(key,project,[[center-.54,1.18],[center-.02,1.31],
          [center+.50,.35],[center+.37,0],[center-.54,0]],limits,i+2,.023);
      }
      cemeteryMasonry(-389.37,chapelY+1.62,mid,.42,.24,width+.31);
      cemeteryMasonry(-389.37,chapelY+7.43,mid,.36,.26,width+.31);
    }
    for(const z of [147.65,154.87,160.99,167.01,174.73,183.94]){
      cemeteryMasonry(-389.41,chapelY+4.38,z,1.07,9.2,.77);
      cemeteryMasonry(-389.21,chapelY+1.04,z,1.43,2.26,1.03);
    }
    cemeteryMasonry(-389.96,chapelY+10.82,166.3,1.11,.36,38.39);
    cemeteryMasonry(-389.31,chapelY+3.63,158,.43,.42,3.64);
    for(const side of [-1,1]){
      const z=158+side*1.38;
      cemeteryMasonry(-389.27,chapelY+1.79,z,.53,3.69,.42);
      box('door',-390.94,chapelY+1.65,z,1.57,3.27,.19,-side*.16);
      for(const y of [1.01,2.36])box('brass',-390.97,chapelY+y,z,.17,.065,.54,-side*.16,0x908272);
    }
    const westWall=(start,end,h=nave.eave,y=chapelY-.43)=>{
      cemeterySolid(chapelStone,nave.west,y,(start+end)/2,.91,h,end-start);
    };
    westWall(160.13,173.31);
    westWall(174.7,176.18);
    westWall(177.8,nave.south);
    for(const [index,[start,end]] of [[173.31,174.7],[176.18,177.8]].entries()){
      westWall(start,end,2.05);
      westWall(start,end,3.5,chapelY+7.32);
      const project=(u,v)=>[-404.276,chapelY+1.7+v,mix(start,end,u)];
      const limits=[0,0,1,5.49],key=heraldicNames[index+1];
      heraldicPane(key,project,[[.03,3.1],[.42,3.81],[.58,2.75],[.21,2.83]],limits,3,.019);
      heraldicPane(key,project,[[.6,3.69],[.95,3.12],[.95,2.22],[.72,2.48]],limits,5,.019);
    }
    cemeterySolid(chapelStone,(nave.west+nave.east)/2,chapelY-.43,nave.north,14.66,nave.eave,.88);
    cemeterySolid(chapelStone,(nave.west+nave.east)/2,chapelY-.43,nave.south,14.66,nave.eave,.88);
    cemeteryRoof((nave.west+nave.east)/2,chapelY+10.82,166.30,14.67,38.99,4.92,'z');
    for(const side of [-1,1]){
      const z=side===1?nave.south:nave.north;
      for(const [dy,w,h] of [[.62,14.92,.33],[4.24,14.79,.23],[10.65,14.96,.29]]){
        cemeteryMasonry(-396.9,chapelY+dy,z,w,h,1.06);
      }
      for(const x of [-402.60,-391.15]){
        cemeteryMasonry(x,chapelY+4.58,z+side*.44,.78,9.71,.76);
        cemeteryMasonry(x,chapelY+1.25,z+side*.62,1.08,2.51,.95);
      }
      if(side===1){
        const project=(x,y)=>[-396.9+x,chapelY+4.58+y,z+.474];
        for(const nx of [-.88,0,.88]){
          const i=Math.round((nx+.88)/.88);
          heraldicPane(heraldicNames[i],project,[[nx-.34,0],[nx+.34,0],[nx+.34,3.07],[nx,3.69],[nx-.34,3.07]],
            [nx-.34,0,nx+.34,3.69],i,.046);
          cemeteryMasonry(-396.9+nx,chapelY+4.55,z+.56,.86,.16,.39);
        }
      }
    }

    const mourning={west:-418.6,east:-403.36,north:147.25,south:159.65,eave:8.7};
    const mourningX=(mourning.west+mourning.east)/2,mourningZ=(mourning.north+mourning.south)/2;
    for(const z of [mourning.north,mourning.south])cemeterySolid(chapelStone,mourningX,chapelY-.40,z,15.7,mourning.eave,.86);
    for(const z of [150.22,156.68])cemeterySolid(chapelStone,mourning.west,chapelY-.4,z,.85,mourning.eave,5.6);
    cemeteryMasonry(mourning.west,chapelY+5.58,mourningZ,.85,5.49,1.87);
    cemeteryMasonry(mourning.west-.44,chapelY+2.59,mourningZ,.22,.27,2);
    const mourningGlass=(u,v)=>[mourning.west-.448,chapelY+.65+v,mourningZ+u];
    const mourningBounds=[-.91,0,.91,2.20];
    heraldicPane('dawn',mourningGlass,[[-.88,1.22],[-.88,2.18],[.67,2.18],[.38,1.83],[-.1,1.48],[-.38,1.65]],mourningBounds,0,.024);
    heraldicPane('dawn',mourningGlass,[[.32,.66],[.87,1.21],[.87,.19],[.64,.23]],mourningBounds,2,.024);
    cemeteryRoof(mourningX,chapelY+8.30,mourningZ,15.7,13.29,3.6,'x');
    cemeteryWalk(-418.25,-403.65,147.55,159.35,0xa39286);
    // The rounded vestment chamber emerges from the inside corner of the two wings.
    const rotunda={x:-402.04,z:159.48,r:7.43,eave:8.32};
    const radialPoint=(a,y,r=rotunda.r)=>[rotunda.x+r*Math.cos(a),y,rotunda.z+r*Math.sin(a)];
    const rotundaStart=1.74,rotundaEnd=Math.PI+.05,rotundaSegments=24;
    const wallPositions=[],wallUV=[],wallIndices=[];
    for(let i=0;i<=rotundaSegments;i++){
      const a=mix(rotundaStart,rotundaEnd,i/rotundaSegments);
      wallPositions.push(...radialPoint(a,chapelY-.43),...radialPoint(a,chapelY+rotunda.eave));
      wallUV.push(a*rotunda.r/2.45,0,a*rotunda.r/2.45,(rotunda.eave+.43)/2.18);
      if(i===rotundaSegments)continue;
      const p=i*2,next=mix(rotundaStart,rotundaEnd,(i+1)/rotundaSegments);
      wallIndices.push(p,p+1,p+2,p+1,p+3,p+2);
      const middle=(a+next)/2,[x,y,z]=radialPoint(middle,chapelY-.43);
      collider({x,y,z,w:rotunda.r*(next-a)+.04,d:.47,h:rotunda.eave+.43,angle:-middle-Math.PI/2});
      for(const [dy,depth] of [[.7,.18],[8.18,.17]]){
        beam('chalk',radialPoint(a,chapelY+dy),radialPoint(next,chapelY+dy),depth,.24,0xc8b7ab);
      }
    }
    const rotundaWall=new THREE.Mesh(geo(wallPositions,wallUV,null,wallIndices),mat.chapelAshlar);
    rotundaWall.castShadow=rotundaWall.receiveShadow=true;
    scene.add(rotundaWall);
    const rotundaRoof=new THREE.Mesh(new THREE.ConeGeometry(rotunda.r+.28,2.57,42),mat.chapelSlate);
    const coneUV=rotundaRoof.geometry.attributes.uv;
    for(let i=0;i<coneUV.count;i++)coneUV.setXY(i,coneUV.getX(i)*18,coneUV.getY(i)*3.5);
    rotundaRoof.position.set(rotunda.x,chapelY+rotunda.eave+1.28,rotunda.z);
    rotundaRoof.castShadow=rotundaRoof.receiveShadow=true;
    scene.add(rotundaRoof);

    const roseFace=(x,y)=>[-389.28,chapelY+8.72+y,158-x];
    const rose=(material,radius,depth,x,y,z,tint)=>inst('cyl',material,x,y,z,radius,depth,radius,Math.PI/2,tint,Math.PI/2);
    rose('chalk',1.58,.25,-389.52,chapelY+8.72,158,0xbdb0a4);
    rose('metal',1.42,.17,-389.41,chapelY+8.72,158,0x8b8276);
    heraldicRose(roseFace,1.39);
    for(const z of [149.6,152.62,163.16,166.18,169.20,172.24,177.4,182.4]){
      const x=-385.45,y=cemeteryY(x,z),h=3.43;
      cemeterySolid('chalk',x,y-.07,z,1.02,.43,1.02);
      inst('pole','chalk',x,y+1.77,z,.48,2.78,.48,0,0xe5d9cc);
      box('soot',x,y+3.18,z,.99,.20,.99);
      inst('rock','chalk',x,y+3.65,z,.53,.61,.52,z*.17,0xc2b8aa);
      collider({x,y,z,w:.66,d:.66,h,angle:0});
      for(let j=0;j<5;j++){
        const sx=x+cemeteryRange(-1.6,1.4),sz=z+cemeteryRange(-1.25,1.25);
        inst('rock','cemeteryGlass',sx,cemeteryY(sx,sz)+.07,sz,.14,.043,.21,cemeteryRandom()*TAU,glassColors[j]);
      }
    }

    const quarters={x:-414.0,z:183.5,r:4.55,corner:1.12};
    const q=quarters,qy=cemeteryY(q.x,q.z),qh=4.27;
    const outline=[[-q.r+q.corner,-q.r],[q.r-q.corner,-q.r],[q.r,-q.r+q.corner],[q.r,q.r-q.corner],
      [q.r-q.corner,q.r],[-q.r+q.corner,q.r],[-q.r,q.r-q.corner],[-q.r,-q.r+q.corner]];
    for(let i=0;i<outline.length;i++){
      const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length];
      const wall=(from,to,y,height)=>{
        const xa=mix(ax,bx,from),za=mix(az,bz,from),xb=mix(ax,bx,to),zb=mix(az,bz,to);
        cemeterySolid('houseStone',q.x+(xa+xb)/2,y,q.z+(za+zb)/2,Math.hypot(xb-xa,zb-za)+.036,height,.48,-Math.atan2(zb-za,xb-xa));
      };
      if(i===2){
        wall(0,.32,qy-.37,qh);
        wall(.68,1,qy-.37,qh);
        wall(.32,.68,qy+2.71,qh-3.08);
        box('door',q.x+q.r-.55,qy+1.35,q.z+1.12,1.45,2.7,.18,-.09);
      }else wall(0,1,qy-.37,qh);
      const p=[q.x+ax*1.065,qy+3.9,q.z+az*1.065],n=[q.x+bx*1.065,qy+3.9,q.z+bz*1.065],peak=[q.x,qy+6.78,q.z];
      const lid=new THREE.Mesh(geo([...p,...peak,...n],[0,0,1.31,2.4,2.62,0]),mat.chapelSlate);
      lid.castShadow=lid.receiveShadow=true;
      scene.add(lid);
      beam('charWood',p,n,.15,.19);
      beam('slate',p,peak,.11);
    }
    cemeteryWalk(q.x-3.20,q.x+4.45,q.z-3.18,q.z+3.18,0xa49a8c);
    const bedX=q.x-2.3,bedZ=q.z+2.1,bedY=cemeteryY(bedX,bedZ);
    cemeterySolid('charWood',bedX,bedY,bedZ,1.43,.42,2.65);
    box('cloth',bedX,bedY+.47,bedZ,1.38,.14,2.17,.1,0x65514b);
    box('timber',bedX,bedY+.57,bedZ+1.27,1.43,1.1,.17,.04);
    const deskX=q.x-2.5,deskZ=q.z-2.03,deskY=cemeteryY(deskX,deskZ);
    box('timber',deskX,deskY+.82,deskZ,1.54,.1,.69,.24);
    beam('charWood',[deskX-.57,deskY+.03,deskZ+.21],[deskX-.5,deskY+.79,deskZ+.15],.14);
    beam('charWood',[deskX+.81,deskY+.01,deskZ-.36],[deskX+.56,deskY+.79,deskZ-.2],.14);
    box('chalk',deskX-.18,deskY+.91,deskZ-.04,.28,.036,.36,.26,0xb0a08e);
    box('chalk',deskX+.11,deskY+.905,deskZ-.09,.28,.046,.36,.26,0xb0a08e);
    for(let i=0;i<12;i++){
      const x=q.x+cemeteryRange(-2.3,2.3),z=q.z+cemeteryRange(-3.01,1);
      inst('box','charWood',x,cemeteryY(x,z)+.06,z,.09,.11,cemeteryRange(.32,.81),cemeteryRandom()*TAU,0x9f8572,.11);
    }
    box('chalk',q.x+q.r+.3,cemeteryY(q.x+q.r,q.z)+.1,q.z,.60,.18,2.61);
    heat.push({x:-385,y:chapelY+6.2,z:158,type:'violet',strength:.61},
      {x:-385,y:chapelY+5.1,z:175,type:'violet',strength:.62});
    const purpleMist=new THREE.Mesh(
      new THREE.CircleGeometry(1,48),
      new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{clock:env.uniform.clock},
        vertexShader:'varying vec2 mistUV; void main(){mistUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`
          uniform float clock;
          varying vec2 mistUV;
          void main(){
            vec2 p=mistUV-.5;
            float r=length(p)*2.;
            float threads=.5+.5*sin(21.*p.x+4.*sin(15.*p.y-clock*.24)+clock*.35);
            float whorls=.5+.5*cos(22.*r+3.*sin(19.*p.x)-clock*.45);
            vec3 color=mix(vec3(.18,.06,.26),vec3(.56,.21,.69),threads*whorls);
            gl_FragColor=vec4(color,(.35+.4*threads)*(1.-smoothstep(.36,1.,r)));
          }
        `
      })
    );
    purpleMist.rotation.x=-Math.PI/2;
    purpleMist.scale.set(4.45,4.45,1);
    purpleMist.position.set(-414.3,cemeteryY(-414.3,171.6)+3.43,171.6);
    scene.add(purpleMist);
    heat.push({x:purpleMist.position.x,y:purpleMist.position.y+.6,z:purpleMist.position.z,type:'violet'});
    for(let i=0;i<17;i++){
      const a=i*TAU/17,r=cemeteryRange(4.7,5.45),x=-414.3+Math.cos(a)*r,z=171.6+Math.sin(a)*r;
      inst('rock','rubble',x,cemeteryY(x,z)+.14,z,0.64,cemeteryRange(.18,.61),.72,a,0x8c7776);
    }
    const cat={id:'cathedral',x:-94,z:241,w:30,d:22,h:23,angle:Math.PI,ward:'high',style:5};
    cat.y=L.surface(cat.x,cat.z)+.09;
    const catY=cat.y;
    const choirBalcony={x:cat.x,y:catY+6.096,z:229.67,halfWidth:2.97,depth:3.24};
    const balconyLeaves=[];
    let balconyTravel=0,balconyTarget=false;
    function setBalconyOpen(open,instant=false){
      balconyTarget=open;
      if(instant){balconyTravel=Number(open);poseBalcony()}
    }
    function poseBalcony(){
      const eased=balconyTravel*balconyTravel*(3-2*balconyTravel);
      for(const {side,pivot} of balconyLeaves)pivot.rotation.y=side*eased*1.55;
    }
    function tickBalcony(dt){
      const next=balconyTarget?Math.min(1,balconyTravel+dt*1.6):Math.max(0,balconyTravel-dt*1.7);
      if(next!==balconyTravel){balconyTravel=next;poseBalcony()}
    }
    function buildChoirBalcony(){
      const {x,y,z,halfWidth,depth}=choirBalcony,front=z-depth;
      function masonry(m,x,y,z,w,h,d,tint){
        box(m,x,y,z,w,h,d,0,tint);
        collider({x,y:y-h/2,z,w,h,d,angle:0});
      }
      masonry('houseChalk',x,y-.24,z-depth/2+.09,halfWidth*2,.48,depth+.18,0xb3a39f);
      box('chalk',x,y-.36,front-.04,halfWidth*2+.26,.19,.24,0xdbcbc1);
      box('trim',x,y+1.13,z+.08,2.45,2.26,.09);
      box('chalk',x,y+.012,z,2.58,.024,.43);
      for(const side of [-1,1]){
        const edge=x+side*(halfWidth-.14);
        masonry('houseChalk',edge,y+.17,z-depth/2,.28,.34,depth,0xd1bdb8);
        box('chalk',edge,y+.94,z-depth/2,.29,.18,depth+.16,0xe5d5cb);
        for(let i=1;i<=6;i++)inst('pole','chalk',edge,y+.57,z-i*.46,.15,.72,.15);
        masonry('chalk',edge,y+.52,front,.42,1.04,.42,0xdccec2);
        beam('houseChalk',[x+side*2.18,y-2.30,z+.23],[x+side*2.18,y-.47,front+.58],.47,.52,0xb9ada9);
        box('chalk',x+side*1.31,y+1.13,z,.17,2.26,.42,0xd6c5b7);
        const pivot=new THREE.Group();
        pivot.position.set(x-side*1.23,y+.025,z);scene.add(pivot);balconyLeaves.push({side,pivot});
        function leafPart(material,px,py,pz,w,h,d){
          const mesh=new THREE.Mesh(shapeBox,mat[material]);
          mesh.position.set(side*px,py,pz);mesh.scale.set(w,h,d);
          mesh.castShadow=mesh.receiveShadow=true;pivot.add(mesh);
        }
        leafPart('door',.609,1.12,0,1.218,2.24,.135);
        for(const py of [.32,1.91])leafPart('metal',.61,py,-.081,1.04,.084,.038);
        leafPart('brass',1.044,1.07,-.088,.16,.16,.063);
      }
      // The balusters share one continuous collision rail.
      for(const side of [-1,1])collider({x:x+side*(halfWidth-.14),y:y+.31,z:z-depth/2,w:.24,h:.67,d:depth,angle:0});
      masonry('houseChalk',x,y+.17,front,halfWidth*2,.34,.25,0xd1bdb8);
      masonry('chalk',x,y+.94,front,halfWidth*2+.08,.18,.31,0xe5d5cb);
      collider({x,y:y+.31,z:front,w:halfWidth*2,h:.67,d:.25,angle:0});
      for(let i=-6;i<=6;i++)inst('pole','chalk',x+i*.41,y+.56,front,.15,.72,.15);
    }
    curated.cathedral=cat;worldObjects.push(cat);collider(cat);
    // Reserve the authored buildings first, including the eaves. Shorten a rear
    // wall where two street frontages back onto the same narrow court.
    const lots=new Map();
    function lotCells(o){
      const keys=[],r=Math.hypot(o.w,o.d)/2+1;
      for(let i=Math.floor((o.x-r)/32);i<=Math.floor((o.x+r)/32);i++)
        for(let j=Math.floor((o.z-r)/32);j<=Math.floor((o.z+r)/32);j++)keys.push(i+','+j);
      return keys;
    }
    function reserveLot(o){
      for(const key of lotCells(o)){
        if(!lots.has(key))lots.set(key,[]);
        lots.get(key).push(o);
      }
    }
    function lotsMeet(a,b){
      for(const angle of [a.angle,b.angle])for(const turn of [0,Math.PI/2]){
        const ax=Math.cos(angle+turn),az=-Math.sin(angle+turn);
        const extent=o=>.5*(Math.abs(Math.cos(o.angle)*ax-Math.sin(o.angle)*az)*o.w+Math.abs(Math.sin(o.angle)*ax+Math.cos(o.angle)*az)*o.d);
        if(Math.abs((a.x-b.x)*ax+(a.z-b.z)*az)>extent(a)+extent(b)+.85)return false;
      }
      return true;
    }
    worldObjects.forEach(reserveLot);
    const fallenLots=[],fall=seeded(83921);
    // Damage follows contiguous blocks near the torn banks, gates and wharves.
    const damageCenters=[[234,39,62],[317,224,58],[284,133,40],[-302,67,58],[-206,-162,68],[-117,95,50],[357,-186,54]];
    function fellInDescent(o){
      const bank=L.pathDistance(o.x,o.z,L.gorge)-L.riftWidth(o.z);
      const exposure=Math.max(0,1-bank/100,...damageCenters.map(([x,z,r])=>1-Math.hypot(o.x-x,o.z-z)/r));
      const chance=.012+exposure*.43+(o.burnt?.07:0);
      if(fall()>chance||L.places.some(p=>L.dist(p.x,p.z,o.x,o.z)<Math.hypot(o.w,o.d)*.5+3))return false;
      const corners=[[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]].map(([u,v])=>local(o,u*o.w,v*o.d));
      return corners.every(([x,z])=>Number.isFinite(L.islandSurface(x,z))&&!L.fluid(x,z)&&Math.abs(L.islandSurface(x,z)-L.islandSurface(o.x,o.z))<1.45);
    }
    for(const src of L.houses){
      const nearby=new Set(lotCells(src).flatMap(key=>lots.get(key)||[]));
      for(const [width,depth] of [[1,1],[1,.80],[.85,.72],[.70,.65]]){
        const shift=src.d*(1-depth)*.5;
        const o={...src,w:src.w*width,d:src.d*depth,x:src.x+Math.sin(src.angle)*shift,z:src.z+Math.cos(src.angle)*shift};
        if(o.w<4.2||o.d<4.8||[...nearby].some(other=>lotsMeet(o,other)))continue;
        if(fellInDescent(o)){
          o.y=L.islandSurface(o.x,o.z);o.ruined=true;fallenLots.push(o);worldObjects.push(o);reserveLot(o);
        }else reserveLot(house(o));
        break;
      }
    }
    const hallTowers=[[-122,260,6.6,30],[-76,259,6.4,25],[-75,216,5.9,20]];
    for(const [x,z,r,h] of [...hallTowers,[-133,220,5.7,7],[-121,242,5.3,5.5]]){
      const y=L.surface(x,z),radius=r*1.035;
      let bottom=y-1.0;
      for(let i=0;i<16;i++){
        const a=i*TAU/16;
        bottom=Math.min(bottom,L.surface(x+Math.cos(a)*radius,z+Math.sin(a)*radius)-.35);
      }
      inst('towerShaft','footing',x,(y+.22+bottom)/2,z,radius,y+.22-bottom,radius,0,0xdad0c5);
      tower(x,z,y,r,h,false,h<10);
    }
    // Stepped lanterns and pinnacles make the cathedral legible across the riverfront.
    for(const [x,z,r,h] of hallTowers){
      const y=L.surface(x,z)+h;
      inst('cyl','houseChalk',x,y+.55,z,r*.88,1.1,r*.88);
      inst('cyl','soot',x,y+4.3,z,r*.52,6.9,r*.52);
      for(let j=0;j<8;j++){
        const a=j*TAU/8,px=x+Math.sin(a)*r*.74,pz=z+Math.cos(a)*r*.74;
        inst('pole','houseChalk',px,y+4.3,pz,.34,7.1,.34,a);
        if(j%2===0)inst('cone','houseChalk',px,y+8.1,pz,.46,2.8,.46);
      }
      inst('cyl','houseChalk',x,y+7.6,z,r*.82,.9,r*.82);
      inst('cone','pitchedSlate',x,y+13.9,z,r*.86,12.6,r*.86);
      inst('pole','brass',x,y+20.9,z,.12,2.1,.12);
    }
    inst('hillsideFoundation','footing',-94,catY-1.04,241,30.25,2.3,22.15);
    function hallRoof(x,width,base,rise){
      inst('pitchedRoof','pitchedSlate',x,catY+base,241,22.6,rise,width+.52,Math.PI/2,0xafa5ae);
      inst('gable','houseChalk',x,catY+base,241,22,rise,width,Math.PI/2,0xdbd4c5);
      box('slate',x,catY+base+rise-.04,241,.17,.22,22.7);
    }
    {
      inst('cathedralNave','chalk',-94,catY+11.5,241,13.6,23,22,0,0xf6eee3);
      hallRoof(-94,13.6,23,6.2);
      for(const x of [-104.9,-83.1]){
        inst('cathedralAisle','chalk',x,catY+6.125,241,8.2,12.25,22,0,0xe4ddcf);
        hallRoof(x,8.2,12.25,2.9);
        box('chalk',x,catY+1.15,229.91,8.2,.23,.19);
        box('chalk',x,catY+10.1,229.91,8.2,.22,.19);
      }
      for(const side of [-1,1])box('chalk',-94+side*4.06,catY+7.1,229.87,5.38,.29,.31);
      box('chalk',-94,catY+20.7,229.88,13.55,.25,.28);
    }
    function hallArch(face,m,x,base,z,width,jamb,crown,trim,picture){
      const half=width/2,profile=[];
      for(let i=0;i<=12;i++){
        const t=i/6-1;
        profile.push([x+t*half,base+jamb+crown*Math.sqrt((4-(1+Math.abs(t))**2)/3)]);
      }
      const panel=new THREE.Shape();
      panel.moveTo(-half,0);panel.lineTo(half,0);
      for(let i=profile.length-1;i>=0;i--)panel.lineTo(profile[i][0]-x,profile[i][1]-base);
      panel.closePath();
      const geometry=new THREE.ShapeGeometry(panel);
      const art=mat.heraldry[picture];
      if(art){
        const uv=geometry.attributes.uv,pos=geometry.attributes.position;
        for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/width+.5,pos.getY(i)/(jamb+crown));
      }
      const infill=new THREE.Mesh(geometry,art||mat[m]);
      const [px,pz]=local(face,x,z);
      infill.position.set(px,catY+base,pz);infill.rotation.y=face.angle;
      infill.receiveShadow=true;scene.add(infill);
      const border=z+.12;
      for(let i=1;i<profile.length;i++)facadeBeam(face,'chalk',
        [...profile[i-1],border],[...profile[i],border],trim,.27,0xd8cbc0);
      for(const side of [-1,1])lb(face,'chalk',x+half*side,base+jamb/2,border,trim,jamb,.28,0xe2d5c0);
    }
    buildChoirBalcony();
    hallArch(cat,'trim',0,8.34,11.25,2.61,.08,.65,.19);
    hallArch(cat,'trim',0,.30,11.27,2.8,2.81,1.23,.24);
    hallArch(cat,'trim',0,.30,11.12,3.8,3.06,1.69,.27);
    for(const x of [-1.99,-1.64,1.64,1.99]){
      lb(cat,'chalk',x,1.84,11.52,.25,2.9,.35,0xe1d9c9);
      lb(cat,'houseChalk',x,.53,11.55,.36,.43,.47);
      lb(cat,'houseChalk',x,3.23,11.55,.38,.23,.48);
    }
    for(const x of [-.93,-.62,-.31,0,.31,.62,.93]){
      const top=3.11+1.20*Math.sqrt((4-(1+Math.abs(x)/1.4)**2)/3);
      lb(cat,'door',x,(.32+top)/2,11.317,.297,top-.32,.066,0x776858);
    }
    for(const y of [1.06,2.58])lb(cat,'metal',0,y,11.384,2.13,.076,.044);
    lb(cat,'metal',0,2.24,11.385,.052,3.78,.05);
    for(const x of [-.17,.17])lb(cat,'brass',x,1.66,11.42,.079,.32,.085);
    for(const x of [-10.9,10.9]){
      hallArch(cat,'trim',x,3.55,11.02,1.75,2.9,1.12,.19);
      for(const side of [-1,1])lb(cat,'charFrame',x+side*.42,5.12,11.17,.68,2.86,.11,0x827773);
    }
    for(const [x,picture] of [[-3.5,'dawn'],[0,'gauntlet'],[3.5,'watch']]){
      hallArch(cat,'hallGlass',x,8.05,11.02,1.68,2.75,1.26,.20,picture);
    }
    inst('roseRim','houseChalk',-94,catY+16.6,229.75,2.76,2.76,1.8,0,0xded1bf);
    heraldicRose((x,y)=>[-94-x,catY+16.6+y,229.79],2.68);
    for(const side of [-1,1]){
      const x=-94+side*6.40;
      box('houseChalk',x,catY+10.5,229.72,1.25,21,.9,0,0xd5c9b9);
      box('chalk',x,catY+21.15,229.68,1.57,.32,1.04);
      inst('cone','chalk',x,catY+22.2,229.68,.52,1.8,.52);
      const flank={...cat,angle:side*Math.PI/2};
      for(let i=0;i<4;i++){
        const z=232+i*6.1,bx=-94+side*15.64;
        box('houseChalk',bx,catY+4.2,z,1.52,8.4,1.76,0,0xccc0b1);
        beam('chalk',[bx,catY+8.3,z],[bx-side*1.94,catY+12.9,z],.82,.98);
        if(i<3)hallArch(flank,'hallGlass',side*(241-z-3),4.25,15.02,1.55,3.25,1.29,.19,heraldicNames[(i+(side===1?1:2))%4]);
      }
    }
    curtain([-132,262],[-75,262],5.8);curtain([-75,215],[-75,262],5.7);
    curtain([-132,218],[-110,217],6.1);curtain([-87,216],[-75,215],6.1);
    for(const [x,z,height] of [[-110,217,4.3],[-87,216,3.25]]){
      const y=L.surface(x,z);
      inst('masonry','stone',x,y+height/2-.26,z,1.52,height+.52,2.09,0,0xc5b5a1);
      inst('rock','soot',x+.32,y+height-.12,z+.19,.82,.53,.91,.6,0xb4a195,.26,-.12);
    }
    const approach=subdiv([[-103,203],[-104.2,215],[-104.2,223.2],[-102.7,225.7],[-99,227.7],[-94,227.7]],1.08);
    const flagstones=[],flagUV=[],flagColors=[],flagIndices=[];
    for(let i=1;i<approach.length;i++){
      const [ax,az]=approach[i-1],[bx,bz]=approach[i],length=L.dist(ax,az,bx,bz);
      const dx=(bx-ax)/length,dz=(bz-az)/length,half=.93+Math.sin(i*.82)*.12;
      const points=[[ax+dx*.095-dz*half,az+dz*.095+dx*half],
        [ax+dx*.095+dz*half,az+dz*.095-dx*half],
        [bx-dx*.075+dz*half,bz-dz*.075-dx*half],
        [bx-dx*.075-dz*half,bz-dz*.075+dx*half]];
      if(points.some(([x,z])=>L.fluid(x,z)))continue;
      const start=flagstones.length/3,shade=.66+Math.sin(i*7.8)*.055;
      for(const [x,z] of points){
        flagstones.push(x,L.islandSurface(x,z)+.072,z);flagUV.push(x/3,z/3);flagColors.push(shade,shade*.96,shade*.89);
      }
      flagIndices.push(start,start+2,start+1,start,start+3,start+2);
    }
    mesh(flagstones,flagUV,flagColors,flagIndices,mat.street);
    for(const [z,top,width] of [[228.08,0,4.7],[228.65,.15,4.25],[229.38,.30,3.8]]){
      const bottom=catY-.27,y=catY+top,depth=z===229.38?.98:.59;
      inst('foundation','footing',-94,(bottom+y)/2,z,width,y-bottom,depth,0,0xd1c3b0);
      collider({x:-94,z,y:bottom,w:width,d:depth,h:y-bottom,angle:0});
    }
    for(const x of [-97.12,-90.88]){
      box('soot',x,catY+1.28,229.70,.61,.94,.59);
      inst('cyl','metal',x,catY+1.83,229.67,.36,.17,.36);
      inst('orb','lit',x,catY+1.90,229.67,.21,.085,.21);
      heat.push({x,y:catY+1.92,z:229.67,type:'lamp'});
    }
    for(let i=0;i<62;i++){
      const x=between(-143,-119),z=between(214,252),y=L.terrain(x,z);
      inst(pick(['box','rock']),'rubble',x,y+.48,z,between(.33,2.2),between(.31,1.2),between(.34,2.4),rng()*TAU,0xb6a79f,rng()*.7,rng()*.7);
    }
    for(const [x,z] of [[-78,-82],[-75,-50],[-82,-9],[-84,24],[-90,51],[-83,117],[-93,166],[-133,88],[-175,125],[-156,69],[-315,132],[-320,180],[-230,-138],[414,223]]){
      const y=L.terrain(x,z),h=between(4.2,8.1);
      beam('timber',[x,y,z],[x+between(-.8,.8),y+h,z],.44,.5,0x6e645e);
      for(let i=0;i<6;i++){
        const a=between(0,TAU),r=between(1.1,3.65),start=between(.31,.84)*h;
        const end=[x+Math.cos(a)*r,y+start+between(1,3.1),z+Math.sin(a)*r];
        const mid=[mix(x,end[0],.66),mix(y+start,end[1],.61),mix(z,end[2],.66)];
        beam('timber',[x,y+start,z],mid,.15,.17,0x726460);beam('timber',mid,end,.071,.09,0x655852);
      }
    }
    for(const z of [-128,-88,-45,7,104,145]){
      const x=-75-z*.085,y=L.terrain(x,z);
      box('stone',x,y+.28,z,1.83,.56,1.82);box('chalk',x,y+.81,z,1.43,.51,1.38);
      box('chalk',x,y+1.86,z,.36,1.60,.22);
      box('brass',x,y+2.34,z,.82,.11,.26);
    }

    function crate(x,z,s=1,a=0){
      const y=L.terrain(x,z),o={x,z,y,angle:a};
      box('timber',x,y+s*.44,z,s,s*.88,s,a,0xb0a190);
      for(const side of [-1,1])for(const dx of [-1,1])lb(o,'door',dx*s*.38,s*.45,side*s*.51,s*.12,s*.87,.055);
      for(const dy of [.09,.8])lb(o,'trim',0,s*dy,s*.52,s,.08,.05);
      collider({x,z,y,w:s,d:s,h:s*.88,angle:a});
    }
    shapes.cask=new THREE.LatheGeometry([[.35,0],[.38,.05],[.43,.25],[.456,.52],[.44,.77],[.38,1],[.35,1.04]].map(([r,y])=>new THREE.Vector2(r,y)),20);
    function barrel(x,z,s=1){
      const y=L.terrain(x,z),a=between(0,TAU);
      inst('cask','door',x,y,z,s,s,s,a,0xc5ad8e);
      for(const [dy,r] of [[.095,.398],[.29,.444],[.75,.451],[.96,.399]]){
        inst('cyl','metal',x,y+s*dy,z,s*r,s*.036,s*r,a);
      }
      inst('cyl','plank',x,y+s*1.027,z,s*.355,s*.024,s*.355,a,0xc2ac8c);
      inst('cyl','oak',x+s*.13,y+s*1.045,z,s*.033,s*.016,s*.033,a);
      collider({x,z,y,w:s*.89,d:s*.89,h:s*1.04,angle:0});
    }
    function tent(x,z,w,d,angle,tint){
      const y=L.terrain(x,z),o={x,y,z,angle};
      inst('roof','cloth',x,y+1.32,z,w,2.1,d,angle,tint);
      for(const px of [-w/2,w/2])for(const pz of [-d/2,d/2])lb(o,'timber',px,.73,pz,.1,1.46,.1);
      lb(o,'timber',0,.84,0,w*.62,.11,d*.36);
      for(const px of [-1,1])for(const pz of [-1,1])lb(o,'oak',px*w*.26,.39,pz*d*.13,.10,.80,.10);
      for(const pz of [-1,1])lb(o,'frame',0,.72,pz*d*.13,w*.56,.14,.075);
      collider({x,z,y,w:w*.62,d:d*.36,h:.895,angle});
    }
    // A dray abandoned beside the cracked loading yard with one shaft snapped short.
    const dray={x:320,z:249,y:L.terrain(320,249),angle:.43};
    for(let i=0;i<6;i++)lb(dray,'oak',(i-2.5)*.25,.54,0,.235,.15,2.43);
    for(const side of [-1,1]){
      lb(dray,'timber',side*.67,.74,0,.13,.41,2.5);
      const [wx,wz]=local(dray,side*.96,.13);
      inst('link','metal',wx,dray.y+.56,wz,.56,.56,.56,dray.angle+Math.PI/2);
      for(let j=0;j<4;j++){
        const t=j*Math.PI/4,dx=Math.cos(t)*.53,dy=Math.sin(t)*.53;
        const [a,b]=local(dray,side*.96,.13-dx),[c,d]=local(dray,side*.96,.13+dx);
        beam('oak',[a,dray.y+.56-dy,b],[c,dray.y+.56+dy,d],.056);
      }
      const [a,b]=local(dray,side*.46,-.90),[c,d]=local(dray,side*.58,side<0?-3.4:-2.25);
      beam('oak',[a,dray.y+.51,b],[c,dray.y+.12,d],.12);
    }
    collider({...dray,w:1.94,d:2.5,h:.86});
    for(const [x,z] of [[259,132],[269,131],[281,131],[290,131],[256,151],[270,153],[285,154],[294,154],[267,164],[290,164]]){
      tent(x,z,between(4.3,6),between(3.1,4.1),between(-.27,.27),pick([0xa98666,0x736e66,0xb09375,0x88645b,0x8a8371]));
      if(rng()<.72)crate(x+3.7,z+between(-2,2),between(.59,1.10),rng()*.5);
    }
    const soup={x:285,z:145,y:L.terrain(285,145),angle:0};
    for(let i=0;i<3;i++){
      const a=i*TAU/3;
      beam('metal',[soup.x+Math.cos(a)*.82,soup.y,soup.z+Math.sin(a)*.82],[soup.x,soup.y+1.97,soup.z],.073);
    }
    inst('cyl','metal',soup.x,soup.y+.78,soup.z,.55,.39,.55);
    inst('cyl','brass',soup.x,soup.y+1.00,soup.z,.49,.054,.49);
    beam('metal',[soup.x,soup.y+.93,soup.z],[soup.x,soup.y+1.92,soup.z],.038);
    for(const [x,z] of [[212,52],[-103,188],[-313,83],[267,140]]){
      const y=L.terrain(x,z);
      box('stone',x,y+.27,z,1.49,.54,1.28);
      box('chalk',x,y+.57,z,1.30,.14,1.16);
      for(const off of [-.27,.27])inst('orb','brass',x+off,y+.88,z,.24,.26,.085);
      for(let i=0;i<5;i++)inst('pole',i%2?'brass':'chalk',x-.46+i*.24,y+.72,z+.34,.066,.21,.062);
    }
    for(const [x,z] of [[241,38],[238,39],[223,50],[215,41],[198,38],[88,-113],[226,154],[305,238],[320,248],[318,246],[321,242],[381,200],[-289,81],[-318,70],[-106,209],[-108,213]]){
      crate(x,z,between(.63,1.13),between(-.35,.35));barrel(x+1.2,z+.62,between(.64,1.01));
    }
    for(let i=0;i<155;i++){
      const x=between(-475,481),z=between(-296,276);
      if(!L.valid(x,z)||!L.roads.some(r=>L.pathDistance(x,z,r.path)<r.w/2+5))continue;
      const y=L.terrain(x,z);
      for(let j=0;j<5;j++)inst('rock','rubble',x+between(-2.4,2.4),y+.12,z+between(-2.4,2.4),between(.10,.43),between(.07,.27),between(.11,.42),rng()*TAU,0xa78f85,rng(),rng());
    }
    function dock(x,z,angle,len,w){
      const y=L.surface(x,z),o={x,y,z,angle};
      for(let i=0;i<Math.ceil(len/.65);i++)lb(o,'timber',0,-.032,i*.65,w,.19,.64,0xb9a58e);
      for(const side of [-1,1])for(let i=0;i<len;i+=3.6){
        const [xx,zz]=local(o,side*w*.45,i);inst('pole','timber',xx,y-2.1,zz,.28,6.7,.27);
      }
      const [xx,zz]=local(o,0,len/2);collider({x:xx,z:zz,y:y-.127,w,d:len,h:.19,tread:"wood",angle});
    }
    for(const [x,z,n] of [[272,279,13],[302,277,20],[326,274,14],[365,276,15],[396,273,18],[-292,278,9],[-273,278,5]])dock(x,z,0,n,6.2);
    // A small landing on the eastern lip, with an open view across the rift.
    for(let i=0;i<28;i++){
      const x=65.8+i*.52,y=L.terrain(x,260);
      box('plank',x,y+.14,260,.50,.18,9.2,0,i%5===0?0xaa9788:0xd1c0ad);
    }
    collider({x:72.8,z:260,y:L.terrain(72.8,260)-.05,w:14.55,d:9.2,h:.27,tread:"wood",angle:0});
    for(const side of [-1,1]){
      const z=260+side*4.65;
      for(const x of [66,70,74,78]){
        const y=L.terrain(x,z);
        inst('pole','timber',x,y+.53,z,.15,1.06,.15);
      }
      for(let i=0;i<3;i++){
        const x1=66+i*4,x2=x1+4;
        const mid=[x1+2,L.terrain(x1+2,z)+.79,z];
        beam('oak',[x1,L.terrain(x1,z)+1.04,z],mid,.065);
        beam('oak',mid,[x2,L.terrain(x2,z)+1.04,z],.065);
      }
    }
    const mast=[65.6,L.terrain(65.6,264.6),264.6],boom=[61.4,mast[1]+4.4,264.6];
    box('oak',mast[0],mast[1]+2.6,mast[2],.52,5.2,.58);
    collider({x:mast[0],z:mast[2],y:mast[1],w:.58,d:.62,h:5.2,angle:0});
    beam('oak',[mast[0],mast[1]+4.7,mast[2]],boom,.31,.26);
    beam('oak',[mast[0],mast[1]+1.0,mast[2]],boom,.24,.22);
    inst('cyl','metal',boom[0],boom[1]-.20,boom[2],.26,.16,.26,0,0xbeb1a4,Math.PI/2);
    beam('oak',[boom[0]-.18,boom[1]-.2,boom[2]],[boom[0]-.18,mast[1]+1.2,boom[2]],.047);
    inst('link','metal',boom[0]-.18,mast[1]+1.05,boom[2],.13,.19,.13);
    const capX=67,capZ=256.4,capY=L.terrain(capX,capZ);
    inst('cyl','timber',capX,capY+.44,capZ,.47,.88,.47);
    inst('cyl','metal',capX,capY+.90,capZ,.52,.13,.52);
    beam('timber',[capX-.9,capY+1,capZ],[capX+.9,capY+1,capZ],.14,.14);
    collider({x:capX,z:capZ,y:capY,w:1,d:1,h:1.08,angle:0});
    crate(73,263.1,.85,.12);barrel(74,263.3,.8);
    // Mooring hardware and quay edging give the long approach a human scale.
    for(const x of [265,280,294,310,324,339,355,370,386,402]){
      const z=270,y=L.surface(x,z);
      inst('cyl','stone',x,y+.18,z,.68,.36,.68);
      inst('cyl','metal',x,y+.62,z,.22,.83,.22);
      inst('cyl','metal',x,y+1.04,z,.33,.15,.33);
      box('stone',x,y-.16,z-1.8,12,.32,.52);
    }
    for(const [x,z] of [[270,270],[304,269],[328,268],[367,269],[399,268]]){
      const y=L.surface(x,z);
      inst('link','timber',x,y+.13,z,.75,.75,.75,0,0xb59b80,Math.PI/2);
      inst('link','timber',x+.15,y+.18,z+.1,.48,.48,.48,.4,0xa68d77,Math.PI/2);
    }
    for(const [x,z] of [[443,-107],[442,-65],[430,-20],[426,27],[428,88]])dock(x,z,1.47,17,4.5);
    const hx=309,hz=257,hy=L.terrain(hx,hz);
    for(let i=0;i<15;i++){
      const t=i/14,w=5.8*Math.sin(Math.PI*t)**.62+.2,x=hx+(t-.5)*19;
      const h=1.7*Math.sin(Math.PI*t)+.18;
      box('timber',x,hy+.87,hz,1.30,h,w,.09,0xaa907a);
      collider({x,z:hz,y:hy+.87-h/2,w:1.30,d:w,h,angle:.09});
      beam('door',[x,hy+.30,hz-w*.49],[x,hy+.30,hz+w*.49],.24,.21);
    }


    function lamp(x,z,ghost=false){
      if(!L.valid(x,z,-6))return;
      const y=L.terrain(x,z);
      if(ghost){inst('orb','ghost',x,y+2.6,z,.16,.16,.16);heat.push({x,y:y+2.6,z,type:'ghost'});return}
      box('stone',x,y+.12,z,.52,.25,.52);inst('pole','metal',x,y+1.76,z,.093,3.43,.093);
      beam('metal',[x,y+3.43,z],[x+.55,y+3.43,z],.075);
      inst('cyl','brass',x+.55,y+2.92,z,.21,.08,.21);inst('cyl','lit',x+.55,y+3.11,z,.135,.35,.135);
      inst('cone','metal',x+.55,y+3.39,z,.22,.23,.22);heat.push({x:x+.55,y:y+3.07,z,type:'lamp'});
    }
    for(const [x,z,g] of [[236,37],[216,42],[250,59],[202,35],[188,31],[116,66],[66,86],[-49,61,1],[-93,90],[-361,156],[-315,77,1],[-285,73],[-166,141],[-100,-38,1],[251,148],[300,149],[297,237],[405,-203],[445,-57],[-79,-233],[-242,-179]])lamp(x,z,g);
    function fire(x,z,s=1){
      const y=L.terrain(x,z)+.15;
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        box('timber',x+Math.sin(a)*.43*s,y+.13,z+Math.cos(a)*.43*s,.18*s,.22,.91*s,a);
        inst('rock','soot',x+Math.cos(a)*.83*s,y+.12,z+Math.sin(a)*.83*s,.33*s,.24,.34*s,rng()*TAU);
      }
      heat.push({x,y:y+.40*s,z,type:'fire',size:s});soundFires.push({x,y,z});
    }
    for(const [x,z,s] of [[232,53,1.4],[255,144,.9],[285,145,.85],[330,241,1.2],[445,-44,1.8],[398,-228,1.4],[-138,227,1.5],[-126,237,1.2],[-313,87,.6],[-359,181,.95],[-79,-107,1],[-88,106,.9]])fire(x,z,s);
    // The rift split these street blocks. Their surviving walls still mark lots
    // along the approaches, with the lower remains closest to the broken banks.
    const ruinRandom=seeded(97302),ruinRange=(a,b)=>mix(a,b,ruinRandom());
    function ruinSite(o){
      const nearby=new Set(lotCells(o).flatMap(key=>lots.get(key)||[]));
      if([...nearby].some(other=>lotsMeet(o,other)))return false;
      for(const u of [-.5,-.25,0,.25,.5])for(const v of [-.5,-.25,0,.25,.5]){
        const [x,z]=local(o,u*(o.w+1.1),v*(o.d+1.1));
        if(!L.valid(x,z,-11)||L.pathDistance(x,z,L.gorge)<L.riftWidth(z)+3.4||
          L.pathDistance(x,z,L.garden)<9||L.fluid(x,z)||
          L.places.some(p=>L.dist(x,z,p.x,p.z)<(p.id==='hall-vista'?18:5.5))||
          L.bridges.some(b=>L.segment(x,z,[b.x1,b.z1],[b.x2,b.z2]).d<b.w/2+3.1)||
          L.roads.some(r=>L.pathDistance(x,z,r.path)<r.w/2+1.1)||
          (collision.get(cell(x,z))||[]).some(other=>overlap(other,x,z,1.25)))return false;
        if(Math.abs(L.islandSurface(x,z)-o.y)>2.5)return false;
      }
      return true;
    }
    function ruinedHouse(o,bankDistance){
      const halfW=o.w/2,halfD=o.d/2;
      const low=bankDistance<19&&ruinRandom()<.56;
      const sides=[[-halfW,-halfD,halfW,-halfD],[halfW,-halfD,halfW,halfD],
        [halfW,halfD,-halfW,halfD],[-halfW,halfD,-halfW,-halfD]];
      const tallSide=Math.floor(ruinRandom()*4);
      for(let side=0;side<4;side++){
        const [ax,az,bx,bz]=sides[side],length=Math.hypot(bx-ax,bz-az),count=Math.ceil(length/1.55);
        const angle=o.angle+(ax===bx?Math.PI*.5:0),step=length/count;
        const breach=Math.floor(ruinRange(1,count-1)),peak=ruinRandom()<.5?0:count-1;
        for(let i=0;i<count;i++){
          if(i===breach&&(side===2||ruinRandom()<.62))continue;
          const t=(i+.5)/count,[x,z]=local(o,mix(ax,bx,t),mix(az,bz,t));
          const y=L.islandSurface(x,z)-.25,decay=Math.abs(i-peak);
          const h=low?ruinRange(.44,1.24):side===tallSide?
            Math.max(.72,ruinRange(3.75,5.2)-decay*ruinRange(.54,.9)):
            Math.max(.52,ruinRange(1.52,3.01)-decay*.31);
          const depth=ruinRange(.51,.74),span=step+.04;
          inst('ruinWall',i%3===0?'houseSoot':'houseStone',x,y+h/2,z,span,h,depth,angle,0xbab0a5);
          collider({x,z,y,w:span,d:depth,h,angle});
          const cap=ruinRange(.17,.38);
          if(o.ruined){
            const count=1+Math.floor(ruinRandom()*3),brick=span/3.05;
            for(let j=0;j<count;j++){
              const off=(j-1)*brick;
              inst('detail','footing',x+Math.cos(angle)*off,y+h+.063,z-Math.sin(angle)*off,
                brick-.024,.14,depth*.87,angle+ruinRange(-.065,.065),0xb0a091,0,ruinRange(-.035,.035));
            }
          }else inst('rock','footing',x+ruinRange(-.22,.22),y+h-.02,z+ruinRange(-.22,.22),
            span*.44,cap,depth*.74,angle+ruinRange(-.4,.4),0xa79b92);
        }
      }
      for(let i=0;i<23;i++){
        const [x,z]=local(o,ruinRange(-halfW+.8,halfW-.8),ruinRange(-halfD+.8,halfD-.8));
        const y=L.islandSurface(x,z),size=ruinRange(.17,.70);
        if(i%5===0)inst('box','scorchedSlate',x,y+.09,z,size*1.15,.065,size*.81,ruinRange(0,TAU),0xac9b97,.15,.16);
        else inst('rock',i%3?'houseSoot':'footing',x,y+size*.17,z,size,size*.43,size*.70,ruinRange(0,TAU),0xad9b89);
      }
      if(!low){
        const [ax,az]=local(o,-halfW*.70,-halfD*.55),[bx,bz]=local(o,halfW*.61,halfD*.72);
        beam('charFrame',[ax,L.islandSurface(ax,az)+.64,az],[bx,L.islandSurface(bx,bz)+.17,bz],.22,.27);
      }
    }
    for(let z=-278;z<296;z+=11.5){
      const i=L.gorge.findIndex(p=>p[1]>z);
      const a=L.gorge[i-1],b=L.gorge[i],center=mix(a[0],b[0],(z-a[1])/(b[1]-a[1]));
      for(const side of [1,-1])for(let offset=9;offset<(side===1?99:82);offset+=11.2){
        if(ruinRandom()<.11)continue;
        const x=center+side*(L.riftWidth(z)+offset)+ruinRange(-2.4,2.4),pz=z+ruinRange(-2.6,2.6);
        const o={x,z:pz,y:L.islandSurface(x,pz),w:ruinRange(5.6,9.8),d:ruinRange(6.5,10.6),angle:ruinRange(-.19,.19)};
        if(!Number.isFinite(o.y)||!ruinSite(o))continue;
        ruinedHouse(o,L.pathDistance(x,pz,L.gorge)-L.riftWidth(pz));
        reserveLot(o);
      }
    }
    // Falls of masonry spread out from a broken sill; the heavier blocks stay
    // near the wall line, with roof slates and splinters spilling into the lane.
    const wreck=seeded(60137);
    mat.ember=new THREE.MeshStandardMaterial({color:0x442018,emissive:0xc33e0c,emissiveIntensity:.8,roughness:1});
    function clearDebrisSite(x,z,pad){
      if(!L.island(x,z)||L.fluid(x,z)||L.places.some(p=>L.dist(x,z,p.x,p.z)<pad+2.5))return false;
      if(L.pathDistance(x,z,L.gorge)<L.riftWidth(z)+pad)return false;
      if(L.bridges.some(b=>L.segment(x,z,[b.x1,b.z1],[b.x2,b.z2]).d<b.w*.5+pad))return false;
      if(L.roads.some(r=>L.pathDistance(x,z,r.path)<1.2+pad))return false;
      return !(collision.get(cell(x,z))||[]).some(o=>overlap(o,x,z,pad));
    }
    function wreckage(x,z,angle,burning){
      if(!clearDebrisSite(x,z,1.9))return;
      const c=Math.cos(angle),s=Math.sin(angle);
      for(let i=0;i<29;i++){
        const along=(wreck()-.5)*7,across=(wreck()-.34)*(1+3.7* wreck()),px=x+along*c-across*s,pz=z+along*s+across*c;
        if(!clearDebrisSite(px,pz,.45))continue;
        const y=L.surface(px,pz),size=.16+.65* Math.pow(wreck(),2);
        if(i%4===0)inst('box','scorchedSlate',px,y+.11,pz,size*.8,.07,size*1.2,angle+wreck(),0xa39a96,.16*wreck(),.18*wreck());
        else inst('rock',i%3?'houseStone':'footing',px,y+size*.15,pz,size,size*.44,size*.66,wreck()*TAU,0xb09d8c,wreck()*.5,wreck()*.49);
      }
      for(let i=0;i<3;i++){
        const a=angle+(wreck()-.5)*1.4,r=.75+wreck()*.95,offset=(wreck()-.5)*.9;
        const ax=x-r*Math.cos(a),az=z+offset-r*Math.sin(a),bx=x+r*Math.cos(a),bz=z+offset+r*Math.sin(a);
        if(clearDebrisSite(ax,az,.18)&&clearDebrisSite(bx,bz,.18))beam('charFrame',[ax,L.surface(ax,az)+.14,az],[bx,L.surface(bx,bz)+.20,bz],.20,.27);
      }
      if(burning){
        for(let i=0;i<7;i++){
          const px=x+(wreck()-.5)*1.1,pz=z+(wreck()-.5)*.76;
          inst('rock','ember',px,L.surface(px,pz)+.10,pz,.16+ wreck()*.11,.10,.18,wreck()*TAU);
        }
        const y=L.surface(x,z)+.23;
        heat.push({x,y,z,type:'fire',size:1.15+wreck()*.94});soundFires.push({x,y,z});
      }
    }
    for(let i=1;i<L.gorge.length;i++){
      const a=L.gorge[i-1],b=L.gorge[i];
      for(const side of [-1,1])for(const t of [.2,.55,.87]){
        const z=mix(a[1],b[1],t),x=mix(a[0],b[0],t)+side*(L.riftWidth(z)+5+wreck()*12);
        wreckage(x,z,Math.atan2(b[1]-a[1],b[0]-a[0]),wreck()<.30);
      }
    }
    for(const [x,z,a] of [[237,43,.61],[221,35,.23],[265,145,1.3],[311,239,.10],[325,255,.65],[-116,224,.82]])wreckage(x,z,a,true);
    for(const [index,o] of fallenLots.entries()){
      ruinedHouse(o,L.pathDistance(o.x,o.z,L.gorge)-L.riftWidth(o.z));
      const clay=o.style===1||o.style===4,roofMat=clay?'scorchedClay':'scorchedSlate';
      const bed=(u,v,lift=0)=>{
        const [x,z]=local(o,u*o.w,v*o.d);
        return [x,L.islandSurface(x,z)+lift,z];
      };
      const [hx,hy,hz]=bed(-.29,-.29);
      const chimneyHeight=Math.min(o.h*.72,3.2+fall()*1.9);
      if(index%3!==1){
        // The flue and hearth survive the floor timbers. The dark recess faces the room.
        const hearth={x:hx,y:hy,z:hz,angle:o.angle};
        lb(hearth,'slate',0,.09,.30,1.72,.18,1.20);
        for(const side of [-1,1])lb(hearth,'footing',side*.54,.50,0,.38,.96,.65);
        lb(hearth,'houseSoot',0,.48,-.27,.79,.93,.14);
        lb(hearth,'houseStone',0,1.09,0,1.62,.24,.77);
        const shaft=chimneyHeight-1.2;
        lb(hearth,'footing',-.09,1.2+shaft/2,-.05,.79,shaft,.65);
        collider({x:hx,y:hy,z:hz,w:1.45,d:.77,h:1.2,angle:o.angle});
        collider({x:hx,y:hy+1.2,z:hz,w:.82,d:.69,h:shaft,angle:o.angle});
      }
      // One bay of roof has come down together. Short battens still hold its tiles.
      const slope=(u,v)=>.13+(u+.03)*1.45;
      for(const v of [-.29,.08])beam('charFrame',bed(-.03,v,.12),bed(.34,v,slope(.34)),.20,.23);
      for(let row=0;row<4;row++){
        const u=row*.091;
        beam('oak',bed(u,-.31,slope(u)+.08),bed(u,.10,slope(u)+.08),.085,.105);
        for(let col=0;col<6;col++){
          if(fall()<.32)continue;
          const v=-.29+col*.066+(row%2)*.019,slip=u+(fall()-.5)*.023;
          const [x,y,z]=bed(slip,v,slope(slip)+.15);
          inst('box',roofMat,x,y,z,o.w*.079,.066,o.d*.058,o.angle+(fall()-.5)*.12,0xb4a69b,0,Math.atan2(1.45,o.w));
          collider({x,z,y:y-.05,w:o.w*.089,d:o.d*.063,h:.09,angle:o.angle});
        }
      }
      // A fan of fragments follows the side wall, away from the front door.
      for(let j=0;j<20;j++){
        const side=index%2?1:-1,u=side*(.51+fall()*.24),v=fall()*.72-.36;
        const [x,z]=local(o,u*o.w,v*o.d);
        if(!clearDebrisSite(x,z,.42))continue;
        const y=L.islandSurface(x,z),size=.12+fall()*.37;
        if(!Number.isFinite(y))continue;
        if(j%3)inst('rock','houseStone',x,y+size*.17,z,size,size*.42,size*.64,o.angle+fall(),0xbfb3a1);
        else inst('box',roofMat,x,y+.055,z,size,.075,size*.77,o.angle+fall()*2,0xbba49a,.12,.08);
      }
    }
    const fires=heat.filter(f=>f.type==='fire'),pt=[],seeds=[];
    for(const f of fires)for(let i=0;i<106;i++){pt.push(f.x,f.y,f.z);seeds.push(rng(),f.size)}
    const flameGeometry=new THREE.BufferGeometry();
    flameGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pt,3));
    flameGeometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,2));
    const flameFX=new THREE.Points(flameGeometry,new THREE.ShaderMaterial({
      depthWrite:false,transparent:true,blending:THREE.AdditiveBlending,
      uniforms:{clock:env.uniform.clock,pixel:{value:1000}},
      vertexShader:[
        'attribute vec2 seed;uniform float clock,pixel;varying float progress;',
        'void main(){float t=fract(seed.x*21.57+clock*(.78+seed.x*1.2));float a=seed.x*623.0+t*1.8;',
        'vec3 p=position+vec3(sin(a)*(.13+.48*seed.x)*(1.-t),pow(t,1.4)*1.24,cos(a)*(.13+.48*seed.x)*(1.-t))*seed.y;',
        'vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;',
        'float pixelsPerMetre=projectionMatrix[3][3]>.5?pixel*projectionMatrix[1][1]*.5:pixel/max(2.,-v.z);',
        'gl_PointSize=clamp((.17+sin(seed.x*54.)*.10)*(1.-t*.82)*seed.y*pixelsPerMetre,.65,66.);progress=t;}'
      ].join('\n'),
      fragmentShader:'varying float progress;void main(){float a=max(0.,1.-length(gl_PointCoord-.5)*2.);gl_FragColor=vec4(mix(vec3(1.,.76,.18),vec3(1.,.11,.014),progress),a*a*(1.-progress)*.75);}'
    }));
    flameFX.renderOrder=16;scene.add(flameFX);
    const smokeGeometry=new THREE.BufferGeometry();
    const smokePositions=[],smokeSeeds=[];
    for(const f of fires)for(let i=0;i<37;i++){
      smokePositions.push(f.x,f.y,f.z);smokeSeeds.push(rng(),f.size);
    }
    smokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(smokePositions,3));
    smokeGeometry.setAttribute('seed',new THREE.Float32BufferAttribute(smokeSeeds,2));
    const smoke=new THREE.Points(smokeGeometry,new THREE.ShaderMaterial({
      depthWrite:false,transparent:true,
      uniforms:{clock:env.uniform.clock,pixel:flameFX.material.uniforms.pixel},
      vertexShader:[
        'attribute vec2 seed;uniform float clock,pixel;varying float age;varying float randomSeed;',
        'void main(){age=fract(seed.x*23.42+clock*(.22+seed.x*.067));randomSeed=seed.x;',
        'float spread=age*age;vec3 p=position+vec3(spread*4.2+sin(seed.x*947.+age*7.)*(.14+spread*.54),',
        '1.+age*5.5,spread*1.8+cos(seed.x*341.+age*6.)*(.11+spread*.58))*seed.y;',
        'vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;',
        'gl_PointSize=clamp((.39+age*1.12)*seed.y*pixel/max(2.,-v.z),1.,110.);}'
      ].join('\n'),
      fragmentShader:[
        'varying float age,randomSeed;',
        'void main(){vec2 v=gl_PointCoord-.5;float theta=atan(v.y,v.x);',
        'float swirl=1.+.16*sin(theta*4.+randomSeed*90.)+.09*sin(theta*7.+age*13.);',
        'float density=pow(max(0.,1.-length(v)*2.05*swirl),2.);',
        'gl_FragColor=vec4(mix(vec3(.36,.21,.16),vec3(.23,.17,.17),age),density*(1.-age)*.16);}'
      ].join('\n')
    }));
    smoke.renderOrder=15;scene.add(smoke);

    for(const [x,z,dx,dz] of L.chains){
      const sx=x*.95,sz=z*.95,ax=x+dx,az=z+dz,sy=L.surface(sx,sz),ay=L.avernusFloor(ax,az);
      const horizontal=V(ax-sx,0,az-sz).normalize();
      const a=V(sx,sy+4.3,sz).addScaledVector(horizontal,1.30);
      const b=V(ax,ay+15,az).addScaledVector(horizontal,-2.65);
      const dir=b.clone().sub(a),n=Math.ceil(dir.length()/5.1);
      const anchor=(x,y,z,reaches,radius,mountY)=>{
        inst('anchorShaft','chain',x,y-.45,z,radius,reaches+.45,radius,.2,0xc6bfb7);
        collider({x,y:y-.45,z,w:radius*1.19,d:radius*1.19,h:reaches+.45,angle:0});
        const ring=radius*.635,bandHeight=radius*.185,perpendicular=V(-horizontal.z,0,horizontal.x);
        const pinYaw=-Math.atan2(perpendicular.z,perpendicular.x);
        inst('cyl','chain',x,mountY-bandHeight*.76,z,ring*.97,bandHeight,ring*.97,0,0xa9a4a0);
        inst('cyl','chain',x,mountY,z,ring,bandHeight,ring,0,0xd9cbc0);
        inst('cyl','chain',x,mountY+bandHeight*.76,z,ring*.97,bandHeight,ring*.97,0,0xa9a4a0);
        inst('cyl','chain',x,mountY,z,radius*.15,radius*1.69,radius*.15,pinYaw,0xe0caba,0,-Math.PI/2);
        for(const side of [-1,1]){
          const px=x+perpendicular.x*radius*.83*side,pz=z+perpendicular.z*radius*.83*side;
          inst('cyl','chain',px,mountY,pz,radius*.235,radius*.14,radius*.235,pinYaw,0xcfc4b7,0,-Math.PI/2);
        }
        for(let i=0;i<10;i++){
          const angle=i*TAU/10,rx=ring*.989*Math.cos(angle),rz=ring*.989*Math.sin(angle);
          inst('anchorBolt','chain',x+rx,mountY,z+rz,radius*.082,radius*.079,radius*.082,-angle,0xddd0c5,0,-Math.PI/2);
        }
      };
      anchor(sx,sy,sz,10.8,2.42,a.y);
      anchor(ax,ay,az,33.2,4.35,b.y);
      for(let i=0;i<=n;i++){
        const t=i/n,p=a.clone().addScaledVector(dir,t);p.y-=Math.sin(t*Math.PI)*7;
        const up=V(dir.x,dir.y-Math.cos(t*Math.PI)*Math.PI*7,dir.z).normalize();
        const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),up);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),i%2*Math.PI/2));
        batch('chainLink','chain',p,q,V(2.35,2.35,2.35),i%3===0?0xc8b3a9:0xaa9c98);
      }
    }
    for(let i=0;i<340;i++){
      const x=between(-1500,1500),z=between(-1300,1550),y=L.terrain(x,z);
      if(L.inside(x,z,L.outline)||L.pathDistance(x,z,L.river)<150)continue;
      const s=between(2,26),h=between(.62,3.2)*s;
      inst(i%13===0?'cone':'rock','rubble',x,y+.18*h,z,s,h,s*between(.51,1.28),rng()*TAU,0x978077,rng()*.42,rng()*.46);
    }
    const dummy=new THREE.Vector3(),detailTiles=[];
    for(const [k,entries] of tiles){
      const [kind,m]=k.split(':');
      const instances=new THREE.InstancedMesh(shapes[kind],mat[m],entries.length);
      for(const [i,[transform,tint]] of entries.entries()){instances.setMatrixAt(i,transform);instances.setColorAt(i,tint)}
      instances.castShadow=kind!=='link'&&kind!=='chainLink'&&kind!=='detail'&&kind!=='scorch'&&m!=='glass'&&m!=='lit'&&m!=='rubble';
      instances.receiveShadow=true;
      if(instances.computeBoundingSphere)instances.computeBoundingSphere();else instances.frustumCulled=false;
      const middle=new THREE.Vector3();
      let largestPart=0,thickestPart=0;
      for(const [transform] of entries){
        middle.add(dummy.setFromMatrixPosition(transform));
        dummy.setFromMatrixScale(transform);
        largestPart=Math.max(largestPart,dummy.x,dummy.y,dummy.z);
        thickestPart=Math.max(thickestPart,Math.min(dummy.x,dummy.y,dummy.z));
      }
      middle.multiplyScalar(1/entries.length);instances.userData.center=middle;
      if(kind==='detail'||(kind!=='link'&&kind!=='chainLink'&&kind!=='ruinWall'&&(largestPart<4.2||largestPart<16&&thickestPart<.48))){
        const [, ,tx,tz]=k.split(':');
        detailTiles.push({instances,x:Number(tx)*168,z:Number(tz)*168,reach:largestPart<2.4?95:170});
      }
      scene.add(instances);
    }
    const nearest=Array.from({length:5},()=>{
      const p=new THREE.PointLight(0xff7b35,0,26,2);scene.add(p);return p;
    });
    const portableLight=new THREE.PointLight(0xffd3aa,0,12.2,2);scene.add(portableLight);
    let selectedLights=[],previousLightX=Infinity,previousLightZ=Infinity;
    function lighting(state,t,eye,center,extent,ambientFlight=false,animateFlight=false){
      flyovers.tick(t,eye,center,ambientFlight,animateFlight);
      for(const {instances,x,z,reach} of detailTiles){
        const dx=Math.max(x-center.x,center.x-x-168,0),dz=Math.max(z-center.z,center.z-z-168,0);
        instances.visible=state.mode==='walk'?dx*dx+dz*dz<reach*reach:extent<370&&dx*dx+dz*dz<(extent*1.5+12)**2;
      }
      if(Math.hypot(center.x-previousLightX,center.z-previousLightZ)>2.4){
        selectedLights=heat.map(f=>[f,(f.x-center.x)**2+(f.z-center.z)**2]).sort((a,b)=>a[1]-b[1]);
        previousLightX=center.x;previousLightZ=center.z;
      }
      const night=state.darkness||state.time==='midnight',waning=state.time==='dusk';
      mat.lit.emissiveIntensity=night?1.10:waning?.62:.24;
      for(const [i,p] of nearest.entries()){
        const f=selectedLights[i]?.[0];
        if(!f){p.intensity=0;continue}
        const type=f.type;
        p.color.set(type==='violet'||type==='ghost'?0xbea3ff:type==='fire'?0xff6b22:0xffac60);
        p.distance=type==='fire'?18+(f.size||1)*6:type==='violet'?21:13;
        p.intensity=type==='fire'?(85+Math.sin(t*8+i)*16)*(f.size||1):type==='violet'?42*(f.strength??1):night?51:waning?37:23;
        p.position.set(f.x,f.y+(type==='fire'?.45:0),f.z);
      }
      portableLight.position.copy(eye);portableLight.intensity=state.light?119:0;
      flameFX.material.uniforms.pixel.value=renderer.domElement.height;
      flameFX.visible=state.mode==='walk'||extent<210;smoke.visible=state.mode==='walk';
    }
    function overlap(o,x,z,pad=0){
      const dx=x-o.x,dz=z-o.z,c=Math.cos(o.angle),s=Math.sin(o.angle);
      return Math.abs(dx*c-dz*s)<o.w/2+pad&&Math.abs(dx*s+dz*c)<o.d/2+pad;
    }
    function cragSurface(o,x,z){
      let top=-Infinity;
      for(const [a,b,c] of o.triangles){
        const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
        if(Math.abs(det)<1e-9)continue;
        const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
        const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)top=Math.max(top,u*a[1]+v*b[1]+w*c[1]);
      }
      return top;
    }
    function bridgeSurface(x,z){
      let floor=-Infinity;
      for(const b of L.bridges){
        const q=L.segment(x,z,[b.x1,b.z1],[b.x2,b.z2]);
        if(q.d<b.w/2+.11)floor=Math.max(floor,mix(b.y1,b.y2,q.t));
      }
      return floor;
    }
    function floorAt(x,z,y=Infinity){
      const deck=bridgeSurface(x,z);
      const rendered=L.islandSurface(x,z),city=y>=rendered-3?rendered:-Infinity;
      let floor=Math.max(L.avernusFloor(x,z),city,deck<=y?deck:-Infinity);
      const escapeFloor=escapeSection(escapeFloorProfile,z),dx=x-escapeExit.x;
      if(escapeExit.y<=y&&escapeFloor&&dx>=escapeFloor.left&&dx<=escapeFloor.right)floor=Math.max(floor,escapeExit.y);
      for(const o of collision.get(cell(x,z))||[])if(overlap(o,x,z,.075)){
        const top=o.triangles?cragSurface(o,x,z):o.y+o.h;
        if(top<=y)floor=Math.max(floor,top);
      }
      return floor;
    }
    function treadAt(x,z,y){
      for(const o of collision.get(cell(x,z))||[]){
        if(o.tread&&Math.abs(o.y+o.h-y)<.28&&overlap(o,x,z,.08))return o.tread;
      }
      if(Math.abs(bridgeSurface(x,z)-y)<.3)return 'stone';
      if(!L.island(x,z))return 'grit';
      return L.roads.some(r=>L.pathDistance(x,z,r.path)<=r.w*.5)?'stone':'grit';
    }
    function blocked(x,z,y,h){
      const rendered=L.islandSurface(x,z);
      if(Number.isFinite(rendered)&&y<rendered-.1&&y+h>L.underside(x,z))return true;
      const dx=x-escapeExit.x,dy=y-escapeExit.y;
      if(dy<4&&dy+h>0&&Math.abs(dx)<7){
        const section=escapeSection(escapePassage,z);
        if(section&&(dx<section.left+.24||dx>section.right-.24||dy+h>section.height-.49||z<285.25))return true;
        if(escapeParapet.some(({a,b,height})=>dy<height+.12&&L.segment(dx,z,a,b).d<.53))return true;
      }
      for(const o of collision.get(cell(x,z))||[]){
        if(o.floorOnly||!overlap(o,x,z,.245))continue;
        const top=o.triangles?cragSurface(o,x,z):o.y+o.h;
        if(y+.165<top&&y+h>o.y)return true;
      }
      for(const d of doors){
        if(d.o.family){
          if(Math.abs(d.x-x)<2&&Math.abs(d.z-z)<2&&y<d.y+d.h&&y+h>d.y){
            const yaw=d.pivot.rotation.y,cx=d.x+Math.cos(yaw)*d.w/2,cz=d.z-Math.sin(yaw)*d.w/2;
            if(overlap({x:cx,z:cz,w:d.w,d:.145,angle:yaw},x,z,.19))return true;
          }
          continue;
        }
        if(!d.open&&Math.abs(d.x-x)<3&&Math.abs(d.z-z)<3&&y<d.y+d.h&&y+h>d.y){
          const [xx,zz]=local(d.o,0,d.o.d/2+.1);
          if(overlap({x:xx,z:zz,w:d.w,d:.22,angle:d.o.angle},x,z,.23))return true;
        }
      }
      if(y<choirBalcony.y+2.265&&y+h>choirBalcony.y&&Math.abs(z-choirBalcony.z)<1.55){
        for(const {side,pivot} of balconyLeaves){
          const dx=x-pivot.position.x,dz=z-pivot.position.z,c=Math.cos(pivot.rotation.y),s=Math.sin(pivot.rotation.y);
          const along=side*(dx*c-dz*s),depth=dx*s+dz*c;
          if(along>-.20&&along<1.418&&Math.abs(depth)<.268)return true;
        }
      }
      return false;
    }
    function roofAt(x,z,y){
      const section=escapeSection(escapePassage,z),dx=x-escapeExit.x;
      if(section&&dx>section.left&&dx<section.right&&y>=escapeExit.y-.6&&y<escapeExit.y+section.height)return escapeExit;
      return Object.values(curated).find(o=>o.roof&&overlap(o,x,z,-.07)&&y>=o.y-.6&&y<o.y+o.h);
    }
    function nearby(x,z,y){
      return doors.find(d=>L.dist(d.x,d.z,x,z)<2.5&&Math.abs(y-d.y)<2.35);
    }
    function doorUpdate(dt){
      for(const d of doors){
        const target=d.open?-Math.PI*.53:0;
        if(Math.abs(d.angle-target)<.001)continue;
        d.angle=mix(d.angle,target,1-Math.exp(-dt*15));d.pivot.rotation.y=d.o.angle+d.angle;
      }
    }
    return {scene,env,buildingMaterials:{wood:mat.plank,stone:mat.rubble,plaster:mat.plaster},curated,worldObjects,doors,dynamicDoors,heat,soundFires,sightLights:[...nearest,portableLight],lighting,bridgeSurface,floorAt,treadAt,blocked,roofAt,nearby,doorUpdate,overlap,escapeExit,choirBalcony,setBalconyOpen,tickBalcony,cemeteryGate};
  }
  return {build};
})();



