// Static manifest of per-dish reference images for the Review study-card
// view (see menu-study-cards.js). A section only gets the card view when
// EVERY item in it has an entry here — partial coverage falls back to the
// existing plain-text Review list untouched, so sections/restaurants
// without images are never affected by this file's existence.
//
// Real ES module imports, not literal path strings — eleventy-plugin-vite
// only carries an image into the production build when it's statically
// referenced this way (or via a literal <img src="..."> in a template);
// a plain '/assets/images/...' string is invisible to Vite's asset graph
// and gets silently dropped from the deployed output (confirmed: it 404s
// in prod even though the file is committed and works in dev, where
// nothing gets bundled/dropped in the first place). Each import resolves
// to the real hashed build URL at runtime.
import tagliatelleLobsterCream from '../images/menu-cards/petes/tagliatelle-lobster-cream.webp';
import squidPastaPuttanesca from '../images/menu-cards/petes/squid-pasta-puttanesca.webp';
import clamsWithPasta from '../images/menu-cards/petes/clams-with-pasta.webp';

export const MENU_CARD_IMAGES = {
  petes: {
    Pasta: {
      'tagliatelle-lobster-cream': tagliatelleLobsterCream,
      'squid-pasta-puttanesca': squidPastaPuttanesca,
      'clams-with-pasta': clamsWithPasta
    }
  }
};

// Returns {itemId: imagePath} only if every item in `items` has an image;
// otherwise null (caller falls back to the plain list).
export function sectionCardImages(restaurantId, sectionName, items) {
  const images = MENU_CARD_IMAGES[restaurantId]?.[sectionName];
  if (!images) return null;
  return items.every((item) => images[item.id]) ? images : null;
}

// Single-item lookup, no all-or-nothing section gate — used by the
// Practice drill's missed-fact image scaffold (see learn-markers.js's
// IMAGE: marker), which wants "does THIS dish have one" regardless of
// whether the whole section qualifies for the Review card view.
export function imageForItem(restaurantId, sectionName, itemId) {
  return MENU_CARD_IMAGES[restaurantId]?.[sectionName]?.[itemId] || null;
}
