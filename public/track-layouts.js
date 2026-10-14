// Authored control points, not variations of one loop. Start/finish is always
// in the middle of a straight; the last straight also holds the six-place grid.
const layouts = {
  neon: [[-20,-58],[35,-58],[55,-40],[55,-12],[29,-12],[23,8],[49,24],[44,51],[20,65],[-14,65],[-33,47],[-33,23],[-57,12],[-64,-14],[-59,-43],[-44,-58]],
  coast: [[-22,-56],[22,-56],[44,-43],[48,-16],[33,4],[48,29],[37,51],[12,64],[-16,60],[-35,44],[-59,37],[-70,16],[-62,-7],[-36,-12],[-43,-36],[-42,-56]],
  metro: [[-24,-62],[32,-62],[53,-44],[53,-18],[31,-1],[48,22],[42,48],[21,58],[-4,48],[-6,18],[-29,11],[-33,44],[-55,43],[-65,22],[-65,-39],[-47,-62]],
  garden: [[-24,-60],[25,-60],[49,-45],[59,-19],[46,1],[19,5],[10,24],[21,43],[3,61],[-24,58],[-48,43],[-62,20],[-60,-3],[-42,-16],[-31,-37],[-47,-49],[-46,-60]],
  orbit: [[-23,-65],[31,-65],[59,-43],[67,-14],[54,13],[26,19],[26,45],[7,65],[-22,68],[-44,51],[-52,29],[-36,10],[-62,-7],[-73,-29],[-63,-52],[-44,-65]],
};

// Quadratic corner fillets, shared by renderer, collision and AI. No visual-only
// spline: the road the player sees is exactly the road the server simulates.
function roundCorners(points) {
  return points.flatMap((p, i) => {
    if (i === 0) return [p];
    const a = points[(i - 1 + points.length) % points.length], b = points[(i + 1) % points.length];
    const before = Math.hypot(p[0] - a[0], p[1] - a[1]), after = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const cut = Math.min(11, before * .32, after * .32);
    const enter = p.map((v, j) => v + (a[j] - v) * cut / before);
    const leave = p.map((v, j) => v + (b[j] - v) * cut / after);
    return Array.from({ length: 7 }, (_, step) => {
      const t = step / 6;
      return p.map((v, j) => (1 - t) ** 2 * enter[j] + 2 * (1 - t) * t * v + t ** 2 * leave[j]);
    });
  });
}

export function longLayout(points, targetLength) {
  const rounded=roundCorners(points);
  const length=rounded.reduce((n,p,i)=>n+Math.hypot(p[0]-rounded[(i+1)%rounded.length][0],p[1]-rounded[(i+1)%rounded.length][1]),0);
  return rounded.map(p=>p.map(v=>v*targetLength/length));
}
export const trackLayouts = Object.fromEntries(Object.entries(layouts).map(([id, points]) => [id, roundCorners(points)]));
