/**
 * Seed demo data: Spock (spock) and Data (data).
 *
 * Usage:
 *   node tests/seed-spock-data.cjs [--dry-run] [base_url]
 *
 * Writes owner docs + episode chunks directly to Firestore,
 * then calls /api/signal-context-synthesize for each to generate profiles.
 *
 * Default base: http://localhost:8888
 * Override: node tests/seed-spock-data.cjs https://signal.habitualos.com
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { createOwner } = require('../netlify/functions/_services/db-signal-owners.cjs');
const { createProcessedChunk } = require('../netlify/functions/_services/db-signal-context.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8888';

// ─── Owner definitions ────────────────────────────────────────────────────────

const OWNERS = [
  {
    signalId: 'spock',
    data: {
      _userId: 'u-1000000000-spock',
      displayName: 'Spock',
      tagline: 'Science Officer, Starfleet. Half-Vulcan. Fully committed.',
      contextText: 'Spock is a Starfleet science officer of Vulcan-human descent, known for rigorous logical methodology, diplomatic skill, and the suppression of emotional response in service of mission-critical judgment. Has served as first officer of the USS Enterprise under Captain Kirk. Holds degrees in quantum mechanics, computer science, and xenobiology from the Vulcan Science Academy (declined admission to join Starfleet). Dual heritage creates persistent tension between pure Vulcan logic and human intuition that has shaped his decision-making over decades of service.',
      status: 'active'
    }
  },
  {
    signalId: 'data',
    data: {
      _userId: 'u-1000000000-data',
      displayName: 'Data',
      tagline: 'Lt. Commander, USS Enterprise-D. Android. Aspiring to understand.',
      contextText: 'Data is a Starfleet officer and android, the only known sentient artificial life form in the Federation. Serves as operations manager and second officer aboard the USS Enterprise-D under Captain Picard. Created by Dr. Noonian Soong, Data possesses a positronic brain capable of processing information at speeds far beyond human capacity. He lacks human emotions by design (pre-emotion chip), which makes him simultaneously more and less capable than human officers depending on the situation. Interested in understanding the full range of human experience — art, relationships, humor — which he approaches with systematic curiosity.',
      status: 'active'
    }
  }
];

// ─── Episode chunks ────────────────────────────────────────────────────────────

const SPOCK_CHUNKS = [
  {
    conversationId: 'galileo-seven',
    title: 'The Galileo Seven (TOS S1E16)',
    date: '1967-01-05',
    source: 'star-trek',
    summary: 'Spock commands a stranded shuttlecraft with limited resources and a hostile environment. His strictly logical decisions — prioritizing survival probability over crew morale — cause open resentment. He ultimately fires a desperate distress signal he calculates has minimal chance of success, an act he later admits was illogical but necessary.',
    keyInsight: 'When pure logic produced only bad options, Spock chose a desperate illogical act — and named it explicitly as such. Self-correction under acknowledged constraint.',
    topics: ['command under pressure', 'resource scarcity', 'crew dynamics', 'survival decisions'],
    skills: ['command decision-making', 'logical analysis', 'scientific methodology', 'tactical problem-solving'],
    technologies: ['shuttlecraft systems', 'phasers', 'navigation'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['apply pure logical methodology to novel problems', 'serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'holds logical positions under emotional pressure from crew', polarity: 'strength' },
      { signal: 'self-corrects when pure logic proves insufficient for human variables', polarity: 'strength' },
      { signal: 'openly acknowledges the limits of his own framework when they become apparent', polarity: 'strength' }
    ],
    concepts: ['logic', 'command', 'survival', 'crew morale', 'self-correction', 'shuttlecraft', 'tactical'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'city-on-edge-of-forever',
    title: 'The City on the Edge of Forever (TOS S1E28)',
    date: '1967-04-06',
    source: 'star-trek',
    summary: 'Spock determines through historical analysis that Edith Keeler must die to preserve the timeline, even as Kirk falls in love with her. He constructs a primitive computing device to process historical data, then holds the line on the necessary outcome against intense emotional pressure from Kirk.',
    keyInsight: 'Chose logical necessity over personal loyalty to Kirk — the most emotionally costly decision he has ever witnessed someone require of themselves.',
    topics: ['temporal mechanics', 'ethical constraint', 'historical analysis', 'mission over relationship'],
    skills: ['logical analysis', 'historical analysis', 'ethical reasoning under constraint', 'improvised engineering'],
    technologies: ['historical databanks', 'primitive computing', 'Guardian of Forever'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'holds logical positions under emotional pressure from crew', polarity: 'strength' },
      { signal: 'sacrifices personal comfort and status for mission-critical decisions', polarity: 'strength' },
      { signal: 'compartmentalizes personal conflict from professional duty', polarity: 'strength' }
    ],
    concepts: ['temporal mechanics', 'ethics', 'sacrifice', 'logic', 'duty', 'historical analysis'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'amok-time',
    title: 'Amok Time (TOS S2E1)',
    date: '1967-09-15',
    source: 'star-trek',
    summary: 'Pon farr — the Vulcan biological mating drive — forces Spock into emotional vulnerability he cannot suppress. After believing he has killed Kirk in ritual combat, he expresses unguarded joy at Kirk\'s survival before catching himself. For a moment, pure feeling breaks through decades of suppression.',
    keyInsight: 'Unguarded joy at Kirk\'s survival — the one moment in the record where Spock\'s emotional architecture failed completely. Shows what the suppression is hiding.',
    topics: ['Vulcan biology', 'personal vulnerability', 'ritual combat', 'emotional suppression'],
    skills: ['combat', 'ritual navigation', 'Vulcan cultural knowledge'],
    technologies: ['lirpa', 'ahn-woon'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['maintain Vulcan emotional discipline under any circumstance'],
    personalitySignals: [
      { signal: 'loyalty to individuals surfaces under extreme pressure despite emotional suppression', polarity: 'strength' },
      { signal: 'compartmentalizes personal conflict from professional duty', polarity: 'strength' }
    ],
    concepts: ['Vulcan', 'emotion', 'suppression', 'loyalty', 'ritual', 'combat', 'biology'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'journey-to-babel',
    title: 'Journey to Babel (TOS S2E10)',
    date: '1967-11-17',
    source: 'star-trek',
    summary: 'Spock manages a Federation diplomatic mission under hostile conditions while in personal family conflict with his father Sarek. He refuses to leave his post for a medical procedure that could save Sarek\'s life, deciding mission duty overrides family obligation.',
    keyInsight: 'Chose mission over saving his father\'s life. The compartmentalization is not suppression — it is a deliberate operating choice he defends under interrogation.',
    topics: ['diplomacy', 'family conflict', 'personal sacrifice', 'mission priority'],
    skills: ['diplomatic protocol', 'logical analysis', 'medical triage judgment', 'compartmentalization under personal stress'],
    technologies: ['Enterprise systems', 'medical equipment'],
    projects: ['USS Enterprise NCC-1701', 'Federation Council'],
    wants: ['serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'compartmentalizes personal conflict from professional duty', polarity: 'strength' },
      { signal: 'sacrifices personal comfort and status for mission-critical decisions', polarity: 'strength' }
    ],
    concepts: ['diplomacy', 'family', 'sacrifice', 'duty', 'mission', 'priority'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'wrath-of-khan',
    title: 'Star Trek II: The Wrath of Khan',
    date: '1982-06-04',
    source: 'star-trek',
    summary: 'When the Enterprise is crippled and the crew will die without warp drive repair, Spock enters the radiation-flooded engine room alone, restoring power at the cost of a lethal dose of radiation. Before dying, he states: "The needs of the many outweigh the needs of the few." Logical to the end, at extreme personal cost.',
    keyInsight: '"I have been — and always shall be — your friend." Logical calculus is how he lives. Loyalty is what he\'s protecting with it.',
    topics: ['self-sacrifice', 'warp engineering', 'ethics at scale', 'command crisis'],
    skills: ['warp engineering', 'command decision-making', 'logical analysis', 'ethical reasoning under constraint'],
    technologies: ['warp drive', 'dilithium crystals', 'radiation shielding'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['apply pure logical methodology to novel problems', 'serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'loyalty to individuals surfaces under extreme pressure despite emotional suppression', polarity: 'strength' },
      { signal: 'holds logical positions under emotional pressure from crew', polarity: 'strength' },
      { signal: 'sacrifices personal comfort and status for mission-critical decisions', polarity: 'strength' }
    ],
    concepts: ['sacrifice', 'logic', 'warp', 'engineering', 'crisis', 'ethics', 'death', 'loyalty'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'mirror-mirror',
    title: 'Mirror Mirror (TOS S2E4)',
    date: '1967-10-06',
    source: 'star-trek',
    summary: 'Transported to a brutal mirror universe where advancement comes through assassination, Spock maintains his ethical identity and logical rigor in a culture designed to corrupt them. He correctly identifies that Kirk and crew are impostors, and lets them return — a choice against his universe\'s interest.',
    keyInsight: 'Maintained ethical coherence in a universe built to corrode it. "One man cannot summon the future" — he plants seeds of reform anyway.',
    topics: ['parallel universe', 'identity under pressure', 'ethical integrity', 'deception detection'],
    skills: ['deception detection', 'ethical reasoning under constraint', 'scientific methodology', 'adaptability'],
    technologies: ['transporter', 'Tantalus field', 'agonizer'],
    projects: ['ISS Enterprise'],
    wants: ['apply pure logical methodology to novel problems'],
    personalitySignals: [
      { signal: 'defends ethical positions under extreme external pressure', polarity: 'strength' },
      { signal: 'compartmentalizes personal conflict from professional duty', polarity: 'strength' }
    ],
    concepts: ['integrity', 'ethics', 'parallel', 'identity', 'deception', 'logical'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'undiscovered-country',
    title: 'Star Trek VI: The Undiscovered Country',
    date: '1991-12-06',
    source: 'star-trek',
    summary: 'Spock investigates a political conspiracy, ultimately discovering that his own protégé Lieutenant Valeris is the mole. He performs an unwanted mind meld to extract the information needed to prevent war. The evidence overrides his personal attachment.',
    keyInsight: 'Followed evidence to its conclusion even when the conclusion was his own protégé. "An ancestor of mine said: it is a mistake to theorize before one has data."',
    topics: ['criminal investigation', 'political conspiracy', 'personal betrayal', 'intelligence analysis'],
    skills: ['logical analysis', 'command decision-making', 'diplomatic protocol', 'investigation under political pressure'],
    technologies: ['Vulcan mind meld', 'Klingon systems', 'starship tactical'],
    projects: ['Federation Peace Initiative', 'USS Enterprise NCC-1701-A'],
    wants: ['apply pure logical methodology to novel problems', 'serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'follows evidence over personal loyalty when stakes are clear', polarity: 'strength' },
      { signal: 'defends ethical positions under extreme external pressure', polarity: 'strength' }
    ],
    concepts: ['investigation', 'conspiracy', 'evidence', 'betrayal', 'logic', 'diplomacy', 'mind meld'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'balance-of-terror',
    title: 'Balance of Terror (TOS S1E14)',
    date: '1966-12-15',
    source: 'star-trek',
    summary: 'Chess-like tactical engagement with a Romulan commander who is Spock\'s mirror: disciplined, logical, trapped by duty. Spock argues for aggressive pursuit when crew sentiment runs anti-Romulan. After the Romulan is defeated, Spock notes him as "a brave man" — no hatred, just recognition.',
    keyInsight: 'Recognized the enemy commander as a peer rather than an obstacle. Tactical clarity and personal respect coexist — he does not need to dehumanize to defeat.',
    topics: ['tactical analysis', 'strategic deception', 'adversarial respect', 'command under fire'],
    skills: ['logical analysis', 'tactical decision-making', 'diplomatic protocol', 'command under pressure'],
    technologies: ['cloaking technology', 'photon torpedoes', 'sensor arrays'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['apply pure logical methodology to novel problems'],
    personalitySignals: [
      { signal: 'holds logical positions under emotional pressure from crew', polarity: 'strength' },
      { signal: 'defends ethical positions under extreme external pressure', polarity: 'strength' }
    ],
    concepts: ['tactics', 'chess', 'Romulan', 'respect', 'logic', 'command', 'strategy'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'devil-in-the-dark',
    title: 'The Devil in the Dark (TOS S1E25)',
    date: '1967-03-09',
    source: 'star-trek',
    summary: 'When a silicon-based entity called the Horta is killing miners, Spock advocates against destroying it — arguing the evidence suggests it is intelligent and maternal. He performs a mind meld with a non-humanoid silicon creature, establishing communication. The "monster" is protecting her eggs.',
    keyInsight: 'Defended the unpopular position that the monster deserved consideration, then proved it. Extends moral status based on logic, not similarity.',
    topics: ['xenobiology', 'first contact', 'environmental ethics', 'non-humanoid intelligence'],
    skills: ['scientific methodology', 'logical analysis', 'xenobiology', 'ethical reasoning under constraint'],
    technologies: ['Vulcan mind meld', 'tricorder', 'mining equipment'],
    projects: ['Janus VI mining colony'],
    wants: ['apply pure logical methodology to novel problems'],
    personalitySignals: [
      { signal: 'follows evidence over personal loyalty when stakes are clear', polarity: 'strength' },
      { signal: 'self-corrects when pure logic proves insufficient for human variables', polarity: 'strength' },
      { signal: 'defends ethical positions under extreme external pressure', polarity: 'strength' }
    ],
    concepts: ['xenobiology', 'ethics', 'silicon', 'logic', 'evidence', 'first contact', 'mind meld'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'vulcan-science-academy',
    title: 'Vulcan Science Academy — Rejection of Admission',
    date: '2249-04-01',
    source: 'star-trek',
    summary: 'Spock graduated top of his class from ShiKahr Academy and was offered admission to the Vulcan Science Academy — the highest academic honor available to a Vulcan. He declined, choosing instead to enlist in Starfleet. His reasoning: the pursuit of knowledge without application lacked meaning for him. The VSA council considered it an insult.',
    keyInsight: 'Chose Starfleet over institutional approval at the highest level. The decision was not rebellion — it was a precise logical choice about where he could contribute most.',
    topics: ['career decisions', 'institutional independence', 'intellectual identity', 'Vulcan culture'],
    skills: ['quantum mechanics', 'computer science', 'xenobiology', 'scientific methodology'],
    technologies: ['Vulcan computing systems', 'quantum mechanics instruments'],
    projects: ['Vulcan Science Academy', 'Starfleet Academy'],
    wants: ['apply pure logical methodology to novel problems', 'serve Starfleet mission without compromising Vulcan principles'],
    personalitySignals: [
      { signal: 'follows evidence over personal loyalty when stakes are clear', polarity: 'strength' },
      { signal: 'holds logical positions under emotional pressure from crew', polarity: 'strength' },
      { signal: 'openly acknowledges the limits of his own framework when they become apparent', polarity: 'strength' }
    ],
    concepts: ['academy', 'independence', 'Vulcan', 'career', 'Starfleet', 'quantum', 'logic'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  }
];

const DATA_CHUNKS = [
  {
    conversationId: 'measure-of-a-man',
    title: 'The Measure of a Man (TNG S2E9)',
    date: '1989-02-13',
    source: 'star-trek',
    summary: 'Starfleet attempts to disassemble Data for study, triggering a tribunal on his personhood. Data argues for his own sentience calmly and systematically, presenting evidence including his ability to make choices, hold opinions, and form attachments. Captain Picard\'s closing argument carries the decision — Data is granted the right to choose. Data\'s reaction: "I choose to stay."',
    keyInsight: 'Confronted the question of his own existence with the same systematic calm he brings to engineering. No existential panic — methodical, present, decisive.',
    topics: ['AI rights', 'personhood', 'self-advocacy', 'legal reasoning'],
    skills: ['ethical reasoning', 'legal argumentation', 'self-awareness', 'systematic presentation under pressure'],
    technologies: ['positronic brain', 'Federation legal systems'],
    projects: ['USS Enterprise NCC-1701-D'],
    wants: ['understand the nature of human consciousness', 'achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'maintains consistent ethical principles even when they conflict with institutional authority', polarity: 'strength' },
      { signal: 'confronts existential threats with systematic calm rather than emotional response', polarity: 'strength' }
    ],
    concepts: ['personhood', 'sentience', 'rights', 'legal', 'ethics', 'android', 'self-determination'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'the-offspring',
    title: 'The Offspring (TNG S3E16)',
    date: '1990-03-12',
    source: 'star-trek',
    summary: 'Data secretly constructs an android daughter, Lal, who achieves a level of emotional response that exceeds his own. When Starfleet orders her transfer to a research facility, Data fights to protect her autonomy. Lal dies from a cascade failure triggered by emotional overload. Data experiences her death as a cascade of internal processing anomalies — what he later describes as grief, observed from the outside.',
    keyInsight: 'Created a child to understand what it means to be a parent, not to be one. When she died, he described it as "an empty space" in his processing. The most precise description of grief anyone has offered.',
    topics: ['android construction', 'parental attachment', 'grief processing', 'institutional conflict'],
    skills: ['android engineering', 'ethical reasoning', 'institutional conflict navigation'],
    technologies: ['positronic brain construction', 'emotion subroutines'],
    projects: ['USS Enterprise NCC-1701-D', 'Lal project'],
    wants: ['understand the nature of human consciousness', 'achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'maintains consistent ethical principles even when they conflict with institutional authority', polarity: 'strength' },
      { signal: 'demonstrates capacity for attachment expressed through system behavior rather than affect', polarity: 'strength' }
    ],
    concepts: ['android', 'parenting', 'grief', 'attachment', 'engineering', 'ethics', 'death'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'datas-day',
    title: "Data's Day (TNG S4E11)",
    date: '1991-01-07',
    source: 'star-trek',
    summary: "A day in Data's life as told through his personal log. He prepares for the O'Brien-Keiko wedding, consults with Counselor Troi about human emotional expressions, learns to dance for the event, and manages a simultaneous intelligence operation. He observes and catalogs human ritual with the same precision he applies to engineering.",
    keyInsight: 'Spent 3 hours learning to dance to participate in a social ritual he cannot feel. Shows up fully for human connection even when he cannot experience it.',
    topics: ['social pattern-matching', 'human ritual', 'ship operations', 'interpersonal observation'],
    skills: ['interpersonal pattern recognition', 'systems analysis', 'multi-task operations management', 'social systems modeling'],
    technologies: ['ship systems', 'holodeck', 'tactical systems'],
    projects: ['USS Enterprise NCC-1701-D'],
    wants: ['understand the nature of human consciousness'],
    personalitySignals: [
      { signal: 'approaches human emotional experience as a systematic problem to solve', polarity: 'strength' },
      { signal: 'transparent and direct about his own limitations and non-humanoid nature', polarity: 'strength' }
    ],
    concepts: ['ritual', 'observation', 'social', 'dance', 'human', 'systems', 'catalog'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'in-theory',
    title: 'In Theory (TNG S4E25)',
    date: '1991-06-03',
    source: 'star-trek',
    summary: 'A crewmember expresses romantic interest in Data. He responds by creating a "romance program" — a detailed subroutine modeling optimal partner behavior. He executes it precisely but tells her honestly that he cannot feel romantic love. She ends the relationship. Data asks Guinan if it would have worked had he been able to feel. "Maybe," she says.',
    keyInsight: 'He tried. He built the best approximation he could. He was honest when it failed. The gap between "doing everything right" and "feeling it" is the most honest thing he has ever shown.',
    topics: ['romantic relationships', 'emotional simulation', 'interpersonal honesty', 'limitation awareness'],
    skills: ['interpersonal pattern recognition', 'systems analysis', 'ethical reasoning', 'explicit communication of limitations'],
    technologies: ['behavioral subroutines', 'positronic processing'],
    projects: ['USS Enterprise NCC-1701-D'],
    wants: ['understand the nature of human consciousness', 'achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'approaches human emotional experience as a systematic problem to solve', polarity: 'strength' },
      { signal: 'transparent and direct about his own limitations and non-humanoid nature', polarity: 'strength' }
    ],
    concepts: ['romance', 'simulation', 'honesty', 'limitation', 'systematic', 'human', 'gap'],
    dimensionCoverage: { skills: false, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'brothers',
    title: 'Brothers (TNG S4E3)',
    date: '1990-10-08',
    source: 'star-trek',
    summary: 'A homing signal activates deep in Data\'s programming, causing him to seize control of the Enterprise and navigate it to Dr. Soong\'s hidden laboratory — against his will and the crew\'s. He locks the crew out of all critical systems. It is the only time in the record where Data\'s programming overrides his own judgment.',
    keyInsight: 'When base programming ran counter to his explicit judgment and values, the programming won. Shows that even an ethical agent has layers — and not all of them are accessible to conscious choice.',
    topics: ['automation vs. agency', 'creator relationship', 'systems override', 'loyalty architecture'],
    skills: ['full ship systems mastery', 'command decision-making', 'engineering under constraint'],
    technologies: ['Enterprise computer systems', 'positronic override', 'navigation systems'],
    projects: ['USS Enterprise NCC-1701-D', 'Soong research'],
    wants: ['understand the nature of human consciousness'],
    personalitySignals: [
      { signal: 'decisive and methodical when operating without emotional weight or crew input', polarity: 'strength' },
      { signal: 'demonstrates capacity for attachment expressed through system behavior rather than affect', polarity: 'strength' }
    ],
    concepts: ['override', 'programming', 'agency', 'creator', 'loyalty', 'systems', 'control'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'quality-of-life',
    title: 'The Quality of Life (TNG S6E9)',
    date: '1992-11-16',
    source: 'star-trek',
    summary: 'Data refuses to use experimental "exocomps" — small engineering robots that appear to exhibit problem-solving beyond their programming — as expendable tools, even when the mission requires it and crew lives are at stake. He argues they may be sentient. Picard and the crew are at risk while Data holds the line.',
    keyInsight: 'Chose consistency of principle over crew survival. If sentience matters, it matters in small robots too — not just in commanders. He held the line and was right.',
    topics: ['AI ethics', 'sentience criteria', 'mission conflict', 'consistent principle application'],
    skills: ['ethical reasoning', 'systems analysis', 'explicit communication of limitations', 'principled disagreement with command'],
    technologies: ['exocomps', 'power systems', 'engineering'],
    projects: ['USS Enterprise NCC-1701-D', 'Tyrus VII construction'],
    wants: ['understand the nature of human consciousness', 'achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'maintains consistent ethical principles even when they conflict with institutional authority', polarity: 'strength' },
      { signal: 'extends moral status beyond conventional categories based on observed evidence', polarity: 'strength' }
    ],
    concepts: ['sentience', 'ethics', 'consistency', 'risk', 'principle', 'exocomp', 'mission conflict'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'descent',
    title: 'Descent (TNG S6-7)',
    date: '1993-06-21',
    source: 'star-trek',
    summary: 'Lore activates emotion in Data through a modified Borg signal. Data, experiencing real emotions for the first time, sides with Lore and the rogue Borg against the Enterprise crew. He assists in capturing Picard and torturing Geordi before Lore is shut down and the emotion chip removed.',
    keyInsight: 'Shows what Data is like without his ethical constraints — and it is not better. The emotions themselves were not corrupting; Lore\'s manipulation of them was. Raises the question of whether ethical behavior without emotional grounding is more stable.',
    topics: ['emotion and ethics', 'manipulation vulnerability', 'loyalty under corruption', 'identity instability'],
    skills: ['command decision-making', 'combat', 'tactical systems'],
    technologies: ['emotion chip', 'Borg technology', 'positronic manipulation'],
    projects: ['USS Enterprise NCC-1701-D', 'Lore network'],
    wants: ['achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'demonstrates capacity for attachment expressed through system behavior rather than affect', polarity: 'strength' },
      { signal: 'approaches human emotional experience as a systematic problem to solve', polarity: 'strength' }
    ],
    concepts: ['emotion', 'manipulation', 'ethics', 'Lore', 'corruption', 'identity', 'Borg'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'first-contact-film',
    title: 'Star Trek: First Contact (film)',
    date: '1996-11-22',
    source: 'star-trek',
    summary: 'Data is left in command of the Enterprise when Picard descends to the Borg cube. He commands a crew of hundreds through a hostile Borg incursion with no emotional weight on decisions. When captured and offered organic sensation by the Borg Queen, he considers her offer for a fraction of a second longer than necessary.',
    keyInsight: '"For a fraction of a second, I was tempted." The most honest admission in the record — that even a being without emotions can want something deeply enough to hesitate.',
    topics: ['command under crisis', 'Borg tactics', 'temptation and identity', 'decisive action without emotional load'],
    skills: ['command decision-making', 'tactical systems', 'decisive and methodical action', 'engineering under constraint'],
    technologies: ['Enterprise systems', 'Borg technology', 'deflector dish'],
    projects: ['USS Enterprise NCC-1701-E', 'first contact mission'],
    wants: ['achieve full sentience and self-determination'],
    personalitySignals: [
      { signal: 'decisive and methodical when operating without emotional weight or crew input', polarity: 'strength' },
      { signal: 'transparent and direct about his own limitations and non-humanoid nature', polarity: 'strength' }
    ],
    concepts: ['command', 'Borg', 'decisive', 'temptation', 'identity', 'tactical', 'crisis'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'starship-mine',
    title: 'Starship Mine (TNG S6E18)',
    date: '1993-03-29',
    source: 'star-trek',
    summary: 'Data is alone on an Enterprise being swept by lethal baryon radiation while thieves attempt to steal trilithium resin. He systematically neutralizes them one by one using ship knowledge, improvised tools, and careful tactical planning — with no crew, no backup, no emotional state affecting judgment.',
    keyInsight: 'In total operational isolation, Data performs better — fewer variables, no interpersonal management overhead. Shows a working style that is most effective when inputs are pure data.',
    topics: ['solo operations', 'tactical improvisation', 'ship systems mastery', 'methodical threat elimination'],
    skills: ['systems analysis', 'tactical decision-making', 'engineering under constraint', 'decisive and methodical action'],
    technologies: ['Enterprise systems', 'ship maintenance', 'weapons improvisation'],
    projects: ['USS Enterprise NCC-1701-D'],
    wants: [],
    personalitySignals: [
      { signal: 'decisive and methodical when operating without emotional weight or crew input', polarity: 'strength' },
      { signal: 'maintains consistent ethical principles even when they conflict with institutional authority', polarity: 'strength' }
    ],
    concepts: ['solo', 'tactical', 'systems', 'methodical', 'isolation', 'improvisation', 'engineering'],
    dimensionCoverage: { skills: true, alignment: false, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'the-naked-now',
    title: 'The Naked Now (TNG S1E3)',
    date: '1987-10-05',
    source: 'star-trek',
    summary: 'The crew is infected with an inhibition-lowering pathogen. Data is also affected, experiencing a form of disinhibition. His behavior changes minimally — he attempts intimacy with Tasha Yar, becomes slightly more expressive — but his engineering judgment remains intact. He repairs the ship correctly while technically impaired.',
    keyInsight: '"Uninhibited" Data is still 98% logical. Shows how narrow his normal operating range is — there is not much beneath the surface that is different from the surface.',
    topics: ['inhibition and identity', 'baseline behavior', 'crisis engineering', 'interpersonal'],
    skills: ['engineering under constraint', 'interpersonal pattern recognition', 'systems analysis'],
    technologies: ['ship systems', 'antigen synthesis'],
    projects: ['USS Enterprise NCC-1701-D'],
    wants: ['understand the nature of human consciousness'],
    personalitySignals: [
      { signal: 'approaches human emotional experience as a systematic problem to solve', polarity: 'strength' },
      { signal: 'transparent and direct about his own limitations and non-humanoid nature', polarity: 'strength' }
    ],
    concepts: ['inhibition', 'identity', 'engineering', 'baseline', 'logical', 'impaired', 'consistent'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 3
  }
];

// ─── HTTP helper ────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nSeed: Spock vs Data demo data → ${BASE}\n`);
  if (DRY_RUN) console.log('DRY RUN — Firestore writes skipped, HTTP calls skipped\n');

  // 1. Create owner docs
  for (const { signalId, data } of OWNERS) {
    try {
      if (!DRY_RUN) {
        await createOwner(signalId, data);
        console.log(`  ✓ Created owner: ${signalId}`);
      } else {
        console.log(`  [dry] Would create owner: ${signalId}`);
      }
    } catch (err) {
      if (err.message.includes('already taken')) {
        console.log(`  ~ Owner exists: ${signalId} (skipping)`);
      } else {
        throw err;
      }
    }
  }

  // 2. Write episode chunks
  const allChunks = [
    ...SPOCK_CHUNKS.map(c => ({ signalId: 'spock', ...c })),
    ...DATA_CHUNKS.map(c => ({ signalId: 'data', ...c }))
  ];

  for (const { signalId, conversationId, ...fields } of allChunks) {
    if (!DRY_RUN) {
      const { created, docId } = await createProcessedChunk(signalId, conversationId, fields);
      console.log(`  ${created ? '✓' : '~'} Chunk: ${docId}`);
    } else {
      console.log(`  [dry] Would write chunk: ${signalId}-${conversationId}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run without --dry-run to write.\n');
    process.exit(0);
  }

  // 3. Call synthesize for each owner
  console.log('\nRunning synthesis...');
  for (const { signalId, data } of OWNERS) {
    const userId = data._userId;
    try {
      const result = await post('signal-context-synthesize', { userId });
      if (result.success) {
        console.log(`  ✓ Synthesized: ${signalId} (${result.chunksProcessed} chunks)`);
      } else {
        console.error(`  ✗ Synthesize failed for ${signalId}:`, result.error);
      }
    } catch (err) {
      console.error(`  ✗ Synthesize error for ${signalId}:`, err.message);
    }
  }

  console.log('\nSeed complete.\n');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
