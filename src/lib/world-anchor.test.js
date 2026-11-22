import test from 'node:test';
import assert from 'node:assert/strict';
import {multiply4,cardTransform,lateralOffset} from './world-anchor.js';
const id=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
test('world placement stays fixed as the camera turns and translates; billboard faces new view',()=>{
 const head=id(),at={x:2,y:1,z:-2},offset=lateralOffset(head),first=cardTransform(at,head,offset);
 const changed=id();changed[0]=0;changed[2]=-1;changed[8]=1;changed[10]=0;changed[12]=5;
 const second=cardTransform(at,changed,offset);
 assert.deepEqual(second.slice(12),first.slice(12));assert.equal(second[0],0);assert.equal(second[2],-1);assert.notEqual(second[12],changed[12]);
 assert.ok(Math.abs(second[12]-2.12)<.00001);
});
test('clip projection composes eye view after model translation',()=>{
 const model=id(),view=id(),proj=id(); model[12]=2;view[12]=-.5;proj[0]=2;
 assert.equal(multiply4(proj,multiply4(view,model))[12],3);
});