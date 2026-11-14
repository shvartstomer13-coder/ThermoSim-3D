import { writeFileSync } from 'node:fs';
import { assetChecklist } from '../src/ui/checklist';
writeFileSync('docs/ASSET_CHECKLIST.md', '# GLB asset checklist\n\n```text\n' + assetChecklist() + '\n```\n');
