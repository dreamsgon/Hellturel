'use strict';
const Perception=(()=>{
  function create(renderer){
    const depth=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const target=new THREE.WebGLRenderTarget(1,1,{depthTexture:depth,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.HalfFloatType});
    const u={frame:{value:target.texture},depthMap:{value:depth},projInv:{value:new THREE.Matrix4()},
      viewInv:{value:new THREE.Matrix4()},origin:{value:new THREE.Vector3()},texel:{value:new THREE.Vector2()},
      sight:{value:0},radius:{value:0},blindRadius:{value:0},dark:{value:0},wet:{value:0},
      lamps:{value:Array.from({length:6},()=>new THREE.Vector4())},lampRange:{value:new Float32Array(6)},restore:{value:1},perspective:{value:0}};
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:u,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:[
        'varying vec2 v;uniform sampler2D frame,depthMap;uniform mat4 projInv,viewInv;',
        'uniform vec3 origin;uniform vec2 texel;uniform vec4 lamps[6];uniform float lampRange[6];uniform float sight,radius,blindRadius,dark,wet,perspective,restore;',
        'void main(){vec3 src=texture2D(frame,v).rgb;float d=texture2D(depthMap,v).r;',
        'vec4 p=projInv*vec4(v*2.-1.,d*2.-1.,1.);p=viewInv*(p/p.w);',
        'float metres=distance(p.xyz,origin);float mask=(1.-smoothstep(radius*.88,radius,metres))*step(d,.999999);',
        'float l=dot(src,vec3(.2126,.7152,.0722));',
        'float light=0.;for(int i=0;i<6;i++){vec3 delta=p.xyz-lamps[i].xyz;float d2=max(1.,dot(delta,delta));float cutoff=1.-smoothstep(.40,1.,d2*lampRange[i]);light=max(light,lamps[i].w*cutoff/d2);}',
        'float obscured=dark*(1.-smoothstep(.035,.17,l))*(1.-smoothstep(.13,.70,light));',
        'if(sight>.5&&sight<1.5){',
        'float y=pow(max(l,.0002),.72)*2.65;',
        'src=mix(src,vec3(y),mask*obscured);',
        '}else if(sight>1.5){',
        'src=mix(src,src*restore,mask*obscured);',
        '}',
        'if(blindRadius>0.){float reach=(1.-smoothstep(blindRadius*.92,blindRadius,metres))*step(d,.999999);',
        'vec3 surface=normalize(cross(dFdx(p.xyz),dFdy(p.xyz))+vec3(.000001));',
        'float paint=.04+.28*abs(dot(surface,normalize(vec3(.45,.75,.11))));',
        'float e=abs(d-texture2D(depthMap,v+vec2(texel.x,0.)).r)+abs(d-texture2D(depthMap,v+vec2(0.,texel.y)).r);',
        'float contour=smoothstep(.00006,.0007,e)*(perspective>.5?1.:.55);',
        'src+=vec3(.20,.39,.40)*reach*(paint*.17*obscured+contour*.48);',
        '}',
        'if(wet>0.)src=mix(src,wet>1.5?vec3(.28,.026,.006):vec3(.023,.058,.075),.36);',
        'gl_FragColor=vec4(src,1.);',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}'
      ].join('\n')
    }));
    const scene=new THREE.Scene(),camera=new THREE.Camera();quad.frustumCulled=false;scene.add(quad);
    function render(world,view,state,player,submerged,lights){
      const dark=state.darkness||state.time==='midnight';
      const sight=dark?['normal','darkvision','devils'].indexOf(state.sight):0;
      if(sight<=0&&!state.blindsight&&!submerged){renderer.render(world,view);return}
      const old=renderer.getRenderTarget();
      const n=old?new THREE.Vector2(old.width,old.height):renderer.getDrawingBufferSize(new THREE.Vector2());
      target.setSize(n.x,n.y);
      u.texel.value.set(1/n.x,1/n.y);
      u.sight.value=sight;u.radius.value=state.range*Elturel.ft;
      u.blindRadius.value=state.blindsight?state.blindRange*Elturel.ft:0;
      for(const slot of u.lamps.value)slot.set(0,0,0,0);
      for(const [i,lamp] of lights.entries()){
        u.lamps.value[i].set(lamp.position.x,lamp.position.y,lamp.position.z,lamp.intensity);
        u.lampRange.value[i]=lamp.distance>0?1/(lamp.distance*lamp.distance):0;
      }
      u.restore.value=(state.time==='midnight'?Avernus.times.cinder.hemi/Avernus.times.midnight.hemi:1)/(state.darkness?.07:1);
      u.projInv.value.copy(view.projectionMatrixInverse);u.viewInv.value.copy(view.matrixWorld);
      u.origin.value.copy(player);u.dark.value=dark?1:0;u.wet.value=submerged==='lava'?2:submerged?1:0;
      u.perspective.value=view.isPerspectiveCamera?1:0;
      const shadows=renderer.shadowMap.enabled;
      renderer.setRenderTarget(target);renderer.render(world,view);
      renderer.setRenderTarget(old);renderer.shadowMap.enabled=false;renderer.render(scene,camera);renderer.shadowMap.enabled=shadows;
    }
    return {render};
  }
  return {create};
})();

const AmbientAudio=(()=>{
  function create(){
    let context,master,buffers={},tracks={},wind,muted=false;
    function startup(){
      if(context){context.resume().catch(()=>{});return}
      const Type=window.AudioContext||window.webkitAudioContext;
      if(!Type)return;
      context=new Type();master=context.createGain();master.gain.value=.32;master.connect(context.destination);
      function make(seconds,callback){
        const buf=context.createBuffer(1,Math.floor(seconds*context.sampleRate),context.sampleRate);
        const a=buf.getChannelData(0),rnd=Elturel.seeded(a.length+37);
        let low=0,slow=0,crackle=0;
        for(let i=0;i<a.length;i++){
          const p=rnd()*2-1,t=i/a.length;
          low=low*.96+p*.04;slow=slow*.998+p*.002;crackle*=.94;
          if(rnd()<.00091)crackle=(rnd()-.5)*1.5;
          a[i]=callback(t,p,low,slow,crackle);
        }
        return buf;
      }
      buffers.water=make(7.6,(t,n,l,s)=>l*(.4+.34*Math.sin(t*Math.PI*14))+s*.38+n*.012);
      buffers.lava=make(9.1,(t,n,l,s,c)=>s*2.4+l*.35+c*.25);
      buffers.fire=make(8.4,(t,n,l,s,c)=>l*.22+s*.7+c*.62+n*.012);
      buffers.wind=make(13.1,(t,n,l,s)=>s*(2.1+1.5*Math.sin(t*Math.PI*6))+l*.09);
      // A short sole impact followed by the scuff or resonance of the surface.
      buffers.stone=make(.19,(t,n,l)=>Math.sin(t*69)*.47*Math.exp(-t*14)+n*.19*Math.exp(-t*24)+l*.4*Math.exp(-t*5));
      buffers.wood=make(.23,(t,n,l)=>(Math.sin(t*122)+.34*Math.sin(t*204))*.32*Math.exp(-t*9)+l*.75*Math.exp(-t*13));
      buffers.grit=make(.25,(t,n,l)=>n*.27*Math.exp(-t*8)+l*.62*Math.sin(Math.PI*t)*Math.exp(-t*3));
      buffers.stroke=make(.42,(t,n,l,s)=>Math.sin(Math.PI*t)**2*(l*.78+s*.9+n*.047));
      buffers.door=make(.68,(t,n,l,s)=>Math.sin((t*145+t*t*190)*Math.PI*2)*n*.19*Math.sin(t*Math.PI)+
        (l*.7+s*1.3)*Math.exp(-Math.abs(t-.87)*21)+n*.13*Math.exp(-t*18));
      buffers.thunder=make(3.6,(t,n,l,s,c)=>(s*6.5+l*.38+c*.3)*Math.sin(Math.min(1,t*9)*Math.PI/2)*Math.pow(1-t,2));
      for(const kind of ['water','lava','fire','wind']){
        const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
        source.buffer=buffers[kind];source.loop=true;gain.gain.value=0;
        filter.type='lowpass';filter.frequency.value=kind==='wind'?680:kind==='water'?2240:kind==='fire'?2100:890;
        source.connect(filter);filter.connect(gain);gain.connect(master);source.start(Math.random()*2);
        tracks[kind]=gain;
      }
      wind=tracks.wind;
      context.resume().catch(()=>{});
    }
    function setting(volume,silent){
      if(!context)return;
      muted=silent;master.gain.setTargetAtTime(silent?0:volume*.52,context.currentTime,.12);
    }
    function effects(state,p,world,active,indoors=false,hearth=null){
      if(!context)return;
      setting(state.volume,!active||!state.sound);
      if(muted)return;
      if(indoors){
        const crackle=hearth ? .24*Math.exp(-Math.hypot(p.x-hearth.x,p.z-hearth.z,p.y-hearth.y)*.24) : .025;
        for(const k of ['water','lava','wind','fire'])gain(k,k==='fire'?crackle:0);
        return;
      }
      const f=Elturel.fluid(p.x,p.z,p.y);
      const water=Math.min(Elturel.dist(p.x,p.z,Elturel.pond.x,Elturel.pond.z),Math.hypot(Math.max(0,Elturel.pathDistance(p.x,p.z,Elturel.river)-110),p.y+152));
      const lava=Math.min(Elturel.pathDistance(p.x,p.z,Elturel.canal),Elturel.pathDistance(p.x,p.z,Elturel.garden));
      const fire=Math.min(...world.soundFires.map(x=>Math.hypot(p.x-x.x,p.y-x.y,p.z-x.z)));
      function gain(k,v){tracks[k].gain.setTargetAtTime(v,context.currentTime,.13)}
      gain('water',f?.kind==='water'?.43:.30*Math.exp(-water*.068));
      gain('lava',f?.kind==='lava'?.41:.31*Math.exp(-lava*.065));
      gain('fire',.40*Math.exp(-fire*.101)+(state.weather==='fireRain'?.09:0));
      if(wind)gain('wind',state.weather==='ash'||state.weather==='cinders'?.20:.105);
    }
    function cue(kind,level,rate=1){
      if(!context||muted||!buffers[kind])return;
      const source=context.createBufferSource(),gain=context.createGain();gain.gain.value=level??(kind==='door'?.54:.23);
      source.buffer=buffers[kind];source.playbackRate.value=rate;source.connect(gain);gain.connect(master);
      source.onended=()=>{source.disconnect();gain.disconnect()};source.start();
    }
    return {startup,effects,setting,cue};
  }
  return {create};
})();
