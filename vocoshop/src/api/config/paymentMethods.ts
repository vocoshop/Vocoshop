// src/config/paymentMethods.ts

export type PaymentMethodType = {
id: string;
label: string;
icon: string;
type: "mobile_money" | "card";
fields: string[];
};

export const PAYMENT_METHODS: PaymentMethodType[] = [

{
id: "mtn",
label: "MTN Mobile Money",
icon: "phone-portrait-outline",
type: "mobile_money",
fields: ["phone"]
},

{
id: "airtel",
label: "Airtel Money",
icon: "phone-portrait-outline",
type: "mobile_money",
fields: ["phone"]
},

{
id: "visa",
label: "Carte Visa",
icon: "card-outline",
type: "card",
fields: ["cardNumber","expiry","cvc","name"]
},

];
