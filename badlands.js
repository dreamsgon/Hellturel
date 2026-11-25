'use strict';
// A low-detail horizon beyond the walkable plain. All ridges share one draw.
const AvernianHorizon=(()=>{
  function build(scene,env,rockMap){
    const positions=[],colors=[],indices=[],rows=8,segments=384;
    const ridges=[
      {radius:1960,height:215,phase:.8},
      {radius:2530,height:370,phase:3.4},
      {radius:3190,height:540,phase:5.9}
    ];
    for(const [layer,ridge] of ridges.entries()){
      const offset=positions.length/3;
      for(let i=0;i<=segments;i++){
        const a=2*Math.PI*i/segments,p=ridge.phase;
        const coarse=.5+.5*Math.sin(5*a+p)*Math.cos(3*a-p);
        const table=Math.min(1,Math.max(0,(Math.sin(9*a+p)+.37*Math.cos(17*a-p)) *1.9));
        const scree=.5+.5*Math.sin(33*a+p)*Math.cos(14*a+p);
        const teeth=Math.abs(Math.sin(24*a+2*Math.sin(a*13)+p)*Math.cos(17*a-p));
        const crest=ridge.height*(.14+.45*coarse+.33*table+.13*scree+.20*teeth);
        for(let j=0;j<rows;j++){
          const slope=[0,.12,.28,.45,.84,1,.81,.04][j];
          const r=ridge.radius+[0,60,116,184,230,266,315,440][j]+58*Math.sin(6*a+p)+22*Math.sin(19*a-p+j*.18);
          const y=-183+slope*crest+slope*(9*Math.sin(61*a+p)+6*Math.sin(133*a+p+j*.18));
          positions.push(Math.cos(a)*r,y,Math.sin(a)*r*.94);
          const grain=.54+.14*Math.sin(a*79+j*1.3)+.12*Math.sin(a*25+p);
          colors.push(grain*(.42+.07*layer),grain*(.27+.05*layer),grain*(.28+.05*layer));
          if(i<segments&&j<rows-1){
            const n=offset+i*rows+j;
            indices.push(n,n+rows,n+1,n+1,n+rows,n+rows+1);
          }
        }
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const material=new THREE.ShaderMaterial({
      uniforms:{...env.uniform,rockMap:{value:rockMap}},vertexColors:true,side:THREE.DoubleSide,
      vertexShader:'varying vec3 rock,norm,pos;void main(){rock=color;norm=normal;pos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:[
        'uniform vec3 horizon,lightDir,fogColor;uniform float darkness,fogAmount;uniform sampler2D rockMap;varying vec3 rock,norm,pos;',
        'void main(){vec3 face=normalize(cross(dFdx(pos),dFdy(pos)));',
        'float light=.24+.56*max(0.,dot(normalize(norm+face*.5),lightDir));',
        'vec2 uv=vec2((pos.x+.7*pos.z)*.011,pos.y*.014);',
        'vec3 grit=texture2D(rockMap,uv).rgb;',
        'float beds=.93+.07*sin(pos.y*.051+sin(pos.x*.012)*3.+pos.z*.009);',
        'vec3 c=rock*light*(.30+.53*horizon)*(.49+grit*3.2)*beds*(1.-.89*darkness);',
        'float haze=clamp(1.-exp(-distance(cameraPosition,pos)*fogAmount*.25),.16,.79);',
        'gl_FragColor=vec4(mix(c,fogColor,haze),1.);',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
    scene.add(new THREE.Mesh(g,material));
  }
  return {build};
})();
