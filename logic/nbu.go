package logic

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type NBUResponse struct {
	Rate float64 `json:"rate"`
}

func GetNBURate(currency string, date time.Time) (float64, error) {
	if currency == "UAH" || currency == "" {
		return 1.0, nil
	}

	dateStr := date.Format("20060102")
	url := fmt.Sprintf("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=%s&date=%s&json", currency, dateStr)

	fmt.Printf("Fetching NBU rate: %s\n", url)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("NBU request failed: %v\n", err)
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("NBU returned status: %d\n", resp.StatusCode)
		return 0, fmt.Errorf("NBU API returned status %d", resp.StatusCode)
	}

	var rates []NBUResponse
	if err := json.NewDecoder(resp.Body).Decode(&rates); err != nil {
		fmt.Printf("Failed to decode NBU response: %v\n", err)
		return 0, err
	}

	if len(rates) == 0 {
		fmt.Printf("No NBU rate found for %s on %s\n", currency, dateStr)
		return 0, fmt.Errorf("no rate found for %s on %s", currency, dateStr)
	}

	fmt.Printf("NBU Rate for %s on %s is %f\n", currency, dateStr, rates[0].Rate)
	return rates[0].Rate, nil
}
