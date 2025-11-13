 const Listing = require("../models/listing.js");
 
 const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "You must be logged in");
  res.redirect("/login");
};

async function isAuthor(req, res, next) {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing.author.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that!");
    return res.redirect(`/listings/${id}`);
  }
  next();
}
module.exports = { isLoggedIn, isAuthor };

