import mongoose, { Schema } from "mongoose";

const filmSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    director: {
      type: String,
      required: true,
      trim: true,
    },
    releaseYear: {
      type: Number,
      required: true,
    },
    price: { // Price for purchasing/renting
      type: Number,
      required: true,
      min: 0,
    },
    stock: { // Inventory count
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Film = mongoose.model("Film", filmSchema);