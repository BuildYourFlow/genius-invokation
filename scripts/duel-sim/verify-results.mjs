import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='results/duel-sim';
const analysis=JSON.parse(await fs.readFile(`${dir}/analysis.json`,'utf8'));
const checks=[];
for(const [prefix,key,n] of [['main','primary',2000],['sensitivity','sensitivity',400]]) {
  const rows=(await fs.readFile(`${dir}/${prefix}-raw.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,n);
  assert.equal(new Set(rows.map(r=>r.seed)).size,n);
  const starts=[0,0],wins=[0,0],seatWins=[0,0];
  let errors=0,draws=0;
  for(const r of rows) {
    const seatDeck=r.seatSwap?[1,0]:[0,1];
    starts[seatDeck[0]]++;
    if(r.technicalError){errors++;assert.equal(r.winnerDeck,null);continue;}
    assert.equal(r.terminalPhase,'gameEnd');
    if(r.winnerSeat===null){draws++;continue;}
    assert.ok([0,1].includes(r.winnerSeat));
    assert.equal(r.winnerDeck,seatDeck[r.winnerSeat]);
    assert.equal(r[`hpSeat${1-r.winnerSeat}`],0);
    wins[seatDeck[r.winnerSeat]]++;seatWins[r.winnerSeat]++;
  }
  assert.deepEqual(starts,[n/2,n/2]);
  assert.deepEqual(wins,analysis[key].decks.map(d=>d.wins));
  assert.equal(errors,analysis[key].technicalErrors);
  assert.equal(draws,analysis[key].draws);
  assert.equal(seatWins[0],analysis[key].seat0.wins);
  checks.push({sample:prefix,attempts:n,starts,wins,seatWins,errors,draws,allChecksPassed:true});
}
await fs.writeFile(`${dir}/verification.json`,JSON.stringify({checks},null,2));
console.log(JSON.stringify(checks,null,2));
