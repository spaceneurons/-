
(() => {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbzHSX9ODZvkX4C-7sqEkrVGIJQG3umMPcIIydTbh1cOCS5PSeQSEYyTDTS6IhCiK2xD/exec";

  const SERVICES = {
    oil: { name: "Замена масла", price: 2000 },
    tires: { name: "Шиномонтаж", price: 3000 },
    diagnostics: { name: "Диагностика", price: 1500 }
  };

  const OPEN_HOUR = 9;
  const CLOSE_HOUR = 18;

  const form = document.getElementById("booking-form");
  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");
  const serviceInput = document.getElementById("service");
  const dateInput = document.getElementById("date");
  const timeInput = document.getElementById("time");
  const priceOutput = document.getElementById("service-price");
  const alertBox = document.getElementById("form-alert");
  const appointments = document.getElementById("appointments");
  const emptyState = document.getElementById("empty-state");
  const count = document.getElementById("booking-count");

  let bookings = [];

  const pad = n => String(n).padStart(2, "0");

  const dateKey = date =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const todayKey = () => dateKey(new Date());

  const money = value =>
    `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));

  function scrollToElement(element) {
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function focusFirstError() {
    const fields = ["name", "phone", "date", "time"];

    for (const id of fields) {
      const error = document.getElementById(`${id}-error`);

      if (error && error.textContent.trim()) {
        const input = document.getElementById(id);

        scrollToElement(input);

        setTimeout(() => {
          input.focus({ preventScroll: true });
        }, 350);

        return;
      }
    }

    scrollToElement(alertBox);
  }

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `form-alert ${type}`;
    alertBox.hidden = false;

    if (type === "failure") {
      setTimeout(() => scrollToElement(alertBox), 50);
    }
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
    alertBox.className = "form-alert";
  }

  function setError(id, message) {
    document.getElementById(`${id}-error`).textContent = message || "";
  }

  function clearErrors() {
    ["name", "phone", "date", "time"].forEach(id => setError(id, ""));
  }

  function isWorkingDay(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const weekday = new Date(year, month - 1, day).getDay();

    return weekday >= 1 && weekday <= 6;
  }

  function slotDateTime(dateString, timeString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const [hour, minute] = timeString.split(":").map(Number);

    return new Date(year, month - 1, day, hour, minute);
  }

  function slotIsPast(date, time) {
    return slotDateTime(date, time).getTime() <= Date.now();
  }

  function getSlots(date) {
    if (!date || !isWorkingDay(date)) return [];

    const slots = [];

    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
      const time = `${pad(hour)}:00`;

      const occupied = bookings.some(item =>
        item.date === date && item.time === time
      );

      if (!occupied && !slotIsPast(date, time)) {
        slots.push(time);
      }
    }

    return slots;
  }

  function updatePrice() {
    priceOutput.textContent = money(SERVICES[serviceInput.value].price);
  }

  function updateTimeOptions(keepSelection = false) {
    const previous = keepSelection ? timeInput.value : "";
    const date = dateInput.value;

    timeInput.replaceChildren();

    if (!date) {
      timeInput.add(new Option("Сначала выберите дату", ""));
      timeInput.disabled = true;

      document.getElementById("time-hint").textContent =
        "Сначала выберите дату визита.";

      return;
    }

    if (!isWorkingDay(date)) {
      timeInput.add(new Option("В этот день сервис закрыт", ""));
      timeInput.disabled = true;

      document.getElementById("time-hint").textContent =
        "Выберите дату с понедельника по субботу.";

      return;
    }

    const slots = getSlots(date);

    if (!slots.length) {
      timeInput.add(new Option("Свободного времени нет", ""));
      timeInput.disabled = true;

      document.getElementById("time-hint").textContent =
        "На эту дату нет свободных часовых слотов.";

      return;
    }

    timeInput.disabled = false;
    timeInput.add(new Option("Выберите свободное время", ""));

    slots.forEach(time => timeInput.add(new Option(time, time)));

    if (slots.includes(previous)) {
      timeInput.value = previous;
    }

    document.getElementById("time-hint").textContent =
      "Последнее время начала записи — 17:00.";
  }

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(year, month - 1, day));
  }

  function pluralBookings(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) return "запись";

    if (
      mod10 >= 2 &&
      mod10 <= 4 &&
      !(mod100 >= 12 && mod100 <= 14)
    ) {
      return "записи";
    }

    return "записей";
  }

  function renderBookings() {
    const sorted = [...bookings].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    );

    count.textContent = `${sorted.length} ${pluralBookings(sorted.length)}`;
    emptyState.hidden = sorted.length > 0;

    // Телефоны посетителей не показываем в общем списке.
    appointments.innerHTML = sorted.map(item => `
      <article class="appointment">
        <div>
          <div class="appointment-name">${escapeHtml(item.name)}</div>
          <div class="appointment-service">
            ${escapeHtml(item.service)}
          </div>
        </div>
        <div class="appointment-time">
          ${escapeHtml(formatDate(item.date))}
          <small>${escapeHtml(item.time)}–${escapeHtml(
            `${pad(Number(item.time.slice(0, 2)) + 1)}:00`
          )}</small>
        </div>
        <div class="appointment-price">${money(item.price)}</div>
      </article>
    `).join("");
  }

  function fetchBookings() {
    return new Promise((resolve, reject) => {
      const callbackName =
        `bookingCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

      const script = document.createElement("script");

      const timeout = setTimeout(() => {
        finish(new Error("Не удалось получить ответ от Google Sheets."));
      }, 12000);

      function finish(error, result) {
        clearTimeout(timeout);
        delete window[callbackName];
        script.remove();

        if (error) reject(error);
        else resolve(result);
      }

      window[callbackName] = result => finish(null, result);

      script.onerror = () => finish(
        new Error("Ошибка подключения к Google Apps Script.")
      );

      script.src =
        `${API_URL}?action=list&callback=${callbackName}&_=${Date.now()}`;

      document.body.appendChild(script);
    });
  }

  async function refreshBookings(showError = true) {
    try {
      const result = await fetchBookings();

      if (
        !result ||
        result.success !== true ||
        !Array.isArray(result.bookings)
      ) {
        throw new Error(result?.error || "Неверный ответ сервера.");
      }

      bookings = result.bookings.map(item => ({
        name: String(item.name || "Клиент"),
        service: String(item.service || "Услуга"),
        date: String(item.date || "").slice(0, 10),
        time: String(item.time || "").slice(0, 5),
        price: Number(item.price || 0)
      }));

      renderBookings();
      updateTimeOptions(true);

      return true;
    } catch (error) {
      if (showError) {
        showAlert(
          `${error.message} Проверьте публикацию Google Apps Script.`,
          "failure"
        );
      }

      return false;
    }
  }

  async function waitForBooking(booking) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      await refreshBookings(false);

      const found = bookings.some(item =>
        item.date === booking.date &&
        item.time === booking.time &&
        item.name === booking.name &&
        item.service === SERVICES[booking.service].name
      );

      if (found) return true;
    }

    return false;
  }

  function validate() {
    clearErrors();

    let valid = true;

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const date = dateInput.value;
    const time = timeInput.value;

    if (name.length < 2) {
      setError("name", "Введите имя (не менее 2 символов).");
      valid = false;
    }

    // Разрешены цифры, необязательный + в начале,
    // пробелы, скобки и дефисы. Минимальной длины нет.
    const phonePattern = /^\+?[\d\s()-]+$/;
    const phoneDigits = phone.replace(/\D/g, "");

    if (!phoneDigits || !phonePattern.test(phone)) {
      setError(
        "phone",
        "Введите номер: цифры, при необходимости +, пробелы, скобки или дефисы."
      );
      valid = false;
    }

    if (!date) {
      setError("date", "Выберите дату визита.");
      valid = false;
    } else if (!isWorkingDay(date)) {
      setError("date", "В воскресенье сервис не работает.");
      valid = false;
    } else if (date < todayKey()) {
      setError("date", "Нельзя выбрать прошедшую дату.");
      valid = false;
    }

    if (!time) {
      setError("time", "Выберите свободное время.");
      valid = false;
    } else if (date && slotIsPast(date, time)) {
      setError("time", "Это время уже прошло.");
      valid = false;
    }

    return valid;
  }

  serviceInput.addEventListener("change", updatePrice);

  phoneInput.addEventListener("input", () => {
    setError("phone", "");
  });

  nameInput.addEventListener("input", () => {
    setError("name", "");
  });

  dateInput.addEventListener("change", () => {
    hideAlert();
    setError("date", "");
    setError("time", "");
    updateTimeOptions();
  });

  timeInput.addEventListener("change", () => {
    setError("time", "");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    hideAlert();

    if (!validate()) {
      focusFirstError();
      return;
    }

    const date = dateInput.value;
    const time = timeInput.value;
    const service = SERVICES[serviceInput.value];

    // Перед отправкой обновляем список занятых слотов с сервера.
    const loaded = await refreshBookings(false);

    if (!loaded) {
      showAlert(
        "Не удалось проверить свободное время. Запись пока не отправлена.",
        "failure"
      );
      return;
    }

    if (bookings.some(item => item.date === date && item.time === time)) {
      setError("time", "Это время уже заняли. Выберите другое.");
      updateTimeOptions();
      showAlert("Выбранный слот уже занят.", "failure");
      focusFirstError();
      return;
    }

    if (slotIsPast(date, time)) {
      setError("time", "Выберите время, которое ещё не наступило.");
      updateTimeOptions();
      focusFirstError();
      return;
    }

    const booking = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      service: serviceInput.value,
      date,
      time
    };

    const button = form.querySelector(".submit-button");
    button.disabled = true;
    button.textContent = "Сохраняем запись…";

    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(booking)
      });

      const confirmed = await waitForBooking(booking);

      if (!confirmed) {
        showAlert(
          "Не удалось подтвердить запись в таблице. Проверьте вкладку «Записи» перед повторной отправкой.",
          "failure"
        );
        return;
      }

      showAlert(
        `Запись подтверждена: ${formatDate(date)}, ${time}. Стоимость — ${money(service.price)}.`,
        "success"
      );

      form.reset();
      dateInput.min = todayKey();
      updatePrice();
      updateTimeOptions();

      scrollToElement(alertBox);
    } catch (error) {
      showAlert(
        "Не удалось отправить запись. Проверьте подключение к интернету.",
        "failure"
      );
    } finally {
      button.disabled = false;
      button.innerHTML =
        'Подтвердить запись <span aria-hidden="true">↗</span>';
    }
  });

  dateInput.min = todayKey();

  updatePrice();
  updateTimeOptions();
  renderBookings();
  refreshBookings();

  window.addEventListener("focus", () => {
    refreshBookings(false);
  });
})();
