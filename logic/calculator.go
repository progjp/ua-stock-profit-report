package logic

import (
	"stocks/models"
	"sort"
	"time"
)

type FIFOUnit struct {
	Quantity float64
	Price    float64
	NBURate  float64
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
			buyQueue[tx.Symbol] = append(buyQueue[tx.Symbol], FIFOUnit{
				Quantity: tx.Quantity,
				Price:    tx.Price,
				NBURate:  tx.NBURate,
			})
			h.Quantity += tx.Quantity
			h.TotalCost += (tx.Quantity * tx.Price)
			h.TotalCostUAH += (tx.Quantity * tx.Price * tx.NBURate)
		case models.Sell:
			remainingToSell := tx.Quantity
			sellPrice := tx.Price
			symbolQueue := buyQueue[tx.Symbol]
			
			commPerUnit := tx.Commission / tx.Quantity

			for remainingToSell > 0 && len(symbolQueue) > 0 {
				unit := &symbolQueue[0]
				sellAmount := unit.Quantity
				if remainingToSell < unit.Quantity {
					sellAmount = remainingToSell
				}

				batchComm := sellAmount * commPerUnit
				profit := (sellPrice - unit.Price) * sellAmount - batchComm
				profitUAH := (sellAmount * sellPrice * tx.NBURate) - (sellAmount * unit.Price * unit.NBURate) - (batchComm * tx.NBURate)

				// Only add to realized profit if it's within the requested period
				if from == nil || !tx.Date.Before(*from) {
					h.RealizedProfit += (sellPrice - unit.Price) * sellAmount - batchComm
					h.RealizedProfitUAH += profitUAH
					
					sells = append(sells, models.SellReport{
						Symbol:           tx.Symbol,
						Date:             tx.Date,
						Quantity:         sellAmount,
						BuyPrice:         unit.Price,
						SellPrice:        sellPrice,
						Commission:       batchComm,
						Profit:           profit,
						ProfitUAH:        profitUAH,
						Currency:         tx.Currency,
						CurrencyRateBuy:  unit.NBURate,
						CurrencyRateSell: tx.NBURate,
					})
				}
				
				h.Quantity -= sellAmount
				h.TotalCost -= (sellAmount * unit.Price)
				h.TotalCostUAH -= (sellAmount * unit.Price * tx.NBURate)

				unit.Quantity -= sellAmount
				remainingToSell -= sellAmount
				if unit.Quantity == 0 {
					symbolQueue = symbolQueue[1:]
				}
			}
			buyQueue[tx.Symbol] = symbolQueue
		case models.Dividend:
			if from == nil || !tx.Date.Before(*from) {
				h.TotalDividends += tx.TotalAmount 
				h.TotalDividendsUAH += (tx.TotalAmount * tx.NBURate)
			}
			
			gross := tx.TotalAmount
			tax := 0.0
			if tx.Tax != 0 {
				tax = -tx.Tax
				gross = tx.TotalAmount + tax
			}

			if from == nil || !tx.Date.Before(*from) {
				dividends = append(dividends, models.DividendReport{
					Symbol:       tx.Symbol,
					Date:         tx.Date,
					GrossAmount:  gross,
					Tax:          tax,
					NetAmount:    tx.TotalAmount,
					AmountUAH:    tx.TotalAmount * tx.NBURate,
					Currency:     tx.Currency,
					CurrencyRate: tx.NBURate,
				})
			}
		case models.Tax:
			if from == nil || !tx.Date.Before(*from) {
				h.TotalDividends += tx.TotalAmount 
				h.TotalDividendsUAH += (tx.TotalAmount * tx.NBURate)
			}
			
			found := false
			for idx := len(dividends) - 1; idx >= 0; idx-- {
				if dividends[idx].Symbol == tx.Symbol && dividends[idx].Tax == 0 {
					dividends[idx].Tax = -tx.TotalAmount
					dividends[idx].NetAmount += tx.TotalAmount
					dividends[idx].AmountUAH += (tx.TotalAmount * tx.NBURate)
					dividends[idx].CurrencyRate = tx.NBURate
					found = true
					break
				}
			}
			if !found {
				if from == nil || !tx.Date.Before(*from) {
					dividends = append(dividends, models.DividendReport{
						Symbol:       tx.Symbol,
						Date:         tx.Date,
						Tax:          -tx.TotalAmount,
						NetAmount:    tx.TotalAmount,
						AmountUAH:    tx.TotalAmount * tx.NBURate,
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
