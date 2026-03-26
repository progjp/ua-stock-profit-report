package logic

import (
	"stocks/models"
	"sort"
	"time"
)

type FIFOUnit struct {
	Quantity      float64
	Price         float64
	NBURate       float64
	Date          time.Time
	Commission    float64 // Buy commission in original currency
	CommissionUAH float64 // Buy commission in UAH
	Tax           float64 // Buy tax in original currency
	TaxUAH        float64 // Buy tax in UAH
}

type PortfolioData struct {
	Holdings  map[string]*models.Holding `json:"holdings"`
	Sells     []models.SellReport        `json:"sells"`
	Dividends []models.DividendReport    `json:"dividends"`
}

func GetPortfolioData(transactions []models.Transaction, from, to *time.Time) PortfolioData {
	holdings := make(map[string]*models.Holding)
	buyQueue := make(map[string][]FIFOUnit)
	var sells []models.SellReport
	var dividends []models.DividendReport

	sort.Slice(transactions, func(i, j int) bool {
		return transactions[i].Date.Before(transactions[j].Date)
	})

	for _, tx := range transactions {
		// Skip non-stock trades (e.g. FX like EUR/USD or USD/EUR)
		if len(tx.Symbol) > 7 && (tx.Symbol[3:4] == "/" || tx.Symbol[4:5] == "/") {
			continue
		}
		if tx.Symbol == "USD" || tx.Symbol == "EUR" || tx.Symbol == "UAH" {
			continue
		}

		// If to date is set, ignore transactions after it
		if to != nil && tx.Date.After(*to) {
			continue
		}

		if _, ok := holdings[tx.Symbol]; !ok {
			holdings[tx.Symbol] = &models.Holding{Symbol: tx.Symbol, Currency: tx.Currency}
		}
		h := holdings[tx.Symbol]
		h.LastTradeDate = tx.Date

		switch tx.Type {
		case models.Buy:
			commUAH := tx.Commission * tx.NBURate
			taxUAH := tx.Tax * tx.NBURate
			buyQueue[tx.Symbol] = append(buyQueue[tx.Symbol], FIFOUnit{
				Quantity:      tx.Quantity,
				Price:         tx.Price,
				NBURate:       tx.NBURate,
				Date:          tx.Date,
				Commission:    tx.Commission,
				CommissionUAH: commUAH,
				Tax:           tx.Tax,
				TaxUAH:        taxUAH,
			})
			h.Quantity += tx.Quantity
			h.TotalCost += (tx.Quantity * tx.Price) + tx.Commission + tx.Tax
			h.TotalCostUAH += (tx.Quantity * tx.Price * tx.NBURate) + commUAH + taxUAH
		case models.Sell:
			remainingToSell := tx.Quantity
			sellPrice := tx.Price
			symbolQueue := buyQueue[tx.Symbol]
			
			sellCommPerUnit := tx.Commission / tx.Quantity
			sellTaxPerUnit := tx.Tax / tx.Quantity

			for remainingToSell > 0 && len(symbolQueue) > 0 {
				unit := &symbolQueue[0]
				sellAmount := unit.Quantity
				if remainingToSell < unit.Quantity {
					sellAmount = remainingToSell
				}

				// Calculate proportional buy commission/tax for this batch
				// using the fraction of the current FIFO unit being sold
				fraction := sellAmount / unit.Quantity
				buyCommBatch := fraction * unit.Commission
				buyCommBatchUAH := fraction * unit.CommissionUAH
				buyTaxBatch := fraction * unit.Tax
				buyTaxBatchUAH := fraction * unit.TaxUAH

				// Update unit's remaining commission/tax for subsequent sells of this unit
				unit.Commission -= buyCommBatch
				unit.CommissionUAH -= buyCommBatchUAH
				unit.Tax -= buyTaxBatch
				unit.TaxUAH -= buyTaxBatchUAH

				sellCommBatch := sellAmount * sellCommPerUnit
				sellCommBatchUAH := sellCommBatch * tx.NBURate // Note: assuming comm is in same currency or rate is handled
				
				sellTaxBatch := sellAmount * sellTaxPerUnit
				sellTaxBatchUAH := sellTaxBatch * tx.NBURate

				// Profit = (Sell Revenue - Buy Cost - Sell Commission - Buy Commission - Sell Tax - Buy Tax)
				// In the same currency
				sellRevenue := sellPrice * sellAmount
				buyCost := unit.Price * sellAmount
				profit := sellRevenue - buyCost - sellCommBatch - buyCommBatch - sellTaxBatch - buyTaxBatch
				
				// Profit UAH = (Sell Revenue UAH - Buy Cost UAH - Sell Comm UAH - Buy Comm UAH - Sell Tax UAH - Buy Tax UAH)
				sellRevenueUAH := sellAmount * sellPrice * tx.NBURate
				buyCostUAH := sellAmount * unit.Price * unit.NBURate
				profitUAH := sellRevenueUAH - buyCostUAH - sellCommBatchUAH - buyCommBatchUAH - sellTaxBatchUAH - buyTaxBatchUAH

				// Only add to realized profit if it's within the requested period
				if from == nil || !tx.Date.Before(*from) {
					h.RealizedProfit += profit
					h.RealizedProfitUAH += profitUAH
					
					sells = append(sells, models.SellReport{
						Broker:            tx.Broker,
						Symbol:            tx.Symbol,
						Date:              tx.Date,
						BuyDate:           unit.Date,
						Quantity:          sellAmount,
						BuyPrice:          unit.Price,
						SellPrice:         sellPrice,
						CommissionBuy:     buyCommBatch,
						CommissionSell:    sellCommBatch,
						CommissionBuyUAH:  buyCommBatchUAH,
						CommissionSellUAH: sellCommBatchUAH,
						Tax:               sellTaxBatch + buyTaxBatch,
						TaxUAH:            sellTaxBatchUAH + buyTaxBatchUAH,
						Profit:            profit,
						ProfitUAH:         profitUAH,
						Currency:          tx.Currency,
						CurrencyRateBuy:   unit.NBURate,
						CurrencyRateSell:  tx.NBURate,
						Comment:           tx.Comment,
					})
				}
				
				h.Quantity -= sellAmount
				h.TotalCost -= (sellAmount * unit.Price)
				h.TotalCostUAH -= (sellAmount * unit.Price * unit.NBURate)

				unit.Quantity -= sellAmount
				remainingToSell -= sellAmount
				if unit.Quantity <= 0 {
					symbolQueue = symbolQueue[1:]
				}
			}
			buyQueue[tx.Symbol] = symbolQueue
		case models.Dividend:
			if from == nil || !tx.Date.Before(*from) {
				h.TotalDividends += tx.TotalAmount 
				h.TotalDividendsUAH += (tx.TotalAmount * tx.NBURate)
			}
			
			// Standardized logic:
			// tx.TotalAmount is the NET received.
			// tx.Tax is stored as absolute positive value.
			// report.Tax should be negative for display as requested.
			// report.GrossAmount = Net + Tax
			tax := -tx.Tax // Make negative for display
			gross := tx.TotalAmount + tx.Tax

			if from == nil || !tx.Date.Before(*from) {
				dividends = append(dividends, models.DividendReport{
					Broker:       tx.Broker,
					Symbol:       tx.Symbol,
					Date:         tx.Date,
					GrossAmount:  gross,
					GrossAmountUAH: gross * tx.NBURate,
					Tax:          tax,
					TaxUAH:       tax * tx.NBURate,
					NetAmount:    tx.TotalAmount,
					AmountUAH:    tx.TotalAmount * tx.NBURate,
					Currency:     tx.Currency,
					CurrencyRate: tx.NBURate,
				})
			}
		case models.Tax:
			if from == nil || !tx.Date.Before(*from) {
				// Special case for separate tax rows if they persist (though importers now merge them)
				h.TotalDividends -= tx.TotalAmount // Subtract from net if it's a standalone tax
				h.TotalDividendsUAH -= (tx.TotalAmount * tx.NBURate)
			}
			
			found := false
			for idx := len(dividends) - 1; idx >= 0; idx-- {
				if dividends[idx].Symbol == tx.Symbol && dividends[idx].Tax == 0 {
					// Standalone tax row found for a previous dividend
					dividends[idx].Tax = -tx.TotalAmount
					dividends[idx].TaxUAH = -tx.TotalAmount * tx.NBURate
					dividends[idx].GrossAmount = dividends[idx].NetAmount + tx.TotalAmount
					dividends[idx].GrossAmountUAH = dividends[idx].GrossAmount * tx.NBURate
					found = true
					break
				}
			}
			if !found {
				if from == nil || !tx.Date.Before(*from) {
					dividends = append(dividends, models.DividendReport{
						Broker:       tx.Broker,
						Symbol:       tx.Symbol,
						Date:         tx.Date,
						Tax:          -tx.TotalAmount,
						TaxUAH:       -tx.TotalAmount * tx.NBURate,
						NetAmount:    -tx.TotalAmount, // If it's just a tax row, net is negative
						AmountUAH:    -tx.TotalAmount * tx.NBURate,
						GrossAmount:  0,
						GrossAmountUAH: 0,
						Currency:     tx.Currency,
						CurrencyRate: tx.NBURate,
					})
				}
			}
		}
	}

	for _, h := range holdings {
		if h.Quantity > 0 {
			h.AveragePrice = h.TotalCost / h.Quantity
		}
	}

	return PortfolioData{Holdings: holdings, Sells: sells, Dividends: dividends}
}
