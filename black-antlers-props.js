'use strict';
window.BlackAntlersProps=(()=>{
  const TAU=Math.PI*2;
  const tidy=n=>Math.round(n*10000)/10000;
  const angle=n=>Math.atan2(Math.sin(n%TAU),Math.cos(n%TAU));
  const poseOf=({position,rotation})=>({x:position.x,y:position.y,z:position.z,yaw:rotation.y});
  function transform(item,pose,x,y,z){
    const dx=x-item.home.x,dz=z-item.home.z,a=pose.yaw-item.home.yaw,c=Math.cos(a),s=Math.sin(a);
    return {x:pose.x+dx*c+dz*s,y:pose.y+y-item.home.y,z:pose.z-dx*s+dz*c};
  }
  function solidAt(item,pose,solid){
    return {...solid,...transform(item,pose,solid.x,solid.y,solid.z),ry:(solid.ry||0)+pose.yaw-item.home.yaw};
  }
  function axes(solid){
    const c=Math.cos(solid.ry||0),s=Math.sin(solid.ry||0);
    return [[c,-s],[s,c]];
  }
  function intersects(a,b){
    if(a.y+a.h<=b.y+.015||b.y+b.h<=a.y+.015)return false;
    const dx=b.x-a.x,dz=b.z-a.z,radius=(Math.hypot(a.w,a.d)+Math.hypot(b.w,b.d))*.5;
    if(dx*dx+dz*dz>=radius*radius)return false;
    const [au,av]=axes(a),[bu,bv]=axes(b);
    const dot=(u,v)=>u[0]*v[0]+u[1]*v[1];
    for(const test of [au,av,bu,bv]){
      const gap=Math.abs(dx*test[0]+dz*test[1]);
      const span=(Math.abs(dot(test,au))*a.w+Math.abs(dot(test,av))*a.d+
        Math.abs(dot(test,bu))*b.w+Math.abs(dot(test,bv))*b.d)*.5;
      if(gap>=span-.014)return false;
    }
    return true;
  }
  function create({mapSolids,floorAt,levelAt,ceilings=[],obstacles=()=>[]}){
    const items=new Map(),raycaster=new THREE.Raycaster(),localRay=new THREE.Ray();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0)),aimPoint=new THREE.Vector3();
    const center=new THREE.Vector3(),hit=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
    const box=new THREE.Box3();
    let selection=null;
    function register({id,label,group,solids=[],seat,level=levelAt(group.position.y)}){
      const key=id||label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+items.size;
      if(items.has(key))throw Error('Duplicate movable prop '+key);
      const home=poseOf(group);
      const records=solids.map(record=>({record,home:{...record}}));
      items.set(key,{id:key,label,group,home,records,seat,initialSeat:seat&&{...seat},level});
      return key;
    }
    function setVisual(item,pose){
      item.group.position.set(pose.x,pose.y,pose.z);
      item.group.rotation.y=pose.yaw;
      item.group.updateMatrixWorld(true);
    }
    function setPlacement(item,pose){
      setVisual(item,pose);
      for(const solid of item.records)Object.assign(solid.record,solidAt(item,pose,solid.home));
      if(item.seat){
        const s=item.initialSeat;
        Object.assign(item.seat,transform(item,pose,s.x,s.y,s.z),{yaw:angle(s.yaw+pose.yaw-item.home.yaw)});
      }
    }
    function samePose(a,b){
      return Math.abs(a.x-b.x)<.0001&&Math.abs(a.y-b.y)<.0001&&Math.abs(a.z-b.z)<.0001&&
        Math.abs(angle(a.yaw-b.yaw))<.0001;
    }
    function isClear(item,pose,ownStart){
      if(![pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite))return false;
      if(Math.abs(pose.x)>40||Math.abs(pose.z)>40||pose.y<item.level-.08||pose.y>item.level+2.2)return false;
      if(ownStart&&samePose(ownStart,pose))return true;
      const otherSolids=[...mapSolids,...ceilings,...obstacles()];
      const own=new Set(item.records.map(s=>s.record));
      const shapes=item.records.length?item.records.map(s=>solidAt(item,pose,s.home)):
        [{x:pose.x,y:pose.y,z:pose.z,w:.16,h:.16,d:.16,ry:pose.yaw}];
      const groundAt=(x,z)=>floorAt(x,z,item.level+.13);
      for(const shape of shapes){
        const [u,v]=axes(shape),dx=shape.w*.43,dz=shape.d*.43;
        const corners=[groundAt(shape.x,shape.z)];
        for(const i of [-1,1])for(const j of [-1,1])
          corners.push(groundAt(shape.x+u[0]*dx*i+v[0]*dz*j,shape.z+u[1]*dx*i+v[1]*dz*j));
        if(corners.some(h=>!Number.isFinite(h)||h<item.level-.14||h>pose.y+.055))return false;
        if(otherSolids.some(s=>!own.has(s)&&intersects(shape,s)))return false;
      }
      return true;
    }
    function isVisible(object){
      for(let node=object;node;node=node.parent)if(!node.visible)return false;
      return true;
    }
    function setRay(camera,ndc,maxDistance){
      camera.updateMatrixWorld();
      raycaster.far=maxDistance;
      raycaster.setFromCamera(ndc,camera);
    }
    function rayDistance(solid){
      center.set(solid.x,solid.y+solid.h/2,solid.z);
      localRay.copy(raycaster.ray);
      localRay.origin.sub(center).applyAxisAngle(axis,-(solid.ry||0));
      localRay.direction.applyAxisAngle(axis,-(solid.ry||0));
      box.min.set(-solid.w/2,-solid.h/2,-solid.d/2);
      box.max.set(solid.w/2,solid.h/2,solid.d/2);
      if(box.containsPoint(localRay.origin))return Infinity;
      return localRay.intersectBox(box,hit)?hit.distanceTo(localRay.origin):Infinity;
    }
    function pick(camera,ndc={x:0,y:0},maxDistance=4){
      setRay(camera,ndc,maxDistance);
      const visible=[...items.values()].filter(item=>isVisible(item.group));
      for(const item of visible)item.group.updateWorldMatrix(true,true);
      const hits=raycaster.intersectObjects(visible.map(item=>item.group),true);
      for(const intersection of hits){
        if(!isVisible(intersection.object))continue;
        const item=visible.find(({group})=>{
          for(let node=intersection.object;node;node=node.parent)if(node===group)return true;
          return false;
        });
        if(!item)continue;
        const own=new Set(item.records.map(s=>s.record));
        if([...mapSolids,...obstacles()].some(s=>!own.has(s)&&rayDistance(s)<intersection.distance-.045))return null;
        return {id:item.id,label:item.label,point:intersection.point.clone(),distance:intersection.distance};
      }
      return null;
    }
    function begin(id,picked){
      const item=items.get(id);
      if(!item||selection)return false;
      const start=poseOf(item.group);
      selection={item,start,pose:{...start},valid:true,distance:picked?.distance??2.25,
        offsetX:picked?start.x-picked.point.x:0,offsetZ:picked?start.z-picked.point.z:0};
      return true;
    }
    function preview(pose){
      const {item,start}=selection;
      if(samePose(selection.pose,pose))return selection.valid;
      selection.pose=pose;
      selection.valid=isClear(item,pose,start);
      setVisual(item,pose);
      return selection.valid;
    }
    function aim(camera,ndc={x:0,y:0},maxDistance=4){
      if(!selection)return false;
      setRay(camera,ndc,maxDistance);
      if(camera.isOrthographicCamera){
        plane.constant=-selection.pose.y;
        if(!raycaster.ray.intersectPlane(plane,aimPoint)||aimPoint.distanceTo(raycaster.ray.origin)>maxDistance)return false;
      }else raycaster.ray.at(Math.min(selection.distance,maxDistance),aimPoint);
      return preview({...selection.pose,x:aimPoint.x+selection.offsetX,z:aimPoint.z+selection.offsetZ});
    }
    function translate(dx,dy,dz){
      if(!selection||![dx,dy,dz].every(Number.isFinite))return false;
      const {pose,item}=selection;
      const x=Math.max(-40,Math.min(40,pose.x+dx)),z=Math.max(-40,Math.min(40,pose.z+dz));
      selection.offsetX+=x-pose.x;selection.offsetZ+=z-pose.z;
      return preview({...pose,x,y:Math.max(item.level,Math.min(item.level+2.2,pose.y+dy)),z});
    }
    function adjustDistance(delta){
      if(!selection||!Number.isFinite(delta))return false;
      selection.distance=Math.max(.4,Math.min(6,selection.distance+delta));
      return true;
    }
    const adjustHeight=delta=>translate(0,delta,0);
    function rotate(radians){
      return !!selection&&Number.isFinite(radians)&&preview({...selection.pose,yaw:angle(selection.pose.yaw+radians)});
    }
    function commit(blocker){
      if(!selection)return false;
      const {item,pose,start}=selection;
      selection.valid=isClear(item,pose,start);
      const overlapsPlayer=blocker&&!samePose(start,pose)&&
        item.records.some(s=>intersects(solidAt(item,pose,s.home),blocker));
      if(!selection.valid||overlapsPlayer)return false;
      setPlacement(item,pose);
      selection=null;
      return true;
    }
    function cancel(){
      if(!selection)return false;
      setVisual(selection.item,selection.start);
      selection=null;
      return true;
    }
    function snapshot(){
      const result={};
      for(const item of items.values()){
        const pose=selection?.item===item?selection.start:poseOf(item.group);
        if(!samePose(pose,item.home))result[item.id]=Object.fromEntries(Object.entries(pose).map(([k,n])=>[k,tidy(n)]));
      }
      return result;
    }
    function restore(record){
      cancel();
      const candidates=new Map();
      for(const item of items.values()){
        const pose=record&&Object.hasOwn(record,item.id)?record[item.id]:null;
        const saved=pose&&[pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite)&&
          Math.abs(pose.x)<=40&&Math.abs(pose.z)<=40&&pose.y>=item.level-.08&&pose.y<=item.level+2.2;
        if(saved)candidates.set(item,{x:pose.x,y:pose.y,z:pose.z,yaw:angle(pose.yaw)});
        setPlacement(item,candidates.get(item)||item.home);
      }
      // Resolve colliding saved entries against their final positions, including swapped objects.
      let retry;
      do{
        retry=false;
        for(const [item,pose] of candidates){
          if(isClear(item,pose,item.home))continue;
          setPlacement(item,item.home);
          candidates.delete(item);retry=true;
        }
      }while(retry);
    }
    return {register,pick,begin,aim,translate,rotate,adjustDistance,adjustHeight,commit,cancel,snapshot,restore,
      get active(){return selection&&{id:selection.item.id,label:selection.item.label,valid:selection.valid,...selection.pose}}};
  }
  return {create};
})();
