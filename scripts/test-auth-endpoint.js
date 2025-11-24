const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testLogin() {
  console.log('\n🧪 Testing Auth Endpoint\n');
  console.log('API URL:', API_URL);
  
  try {
    console.log('📤 Sending login request...');
    
    const response = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data:', response.data);
    
    if (response.status === 200 && response.data.token) {
      console.log('\n✅ Login test successful!');
      console.log('Token:', response.data.token.substring(0, 50) + '...');
    } else {
      console.log('\n❌ Login test failed');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
      console.log('Response status:', error.response.status);
    }
  }
}

testLogin();