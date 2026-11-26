import { runSeed } from '../src/db/seed/run';
import { sql } from '../src/db/client';

// Bundled entry for production (no tsx at runtime). Insert-only unless --update is passed.
runSeed({ update: process.argv.includes('--update') })
  .then(async (r) => {
    console.log(`Seeded ${r.taxonomy} taxonomy terms and ${r.events} events`);
    await sql.end();
  })
  .catch(async (err) => {
    console.error(err);
    await sql.end();
    process.exit(1);
  });
