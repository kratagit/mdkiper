FROM node:20-alpine

# Ustawienie katalogu roboczego
WORKDIR /app

# Kopiowanie plików definicji pakietów
COPY package*.json ./

# Instalacja tylko pakietów produkcyjnych (bez devDependencies)
RUN npm install --omit=dev

# Kopiowanie reszty kodu aplikacji
COPY . .

# Wystawienie portu aplikacji
EXPOSE 3005

# Uruchomienie aplikacji
CMD ["node", "server.js"]
