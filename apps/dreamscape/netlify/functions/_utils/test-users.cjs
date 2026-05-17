const TEST_USERS = [
  { userId: 'u-test-erik',  name: 'Erik'  },
  { userId: 'u-test-sarah', name: 'Sarah' },
  { userId: 'u-test-frank', name: 'Frank' },
  { userId: 'u-test-roi',   name: "Ro'i"  },
];

const TEST_USER_IDS = TEST_USERS.map(u => u.userId);

module.exports = { TEST_USERS, TEST_USER_IDS };
