//
// netlify/functions/_services/db-restaurants.cjs
// ------------------------------------------------------
// Cached accessor for restaurant + menu data. Same Firestore docs
// Eleventy reads at build time (src/_data/restaurants.js) — this is the
// runtime (Netlify Function) side, cached per warm instance so a chat
// turn doesn't cost a Firestore read on top of the Anthropic call.
//
// restaurant-menus/{id} storage shape (console-readability driven — see
// Ticket 4 discussion):
//   food:   { categories: [{_id, name}], items: [{_id, category, _name, ...}] }
//   drinks: { categories: [{_id, name}], items: [{_id, category, _name, ...}] }
// where each item's `category` is the owning category's `_id`.
// buildCategoryList reconstructs the flat storage shape into the
// `[{name, items: [...]}]` shape learn-chat-init.cjs expects — same
// reconstruction as src/_data/restaurants.js, duplicated because the two
// files live in different module systems (ESM build-time vs. CJS
// runtime), not worth a shared package for one small pure function.
// ------------------------------------------------------

const dbCore = require('@habitualos/db-core');

let cache = null; // Map<restaurantId, {id, name, clientele, food, drinks}> | null

function buildCategoryList(section) {
  const itemsByCategory = new Map();
  section.items.forEach((item) => {
    const list = itemsByCategory.get(item.category) || [];
    list.push({
      id: item._id,
      name: item._name,
      description: item.description,
      price: item.price,
      tags: item.tags,
      allergens: item.allergens,
      notes: item.notes,
      // Staff-only pour ratios/method — never printed on the guest-facing
      // menu, unlike description. Only drinks have this today. Flows
      // through the same as notes: available to the drill prompt and the
      // Review card, but renderCategoryList never reads it for the
      // guest-facing browse list.
      recipe: item.recipe
    });
    itemsByCategory.set(item.category, list);
  });

  const orphaned = section.items.filter((item) => !section.categories.some((c) => c._id === item.category));
  if (orphaned.length) {
    console.error('[db-restaurants] orphaned item category reference(s):', orphaned.map((i) => `${i._id} -> "${i.category}"`));
  }

  return section.categories.map((category) => ({
    name: category.name,
    items: itemsByCategory.get(category._id) || []
  }));
}

async function loadAll() {
  if (cache) return cache;
  const restaurants = await dbCore.query({ collection: 'restaurants' });
  const entries = await Promise.all(restaurants.map(async (r) => {
    const menu = await dbCore.get({ collection: 'restaurant-menus', id: r.id });
    return [r.id, { ...r, food: buildCategoryList(menu.food), drinks: buildCategoryList(menu.drinks) }];
  }));
  cache = new Map(entries);
  return cache;
}

exports.getRestaurant = async (restaurantId) => {
  const all = await loadAll();
  const restaurant = all.get(restaurantId);
  if (!restaurant) throw new Error(`Unknown restaurant: ${restaurantId}`);
  return restaurant;
};

// Forces the next getRestaurant() call to re-read Firestore instead of
// serving the warm instance's stale snapshot — see admin-cache-reset.cjs.
exports.resetCache = () => {
  cache = null;
};
