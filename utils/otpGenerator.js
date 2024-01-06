module.exports = {
  generatedOTP: () => {
    const digit = "0123456789";
    let otp = "";
    for (let i = 1; i <= 6; i++) {
      otp += digit[Math.floor(Math.random() * 10)];
    }
    return { code: otp, createdAt: new Date() };
  },
};
