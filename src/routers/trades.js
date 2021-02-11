const express = require('express');
const moment = require('moment');
const { roundQuantity, balancesObjToArray, lockedBalancesObjToArray } = require('../utils/utils');
const { validateTrade } = require('../middleware/trades');
const { db } = require('../firebase/firebase');

const router = new express.Router();

router.post('/api/trades/market', validateTrade, async (req, res) => {
    try {
        const { currencyToSell, quantityToSell, currencyToBuy, tradePair, action, uid } = req.body;
        const { user, coinPrices } = req;

        let quantityToBuy = (coinPrices[currencyToSell] * quantityToSell) / coinPrices[currencyToBuy];
        quantityToBuy = roundQuantity(quantityToBuy, currencyToBuy);

        user.balances[currencyToSell] -= quantityToSell;
        user.balances[currencyToBuy] += quantityToBuy;

        const newTrade = {
            currencyToSell,
            currencyToBuy,
            quantityToSell,
            quantityToBuy,
            boughtCurrencyPrice: coinPrices[currencyToBuy],
            soldCurrencyPrice: coinPrices[currencyToSell],
            ts: moment().format(),
            type: 'market',
            tradePair,
            action,
            uid,
        }

        const newTradeKey = db.ref(`trades/closedTrades`).push().key;
        const updates = {};
        updates[`/trades/closedTrades/${newTradeKey}`] = newTrade;
        updates[`/users/${uid}/balances`] = user.balances;
        updates[`/users/${uid}/closedTrades/${newTradeKey}`] = true;

        await db.ref().update(updates);

        const newUserBalances = balancesObjToArray(user.balances, coinPrices, user.totalValue);

        res.status(201).send({ newTrade, newUserBalances });

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

router.post('/api/trades/limit', validateTrade, async (req, res) => {
    try {
        const user = req.user;
        const { currencyToSell, quantityToSell, priceToSell, currencyToBuy, tradePair, action, uid } = req.body;
        const lockedBalances = user.lockedBalances;
        lockedBalances[currencyToSell] += quantityToSell;

        const newTradeKey = db.ref(`trades/openTrades`).push().key;

        const newTrade = {
            currencyToSell,
            currencyToBuy,
            quantityToSell,
            priceToSell,
            postedAt: moment().format(),
            type: 'limit',
            tradePair,
            action,
            uid,
            tradeId: newTradeKey,
        }

        const updates = {};
        updates[`trades/openTrades/${newTradeKey}`] = newTrade;
        updates[`users/${uid}/openTrades/${newTradeKey}`] = true;
        updates[`users/${uid}/lockedBalances`] = lockedBalances;
        db.ref().update(updates);

        const newLockedBalances = lockedBalancesObjToArray(lockedBalances);

        res.status(201).send({ newTrade, newLockedBalances });
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

router.patch('/api/trades/:id', validateTrade, async (req, res) => {
    try {
        const { currencyToSell, quantityToSell, priceToSell } = req.body;
        const { user, existingTrade } = req;
        user.lockedBalances[currencyToSell] += quantityToSell - existingTrade.quantityToSell;
        existingTrade.quantityToSell = quantityToSell;
        existingTrade.priceToSell = priceToSell;

        const updates = {};
        updates[`users/${existingTrade.uid}`] = user;
        updates[`trades/openTrades/${existingTrade.tradeId}`] = existingTrade;

        await db.ref().update(updates);

        const newLockedBalances = lockedBalancesObjToArray(user.lockedBalances);

        res.status(200).send({
            newLockedBalances,
            tradeId: existingTrade.tradeId,
            updates: {
                quantityToSell,
                priceToSell,
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

router.delete('/api/trades/:id', async (req, res) => {
    try {
        const tradeId = req.params.id;
        const tradeRes = await db.ref(`trades/openTrades/${tradeId}`).once('value');
        const trade = tradeRes.val();
        if (!trade) {
            return res.status(404).send("Trade id not found");
        }

        const uid = trade.uid;
        const userRes = await db.ref(`users/${uid}`).once('value');
        const user = userRes.val();
        const newLockedBalances = user.lockedBalances;
        newLockedBalances[trade.currencyToSell] -= trade.quantityToSell;

        const updates = {};
        updates[`users/${uid}/lockedBalances`] = newLockedBalances;
        updates[`users/${uid}/openTrades/${tradeId}`] = null;
        updates[`trades/openTrades/${tradeId}`] = null;

        await db.ref().update(updates);

        const newLockedBalancesArray = lockedBalancesObjToArray(newLockedBalances);

        res.status(200).send({ tradeId, newLockedBalances: newLockedBalancesArray });

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

module.exports = router;