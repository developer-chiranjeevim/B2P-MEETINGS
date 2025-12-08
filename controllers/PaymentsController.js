import Razorpay from 'razorpay';
import dotenv from "dotenv";
import crypto from "crypto";
import { client } from "../db/dbConfig.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const GetRazorPayKey = async(request, response) => {

    try{

        response.status(200).json({key: process.env.RAZORPAY_KEY_ID});

    }catch(error){
        response.status(500).json({message: "unable to generate razorpay key"});
    };
};

const MakePayment = async(request, response) => {

    try{

        const { amount, currency, receipt, notes } = request.body;
        // Validation
        if (!amount || amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid amount is required' 
        });
        }

        const options = {
        amount: amount * 100, // Convert to paise
        currency: currency || 'INR',
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes || {}
        };

        const order = await razorpay.orders.create(options);

        response.status(200).json({
        success: true,
        order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt
        }
        });

    }catch(error){
        console.log(error.message);
        response.status(500).json({message: "unable to process payment"})
    };
};

const VerifyPayment = async(request, response) => {

    try{
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

            // Validation
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment verification parameters'
            });
            }

            // Create signature
            const sign = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

            // Verify signature
            if (razorpay_signature === expectedSign) {
            // Payment verified successfully
            // Here you can update your database, send confirmation email, etc.
            
            response.json({
                success: true,
                message: 'Payment verified successfully',
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id
            });
            } else {
            response.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }


    }catch(error){
        console.log(error);
        response.status(500).json({message: "unable to verify payment"});
    };
};


const AddTransaction = async(request, response) => {
    const {transaction_id, amount} = request.body;
    const student_id = request.token.id;

    const datas = {
        transaction_id,
        student_id,
        amount,
        date: Date.now(),
    };

    const params = {
        TableName:process.env.DYNAMO_DB_TRANSACTIONS_TABLE,
        Item: datas
    };

    try{
        const DBResponse = await client.send(new PutCommand(params));
       
        response.status(200).json({message: DBResponse})

    }catch(error){
        response.status(500).json({message: error.message});
    };
};


export {GetRazorPayKey, MakePayment, VerifyPayment, AddTransaction}