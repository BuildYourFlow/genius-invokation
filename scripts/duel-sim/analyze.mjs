import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir='results/duel-sim';
const read=name=>fs.readFile(`${dir}/${name}`,'utf8').then(JSON.parse);
const write=(name,data)=>fs.writeFile(`${dir}/${name}`,JSON.stringify(data,null,2));
export function wilson(w,n) {
  if(!n) return [0,1];
  const z=1.959963984540054, p=w/n, den=1+z*z/n;
  const mid=(p+z*z/(2*n))/den;
  const half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return [Math.max(0,mid-half),Math.min(1,mid+half)];
}
function dist(values) {
  const a=[...values].sort((a,b)=>a-b), n=a.length;
  return {n,mean:a.reduce((s,x)=>s+x,0)/n,median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,p95:a[Math.ceil(.95*n)-1],min:a[0],max:a[n-1]};
}
function binomial(w,n) { return {wins:w,n,winrate:n?w/n:null,wilson95:wilson(w,n)}; }
function summary(rows) {
  const valid=rows.filter(r=>!r.technicalError && r.terminalPhase==='gameEnd');
  const decisive=valid.filter(r=>r.winnerDeck!==null);
  const decks=[0,1].map(d=>{
    const subset=start=>decisive.filter(r=>(r.seatSwap?1:0)===(start?d:1-d));
    const first=subset(true), second=subset(false);
    const a=binomial(first.filter(r=>r.winnerDeck===d).length,first.length);
    const b=binomial(second.filter(r=>r.winnerDeck===d).length,second.length);
    return {...binomial(decisive.filter(r=>r.winnerDeck===d).length,decisive.length),first:a,second:b,firstMinusSecond:a.winrate-b.winrate};
  });
  return {
    attempts:rows.length,valid:valid.length,decisive:decisive.length,
    draws:valid.length-decisive.length,technicalErrors:rows.filter(r=>r.technicalError).length,
    nonterminal:rows.filter(r=>r.terminalPhase!=='gameEnd').length,decks,
    seat0:binomial(decisive.filter(r=>r.winnerSeat===0).length,decisive.length),
    rounds:dist(valid.map(r=>r.round)),durationMs:dist(valid.map(r=>r.durationMs)),
    actions:valid.reduce((all,r)=>{for(const p of r.playerMetrics) for(const [kind,n] of Object.entries(p?.actions??{})) all[kind]=(all[kind]??0)+n; return all;},{}),
  };
}
async function sample(prefix,count,baseSeed) {
  const shards=await Promise.all(Array.from({length:count},(_,i)=>read(`${prefix}-${i}.json`)));
  const rows=shards.flatMap(s=>s.games).sort((a,b)=>a.game-b.game);
  assert.equal(rows.length,count*100);
  const fingerprints=new Set(shards.map(s=>JSON.stringify(s.hashes)));
  assert.equal(fingerprints.size,1,'Source changed between shards');
  for(const [i,r] of rows.entries()) {
    assert.equal(r.game,i); assert.equal(r.seed,baseSeed+i); assert.equal(r.seatSwap,i%2===1);
    if(!r.technicalError) assert.equal(r.terminalPhase,'gameEnd');
    if(r.technicalError) assert.equal(r.winnerDeck,null);
  }
  await fs.writeFile(`${dir}/${prefix}-raw.jsonl`,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  return {rows,summary:summary(rows),metadata:{hashes:shards[0].hashes,nodeVersion:shards[0].nodeVersion,version:shards[0].version,coreVersion:shards[0].coreVersion}};
}
const primary=await sample('main',20,710000);
const sensitivity=await sample('sensitivity',4,810000);
const probeFiles = await Promise.all([0,1].map(async i => {
  try { return await read(`benchmark-${i}.json`); } catch(e) { if(e.code === 'ENOENT') return null; throw e; }
}));
const probeRows=probeFiles.flatMap(s=>s?.rows??[]);
const probeValid=probeRows.filter(r=>!r.technicalError && r.resourceWin!==null);
const strength={
  attempts:probeRows.length,technicalErrors:probeRows.filter(r=>r.technicalError).length,
  pooled:binomial(probeValid.filter(r=>r.resourceWin).length,probeValid.length),
  byDeck:[0,1].map(i=>{const rows=probeValid.filter(r=>r.deckIndex===i);return binomial(rows.filter(r=>r.resourceWin).length,rows.length);}),
};
strength.demonstratedStronger=strength.attempts===200 && strength.technicalErrors===0 && strength.pooled.wilson95[0]>.5 && strength.byDeck.every(s=>s.winrate>=.5);
await write('policy-strength.json',strength);
const halves=[summary(primary.rows.slice(0,1000)),summary(primary.rows.slice(1000))];
const anonymousA=createHash('sha256').update('duel-blind-20260912').digest()[0]%2;
function anonymous(s) {const {decks,...stats}=s;return {...stats,A:decks[anonymousA],B:decks[1-anonymousA]};}
await write('blind-input.json',{primary:anonymous(primary.summary),sensitivity:anonymous(sensitivity.summary),primaryHalves:halves.map(anonymous)});
const judge=spawnSync(process.execPath,['scripts/duel-sim/judge.mjs',`${dir}/blind-input.json`,`${dir}/blind-verdict.json`],{stdio:'inherit',windowsHide:true});
assert.equal(judge.status,0,'Blind judge failed');
// Mapping is written only AFTER the isolated statistics-only judge has exited.
const labels=['Venti / Hydro Tulpa / Black Serpent Knight: Windcutter','Kirara / Keqing / Jadeplume Terrorshroom'];
const verdict=await read('blind-verdict.json');
await write('reveal.json',{seed:'duel-blind-20260912',algorithm:'SHA256 first byte modulo 2',A:{deck:anonymousA,label:labels[anonymousA]},B:{deck:1-anonymousA,label:labels[1-anonymousA]},revealedAfterVerdict:true,createdAt:new Date().toISOString()});
await write('analysis.json',{primary:primary.summary,sensitivity:sensitivity.summary,primaryHalves:halves,metadata:primary.metadata});
const pct=x=>(x*100).toFixed(2)+' %';
const ci=a=>a.map(pct).join('–');
const row=(label,s,d)=>`| ${label} | ${s.decks[d].wins}/${s.decisive} | ${pct(s.decks[d].winrate)} | ${ci(s.decks[d].wilson95)} | ${pct(s.decks[d].first.winrate)} | ${pct(s.decks[d].second.winrate)} |`;
const winner=['A','B'].includes(verdict.verdict)?labels[verdict.verdict==='A'?anonymousA:1-anonymousA]:verdict.verdict;
const report=`# Rapport final — duels réels v7.0.0\n\nVerdict du juge statistique aveugle : **${verdict.verdict}**. Après révélation : **${winner}**. Ce verdict porte uniquement sur ces politiques et ce duel entre deux decks.\n\n## Exécution et intégrité\n\nMoteur open source core ${primary.metadata.coreVersion}, données ${primary.metadata.version}, exécution locale ${primary.metadata.nodeVersion}. Campagne principale : ${primary.summary.attempts} tentatives, ${primary.summary.valid} parties valides, ${primary.summary.technicalErrors} erreurs techniques, ${primary.summary.draws} nulles. Sensibilité : ${sensitivity.summary.attempts} tentatives, ${sensitivity.summary.valid} valides, ${sensitivity.summary.technicalErrors} erreurs et ${sensitivity.summary.draws} nulles. Les erreurs historiques du run 34683327214 sont exclues de ces échantillons.\n\nDéparts alternés strictement par indice : 1000 par deck dans le principal, 200 dans la sensibilité. Seeds principales 710000–711999 ; sensibilité 810000–810399. Les smoke tests 700012–700031 sont exclus. Les résultats bruts et les empreintes des scripts sont conservés.\n\n## Résultats\n\n| Échantillon et deck | Victoires / décisives | Winrate | Wilson 95 % | En premier | En second |\n|---|---:|---:|---|---:|---:|\n${row('Principal — '+labels[0],primary.summary,0)}\n${row('Principal — '+labels[1],primary.summary,1)}\n${row('Sensibilité — '+labels[0],sensitivity.summary,0)}\n${row('Sensibilité — '+labels[1],sensitivity.summary,1)}\n\nPremier joueur, tous decks réunis : **${pct(primary.summary.seat0.winrate)}**, Wilson 95 % **${ci(primary.summary.seat0.wilson95)}**. Effet premier moins second pour le deck 0 : ${(100*primary.summary.decks[0].firstMinusSecond).toFixed(2)} points ; pour le deck 1 : ${(100*primary.summary.decks[1].firstMinusSecond).toFixed(2)} points.\n\n## Durée et rounds\n\nPrincipal : rounds moyens ${primary.summary.rounds.mean.toFixed(2)}, médiane ${primary.summary.rounds.median}, p95 ${primary.summary.rounds.p95}, extrêmes ${primary.summary.rounds.min}–${primary.summary.rounds.max}. Temps par partie : moyenne ${(primary.summary.durationMs.mean/1000).toFixed(2)} s, médiane ${(primary.summary.durationMs.median/1000).toFixed(2)} s, p95 ${(primary.summary.durationMs.p95/1000).toFixed(2)} s. Ce sont des temps de calcul sous charge parallèle, pas des durées de jeu humaines.\n\nSensibilité : rounds moyens ${sensitivity.summary.rounds.mean.toFixed(2)}, médiane ${sensitivity.summary.rounds.median}, p95 ${sensitivity.summary.rounds.p95}. Les distributions complètes résumées figurent dans analysis.json.\n\n## Sensibilité et limites\n\nWinrate du deck 0, première moitié : ${pct(halves[0].decks[0].winrate)} (${ci(halves[0].decks[0].wilson95)}) ; seconde moitié : ${pct(halves[1].decks[0].winrate)} (${ci(halves[1].decks[0].wilson95)}). Verdict aveugle du second échantillon : ${verdict.sensitivityVerdict}. La politique resource est une variante plus riche, sans supériorité démontrée : cet échantillon mesure la sensibilité, pas une validation par IA optimale.\n\nLes politiques sont strictement identiques pour les deux decks et n'accèdent qu'aux informations autorisées au joueur. Elles restent heuristiques : choix de cartes et mulligan rudimentaires, pas de recherche stratégique profonde, prise en compte incomplète des synergies et effets différés. Les intervalles couvrent l'aléa des parties à politique fixe, pas cette incertitude stratégique ni les éventuels écarts du moteur au client officiel. Les analyses secondaires sont descriptives.\n\n## Aveugle et révélation\n\nSeed d'anonymisation : duel-blind-20260912. A = ${labels[anonymousA]}. B = ${labels[1-anonymousA]}. Le programme judge.mjs a reçu exclusivement blind-input.json et a enregistré blind-verdict.json avant la création de reveal.json. C'est un juge statistique déterministe aux règles préfixées, pas un avis humain indépendant.\n\n## Reproduction\n\nAprès compilation des paquets du workflow : lancer node scripts/duel-sim/campaign.mjs, puis node scripts/duel-sim/analyze.mjs. Le workflow manuel propose aussi full_campaign. Consulter scripts/duel-sim/METHODOLOGY.md pour le protocole complet ; main-raw.jsonl et sensitivity-raw.jsonl pour toutes les parties.\n`;
await fs.writeFile(`${dir}/REPORT.md`,report);
const exclusion=await read('excluded-unseeded/EXCLUSION.json').catch(()=>null);
const runtime=await read('cross-runtime.json').catch(()=>null);
await fs.appendFile(`${dir}/REPORT.md`, `\n## Contrôles supplémentaires\n\nContrôle miroir de force : ${strength.attempts} tentatives, ${strength.technicalErrors} erreurs techniques. Variante resource : ${strength.pooled.wins}/${strength.pooled.n}, ${pct(strength.pooled.winrate)} (Wilson 95 % ${ci(strength.pooled.wilson95)}). Par deck : ${strength.byDeck.map(s=>`${s.wins}/${s.n}`).join(' ; ')}. Supériorité démontrée selon le critère préfixé : **${strength.demonstratedStronger?'oui':'non'}**. Aucune seconde politique plus forte n'a donc été établie par ce contrôle ; le deuxième échantillon reste une analyse de sensibilité.\n\n${exclusion?`${exclusion.completedRows} parties terminées de la première campagne ont été entièrement exclues : le mélange initial n'était pas reproductible. Les lignes conservées dans excluded-unseeded ne contribuent à aucun winrate présenté. Les tentatives en cours lors de l'arrêt ne sont pas comptées comme parties terminées.`:''}\n\n${runtime?`Comparaison des 20 smoke tests entre Windows ${runtime.local} et GitHub Linux ${runtime.github} : ${runtime.equal?'identiques pour tous les champs de jeu enregistrés hors durée':'différences détectées'}. Run GitHub : https://github.com/BuildYourFlow/genius-invokation/actions/runs/${runtime.run}.`:'Le contrôle entre runtimes est disponible séparément si exécuté.'}\n`);
console.log(JSON.stringify({primary:primary.summary,sensitivity:sensitivity.summary,verdict,winner},null,2));
