document.addEventListener("DOMContentLoaded", function () {
    const searchBtn = document.getElementById("searchBtn");
    const currentLocationBtn = document.getElementById("currentLocationBtn");
    const recentCitiesContainer = document.getElementById("recentCitiesContainer");
    const recentCitiesDropdown = document.getElementById("recentCities");

    const apiKey = "0f8a425c48ba79891ebea04d17e14186";

    // -------------------- Recent Cities --------------------
    function updateRecentCitiesDropdown() {
        let recentCities = JSON.parse(localStorage.getItem("recentCities")) || [];

        if (recentCities.length > 0) {
            recentCitiesContainer.classList.remove("hidden");
            recentCitiesDropdown.innerHTML = `<option value="">-- Select a city --</option>`;
            recentCities.forEach(city => {
                const option = document.createElement("option");
                option.value = city;
                option.textContent = city;
                recentCitiesDropdown.appendChild(option);
            });
        } else {
            recentCitiesContainer.classList.add("hidden");
        }
    }

    function saveCityToLocalStorage(city) {
        let recentCities = JSON.parse(localStorage.getItem("recentCities")) || [];

        // Avoid duplicates, latest at top
        recentCities = [city, ...recentCities.filter(c => c.toLowerCase() !== city.toLowerCase())];
        localStorage.setItem("recentCities", JSON.stringify(recentCities));
        updateRecentCitiesDropdown();
    }

    // -------------------- Event Listeners --------------------
    searchBtn.addEventListener("click", function () {
        const city = document.getElementById("city").value.trim();
        if (!city) {
            alert("Please enter a city name.");
            return;
        }
        fetchWeatherData(city);
    });

    currentLocationBtn.addEventListener("click", function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchWeatherDataByCoords(lat, lon);
            }, function () {
                alert("Unable to retrieve your location.");
            });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    });

    recentCitiesDropdown.addEventListener("change", function () {
        const city = this.value;
        if (city) {
            fetchWeatherData(city);
        }
    });

    // -------------------- Show errors --------------------
    function showError(message) {
    const errorDiv = document.getElementById("errorCity");
    errorDiv.textContent = "❌ " + message;
    errorDiv.classList.remove("hidden");
    errorDiv.style.display = "block";   // force show
    errorDiv.style.color = "red";       // force red color
    errorDiv.style.fontWeight = "bold";
    }

    function clearError() {
        const errorDiv = document.getElementById("errorCity");
        errorDiv.textContent = "";
        errorDiv.classList.add("hidden");
    }

    // -------------------- API Calls --------------------
    function fetchWeatherData(city) {
        const weatherapiUrlCurrentDate = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}`;
        const weatherapiUrlNextFiveDays = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}`;

        // ---------- Current Weather ----------
        fetch(weatherapiUrlCurrentDate)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) throw new Error("City not found. Please check spelling.");
                    if (response.status === 401) throw new Error("Invalid API Key. Check your key.");
                    if (response.status === 429) throw new Error("Too many requests. Try again later.");
                    throw new Error("Network error: " + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.cod !== 200) throw new Error("City not found in Current Weather API");

                clearError(); // ✅ Clear previous errors when successful
                saveCityToLocalStorage(data.name);

                // 🌡️ Temperature
                const tempCelsius = (data.main.temp - 273.15).toFixed(1);
                const tempFahrenheit = ((data.main.temp - 273.15) * 9 / 5 + 32).toFixed(1);
                const windkmph = (data.wind.speed * 3.6).toFixed(1);

                // Update UI
                const tempEl = document.getElementById("temperature");
                const toggleBtn = document.getElementById("tempToggle");
                tempEl.textContent = `${tempCelsius} °C`;

                tempEl.dataset.c = tempCelsius;
                tempEl.dataset.f = tempFahrenheit;
                tempEl.dataset.unit = "C";
                toggleBtn.textContent = "Show °F";

                function toggleTemp() {
                    if (tempEl.dataset.unit === "C") {
                        tempEl.textContent = `${tempEl.dataset.f} °F`;
                        tempEl.dataset.unit = "F";
                        toggleBtn.textContent = "Show °C";
                    } else {
                        tempEl.textContent = `${tempEl.dataset.c} °C`;
                        tempEl.dataset.unit = "C";
                        toggleBtn.textContent = "Show °F";
                    }
                }
                toggleBtn.onclick = toggleTemp;

                // City time + details
                const utcTimeStamp = data.dt * 1000;
                const cityOffsetMs = data.timezone * 1000;
                const cityTime = new Date(utcTimeStamp + cityOffsetMs);
                const hours = cityTime.getHours();
                const isDay = hours >= 6 && hours < 18 ? "Day" : "Night";
                const cityTimeFormat = cityTime.toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                });

                const weatherMain = data.weather[0].main;
                const weatherDesc = data.weather[0].description;
                const iconCode = data.weather[0].icon || "01d";
                const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

                document.getElementById("cityName").textContent =
                    `${data.name} (${isDay}) - ${cityTimeFormat}`;
                document.getElementById("wind").textContent = `${windkmph} km/h`;
                document.getElementById("humidity").textContent = `${data.main.humidity} %`;
                document.getElementById("weatherType").textContent = `${weatherMain} (${weatherDesc})`;
                document.getElementById("weatherIcon").src = iconUrl;
                document.getElementById("weatherIcon").alt = weatherDesc;

                // 🔔 Extreme heat alert
                const alertBox = document.getElementById("weatherAlert");
                if (parseFloat(tempCelsius) > 40) {
                    alertBox.textContent = "⚠️ Extreme heat alert!";
                    alertBox.classList.remove("hidden");
                } else {
                    alertBox.classList.add("hidden");
                }

                return fetch(weatherapiUrlNextFiveDays);
            })
            .then(response => {
                if (!response.ok) throw new Error("Forecast API error: " + response.statusText);
                return response.json();
            })
            .then(data => {
                if (data.cod !== "200") throw new Error("City not found in Forecast API");
                clearError(); // ✅ Clear previous errors when successful

                const presentDateJson = data.list[0].dt_txt;
                const date = new Date(presentDateJson);

                date.setDate(date.getDate() + 1);
                let nextDate = date.toISOString().split("T")[0];

                const weatherBoxes = document.querySelectorAll(".grid > div.bg-gray-50");
                let boxIndex = 0;

                for (let i = 0; i < data.list.length && boxIndex < weatherBoxes.length; i++) {
                    if (data.list[i].dt_txt.includes(nextDate)) {
                        const temp = (data.list[i].main.temp - 273.15).toFixed(1);
                        const wind = data.list[i].wind.speed.toFixed(1);
                        const humidity = data.list[i].main.humidity;

                        const displayDate = new Date(nextDate).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric"
                        });
                        const box = weatherBoxes[boxIndex];
                        box.querySelector(".font-bold").textContent = displayDate;
                        box.querySelector(".temp").textContent = `${temp} °C`;
                        box.querySelector(".wind").textContent = `${wind} km/h`;
                        box.querySelector(".humidity").textContent = `${humidity} %`;

                        date.setDate(date.getDate() + 1);
                        nextDate = date.toISOString().split("T")[0];
                        boxIndex++;
                    }
                }
            })
            .catch(error => {
                console.error("Weather fetch error:", error.message);
                showError(error.message);
            });
    }

    function fetchWeatherDataByCoords(lat, lon) {
        const apiKey = "0f8a425c48ba79891ebea04d17e14186";
        const weatherapiUrlCurrentDate = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        const weatherapiUrlNextFiveDays = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        fetch(weatherapiUrlCurrentDate)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            })
            .then(data => {
                if (data.cod !== 200) {
                    alert("City not found");
                    return;
                }
                const tempCelsius = (data.main.temp - 273.15).toFixed(1);
                const tempFahrenheit = ((data.main.temp - 273.15) * 9 / 5 + 32).toFixed(1);
                const windkmph = (data.wind.speed * 3.6).toFixed(1);

                // Update UI
                const tempEl = document.getElementById("temperature");
                const toggleBtn = document.getElementById("tempToggle");
                tempEl.textContent = `${tempCelsius} °C`;

                tempEl.dataset.c = tempCelsius;
                tempEl.dataset.f = tempFahrenheit;
                tempEl.dataset.unit = "C";
                toggleBtn.textContent = "Show °F";

                function toggleTemp() {
                    if (tempEl.dataset.unit === "C") {
                        tempEl.textContent = `${tempEl.dataset.f} °F`;
                        tempEl.dataset.unit = "F";
                        toggleBtn.textContent = "Show °C";
                    } else {
                        tempEl.textContent = `${tempEl.dataset.c} °C`;
                        tempEl.dataset.unit = "C";
                        toggleBtn.textContent = "Show °F";
                    }
                }
                toggleBtn.onclick = toggleTemp;

                // City time + details
                const utcTimeStamp = data.dt * 1000;
                const cityOffsetMs = data.timezone * 1000;
                const cityTime = new Date(utcTimeStamp + cityOffsetMs);
                const hours = cityTime.getHours();
                const isDay = hours >= 6 && hours < 18 ? "Day" : "Night";
                const cityTimeFormat = cityTime.toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                });

                const weatherMain = data.weather[0].main;
                const weatherDesc = data.weather[0].description;
                const iconCode = data.weather[0].icon || "01d";
                const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

                document.getElementById("cityName").textContent =
                    `${data.name} (${isDay}) - ${cityTimeFormat}`;
                document.getElementById("wind").textContent = `${windkmph} km/h`;
                document.getElementById("humidity").textContent = `${data.main.humidity} %`;
                document.getElementById("weatherType").textContent = `${weatherMain} (${weatherDesc})`;
                document.getElementById("weatherIcon").src = iconUrl;
                document.getElementById("weatherIcon").alt = weatherDesc;

                // 🔔 Extreme heat alert
                const alertBox = document.getElementById("weatherAlert");
                if (parseFloat(tempCelsius) > 40) {
                    alertBox.textContent = "⚠️ Extreme heat alert!";
                    alertBox.classList.remove("hidden");
                } else {
                    alertBox.classList.add("hidden");
                }
            })
            .catch(error => {
                console.error("There was a problem with the fetch operation:", error);
            });
        fetch(weatherapiUrlNextFiveDays)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            })
            .then(data => {
                if (data.cod !== "200") {
                    alert("City not found");
                    return;
                }

                const presentDateJson = data.list[0].dt_txt;
                const date = new Date(presentDateJson);

                // Add 1 day for the first match
                date.setDate(date.getDate() + 1);
                let nextDate = date.toISOString().split("T")[0];

                // Select the weather boxes in the grid
                const weatherBoxes = document.querySelectorAll(".grid > div.bg-gray-50");

                let boxIndex = 0;

                for (let i = 0; i < data.list.length && boxIndex < weatherBoxes.length; i++) {
                    if (data.list[i].dt_txt.includes(nextDate)) {
                        const temp = (data.list[i].main.temp - 273.15).toFixed(1); // Kelvin → °C
                        const wind = data.list[i].wind.speed.toFixed(1);
                        const humidity = data.list[i].main.humidity;

                        // Format the date nicely (e.g., 14 Aug 2025)
                        const displayDate = new Date(nextDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        });

                        // Update the box content
                        weatherBoxes[boxIndex].querySelector(".font-bold").textContent = displayDate;
                        weatherBoxes[boxIndex].children[1].textContent = `Temperature: ${temp} °C`;
                        weatherBoxes[boxIndex].children[2].textContent = `Wind: ${wind} km/h`;
                        weatherBoxes[boxIndex].children[3].textContent = `Humidity: ${humidity} %`;

                        // Move to the next date and box
                        date.setDate(date.getDate() + 1);
                        nextDate = date.toISOString().split("T")[0];
                        boxIndex++;
                    }
                }
            })
            .catch(error => {
                console.error("There was a problem with the fetch operation:", error);
            });
    }

    // Default icon
    document.getElementById("weatherIcon").src = "https://openweathermap.org/img/wn/01d@2x.png";

    // Load dropdown on page load
    updateRecentCitiesDropdown();
});
