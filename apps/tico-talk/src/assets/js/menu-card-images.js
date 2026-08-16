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
import maineLobsterRoll from '../images/menu-cards/petes/maine-lobster-roll.webp';
import wagyuSmashburger from '../images/menu-cards/petes/wagyu-smashburger.webp';
import shrimpWhiteCheddarGrits from '../images/menu-cards/petes/shrimp-white-cheddar-grits.webp';
import steamedClams from '../images/menu-cards/petes/steamed-clams.webp';
import grilledBranzino from '../images/menu-cards/petes/grilled-branzino.webp';
import localKingSalmon from '../images/menu-cards/petes/local-king-salmon.webp';
import filetMignon from '../images/menu-cards/petes/filet-mignon.webp';
import gardenGimlet from '../images/menu-cards/petes/garden-gimlet.webp';
import lycheeMartini from '../images/menu-cards/petes/lychee-martini.webp';
import pomegranateCosmo from '../images/menu-cards/petes/pomegranate-cosmo.webp';
import almostFamous from '../images/menu-cards/petes/almost-famous.webp';
import espressoMartini from '../images/menu-cards/petes/espresso-martini.webp';
import spicedOldFashioned from '../images/menu-cards/petes/spiced-old-fashioned.webp';
import buildYourOwnMartini from '../images/menu-cards/petes/build-your-own-martini.webp';
import aperolSpritz from '../images/menu-cards/petes/aperol-spritz.webp';

export const MENU_CARD_IMAGES = {
  petes: {
    Pasta: {
      'tagliatelle-lobster-cream': tagliatelleLobsterCream,
      'squid-pasta-puttanesca': squidPastaPuttanesca,
      'clams-with-pasta': clamsWithPasta
    },
    Mains: {
      'maine-lobster-roll': maineLobsterRoll,
      'wagyu-smashburger': wagyuSmashburger,
      'shrimp-white-cheddar-grits': shrimpWhiteCheddarGrits,
      'steamed-clams': steamedClams,
      'grilled-branzino': grilledBranzino,
      'local-king-salmon': localKingSalmon,
      'filet-mignon': filetMignon
    },
    'House Cocktails': {
      'garden-gimlet': gardenGimlet,
      'lychee-martini': lycheeMartini,
      'pomegranate-cosmo': pomegranateCosmo,
      'almost-famous': almostFamous,
      'espresso-martini': espressoMartini,
      'spiced-old-fashioned': spicedOldFashioned,
      'build-your-own-martini': buildYourOwnMartini,
      'aperol-spritz': aperolSpritz
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

// Prep/ratio diagram images (Preparation face only, drinks) — a separate,
// optional-per-item manifest, not gated section-wide like MENU_CARD_IMAGES
// above (a section can have hero images for every item while only some
// items also have a prep diagram). Just one entry right now (Pomegranate
// Cosmo) — a rough placeholder Erik wanted to see in context before
// deciding whether to reproduce it for the rest, see the "too artistic" /
// color-linking feedback in conversation. Real ES import, same reason as
// MENU_CARD_IMAGES — a plain path string gets dropped by Vite in prod.
import pomegranateCosmoPrep from '../images/menu-cards/petes/pomegranate-cosmo-prep.webp';

const PREP_IMAGES = {
  petes: {
    'pomegranate-cosmo': pomegranateCosmoPrep
  }
};

export function prepImageForItem(restaurantId, itemId) {
  return PREP_IMAGES[restaurantId]?.[itemId] || null;
}

// Rough, eyeballed tap regions (of the prep image's own width) for where
// each bottle sits — one entry per index in that item's recipe.ingredients
// array, same order (see menu-study-cards.js's interactive tap-to-highlight
// overlay). `left`/`right` are a full-height vertical band (percent of
// image width) rather than a small circular target around a point —
// closer to the actual bottle's own footprint, and a much more forgiving
// tap target on a rough placeholder image. Bands are contiguous (each
// one's `right` is the next one's `left`) so every tap on the image lands
// on exactly one ingredient. No badges shown by default — tapping reveals
// one badge, centered over the tapped band, near the top of the image
// (see .study-card__prep-badge) so it clears every bottle's own printed
// label. Estimated by eye against the cropped (bottles-only) image —
// expect nudging once seen live.
const PREP_IMAGE_BOTTLE_POSITIONS = {
  petes: {
    'pomegranate-cosmo': [
      { left: 0,  right: 27 },  // 1.5 oz Tito's
      { left: 48, right: 65 },  // 1 oz pomegranate juice
      { left: 27, right: 48 },  // 0.5 oz Cointreau
      { left: 65, right: 81 },  // 0.5 oz fresh lime juice
      { left: 81, right: 100 }  // 0.5 oz simple syrup
    ]
  }
};

export function prepImagePositionsForItem(restaurantId, itemId) {
  return PREP_IMAGE_BOTTLE_POSITIONS[restaurantId]?.[itemId] || null;
}
