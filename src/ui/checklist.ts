import { SPECS, defaultParams } from '../physics/components';

/** Structured list of the GLB files to source, generated from the live component registry (footprints + port coordinates). */
export function assetChecklist(): string {
  const lines: string[] = [];
  lines.push('GLB SOURCING CHECKLIST — one optional file per component type');
  lines.push('Conventions: metres, +Y up, origin at the centre of the floor footprint (X right, Z toward the viewer), glTF 2.0 binary (.glb),');
  lines.push('PBR metal/rough materials, ≤ 60k triangles each, baked pivots (no rotated parents), no cameras/lights/animations required.');
  lines.push('Ports are mapped in the Asset Manager by clicking the model, or name empty nodes “PORT_<id>” in your DCC tool as a reminder.\n');
  let n = 1;
  for (const s of Object.values(SPECS)) {
    if (s.type === 'pipe') continue;
    const p = defaultParams(s.type);
    lines.push(`[${String(n++).padStart(2, '0')}] ${s.type}.glb — ${s.label}`);
    lines.push(`     footprint W×H×D: ${s.footprint.join(' × ')} m`);
    for (const d of s.ports(p)) lines.push(`     PORT_${d.id.padEnd(8)} ${d.kind.padEnd(3)}  DN${String(d.dn).padEnd(4)} at (${d.pos.map((x) => x.toFixed(2)).join(', ')})  normal (${d.dir.join(', ')})${d.pass ? '  [pass 2]' : ''}`);
    lines.push(`     note: ${s.desc}\n`);
  }
  lines.push('Pipes, flanges, bolt rings and flow indicators are always generated procedurally (parametric), so no GLB is needed for them.');
  return lines.join('\n');
}
