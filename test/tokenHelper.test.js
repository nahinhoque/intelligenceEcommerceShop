const test = require('node:test');
const assert = require('node:assert/strict');

const { EncodeToken, DecodeToken } = require('../src/utility/tokenHelper.js');

process.env.JWT_KEY = process.env.JWT_KEY || 'test-secret';

test('EncodeToken keeps the admin id available in decoded payload', () => {
  const adminId = '64f6c7f4e1d0c5a7b6f12345';
  const token = EncodeToken('admin@gmail.com', adminId);
  const decoded = DecodeToken(token);

  assert.equal(decoded.email, 'admin@gmail.com');
  assert.equal(decoded._id, adminId);
  assert.equal(decoded.id, adminId);
});
