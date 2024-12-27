const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const moment = require("moment");

const app = express();
app.use(bodyParser.json());

// MongoDB Schema for Food Data Traceability
const FoodItemSchema = new mongoose.Schema({
  foodItem: String,  // Name of the food item
  origin: String,    // Supplier or farm where the food came from
  qualityCheckDate: { type: Date, default: Date.now },  // Last quality check date
  freshnessExpiryDate: Date,  // Expiry date based on freshness
  safetyCertifications: [String],  // List of certifications (e.g., Organic, Fair Trade)
  contaminationRisk: Boolean,  // Whether there is a contamination risk
  traceId: { type: String, unique: true },  // Unique identifier for each food item
  lastUpdated: { type: Date, default: Date.now },  // Track last update time
});

// MongoDB model for Food Items
const FoodItem = mongoose.model("FoodItem", FoodItemSchema);

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/foodTrust", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Function to check if the food item is trustworthy (checks freshness and contamination)
function checkFoodTrustworthiness(foodItem) {
  const currentTime = moment();
  const contaminationAlerts = [];

  // Check freshness (make sure food is still safe to consume)
  const freshnessExpiry = moment(foodItem.freshnessExpiryDate);
  const hoursUntilExpiry = freshnessExpiry.diff(currentTime, "hours");

  if (hoursUntilExpiry < 0) {
    contaminationAlerts.push("Food item has expired.");
  } else if (hoursUntilExpiry < 24) {
    contaminationAlerts.push(`Food item is nearing expiration (${hoursUntilExpiry} hours remaining).`);
  }

  // Check contamination risk
  if (foodItem.contaminationRisk) {
    contaminationAlerts.push("Food item has a contamination risk.");
  }

  return contaminationAlerts;
}

// Endpoint to get the traceability details of a food item
app.get("/api/food/:traceId", async (req, res) => {
  const { traceId } = req.params;

  try {
    // Fetch the food item by trace ID
    const foodItem = await FoodItem.findOne({ traceId });

    if (!foodItem) {
      return res.status(404).json({ error: "Food item not found." });
    }

    // Check if the food item is trustworthy (fresh and safe)
    const contaminationAlerts = checkFoodTrustworthiness(foodItem);

    if (contaminationAlerts.length > 0) {
      return res.status(400).json({
        error: "Food item has quality concerns.",
        contaminationAlerts: contaminationAlerts,
      });
    }

    // If the food item passes all checks, return the traceability data
    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      lastUpdated: foodItem.lastUpdated,
      message: "Food item is safe and trustworthy.",
    });
  } catch (error) {
    console.error("Error fetching food item data:", error);
    res.status(500).json({ error: "Failed to fetch food item data." });
  }
});

// Endpoint to update food item traceability information
app.post("/api/food/:traceId", async (req, res) => {
  const { traceId } = req.params;
  const updatedData = req.body;

  try {
    // Find the food item by trace ID and update the data
    const foodItem = await FoodItem.findOneAndUpdate(
      { traceId },
      { ...updatedData, lastUpdated: Date.now() },
      { new: true }
    );

    if (!foodItem) {
      return res.status(404).json({ error: "Food item not found." });
    }

    // Check the updated food item for trustworthiness
    const contaminationAlerts = checkFoodTrustworthiness(foodItem);

    if (contaminationAlerts.length > 0) {
      return res.status(400).json({
        error: "Food item has quality concerns.",
        contaminationAlerts: contaminationAlerts,
      });
    }

    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      lastUpdated: foodItem.lastUpdated,
      message: "Food item traceability updated successfully.",
    });
  } catch (error) {
    console.error("Error updating food item data:", error);
    res.status(500).json({ error: "Failed to update food item data." });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
