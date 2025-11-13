// app.js

//  ENVIRONMENT VARIABLES: Load .env file first
require('dotenv').config(); // MUST install: npm install dotenv

// 📦 Imports
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { isLoggedIn, isAuthor } = require("./controllers/middleware");
const crypto = require("crypto");
const multer = require("multer"); // MUST install: npm install multer
const cloudinary = require('cloudinary').v2; // MUST install: npm install cloudinary


//  Models
const User = require("./models/user.js");
const Listing = require("./models/listing.js");
const Order = require("./models/order.js"); 

//  Cloudinary Configuration (Uses credentials from .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
}); 

//  App Setup
const app = express();
const PORT = 8080;
const ATLAS_URL = process.env.MONGODB_URI; // Using MONGODB_URI from .env

// Multer Configuration (stores the file in memory for direct Cloudinary upload)
const upload = multer({ storage: multer.memoryStorage() });


// Database Connection (Uses Atlas URI)
mongoose.connect(ATLAS_URL) 
  .then(() => console.log("Connected to DB (Atlas)"))
  .catch(err => console.log("Database connection error:", err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// EJS Setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Set layouts directory for boilerplate
app.set('layout', 'layouts/boilerplate');


// Session & Flash
app.use(session({
  secret: "mystoresessionsecret",
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));
app.use(flash());

// Passport Setup
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash & Current User Middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  next();
});

// ------------------ Root Route ------------------
app.get("/", (req, res) => {
  res.redirect("/listings");
});

// ------------------ Auth Routes ------------------
// Register Form
app.get("/register", (req, res) => {
  res.render("auth/register", { layout: false }); 
});

// Register POST
app.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, err => {
      if (err) return next(err);
      req.flash("success", "Welcome! You are now logged in.");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/register");
  }
});

// Login Form
app.get("/login", (req, res) => {
  res.render("auth/login", { layout: false }); 
});

// Login POST
app.post("/login", passport.authenticate("local", {
  failureFlash: true,
  failureRedirect: "/login"
}), (req, res) => {
  req.flash("success", "Welcome back!");
  res.redirect("/listings");
});

// Logout
app.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.flash("success", "Logged out successfully.");
    res.redirect("/listings");
  });
});

// ------------------ Listings Routes (UPDATED for Image Handling) ------------------
// Index
app.get("/listings", async (req, res) => {
  const listings = await Listing.find({});
  res.render("listings/index", { listings });
});

// New Form
app.get("/listings/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

// Create (UPDATED with Multer and Cloudinary)
app.post("/listings", isLoggedIn, upload.single('image'), async (req, res) => {
  try {
    const newListing = new Listing(req.body.listing);
    newListing.author = req.user._id;

    if (req.file) {
      // Upload file to Cloudinary
      const result = await cloudinary.uploader.upload(
        // Convert file buffer to a data URI for upload
        `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, 
        { folder: "ecommerce_products" }
      );
      
      // Save Cloudinary URL and filename
      newListing.image = {
          url: result.secure_url,
          filename: result.public_id,
      };
    } 

    await newListing.save();
    req.flash("success", "Listing created successfully!");
    res.redirect("/listings");
  } catch (e) {
    req.flash("error", "Failed to upload image or create listing: " + e.message);
    res.redirect("/listings/new");
  }
});


// Show
app.get("/listings/:id", async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("author");
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }
  // Check if item is already in cart
  let inCart = false;
  if (req.user) {
    inCart = req.user.cart.includes(listing._id.toString());
  }
  res.render("listings/show", { listing, inCart });
});

// Edit Form
app.get("/listings/:id/edit", isLoggedIn, isAuthor, async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("listings/edit", { listing });
});

// Update (UPDATED to handle new image upload and optional old image deletion)
app.put("/listings/:id", isLoggedIn, isAuthor, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const oldListing = await Listing.findById(id);
  const updateData = { ...req.body.listing };
  
  if (req.file) {
    // 1. Delete old image from Cloudinary
    if (oldListing.image.filename) {
        await cloudinary.uploader.destroy(oldListing.image.filename);
    }
    
    // 2. Upload new image
    const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, 
        { folder: "ecommerce_products" }
    );
    
    // 3. Update image data
    updateData.image = {
        url: result.secure_url,
        filename: result.public_id,
    };
  } else {
    // If no new file is uploaded, retain existing image data
    updateData.image = oldListing.image;
  }

  await Listing.findByIdAndUpdate(id, updateData);
  req.flash("success", "Listing updated successfully!");
  res.redirect(`/listings/${id}`);
});

// Delete (UPDATED to delete image from Cloudinary)
app.delete("/listings/:id", isLoggedIn, isAuthor, async (req, res) => {
  const { id } = req.params;
  const deletedListing = await Listing.findByIdAndDelete(id);

  // Delete the image from Cloudinary
  if (deletedListing && deletedListing.image && deletedListing.image.filename) {
    await cloudinary.uploader.destroy(deletedListing.image.filename);
  }

  req.flash("success", "Listing deleted successfully!");
  res.redirect("/listings");
});


// ------------------ Cart Routes (NEW) ------------------

// Show Cart
app.get("/cart", isLoggedIn, async (req, res) => {
  const user = await req.user.populate("cart");
  const cartItems = user.cart;
  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  res.render("orders/cart", { cart: cartItems, total });
});

// Add to Cart
app.post("/cart/add/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  // Check if item is already in cart
  if (!user.cart.includes(id)) {
    user.cart.push(id);
    await user.save();
    req.flash("success", "Item added to cart!");
  } else {
    req.flash("error", "Item is already in your cart.");
  }
  res.redirect(`/listings/${id}`);
});

// Remove from Cart
app.delete("/cart/remove/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  // Pull the item from the user's cart array
  await User.findByIdAndUpdate(req.user._id, { $pull: { cart: id } });
  req.flash("success", "Item removed from cart.");
  res.redirect("/cart");
});

// ------------------ Order Routes (NEW) ------------------

// Checkout (Create Order from Cart)
app.post("/orders/checkout", isLoggedIn, async (req, res) => {
  const user = await req.user.populate("cart");
  const cartItems = user.cart;

  if (cartItems.length === 0) {
    req.flash("error", "Your cart is empty.");
    return res.redirect("/cart");
  }

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  // Create a new order
  const newOrder = new Order({
    orderId: crypto.randomBytes(8).toString("hex").toUpperCase(),
    customer: user._id,
    items: cartItems.map(item => item._id),
    totalAmount: total,
    status: "Order Placed",
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
  });

  await newOrder.save();

  // Clear the user's cart
  user.cart = [];
  await user.save();

  req.flash("success", `Order placed successfully! Your order ID is #${newOrder.orderId}`);
  res.redirect("/my-orders");
});

// Show "My Orders" page
app.get("/my-orders", isLoggedIn, async (req, res) => {
  const orders = await Order.find({ customer: req.user._id })
                            .populate("items")
                            .sort({ orderDate: -1 }); // Show newest first
  res.render("orders/myOrders", { orders });
});

// Show specific "Order Status" page
app.get("/orders/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id).populate("items");
    
    if (!order) {
      req.flash("error", "Order not found.");
      return res.redirect("/my-orders");
    }
    
    // Ensure the logged-in user is the customer
    if (!order.customer.equals(req.user._id)) {
      req.flash("error", "You are not authorized to view this order.");
      return res.redirect("/my-orders");
    }

    res.render("orders/orderStatus", { order });
  } catch (e) {
    req.flash("error", "Invalid order ID.");
    res.redirect("/my-orders");
  }
});


// ------------------ Start Server ------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});