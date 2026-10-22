const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.env.TOKEN_GLASS_DATA || 'D:\\TOKSCALE\\data';
const pipe = '\\\\.\\pipe\\' + (process.env.TOKEN_GLASS_PIPE || 'token-glass-' + crypto.createHash('sha256').update(os.homedir()).digest('hex').slice(0,16));
module.exports = { root, pipe };
