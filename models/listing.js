// models/listing.js

const mongoose = require("mongoose");
const DEFAULT_IMAGE_URL = "https://cdn.pixabay.com/photo/2021/04/20/11/13/product-photography-6193556_960_720.jpg";

const listingSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },

  // UPDATED: Image now stores an object with URL and filename
  image: {
    url: {
      type: String, // The secure URL provided by Cloudinary
      default: DEFAULT_IMAGE_URL,
    },
    filename: String, // Cloudinary's Public ID for managing the file
  },

  price: { type: Number },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;