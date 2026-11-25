'use strict';
(() => {
  const L=Elturel,S=AtlasSurvey,{clamp,ft}=L;
  const $=id=>document.getElementById(id);
  const canvas=$('viewport'),overlay=$('surveyCanvas'),overlayCtx=overlay.getContext('2d');
  const modes=['walk','iso','top'],sights={normal:'Normal vision',darkvision:'Darkvision',devils:'Devil’s Sight'};
  const storageKey='elturel.avernus.journey.v1',format='elturel-avernus-journey';
  const cam=new THREE.PerspectiveCamera(64,1,.085,4400),survey=new THREE.OrthographicCamera(-1,1,1,-1,.1,2700);
  const aim=new THREE.Vector3(),eye=new THREE.Vector3();
  const keys=new Set(),pointers=new Map(),audio=AmbientAudio.create();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const worldEdges={x:1540,z:1200};
  const escapeMouth={x:27,y:-7.446,z:-87.15};
  const choirDoor={x:0,y:6.096,z:1.32};
  const hallGate={x:-94,z:229.7};
  let hall=null,hallScript=null,hallRequest=0,hallLoading=false,hallLamp=null,organSession=null;
  const hallFloors={cathedral:0,choir:6.096,catacombs:-6.096};
  const inCemetery=()=>hall?.locationId==='grand-cemetery';
  const inTavern=()=>hall?.locationId==='black-antlers';
  const inHighHall=()=>hall?.locationId==='high-hall';
  const tavernPlace=L.places.find(p=>p.id==='antlers');
  const tavernHearth={x:2.11,y:.79,z:-12.13};
  const interiorTitle=()=>inTavern()?tavernPlace.name:inCemetery()?'Grand Cemetery':'High Hall';
  const interiorGate=()=>inTavern()?tavernPlace:inCemetery()?world.cemeteryGate:hallGate;
  const interiorElevation=()=>inTavern()?world.curated.antlers.y:inCemetery()?world.cemeteryGate.y:world.choirBalcony.y-choirDoor.y;
  const floorLevels=()=>hall?.levels||hallFloors;
  const hallLevel=()=>inHighHall()?(player.y>3.048?hallFloors.choir:player.y< -3.048?hallFloors.catacombs:0):hall.levelAt(player.y);
  function hallFloorName(y){
    if(inTavern())return hall.levelName(y);
    if(inCemetery())return hall.levelAt(y)===0?'Chapel':'Ossuary';
    return y>3?'Choir':y< -3?'Catacombs':'Cathedral';
  }
  function mapFloorCeiling(level){
    return inCemetery()&&level<0?-2.1:level+1.5;
  }
  const hallModules=new Map();
  let stairCameraY=null;
  let seatReturn=null,doorSettling=0;
  const surveyPointer={x:0,y:0},crosshair={x:0,y:0};
  function propView(){return state.mode==='walk'?[cam,crosshair,6]:[survey,surveyPointer,Infinity]}
  function finishProp(){
    if(!hall?.props?.active)return;
    hall.props.aim(...propView());
    if(!hall.props.commit({x:player.x,y:player.y,z:player.z,w:.48,h:height,d:.48})){toast('That spot is obstructed.');return}
    dirty=true;forces=4;details();persist();
  }
  function moveProp(){
    if(!inTavern())return;
    if(hall.props.active){finishProp();return}
    if(state.mode==='walk'&&hall.hasHeldTankard()){
      if(!hall.placeTankard(cam,player.x,player.y,player.z,player.yaw)){toast('Aim at a clear surface within reach.');return}
      toast('Tankard set down');dirty=true;details();persist();return;
    }
    if(seatReturn){toast('Stand up to move furniture.');return}
    const hit=hall.props.pick(...propView());
    if(!hit){toast('Aim at a movable object and press G.');return}
    if(hall.props.begin(hit.id,hit)){dirty=true;details()}
  }
  function loadHallModule(src){
    if(!hallModules.has(src)){
      hallModules.set(src,new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=src;
        script.onload=resolve;
        script.onerror=()=>{script.remove();hallModules.delete(src);reject(Error('Unable to load '+src))};
        document.head.append(script);
      }));
    }
    return hallModules.get(src);
  }
  function loadHallScript(){
    if(!hallScript)hallScript=Promise.all(['high-hall.js','high-hall-textures.js','high-hall-choir.js','high-hall-crypt.js'].map(loadHallModule))
      .then(()=>window.HighHall).catch(err=>{hallScript=null;throw err});
    return hallScript;
  }
  function rememberTavern(){
    if(!inTavern())return;
    state.tavernBar=hall.getBarState();
    state.tavernProps=hall.props.snapshot();
  }
  function restoreTavern(){
    if(!inTavern())return;
    hall.props.restore(state.tavernProps||{});
    hall.restoreBar(state.tavernBar||{});
  }
  function dropHall(){
    hall?.props?.cancel();rememberTavern();
    hallRequest++;hallLoading=false;stairCameraY=null;seatReturn=null;doorSettling=0;
    if(hall){for(const vista of hall.vistas.values())vista.target.dispose();hall.dispose();hall=null;hallLamp=null}
  }
  async function prepareHall(locationId='high-hall'){
    const request=++hallRequest;
    hallLoading=true;
    try{
      const module=locationId==='black-antlers'?await Promise.all(['black-antlers-props.js','black-antlers-materials.js','black-antlers.js'].map(loadHallModule)).then(()=>window.BlackAntlers):
        locationId==='grand-cemetery'?await Promise.all(['assets/cemetery-art.js','cemetery-chapel.js','cemetery-ossuary.js','grand-cemetery.js'].map(loadHallModule)).then(()=>window.GrandCemetery):await loadHallScript();
      if(request!==hallRequest)return false;
      if(hall&&hall.locationId!==locationId){
        for(const vista of hall.vistas.values())vista.target.dispose();
        hall.dispose();hall=null;
      }
      if(!hall){
        hall=locationId==='black-antlers'?module.build(world.buildingMaterials):module.build();hall.locationId=locationId;
        hallLamp=new THREE.PointLight(0xffdfae,0,12,2);hall.scene.add(hallLamp);
        hall.walkFog=hall.scene.fog;hall.indoorBackground=hall.scene.background;hall.vistas=new Map();
      }
      return true;
    }finally{if(request===hallRequest)hallLoading=false}
  }
  function atCemeteryGate(x=player.x,z=player.z){
    const gate=world?.cemeteryGate;
    return !hall&&gate&&Math.abs(z-gate.z)<1.26&&x>gate.x-.5&&x<gate.x+3&&Math.abs(player.y-gate.y)<2;
  }
  async function enterCemetery(){
    if(hall||hallLoading)return;
    try{
      if(!await prepareHall('grand-cemetery'))return;
      player={x:-.45,y:0,z:0,yaw:-Math.PI/2,pitch:player.pitch};state.flight=false;state.alignment=null;state.interior=null;
      state.extent=34;resetDoorway();toast('Grand Cemetery');
    }catch(err){clearKeys();toast(err.message)}
  }
  function leaveCemetery(){
    const gate=world.cemeteryGate,x=gate.x+1;
    dropHall();player={x,y:world.floorAt(x,gate.z,gate.y+1),z:gate.z,yaw:Math.PI/2,pitch:player.pitch};
    state.extent=151;resetDoorway();
  }
  function atHallGate(x=player.x,z=player.z){
    return !hall&&Math.abs(x-hallGate.x)<1.32&&z>hallGate.z-3&&z<hallGate.z+.5&&
      Math.abs(player.y-L.surface(hallGate.x,hallGate.z))<2;
  }
  function atTavernGate(x=player.x,z=player.z,reach=2.5){
    if(hall||!world)return false;
    const o=world.curated.antlers,dx=x-o.x,dz=z-o.z,c=Math.cos(o.angle),s=Math.sin(o.angle);
    const outward=dx*s+dz*c-o.d/2;
    return Math.abs(dx*c-dz*s)<1.04&&outward>=0&&outward<reach&&Math.abs(player.y-o.y)<1.6;
  }
  const atTaproomExit=()=>inTavern()&&Math.abs(player.x)<1.05&&player.z>-1.6&&Math.abs(player.y)<1.25;
  const atAntlersBar=()=>inTavern()&&Math.abs(player.y)<.6&&Math.hypot(player.x+7.12,player.z+3.5)<1.8;
  async function enterTavern(){
    if(hall||hallLoading)return;
    try{
      if(!await prepareHall('black-antlers'))return;
      hall.setSecretOpen(state.tavernShelfOpen,true);
      hall.setRoomDoors(state.roomDoors,true);
      restoreTavern();
      player={x:0,y:0,z:-.72,yaw:0,pitch:0};
      state.flight=false;state.alignment=null;state.interior=null;state.extent=23;
      resetDoorway();toast(tavernPlace.name);
    }catch(err){clearKeys();toast(err.message)}
  }
  function leaveTavern(){
    dropHall();player=atPlace(tavernPlace);player.yaw+=Math.PI;
    player.y=world.floorAt(player.x,player.z,player.y+.5);state.extent=151;resetDoorway();
  }
  async function enterHall(arrival=null){
    if(hall||hallLoading)return;
    try{
      if(!await prepareHall())return;
      hall.setAltarOpen?.(state.altarOpen,true);hall.setBalconyOpen?.(state.balconyOpen,true);
      player=arrival||{x:0,y:0,z:0,yaw:0,pitch:0};state.flight=false;state.alignment=null;state.interior=null;
      state.extent=34;resetDoorway(!!arrival);toast(arrival?'High Hall · '+hallFloorName(arrival.y):'High Hall');
    }catch(err){clearKeys();toast(err.message)}
  }
  function leaveHall(){
    dropHall();
    const z=hallGate.z-2.4;
    player={x:hallGate.x,y:world.floorAt(hallGate.x,z,L.surface(hallGate.x,z)+.65),z,yaw:0,pitch:0};
    state.extent=151;resetDoorway();
  }
  function crossEscape(x,z){
    const origin=hall?escapeMouth:world.escapeExit,target=hall?world.escapeExit:escapeMouth;
    if(Math.abs(x-origin.x)>1.21||Math.abs(player.y-origin.y)>1.5||
       player.z<origin.z-1.25||player.z>origin.z+.5||z>origin.z)return false;
    // Both scene axes reverse at H17. Keep the lateral offset and the distance
    // travelled in this physics step, including when walking backwards.
    const arrival={x:target.x-clamp(x-origin.x,-1.10,1.10),z:target.z+Math.max(.012,origin.z-z),
      y:target.y+Math.max(0,player.y-origin.y),yaw:(player.yaw+Math.PI)%(2*Math.PI),pitch:player.pitch};
    if(hall){
      dropHall();player=arrival;state.extent=151;resetDoorway(true);
    }else enterHall(arrival);
    return true;
  }
  function acrossChoirDoor(from,to,x,y,z){
    return {x:to.x-(x-from.x),y:to.y+(y-from.y),z:to.z-(z-from.z),
      yaw:(player.yaw+Math.PI)%(2*Math.PI),pitch:player.pitch};
  }
  function onLocalChoirPorch(x,y,z){
    return inHighHall()&&y>=choirDoor.y-.1&&y<choirDoor.y+1.3&&z>choirDoor.z&&z<=3.49&&
      Math.abs(x)<world.choirBalcony.halfWidth;
  }
  function crossChoir(x,z){
    if((hall&&!inHighHall())||state.flight||!state.balconyOpen)return false;
    const {choirBalcony}=world;
    const origin=hall?choirDoor:choirBalcony,target=hall?choirBalcony:choirDoor;
    if(Math.abs(x-origin.x)>.96||player.y<origin.y-.1||player.y+height>origin.y+2.34||
       player.z>origin.z||z<origin.z)return false;
    if((hall||world).blocked(x,origin.z-.035,player.y,height))return false;
    const arrival=acrossChoirDoor(origin,target,x,player.y,z+.017);
    if(hall){
      dropHall();player=arrival;state.extent=151;resetDoorway(true);
    }else enterHall(arrival);
    return true;
  }
  function resetDoorway(walkingThrough=false){
    if(!walkingThrough)clearKeys();
    focus={x:player.x,z:player.z};vertical=0;grounded=false;wet=submerged=null;
    didSurveyPan=false;miniStale='';dirty=true;forces=4;shadowState='';
    if(!walkingThrough)audio.cue('door');
    hud();mini();persist();
  }
  const defaultConfig={time:'cinder',weather:'haze',sight:'normal',range:60,blindsight:false,blindRange:30,darkness:false,light:false,
    sound:true,volume:.55,names:true,gmNumbers:false,mini:true,contours:false,grid:'s5',flight:false,mode:'walk',extent:151,rotation:0,alignment:null,interior:null,roomDoors:{},tavernShelfOpen:false,balconyOpen:false,altarOpen:false,altarKnown:false};
  const place=L.places[0];
  const titleState={...defaultConfig,time:'dusk'};
  let state={...defaultConfig},player=atPlace(place),focus={x:place.x,z:place.z},world,renderer,perception,chart;
  let active=false,started=false,modal='',previousFocus,escapeHeld=false;
  let ruler=[],measuring=false,pendingToast,lastTime=performance.now(),elapsed=0,frame=0,lastPersist=0;
  let wet=null,submerged=null,grounded=true,vertical=0,height=1.66,didSurveyPan=false,dirty=true,crouched=false;
  let areaView=null,miniStale='',worldStatus='',thunderAt=0,shadowState='',bootFailure=null,loadSerial=0;
  let quality=1,averageFrame=16,lastQuality=0,forces=0;
  const noteSources=[
    ['Descent into Avernus · D&D Beyond','https://www.dndbeyond.com/sources/dnd/bgdia'],
    ['Elturel Has Fallen · Chapter 2 reference','https://app.notion.com/p/enigmaticlogs/Chapter-2-Elturel-Has-Fallen-4179cb8aeab581ceb553d82ac7922686'],
    ['The Alexandrian · Elturel pointcrawl','https://thealexandrian.net/wordpress/44868/roleplaying-games/remixing-avernus-part-5c-a-pointcrawl-in-elturel'],
    ['The Alexandrian · Elturel gazetteer','https://thealexandrian.net/wordpress/44874/roleplaying-games/remixing-avernus-part-5c-b-a-very-brief-gazette-of-elturel'],
    ['The Alexandrian · Elturel locations','https://thealexandrian.net/wordpress/44881/roleplaying-games/remixing-avernus-part-5c-c-elturel-locations'],
    ['Household names · Fantasy Name Generators','https://www.fantasynamegenerators.com/english-renaissance-names.php'],
    ['Welcome to Avernus · D&D Beyond','https://www.dndbeyond.com/posts/494-live-from-the-descent-welcome-to-avernus']
  ];
  function atPlace(p){
    return {x:p.x,z:p.z,y:p.altitude??Math.max(L.terrain(p.x,p.z),bridgeAtPlace(p))+.1,yaw:Math.atan2(p.look[0]-p.x,-(p.look[1]-p.z)),pitch:p.pitch??.027};
  }
  function bridgeAtPlace(p){
    const b=L.bridges.find(b=>b.id===p.id);
    return b?L.mix(b.y1,b.y2,L.segment(p.x,p.z,[b.x1,b.z1],[b.x2,b.z2]).t):-Infinity;
  }
  function node(tag,props={},parent){
    const n=document.createElement(tag);Object.assign(n,props);parent?.append(n);return n;
  }
  function button(parent,txt,action,variant=''){
    return node('button',{type:'button',textContent:txt,className:variant,onclick:action},parent);
  }
  function optionList(select,items){
    for(const [key,name] of Object.entries(items))select.add(new Option(name,key));
  }
  function toast(message){
    $('toast').textContent=message;$('toast').hidden=false;clearTimeout(pendingToast);
    pendingToast=setTimeout(()=>$('toast').hidden=true,3500);
  }
  function saveBlob(blob,name){
    const href=URL.createObjectURL(blob),a=node('a',{href,download:name},document.body);
    a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
  }
  function saveState(){
    rememberTavern();
    return {format,version:1,...state,location:hall?.locationId||'city',player:{...player},seatReturn,focus:{...focus},weatherAge:elapsed,
      doors:Object.fromEntries(world.doors.map(d=>[d.id,d.open])),surveyDetached:didSurveyPan};
  }
  function finite(x,lo,hi,fallback){
    return Number.isFinite(x)?clamp(x,lo,hi):fallback;
  }
  function normalize(s){
    if(s?.format!==format||s.version!==1||!s.player||!s.focus)throw Error('Choose an Elturel journey file.');
    if(![s.player.x,s.player.z,s.player.y,s.player.yaw,s.player.pitch,s.focus.x,s.focus.z].every(Number.isFinite))throw Error('The journey is missing valid coordinates.');
    const cfg={...defaultConfig};
    for(const k of ['tavernBar','tavernProps'])if(s[k]&&typeof s[k]==='object')cfg[k]=s[k];
    cfg.roomDoors=Object.fromEntries(Object.entries(s.roomDoors||{}).filter(([id,v])=>/^[\w-]{1,36}$/.test(id)&&v===true));
    for(const k of ['time','weather','grid','sight','mode']){
      const values={time:Avernus.times,weather:Avernus.weather,grid:S.gridOptions,sight:sights,mode:{walk:1,iso:1,top:1}}[k];
      if(Object.hasOwn(values,s[k]))cfg[k]=s[k];
    }
    for(const k of ['darkness','light','sound','names','gmNumbers','mini','flight','contours','tavernShelfOpen','balconyOpen','altarOpen','altarKnown'])if(typeof s[k]==='boolean')cfg[k]=s[k];
    cfg.range=finite(s.range,5,1000,cfg.range);cfg.volume=finite(s.volume,0,1,cfg.volume);
    cfg.blindsight=s.sight==='blindsight'||s.blindsight===true;
    cfg.blindRange=finite(s.blindRange,5,1000,s.sight==='blindsight'?cfg.range:cfg.blindRange);
    cfg.extent=finite(s.extent,3,1650,cfg.extent);cfg.rotation=finite(s.rotation,-100,100,0);
    if(typeof s.alignment==='string'&&world?.worldObjects.some(o=>o.id===s.alignment))cfg.alignment=s.alignment;
    if(typeof s.interior==='string'&&world?.curated[s.interior]?.roof)cfg.interior=s.interior;
    return {location:['grand-cemetery','high-hall','black-antlers'].includes(s.location)?s.location:'city',state:cfg,player:{x:clamp(s.player.x,-worldEdges.x,worldEdges.x),z:clamp(s.player.z,-worldEdges.z,worldEdges.z),y:clamp(s.player.y,-187,730),
      yaw:s.player.yaw%(Math.PI*2),pitch:clamp(s.player.pitch,-1.44,1.44)},focus:{x:clamp(s.focus.x,-1750,1750),z:clamp(s.focus.z,-1480,1480)},
      seatReturn:s.seatReturn&&['x','y','z','yaw'].every(k=>Number.isFinite(s.seatReturn[k]))?s.seatReturn:null,
      elapsed:finite(s.weatherAge,0,1e7,0),doors:s.doors&&typeof s.doors==='object'?s.doors:{},detached:!!s.surveyDetached};
  }
  function stored(){
    try{return normalize(JSON.parse(localStorage.getItem(storageKey)))}catch{return null}
  }
  function persist(){
    if(!active||!started||!world||hallLoading)return;
    try{localStorage.setItem(storageKey,JSON.stringify(saveState()))}catch{/* Portable JSON is still available. */}
  }
  function saveFile(){
    persist();
    saveBlob(new Blob([JSON.stringify(saveState(),null,2)],{type:'application/json'}),'Elturel-journey.json');
    toast('Journey saved');
  }
  function showTitle(){
    persist();dropHall();release();active=false;$('hud').hidden=true;$('title').hidden=false;
    $('continue').hidden=!stored();$('continue').disabled=false;
    audio.setting(state.volume,true);closePanel(false);dirty=true;
  }
  async function arrive(s){
    if(!world)return;
    if(s&&s.location!=='city'){
      try{if(!await prepareHall(s.location))return false}catch(err){toast(err.message);return false}
    }else dropHall();
    seatReturn=null;doorSettling=0;audio.startup();release();closePanel(false);
    if(s){
      ({state,player,focus,elapsed}=s);didSurveyPan=s.detached;
      if(hall){
        state.flight=false;stairCameraY=null;
        hall.setSecretOpen?.(state.tavernShelfOpen,true);
        hall.setRoomDoors?.(state.roomDoors,true);
        restoreTavern();
        if(inTavern()&&s.seatReturn&&s.state.mode==='walk'){
          const r=s.seatReturn,seat=hall.seatNear(r.x,r.y,r.z,r.yaw);
          if(seat&&Math.hypot(player.x-seat.x,player.y-seat.y,player.z-seat.z)<.25&&!hall.blocked(r.x,r.z,r.y,1.66)){
            seatReturn=r;height=seat.eyeHeight||1.19;
          }
        }
        hall.setAltarOpen?.(state.altarOpen,true);hall.setBalconyOpen?.(state.balconyOpen,true);
        // A saved burial chamber position can now lie inside a rebuilt wall.
        if(!seatReturn&&hall.blocked(player.x,player.z,player.y,1.04)){
          const lower=inHighHall()&&player.y< -3;
          player.x=lower?7.5:0;player.z=lower?-47.5:0;player.y=lower?-6.096:0;
          focus={x:player.x,z:player.z};didSurveyPan=false;
        }
      }
      for(const d of world.doors){d.open=s.doors[d.id]===true;d.angle=d.open?-Math.PI*.53:0;d.pivot.rotation.y=d.o.angle+d.angle}
    }else{
      state={...defaultConfig};player=atPlace(place);focus={x:place.x,z:place.z};elapsed=0;didSurveyPan=false;
      player.y=world.floorAt(player.x,player.z,player.y+.25);
      for(const d of world.doors){d.open=false;d.angle=0;d.pivot.rotation.y=d.o.angle}
    }
    if(hall&&onLocalChoirPorch(player.x,player.y,player.z)){
      player=acrossChoirDoor(choirDoor,world.choirBalcony,player.x,player.y,player.z);
      dropHall();focus={x:player.x,z:player.z};didSurveyPan=false;state.extent=151;
    }
    world.setBalconyOpen(state.balconyOpen,true);
    active=started=true;thunderAt=elapsed;grounded=false;vertical=0;wet=submerged=null;ruler=[];measuring=false;miniStale='';
    $('title').hidden=true;$('hud').hidden=false;canvas.focus();
    hud();mini();persist();dirty=true;forces=4;
  }
  function openLoad(){audio.startup();$('saveFile').click()}
  $('saveFile').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';
    if(!f)return;
    const request=++loadSerial;
    try{
      if(f.size>262144)throw Error('The journey file is too large.');
      const raw=JSON.parse(await f.text());await ready;
      if(request!==loadSerial)return;
      if(bootFailure)throw Error('Elturel could not load.');
      if(await arrive(normalize(raw))!==false)toast('Journey restored');
    }catch(err){toast(err instanceof SyntaxError?'Could not read the journey file.':err.message)}
  };

  let strideDistance=0;
  function clearKeys(){strideDistance=0;keys.clear();pointers.clear()}
  function release(){
    clearKeys();
    if(document.pointerLockElement===canvas){
      document.exitPointerLock();
    }
  }
  function tryLook(){
    if(!active||modal||state.mode!=='walk')return;
    if(document.pointerLockElement===canvas){release();return}
    canvas.focus();
    try{const p=canvas.requestPointerLock?.();p?.catch(()=>toast('Drag the landscape to look around.'))}
    catch{toast('Drag the landscape to look around.')}
  }
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement!==canvas)clearKeys();
    hud();
  });
  function panel(title,type,wide=false){
    hall?.props?.cancel();
    if(organSession){organSession.dispose();organSession=null}
    if(!modal)previousFocus=document.activeElement;
    release();modal=type;areaView=null;
    $('veil').hidden=false;$('dialogTitle').textContent=title;$('dialog').classList.toggle('wide',wide);
    const body=$('dialogBody');body.replaceChildren();$('close').focus();return body;
  }
  function closePanel(restore=true){
    if(!modal)return;
    if(organSession){organSession.dispose();organSession=null}
    modal='';areaView=null;$('veil').hidden=true;
    if(restore)(active?canvas:previousFocus)?.focus?.();
    dirty=true;
  }
  function menu(){
    if(!active)return;
    const b=panel('Journey','menu'),rows=node('div',{className:'rows'},b);
    button(rows,'Resume journey',()=>closePanel(),'option primary');
    button(rows,'Save journey to file',saveFile,'option');
    button(rows,'Load save file',openLoad,'option');
    button(rows,'Controls',controls,'option');
    button(rows,'Return to title screen',showTitle,'option secondary');
  }
  function notes(){
    const b=panel('Field notes','notes');
    node('p',{textContent:'This survey depicts Elturel after the Fall. The Companion hangs black over the city, and eight chains descend to the Styx. Torm’s Reach and Torm’s Blade are the principal crossings of the rift.'},b);
    node('p',{textContent:'The bluff, lava canals, Shiarra’s Market and western switchback follow the Alexandrian Remix. Vesh House, Bell’s Wash Yard, Orrel Stair and the connecting lanes are original. The survey uses metres internally and measures encounter distances in feet.'},b);
    const list=node('ul',{},b);
    for(const [name,href] of noteSources)node('a',{textContent:name,href,target:'_blank',rel:'noopener noreferrer'},node('li',{},list));
  }
  function controls(){
    const b=panel('Controls','controls');
    for(const p of [
      'WASD to walk. Shift runs, Space jumps, and C crouches. F toggles flight. W and S fly forward and backward, Shift flies faster, and Space and C change altitude.',
      'In water or lava, swim with WASD. Hold Shift for a faster stroke, Space to rise, or C to dive. Press E at an interactive door. T toggles your light.',
      'Click the landscape or press V to capture the mouse. V frees the cursor. You can also drag to look while the cursor is free. Esc opens the journey menu.',
      'Press M for the area map and K for the minimap. 1, 2 and 3 switch cameras. Drag to pan in survey views, scroll to zoom, and use the ruler to measure ground distance and bearing.',
      'In Top-down, double-click a roof to frame the building. Align building rotates the view and grid. VTT export captures the current area with your chosen dimensions and lighting.'
    ])node('p',{textContent:p},b);
  }
  function field(parent,title,input){
    const row=node('label',{className:'field'},parent);node('span',{textContent:title},row);row.append(input);return row;
  }
  function selectField(parent,title,values,value,change,id=''){
    const input=node('select',{id});optionList(input,values);input.value=value;
    field(parent,title,input);input.onchange=()=>change(input.value);return input;
  }
  function checkField(parent,title,value,change,id=''){
    const input=node('input',{type:'checkbox',checked:value,id});field(parent,title,input);input.onchange=()=>change(input.checked);return input;
  }
  function numField(parent,title,value,min,max,step,change,id=''){
    const input=node('input',{type:'number',value,min,max,step,id});field(parent,title,input);
    if(change)input.onchange=()=>{const n=finite(input.valueAsNumber,min,max,value);input.value=n;change(n)};
    return input;
  }
  function setting(key,value){
    if(key==='flight'&&hall)return;
    state[key]=value;dirty=true;miniStale='';shadowState='';hud();mini();persist();forces=3;
  }
  function environment(){
    const b=panel('World settings','world'),f=node('div',{className:'fields'},b);
    selectField(f,'Lighting',Object.fromEntries(Object.entries(Avernus.times).map(([id,v])=>[id,v.label])),state.time,v=>setting('time',v),'worldTime');
    selectField(f,'Weather',Object.fromEntries(Object.entries(Avernus.weather).map(([id,v])=>[id,v.label])),state.weather,v=>setting('weather',v),'worldWeather');
    checkField(f,'Darkness',state.darkness,v=>setting('darkness',v),'worldDarkness');
    checkField(f,'Portable light',state.light,v=>setting('light',v),'worldLight');
    selectField(f,'Character sight',sights,state.sight,v=>setting('sight',v),'worldSight');
    numField(f,'Sight range (feet)',state.range,5,1000,5,v=>setting('range',v),'worldRange');
    checkField(f,'Blindsight',state.blindsight,v=>setting('blindsight',v),'worldBlindsight');
    numField(f,'Blindsight range (feet)',state.blindRange,5,1000,5,v=>setting('blindRange',v),'worldBlindRange');
    checkField(f,'Place names',state.names,v=>setting('names',v),'worldNames');
    checkField(f,'Minimap',state.mini,v=>setting('mini',v),'worldMinimap');
    checkField(f,'Ambient audio',state.sound,v=>setting('sound',v),'worldAudio');
    const volume=node('input',{type:'range',min:0,max:1,step:.05,value:state.volume,id:'worldVolume'});
    field(f,'Volume',volume);volume.oninput=()=>setting('volume',Number(volume.value));
    node('p',{className:'caption',textContent:'Darkvision shows unlit surfaces in gray. Blindsight traces surfaces within range. Devil’s Sight preserves color in darkness.'},b);
  }


  // The city key belongs to this explorer. Interior rooms use their published keys.
  const cityKey=Object.fromEntries(L.places.map((place,i)=>[place.id,i+1]));
  function cityMapLabel(p){
    return [state.gmNumbers&&cityKey[p.id]?'#'+cityKey[p.id]:'',state.names?p.name:''].filter(Boolean).join(' · ');
  }
  function roomMapLabel(r){
    const embedded=/^([A-Z]+\d+)\s*(?:·\s*)?(.*)$/.exec(r.label||'');
    const key=embedded?.[1]||(/^H\d+$/.test(r.id)?r.id:''),name=embedded?embedded[2]:r.label;
    return {key:state.gmNumbers?key:'',name:state.names?name:''};
  }
  const households=new Map(L.places.filter(p=>p.keepsake).map(p=>[p.id,p]));
  const mapPoints=()=>state.names?L.places:L.places.filter(p=>!p.keepsake&&!['vesh','yard','stair'].includes(p.id));
  function drawChart(target,view,small=false){
    const ctx=target.getContext('2d'),w=target.width,h=target.height;
    const scale=Math.min(w/1200,h/850)*view.zoom;
    function projection(x,z){return [w/2+(x-view.x)*scale,h/2+(z-view.z)*scale]}
    function inverse(x,z){return [view.x+(x-w/2)/scale,view.z+(z-h/2)/scale]}
    const [ox,oz]=projection(-600,-425);
    ctx.fillStyle='#211b1e';ctx.fillRect(0,0,w,h);
    ctx.beginPath();
    L.river.forEach(([x,z],i)=>{const p=projection(x,z);if(i)ctx.lineTo(...p);else ctx.moveTo(...p)});
    ctx.strokeStyle='#383239';ctx.lineWidth=245*scale;ctx.stroke();
    ctx.drawImage(chart.base,ox,oz,1200*scale,850*scale);
    if(!small&&state.contours)ctx.drawImage(chart.contours,ox,oz,1200*scale,850*scale);
    ctx.save();ctx.setLineDash([4*scale,2*scale]);ctx.lineWidth=Math.max(.6,1.9*scale);ctx.strokeStyle='#a1897b';
    for(const [x,z,dx,dz] of L.chains){
      const anchor=projection(x+dx,z+dz);
      ctx.beginPath();ctx.moveTo(...projection(x*.95,z*.95));ctx.lineTo(...anchor);ctx.stroke();
      ctx.fillStyle='#ba9a82';ctx.fillRect(anchor[0]-1,anchor[1]-1,2,2);
    }
    ctx.restore();
    const spec=S.gridSpec(state.grid,1200/view.zoom),m=spec.feet*ft;
    if(!small&&m>0){
      ctx.save();ctx.strokeStyle='#eec4a51c';ctx.lineWidth=.75;ctx.beginPath();
      const [loX,loZ]=inverse(0,0),[hiX,hiZ]=inverse(w,h);
      if(m*scale>=6){
        if(spec.hex){
          const radius=m/Math.sqrt(3),spacing=radius*1.5;
          const vertices=Array.from({length:6},(_,i)=>[radius*Math.cos(Math.PI/6+i*Math.PI/3),radius*Math.sin(Math.PI/6+i*Math.PI/3)]);
          for(let j=Math.floor(loZ/spacing)-1;j<Math.ceil(hiZ/spacing)+1;j++){
            for(let i=Math.floor(loX/m)-1;i<Math.ceil(hiX/m)+1;i++){
              const x=(i+(j%2?.5:0))*m,z=j*spacing;
              ctx.moveTo(...projection(x+vertices[0][0],z+vertices[0][1]));
              for(let k=1;k<=3;k++)ctx.lineTo(...projection(x+vertices[k][0],z+vertices[k][1]));
            }
          }
        }else{
          for(let x=Math.floor(loX/m)*m;x<hiX;x+=m){const a=projection(x,0)[0];ctx.moveTo(a,0);ctx.lineTo(a,h)}
          for(let z=Math.floor(loZ/m)*m;z<hiZ;z+=m){const a=projection(0,z)[1];ctx.moveTo(0,a);ctx.lineTo(w,a)}
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    const pois=[];
    for(const p of mapPoints()){
      const [x,y]=projection(p.x,p.z),selected=view.selected?.id===p.id;
      if(x<3||y<3||x>w-3||y>h-3)continue;
      pois.push({x,y,p});
      if(small&&view.zoom<1.35&&!['hall','cemetery','market','dock','reach','blade'].includes(p.id))continue;
      ctx.beginPath();ctx.arc(x,y,selected?7:small?3.4:4.5,0,Math.PI*2);ctx.fillStyle=selected?'#fff0cf':'#da9d76';
      ctx.strokeStyle='#302023';ctx.lineWidth=2;ctx.fill();ctx.stroke();
    }
    if(!small&&(state.names||state.gmNumbers)){
      const labels=view.zoom>1.55?mapPoints():mapPoints().filter(p=>['hall','cemetery','market','dock','reach','blade','leap','lava-docks','shieldhall','west-docks'].includes(p.id));
      ctx.font='600 '+(view.zoom>1.55?13:12)+'px system-ui';
      for(const p of labels){
        if(p.id===view.selected?.id&&!state.gmNumbers)continue;
        const [x,y]=projection(p.x,p.z);
        if(x<3||y<3||x>w-3||y>h-3)continue;
        const label=cityMapLabel(p);
        const dx=['cemetery','lava-docks','hall'].includes(p.id)?-ctx.measureText(label).width-8:8;
        ctx.lineWidth=3.5;ctx.strokeStyle='#332222';ctx.strokeText(label,x+dx,y-6);ctx.fillStyle='#eee1d2';ctx.fillText(label,x+dx,y-6);
      }
    }
    const mark=view.selected;
    if(mark&&!mark.id){
      const [x,y]=projection(mark.x,mark.z);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);
      ctx.fillStyle='#ffdfb2';ctx.fill();ctx.strokeStyle='#3e2a2b';ctx.lineWidth=2;ctx.stroke();
    }
    const [px,py]=projection(hall?interiorGate().x:player.x,hall?interiorGate().z:player.z);
    playerMarker(ctx,px,py,cityBearing());
    if(!small){
      ctx.font='700 12px system-ui';ctx.strokeStyle='#221920';ctx.fillStyle='#ffe0ae';ctx.lineWidth=3;
      ctx.strokeText('↑ N',14,21);ctx.fillText('↑ N',14,21);
      const length=(view.zoom>2.7?100:500)*ft*scale,feet=view.zoom>2.7?100:500;
      ctx.beginPath();ctx.moveTo(14,h-17);ctx.lineTo(14+length,h-17);ctx.strokeStyle='#f4ce9b';ctx.lineWidth=1.4;ctx.stroke();ctx.fillText(feet+' ft',14,h-23);
    }
    return {projection,inverse,scale,pois};
  }
  function localNorth(){return inHighHall()?Math.PI:inTavern()?world.curated.antlers.angle:0}
  function cityBearing(){return player.yaw-localNorth()}
  function playerMarker(ctx,x,y,yaw){
    ctx.save();ctx.translate(x,y);ctx.rotate(yaw);
    if(state.mode==='walk'){
      const angle=Math.atan(Math.tan(cam.fov*Math.PI/360)*cam.aspect);
      const fade=ctx.createRadialGradient(0,0,4,0,0,36);
      fade.addColorStop(0,'rgba(232,214,252,.48)');fade.addColorStop(1,'rgba(232,214,252,.04)');
      ctx.fillStyle=fade;ctx.beginPath();ctx.moveTo(0,0);
      ctx.arc(0,0,36,-Math.PI/2-angle,-Math.PI/2+angle);ctx.closePath();ctx.fill();
    }
    ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(-5,6);ctx.lineTo(0,3);ctx.lineTo(5,6);ctx.closePath();
    ctx.fillStyle='#d2bdff';ctx.strokeStyle='#211a26';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();
  }
  function mini(){
    if(!world||!active||!state.mini)return;
    const key=[state.mode,cam.aspect,hall?.locationId,hall?hallLevel():0,Math.round(player.x/2),Math.round(player.z/2),Math.round(player.yaw*14),state.names].join(':');
    if(key===miniStale)return;
    miniStale=key;
    if(hall){drawHallMini($('miniCanvas'));return}
    const outside=Math.abs(player.x)>530||Math.abs(player.z)>360;
    drawChart($('miniCanvas'),outside?{x:player.x*.5,z:player.z*.5,zoom:Math.min(1,800/(Math.abs(player.x)+1),520/(Math.abs(player.z)+1))}:{x:player.x,z:player.z,zoom:2.30},true);
  }
  function mapFloorShape(ctx,r,project){
    const points=r.polygon||[[r.xmin,r.zmin],[r.xmax,r.zmin],[r.xmax,r.zmax],[r.xmin,r.zmax]];
    ctx.beginPath();for(const ring of [points,...(r.holes||[])]){ring.forEach(([x,z],i)=>ctx[i?'lineTo':'moveTo'](...project(x,z)));ctx.closePath()}ctx.fill('evenodd');
  }
  function drawHallMini(target){
    const ctx=target.getContext('2d'),w=target.width,h=target.height,level=hallLevel(),scale=Math.min(w,h)/48;
    const project=(x,z)=>[w/2+(x-player.x)*scale,h/2+(z-player.z)*scale];
    ctx.fillStyle='#211b1e';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#56453d';ctx.strokeStyle='#aa9281';ctx.lineWidth=1.2;
    for(const r of hall.mapRects(level,state.altarKnown)){
      const [x,z]=project(r.xmin,r.zmin),width=(r.xmax-r.xmin)*scale,depth=(r.zmax-r.zmin)*scale;
      mapFloorShape(ctx,r,project);if(!r.polygon)ctx.strokeRect(x,z,width,depth);
    }
    ctx.fillStyle='#bdab96';
    for(const o of hall.mapSolids||[]){
      if(o.y>=mapFloorCeiling(level)+.35||o.y+o.h<level+.1)continue;
      ctx.save();ctx.translate(...project(o.x,o.z));ctx.rotate(-o.ry);
      ctx.fillRect(-o.w*scale/2,-o.d*scale/2,o.w*scale,o.d*scale);ctx.restore();
    }
    playerMarker(ctx,w/2,h/2,player.yaw);
    if(state.names){
      ctx.fillStyle='#eee1d2';ctx.font='600 11px system-ui';
      ctx.fillText(interiorTitle().toUpperCase()+' · '+hallFloorName(level).toUpperCase(),8,15);
    }
  }
  function travel(p){
    if(!p)return;
    dropHall();
    player=p.look?atPlace(p):{...player,x:p.x,z:p.z,y:L.terrain(p.x,p.z)+.10};
    if(p.altitude===undefined)player.y=world.floorAt(player.x,player.z,player.y+.67);
    if(world.blocked(player.x,player.z,player.y,1.65)){
      let safe=null;
      for(let radius=1;radius<=8&&!safe;radius++)for(let i=0;i<16;i++){
        const a=i*Math.PI/8,x=p.x+radius*Math.cos(a),z=p.z+radius*Math.sin(a);
        const y=world.floorAt(x,z,L.surface(x,z)+.6),f=L.fluid(x,z);
        if(y>-15&&(!f||y>=f.y)&&!world.blocked(x,z,y,1.65)){safe={x,z,y};break}
      }
      if(safe)Object.assign(player,safe);
      else Object.assign(player,atPlace(L.places[0]));
    }
    closePanel();focus={x:player.x,z:player.z};didSurveyPan=false;state.interior=null;state.alignment=null;
    state.flight=p.altitude!==undefined;
    if(state.flight)state.mode='walk';
    vertical=0;grounded=false;wet=submerged=null;ruler=[];measuring=false;dirty=true;forces=4;
    persist();hud();mini();toast(state.names&&p.name?p.name:'Position updated');
  }
  function hallArea(){
    const b=panel(interiorTitle()+' map','area',true),layout=node('div',{className:'map-layout'},b);
    const frame=node('div',{className:'map-sheet'},layout),map=node('canvas',{id:'areaCanvas',width:900,height:630,tabIndex:0},frame);
    map.setAttribute('aria-label',interiorTitle()+' floor map with selectable destinations');
    const zoom=node('div',{className:'map-keys'},frame),controls=node('div',{className:'map-controls'},layout);
    const view={x:player.x,z:player.z,zoom:1,level:hallLevel(),selected:null};areaView=view;
    const title=node('h3',{textContent:interiorTitle()},controls);
    const floors=Object.fromEntries(Object.entries(floorLevels()).map(([k,v])=>[String(v),hallFloorName(v)]));
    selectField(controls,'Floor',floors,String(view.level),v=>{view.level=Number(v);view.selected=null;go.disabled=true;description.textContent='Select open floor to travel.';fit();draw()},'hallMapFloor');
    const description=node('p',{className:'muted',textContent:'Select open floor to travel.'},controls);
    const go=button(controls,'Travel within '+interiorTitle(),()=>{
      if(!view.selected)return;
      const {x,z,y}=view.selected;
      if(hall.blocked(x,z,y,1.66)){description.textContent='That position is obstructed.';return}
      seatReturn=null;player.x=x;player.z=z;player.y=y;focus={x,z};state.mode='walk';state.flight=false;
      vertical=0;grounded=false;wet=submerged=null;ruler=[];measuring=false;didSurveyPan=false;
      closePanel();miniStale='';dirty=true;forces=4;persist();hud();mini();toast('Position updated');
    },'primary');go.id='travelNow';go.disabled=true;
    button(controls,'Show city map',()=>{closePanel(false);area(true)},'secondary');
    selectField(controls,'Grid',S.gridOptions,state.grid,v=>{setting('grid',v);draw()},'areaGrid');
    checkField(controls,'GM reference numbers',state.gmNumbers,v=>{setting('gmNumbers',v);draw()},'areaGMNumbers');
    let projection=null,drag=null;
    function fit(){
      const rooms=hall.mapRects(view.level,state.altarKnown);
      if(!rooms.length)return;
      view.x=(Math.min(...rooms.map(r=>r.xmin))+Math.max(...rooms.map(r=>r.xmax)))/2;
      view.z=(Math.min(...rooms.map(r=>r.zmin))+Math.max(...rooms.map(r=>r.zmax)))/2;
      view.zoom=1;
    }
    function draw(){
      if(areaView!==view)return;
      const ctx=map.getContext('2d'),w=map.width,h=map.height,rooms=hall.mapRects(view.level,state.altarKnown);
      const width=Math.max(15,Math.max(...rooms.map(r=>r.xmax))-Math.min(...rooms.map(r=>r.xmin)));
      const depth=Math.max(15,Math.max(...rooms.map(r=>r.zmax))-Math.min(...rooms.map(r=>r.zmin)));
      const scale=Math.min((w-90)/width,(h-90)/depth)*view.zoom;
      const project=(x,z)=>[w/2+(x-view.x)*scale,h/2+(z-view.z)*scale];
      const inverse=(x,z)=>[view.x+(x-w/2)/scale,view.z+(z-h/2)/scale];
      ctx.fillStyle='#211b1e';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#56453d';ctx.strokeStyle='#c5aa91';ctx.lineWidth=2;
      for(const r of rooms)mapFloorShape(ctx,r,project);
      const spec=S.gridSpec(state.grid,Math.max(width,depth)/view.zoom),unit=spec.feet*ft;
      if(unit>0&&unit*scale>=6){
        ctx.save();ctx.strokeStyle='#f2d7ba30';ctx.lineWidth=1;ctx.beginPath();
        const [x0,z0]=inverse(0,0),[x1,z1]=inverse(w,h);
        if(spec.hex){
          const radius=unit/Math.sqrt(3),spacing=radius*1.5;
          for(let j=Math.floor(z0/spacing)-1;j<=Math.ceil(z1/spacing)+1;j++)for(let i=Math.floor(x0/unit)-1;i<=Math.ceil(x1/unit)+1;i++){
            const x=(i+(j%2?.5:0))*unit,z=j*spacing;
            for(let k=0;k<=6;k++){const a=Math.PI/6+k*Math.PI/3,p=project(x+radius*Math.cos(a),z+radius*Math.sin(a));if(k)ctx.lineTo(...p);else ctx.moveTo(...p)}
          }
        }else{
          for(let x=Math.floor(x0/unit)*unit;x<=x1;x+=unit){const px=project(x,0)[0];ctx.moveTo(px,0);ctx.lineTo(px,h)}
          for(let z=Math.floor(z0/unit)*unit;z<=z1;z+=unit){const pz=project(0,z)[1];ctx.moveTo(0,pz);ctx.lineTo(w,pz)}
        }
        ctx.stroke();ctx.restore();
      }
      ctx.fillStyle='#b3a08d';
      for(const o of hall.mapSolids||[]){
        if(o.y>=mapFloorCeiling(view.level)+.35||o.y+o.h<view.level+.1)continue;
        ctx.save();ctx.translate(...project(o.x,o.z));ctx.rotate(-o.ry);ctx.fillRect(-o.w*scale/2,-o.d*scale/2,o.w*scale,o.d*scale);ctx.restore();
      }
      if(state.names||state.gmNumbers){
        ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#f4e5d4';ctx.strokeStyle='#32241e';ctx.lineWidth=3;
        for(const r of rooms){
          if(!r.label)continue;
          const {key,name}=roomMapLabel(r);
          let label=[key,name].filter(Boolean).join(' · ');
          const available=(r.xmax-r.xmin)*scale;
          if(ctx.measureText(label).width+8>available)label=key;
          if(!label||ctx.measureText(label).width+3>available||(r.zmax-r.zmin)*scale<13)continue;
          const [x,z]=project((r.xmin+r.xmax)/2,(r.zmin+r.zmax)/2);
          ctx.strokeText(label,x,z);ctx.fillText(label,x,z);
        }
        ctx.textAlign='start';
      }
      if(view.level===hallLevel()){
        playerMarker(ctx,...project(player.x,player.z),player.yaw);
      }
      if(view.selected){ctx.beginPath();ctx.arc(...project(view.selected.x,view.selected.z),6,0,Math.PI*2);ctx.fillStyle='#ffdfb2';ctx.fill()}
      ctx.fillStyle='#eee1d2';ctx.font='600 14px system-ui';ctx.fillText(inHighHall()?'↓ N':'↑ N',14,22);ctx.fillText(hallFloorName(view.level),14,h-16);
      const bar=20*ft*scale;ctx.strokeStyle='#f4ce9b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w-25-bar,h-22);ctx.lineTo(w-25,h-22);ctx.stroke();ctx.textAlign='right';ctx.fillText('20 ft',w-25,h-29);ctx.textAlign='start';
      projection={project,inverse,scale};
    }
    function mouse(e){const r=map.getBoundingClientRect();return [(e.clientX-r.left)*map.width/r.width,(e.clientY-r.top)*map.height/r.height]}
    function zoomAt(mult,x=map.width/2,y=map.height/2){
      if(mult<1&&view.zoom*mult<.5){closePanel(false);area(true);return}
      const before=projection.inverse(x,y);view.zoom=clamp(view.zoom*mult,.5,6);draw();const after=projection.inverse(x,y);
      view.x+=before[0]-after[0];view.z+=before[1]-after[1];draw();
    }
    button(zoom,'−',()=>zoomAt(.8)).setAttribute('aria-label','Zoom floor map out');
    button(zoom,'+',()=>zoomAt(1.25)).setAttribute('aria-label','Zoom floor map in');
    button(zoom,'⌖',()=>{fit();draw()}).setAttribute('aria-label','Fit current floor');
    map.addEventListener('wheel',e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0017),...mouse(e))},{passive:false});
    map.onpointerdown=e=>{drag={start:mouse(e),last:mouse(e),moved:false};map.setPointerCapture(e.pointerId)};
    map.onpointermove=e=>{if(!drag)return;const p=mouse(e);if(!drag.moved&&Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])<4)return;view.x-=(p[0]-drag.last[0])/projection.scale;view.z-=(p[1]-drag.last[1])/projection.scale;drag.last=p;drag.moved=true;draw()};
    map.onpointerup=e=>{
      if(!drag)return;
      if(!drag.moved){
        const [x,z]=projection.inverse(...mouse(e)),y=hall.floorAt(x,z,mapFloorCeiling(view.level));
        const visible=hall.mapRects(view.level,state.altarKnown).some(r=>x>=r.xmin&&x<=r.xmax&&z>=r.zmin&&z<=r.zmax);
        const valid=visible&&Number.isFinite(y)&&(inCemetery()?hall.levelAt(y)===view.level:Math.abs(y-view.level)<1.6)&&!onLocalChoirPorch(x,y,z)&&!hall.blocked(x,z,y,1.66);
        view.selected=valid?{x,z,y}:null;go.disabled=!valid;
        title.textContent=valid?'Selected position':interiorTitle();description.textContent=valid?'Travel to open floor on the '+hallFloorName(view.level)+'.':'Choose open floor on this level.';draw();
      }
      drag=null;
    };
    map.onpointercancel=()=>drag=null;fit();draw();
  }
  function area(city=false){
    city=city===true;
    if(!active)return;
    if(modal==='area'){closePanel();return}
    if(hall&&!city){hallArea();return}
    const b=panel('Area map','area',true),layout=node('div',{className:'map-layout'},b);
    const frame=node('div',{className:'map-sheet'},layout),map=node('canvas',{id:'areaCanvas',width:900,height:630,tabIndex:0},frame);
    map.setAttribute('aria-label','Map of Elturel with quick travel markers');
    const zoom=node('div',{className:'map-keys'},frame);
    const controls=node('div',{className:'map-controls'},layout);
    if(hall)button(controls,'Show '+interiorTitle()+' map',()=>{closePanel(false);hallArea()},'secondary');
    const dest=node('h3',{textContent:'Quick travel'},controls);
    const sel=node('select',{id:'travelDestination'},controls);
    sel.setAttribute('aria-label','Quick travel destination');sel.add(new Option('Choose a location',''));
    function refreshChoices(){
      const selected=sel.value;
      sel.length=1;
      mapPoints().forEach((p,i)=>sel.add(new Option(cityMapLabel(p)||'Location '+(i+1),p.id)));
      sel.value=selected;
    }
    refreshChoices();
    const desc=node('p',{className:'muted',textContent:'Choose a destination or select a point on the map.'},controls);
    const go=button(controls,'Quick travel',()=>travel(view.selected),'primary');go.id='travelNow';go.disabled=true;
    selectField(controls,'Grid',S.gridOptions,state.grid,v=>{setting('grid',v);draw()},'areaGrid');
    checkField(controls,'GM reference numbers',state.gmNumbers,v=>{setting('gmNumbers',v);refreshChoices();choose(view.selected)},'areaGMNumbers');
    checkField(controls,'25 ft elevation contours',state.contours,v=>{setting('contours',v);draw()},'areaContours');
    const view=hall&&city?{x:interiorGate().x,z:interiorGate().z,zoom:3.6,selected:null}:{x:0,z:-8,zoom:1.08,selected:null};areaView=view;
    let projection=null,drag=null;
    function draw(){if(areaView===view)projection=drawChart(map,view)}
    function choose(p){
      view.selected=p;sel.value=p?.id||'';
      dest.textContent=p?(cityMapLabel(p)||'Selected position'):'Quick travel';
      desc.textContent=p?(state.names&&p.note?p.note:'Travel to the selected point.'): 'Choose a destination or select a point on the map.';
      if(p)desc.textContent+=' Elevation '+Math.round(((p.altitude??Math.max(world.bridgeSurface(p.x,p.z),L.terrain(p.x,p.z)))+152.4)/ft).toLocaleString()+' ft above the Styx.';
      go.disabled=!p;draw();
    }
    function zoomAt(mult,x=map.width/2,y=map.height/2){
      const p=projection.inverse(x,y);
      view.zoom=clamp(view.zoom*mult,.85,7.5);draw();
      const q=projection.inverse(x,y);
      view.x=clamp(view.x+p[0]-q[0],-worldEdges.x,worldEdges.x);view.z=clamp(view.z+p[1]-q[1],-worldEdges.z,worldEdges.z);draw();
    }
    function mouse(e){
      const r=map.getBoundingClientRect();return [(e.clientX-r.left)*map.width/r.width,(e.clientY-r.top)*map.height/r.height];
    }
    button(zoom,'−',()=>zoomAt(.8)).setAttribute('aria-label','Zoom area map out');
    button(zoom,'+',()=>zoomAt(1.25)).setAttribute('aria-label','Zoom area map in');
    button(zoom,'⌖',()=>{view.x=hall?interiorGate().x:player.x;view.z=hall?interiorGate().z:player.z;view.zoom=2.2;draw()}).setAttribute('aria-label','Center on my position');
    sel.onchange=()=>{
      const p=L.places.find(p=>p.id===sel.value);
      if(p&&(view.zoom>1.8||p.district==='Avernus')){view.x=p.x;view.z=p.z}
      choose(p);
    };
    map.addEventListener('wheel',e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0017),...mouse(e))},{passive:false});
    map.onpointerdown=e=>{drag={start:mouse(e),last:mouse(e),moved:false};map.setPointerCapture(e.pointerId)};
    map.onpointermove=e=>{
      if(!drag)return;
      const p=mouse(e);
      if(!drag.moved&&Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])<4)return;
      view.x=clamp(view.x-(p[0]-drag.last[0])/projection.scale,-worldEdges.x,worldEdges.x);
      view.z=clamp(view.z-(p[1]-drag.last[1])/projection.scale,-worldEdges.z,worldEdges.z);
      drag.last=p;drag.moved=true;draw();
    };
    map.onpointerup=e=>{
      if(!drag)return;
      if(!drag.moved){
        const [x,y]=mouse(e);
        const nearest=projection.pois.filter(p=>Math.hypot(x-p.x,y-p.y)<15)
          .sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];
        const [xx,zz]=projection.inverse(x,y);
        if(nearest)choose(nearest.p);
        else if(L.valid(xx,zz,-4)&&!world.blocked(xx,zz,L.terrain(xx,zz),1.5))choose({x:xx,z:zz,name:'Selected position'});
        else{choose(null);desc.textContent='Choose open ground or a marked location.'}
      }
      drag=null;
    };
    map.onpointercancel=()=>drag=null;draw();
  }

  function center(){
    if(hall)return {x:focus.x,z:focus.z,y:hallLevel()};
    const y=state.interior&&world.curated[state.interior]?.y;
    const h=typeof y==='number'?y:Math.max(world.bridgeSurface(focus.x,focus.z),L.terrain(focus.x,focus.z));
    return {x:focus.x,z:focus.z,y:h};
  }
  function getAlign(){return state.alignment?world.worldObjects.find(o=>o.id===state.alignment)||null:null}
  function surveyDimensions(){return [state.extent,state.extent*innerHeight/innerWidth]}
  function hallFootprint(level=hallLevel()){
    const rooms=hall.mapRects(level,state.altarKnown);
    const xmin=Math.min(...rooms.map(r=>r.xmin)),xmax=Math.max(...rooms.map(r=>r.xmax));
    const zmin=Math.min(...rooms.map(r=>r.zmin)),zmax=Math.max(...rooms.map(r=>r.zmax));
    return {x:(xmin+xmax)/2,z:(zmin+zmax)/2,w:xmax-xmin,d:zmax-zmin,y:level,angle:0};
  }
  function buildSurvey(){
    const [w,h]=surveyDimensions();
    return S.setup(survey,center(),w,h,state.rotation,state.mode);
  }
  function syncRoof(interior){
    for(const o of Object.values(world.curated))if(o.roof)o.roof.visible=o.id!==interior;
  }
  function surveyOverlay(){
    if(!active||state.mode==='walk')return;
    const w=innerWidth,h=innerHeight,c=center(),ctx=overlayCtx;
    ctx.clearRect(0,0,w,h);
    $('gridNote').hidden=!S.grid(ctx,survey,w,h,state.mode,state.rotation,c.y+.1,state.grid,state.extent,1,getAlign());
    S.marks(ctx,survey,w,h,c,ruler,1,112,true,localNorth());
    if(!hall&&state.names&&state.extent>135){
      ctx.font='600 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#271619';ctx.fillStyle='#ffe5c8';
      for(const p of L.places){
        if(state.extent>440&&!['dock','market','cemetery','hall','reach','blade','gardens','dragoneye','shieldhall','lava-docks','west-docks'].includes(p.id))continue;
        const [x,y]=S.project(survey,{x:p.x,z:p.z,y:L.surface(p.x,p.z)+6.6},w,h);
        if(x<15||x>w-80||y<65||y>h-124||(state.mini&&x>w-240&&y<265))continue;
        ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
        ctx.strokeText(p.name,x+7,y-5);ctx.fillText(p.name,x+7,y-5);
      }
    }
  }
  function switchMode(m){
    if(!active||state.mode===m)return;
    hall?.props?.cancel();
    if(seatReturn)standUp();
    const previous=state.mode;
    const building=getAlign();
    release();
    if(hall&&m==='walk'){
      focus={x:player.x,z:player.z};didSurveyPan=false;
    }else if(m==='walk'&&didSurveyPan){
      if(L.valid(focus.x,focus.z,-5)&&!world.blocked(focus.x,focus.z,L.terrain(focus.x,focus.z),1.66)){
        player.x=focus.x;player.z=focus.z;player.y=world.floorAt(player.x,player.z,L.terrain(player.x,player.z)+.95);
        vertical=0;grounded=false;
      }
      focus={x:player.x,z:player.z};didSurveyPan=false;
    }else if(previous==='walk'){focus={x:player.x,z:player.z};didSurveyPan=false}
    state.mode=m;state.interior=null;
    if(hall&&previous==='walk'&&m!=='walk'){
      const room=hallFootprint();focus={x:room.x,z:room.z};
      state.extent=Math.max(room.w,room.d*innerWidth/innerHeight)*1.12;
    }
    if(building&&m!=='walk')state.rotation=building.angle-(m==='iso'?Math.PI/4:0);
    ruler=[];measuring=false;miniStale='';
    if(m==='walk')$('gridNote').hidden=true;
    hud();mini();persist();dirty=true;forces=4;
  }
  function changeZoom(ratio,anchor){
    if(state.mode==='walk')return;
    const level=center().y;
    const a=anchor?S.planeAt(buildSurvey(),...anchor,innerWidth,innerHeight,level):null;
    state.extent=clamp(state.extent*ratio,3,1650);
    if(a){
      const b=S.planeAt(buildSurvey(),...anchor,innerWidth,innerHeight,level);
      shiftFocus(a.x-b.x,a.z-b.z);
    }
    dirty=true;forces=3;persist();
  }
  function shiftFocus(x,z){
    focus.x=clamp(focus.x+x,-1750,1750);focus.z=clamp(focus.z+z,-1480,1480);didSurveyPan=true;
  }
  function pan(dx,dy){
    const c=center(),w=innerWidth,h=innerHeight;
    const a=S.planeAt(buildSurvey(),w/2,h/2,w,h,c.y);
    const b=S.planeAt(survey,w/2+dx,h/2+dy,w,h,c.y);
    shiftFocus(a.x-b.x,a.z-b.z);dirty=true;forces=3;
  }
  function buildingAt(x,z,radius=26){
    const result=world.worldObjects
      .map(o=>[o,world.overlap(o,x,z,0)?-1:L.dist(o.x,o.z,x,z)])
      .filter(([,distance])=>distance<radius).sort((a,b)=>a[1]-b[1]);
    return result[0]?.[0]||null;
  }
  function alignBuilding(){
    if(hall){state.rotation=state.mode==='iso'?-Math.PI/4:0;state.alignment=null;dirty=true;forces=4;toast(interiorTitle()+' aligned to grid');return}
    const selected=buildingAt(focus.x,focus.z,65);
    if(!selected){toast('Center the survey near a building first.');return}
    state.rotation=selected.angle-(state.mode==='iso'?Math.PI/4:0);
    state.alignment=selected.id;focus={x:selected.x,z:selected.z};didSurveyPan=true;
    dirty=true;forces=4;persist();toast('Building aligned to grid');
  }
  function buildingFocus(o,inside=false){
    focus={x:o.x,z:o.z};state.extent=Math.max(o.w,o.d*(innerWidth/innerHeight))*1.43;
    state.rotation=o.angle-(state.mode==='iso'?Math.PI/4:0);state.alignment=o.id;state.interior=inside&&o.roof?o.id:null;
    didSurveyPan=true;dirty=true;forces=4;persist();hud();
  }


  function exportPanel(){
    if(state.mode!=='top')return;
    const b=panel('VTT export','export'),fields=node('div',{className:'fields'},b);
    const interiors=Object.values(world.curated).filter(o=>o.roof);
    const grounds={id:'grand-cemetery-grounds',x:-388,z:164,y:L.surface(-388,164),w:106,d:92,angle:0};
    function exportBounds(key){
      if(key==='current')return null;
      if(hall)return hallFootprint(floorLevels()[key]);
      return key===grounds.id?grounds:world.curated[key];
    }
    const spot=selectField(fields,'Area',hall?{current:'Current area',...Object.fromEntries(Object.entries(floorLevels()).map(([k,y])=>[k,hallFloorName(y)+' · full level']))}:Object.assign({current:'Current area',[grounds.id]:'Grand Cemetery grounds'},Object.fromEntries(interiors.map(o=>[o.id,(o.family?o.family+' mausoleum':L.places.find(p=>p.id===o.id)?.name||o.id)+' · interior']))),
      hall?'current':state.interior||'current',v=>changeArea(v),'exportArea');
    const viewport=surveyDimensions();
    const width=numField(fields,'Width (feet)',Math.max(5,Math.round(viewport[0]/ft/5)*5),5,12000,1,null,'exportWidth');
    const height=numField(fields,'Height (feet)',Math.max(5,Math.round(viewport[1]/ft/5)*5),5,12000,1,null,'exportHeight');
    const pp=numField(fields,'Pixels per 5 feet',70,1,180,1,null,'exportDensity');
    const grid=selectField(fields,'Export grid',{off:'No grid',...S.gridOptions},'off',()=>update(),'exportGrid');
    const marks=checkField(fields,'Scale and north arrow',true,()=>{},'exportMarks');
    const msg=node('p',{className:'caption',id:'exportSummary'},b);
    const actions=node('div',{className:'actions'},b);
    const go=button(actions,'Download PNG',async()=>capture(config(),go),'primary');go.id='downloadMap';
    button(actions,'Download scale data',()=>downloadMeta(config())).id='downloadScale';
    const note=node('p',{className:'muted',textContent:'Set your VTT to a 5-foot grid and use the scale below. A gridless PNG lets Foundry or Roll20 draw its own grid.'},b);
    const maxRes=Math.min(4096,renderer.capabilities.maxTextureSize);
    function config(){
      const w=finite(width.valueAsNumber,5,12000,5),h=finite(height.valueAsNumber,5,12000,5),density=finite(pp.valueAsNumber,1,180,1);
      const o=exportBounds(spot.value);
      const pxPerFt=Math.min(density/5,maxRes/Math.max(w,h));
      const wp=Math.max(1,Math.round(w*pxPerFt)),hp=Math.max(1,Math.round(h*pxPerFt));
      const p=o?{x:o.x,y:o.y,z:o.z}:center();
      return {w,h,wp,hp,density,pxPerFt,grid:grid.value,marks:marks.checked,o,p,yaw:o?.angle??state.rotation,
        align:hall?null:o||getAlign(),room:hall?hall.locationId+'-'+hallFloorName(p.y).toLowerCase():o?.id||null,insideHall:!!hall,lighting:state.time,weather:state.weather,darkness:state.darkness};
    }
    function update(){
      const c=config(),gridX=c.wp*5/c.w,gridY=c.hp*5/c.h;
      msg.textContent=c.wp.toLocaleString()+' × '+c.hp.toLocaleString()+' px · '+gridX.toFixed(2)+' × '+gridY.toFixed(2)+' px per 5 ft'+
        (c.pxPerFt<c.density/5?' · resolution capped at '+maxRes+' px':'');
    }
    function changeArea(v){
      const o=exportBounds(v);
      width.value=Math.max(5,Math.ceil((o?(o.w+2.3):viewport[0])/ft/5)*5);
      height.value=Math.max(5,Math.ceil((o?(o.d+2.3):viewport[1])/ft/5)*5);
      update();
    }
    for(const input of [width,height,pp])input.oninput=update;
    if(state.interior)changeArea(state.interior);else update();
  }
  function nameOf(c){
    return 'Elturel-'+(c.room||'current-area')+'-'+c.w+'x'+c.h+'ft-'+c.lighting;
  }
  function downloadMeta(c){
    const a=c.align, yaw=c.yaw, left=-c.w*ft/2,top=-c.h*ft/2;
    const gridX=c.wp*5/c.w,gridY=c.hp*5/c.h;
    const x=c.p.x+Math.cos(yaw)*left+Math.sin(yaw)*top;
    const z=c.p.z-Math.sin(yaw)*left+Math.cos(yaw)*top;
    const shiftX=x-(a?.x||0),shiftZ=z-(a?.z||0),aYaw=a?.angle||0;
    const info={map:nameOf(c)+'.png',widthFeet:c.w,heightFeet:c.h,widthPixels:c.wp,heightPixels:c.hp,
      centerElevationFeetAboveStyx:(c.p.y+(c.insideHall?interiorElevation():0)+152.4)/ft,
      coordinateSpace:c.insideHall?interiorTitle()+' local metres':'Elturel world metres',
      feetPerGridSquare:5,gridPixels:{x:gridX,y:gridY},gridType:S.gridSpec(c.grid,c.w*ft).key,
      mapRotationDegrees:yaw*180/Math.PI,northDegreesClockwiseFromTop:(((yaw+localNorth())*180/Math.PI)%360+360)%360,
      northWestWorldMetres:{east:x,south:z},gridOriginMetres:{east:a?.x||0,south:a?.z||0},
      topLeftInGridFrameFeet:{x:(shiftX*Math.cos(aYaw)-shiftZ*Math.sin(aYaw))/ft,
        z:(shiftX*Math.sin(aYaw)+shiftZ*Math.cos(aYaw))/ft},lighting:c.lighting,weather:c.weather,darkness:c.darkness};
    saveBlob(new Blob([JSON.stringify(info,null,2)],{type:'application/json'}),nameOf(c)+'.json');
  }
  async function capture(c,control){
    control.disabled=true;control.textContent='Rendering map…';
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    let output=null;
    try{
      const outputCam=S.setup(new THREE.OrthographicCamera(-1,1,1,-1,.1,2700),c.p,c.w*ft,c.h*ft,c.yaw,'top');
      output=document.createElement('canvas');output.width=c.wp;output.height=c.hp;
      renderer.setPixelRatio(1);renderer.setSize(c.wp,c.hp,false);
      syncRoof(c.room);renderScene(outputCam,c.p,Math.max(c.w,c.h)*ft*.55,false,true);
      const ctx=output.getContext('2d');
      ctx.drawImage(canvas,0,0,c.wp,c.hp);
      const unit=clamp(Math.max(c.wp,c.hp)/1150,.75,2.5);
      S.grid(ctx,outputCam,c.wp,c.hp,'top',c.yaw,c.p.y+.1,c.grid,c.w*ft,unit,c.align);
      if(c.marks)S.marks(ctx,outputCam,c.wp,c.hp,c.p,[],unit,40,true,localNorth());
    }catch(err){console.error(err);toast('Unable to render the map.');output=null}
    finally{resize();dirty=true;forces=4;shadowState='';control.disabled=false;control.textContent='Download PNG'}
    if(!output)return;
    const png=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
    if(!png){toast('PNG encoding failed.');return}
    saveBlob(png,nameOf(c)+'.png');toast('VTT map downloaded');
  }

  async function openOrgan(){
    const body=panel('Pipe organ','organ',true);
    const status=node('p',{className:'muted',textContent:'Preparing the organ…'},body);
    try{
      await loadHallModule('high-hall-organ.js');
      if(modal!=='organ'||!body.isConnected||!hall)return;
      status.remove();organSession=window.HighHallOrgan.mount(body,()=>({sound:state.sound,volume:state.volume}));
    }catch(error){if(modal==='organ')status.textContent='The organ could not be loaded.';console.error(error)}
  }
  function atOutsideChoirDoor(){
    const {x,y,z}=world.choirBalcony;
    return !hall&&!state.flight&&Math.abs(player.y-y)<.65&&Math.abs(player.x-x)<1.39&&player.z<=z&&player.z>z-1.73;
  }
  function toggleBalcony(){
    doorSettling=1;
    state.balconyOpen=!state.balconyOpen;
    hall?.setBalconyOpen(state.balconyOpen);world.setBalconyOpen(state.balconyOpen);
    audio.cue('door');details();dirty=true;forces=4;persist();
  }
  function familyMemorial(tomb){
    return tomb?.family&&player.z>tomb.z-.35&&Math.abs(player.x-tomb.x)<1.55?tomb:null;
  }
  function nearbyKeepsake(room){
    const home=households.get(room?.id);
    if(!home||Math.abs(player.y-room.y)>2.1)return null;
    const [x,z]=home.keepsake.at,c=Math.cos(room.angle),s=Math.sin(room.angle);
    return Math.hypot(player.x-room.x-x*c-z*s,player.z-room.z+x*s-z*c)<2.5?home:null;
  }
  function seatNearby(){return inTavern()?hall.seatNear(player.x,player.y,player.z,player.yaw):null}
  function standUp(){
    if(!seatReturn)return;
    const {x,y,z}=seatReturn;Object.assign(player,{x,y,z});seatReturn=null;
    focus={x,z};height=1.66;vertical=0;grounded=false;stairCameraY=null;details();dirty=true;persist();
  }
  function sitDown(seat){
    if(!seat)return;
    seatReturn={x:player.x,y:player.y,z:player.z,yaw:player.yaw};
    Object.assign(player,{x:seat.x,y:seat.y,z:seat.z,yaw:seat.yaw,pitch:seat.eyeHeight>1.4?-.12:0});
    focus={x:seat.x,z:seat.z};height=seat.eyeHeight||1.19;vertical=0;stairCameraY=null;clearKeys();details();dirty=true;persist();
  }
  // Give a moving door room only if its leaf actually meets the player.
  function clearMovingLeaf(dt){
    if(doorSettling<=0)return;
    doorSettling-=dt;
    const scene=hall||world;
    if(!scene.blocked(player.x,player.z,player.y,height))return;
    for(let radius=.10;radius<=1.8;radius+=.10){
      for(let i=0;i<16;i++){
        const a=player.yaw+Math.PI+i*Math.PI/8,x=player.x+radius*Math.sin(a),z=player.z-radius*Math.cos(a);
        const y=scene.floorAt(x,z,player.y+.30);
        if(Math.abs(y-player.y)<.31&&!scene.blocked(x,z,y,height)){
          Object.assign(player,{x,y,z});return;
        }
      }
    }
  }
  function doDoor(){
    if(!active||modal||state.mode!=='walk')return;
    if(hall?.props?.active){finishProp();return}
    if(inTavern()&&hall.useBar(player.x,player.y,player.z,player.yaw)){
      details();dirty=true;persist();return;
    }
    if(seatReturn){standUp();return}
    if(atTavernGate()){enterTavern();return}
    if(inTavern()){
      if(atTaproomExit()){leaveTavern();return}
      const id=hall.roomDoorNear(player.x,player.y,player.z,player.yaw);
      if(id){
        state.roomDoors={...state.roomDoors,[id]:!state.roomDoors?.[id]};
        hall.setRoomDoors(state.roomDoors);doorSettling=1;audio.cue('door');details();dirty=true;persist();return;
      }
      if(atAntlersBar()){
        const body=panel('The old bill of fare','bill');
        node('h3',{textContent:'From the cask'},body);
        node('p',{textContent:'Ale, 3 copper. Stout, 5 copper. House wine, 6 copper the tallglass.'},body);
        node('h3',{textContent:'From the kitchen'},body);
        node('p',{textContent:'A plate, 6 copper. River clams, onion cheese, or gurdats fried with pepper and cheese. Salt biscuits with any plate.'},body);return;
      }
      if(hall.atSecretDoor(player.x,player.y,player.z)){
        state.tavernShelfOpen=!state.tavernShelfOpen;
        hall.setSecretOpen(state.tavernShelfOpen);doorSettling=1;audio.cue('door');details();dirty=true;persist();return;
      }
      sitDown(seatNearby());
      return;
    }
    if(atCemeteryGate()){enterCemetery();return}
    if(inCemetery()){
      if(Math.abs(player.z)<1.26&&Math.abs(player.x)<1.7&&Math.abs(player.y)<2)leaveCemetery();
      return;
    }
    if(atHallGate()){enterHall();return}
    if(hall){
      if(hall.atOrgan?.(player.x,player.y,player.z)){openOrgan();return}
      if(hall.atBalconyDoor(player.x,player.y,player.z)){toggleBalcony();return}
      if(hall.atLever(player.x,player.y,player.z)){
        if(state.altarOpen&&!hall.canCloseAltar(player.x,player.y,player.z)){
          toast('Step clear of the altar opening first.');return;
        }
        state.altarOpen=!state.altarOpen;state.altarKnown=true;
        hall.setAltarOpen(state.altarOpen);audio.cue('door');
        miniStale='';dirty=true;forces=4;details();persist();
      }else if(Math.abs(player.x)<1.7&&player.z>-.95&&Math.abs(player.y)<2)leaveHall();
      return;
    }
    const room=world.roofAt(player.x,player.z,player.y);
    const tomb=familyMemorial(room);
    if(tomb){
      const body=panel(tomb.family+' mausoleum','memorial');
      node('h3',{textContent:tomb.object},body);node('p',{textContent:tomb.history},body);return;
    }
    const home=nearbyKeepsake(room);
    if(home){
      const body=panel(home.name,'keepsake');
      node('h3',{textContent:home.keepsake.title},body);node('p',{textContent:home.keepsake.text},body);return;
    }
    if(atOutsideChoirDoor()){toggleBalcony();return}
    const d=world.nearby(player.x,player.z,player.y);
    if(!d)return;
    doorSettling=1;
    d.open=!d.open;audio.startup();audio.cue('door');dirty=true;forces=5;persist();
  }
  function jump(){
    if(!state.flight&&!wet&&grounded){vertical=5.42;grounded=false;dirty=true}
  }
  function step(dt){
    if(hallLoading||seatReturn)return;
    const startX=player.x,startZ=player.z;
    const collision=hall||world;
    wet=hall?null:L.fluid(player.x,player.z,player.y);
    const bridge=hall?-Infinity:world.bridgeSurface(player.x,player.z);
    if(wet&&(state.flight||wet.y<player.y-.39||wet.y-world.floorAt(player.x,player.z,player.y+.45)<.46||(bridge>wet.y&&player.y>=bridge-.42)))wet=null;
    const f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
    const s=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
    const running=keys.has('ShiftLeft')||keys.has('ShiftRight');
    crouched=keys.has('KeyC')&&!state.flight&&!wet;
    const h=crouched?1.04:wet?1.17:1.66;
    height=L.mix(height,h,1-Math.exp(-dt*15));
    const speed=state.flight?(running?39:15):wet?(running?4.3:2.7):crouched?2.0:running?7.4:4.1;
    if(f||s){
      const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw),unit=speed*dt/Math.hypot(f,s);
      const dx=(sin*f+cos*s)*unit,dz=(-cos*f+sin*s)*unit;
      for(const [ix,iz] of [[dx,0],[0,dz]]){
        const x=clamp(player.x+ix,-worldEdges.x,worldEdges.x),z=clamp(player.z+iz,-worldEdges.z,worldEdges.z);
        if(iz<0&&atTavernGate(x,z,.65)){enterTavern();return}
        if(iz>0&&inTavern()&&Math.abs(x)<1.05&&z>.35&&Math.abs(player.y)<1.25){leaveTavern();return}
        if(ix<0&&atCemeteryGate(x,z)&&x<=world.cemeteryGate.x+.25){enterCemetery();return}
        if(inCemetery()&&ix>0&&Math.abs(z)<1.26&&player.x<=.2&&x>.16&&Math.abs(player.y)<2){leaveCemetery();return}
        if(iz&&crossChoir(x,z))return;
        if((!hall||inHighHall())&&iz<0&&crossEscape(x,z))return;
        if(iz>0&&atHallGate(x,z)&&z>=hallGate.z-.5){enterHall();return}
        if(inHighHall()&&Math.abs(x)<1.7&&z>1.3&&Math.abs(player.y)<2){leaveHall();return}
        const nearSurface=wet&&player.y>=wet.y-1.38;
        const stepLimit=nearSurface?wet.y+.46:player.y+.51;
        const floor=collision.floorAt(x,z,stepLimit);
        if(floor>stepLimit)continue;
        const nextY=Math.max(player.y,floor);
        if(collision.blocked(x,z,nextY,height,player.x,player.z))continue;
        player.x=x;player.z=z;if(wet)player.y=nextY;
      }
    }
    const floor=collision.floorAt(player.x,player.z,player.y+.48);
    const surface=hall?null:L.fluid(player.x,player.z,player.y);
    if(state.flight){
      const climb=(keys.has('Space')?1:0)-(keys.has('KeyC')?1:0);
      const pitchMotion=f*Math.sin(player.pitch)*.72;
      let nextY=clamp(Math.max(floor+.035,player.y+(climb+pitchMotion)*speed*dt),-185,710);
      if(L.island(player.x,player.z)){
        const ceiling=L.underside(player.x,player.z)-height-.05;
        if(player.y<=ceiling&&nextY>ceiling)nextY=ceiling;
      }
      player.y=nextY;
      grounded=false;vertical=0;
    }else if(surface&&surface.y>floor+.46&&surface.y>player.y-.43){
      wet=surface;
      const climb=(keys.has('Space')?1:0)-(keys.has('KeyC')?1:0);
      if(climb)player.y=clamp(player.y+climb*speed*dt,floor+.06,Math.max(floor+.06,surface.y-.63));
      else if(player.y>surface.y-1.22)player.y=L.mix(player.y,Math.max(floor+.06,surface.y-1.04),1-Math.exp(-dt*3.2));
      vertical=0;grounded=false;
    }else{
      if(grounded&&player.y-floor<.55&&floor<=player.y+.48){player.y=floor;vertical=0}
      else vertical-=13.8*dt;
      const next=player.y+vertical*dt;
      if(next<=floor){player.y=floor;vertical=0;grounded=true}
      else{player.y=next;grounded=false}
    }
    if(player.y<-187){travel(place);return}
    const moved=Math.hypot(player.x-startX,player.z-startZ);
    if(state.sound&&!state.flight&&(grounded||wet)&&moved>.0001){
      strideDistance+=moved;
      const stride=wet?2.3:crouched?1.32:running?2.48:1.86;
      if(strideDistance>=stride){
        strideDistance%=stride;
        const sound=wet?(wet.kind==='water'?'stroke':null):inTavern()&&hallLevel()>=0?'wood':hall?'stone':world.treadAt(player.x,player.z,player.y);
        if(sound)audio.cue(sound,crouched?.10:running?.23:.17,.92+Math.random()*.16);
      }
    }else strideDistance=0;
    submerged=surface&&surface.y>player.y+height?surface.kind:null;
    focus={x:player.x,z:player.z};
  }


  function resize(){
    if(!renderer)return;
    renderer.setPixelRatio(quality);
    renderer.setSize(innerWidth,innerHeight,false);
    overlay.width=innerWidth;overlay.height=innerHeight;
    cam.aspect=innerWidth/Math.max(1,innerHeight);cam.updateProjectionMatrix();
    dirty=true;forces=4;
  }
  function walkCamera(){
    eye.set(player.x,(hall&&stairCameraY!==null?stairCameraY:player.y)+height,player.z);
    cam.position.copy(eye);
    const c=Math.cos(player.pitch);
    cam.lookAt(player.x+Math.sin(player.yaw)*c,eye.y+Math.sin(player.pitch),player.z-Math.cos(player.yaw)*c);
    cam.updateMatrixWorld(true);
  }
  function titleCamera(){
    cam.position.set(430,126,678);
    cam.lookAt(-138,-6,72);cam.updateMatrixWorld(true);
  }
  function exteriorVista(){
    if(inTavern()){
      const level=hallLevel();if(level<0)return null;
      const building=world.curated.antlers,c=Math.cos(building.angle),s=Math.sin(building.angle);
      const dx=Math.sin(player.yaw),dz=-Math.cos(player.yaw),zLocal=player.z+6.06;
      const tx=Math.abs(dx)<.001?Infinity:((dx>0?9.3:-9.3)-player.x)/dx;
      const tz=Math.abs(dz)<.001?Infinity:((dz>0?6.54:-6.54)-zLocal)/dz;
      const gable=level===hall.levels.attic,side=gable||tx<tz;
      const bank=side?Math.sign(dx)||1:Math.sign(dz)||1;
      const bay=gable?0:side?Math.round(clamp((zLocal+dz*tx)/4,-1,1)):Math.round(clamp((player.x+dx*tz)/5,-1,1));
      const x=side?bank*(building.w/2+1.2):bay*5;
      const z=side?bay*4:bank*(building.d/2+1.2);
      return ['tavern-'+level+'-'+(side?'gable':'frontage')+bank+'-'+bay,
        building.x+x*c+z*s,building.y+level+1.66,building.z-x*s+z*c];
    }
    if(inCemetery()){
      if(player.y< -1.5)return null;
      const {x,y,z}=world.cemeteryGate;
      if(player.x<-8&&Math.sin(player.yaw)<-.15){
        const wall=player.z<1?-29.25:-14.0;
        return [wall<-20?'mourning-west':'nave-west',x+wall,y+2.1,z+(wall<-20?-4.3:17.5)];
      }
      const along=player.z<7?0:player.z<18?15.3:20.2;
      return ['chapel-front-'+along,x+.9,y+1.9,z+along];
    }
    const choir=player.y>2.8&&player.z>-16&&Math.abs(player.x)<14;
    const tunnel=player.y<-3&&player.z<-69&&Math.abs(player.x-27)<5;
    if(choir){
      const {x,y,z}=world.choirBalcony;
      return ['balcony',x,y+1.66,z-.28];
    }
    if(tunnel){
      const {x,y,z}=world.escapeExit;
      return ['tunnel',x,y+1.66,z];
    }
    if(Math.abs(player.y)<1.7&&player.z> -12&&Math.abs(player.x)<9)
      return ['cathedral-front',hallGate.x,interiorElevation()+1.66,hallGate.z-2.05];
    return null;
  }
  // Fill the view through the openings with the corresponding exterior panorama.
  // High Hall faces opposite its city axes. The cemetery uses city north.
  function updateHallVista(walking){
    hall.scene.background=hall.indoorBackground;
    const location=walking?exteriorVista():null;
    if(!location)return;
    const [id,x,y,z]=location,key=[state.time,state.weather,state.darkness].join('/');
    let vista=hall.vistas.get(id);
    if(!vista||vista.key!==key){
      if(vista)vista.target.dispose();
      if(inTavern()&&!vista&&hall.vistas.size>=3){
        const [oldest,entry]=[...hall.vistas].sort((a,b)=>a[1].used-b[1].used)[0];
        entry.target.dispose();hall.vistas.delete(oldest);
      }
      const resolution=inTavern()?384:id.endsWith('-front')?768:512;
      const target=new THREE.WebGLCubeRenderTarget(resolution,{type:THREE.HalfFloatType});
      const capture=new THREE.CubeCamera(.2,4400,target);
      capture.coordinateSystem=renderer.coordinateSystem;capture.updateCoordinateSystem();
      capture.position.set(x,y,z);
      capture.rotation.y=localNorth();capture.updateMatrixWorld(true);
      vista={target,capture,key,face:0,clock:elapsed};hall.vistas.set(id,vista);
    }
    vista.used=elapsed;
    if(vista.face<6){
      if(inTavern()){
        for(const other of [...hall.vistas.values()].reverse()){
          if(other.key===key&&other.face===6){hall.scene.background=other.target.texture;break}
        }
      }
      const {capture,target,clock}=vista,anchor=capture.position;
      world.env.update(state,capture,anchor,115,clock,false);
      world.lighting(state,clock,anchor,anchor,115,false,false);
      const previous=renderer.getRenderTarget();
      renderer.shadowMap.needsUpdate=vista.face===0;
      renderer.setRenderTarget(target,vista.face);renderer.render(world.scene,capture.children[vista.face]);
      renderer.setRenderTarget(previous);vista.face++;shadowState='';
    }
    if(vista.face===6)hall.scene.background=vista.target.texture;
  }
  function renderScene(view,center,extent,live,exporting=false){
    const renderState=active?state:titleState;
    if(active&&hall){
      const surveying=state.mode!=='walk';
      hall.survey(surveying,exporting?center.y:hallLevel(),state.darkness);
      if(inTavern())hall.showHeld(surveying||exporting?null:view,!surveying&&!exporting);
      hall.scene.fog=surveying?null:hall.walkFog;
      updateHallVista(!surveying&&!exporting);
      if(!inHighHall()||(surveying?center.y:player.y)<-3)hall.updateLights?.(surveying?center.x:player.x,surveying?center.z:player.z,surveying?center.y:player.y);
      for(const lamp of hall.lights){
        lamp.intensity=lamp.userData.baseIntensity*(state.darkness?.06:1);
      }
      eye.set(player.x,player.y+height,player.z);
      hallLamp.position.copy(eye);hallLamp.intensity=state.light?7:0;
      const lights=hall.sightLights.slice().sort((a,b)=>a.position.distanceToSquared(eye)-b.position.distanceToSquared(eye));
      perception.render(hall.scene,view,state,eye,false,[...lights.slice(0,5),hallLamp]);
      return;
    }
    const clock=active?elapsed:(performance.now()/1000)%10000;
    const shadow=[renderState.mode,renderState.time,renderState.weather,renderState.darkness,Math.round(center.x/5),Math.round(center.z/5),
      Math.round(center.y/4),Math.round(extent/5)].join(':');
    world.env.update(renderState,view,center,extent,clock,live&&!reducedMotion.matches);
    if(world.env.rain.visible&&(submerged||active&&world.roofAt(player.x,player.z,player.y)))world.env.rain.visible=false;
    renderer.shadowMap.needsUpdate=exporting||shadow!==shadowState;
    shadowState=shadow;
    eye.set(player.x,player.y+height,player.z);
    const ambientFlight=active&&live&&!exporting&&state.mode==='walk'&&!submerged&&
      !reducedMotion.matches&&!world.roofAt(player.x,player.z,player.y);
    world.lighting(renderState,clock,eye,center,extent,ambientFlight,!modal);
    perception.render(world.scene,view,renderState,eye,active&&state.mode==='walk'&&submerged,world.sightLights);
  }
  function draw(){
    if(!active){
      titleCamera();syncRoof(null);
      aim.set(-39,38,68);renderScene(cam,aim,560,true);return;
    }
    syncRoof(state.mode==='walk'?null:state.interior);
    if(state.mode==='walk'){
      walkCamera();
      aim.set(player.x+Math.sin(player.yaw)*25,player.y,player.z-Math.cos(player.yaw)*25);
      renderScene(cam,aim,state.flight?152:91,true);
    }else{
      const c=center();buildSurvey();
      renderScene(survey,c,Math.max(80,state.extent*.73),false);
      surveyOverlay();
    }
  }
  function displayedPlace(x,z){
    const room=world.roofAt(x,z,player.y);
    if(room?.family)return {name:room.family+' mausoleum',district:'Grand Cemetery'};
    if(households.has(room?.id))return households.get(room.id);
    const balcony=world.choirBalcony;
    if(Math.abs(player.y-balcony.y)<2&&Math.abs(x-balcony.x)<=balcony.halfWidth&&z>=balcony.z-balcony.depth-.2&&z<=balcony.z)
      return {name:'High Hall · Choir Balcony',district:'High District'};
    const ledge=world.escapeExit;
    if(Math.abs(player.y-ledge.y)<3&&Math.abs(x-ledge.x)<8&&z>=ledge.z-4&&z<ledge.z+15)
      return {name:'High Hall · Cliff Ledge',district:'High District'};
    let best=null,min=Infinity;
    for(const p of L.places){
      const d=L.dist(x,z,p.x,p.z);if(d<min){best=p;min=d}
    }
    if(min<26)return best;
    if(L.pathDistance(x,z,L.gorge)<34)return {name:'The Rift',district:'ELTUREL'};
    if(L.plateau(x,z)>24)return {name:'High District',district:'ELTUREL'};
    if(!L.inside(x,z,L.outline))return {name:L.pathDistance(x,z,L.river)<160?'River Styx':'The Ash Plain',district:'AVERNUS'};
    return {name:x>0?'Dock District':'Westerly',district:'ELTUREL'};
  }
  function hud(){
    if(!active)return;
    const walk=state.mode==='walk',locked=document.pointerLockElement===canvas;
    for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));
    const pressed=(id,value)=>$(id).setAttribute('aria-pressed',String(!!value));
    pressed('lightToggle',state.light);pressed('fly',state.flight);pressed('miniToggle',state.mini);pressed('ruler',measuring);
    $('timeLabel').textContent=state.darkness?'Darkness':Avernus.times[state.time].label;
    $('minimap').hidden=!state.mini;$('placeName').hidden=$('regionName').hidden=!state.names;
    $('miniMapTitle').textContent=hall?interiorTitle().toUpperCase():'ELTUREL';
    $('miniNorth').textContent=inHighHall()?'↓ N':'↑ N';
    $('miniMapButton').textContent='Open map';
    $('crosshair').hidden=!walk||!locked;$('surveyTools').hidden=walk;$('surveyCanvas').hidden=walk;
    $('zoomTools').hidden=walk;$('lookTools').hidden=!walk;$('fly').hidden=!walk||!!hall;
    $('exportOpen').hidden=state.mode!=='top';$('gridStyle').value=state.grid;$('clearRuler').hidden=!ruler.length;
    $('cursor').innerHTML=(locked?'Free cursor':'Mouse look')+' <kbd>V</kbd>';
    details();
  }
  function details(){
    if(!active)return;
    if(inHighHall()&&!state.altarKnown&&player.y<-4&&hall.inSecretPassage?.(player.x,player.z))state.altarKnown=true;
    const walk=state.mode==='walk',p=walk?player:focus;
    const level=walk?player.y:center().y;
    const feet=Math.round((level+(hall?interiorElevation():0)+152.4)/ft);
    const degrees=(Math.round(cityBearing()*180/Math.PI)%360+360)%360;
    const heading=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
    const elevation=(walk?heading+' '+degrees+'° · ':'')+Math.abs(feet).toLocaleString()+' ft '+(feet<0?'below':'above')+' the Styx';
    if($('elevation').textContent!==elevation)$('elevation').textContent=elevation;
    if(state.names){
      const near=hall?{name:interiorTitle()+' · '+hallFloorName(hallLevel()),district:inTavern()?tavernPlace.district:inCemetery()?'WESTERLY':'HIGH DISTRICT'}:displayedPlace(p.x,p.z);
      if($('placeName').textContent!==near.name)$('placeName').textContent=near.name;
      $('regionName').textContent=near.district==='ELTUREL'?'ELTUREL':near.district.toUpperCase();
    }
    const lock=document.pointerLockElement===canvas;
    const gate=walk&&(atTavernGate()||atTaproomExit()||atCemeteryGate()||atHallGate()||(inHighHall()||inCemetery())&&Math.abs(player.y)<2&&(inCemetery()?Math.abs(player.z)<1.26&&Math.abs(player.x)<1.7:Math.abs(player.x)<1.7&&player.z>-.95));
    const door=walk&&!hall?world.nearby(player.x,player.z,player.y):null;
    const shelf=walk&&hall?.atSecretDoor?.(player.x,player.y,player.z);
    const lever=walk&&hall?.atLever?.(player.x,player.y,player.z);
    const organ=walk&&hall?.atOrgan?.(player.x,player.y,player.z);
    const balcony=walk&&(hall?.atBalconyDoor?.(player.x,player.y,player.z)||atOutsideChoirDoor());
    const room=walk&&!hall?world.roofAt(player.x,player.z,player.y):null;
    const tomb=familyMemorial(room);
    const keepsake=nearbyKeepsake(room);
    const bill=walk&&atAntlersBar(),seat=walk&&seatNearby();
    const roomDoor=walk&&hall?.roomDoorNear?.(player.x,player.y,player.z,player.yaw);
    const barAction=walk&&hall?.actionHint?.(player.x,player.y,player.z,player.yaw);
    const moving=hall?.props?.active;
    $('interact').hidden=!barAction&&!moving&&!seatReturn&&!seat&&!roomDoor&&!bill&&!shelf&&!keepsake&&!tomb&&!door&&!gate&&!lever&&!organ&&!balcony;
    if(moving)$('interact').textContent=moving.label+' · '+(moving.valid?'Click to place':'Obstructed')+' · R rotate · Wheel reach · Shift+wheel lift · Esc cancel';
    else if(barAction)$('interact').textContent=barAction+' · E'+(seatReturn?'   Stand · Q':'');
    else if(seatReturn)$('interact').textContent='Stand up · E';
    else if(roomDoor)$('interact').textContent=(state.roomDoors?.[roomDoor]?'Close room door':'Open room door')+' · E';
    else if(tomb)$('interact').textContent='Read family memorial · E';
    else if(keepsake)$('interact').textContent=keepsake.keepsake.title+' · E';
    else if(organ)$('interact').textContent='Play organ · E';
    else if(balcony)$('interact').textContent=(state.balconyOpen?'Close balcony doors':'Open balcony doors')+' · E';
    else if(bill)$('interact').textContent='Read bill of fare · E'+(seat?'   Sit · Q':'');
    else if(shelf)$('interact').textContent=(state.tavernShelfOpen?'Close cellar shelf':'Move cellar shelf')+' · E';
    else if(lever)$('interact').textContent=(state.altarOpen?'Close altar':'Pull lever')+' · E';
    else if(gate)$('interact').textContent=(inTavern()?'Leave tavern':atTavernGate()?'Enter tavern':inCemetery()?'Leave chapel':atCemeteryGate()?'Enter chapel':hall?'Leave cathedral':'Enter cathedral')+' · E';
    else if(door)$('interact').textContent=(door.open?'Close door':'Open door')+' · E';
    else if(seat)$('interact').textContent='Sit · E';
    const text=walk?(state.flight?'Flying · Space / C altitude':wet?(wet.kind==='lava'?'Swimming in lava':'Swimming')+' · WASD swim · Space / C depth':
      crouched?'Crouching':lock?'WASD move · Shift run · Space jump':'Click to look · WASD to move'):
      Math.round(state.extent/ft).toLocaleString()+' ft across · Drag to pan · Scroll to zoom';
    const status=text+(inTavern()&&!moving?(walk&&hall.hasHeldTankard()?' · G set down':' · G move furniture'):'');
    if(status!==worldStatus){worldStatus=status;$('status').textContent=status}
  }
  function loop(now){
    requestAnimationFrame(loop);
    const delta=Math.max(0,now-lastTime);lastTime=now;frame++;
    if(!world||document.hidden)return;
    const dt=Math.min(.10,delta/1000);
    if(active&&!modal){
      elapsed+=dt;
      if(hall?.tickBar?.(dt))persist();
      hall?.tickRoomDoors?.(dt);hall?.tickSecretDoor?.(dt);hall?.tickAltar?.(dt);hall?.tickBalcony?.(dt);world.tickBalcony(dt);
      if(state.mode==='walk'){
        const substeps=Math.max(1,Math.ceil(dt/.02));
        for(let n=0;n<substeps;n++)step(dt/substeps);
        if(hall)stairCameraY=stairCameraY===null||!grounded||Math.abs(stairCameraY-player.y)>.7?
          player.y:L.mix(stairCameraY,player.y,1-Math.exp(-dt*20));
      }
      world.doorUpdate(dt);
      if(state.mode==='walk')clearMovingLeaf(dt);
    }
    if(active&&now-lastPersist>4200){lastPersist=now;persist()}
    if(frame%9===0&&active){
      audio.effects(state,player,world,!modal&&state.mode==='walk',!!hall,inTavern()?tavernHearth:null);
      details();mini();
    }
    if(modal&&modal!=='world'&&!dirty&&forces<=0)return;
    if(!active&&frame%3!==0&&!dirty)return;
    if(hall?.props?.active){hall.props.aim(...propView());dirty=true}
    if(active&&state.mode!=='walk'&&!dirty&&forces<=0)return;
    if(active&&modal==='world'&&!dirty&&forces<=0&&frame%4!==0)return;
    dirty=false;forces=Math.max(0,forces-1);
    draw();
    if(active&&!hall&&!modal&&state.mode==='walk'&&Avernus.weather[state.weather].thunder&&elapsed-thunderAt>17){
      thunderAt=elapsed;audio.cue('thunder');
    }
    if(active&&state.mode==='walk'&&!modal){
      averageFrame=L.mix(averageFrame,Math.min(delta,130),.035);
      if(now-lastQuality>1800){
        lastQuality=now;
        const cap=Math.min(devicePixelRatio||1,1.35);
        const next=averageFrame>38?Math.max(.66,quality-.11):averageFrame<20?Math.min(cap,quality+.06):quality;
        if(Math.abs(next-quality)>.02){quality=next;resize()}
      }
    }
  }

  const renderKeys=new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyC','ShiftLeft','ShiftRight']);
  function key(e,down){
    const c=e.code;
    if(!down){
      keys.delete(c);
      if(c==='Escape'){
        // Some browsers consume the keydown when Escape releases mouse capture.
        if(!escapeHeld&&active&&!modal)menu();
        escapeHeld=false;
      }
      return;
    }
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    const formControl=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if(c==='Escape'){
      if(e.repeat||escapeHeld)return;
      escapeHeld=true;
      if(hall?.props?.active){e.preventDefault();hall.props.cancel();dirty=true;details()}
      else if(modal){e.preventDefault();closePanel()}
      else if(active){e.preventDefault();menu()}
      return;
    }
    if(!active)return;
    if(c==='KeyM'&&!e.repeat&&(!formControl||modal==='area')){e.preventDefault();if(!modal||modal==='area')area();return}
    if(formControl)return;
    if(modal)return;
    if(seatReturn&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(c)&&!e.repeat){
      standUp();if(c==='Space'){e.preventDefault();return}
    }
    if(renderKeys.has(c)){
      if(c==='Space'&&document.activeElement?.matches('button:focus-visible'))return;
      e.preventDefault();audio.startup();keys.add(c);
      if(c==='Space'&&!e.repeat&&state.mode==='walk')jump();
      return;
    }
    if(e.repeat)return;
    const actions={
      KeyG:moveProp,KeyR:()=>{if(hall?.props?.active){hall.props.rotate((e.shiftKey?-1:1)*Math.PI/12);dirty=true}},
      KeyV:tryLook,KeyK:()=>setting('mini',!state.mini),KeyT:()=>setting('light',!state.light),KeyY:environment,
      KeyF:()=>{if(state.mode==='walk'){vertical=0;setting('flight',!state.flight)}},
      KeyE:doDoor,KeyQ:()=>{if(inTavern()&&state.mode==='walk'){if(seatReturn)standUp();else sitDown(seatNearby())}},
      Digit1:()=>switchMode('walk'),Digit2:()=>switchMode('iso'),Digit3:()=>switchMode('top'),
      Equal:()=>changeZoom(.79),Minus:()=>changeZoom(1.26)
    };
    if(actions[c]){e.preventDefault();actions[c]()}
  }
  document.addEventListener('keydown',e=>key(e,true));
  document.addEventListener('keyup',e=>key(e,false));
  window.addEventListener('blur',()=>{clearKeys();escapeHeld=false});
  window.addEventListener('pagehide',persist);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){persist();clearKeys();audio.setting(state.volume,true)}
    else{lastTime=performance.now();dirty=true}
  });
  window.addEventListener('resize',resize);
  function turn(dx,dy){
    player.yaw=(player.yaw+dx*.0025)%(Math.PI*2);
    player.pitch=clamp(player.pitch-dy*.00235,-1.43,1.43);dirty=true;
  }
  document.addEventListener('mousemove',e=>{
    if(active&&!modal&&state.mode==='walk'&&document.pointerLockElement===canvas)turn(e.movementX,e.movementY);
  });
  function pointerDistance(points){
    const [a,b]=[...points.values()];
    return Math.hypot(a.x-b.x,a.y-b.y);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(active&&!modal&&e.button===0&&hall?.props?.active){e.preventDefault();finishProp();return}
    if(!active||modal||e.button!==0||document.pointerLockElement===canvas)return;
    audio.startup();canvas.focus();
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
    canvas.setPointerCapture(e.pointerId);
    if(pointers.size>1)for(const p of pointers.values())p.moved=true;
  });
  canvas.addEventListener('pointermove',e=>{
    if(state.mode!=='walk'){
      const rect=canvas.getBoundingClientRect();
      surveyPointer.x=(e.clientX-rect.left)/rect.width*2-1;surveyPointer.y=1-(e.clientY-rect.top)/rect.height*2;
    }
    const p=pointers.get(e.pointerId);
    if(!p||!active||modal)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    const pinch=pointers.size===2&&state.mode!=='walk',before=pinch?pointerDistance(pointers):0;
    if(!p.moved&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<4)return;
    p.x=e.clientX;p.y=e.clientY;p.moved=true;
    if(pinch){
      const d=pointerDistance(pointers);
      const center=[...pointers.values()].reduce((v,p)=>[v[0]+p.x/2,v[1]+p.y/2],[0,0]);
      if(before>3&&d>3)changeZoom(before/d,center);
    }else if(state.mode==='walk')turn(dx,dy);
    else pan(dx,dy);
  });
  canvas.addEventListener('pointerup',e=>{
    const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);
    if(!p||p.moved||!active||modal)return;
    if(state.mode==='walk'){if(e.pointerType==='mouse')tryLook();return}
    if(measuring){
      if(ruler.length===2)ruler=[];
      ruler.push(hall?S.planeAt(buildSurvey(),e.clientX,e.clientY,innerWidth,innerHeight,hallLevel()):S.groundAt(buildSurvey(),e.clientX,e.clientY,innerWidth,innerHeight,world));dirty=true;hud();
    }
  });
  canvas.addEventListener('pointercancel',e=>pointers.delete(e.pointerId));
  canvas.addEventListener('dblclick',e=>{
    if(!active||modal||measuring||state.mode==='walk'||hall)return;
    const point=S.groundAt(buildSurvey(),e.clientX,e.clientY,innerWidth,innerHeight,world);
    const o=buildingAt(point.x,point.z);
    if(o)buildingFocus(o,false);
  });
  canvas.addEventListener('wheel',e=>{
    if(active&&!modal&&hall?.props?.active){
      e.preventDefault();const step=clamp(-e.deltaY*.004,-.7,.7);
      if(e.shiftKey)hall.props.adjustHeight(step);else hall.props.adjustDistance(step);
      dirty=true;return;
    }
    if(!active||modal||state.mode==='walk')return;
    e.preventDefault();changeZoom(Math.exp(clamp(e.deltaY,-950,950)*.00165),[e.clientX,e.clientY]);
  },{passive:false});

  $('start').onclick=()=>arrive(null);
  $('continue').onclick=()=>{const s=stored();if(s)arrive(s);else toast('No saved journey is available.')};
  $('titleLoad').onclick=openLoad;$('notes').onclick=notes;
  $('close').onclick=()=>closePanel();$('veil').onclick=e=>{if(e.target===$('veil'))closePanel()};
  $('menuOpen').onclick=menu;$('mapOpen').onclick=area;$('miniOpen').onclick=area;$('miniMapButton').onclick=area;
  $('miniHide').onclick=()=>setting('mini',false);$('miniToggle').onclick=()=>setting('mini',!state.mini);
  $('worldOpen').onclick=environment;$('lightSettings').onclick=environment;$('lightToggle').onclick=()=>setting('light',!state.light);
  $('fly').onclick=()=>{vertical=0;setting('flight',!state.flight)};
  $('interact').onclick=doDoor;$('cursor').onclick=tryLook;$('exportOpen').onclick=exportPanel;
  for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>switchMode(b.dataset.mode);
  optionList($('gridStyle'),S.gridOptions);$('gridStyle').onchange=e=>setting('grid',e.target.value);
  $('ruler').onclick=()=>{measuring=!measuring;hud();dirty=true};
  $('clearRuler').onclick=()=>{ruler=[];dirty=true;hud()};
  $('zoomOut').onclick=()=>changeZoom(1.27);$('zoomIn').onclick=()=>changeZoom(.79);
  function rotate(delta){
    state.rotation=(state.rotation+delta)%(Math.PI*2);state.alignment=null;dirty=true;persist();
  }
  $('rotateLeft').onclick=()=>rotate(-Math.PI/12);$('rotateRight').onclick=()=>rotate(Math.PI/12);
  $('north').onclick=()=>{state.rotation=0;state.alignment=null;dirty=true;persist()};
  $('align').onclick=alignBuilding;
  $('veil').addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const focusable=[...$('dialog').querySelectorAll('button:not(:disabled),a,select,input')].filter(x=>!x.hidden);
    if(!focusable.length)return;
    if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus()}
    else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0].focus()}
  });

  const ready=(async()=>{
    try{
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;

      quality=Math.min(devicePixelRatio||1,1.25);resize();
      world=await ElturelWorld.build(renderer);
      perception=Perception.create(renderer);
      chart=S.mapLayer(world);
      $('start').disabled=false;$('start').innerHTML='Enter Elturel <svg><use href="#arrow"/></svg>';
      $('continue').hidden=!stored();$('continue').disabled=false;
      draw();requestAnimationFrame(loop);
    }catch(err){
      bootFailure=err;console.error(err);
      $('start').textContent='Elturel unavailable';$('bootError').textContent='The scene could not start. Enable WebGL in your browser and reopen this file.';
      $('bootError').hidden=false;
    }
  })();
})();




