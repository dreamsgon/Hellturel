'use strict';
const Avernus = (() => {
  const {clamp, seeded}=Elturel;
  const times = {
    cinder:{label:'Cinderlight',sky:'#552a35',horizon:'#d67a55',fog:'#9a574a',sun:'#ffd2a3',energy:2.5,hemi:1.53,vector:[-0.55,.52,.47],glow:.73},
    glare:{label:'Brass glare',sky:'#733b33',horizon:'#d99c63',fog:'#b07854',sun:'#ffe0ab',energy:3,hemi:1.8,vector:[-.26,.91,-.31],glow:.38},
    dusk:{label:'Blood dusk',sky:'#331b31',horizon:'#b64f42',fog:'#804445',sun:'#ff9a66',energy:1.8,hemi:1.23,vector:[.71,.22,.26],glow:.95},
    midnight:{label:'Deep night',sky:'#151424',horizon:'#4d2330',fog:'#422c39',sun:'#b8b7f5',energy:.48,hemi:.36,vector:[-.45,.79,-.49],glow:.14}
  };
  const weather={
    haze:{label:'Sulfur haze',density:.00175,ash:.22,thunder:false},
    ash:{label:'Ashfall',density:.0035,ash:.77,thunder:false},
    storm:{label:'Companion storm',density:.0027,ash:.51,thunder:true},
    mist:{label:'Necromantic mist',density:.007,ash:.22,thunder:false},
    cinders:{label:'Cinder squall',density:.0048,ash:1,thunder:true},
    fireRain:{label:'Fire rain',density:.0036,ash:.31,thunder:false}
  };
  const field=[
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fb(vec2 p){float r=0.,a=.53;mat2 m=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){r+=a*n(p);p=m*p*2.07+vec2(17.4,9.2);a*=.5;}return r;}'
  ].join('\n');
  const vertex=[
    'varying vec3 world;',
    'void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}'
  ].join('\n');

  function build(scene,cloudMap,crustMap) {
    const uniform={
      clock:{value:0}, sky:{value:new THREE.Color()}, horizon:{value:new THREE.Color()},
      fogColor:{value:new THREE.Color()}, lightDir:{value:new THREE.Vector3()},
      cloud:{value:.7}, darkness:{value:0},
      fogAmount:{value:.00175}, lavaLight:{value:.73},cloudPhoto:{value:cloudMap},crustPhoto:{value:crustMap}
    };
    const sky=new THREE.Mesh(new THREE.SphereGeometry(3700,48,24),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,uniforms:uniform,vertexShader:vertex,
      fragmentShader:[
        'varying vec3 world; uniform float clock, cloud, darkness, lavaLight; uniform vec3 sky,horizon,lightDir;',
        'uniform sampler2D cloudPhoto;',field,
        'void main(){',
        'vec3 ray=normalize(world-cameraPosition);float alt=ray.y;',
        'float latitude=asin(clamp(alt,-1.,1.))/1.5707963;',
        'vec2 uv=vec2(atan(ray.z,ray.x)/6.2831853+.54+clock*.00009,clamp((latitude-.07)/.93,0.,1.));',
        'vec3 photo=texture2D(cloudPhoto,uv).rgb;',
        'float cover=smoothstep(-.29,-.025,photo.r-photo.b);',
        'float billow=dot(photo,vec3(.35,.53,.12));',
        'vec3 c=mix(horizon*.77,sky+vec3(.050,.044,.070),smoothstep(-.04,.67,alt));',
        'float flare=pow(max(dot(ray,normalize(lightDir)),0.),6.);',
        'c+=vec3(.37,.092,.021)*flare*lavaLight;',
        'vec3 clouds=mix(sky*.38+vec3(.023,.021,.026),horizon*.85+vec3(.19,.11,.085),smoothstep(.41,.93,billow));',
        'c=mix(c,clouds,cover*cloud*smoothstep(.065,.17,latitude));',
        'vec2 wind=ray.xz/(.46+max(.0,alt))*2.7+vec2(clock*.002,0.);',
        'float bank=fb(wind+vec2(.8*billow,-.33*billow));',
        'vec3 smoke=mix(horizon*.54,sky*.23+vec3(.013,.009,.017),smoothstep(.42,.73,bank));',
        'c=mix(c,smoke,cloud*smoothstep(.33,.64,bank)*smoothstep(-.035,.25,alt));',
        'c=mix(c,horizon*.33,(1.-smoothstep(-.62,-.1,alt)));',
        'c*=1.-.92*darkness;',
        'gl_FragColor=vec4(c,1.);',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}'
      ].join('\n')
    }));
    sky.renderOrder=-30;
    sky.frustumCulled=false;scene.add(sky);

    const eye=new THREE.Vector3(56,263,-72);
    const corona=new THREE.Mesh(new THREE.PlaneGeometry(178,178),new THREE.ShaderMaterial({
      depthWrite:false,transparent:true,uniforms:uniform,
      vertexShader:'varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:[
        'varying vec2 uv0;uniform float clock,darkness;',field,
        'void main(){vec2 p=(uv0-.5)*2.;float r=length(p), a=atan(p.y,p.x);',
        'float wobble=fb(vec2(cos(a),sin(a))*6.+clock*.12);',
        'float rim=.395+(wobble-.5)*.024;',
        'float wisps=exp(-max(0.,r-rim)*(5.+15.*wobble))*(1.-smoothstep(.55,.95,r));',
        'float threads=exp(-abs(r-rim)*105.)*(.35+1.3*wobble);',
        'float corona=wisps*.63+threads*.95;',
        'vec3 hue=mix(vec3(.37,.12,.46),vec3(1.,.66,.39),smoothstep(.24,.76,wobble));',
        'float body=1.-smoothstep(rim-.005,rim+.007,r);',
        'vec3 c=mix(hue*corona,vec3(.008,.004,.012),body);',
        'gl_FragColor=vec4(c,max(body,clamp(corona,0.,.91))*(1.-darkness*.45));',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}'
      ].join('\n')
    }));
    corona.position.copy(eye);
    corona.renderOrder=12;scene.add(corona);

    const boltMaterial=new THREE.LineBasicMaterial({color:0xcab1ff,transparent:true,depthWrite:false,opacity:0});
    const boltGeometry=new THREE.BufferGeometry();
    const boltData=new Float32Array(3*2*42);
    boltGeometry.setAttribute('position',new THREE.BufferAttribute(boltData,3));
    const bolts=new THREE.LineSegments(boltGeometry,boltMaterial);
    bolts.frustumCulled=false;bolts.renderOrder=14;scene.add(bolts);
    const random=seeded(88);
    function strike(big) {
      let idx=0;
      for(let b=0;b<3;b++){
        const ang=random()*Math.PI*2;
        const dir=new THREE.Vector3(Math.cos(ang),big?-1.18:Math.sin(ang)*.37,Math.sin(ang)).normalize();
        const start=eye.clone().addScaledVector(dir,32);
        let prev=start;
        for(let i=1;i<=14;i++){
          const length=big&&b===0?112:29+6*b;
          const point=start.clone().addScaledVector(dir,length*i/14);
          point.x+=(random()-.5)*9;point.z+=(random()-.5)*9;point.y+=(random()-.5)*7;
          for(const p of [prev,point]){boltData[idx++]=p.x;boltData[idx++]=p.y;boltData[idx++]=p.z}
          prev=point;
        }
      }
      boltGeometry.attributes.position.needsUpdate=true;
    }
    strike(true);

    const hemi=new THREE.HemisphereLight(0xdcd9e2,0x65585e,1.2);
    scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffbe95,2.4);
    sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.bias=-.0004;
    sun.shadow.normalBias=.40;
    sun.shadow.camera.near=1;
    sun.shadow.camera.far=1080;
    sun.shadow.radius=2.4;
    scene.add(sun,sun.target);
    const fog=new THREE.FogExp2(0x97564a,.00175);
    scene.fog=fog;

    const count=1850;
    const particles=new Float32Array(count*3);
    const sizes=new Float32Array(count);
    for(let i=0;i<count;i++){
      particles[3*i]=random()*116;particles[3*i+1]=random()*53;particles[3*i+2]=random()*116;sizes[i]=.8+random()*2.7;
    }
    const cloudGeometry=new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position',new THREE.BufferAttribute(particles,3));
    cloudGeometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
    const ashInfo={...uniform, density:{value:.22}, origin:{value:new THREE.Vector3()}, ember:{value:0}};
    const ash=new THREE.Points(cloudGeometry,new THREE.ShaderMaterial({
      depthWrite:false,transparent:true,uniforms:ashInfo,
      vertexShader:[
        'uniform float clock,density,ember;uniform vec3 origin;attribute float size;varying float weight;',
        'void main(){vec3 seed=position;vec3 motion=vec3(clock*(1.1+density*2.4),-clock*(.8+ember*1.65),clock*.65);',
        'vec3 p=origin+mod(seed+motion-origin,vec3(116.,53.,116.))-vec3(58.,24.,58.);',
        'vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;',
        'gl_PointSize=clamp(size*78./max(1.,-mv.z),.75,7.);',
        'weight=smoothstep(1.,4.,-mv.z)*(1.-smoothstep(24.,65.,-mv.z))*step(seed.x/116.,density);}'
      ].join('\n'),
      fragmentShader:[
        'varying float weight;uniform float ember;',
        'void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(mix(vec3(.75,.61,.55),vec3(1.,.45,.12),ember),weight*max(0.,1.-d*2.)*.60);}'
      ].join('\n')
    }));
    ash.frustumCulled=false;ash.renderOrder=22;scene.add(ash);

    // One GPU draw for the falling trails. Fade each drop at both ends of its cycle.
    const rainGeometry=new THREE.InstancedBufferGeometry();
    rainGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,1,0],3));
    rainGeometry.setAttribute('seed',new THREE.InstancedBufferAttribute(particles.subarray(0,720*3),3));
    const rain=new THREE.LineSegments(rainGeometry,new THREE.ShaderMaterial({
      uniforms:ashInfo,transparent:true,depthWrite:false,
      vertexShader:[
        'attribute vec3 seed;uniform vec3 origin;uniform float clock;varying float opacity;varying float tip;',
        'void main(){float speed=9.+seed.x*.035;vec3 span=vec3(72.,44.,72.);',
        'vec3 fall=vec3(1.25,-speed,.55)*clock;',
        'vec3 offset=mod(seed+fall-origin,span)-span*.5;tip=position.y;',
        'vec3 pos=origin+offset+vec3(-.12,.83+seed.z*.005,-.05)*tip;',
        'opacity=(1.-smoothstep(.35,.5,max(max(abs(offset.x)/72.,abs(offset.z)/72.),abs(offset.y)/44.)))*smoothstep(1.5,5.,length(offset));',
        'gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);}'
      ].join('\n'),
      fragmentShader:'varying float opacity;varying float tip;void main(){gl_FragColor=vec4(mix(vec3(.94,.46,.14),vec3(.68,.17,.05),tip),opacity*(1.-tip)*.80);}'
    }));
    rain.frustumCulled=false;rain.renderOrder=21;scene.add(rain);
    function update(state,camera,aim,extent,t,live) {
      const time=times[state.time],w=weather[state.weather];
      const exposed=state.darkness?.07:1;
      uniform.clock.value=t;
      uniform.sky.value.set(time.sky);uniform.horizon.value.set(time.horizon);
      const fiery=state.weather==='fireRain';
      if(fiery){uniform.sky.value.multiplyScalar(.68);uniform.horizon.value.lerp(fireHorizon,.35)}
      uniform.fogColor.value.set(state.weather==='mist'?'#797080':fiery?'#986040':time.fog).multiplyScalar(state.darkness?.23:1);
      uniform.lightDir.value.set(...time.vector).normalize();
      uniform.cloud.value=state.weather==='ash'?.95:state.weather==='storm'||fiery?1:.79;
      uniform.darkness.value=state.darkness?1:0;
      const aerial=state.mode==='walk'?Elturel.smooth(460,755,Math.hypot(camera.position.x,camera.position.z)):0;
      const density=w.density*(1.-aerial*.57);
      uniform.fogAmount.value=density*(state.mode==='walk'?1:.14);
      uniform.lavaLight.value=time.glow;
      sky.position.copy(camera.position);
      corona.quaternion.copy(camera.quaternion);
      corona.visible=state.mode==='walk';
      bolts.visible=state.mode==='walk'&&live&&w.thunder;
      boltMaterial.opacity=.23;
      fog.color.copy(uniform.fogColor.value);
      fog.density=density*(state.mode==='walk'?1:.23);
      hemi.intensity=time.hemi*exposed;
      hemi.color.set(state.weather==='mist'?0xd4c6ed:0xe3dce2);
      sun.color.set(time.sun);
      sun.intensity=time.energy*exposed;
      sun.target.position.set(aim.x*(1.-aerial),aim.y*(1.-aerial)-45*aerial,aim.z*(1.-aerial));
      sun.position.copy(sun.target.position).addScaledVector(uniform.lightDir.value,420+550*aerial);
      const size=clamp(Math.max(extent,660*aerial),84,760);
      const c=sun.shadow.camera;
      c.far=1080+800*aerial;c.left=c.bottom=-size;c.top=c.right=size;c.updateProjectionMatrix();
      ash.visible=state.mode==='walk'&&live;
      rain.visible=ash.visible&&fiery;
      ashInfo.origin.value.copy(camera.position);
      ashInfo.density.value=w.ash;
      ashInfo.ember.value=state.weather==='cinders'?.94:.12;
    }

    function liquid(lava, rheology=1, cascade=false) {
      const u={...uniform, molten:{value:lava?1:0},flow:{value:rheology},cascade:{value:cascade?1:0}};
      return new THREE.ShaderMaterial({
        side:THREE.DoubleSide,uniforms:u,vertexShader:vertex,
        fragmentShader:[
          'varying vec3 world;uniform vec3 sky,horizon,fogColor,lightDir;uniform float clock,molten,flow,fogAmount,darkness,lavaLight;',
          field,'uniform sampler2D crustPhoto;uniform float cascade;',
          'void main(){vec2 p=world.xz;vec3 v=normalize(cameraPosition-world);vec3 c;',
          'if(molten>.5){',
          'vec2 g=cascade>.5?vec2((p.x+.69*p.y)*.65,world.y*.057+clock*.19):p*vec2(.22,.14)+vec2(0.,clock*.045*flow);',
          'float folds=fb(g*.54);float f=fb(g+vec2(folds,fb(g*.43+19.))*2.2);',
          'float seam=abs(f-.48);float aa=min(.035,fwidth(f));',
          'float crack=1.-smoothstep(.003,.023+aa,seam);',
          'float hot=1.-smoothstep(.016,.10,seam);',
          'vec3 grain=texture2D(crustPhoto,g*.57+folds*.14).rgb;',
          'vec3 skin=mix(vec3(.012,.010,.013),vec3(.063,.041,.038),folds)+grain*.44;',
          'float crust=smoothstep(.26,.59,folds);',
          'c=skin+(vec3(.42,.038,.003)*hot+vec3(1.26,.22,.013)*crack)*(.19+.81*crust);',
          'if(cascade>.5)c+=vec3(.64,.092,.008)*smoothstep(.24,.69,f);',
          '}else{',
          'float l=fb(p*.055+vec2(clock*.17,-clock*.04));',
          'float fine=1.-smoothstep(35.,175.,distance(cameraPosition,world));',
          'float a=.14*(l-.5)+fine*(.065*sin(p.x*.71+p.y*.39+clock*.71+l*4.)+.046*sin(p.y*1.27-p.x*.56+clock*1.05));',
          'float b=.14*(fb(p*.041+vec2(clock*.05,9.))-.5)+fine*.067*cos(p.y*.71-p.x*.47+clock*.68);',
          'vec3 normal=normalize(vec3(a,1.,b));',
          'float fr=.12+.80*pow(1.-max(dot(v,normal),0.),4.);',
          'vec3 reflectRay=reflect(-v,normal);',
          'float shimmer=pow(max(dot(reflectRay,normalize(lightDir)),0.),52.);',
          'vec3 refl=mix(horizon,sky,smoothstep(.06,.95,reflectRay.y));',
          'c=mix(vec3(.025,.026,.029)+vec3(.036,.024,.019)*l,refl*(.42+.49*l),fr);',
          'c+=vec3(.46,.20,.10)*shimmer*lavaLight;',
          'c*=1.-darkness*.88;',
          '}',
          'float d=distance(cameraPosition,world);float fog=1.-exp(-d*fogAmount*.51);',
          'c=mix(c,fogColor,fog*(molten>.5?.64:.88));',
          'gl_FragColor=vec4(c,1.);',
          '#include <tonemapping_fragment>',
          '#include <colorspace_fragment>',
          '}'
        ].join('\n')
      });
    }
    const fireHorizon=new THREE.Color(0xd88042);
    return {update,liquid,hemi,sun,eye,uniform,rain};
  }
  return {times,weather,build};
})();

