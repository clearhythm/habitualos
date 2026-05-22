const { getUser } = require('./collections/users.cjs');
const { handle } = require('./_utils/api.cjs');

exports.handler = handle('user.profile.get', 'GET', async (event, { userId }) => {
  if (!userId) throw new Error('userId required');

  const user = await getUser(userId);
  if (!user) throw Object.assign(new Error('user not found'), { statusCode: 404 });

  return {
    name:  user._name  || '',
    email: user._email || '',
    chime: user.chime  || null,
  };
});
