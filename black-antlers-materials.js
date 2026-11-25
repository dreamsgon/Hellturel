'use strict';
window.BlackAntlersMaterials=(()=>{
  const size=512;
  const wrap=(n,period)=>((n%period)+period)%period;
  const saturate=n=>Math.max(0,Math.min(1,n));
  function lattice(x,y){
    const n=Math.imul(x+23,374761393)^Math.imul(y+85,668265263);
    return ((Math.imul(n^(n>>>13),1274126177)^(n>>>16))>>>0)/4294967295;
  }
  function noise(u,v,nx,ny){
    const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y);
    const a=x-ix,b=y-iy,fx=a*a*(3-2*a),fy=b*b*(3-2*b);
    const left=wrap(ix,nx),right=wrap(ix+1,nx),up=wrap(iy,ny),down=wrap(iy+1,ny);
    return (1-fy)*((1-fx)*lattice(left,up)+fx*lattice(right,up))
      +fy*((1-fx)*lattice(left,down)+fx*lattice(right,down));
  }
  function timber(u,v){
    const wandering=noise(u,v,4,3),cross=u+(wandering-.5)*.085;
    const ring=.5+.5*Math.sin(2*Math.PI*(cross*23+noise(u,v,8,4)*.54));
    const late=ring**9,pores=saturate((noise(cross,v,124,18)-.57)*3);
    const fibers=noise(cross,v,91,5),broad=noise(u,v,5,6);
    const figure=late*.12+pores*.12+fibers*.12+(broad-.5)*.26;
    return [1-figure,.58-figure*1.25,.74+pores*.17-late*.13];
  }
  function limestone(u,v){
    const field=noise(u,v,9,9),grit=noise(u,v,127,128);
    const pits=saturate((noise(u,v,45,43)-.61)*3.7);
    const strata=noise(u,v,11,28),blotch=noise(u,v,4,7);
    return [.82+(blotch-.5)*.24+(field-.5)*.22-pits*.15,
      .57+(strata-.5)*.24+(grit-.5)*.17-pits*.32,.87+grit*.12];
  }
  function plaster(u,v){
    const cloud=noise(u,v,6,7),trowel=noise(u,v,9,22),sand=noise(u,v,195,194);
    return [.94+(cloud-.6)*.19+(trowel-.5)*.12,.52+(trowel-.5)*.21+(sand-.5)*.2,.88+sand*.12];
  }
  function iron(u,v){
    const hammer=noise(u,v,20,21),pitting=noise(u,v,114,119);
    const oxide=saturate((noise(u,v,7,9)-.44)*1.6);
    return [.91-oxide*.26+(hammer-.5)*.19,.57+(hammer-.5)*.33+(pitting-.5)*.19,.54+oxide*.42];
  }
  function wool(u,v){
    const warp=.5+.5*Math.cos(u*2*Math.PI*112),weft=.5+.5*Math.cos(v*2*Math.PI*101);
    const yarn=Math.max(warp,weft),dye=noise(u,v,13,12);
    return [.88+(dye-.5)*.18+(yarn-.5)*.15,.42+yarn*.32,.92];
  }
  function bone(u,v){
    const ridges=noise(u,v,85,8),field=noise(u,v,9,11);
    return [.77+(ridges-.5)*.25+(field-.5)*.24,.55+(ridges-.5)*.37,.68+field*.18];
  }
  const recipes={
    beam:['timber',.023,.87],dark:['timber',.018,.89],wood:['timber',.018,.73],
    plank:['plank',.014,.77],plank2:['plank',.014,.82],plank3:['plank',.014,.78],
    mortar:['limestone',.031,.96],stone:['limestone',.022,.92],stone2:['limestone',.024,.92],stone3:['limestone',.021,.9],
    plaster:['plaster',.017,.94],iron:['iron',.009,.79,.52],bronze:['iron',.009,.72,.47],
    linen:['wool',.008,.94],red:['wool',.011,.93],blue:['wool',.01,.93],green:['wool',.01,.93],
    antler:['bone',.018,.81]
  };
  const fields={timber,plank:(u,v)=>timber(u,v+.37),limestone,plaster,iron,wool,bone};
  const pixels=new Map();
  function bake(key){
    const color=new Uint8Array(size*size*4),relief=new Uint8Array(color.length);
    const field=fields[key];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(x+y*size)*4,[tone,height,roughness]=field(x/size,y/size);
      const value=Math.round(saturate(tone)*255),h=Math.round(saturate(height)*255);
      color[i]=color[i+1]=color[i+2]=value;
      relief[i]=relief[i+2]=h;
      relief[i+1]=Math.round(saturate(roughness)*255);
      color[i+3]=relief[i+3]=255;
    }
    const pair=[color,relief];
    pixels.set(key,pair);
    return pair;
  }
  function create(){
    const cached=new Map();
    function texture(bytes,colorSpace){
      const tex=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
      tex.colorSpace=colorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;
      tex.anisotropy=8;tex.generateMipmaps=true;tex.needsUpdate=true;
      return tex;
    }
    function load(key){
      const [color,relief]=pixels.get(key)||bake(key);
      const pair=[texture(color,THREE.SRGBColorSpace),texture(relief,THREE.NoColorSpace)];
      cached.set(key,pair);return pair;
    }
    function apply(material,name){
      const recipe=recipes[name];
      if(!recipe)return;
      const [key,bump,roughness,metalness=0]=recipe;
      const [map,relief]=cached.get(key)||load(key);
      Object.assign(material,{map,bumpMap:relief,bumpScale:bump,roughnessMap:relief,roughness,metalness});
      material.needsUpdate=true;
    }
    function dispose(){
      for(const pair of cached.values())for(const tex of pair)tex.dispose();
      cached.clear();
    }
    return {apply,dispose};
  }
  function leadedGlass(){
    return new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`
        varying vec2 pane;
        varying vec3 sight;
        varying vec3 face;
        void main(){
          vec4 point=modelMatrix*instanceMatrix*vec4(position,1.);
          pane=uv;
          sight=cameraPosition-point.xyz;
          face=normalize(mat3(modelMatrix*instanceMatrix)*normal);
          gl_Position=projectionMatrix*viewMatrix*point;
        }`,
      fragmentShader:`
        varying vec2 pane;
        varying vec3 sight;
        varying vec3 face;
        void main(){
          vec2 lead=vec2(3.*pane.x+3.5*pane.y,3.*pane.x-3.5*pane.y);
          vec2 edge=abs(fract(lead+.5)-.5);
          vec2 line=1.-smoothstep(vec2(.012),vec2(.017)+fwidth(lead),edge);
          float joint=max(line.x,line.y);
          float seed=fract(sin(dot(floor(lead),vec2(3.91,47.63)))*4375.2);
          float ripple=.5+.5*sin(48.*pane.y+4.*sin(12.*pane.x)+seed);
          float grazing=pow(1.-abs(dot(normalize(sight),normalize(face))),2.);
          float sheen=.10+.22*grazing+.055*ripple+.045*seed;
          vec3 color=mix(vec3(.33,.49,.48),vec3(.063,.060,.054),joint);
          gl_FragColor=vec4(color,mix(sheen,.93,joint));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
  }
  return {create,leadedGlass};
})();
