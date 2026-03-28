var express = require("express");
var router = express.Router();
let { CreateUserValidator, validationResult } = require('../utils/validatorHandler')
let userModel = require("../schemas/users");
let userController = require('../controllers/users')
let { CheckLogin, CheckRole } = require('../utils/authHandler')
let { uploadExcel } = require('../utils/uploadHandler')
let exceljs = require('exceljs')
let path = require('path')
let fs = require('fs')
let mailHandler = require('../utils/mailHandler')
let roleModel = require('../schemas/roles')

function generateRandomPassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}


router.get("/", CheckLogin, CheckRole("ADMIN", "MODERATOR"), async function (req, res, next) {
  let users = await userModel
    .find({ isDeleted: false })
    .populate({
      path: 'role',
      select: 'name'
    })
  res.send(users);
});

router.get("/:id",CheckLogin,CheckRole("ADMIN"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateUserValidator, validationResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role
    )
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await
      userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});
router.post('/import', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        return res.status(400).send({ message: "file is required" });
    }

    try {
        let workBook = new exceljs.Workbook();
        let filePath = path.join(__dirname, '../uploads', req.file.filename);
        await workBook.xlsx.readFile(filePath);
        let worksheet = workBook.worksheets[0];
        let result = [];

        // Find the 'USER' or 'user' role
        let userRole = await roleModel.findOne({ name: { $regex: /^user$/i } });
        if (!userRole) {
            fs.unlinkSync(filePath);
            return res.status(400).send({ message: "Role 'user' not found in database" });
        }

        // Loop through rows starting from 2 (assuming row 1 is header)
        for (let index = 2; index <= worksheet.rowCount; index++) {
            const row = worksheet.getRow(index);
            // Column 1 is username, Column 2 is email
            let username = row.getCell(1).value;
            let email = row.getCell(2).value;

            // Handle ExcelJS formula results and rich text objects
            if (username && typeof username === 'object') {
                username = username.result !== undefined ? username.result : username.text || '';
            }
            if (email && typeof email === 'object') {
                email = email.result !== undefined ? email.result : email.text || '';
            }

            // Skip empty rows
            if (!username || !email) {
                continue;
            }

            let errorsRow = [];

            // Check if user already exists
            let existingUser = await userModel.findOne({
                $or: [{ username: username }, { email: email }]
            });

            if (existingUser) {
                if (existingUser.username === username) errorsRow.push("Username already exists");
                if (existingUser.email === email) errorsRow.push("Email already exists");
            }

            if (errorsRow.length > 0) {
                result.push({ row: index, username, success: false, errors: errorsRow });
                continue;
            }

            // Generate password
            let rawPassword = generateRandomPassword(16);

            let newUser = new userModel({
                username: username,
                email: email,
                password: rawPassword, // schema pre('save') should hash this
                role: userRole._id
            });

            await newUser.save();

            // Send Email via Mailtrap
            try {
                await mailHandler.sendPasswordMail(email, username, rawPassword);
                result.push({ row: index, username, success: true, message: "User created and email sent" });
            } catch (mailError) {
                result.push({ row: index, username, success: true, message: "User created but failed to send email", error: mailError.message });
            }
        }

        fs.unlinkSync(filePath);
        res.send({ message: "Import completed", result: result });

    } catch (error) {
        if (req.file) {
            let filePath = path.join(__dirname, '../uploads', req.file.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.status(500).send({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;