const axios = require('axios');

class TrestleService {
  constructor() {
    this.apiKey = process.env.TRESTLE_API_KEY;
    this.baseUrl = 'https://api.trestleiq.com/3.0';
  }

  async verifyPhone(phoneNumber, ipAddress = null) {
    if (!this.apiKey) {
      console.error('⚠️ Trestle API key not configured');
      return {
        verified: true, // Allow through if not configured
        botScore: 0,
        isBot: false,
        error: 'API key not configured'
      };
    }

    // Ensure phone is in correct format (no formatting, just digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming US +1)
    const phoneWithCountryCode = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;

    try {
      console.log('🔍 Verifying phone with Trestle:', phoneWithCountryCode);

      const response = await axios.get(
        `${this.baseUrl}/phone_intel`,
        {
          params: {
            phone: phoneWithCountryCode
          },
          headers: {
            'accept': 'application/json',
            'x-api-key': this.apiKey
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const data = response.data;

      console.log('📊 Trestle response:', JSON.stringify(data, null, 2));

      // Extract bot score from response
      // Adjust these field names based on actual Trestle response structure
      const botScore = data.risk_score || data.bot_score || data.fraud_score || 0;
      const isBot = botScore >= 70;

      return {
        verified: true,
        botScore: botScore,
        isBot: isBot,
        valid: data.is_valid !== false && data.valid !== false,
        phoneType: data.line_type || data.phone_type || 'unknown',
        carrier: data.carrier || data.carrier_name || 'unknown',
        country: data.country || 'unknown',
        state: data.state || null,
        city: data.city || null,
        raw: data
      };

    } catch (error) {
      console.error('❌ Trestle verification error:', error.response?.data || error.message);
      
      // If Trestle API fails, allow submission but log it
      return {
        verified: true,
        botScore: 0,
        isBot: false,
        error: error.response?.data || error.message,
        fallback: true
      };
    }
  }
}

module.exports = new TrestleService();