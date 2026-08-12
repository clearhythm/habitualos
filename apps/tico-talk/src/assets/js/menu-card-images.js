// Static manifest of per-dish reference images for the Review study-card
// view (see menu-study-cards.js). A section only gets the card view when
// EVERY item in it has an entry here — partial coverage falls back to the
// existing plain-text Review list untouched, so sections/restaurants
// without images are never affected by this file's existence.
export const MENU_CARD_IMAGES = {
  petes: {
    Pasta: {
      'tagliatelle-lobster-cream': '/assets/images/menu-cards/petes/tagliatelle-lobster-cream.webp',
      'squid-pasta-puttanesca': '/assets/images/menu-cards/petes/squid-pasta-puttanesca.webp',
      'clams-with-pasta': '/assets/images/menu-cards/petes/clams-with-pasta.webp'
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
