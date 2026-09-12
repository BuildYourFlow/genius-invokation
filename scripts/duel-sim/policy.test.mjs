import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePolicy } from './policy.mjs';
const response = (method,value)=>({method,value});
const elements=new Map([[101,2],[102,4]]);
const players=[
  {activeCharacterId:1,character:[{id:1,definitionId:101,health:10}],dice:[2,8,3],handCard:[]},
  {activeCharacterId:2,character:[{id:2,definitionId:102,health:10}],dice:[4,8,5],handCard:[]},
];
const action=(damage,cost=[])=>({validity:0,action:{$case:'useSkill',value:{}},preview:[{mutation:{$case:'damage',value:damage}}],autoSelectedDice:cost,isFast:false});
test('each seat rerolls own visible dice, never hidden zeros',async()=>{
  for(const who of [0,1]) {
    const p=makePolicy(who,response,elements);
    p.notify({state:{player:players.map((x,i)=>({...x,dice:i===who?x.dice:[0,0,0]}))}});
    const r=await p.rpc({request:{$case:'rerollDice',value:{}}});
    assert.deepEqual(r.value.diceToReroll,[who===0?3:5]);
  }
});
test('seat mirroring preserves action choice; self damage is penalized',async()=>{
  for(const variant of ['greedy','resource']) for(const who of [0,1]) {
    const p=makePolicy(who,response,elements,variant);
    p.notify({state:{player:players}});
    const actions=[
      action({targetId:who+1,oldHealth:10,newHealth:3,causeDefeated:false}),
      action({targetId:2-who,oldHealth:10,newHealth:7,causeDefeated:false}),
      {...action({targetId:2-who,oldHealth:10,newHealth:0,causeDefeated:true}),validity:3},
    ];
    const r=await p.rpc({request:{$case:'action',value:{action:actions}}});
    assert.equal(r.value.chosenActionIndex,1);
  }
});
test('own healing is preferred over healing an opponent',async()=>{
  const p=makePolicy(0,response,elements); p.notify({state:{player:players}});
  const r=await p.rpc({request:{$case:'action',value:{action:[
    action({targetId:2,oldHealth:5,newHealth:9}),action({targetId:1,oldHealth:5,newHealth:9}),
  ]}}});
  assert.equal(r.value.chosenActionIndex,1);
});
