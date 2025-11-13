const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");

// Signup form
router.get("/register", (req, res) => {
  res.render("auth/register.ejs");
});

// Handle signup
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to Store!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/register");
  }
});

// Login form
router.get("/login", (req, res) => {
  res.render("auth/login.ejs");
});

// Handle login
router.post("/login", passport.authenticate("local", {
  failureFlash: true,
  failureRedirect: "/login"
}), (req, res) => {
  req.flash("success", "Welcome back!");
  res.redirect("/listings");
});

// Logout
router.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.flash("success", "You have logged out successfully.");
    res.redirect("/listings");
  });
});

module.exports = router;
