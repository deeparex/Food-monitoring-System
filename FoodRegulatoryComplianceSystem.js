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
  complianceStatus: { type: Boolean, default: false },  // Regulatory compliance status
  lastUpdated: { type: Date, default: Date.now },  // Track last update time
});

// MongoDB model for Food Items
const FoodItem = mongoose.model("FoodItem", FoodItemSchema);

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/foodCompliance", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Function to check if the food item complies with regulatory standards
function checkRegulatoryCompliance(foodItem) {
  // Food safety certifications from regulatory bodies
  const requiredCertifications = ["FDA Approved", "FSSAI Certified", "ISO 22000"];
  
  // Check if the food item has the required certifications for compliance
  const hasRequiredCertifications = requiredCertifications.every(cert =>
    foodItem.safetyCertifications.includes(cert)
  );

  // If any certification is missing, the food item is not compliant
  if (!hasRequiredCertifications) {
    return "Food item does not meet regulatory compliance standards.";
  }
  
  // If food item is free from contamination risk, it's compliant
  if (foodItem.contaminationRisk) {
    return "Food item has a contamination risk, which violates food safety standards.";
  }

  return "Food item complies with all regulatory standards.";
}

// Endpoint to get the traceability details and regulatory compliance of a food item
app.get("/api/food/:traceId", async (req, res) => {
  const { traceId } = req.params;

  try {
    // Fetch the food item by trace ID
    const foodItem = await FoodItem.findOne({ traceId });

    if (!foodItem) {
      return res.status(404).json({ error: "Food item not found." });
    }

    // Check if the food item complies with regulatory standards
    const complianceStatus = checkRegulatoryCompliance(foodItem);

    if (complianceStatus !== "Food item complies with all regulatory standards.") {
      return res.status(400).json({
        error: "Food item is not compliant with regulatory standards.",
        complianceStatus: complianceStatus,
      });
    }

    // If the food item complies with all standards, return the traceability data
    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      complianceStatus: "Food item complies with all regulatory standards.",
      lastUpdated: foodItem.lastUpdated,
    });
  } catch (error) {
    console.error("Error fetching food item data:", error);
    res.status(500).json({ error: "Failed to fetch food item data." });
  }
});

// Endpoint to update food item traceability and compliance information
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

    // Check the updated food item for regulatory compliance
    const complianceStatus = checkRegulatoryCompliance(foodItem);

    if (complianceStatus !== "Food item complies with all regulatory standards.") {
      return res.status(400).json({
        error: "Food item is not compliant with regulatory standards.",
        complianceStatus: complianceStatus,
      });
    }

    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      complianceStatus: "Food item complies with all regulatory standards.",
      lastUpdated: foodItem.lastUpdated,
      message: "Food item traceability and compliance information updated successfully.",
    });
  } catch (error) {
    console.error("Error updating food item data:", error);
    res.status(500).json({ error: "Failed to update food item data." });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
