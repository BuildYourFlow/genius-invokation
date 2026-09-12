// This process opens ONLY anonymous aggregate statistics. No deck mapping,
// runner, card definitions, raw matches or repository context is read.
import fs from 'node:fs/promises';
const input=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const clearWinner=s=>s.A.wilson95[0]>.5?'A':s.A.wilson95[1]<.5?'B':'inconclusive';
let verdict=clearWinner(input.primary);
if(input.primary.attempts!==2000 || input.primary.technicalErrors || input.primary.decisive!==2000) verdict='inconclusive';
const sensitivity=input.sensitivity?clearWinner(input.sensitivity):'unavailable';
if(['A','B'].includes(verdict) && ['A','B'].includes(sensitivity) && verdict!==sensitivity) verdict='policy-dependent';
const output={
  verdict,
  sensitivityVerdict:sensitivity,
  rule:'Primary Wilson 95% excludes 50%; opposite clear sensitivity winner means policy-dependent. Incomplete/errorful primary means inconclusive.',
  scope:'Only the supplied fixed-policy head-to-head experiment. No claim of optimal play or general ladder superiority.',
  primaryA:input.primary.A,
  createdAt:new Date().toISOString(),
};
await fs.writeFile(process.argv[3],JSON.stringify(output,null,2));
