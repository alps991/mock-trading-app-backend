const { db } = require("../firebase/firebase");

const validateTrade = async (req, res, next) => {
    try {
        const { currencyToSell, quantityToSell, currencyToBuy, uid } = req.body;

        if (quantityToSell <= 0) {
            return res.status(400).send("Invalid sell quantity");
        }

        const coinPricesRes = await db.ref(`coins/cur`).once('value');
        const coinPrices = coinPricesRes.val();
        if (!(currencyToBuy in coinPrices) || !(currencyToSell in coinPrices)) {
            return res.status(400).send("Invalid currency symbol");
        }

        if (currencyToBuy === currencyToSell) {
            return res.status(400).send("Must trade between two different currencies");
        }

        const userRes = await db.ref(`users/${uid}`).once('value');
        const user = userRes.val();
        if (!user) {
            return res.status(400).send("User not found");
        }

        let availableCurrency = user.balances[currencyToSell] - user.lockedBalances[currencyToSell];;
        if (req.method === "PATCH") {
            const existingTradeRes = await db.ref(`trades/openTrades/${req.body.tradeId}`).once('value');
            const existingTrade = existingTradeRes.val();
            availableCurrency += existingTrade.quantityToSell;
            req.existingTrade = existingTrade;
        }

        if (availableCurrency < quantityToSell) {
            return res.status(400).send("Insufficient balance");
        }

        req.user = user;
        req.coinPrices = coinPrices;

        next();

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
}

module.exports = { validateTrade };