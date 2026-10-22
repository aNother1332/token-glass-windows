'use strict';

// One entry per user turn, never per model/tool request.
class Activity {
  constructor() { this.turns = new Map(); this.manualPanel = false; this.muted = false; }
  receive(event) {
    const key = `${event.source}:${event.session}`;
    if (event.kind === 'start') {
      this.muted = false;
      this.turns.set(key, { ...event, since: event.at || Date.now() });
    } else if (event.kind === 'stop') {
      const turn = this.turns.get(key);
      if (turn && (!event.turn || !turn.turn || event.turn === turn.turn) && (event.at || Date.now()) >= turn.since) this.turns.delete(key);
    }
    return this.turns.size;
  }
  get canExit() { return !this.manualPanel && this.turns.size === 0; }
  get active() { return [...this.turns.values()]; }
}
function safeEvent(raw) {
  if (!raw || !['codex', 'zcode'].includes(raw.source) || !['start','stop'].includes(raw.kind)) throw new Error('Invalid hook event');
  const id = String(raw.session || '').slice(0, 200);
  if (!id) throw new Error('Missing session identity');
  const at=Number(raw.at);
  return { source:raw.source, kind:raw.kind, session:id, turn:String(raw.turn || '').slice(0,200), at:Number.isFinite(at)?at:Date.now(), hostPid:Number(raw.hostPid)||null };
}
module.exports = { Activity, safeEvent };
