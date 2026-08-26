const twilio = require('twilio');

/**
 * Sends a message via Twilio (SMS or WhatsApp)
 * @param {string} toPhone The recipient's phone number
 * @param {string} messageBody The body of the message
 */
const sendTwilioMessage = async (toPhone, messageBody) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM;
  const channel = (process.env.TWILIO_CHANNEL || 'SMS').toUpperCase();

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[Twilio] Warning: Twilio environment variables are not fully configured. Skipping message send.");
    return { success: false, error: 'Not configured' };
  }

  try {
    const client = twilio(accountSid, authToken);
    
    let formattedTo = toPhone.trim();
    // Ensure the number has a plus sign prefix
    if (!formattedTo.startsWith('+')) {
      if (formattedTo.length === 10) {
        formattedTo = `+91${formattedTo}`;
      } else {
        formattedTo = `+${formattedTo}`;
      }
    }

    let formattedFrom = fromNumber.trim();

    if (channel === 'WHATSAPP') {
      if (!formattedTo.startsWith('whatsapp:')) {
        formattedTo = `whatsapp:${formattedTo}`;
      }
      if (!formattedFrom.startsWith('whatsapp:')) {
        formattedFrom = `whatsapp:${formattedFrom}`;
      }
    }

    const response = await client.messages.create({
      body: messageBody,
      from: formattedFrom,
      to: formattedTo
    });

    console.log(`[Twilio] Message sent successfully to ${formattedTo}. SID: ${response.sid}`);
    return { success: true, sid: response.sid };
  } catch (err) {
    console.error(`[Twilio] Error sending message to ${toPhone}:`, err);
    return { success: false, error: err.message };
  }
};

module.exports = { sendTwilioMessage };
