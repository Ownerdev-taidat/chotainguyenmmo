// Test MoMo API with PRODUCTION credentials — copy exact from nodejs_momo/MoMo.js
var partnerCode = "MOMOC2FG20260312";
var accessKey = "3INRPBrmkGqVbfpM";
var secretkey = "db2DlbdWLmwac3pRXEeN7RSQVawesS6m";
var requestId = partnerCode + new Date().getTime();
var orderId = requestId;
var orderInfo = "pay with MoMo";
var redirectUrl = "https://chotainguyenmmo.com/return";
var ipnUrl = "https://chotainguyenmmo.com/notify";
var amount = "50000";
var requestType = "captureWallet"
var extraData = "";

var rawSignature = "accessKey="+accessKey+"&amount=" + amount+"&extraData=" + extraData+"&ipnUrl=" + ipnUrl+"&orderId=" + orderId+"&orderInfo=" + orderInfo+"&partnerCode=" + partnerCode +"&redirectUrl=" + redirectUrl+"&requestId=" + requestId+"&requestType=" + requestType
console.log("--------------------RAW SIGNATURE----------------")
console.log(rawSignature)

const crypto = require('crypto');
var signature = crypto.createHmac('sha256', secretkey)
    .update(rawSignature)
    .digest('hex');
console.log("--------------------SIGNATURE----------------")
console.log(signature)

const requestBody = JSON.stringify({
    partnerCode : partnerCode,
    accessKey : accessKey,
    requestId : requestId,
    amount : amount,
    orderId : orderId,
    orderInfo : orderInfo,
    redirectUrl : redirectUrl,
    ipnUrl : ipnUrl,
    extraData : extraData,
    requestType : requestType,
    signature : signature,
    lang: 'en'
});

const https = require('https');
const options = {
    hostname: 'payment.momo.vn',  // PRODUCTION endpoint
    port: 443,
    path: '/v2/gateway/api/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
    }
}

const req = https.request(options, res => {
    res.setEncoding('utf8');
    res.on('data', (body) => {
        console.log('\n--------------------RESPONSE----------------');
        const parsed = JSON.parse(body);
        console.log('resultCode:', parsed.resultCode);
        console.log('message:', parsed.message);
        if (parsed.payUrl) console.log('payUrl:', parsed.payUrl);
    });
})

req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
});
console.log("\nSending to PRODUCTION endpoint...")
req.write(requestBody);
req.end();
