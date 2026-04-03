package db

import (
	"fmt"
	"os"
	"stocks/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "postgres"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "stocks"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(fmt.Sprintf("failed to connect database: %v", err))
	}

	// Migrate the schema
	DB.AutoMigrate(&models.User{}, &models.Transaction{}, &models.ExchangeRate{}, &models.UploadJob{})
	MigrateExistingTransactions()
}

func MigrateExistingTransactions() {
	var user models.User
	email := "zavyalovroman@gmail.com"
	if err := DB.Where("email = ?", email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create the initial user if it doesn't exist
			user = models.User{
				Email:        email,
				AuthProvider: "local", // Or whatever default
			}
			DB.Create(&user)
		}
	}

	// Assign all transactions with UserID = 0 (or NULL in some cases) to this user
	DB.Model(&models.Transaction{}).Where("user_id IS NULL OR user_id = 0").Update("user_id", user.ID)
}
