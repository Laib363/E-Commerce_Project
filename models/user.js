const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  // username and password are_not_ specified here,
  // passport-local-mongoose adds them automatically
  email: {
    type: String,
    required: true,
    unique: true
  },
  // The cart will store the IDs of listings
  cart: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing"
    }
  ]
});

// This adds the username, hash, and salt fields to the schema
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);