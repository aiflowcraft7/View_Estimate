/** Creates the public demo business: npm run db:seed */
import { ensureDemoBusiness } from "../src/lib/demo";

ensureDemoBusiness()
  .then((b) => {
    console.log(`Demo business ready: /q/${b.slug}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
