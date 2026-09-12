import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
const concurrency = Math.min(8, os.availableParallelism());
const jobs = [
  ...Array.from({length:20}, (_,i)=>({name:`main-${i}`,policy:'greedy',seed:710000,offset:100*i,games:100})),
  ...Array.from({length:4}, (_,i)=>({name:`sensitivity-${i}`,policy:'resource',seed:810000,offset:100*i,games:100})),
];
await fs.mkdir('results/duel-sim', { recursive:true });
await fs.writeFile('results/duel-sim/campaign-plan.json', JSON.stringify({concurrency,jobs},null,2));
let failed = false;
async function worker() {
  while (jobs.length) {
    const job=jobs.shift();
    const log=await fs.open(`results/duel-sim/${job.name}.log`,'w');
    const child=spawn(process.execPath,['scripts/duel-sim/run.mjs'],{
      env:{...process.env,GAMES:String(job.games),BASE_SEED:String(job.seed),OFFSET:String(job.offset),POLICY:job.policy,EXPERIMENT:job.name},
      stdio:['ignore',log.fd,log.fd],windowsHide:true,
    });
    const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
    await log.close();
    console.log(`${job.name} exited ${code}`);
    if(code!==0) { failed=true; jobs.length=0; }
  }
}
await Promise.all(Array.from({length:concurrency},worker));
if(failed) process.exitCode=2;
