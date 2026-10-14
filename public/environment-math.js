import { distanceToRoute } from './motion.js';

export function islandEdge(x, z) { const angle = Math.atan2(z, x); return 107 + Math.sin(angle * 5) * 7 + Math.sin(angle * 9) * 3; }
export function groundHeight(track, x, z, distance = distanceToRoute(x, z, track.route)) {
  const hills = Math.max(0, Math.min(1, (distance - 15) / 18));
  let y = Math.max(0, hills * (1.5 + Math.sin(x * .09) * Math.cos(z * .065) * 2.5 + Math.sin(z * .04 + x * .02) * 1.5));
  const r = Math.hypot(x, z), edge = track.cupId==='horizons' ? Math.max(...track.route.map(p=>Math.hypot(...p)))+45 : islandEdge(x, z);
  if (r > edge - 8) { const blend = Math.min(1, (r - edge + 8) / 10); y += (-7 - y) * blend; }
  return y;
}
