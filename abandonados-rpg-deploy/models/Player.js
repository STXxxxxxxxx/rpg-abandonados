const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    characterName: {
      type: String,
      required: true,
      trim: true,
    },
    hpMax: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    hpCurrent: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    ammoMax: {
      type: Number,
      required: true,
      min: 0,
      default: 6,
    },
    ammoCurrent: {
      type: Number,
      required: true,
      min: 0,
      default: 6,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Player", playerSchema);
