//
// netlify/functions/_services/db-users.cjs
// ------------------------------------------------------
// Minimal users collection — currently just the cross-device restaurant
// default (see restaurant.js's resolveInitialRestaurantId). Follows
// dreamscape's current convention (flat top-level fields, written via
// @habitualos/db-core's patch(), which upserts regardless of whether the
// doc already exists) rather than a nested profile.* + mergeFields shape.
//
// Schema:
//   users/{userId}
//   {
//     lastRestaurantId: string,
//     _updatedAt: Firestore timestamp
//   }
// ------------------------------------------------------

const { get, patch } = require('@habitualos/db-core');

const COLLECTION = 'users';

exports.getUser = (userId) => get({ collection: COLLECTION, id: userId });

exports.setLastRestaurant = (userId, restaurantId) =>
  patch({ collection: COLLECTION, id: userId, data: { lastRestaurantId: restaurantId } });
