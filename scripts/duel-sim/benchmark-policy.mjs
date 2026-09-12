// Independent held-out strength probe: identical deck at both seats.
// Resource and greedy alternate first player. No tuning uses these outcomes.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import dataFactory from '../../packages/data/dist/index.js';
import { Game, createRpcResponse } from '../../packages/core/dist/index.js';
import { makePolicy } from './policy.mjs';
const deckIndex=Number(process.argv[2]);
if(![0,1].includes(deckIndex)) throw Error('Deck index required');
const dir='results/duel-sim';
const audit=JSON.parse(await fs.readFile(`${dir}/smoke-greedy.json`,'utf8')).deckAudit[deckIndex];
const data=dataFactory('v7.0.0');
const names=['cryo','hydro','pyro','electro','anemo','geo','dendro'];
const elements=new Map([...data.characters].map(([id,c])=>[id,names.findIndex(e=>c.tags.includes(e))+1]));
function pile(seed,seat) {
  const cards=[...audit.cards];let counter=0;
  for(let i=cards.length-1;i>0;i--) {
    const bound=i+1,limit=Math.floor(0x100000000/bound)*bound;let x;
    do{x=createHash('sha256').update(`duel-pile:${seed}:${seat}:${counter++}`).digest().readUInt32LE(0);}while(x>=limit);
    const j=x%bound;[cards[i],cards[j]]=[cards[j],cards[i]];
  }
  return {characters:audit.characters,cards,noShuffle:true};
}
const rows=[];
await fs.writeFile(`${dir}/benchmark-${deckIndex}.jsonl`,'');
for(let i=0;i<100;i++) {
  const seed=910000+deckIndex*100+i, resourceSeat=i%2;
  const game=new Game(Game.createInitialState({decks:[pile(seed,0),pile(seed,1)],data,versionBehavior:'v7.0.0',randomSeed:seed,unexpectedInsufficientDice:'throw'}),{errorLevel:'strict'});
  for(const seat of [0,1]) game.players[seat].io=makePolicy(seat,createRpcResponse,elements,seat===resourceSeat?'resource':'greedy');
  let technicalError=null;game.onIoError=e=>{technicalError=e.message;};
  let winnerSeat=null;
  try{winnerSeat=await game.start();}catch(e){technicalError=e.stack;}
  const row={game:i,seed,deckIndex,resourceSeat,winnerSeat:technicalError?null:winnerSeat,resourceWin:technicalError||winnerSeat===null?null:winnerSeat===resourceSeat,technicalError,round:game.state.roundNumber};
  rows.push(row);await fs.appendFile(`${dir}/benchmark-${deckIndex}.jsonl`,JSON.stringify(row)+'\n');
}
await fs.writeFile(`${dir}/benchmark-${deckIndex}.json`,JSON.stringify({purpose:'Held-out mirror-deck resource vs greedy comparison; no tuning',rows},null,2));
console.log({deckIndex,attempts:rows.length,errors:rows.filter(r=>r.technicalError).length,resourceWins:rows.filter(r=>r.resourceWin===true).length});
