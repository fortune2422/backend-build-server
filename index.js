const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

const app = express();
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send("Android Build Server is running!");
});

// 这里先放一个测试路由
app.post("/build-test", upload.single("file"), (req, res) => {
  res.json({ message: "File received", file: req.file });
});

// 端口必须用 process.env.PORT (Render 会自动传入)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));
