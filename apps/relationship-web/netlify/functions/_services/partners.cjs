/**
 * partners.cjs - Shared partner + pronoun config
 *
 * Single source of truth for partner mapping and pronouns.
 */

const PARTNERS = { 'Erik': 'Marta', 'Marta': 'Erik' };

const PRONOUNS = {
  'Erik': { label: 'he/him', they: 'he', them: 'him', their: 'his', theirs: 'his' },
  'Marta': { label: 'she/her', they: 'she', them: 'her', their: 'her', theirs: 'hers' }
};

const DEFAULT_PRONOUNS = { label: 'they/them', they: 'they', them: 'them', their: 'their', theirs: 'theirs' };

function getPartner(name) {
  return PARTNERS[name] || null;
}

function getPronouns(name) {
  return PRONOUNS[name] || DEFAULT_PRONOUNS;
}

module.exports = { PARTNERS, PRONOUNS, DEFAULT_PRONOUNS, getPartner, getPronouns };
