/**
 * partners.js - Client-side partner + pronoun config
 *
 * Mirrors _services/partners.cjs for browser use.
 */

export const PARTNERS = { 'Erik': 'Marta', 'Marta': 'Erik' };

export const PRONOUNS = {
  'Erik': { label: 'he/him', they: 'he', them: 'him', their: 'his', theirs: 'his' },
  'Marta': { label: 'she/her', they: 'she', them: 'her', their: 'her', theirs: 'hers' }
};

const DEFAULT_PRONOUNS = { label: 'they/them', they: 'they', them: 'them', their: 'their', theirs: 'theirs' };

export function getPartner(name) {
  return PARTNERS[name] || null;
}

export function getPronouns(name) {
  return PRONOUNS[name] || DEFAULT_PRONOUNS;
}
