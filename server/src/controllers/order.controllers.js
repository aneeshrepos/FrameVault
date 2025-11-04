import { asyncHandler } from "../utils/asyncHandler.js";
import { Order } from "../models/order.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import axios from "axios";

const generateAccessToken = async () => {
    try {
        if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
            throw new Error("PAYPAL_CLIENT_ID or PAYPAL_SECRET is not set in environment variables");
        }
        
        const base = process.env.NODE_ENV === 'production' 
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";

        const auth = Buffer.from(
            `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
        ).toString("base64");
        
        const { data } = await axios.post(
            `${base}/v1/oauth2/token`,
            "grant_type=client_credentials",
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        return data.access_token;
    } catch (error) {
        throw new ApiError(500, "Could not generate PayPal access token");
    }
};

const createOrder = asyncHandler(async (req, res) => {
    const {
        orderItems,
        shippingAddress,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        throw new ApiError(400, "No order items");
    }

    const order = new Order({
        user: req.user._id,
        orderItems,
        shippingAddress,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    });

    const createdOrder = await order.save();

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                createdOrder,
                "Order created successfully"
            )
        );
});

const getMyOrders = asyncHandler(async (req, res) => {
    // Finds orders for the currently logged-in user
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, orders, "User orders fetched successfully"));
});


const getPaypalClientId = asyncHandler(async (req, res) => {
    // Sends only the client ID to the frontend for the SDK
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { clientId: process.env.PAYPAL_CLIENT_ID },
                "PayPal client ID fetched successfully"
            )
        );
});

const updateOrderToPaid = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        // Step 1: Verify the payment with PayPal's API using the order ID from the client
        const accessToken = await generateAccessToken();
        const base = process.env.NODE_ENV === 'production' 
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
        
        const paypalOrderId = req.body.paypalOrderId; 

        // Get the order details from PayPal to verify payment
        const { data: paypalOrder } = await axios.get(
            `${base}/v2/checkout/orders/${paypalOrderId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // Step 2: Ensure the transaction was successful and the total amount matches
        const totalAmount = parseFloat(order.totalPrice).toFixed(2);
        
        // This assumes the payment was successfully captured client-side 
        // and we are simply verifying the status and amount.
        const paypalCapture = paypalOrder.purchase_units[0].payments.captures[0];

        if (paypalOrder.status === 'COMPLETED' && 
            paypalCapture.amount.value === totalAmount &&
            paypalCapture.amount.currency_code === 'USD' // Adjust currency as needed
        ) {
            order.isPaid = true;
            order.paidAt = Date.now();
            order.paymentResult = {
                id: paypalOrder.id,
                status: paypalOrder.status,
                update_time: paypalOrder.update_time,
                email_address: paypalOrder.payer.email_address,
            };

            const updatedOrder = await order.save();
            
            return res.json(
                new ApiResponse(
                    200,
                    updatedOrder,
                    "Order payment successful and recorded"
                )
            );

        } else {
            throw new ApiError(400, "PayPal payment verification failed. Status/Amount mismatch.");
        }
    } else {
        throw new ApiError(404, "Order not found");
    }
});

export { createOrder, getMyOrders, getPaypalClientId, updateOrderToPaid };