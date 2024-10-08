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
const crypto = require('crypto');
const { fstat } = require("fs");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

const port = process.env.PORT || 3000;

// Set up view engine
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/uploads');
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(12,function(err,name){
      const fn = name.toString("hex")+path.extname(file.originalname);
      cb(null, fn);
    })
   
  }
})

const upload = multer({ storage: storage });
const profile = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/profileImage');
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(12,function(err,name){
      const fn = name.toString("hex")+path.extname(file.originalname);
      cb(null, fn);
    })
   
  }
})

const profileUpdate = multer({ storage: profile });

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
app.post("/CreateNewPost", isLoggedIn, upload.single('postImage'), async function (req, res) {
  const user = await userModel.findOne({email:req.user.email});
  const post = await postModel({
      title:req.body.title,
      content:req.body.postContent,
      user:user._id,
  })
  const result = await cloudinary.uploader.upload(req.file.path);
  post.postImage = result.secure_url;
  user.posts.push(post._id);
  await post.save();
  fs.unlinkSync(req.file.path);
  res.redirect("/feed");
});

app.post("/updateProfile", isLoggedIn, profileUpdate.single('profileImage'), async function (req, res) {
  const user = await userModel.findOne({ email: req.user.email });
  const result = await cloudinary.uploader.upload(req.file.path);
  user.profileImage = result.secure_url; 
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

  try {
    // Check if email already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ message: "Email already exists" });
    }

    // Generate salt and hash the password
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return res.status(500).send({ message: "Error generating salt" });

      bcrypt.hash(password, salt, async (err, hash) => {
        if (err) return res.status(500).send({ message: "Error hashing password" });

        // Create the new user
        const newUser = await userModel.create({
          username,
          email,
          password: hash,
        });

        // Generate JWT token
        const token = jwt.sign({ email: email, userId: newUser._id }, "toptop");

        // Set the token in a cookie with proper options
        const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';

        res.cookie('token', token, {
          httpOnly: true,
          secure: secure, // Ensure the cookie is only sent over HTTPS
          sameSite: secure ? 'None' : 'Lax',
        });

        // Redirect to the feed page after successful registration
        res.redirect("/feed");
      });
    });
  } catch (err) {
    // Handle any unexpected errors
    res.status(500).send({ message: "Server error" });
  }
});


// Login existing user
app.post("/login", async function (req, res) {
  const { email, password } = req.body;
  
  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).send({ message: "Email not found" });

    bcrypt.compare(password, user.password, function (err, result) {
      if (err) return res.status(500).send({ message: "Error comparing passwords" });
      
      if (result) {
        // Generate the JWT token
        let token = jwt.sign({ email: email, userId: user._id }, "toptop");

        // Check if the connection is secure (HTTPS)
        const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';

        // Set the cookie with the token and proper options
        res.cookie('token', token, {
          httpOnly: true,
          secure: secure, // Ensure secure cookie for HTTPS
          sameSite: secure ? 'None' : 'Lax',
        });

        res.redirect("/feed");
      } else {
        res.status(400).send({ message: "Incorrect password" });
      }
    });
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
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
