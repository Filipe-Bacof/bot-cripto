require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");

const {
    SYMBOL, PERIOD, INTERVAL, LIMIT,
    API_URL_PROD, API_URL_DEV, IS_PRODUCTION,
    API_KEY, SECRET_KEY
} = process.env;

const API_URL = IS_PRODUCTION ? API_URL_PROD : API_URL_DEV;

const ENDPOINT_GET = `/api/v3/klines?limit=${LIMIT}&interval=${INTERVAL}&symbol=${SYMBOL}`;
const ENDPOINT_POST = "/api/v3/order";

function averages(prices, period, startIndex) {
    let gains = 0, losses = 0;

    for (let i=0; i < period && (i + startIndex) < prices.length; i++) {
        const diff = prices[i + startIndex] - prices[i + startIndex - 1];

        if (diff >= 0) {
            gains += diff;
        } else {
            losses += Math.abs(diff);
        }
    }

    let avgGains = gains / period;
    let avgLosses = losses / period;
    return { avgGains, avgLosses };
}

function RSI(prices, period) {
    let avgGains = 0, avgLosses = 0;

    for (let i=1; i < prices.length; i++) {
        let newAverages = averages(prices, period, i);

        if (i === 1) {
            avgGains = newAverages.avgGains;
            avgLosses = newAverages.avgLosses;
            continue;
        }
        avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
        avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
    }

    const rs = avgGains / avgLosses;
    return 100 - (100 / (1 + rs));
}

async function newOrder(symbol, quantity, side) {
    const orderParams = { symbol, quantity, side };
    const order = {
        ...orderParams,
        type: "MARKET",
        timestamp: Date.now()
    };

    const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(new URLSearchParams(order).toString())
        .digest("hex");

    order.signature = signature;

    try {
        const { data } = await axios.post(
            API_URL + ENDPOINT_POST,
            new URLSearchParams(order).toString(),
            { headers: { "X-MBX-APIKEY": API_KEY } }
        );

        console.log(data);
    } catch (error) {
        console.error(error.response.data);
    }
}

let isOpened = false;

async function start () {
    const { data } = await axios.get(API_URL + ENDPOINT_GET);
    const candle = data[data.length - 1];
    const lastPrice = parseFloat(candle[4]);

    console.clear();
    console.log("Last Price: " + lastPrice);

    const prices = data.map(k => parseFloat(k[4]));
    const rsi = RSI(prices, PERIOD);

    console.log("RSI: " + rsi);

    if (rsi < 30 && isOpened === false) {
        console.log("sobrevendido! bom momento para comprar!");
        isOpened = true;
    } else if (rsi > 70 && isOpened === true) {
        console.log("sobrecomprado! bom momento para vender!");
        isOpened = false;  
    } else {
        console.log("aguardar!");
    }
}

setInterval(start, 3000);

start();