const crypto = require('crypto');

console.log('\n🔐 JWT Secret Generator\n');
console.log('Copy one of these to your .env file:\n');

// Generate multiple options
for (let i = 1; i <= 3; i++) {
  const secret = crypto.randomBytes(64).toString('hex');
  console.log(`Option ${i}:`);
  console.log(`JWT_SECRET=${secret}`);
  console.log('');
}

console.log('💡 Tip: Use the longest one for maximum security!\n');