import fs from "node:fs/promises";
import path from "node:path";
import dataFactory from "../../packages/data/dist/index.js";
import { Game, CORE_VERSION, createRpcResponse } from "../../packages/core/dist/index.js";
import { staticDecode } from "../../packages/assets-manager/dist/index.js";

const VERSION = "v7.0.0";
const DECK_CODES = [
  "AoBi6AsPJSBi8mkPJkCS9A4TCbFwO5cdCrFA26QgEzIxBjMgDWLialsmDqFw1OcdDkAA",
  "FbAA6xwOA8DA7JcPCUBw9KQPE1Ax9jMPFWFxCFcTG7GRO7kZDVGQ29kdJbEi1FwdDkAA",
];
const GAMES = Number(process.env.GAMES ?? 20);
const BASE_SEED = Number(process.env.BASE_SEED ?? 700012);
const outDir = path.resolve("results/duel-sim");
await fs.mkdir(outDir, { recursive: true });

const decks = DECK_CODES.map(staticDecode);
for (const [i, deck] of decks.entries()) {
  if (deck.characters.length !== 3 || deck.cards.length !== 30) {
    throw new Error(`Deck ${i + 1} decoded to ${deck.characters.length} characters / ${deck.cards.length} cards`);
  }
}

function hpOf(player) {
  return player.characters.reduce((sum, ch) => sum + Math.max(0, Number(ch.variables?.health ?? 0)), 0);
}

function previewScore(action) {
  let score = 0;
  for (const p of action.preview ?? []) {
    const m = p.mutation;
    if (!m) continue;
    if (m.$case === "damage") {
      const d = m.value;
      score += Number(d.value ?? 0) * 5;
      if (d.causeDefeated) score += 20;
      if (Number(d.reactionType ?? 0) !== 0) score += 3;
    } else if (m.$case === "createEntity") {
      score += 2;
    } else if (m.$case === "removeEntity") {
      score += 1;
    } else if (m.$case === "applyAura") {
      score += 1;
    }
  }
  return score;
}

function actionKind(action) {
  return action.action?.$case ?? "unknown";
}

function genericActionScore(action, index) {
  if (Number(action.validity ?? 0) !== 0) return -1e9;
  const kind = actionKind(action);
  const kindBase = {
    useSkill: 35,
    playCard: 18,
    switchActive: 7,
    elementalTuning: 5,
    declareEnd: -20,
  }[kind] ?? 0;
  const cost = (action.autoSelectedDice ?? []).length;
  const fastBonus = action.isFast ? 2 : 0;
  const effectlessPenalty = kind === "playCard" && action.action?.value?.willBeEffectless ? -50 : 0;
  return kindBase + previewScore(action) + fastBonus - 0.15 * cost + effectlessPenalty - index * 1e-6;
}

function makePlayerIO(who) {
  let latestState = null;
  return {
    notify(notification) {
      latestState = notification.state ?? latestState;
    },
    async rpc(request) {
      const req = request.request;
      if (!req) throw new Error("RPC request missing oneof payload");
      switch (req.$case) {
        case "switchHands":
          return createRpcResponse("switchHands", { removedHandIds: [] });
        case "chooseActive":
          return createRpcResponse("chooseActive", { activeCharacterId: req.value.candidateIds[0] });
        case "rerollDice": {
          const dice = latestState?.player?.[who]?.dice ?? [];
          return createRpcResponse("rerollDice", { diceToReroll: [...dice] });
        }
        case "selectCard":
          return createRpcResponse("selectCard", { selectedDefinitionId: req.value.candidateDefinitionIds[0] });
        case "action": {
          const actions = req.value.action;
          let bestIndex = -1;
          let bestScore = -Infinity;
          actions.forEach((a, i) => {
            const s = genericActionScore(a, i);
            if (s > bestScore) {
              bestScore = s;
              bestIndex = i;
            }
          });
          if (bestIndex < 0) throw new Error("No legal action candidate");
          const chosen = actions[bestIndex];
          return createRpcResponse("action", {
            chosenActionIndex: bestIndex,
            usedDice: [...(chosen.autoSelectedDice ?? [])],
          });
        }
        default:
          throw new Error(`Unknown RPC method ${req.$case}`);
      }
    },
  };
}

const gameData = dataFactory(VERSION);
const results = [];
let technicalErrors = 0;

for (let i = 0; i < GAMES; i++) {
  const seatSwap = i % 2 === 1;
  const seatDecks = seatSwap ? [decks[1], decks[0]] : [decks[0], decks[1]];
  const seed = BASE_SEED + i;
  const state = Game.createInitialState({
    decks: seatDecks,
    data: gameData,
    versionBehavior: VERSION,
    randomSeed: seed,
  });
  const game = new Game(state, { errorLevel: "strict" });
  game.players[0].io = makePlayerIO(0);
  game.players[1].io = makePlayerIO(1);
  let ioError = null;
  game.onIoError = (e) => {
    ioError = { message: e.message, who: e.who };
  };
  try {
    const winnerSeat = await game.start();
    if (ioError) technicalErrors++;
    const winnerDeck = winnerSeat === null ? null : (seatSwap ? 1 - winnerSeat : winnerSeat);
    results.push({
      game: i,
      seed,
      seatSwap,
      winnerSeat,
      winnerDeck,
      round: game.state.roundNumber,
      hpSeat0: hpOf(game.state.players[0]),
      hpSeat1: hpOf(game.state.players[1]),
      technicalError: ioError,
    });
  } catch (e) {
    technicalErrors++;
    results.push({
      game: i,
      seed,
      seatSwap,
      winnerSeat: null,
      winnerDeck: null,
      round: game.state.roundNumber,
      hpSeat0: hpOf(game.state.players[0]),
      hpSeat1: hpOf(game.state.players[1]),
      technicalError: { message: e instanceof Error ? e.stack ?? e.message : String(e) },
    });
  }
  if ((i + 1) % 5 === 0) console.log(`completed ${i + 1}/${GAMES}`);
}

const valid = results.filter((r) => !r.technicalError && r.winnerDeck !== null);
const summary = {
  experiment: "smoke",
  version: VERSION,
  coreVersion: CORE_VERSION,
  requestedGames: GAMES,
  completedValidGames: valid.length,
  technicalErrors,
  deckAudit: decks.map((d, i) => ({
    deck: i,
    code: DECK_CODES[i],
    characters: d.characters,
    cards: d.cards,
    characterCount: d.characters.length,
    cardCount: d.cards.length,
  })),
  wins: [0, 1].map((d) => valid.filter((r) => r.winnerDeck === d).length),
  games: results,
};
await fs.writeFile(path.join(outDir, "smoke.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  version: summary.version,
  coreVersion: summary.coreVersion,
  requestedGames: summary.requestedGames,
  completedValidGames: summary.completedValidGames,
  technicalErrors: summary.technicalErrors,
  wins: summary.wins,
  deckAudit: summary.deckAudit,
}, null, 2));

if (technicalErrors > 0 || valid.length !== GAMES) process.exitCode = 2;
