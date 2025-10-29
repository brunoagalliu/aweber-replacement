const axios = require('axios');

class TrestleService {
  constructor() {
    this.apiKey = process.env.TRESTLE_API_KEY;
    this.baseUrl = 'https://api.trestletech.com/v1'; // Adjust based on Trestle's actual API URL
  }

  async validatePhone(phoneNumber, additionalData = {}) {
    if (!this.apiKey) {
      console.error('Trestle API key not configured');
      return {
        isValid: true, // Allow through if not configured
        isBot: false,
        score: 0,
        error: 'API key not configured'
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/phone/validate`,
        {
          phone: phoneNumber,
          ...additionalData
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;

      return {
        isValid: data.valid || false,
        isBot: data.bot_score >= 70,
        score: data.bot_score || 0,
        riskLevel: data.risk_level || 'unknown',
        phoneType: data.phone_type || 'unknown',
        carrier: data.carrier || 'unknown',
        location: data.location || null,
        raw: data
      };

    } catch (error) {
      console.error('Trestle validation error:', error.message);
      
      // If Trestle is down, allow the submission but log it
      return {
        isValid: true,
        isBot: false,
        score: 0,
        error: error.message
      };
    }
  }

  async logBotAttempt(data) {
    // Log bot attempts for analysis
    console.log('🤖 Bot detected:', {
      email: data.email,
      phone: data.phone,
      score: data.score,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new TrestleService();