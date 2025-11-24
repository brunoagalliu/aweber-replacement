const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.log('Usage: node scripts/hash-password.js <your-password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  console.log('\n🔐 Password Hash Generated:');
  console.log(hash);
  console.log('\n📋 Add this to your .env file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\n');
});