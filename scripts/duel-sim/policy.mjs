// Identical public-information heuristic for either seat. No character/card IDs
// or deck labels occur in this policy. No access to Game or hidden hands/piles.
export function makePolicy(who, createRpcResponse, elements, variant = 'greedy') {
  let state;
  let decisions = 0;
  const counts = {};
  const own = () => state.player[who];
  const element = ch => elements.get(ch.definitionId);
  const active = () => own().character.find(c => c.id === own().activeCharacterId);
  const rngTie = (i) => -i * 1e-7;
  function score(a, i) {
    if (a.validity !== 0) return -Infinity;
    const kind = a.action.$case;
    const payload = a.action.value;
    const mine = new Set(own().character.map(c => c.id));
    let value = 0;
    for (const { mutation: m } of a.preview) {
      if (!m) continue;
      const p = m.value;
      if (m.$case === 'damage') {
        const sign = mine.has(p.targetId) ? 1 : -1;
        value += sign * (p.newHealth - p.oldHealth) * 10;
        if (p.causeDefeated) value -= sign * 30;
      } else if (m.$case === 'createEntity') {
        value += (p.who === who ? 1 : -1) * (p.where === 3 ? 9 : 4);
      } else if (m.$case === 'modifyEntityVar' && mine.has(p.entityId) && p.variableName === 'energy') {
        value += (p.variableValue - p.oldValue) * 2;
      }
    }
    const cost = a.autoSelectedDice.length;
    value -= cost * 2;
    if (kind === 'useSkill') value += 2;
    if (kind === 'playCard') value += payload.willBeEffectless ? -1000 : 1;
    if (kind === 'declareEnd') value = 0;
    if (kind === 'switchActive') {
      const target = own().character.find(c => c.id === payload.characterId);
      const usable = ch => own().dice.filter(d => d === 8 || d === element(ch)).length;
      value += (usable(target) - usable(active())) * 3 - 5;
      if (variant === 'resource') value += (target.health - active().health) * 0.3;
    }
    if (kind === 'elementalTuning') {
      const useful = own().dice.filter(d => d === 8 || d === element(active())).length;
      value = useful < 3 && own().dice.length >= 3 ? 2 : -5;
    }
    if (variant === 'resource') {
      // A more resource-aware candidate; strength is tested, never assumed.
      if (kind === 'playCard' && !payload.willBeEffectless) value += a.isFast ? 3 : 0;
      if (kind === 'useSkill') value += cost ? 4 / cost : 4;
      const omniSpent = a.autoSelectedDice.filter(d => d === 8).length;
      value -= omniSpent * 0.5;
    }
    return value + rngTie(i);
  }
  return {
    metrics: () => ({ decisions, actions: counts }),
    notify(n) { state = n.state ?? state; },
    async rpc({ request: req }) {
      if (++decisions > 10000) throw Error('Decision limit exceeded');
      let result;
      switch (req.$case) {
        case 'switchHands': result = { removedHandIds: [] }; break;
        case 'chooseActive': {
          const candidates = own().character.filter(c => req.value.candidateIds.includes(c.id));
          const rank = c => c.health + own().dice.filter(d => d === 8 || d === element(c)).length * 2;
          candidates.sort((a, b) => rank(b) - rank(a));
          result = { activeCharacterId: candidates[0].id }; break;
        }
        case 'rerollDice': {
          const keep = element(active());
          result = { diceToReroll: own().dice.filter(d => d !== 8 && d !== keep) }; break;
        }
        case 'selectCard': result = { selectedDefinitionId: req.value.candidateDefinitionIds[0] }; break;
        case 'action': {
          const actions = req.value.action;
          const ranked = actions.map((a, i) => ({ a, i, score: score(a, i) })).filter(a => Number.isFinite(a.score));
          ranked.sort((a, b) => b.score - a.score);
          if (!ranked.length) throw Error('No legal action');
          const { a, i } = ranked[0];
          counts[a.action.$case] = (counts[a.action.$case] ?? 0) + 1;
          result = { chosenActionIndex: i, usedDice: [...a.autoSelectedDice] }; break;
        }
        default: throw Error(`Unknown RPC: ${req.$case}`);
      }
      return createRpcResponse(req.$case, result);
    },
  };
}
