import dbCore from "@habitualos/db-core";

// Global data: fetches every restaurant + its menu from Firestore
// (restaurants/{id}, restaurant-menus/{id}) and exposes them as
// `restaurants` in templates. This is the same source both static pages
// and learn-chat-init.cjs's runtime prompt ultimately read from — see
// docs/VISION.md's Data Principle.
//
// restaurant-menus/{id} storage shape (console-readability driven —
// see Ticket 4 discussion):
//   food:   { categories: [{_id, name}], items: [{_id, category, _name, ...}] }
//   drinks: { categories: [{_id, name}], items: [{_id, category, _name, ...}] }
// where each item's `category` is the owning category's `_id`. This
// function reconstructs the flat storage shape into the
// `[{name, items: [...]}]` shape every template already expects
// (`renderCategories` and friends) — templates never see `_id`/`_name`
// or the category/items split, only `restaurant.food`/`restaurant.drinks`.
function buildCategoryList(section) {
  const itemsByCategory = new Map();
  section.items.forEach((item) => {
    const list = itemsByCategory.get(item.category) || [];
    list.push({
      name: item._name,
      description: item.description,
      price: item.price,
      tags: item.tags,
      allergens: item.allergens,
      notes: item.notes,
    });
    itemsByCategory.set(item.category, list);
  });

  const orphaned = section.items.filter((item) => !section.categories.some((c) => c._id === item.category));
  if (orphaned.length) {
    console.error("[restaurants.js] orphaned item category reference(s):", orphaned.map((i) => `${i._id} -> "${i.category}"`));
  }

  return section.categories.map((category) => ({
    name: category.name,
    items: itemsByCategory.get(category._id) || [],
  }));
}

export default async function () {
  const restaurants = await dbCore.query({ collection: "restaurants" });
  if (!restaurants.length) {
    throw new Error("No restaurants found in Firestore — run the seed script (Ticket 4) first.");
  }
  return Promise.all(
    restaurants.map(async (restaurant) => {
      const menu = await dbCore.get({ collection: "restaurant-menus", id: restaurant.id });
      return {
        ...restaurant,
        food: buildCategoryList(menu.food),
        drinks: buildCategoryList(menu.drinks),
      };
    })
  );
}
