const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testEmail() {
  console.log("=== EMAIL DIAGNOSTICS ===");
  console.log("Checking environment variables...");
  console.log("RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASS present:", !!process.env.EMAIL_PASS);
  
  // Test Resend
  if (process.env.RESEND_API_KEY) {
    try {
      console.log("\n--- Testing Resend ---");
      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: "Chartered Mentor <onboarding@resend.dev>",
        to: process.env.EMAIL_USER === 'your_gmail_email@gmail.com' ? "test@example.com" : process.env.EMAIL_USER,
        subject: "Test Email from Diagnostics",
        html: "<p>This is a test</p>",
      });

      if (error) {
        console.log("RESEND ERROR:", error.message);
        console.log("EXPLANATION: Resend's free tier only allows sending TO the exact email address you used to sign up for Resend. Any other email will be blocked unless you verify a domain.");
      } else {
        console.log("RESEND SUCCESS! ID:", data.id);
      }
    } catch (e) {
      console.log("RESEND EXCEPTION:", e.message);
    }
  }

  // Test Nodemailer
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      console.log("\n--- Testing Nodemailer ---");
      if (process.env.EMAIL_USER.includes("your_gmail_email")) {
        console.log("NODEMAILER ERROR: You are using the placeholder 'your_gmail_email@gmail.com'. You MUST edit your .env file and put your real email and app password.");
      } else {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await transporter.verify();
        console.log("NODEMAILER SUCCESS! Credentials are valid. Sending test email...");

        const setupLink = "https://charteredmentor.vercel.app/?setup=true&email=jacob06042006@gmail.com&userId=TEST101";
        const message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4f46e5; text-align: center;">Welcome to Chartered Mentor! (Test)</h2>
            <p>Hello Jacob,</p>
            <p>Your test student account has been created by the administrator. Your Student ID is: <b>TEST101</b></p>
            <p>Please click the button below to verify your identity with Google and set up your personal password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Set Up Account</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888;">${setupLink}</p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Chartered Mentor" <${process.env.EMAIL_USER}>`,
          to: "jacob06042006@gmail.com",
          subject: "Test: Welcome to Chartered Mentor - Account Setup",
          html: message
        });
        
        console.log("Test email successfully dispatched to jacob06042006@gmail.com!");
      }
    } catch (e) {
      console.log("NODEMAILER ERROR:", e.message);
      if (e.message.includes("Invalid login")) {
        console.log("EXPLANATION: Your Gmail password is wrong OR you need to generate a 16-letter App Password from Google Security settings.");
      }
    }
  }
}

testEmail();
