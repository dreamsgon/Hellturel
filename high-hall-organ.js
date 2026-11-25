'use strict';
window.HighHallOrgan=(()=>{
  // An 8′ Principal, a quiet 8′ stopped flute, and a light 4′ Octave.
  const ranks=[
    {multiple:1,level:.75,attack:.087,release:.046,partials:[1,.35,.17,.097,.045,.029,.015,.009]},
    {multiple:1,level:.29,attack:.136,release:.065,partials:[1,.035,.22,.014,.065,.006,.018]},
    {multiple:2,level:.135,attack:.107,release:.039,partials:[1,.29,.115,.05,.02]}
  ];
  const releaseTime=.42;

  function makeNoise(context){
    const length=Math.ceil(context.sampleRate*.24);
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
    return buffer;
  }

  function makeRoom(context){
    const rate=context.sampleRate;
    const buffer=context.createBuffer(2,Math.ceil(rate*2.65),rate);
    const reflections=[
      [[.027,.38],[.049,-.25],[.079,.19],[.111,.14],[.154,-.11]],
      [[.034,.36],[.061,.26],[.091,-.18],[.126,.14],[.173,.10]]
    ];
    // Diffuse stone reflections darken as they decay behind the discrete echoes.
    let seed=6871;
    for(let channel=0;channel<2;channel++){
      const samples=buffer.getChannelData(channel);
      let low=0,body=0;
      for(let i=Math.round(rate*.044);i<samples.length;i++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=seed/2147483648-1;
        low+=(noise-low)*.13;
        body+=(noise-body)*.033;
        const seconds=i/rate-.044;
        const spread=Math.min(1,seconds/.08);
        samples[i]=spread*(low*.009*Math.exp(-4.35*seconds)+body*.019*Math.exp(-2.75*seconds));
      }
      for(const [seconds,level] of reflections[channel]){
        const offset=Math.round(rate*seconds);
        samples[offset]+=level*.62;
        samples[offset+1]+=level*.26;
        samples[offset+2]+=level*.12;
      }
    }
    return buffer;
  }

  function mount(container,settings){
    const codes=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK'];
    const labels=['A','W','S','E','D','F','T','G','Y','H','U','J','K'];
    const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C'];
    const black=new Set([1,3,6,8,10]),keys=[],voices=new Map(),pointers=new Map();
    const held=new Map();
    let context,master,pipes,chiff,waves,disposed=false;
    const intro=document.createElement('p');
    intro.className='muted';
    intro.textContent='Play with A–K and the black-key letters, or use the keys below. Sound follows your World settings.';
    container.append(intro);
    const board=document.createElement('div');
    board.className='organ-keys';
    board.setAttribute('role','group');
    board.setAttribute('aria-label','Pipe organ keyboard');
    container.append(board);

    function setup(){
      if(context)return true;
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return false;
      try{context=new Audio()}catch{return false}
      master=context.createGain();
      master.gain.value=0;
      const compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-13;
      compressor.knee.value=16;
      compressor.ratio.value=3;
      compressor.attack.value=.012;
      compressor.release.value=.22;
      master.connect(compressor);
      compressor.connect(context.destination);

      pipes=context.createBiquadFilter();
      pipes.type='lowpass';
      pipes.frequency.value=3650;
      pipes.Q.value=.14;
      const dry=context.createGain();
      dry.gain.value=.68;
      pipes.connect(dry);
      dry.connect(master);

      const room=context.createConvolver();
      room.normalize=false;
      room.buffer=makeRoom(context);
      const wet=context.createGain();
      wet.gain.value=.67;
      pipes.connect(room);
      room.connect(wet);
      wet.connect(master);

      waves=ranks.map(({partials})=>{
        const sine=new Float32Array([0,...partials]);
        return context.createPeriodicWave(new Float32Array(sine.length),sine);
      });
      chiff=makeNoise(context);
      return true;
    }

    function setKey(note,pressed){
      keys[note].classList.toggle('playing',pressed);
      keys[note].setAttribute('aria-pressed',String(pressed));
    }

    function stop(note){
      const voice=voices.get(note);
      if(!voice)return;
      voices.delete(note);
      const t=context.currentTime;
      for(const {pipe,envelope,release} of voice){
        envelope.gain.setTargetAtTime(0,t,release);
        pipe.stop(t+releaseTime);
      }
    }

    function start(note){
      const config=settings();
      if(!config.sound||!(config.volume>0)||!setup())return;
      if(context.state!=='running')context.resume().catch(()=>{});
      const t=context.currentTime;
      master.gain.setTargetAtTime(Math.min(1,config.volume)*.46,t,.023);
      if(voices.size>=8)stop(voices.keys().next().value);

      const freq=261.625565*Math.pow(2,note/12);
      const voice=ranks.map(({multiple,level,attack,release},index)=>{
        const pipe=context.createOscillator();
        pipe.setPeriodicWave(waves[index]);
        pipe.frequency.value=freq*multiple;
        const envelope=context.createGain();
        envelope.gain.setValueAtTime(0,t);
        envelope.gain.setTargetAtTime(level*.19,t,attack/3);
        pipe.connect(envelope);
        envelope.connect(pipes);
        pipe.onended=()=>{
          pipe.disconnect();
          envelope.disconnect();
        };
        pipe.start(t);
        return {pipe,envelope,release};
      });
      voices.set(note,voice);

      const breath=context.createBufferSource();
      breath.buffer=chiff;
      const filter=context.createBiquadFilter();
      filter.type='bandpass';
      filter.frequency.value=freq*4.2;
      filter.Q.value=.83;
      const transient=context.createGain();
      transient.gain.setValueAtTime(0,t);
      transient.gain.linearRampToValueAtTime(.052,t+.012);
      transient.gain.exponentialRampToValueAtTime(.0001,t+.14);
      breath.connect(filter);
      filter.connect(transient);
      transient.connect(pipes);
      breath.onended=()=>{
        breath.disconnect();
        filter.disconnect();
        transient.disconnect();
      };
      breath.start(t,((note*7)%33)*.001);
      breath.stop(t+.15);
    }

    function press(note,source){
      if(disposed)return;
      if(!held.has(note))held.set(note,new Set());
      const sources=held.get(note);
      if(sources.size===0){
        setKey(note,true);
        start(note);
      }
      sources.add(source);
    }

    function release(note,source){
      const sources=held.get(note);
      if(!sources?.delete(source)||sources.size)return;
      held.delete(note);
      setKey(note,false);
      stop(note);
    }

    function clear(){
      for(const note of held.keys())setKey(note,false);
      for(const note of voices.keys())stop(note);
      held.clear();
      pointers.clear();
    }

    function releasePointer(e){
      const note=pointers.get(e.pointerId);
      if(note===undefined)return;
      pointers.delete(e.pointerId);
      release(note,e.pointerId);
    }

    for(let i=0;i<names.length;i++){
      const button=document.createElement('button');
      button.type='button';
      button.className='organ-key '+(black.has(i)?'organ-black':'organ-white');
      button.textContent=labels[i];
      button.setAttribute('aria-label',names[i]+' · '+labels[i]);
      button.setAttribute('aria-pressed','false');
      button.dataset.note=String(i);
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId,i);
        press(i,e.pointerId);
      });
      button.addEventListener('pointerup',releasePointer);
      button.addEventListener('pointercancel',releasePointer);
      button.addEventListener('lostpointercapture',releasePointer);
      button.addEventListener('keydown',e=>{
        if(e.code!=='Space'&&e.code!=='Enter')return;
        e.preventDefault();
        e.stopPropagation();
        if(!e.repeat)press(i,e.code);
      });
      button.addEventListener('keyup',e=>{
        if(e.code!=='Space'&&e.code!=='Enter')return;
        e.preventDefault();
        e.stopPropagation();
        release(i,e.code);
      });
      button.addEventListener('blur',()=>{
        release(i,'Space');
        release(i,'Enter');
      });
      button.addEventListener('click',e=>{
        if(e.detail!==0||held.has(i))return;
        const source=Symbol();
        press(i,source);
        window.setTimeout(()=>release(i,source),220);
      });
      board.append(button);
      keys.push(button);
    }

    const down=e=>{
      const i=codes.indexOf(e.code);
      if(i<0||e.ctrlKey||e.altKey||e.metaKey)return;
      if(e.target instanceof Element&&e.target.closest('input, textarea, select, [contenteditable]'))return;
      e.preventDefault();
      e.stopPropagation();
      if(!e.repeat)press(i,e.code);
    };
    const up=e=>{
      const i=codes.indexOf(e.code);
      if(i<0||!held.get(i)?.has(e.code))return;
      e.preventDefault();
      e.stopPropagation();
      release(i,e.code);
    };
    const hidden=()=>{if(document.hidden)clear()};
    document.addEventListener('keydown',down,true);
    document.addEventListener('keyup',up,true);
    window.addEventListener('blur',clear);
    document.addEventListener('visibilitychange',hidden);

    return {dispose(){
      if(disposed)return;
      disposed=true;
      clear();
      document.removeEventListener('keydown',down,true);
      document.removeEventListener('keyup',up,true);
      window.removeEventListener('blur',clear);
      document.removeEventListener('visibilitychange',hidden);
      if(context)context.close().catch(()=>{});
    }};
  }
  return {mount};
})();
