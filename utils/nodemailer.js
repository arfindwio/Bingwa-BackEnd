require("dotenv").config();
const nodemailer = require("nodemailer");
// const { google } = require("googleapis");
const ejs = require("ejs");
// const { GOOGLE_REFRESH_TOKEN, GOOGLE_SENDER_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
const { SMTP_USER, SMTP_PASS } = process.env;
// const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

// oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

module.exports = {
  sendEmail: async (to, subject, html) => {
    try {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        secure: true,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const mailOptions = {
        from: SMTP_USER,
        to,
        subject,
        html,
      };

      await new Promise((resolve, reject) => {
        transport.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(info);
          }
        });
      });
    } catch (error) {
      console.log(error);
    }
  },
  getHtml: (fileName, data) => {
    return new Promise((resolve, reject) => {
      const path = `${__dirname}/../views/templates/${fileName}`;

      ejs.renderFile(path, data, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },
};
