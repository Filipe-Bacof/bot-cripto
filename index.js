require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");

const {
    SYMBOL, RSI_PERIOD, SMA_PERIOD, INTERVAL, LIMIT, QUANTITY,
    API_URL_PROD, API_URL_DEV, IS_PRODUCTION,
    API_KEY, SECRET_KEY
} = process.env;

const API_URL = IS_PRODUCTION ? API_URL_PROD : API_URL_DEV;

const ENDPOINT_GET = `/api/v3/klines?limit=${LIMIT}&interval=${INTERVAL}&symbol=${SYMBOL}`;
const ENDPOINT_POST = "/api/v3/order";

let isOpened = false;

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

function SMA(prices, period) {
    if (prices.length < period) {
        throw new Error("Não há dados suficientes para calcular o SMA.");
    }

    const smaValues = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((acc, price) => acc + price, 0);
        smaValues.push(sum / period);
    }

    return smaValues;
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

async function start () {
    try {
        const { data } = await axios.get(API_URL + ENDPOINT_GET);
        if (!data || !data.length) {
            throw new Error("Dados inválidos retornados pela API.");
        }

        const prices = data.map(k => parseFloat(k[4]));
        const lastPrice = prices[prices.length - 1];

        console.clear();
        console.log("Último preço: " + lastPrice);

        const rsi = RSI(prices, RSI_PERIOD);
        console.log("RSI: " + rsi);

        const sma = SMA(prices, SMA_PERIOD);
        const lastSMA = sma[sma.length - 1];
        console.log("SMA: " + lastSMA);

        console.log("Já comprei: " + (isOpened ? "SIM" : "NÃO"));

        if (rsi < 30 && lastPrice > lastSMA && !isOpened) {
            console.log("Sobrevendido e acima da SMA! Bom momento para comprar.");
            isOpened = true;
            await newOrder(SYMBOL, QUANTITY, "BUY");
        } else if (rsi > 70 && isOpened) {
            console.log("Sobrecomprado! Bom momento para vender.");
            await newOrder(SYMBOL, QUANTITY, "SELL");
            isOpened = false;
        } else {
            console.log("Aguardar...");
        }
    } catch (error) {
        console.error("Erro no loop principal:", error.message);
    }
}

setInterval(start, 3000);
start();