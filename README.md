# Stock Profit Calculator

A web application to calculate realized profit and dividends from Interactive Brokers (IBKR) and Freedom Finance (F24) reports.

## Features
- **FIFO Calculation:** Accurate profit calculation for stock sales.
- **UAH Tax Support:** Automated NBU (National Bank of Ukraine) exchange rate mapping for all transactions.
- **Detailed Profit Reports:** Includes currency rates for both "Buy" and "Sell" dates for accurate tax reporting.
- **Dividend Tracking:** Monitor gross/net dividends with corresponding currency rates.
- **Broker Support:** 
  - IBKR (Activity Flex Report CSV)
  - Freedom Finance (F24 Account Statement JSON/CSV)
- **Modern Dashboard:** View total profit, dividends, and current holdings in UAH.
- **Transaction History:** Searchable list of all imported transactions.

## Tech Stack
- **Backend:** Go, Gin, GORM, SQLite.
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide icons.

## How to Run

### 1. Run Backend
```bash
go run main.go
```
The server will start on `http://localhost:8080`.

### 2. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will be available on `http://localhost:5173`.

## Data Import Instructions

### IBKR
1. Log in to IBKR Portal.
2. Go to **Reports** -> **Flex Queries**.
3. Create a new **Activity Flex Query**.
4. Include: **Trades**, **Dividends**, and **Withholding Tax**.
5. Set format to **CSV**.
6. Run and download the report.

### Freedom Finance
1. Log in to Freedom24.
2. Go to **Member Area** -> **Documents** (or Reports).
3. Select **Account Statement** (or Brokerage Report).
4. Choose the period and export as a **JSON** file (recommended) or CSV.
