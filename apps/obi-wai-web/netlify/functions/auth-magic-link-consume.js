require('dotenv').config();
const { createMagicLinkConsumeHandler } = require('@habitualos/auth-server');

exports.handler = createMagicLinkConsumeHandler();
