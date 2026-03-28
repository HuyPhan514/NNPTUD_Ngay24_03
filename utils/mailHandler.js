const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525, // Changed to 2525 to prevent ISP blocks on port 25
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "b84b9faa80e718",
        pass: "02761b719c9f4b",
    },
});

module.exports = {
    sendMail: async (to, url) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "request resetpassword email",
            text: "click vao day de reset", // Plain-text version of the message
            html: "click vao <a href=" + url + ">day</a> de reset", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendPasswordMail: async (to, username, password) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "Your New Account Credentials",
            text: `Hello ${username},\n\nYour account has been created successfully.\nHere are your login details:\nUsername: ${username}\nPassword: ${password}\n\nPlease change your password after logging in.`,
            html: `Hello <b>${username}</b>,<br/><br/>Your account has been created successfully.<br/>Here are your login details:<br/><b>Username:</b> ${username}<br/><b>Password:</b> ${password}<br/><br/>Please change your password after logging in.`,
        });
        console.log("Password email sent:", info.messageId);
    }
}