const express = require("express");
require("dotenv").config();
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const userModel = require("./modules/user");
const postModel = require("./modules/post");
const profileModel = require("./modules/profile");
const bcrypt = require('bcrypt');
const app = express();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const port = process.env.PORT || 3000;


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });


// Set up view engine
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// Cloudinary storage for posts
const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'posts',
    allowedFormats: ['jpeg', 'png', 'jpg']
  }
});

// Cloudinary storage for profile images
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profiles',
    allowedFormats: ['jpeg', 'png', 'jpg']
  }
});

// Multer configuration
const uploadPostImage = multer({ storage: postStorage });
const uploadProfileImage = multer({ storage: profileStorage });

// Routes
app.get("/", function (req, res) {
  res.render("createAccount");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/feed", isLoggedIn, async function (req, res) {
  const user = await userModel.find();
  const posts = await postModel.find({ userId: user._id }).sort({ createdAt: -1 }).populate('user');
  posts.reverse();
  res.render("feed", { posts });
});

app.get("/postFeed", isLoggedIn, function (req, res) {
  res.render("postFeed");
});

app.get("/upcomingEvents", isLoggedIn, function (req, res) {
  res.render("upcomingEvents");
});

app.get("/eventSubmission", isLoggedIn, function (req, res) {
  res.render("eventsSubmission");
});

app.get("/editProfile", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ email: req.user.email });
  res.render("editProfile", { user });
});

app.get("/profile", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ email: req.user.email });
  const editBio = await profileModel.find();
  const bioEdit = editBio[editBio.length - 1];
  const profile = await postModel.find({ user: user._id }).sort({ createdAt: -1 }).populate('user');
  res.render("profile", { profile, user, bioEdit });
});

app.get("/messages", isLoggedIn, function (req, res) {
  res.render("messages");
});

app.get("/notifications", isLoggedIn, function (req, res) {
  res.render("notifications");
});

app.get("/settings", isLoggedIn, function (req, res) {
  res.render("settings");
});

app.get("/CreatePost", isLoggedIn, function (req, res) {
  res.render("createPost");
});

// Create a new post and upload image to Cloudinary
app.post("/CreateNewPost", isLoggedIn, uploadPostImage.single('postImage'), async function (req, res) {
  const user = await userModel.findOne({ email: req.user.email });
  const post = await postModel({
    title: req.body.title,
    content: req.body.postContent,
    user: user._id,
    postImage: req.file.filename // Cloudinary URL
  });
  user.posts.push(post._id);
  await post.save();
  res.redirect("/feed");
});

// Update profile with a new profile image uploaded to Cloudinary
app.post("/updateProfile", isLoggedIn, uploadProfileImage.single('profileImage'), async function (req, res) {
  const user = await userModel.findOne({ email: req.user.email });
  user.profileImage = req.file.path;  // Cloudinary URL
  const profile = await profileModel({
    bio: req.body.bio
  });
  await user.save();
  await profile.save();
  res.redirect("/profile");
});

// Register new user
app.post("/register", async function (req, res) {
  const { username, password, email } = req.body;
  const user = await userModel.findOne({ email });
  if (user) return res.status(400).send({ message: "Email already exists" });
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        username,
        email,
        password: hash,
      });
      let token = jwt.sign({ email: email, userId: user._id }, "toptop");
      res.cookie('token', token);
      res.redirect("/feed");
    });
  });
});

// Login existing user
app.post("/login", async function (req, res) {
  const { email, password } = req.body;
  const user = await userModel.findOne({ email });
  if (!user) return res.status(400).send({ message: "Email not found" });
  bcrypt.compare(password, user.password, function (err, result) {
    if (result) {
      let token = jwt.sign({ email: email, userId: user._id }, "toptop");
      res.cookie("token", token);
      res.redirect("/feed");
    } else res.redirect("/");
  });
});

// Logout user
app.get("/logout", function (req, res) {
  res.cookie("token", "");
  res.redirect("/login");
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  if (req.cookies.token === "") {
    res.redirect("/login");
  } else {
    let data = jwt.verify(req.cookies.token, "toptop");
    req.user = data;
  }
  next();
}

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
