const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    enum: ["google", "github", "facebook", "microsoft", "linkedin"],
  },
  providerId: {
    type: String,
    required: true,
  },
  displayName: String,
  email: String,
  profilePhoto: String,
  accessToken: String,
  refreshToken: String,
  linkedAt: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  providers: [providerSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: Date,
});

// Update the updatedAt field before saving
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound index for provider uniqueness
userSchema.index(
  { "providers.provider": 1, "providers.providerId": 1 },
  { unique: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
