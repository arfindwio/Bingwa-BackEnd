require("dotenv").config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const { PORT = 3000 } = process.env;

const router = require("./routes");

// const corsOptions = {
//   origin: ["http://localhost:3000", "http://localhost:8000", "https://bingwa-b11.vercel.app"],
//   optionsSuccessStatus: 200,
// };

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(router);

// 404 error handling
app.use((req, res, next) => {
  res.status(404).json({
    status: false,
    message: "Bad Request",
    data: null,
  });
});

// 500 error handling
app.use((err, req, res, next) => {
  res.status(500).json({
    status: false,
    message: err.message ?? "Internal Server Error",
    data: null,
  });
});

app.listen(PORT, () => console.log(`server running at http://localhost:${PORT}`));
