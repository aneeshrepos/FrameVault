import { Router } from "express";
import { verifyJWT } from "../middlewares/Auth.middleware.js";
import {
    createOrder,
    getMyOrders,
    getPaypalClientId,
    updateOrderToPaid,
} from "../controllers/order.controllers.js";

const router = Router();

// Routes for authenticated users
router.route("/").post(verifyJWT, createOrder); // Create new order (before payment)
router.route("/myorders").get(verifyJWT, getMyOrders); // Get user's orders

// Public route to get PayPal Client ID for the client SDK
router.route("/paypal-client-id").get(getPaypalClientId); 
router.route("/:id/pay").put(verifyJWT, updateOrderToPaid); // Update order status to paid

export default router;